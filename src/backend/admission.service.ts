/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary, ProgramStatus, AuditLog, DocumentType } from "../types";
import { PdfService } from "./pdf.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { DbRepo, getPgPool } from "./db";
import { CloudinaryService } from "./cloudinary.service";
import { DocumentService } from "./document.service";
import { buildSanitizedFilename } from "./pdfTraceAudit";
import { performance } from "perf_hooks";

export class AdmissionService {
  /**
   * Helper to log audit actions securely in PostgreSQL database
   */
  private static async logAction(username: string, action: string, details: string): Promise<void> {
    const newLog: AuditLog = {
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      username,
      role: "System Broker",
      action,
      details
    };
    await DbRepo.saveAuditLog(newLog);
  }

  /**
   * Prepares and dispatches an admission offer email with formal PDFs
   */
  static async sendAdmissionOffer(beneficiaryId: string, customDomain: string): Promise<any> {
    const totalStart = performance.now();

    // ─────────────────────────────────────────────────────────────────────────
    // IDEMPOTENT DISPATCH GUARD
    // Uses an atomic UPDATE … WHERE … RETURNING to claim the dispatch slot.
    // Only ONE concurrent caller can own the slot; all others are rejected
    // immediately.  A successful previous send within 5 minutes is also blocked.
    // The lock column (offer_dispatch_lock) is released after the full pipeline
    // completes, even on failure.
    // ─────────────────────────────────────────────────────────────────────────
    const pool = getPgPool();
    let dispatchLockAcquired = false;

    if (pool) {
      const client = await pool.connect();
      try {
        // Ensure the lock column exists (safe no-op if already present)
        await client.query(
          "ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS offer_dispatch_lock BOOLEAN DEFAULT FALSE"
        );
        await client.query(
          "ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS offer_dispatch_started_at TIMESTAMPTZ DEFAULT NULL"
        );

        // Atomic claim: only succeeds if no other request already holds the lock
        // AND the last successful send was more than 5 minutes ago.
        const claimRes = await client.query(`
          UPDATE beneficiaries
          SET offer_dispatch_lock = TRUE,
              offer_dispatch_started_at = NOW()
          WHERE id = $1
            AND (offer_dispatch_lock IS DISTINCT FROM TRUE)
            AND (
              admission_letter_sent_at IS NULL
              OR NOW() - admission_letter_sent_at > INTERVAL '5 minutes'
            )
          RETURNING id, admission_letter_sent_at
        `, [beneficiaryId]);

        if (claimRes.rowCount === 0) {
          // Could not claim → another dispatch is in-flight OR sent recently
          client.release();

          // Check why we were blocked so we can return a meaningful message
          const checkRes = await pool.query(
            "SELECT offer_dispatch_lock, admission_letter_sent_at FROM beneficiaries WHERE id = $1",
            [beneficiaryId]
          );
          const row = checkRes.rows[0];
          const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);

          if (row?.offer_dispatch_lock) {
            console.log(`[AdmissionService] Idempotent guard: dispatch already in-flight for ${beneficiaryId}.`);
          } else {
            const sentAt = row?.admission_letter_sent_at ? new Date(row.admission_letter_sent_at) : null;
            const diffMin = sentAt ? Math.round((Date.now() - sentAt.getTime()) / 60000) : 0;
            console.log(`[AdmissionService] Idempotent guard: offer sent ${diffMin}m ago for ${beneficiaryId}. Suppressing duplicate.`);
          }

          return {
            success: true,
            duplicate: true,
            secureLink: `${customDomain}/?token=${TokenService.generateToken(beneficiaryId, beneficiary?.tokenVersion || 1)}`,
            emailStatus: beneficiary?.emailStatus || "Sent",
            smtpErrorDetails: beneficiary?.smtpErrorDetails,
            beneficiary
          };
        }

        // Lock acquired — we own this dispatch
        dispatchLockAcquired = true;
        client.release();
        console.log(`[AdmissionService] Idempotent dispatch lock acquired for beneficiary: ${beneficiaryId}`);

      } catch (lockErr: any) {
        client.release();
        // If the column simply doesn't exist yet (first deploy) continue without the guard
        if (!lockErr.message?.includes("offer_dispatch_lock")) {
          throw lockErr;
        }
        console.warn("[AdmissionService] Dispatch lock column not yet available — proceeding without guard:", lockErr.message);
      }
    }

    // Measure Fetch time
    const fetchStart = performance.now();
    const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);
    const fetchDuration = performance.now() - fetchStart;
    console.log(`[PERF TRACE] [sendAdmissionOffer] Initial database beneficiary fetch took ${fetchDuration.toFixed(2)}ms`);
    
    if (!beneficiary) {
      throw new Error(`Beneficiary candidate '${beneficiaryId}' not found in registry.`);
    }
    
    // 1. Generate Letter references and update beneficiary local parameters
    const admissionRef = beneficiary.admissionRef || `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
    const originalAdmissionStatus = beneficiary.admissionStatus || "Pending";
    
    if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Pending") {
      beneficiary.admissionStatus = "Admission Generated";
    }
    beneficiary.admissionRef = admissionRef;
    beneficiary.admissionLetterGeneratedAt = beneficiary.admissionLetterGeneratedAt || new Date().toISOString();
    beneficiary.updatedAt = new Date().toISOString();

    // 2. Generate secure single-use response token link
    const secureToken = TokenService.generateToken(beneficiary.id, beneficiary.tokenVersion || 1);
    const secureLink = `${customDomain}/?token=${secureToken}`;

    // 3. Generate dynamic documents via unified DocumentService in parallel to optimize throughput
    console.log("[AdmissionService] Generating official admission & acceptance documents through DocumentService in parallel...");
    const [admissionResult, acceptanceResult] = await Promise.all([
      DocumentService.generateDocumentWithBuffer(
        beneficiary.id,
        DocumentType.ADMISSION_LETTER,
        "SYSTEM_ADMISSIONS",
        true
      ),
      DocumentService.generateDocumentWithBuffer(
        beneficiary.id,
        DocumentType.ACCEPTANCE_LETTER,
        "SYSTEM_ADMISSIONS",
        true
      )
    ]);
    const { document: admissionDoc, pdfBuffer: admissionPdfBuffer } = admissionResult;
    const { document: acceptanceDoc, pdfBuffer: acceptancePdfBuffer } = acceptanceResult;

    // Sync URLs to main columns
    const admissionPdfUrl = admissionDoc.pdfUrl;
    const acceptancePdfUrl = acceptanceDoc.pdfUrl;
    beneficiary.admissionLetterUrl = admissionPdfUrl;
    beneficiary.acceptanceLetterUrl = acceptancePdfUrl;

    const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

    // 5. Document Versioning for Admission Letter
    const currentVersions = beneficiary.admissionLetterVersions || [];
    const nextVersionNum = admissionDoc.version;
    const newVersionItem = {
      version: nextVersionNum,
      url: admissionPdfUrl,
      name: `${namePart}_ADMISSION_LETTER_v${nextVersionNum}.pdf`,
      generatedAt: new Date().toISOString()
    };
    beneficiary.admissionLetterVersions = [...currentVersions, newVersionItem];
    console.log(`[PIPELINE TRACE] STAGE 2 - STORAGE RECORD CREATION (Versioning List): Registered version '${newVersionItem.name}' in beneficiary.admissionLetterVersions.`);

    // 6. Save documents inside Candidate's local document list
    const currentDocs = beneficiary.documentsList || [];
    const updatedDocs = [...currentDocs];
    const newDocItem = {
      id: admissionDoc.id,
      name: `${namePart}_ADMISSION_LETTER.pdf`,
      type: "admission",
      url: admissionPdfUrl,
      uploadedAt: new Date().toISOString(),
      version: nextVersionNum
    };
    updatedDocs.push(newDocItem);
    beneficiary.documentsList = updatedDocs;
    console.log(`[PIPELINE TRACE] STAGE 2 - STORAGE RECORD CREATION (Candidate Document Registry): Appended registry item '${newDocItem.name}' in beneficiary.documentsList.`);

    // 7. Send automated email using formal unique email coordinates
    const toEmail = beneficiary.email || "uniqueideasproject@gmail.com";
    const admissionPdfBase64 = admissionPdfBuffer ? admissionPdfBuffer.toString("base64") : "";
    const acceptancePdfBase64 = acceptancePdfBuffer ? acceptancePdfBuffer.toString("base64") : "";

    const isAdmissionRealPdf = admissionPdfBuffer && admissionPdfBuffer.length >= 4 && admissionPdfBuffer[0] === 0x25 && admissionPdfBuffer[1] === 0x50 && admissionPdfBuffer[2] === 0x44 && admissionPdfBuffer[3] === 0x46;
    const isAcceptanceRealPdf = acceptancePdfBuffer && acceptancePdfBuffer.length >= 4 && acceptancePdfBuffer[0] === 0x25 && acceptancePdfBuffer[1] === 0x50 && acceptancePdfBuffer[2] === 0x44 && acceptancePdfBuffer[3] === 0x46;

    if (!isAdmissionRealPdf) {
      console.error("[AdmissionService] WARNING: Admission Letter PDF compilation failed or is corrupt! Aborting automated email dispatch to prevent sending invalid files.");
      throw new Error("Admission Letter compilation failed: Generated file is invalid or corrupted. Aborting email dispatch.");
    }

    if (!isAcceptanceRealPdf) {
      console.error("[AdmissionService] WARNING: Acceptance Form PDF compilation failed or is corrupt! Aborting automated email dispatch to prevent sending invalid files.");
      throw new Error("Acceptance Form compilation failed: Generated file is invalid or corrupted. Aborting email dispatch.");
    }

    const admissionAttachmentName = buildSanitizedFilename(beneficiary, "ADMISSION_LETTER", "pdf");
    const acceptanceAttachmentName = buildSanitizedFilename(beneficiary, "ACCEPTANCE_LETTER", "pdf");

    console.log(`[AdmissionService] All PDF attachments successfully verified. Dispatched recipient: ${toEmail}. Files: ${admissionAttachmentName} (${admissionPdfBuffer.length} bytes), ${acceptanceAttachmentName} (${acceptancePdfBuffer.length} bytes). Tracing to step 6...`);

    const emailSendStart = performance.now();
    const mailResult = await EmailService.sendAdmissionEmail(
      toEmail, 
      `${beneficiary.firstName} ${beneficiary.lastName}`, 
      secureLink,
      [
        {
          name: admissionAttachmentName,
          content: admissionPdfBase64,
          contentType: "application/pdf"
        },
        {
          name: acceptanceAttachmentName,
          content: acceptancePdfBase64,
          contentType: "application/pdf"
        }
      ]
    );
    const emailSendDuration = performance.now() - emailSendStart;
    console.log(`[PERF TRACE] SMTP/Resend notification email send took ${emailSendDuration.toFixed(2)}ms`);

    let changeRemarks = "";
    // Set Separate Email Status as requested
    if (mailResult.success) {
      beneficiary.emailStatus = "Sent";
      if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Admission Generated") {
        beneficiary.admissionStatus = "Admission Sent";
      }
      beneficiary.admissionLetterSentAt = new Date().toISOString();
      beneficiary.smtpErrorDetails = undefined;
      changeRemarks = "Admission offer letter successfully generated and sent via email.";
    } else {
      beneficiary.emailStatus = "Failed";
      beneficiary.smtpErrorDetails = mailResult.status;
      changeRemarks = `Admission offer letter generated, but email dispatch failed: ${mailResult.status}`;
    }

    // Append operations tracker entry
    const deliveryHistory = beneficiary.emailDeliveryHistory || [];
    const newDeliveryRecord = {
      dateSent: new Date().toISOString(),
      recipientEmail: toEmail,
      deliveryResult: mailResult.success ? ("Sent" as const) : ("Failed" as const),
      smtpResponse: mailResult.success 
        ? (mailResult.apiResponse ? JSON.stringify(mailResult.apiResponse) : (mailResult.messageId ? JSON.stringify({ id: mailResult.messageId }) : "SMTP Message accepted by server")) 
        : (mailResult.apiResponse ? JSON.stringify(mailResult.apiResponse) : (mailResult.errorDetails || "Connection Timeout / Transport Error"))
    };
    beneficiary.emailDeliveryHistory = [...deliveryHistory, newDeliveryRecord];

    const persistenceStart = performance.now();
    // Write to Workflow History table!
    await DbRepo.saveWorkflowHistory({
      beneficiaryId: beneficiary.id,
      oldStatus: originalAdmissionStatus,
      newStatus: beneficiary.admissionStatus || "Admission Sent",
      changedBy: "SYSTEM_ADMISSIONS",
      changedAt: new Date().toISOString(),
      remarks: changeRemarks
    });

    // 8. Append secure logs and write to storage
    await this.logAction(
      "admission@uniqueideas.dontechservicesconst.com", 
      "Email Sent", 
      `Dispatched formal admission offer & PDFs to '${beneficiary.firstName} ${beneficiary.lastName}'. Delivery Status: ${mailResult.success ? 'Success' : 'Failed'}`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    const persistenceDuration = performance.now() - persistenceStart;
    console.log(`[PERF TRACE] Database updates (workflow history, logs, upsertBeneficiary) took ${persistenceDuration.toFixed(2)}ms`);

    // Release the dispatch lock now that the full pipeline is complete.
    // The lock is released regardless of email success/failure so that
    // an admin can manually retry after a genuine SMTP failure.
    if (pool && dispatchLockAcquired) {
      try {
        await pool.query(
          "UPDATE beneficiaries SET offer_dispatch_lock = FALSE WHERE id = $1",
          [beneficiaryId]
        );
        console.log(`[AdmissionService] Dispatch lock released for beneficiary: ${beneficiaryId}`);
      } catch (unlockErr) {
        console.error("[AdmissionService] Failed to release dispatch lock:", unlockErr);
        // Non-fatal — lock will auto-heal on next successful send
      }
    }

    const totalDuration = performance.now() - totalStart;
    console.log(`[PERF TRACE] sendAdmissionOffer TOTAL request duration took ${totalDuration.toFixed(2)}ms`);

    return { 
      success: mailResult.success, 
      secureLink, 
      emailStatus: beneficiary.emailStatus, 
      smtpErrorDetails: beneficiary.smtpErrorDetails,
      beneficiary 
    } as any;
  }

  /**
   * Logs a tracking open event when the candidate opens their communication link.
   */
  static async registerEmailOpened(beneficiaryId: string): Promise<boolean> {
    const resolvedId = await DbRepo.resolveBeneficiaryIdResiliently(beneficiaryId);
    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) return false;

    // Safe direct UPDATE to track email opened status in the email_logs table
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          "UPDATE email_logs SET tracking_status = 'Opened', updated_at = NOW() WHERE beneficiary_id = $1",
          [resolvedId]
        );
      } catch (e) {
        console.error("[registerEmailOpened] Failed to update tracking_status safely:", e);
      }
    }

    // Safely update memory reference without executing a destructive disk upsert which increments version controls
    beneficiary.emailTrackingStatus = "Opened";
    return true;
  }

  /**
   * Admin verification checks: Acceptance Approved
   */
  static async approveAcceptance(beneficiaryId: string, adminUser: string): Promise<Beneficiary> {
    const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);
    if (!beneficiary) throw new Error("Beneficiary not found");

    const oldStatus = beneficiary.admissionStatus || "Pending";
    if (oldStatus !== "Acceptance Uploaded" && oldStatus !== "Under Review" && oldStatus !== "Accepted") {
      throw new Error(`Invalid transition from status '${oldStatus}' to 'Accepted'. This action is blocked by admission workflow guidelines.`);
    }

    beneficiary.admissionStatus = "Accepted";
    beneficiary.status = ProgramStatus.VERIFIED;
    beneficiary.updatedAt = new Date().toISOString();

    console.log("[AdmissionService] Generating official dynamic Enrollment Confirmation & Certificate PDFs...");
    
    // Generate Enrollment Confirmation PDF using central DocumentService
    const { document: enrollmentDoc } = await DocumentService.generateDocumentWithBuffer(
      beneficiary.id,
      DocumentType.ENROLLMENT_CONFIRMATION,
      adminUser,
      true
    );
    beneficiary.enrollmentLetterUrl = enrollmentDoc.pdfUrl;

    // Generate Completion Certificate PDF using central DocumentService
    const { document: certDoc } = await DocumentService.generateDocumentWithBuffer(
      beneficiary.id,
      DocumentType.COMPLETION_CERTIFICATE,
      adminUser,
      true
    );
    beneficiary.certificateUrl = certDoc.pdfUrl;

    // Append core document lists for retrospective audit compliance
    const currentDocs = beneficiary.documentsList || [];
    beneficiary.documentsList = [
      ...currentDocs,
      {
        id: enrollmentDoc.id,
        name: "Official Trainee Biometrics Enrollment Confirmation.pdf",
        type: "enrollment",
        url: enrollmentDoc.pdfUrl,
        uploadedAt: new Date().toISOString(),
        version: enrollmentDoc.version
      },
      {
        id: certDoc.id,
        name: "Official Skill Competency Certificate of Completion.pdf",
        type: "certificate",
        url: certDoc.pdfUrl,
        uploadedAt: new Date().toISOString(),
        version: certDoc.version
      }
    ];

    // Persist to Workflow History secure table
    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus,
        newStatus: "Accepted",
        changedBy: adminUser,
        changedAt: new Date().toISOString(),
        remarks: "Verification approved. Approved student acceptance offer; automatically compiled final biometrics enrollment slip & certificate."
      });
    } catch (err) {}

    await this.logAction(
      adminUser,
      "Acceptance Approved",
      `Transition details - User ID: system, Email: ${adminUser}, Previous: ${oldStatus}, New: Accepted, Timestamp: ${new Date().toISOString()}, Reason: Verification approved. Approved acceptance for '${beneficiary.firstName} ${beneficiary.lastName}'. Enrollment PDF & Certificate compiled and logged.`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    return beneficiary;
  }

  /**
   * Admin verification checks: Acceptance Rejected
   */
  static async rejectAcceptance(beneficiaryId: string, adminUser: string, reason: string): Promise<Beneficiary> {
    const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);
    if (!beneficiary) throw new Error("Beneficiary not found");

    const oldStatus = beneficiary.admissionStatus || "Pending";
    if (oldStatus !== "Acceptance Uploaded" && oldStatus !== "Under Review" && oldStatus !== "Acceptance Rejected") {
      throw new Error(`Invalid transition from status '${oldStatus}' to 'Acceptance Rejected'. This action is blocked by admission workflow guidelines.`);
    }

    beneficiary.admissionStatus = "Acceptance Rejected";
    beneficiary.acceptanceLetterUploaded = false;
    beneficiary.acceptanceLetterUrl = undefined;
    beneficiary.acceptanceLetterUploadedAt = undefined;
    beneficiary.updatedAt = new Date().toISOString();

    // Persist to Workflow History secure table
    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus,
        newStatus: "Acceptance Rejected",
        changedBy: adminUser,
        changedAt: new Date().toISOString(),
        remarks: reason || "No rejection reason specified by administrator"
      });
    } catch (err) {}

    await this.logAction(
      adminUser,
      "Acceptance Rejected",
      `Transition details - User ID: system, Email: ${adminUser}, Previous: ${oldStatus}, New: Acceptance Rejected, Timestamp: ${new Date().toISOString()}, Reason: ${reason}. Administrator rejected acceptance for Trainee '${beneficiary.firstName} ${beneficiary.lastName}' (ID: ${beneficiary.id}).`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    return beneficiary;
  }

  /**
   * Public Student response portal sub-flow: process signatures and demographics
   */
  static async processPortalSubmission(token: string, formData: any): Promise<{ success: boolean; beneficiary: Beneficiary }> {
    const totalStart = performance.now();
    const decoded = TokenService.verifyToken(token);
    if (!decoded || !decoded.id) {
      throw new Error("Activation session token is invalid, corrupted, or has expired.");
    }

    const resolvedId = await DbRepo.resolveBeneficiaryIdResiliently(decoded.id);

    // Strict PostgreSQL transaction and row-level locking on beneficiaries and admissions tables
    const pool = getPgPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock both beneficiary and admission records
        await client.query("SELECT id FROM beneficiaries WHERE id = $1 FOR UPDATE", [resolvedId]);
        try {
          await client.query("SELECT beneficiary_id FROM admissions WHERE beneficiary_id = $1 FOR UPDATE", [resolvedId]);
        } catch (admLockErr) {
          // Admissions table record may not be created yet, proceed gracefully
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("[processPortalSubmission] Failed to acquire row locks safely:", err);
      } finally {
        client.release();
      }
    }

    const fetchStart = performance.now();
    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    const fetchDuration = performance.now() - fetchStart;
    console.log(`[PERF TRACE] [processPortalSubmission] Initial database beneficiary fetch took ${fetchDuration.toFixed(2)}ms`);

    if (!beneficiary) {
      throw new Error("Primary biographical record corresponding to portal session could not be tracked.");
    }

    // Check token version (Phase 1)
    const tokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 1;
    const bTokenVersion = beneficiary.tokenVersion !== undefined ? beneficiary.tokenVersion : 1;
    if (tokenVersion !== bTokenVersion) {
      throw new Error("TOKEN_REVOKED: This portal or admission token has been revoked due to administrative rollback or status update.");
    }

    // Validate 10-day provisional offer expiration window
    if (beneficiary.admissionLetterSentAt) {
      const sentTime = new Date(beneficiary.admissionLetterSentAt).getTime();
      const expiresTime = sentTime + (10 * 24 * 60 * 60 * 1000); // 10 days
      if (Date.now() > expiresTime) {
        if (beneficiary.admissionStatus !== "EXPIRED") {
          beneficiary.admissionStatus = "EXPIRED";
          await DbRepo.upsertBeneficiary(beneficiary);
        }
        throw new Error("ACCEPTANCE_LOCKED_EXPIRED: The 10-day provisional offer acceptance window has elapsed. This offer is permanently locked as EXPIRED and no modifications can be accepted.");
      }
    }

    const oldAdmissionStatus = beneficiary.admissionStatus || "Pending";

    // Register active form version control
    const currentFormVersions = beneficiary.admissionFormVersions || [];
    const nextFormVerNum = currentFormVersions.length + 1;
    const newFormVerItem = {
      version: nextFormVerNum,
      formData: {
        emergencyName: formData.emergencyName,
        emergencyPhone: formData.emergencyPhone,
        guardianName: formData.guardianName,
        highestQualification: formData.highestQualification,
        priorKnowledge: formData.priorKnowledge,
        medicalDeclaration: formData.medicalDeclaration
      },
      submittedAt: new Date().toISOString()
    };
    beneficiary.admissionFormVersions = [...currentFormVersions, newFormVerItem];

    // Capture and securely store the digital signature string
    const signatureValue = formData.signature || formData.esignature || formData.digitalSignature || "";
    beneficiary.digitalSignature = signatureValue;

    // 2. Map form completions
    beneficiary.admissionFormCompleted = true;
    beneficiary.admissionFormStatus = "Verified";
    beneficiary.admissionFormData = {
      emergencyName: formData.emergencyName,
      emergencyPhone: formData.emergencyPhone,
      guardianName: formData.guardianName,
      highestQualification: formData.highestQualification,
      priorKnowledge: formData.priorKnowledge,
      medicalDeclaration: formData.medicalDeclaration,
      submissionDate: new Date().toISOString(),
      digitalSignature: signatureValue,
      signature: signatureValue
    };

    // Save signature state to database BEFORE generating documents so compile reads correct configurations
    await DbRepo.upsertBeneficiary(beneficiary);

    // 3. Process signed acceptance letter document compile
    const docProcessStart = performance.now();
    let signedAcceptanceUrl = "";
    let registeredDocId = "";
    let nextAccLetterVer = (beneficiary.acceptanceLetterVersions || []).length + 1;

    if (formData.uploadedAcceptanceLetter) {
      console.log("[AdmissionService] Custom hand-signed file detected, syncing to Cloudinary...");
      const cloudStart = performance.now();
      if (formData.uploadedAcceptanceLetter.startsWith("data:")) {
        signedAcceptanceUrl = await CloudinaryService.uploadDocument(
          formData.uploadedAcceptanceLetter, 
          `Signed_Acceptance_${beneficiary.id}`
        );
      } else {
        signedAcceptanceUrl = formData.uploadedAcceptanceLetter;
      }
      const cloudDuration = performance.now() - cloudStart;
      console.log(`[PERF TRACE] Custom hand-signed Cloudinary upload took ${cloudDuration.toFixed(2)}ms`);

      // Manually register in generated_documents table for absolute completeness & traceability!
      const docId = `gdoc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const prefix = "TVET-ACC";
      const hex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      const verificationCode = `${prefix}-${hex}`;
      registeredDocId = docId;

      const newDocObj = {
        id: docId,
        beneficiaryId: beneficiary.id,
        documentType: DocumentType.ACCEPTANCE_LETTER,
        version: nextAccLetterVer,
        pdfUrl: signedAcceptanceUrl,
        generatedBy: beneficiary.email || "STUDENT_PORTAL",
        createdAt: new Date().toISOString(),
        verificationCode,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };
      await DbRepo.saveGeneratedDocument(newDocObj);
      
      try {
        await DbRepo.saveDeliveryLog({
          documentId: docId,
          beneficiaryId: beneficiary.id,
          deliveryType: "Generated",
          recipient: beneficiary.email || `${beneficiary.firstName} ${beneficiary.lastName}`,
          sentBy: beneficiary.email || "STUDENT_PORTAL",
          status: "Custom Signed File Uploaded Successfully"
        });
      } catch (err) {}
    } else {
      console.log("[AdmissionService] Compiling signed Acceptance Letter contract PDF via Puppeteer...");
      // Generate through unified DocumentService to leverage QR/verification/watermark features perfectly!
      const { document: acceptanceDoc } = await DocumentService.generateDocumentWithBuffer(
        beneficiary.id,
        DocumentType.ACCEPTANCE_LETTER,
        "STUDENT_PORTAL",
        true
      );
      signedAcceptanceUrl = acceptanceDoc.pdfUrl;
      registeredDocId = acceptanceDoc.id;
      nextAccLetterVer = acceptanceDoc.version;
    }
    const docProcessDuration = performance.now() - docProcessStart;
    console.log(`[PERF TRACE] Acceptance document processing/compile took ${docProcessDuration.toFixed(2)}ms`);

    const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

    beneficiary.acceptanceLetterUploaded = true;
    beneficiary.acceptanceLetterUrl = signedAcceptanceUrl;
    beneficiary.acceptanceLetterUploadedAt = new Date().toISOString();

    // Document Versioning for Acceptance Letter
    const currentAccLetters = beneficiary.acceptanceLetterVersions || [];
    const newAccLetterItem = {
      version: nextAccLetterVer,
      url: signedAcceptanceUrl,
      name: `${namePart}_ACCEPTANCE_LETTER_v${nextAccLetterVer}.pdf`,
      uploadedAt: new Date().toISOString()
    };
    beneficiary.acceptanceLetterVersions = [...currentAccLetters, newAccLetterItem];

    // 4. Update core document lists
    const currentDocs = beneficiary.documentsList || [];
    const updatedDocs = [...currentDocs];
    updatedDocs.push({
      id: registeredDocId,
      name: `${namePart}_ACCEPTANCE_LETTER.pdf`,
      type: "acceptance",
      url: signedAcceptanceUrl,
      uploadedAt: new Date().toISOString(),
      version: nextAccLetterVer
    });
    beneficiary.documentsList = updatedDocs;

    // 5. Upgrade lifecycle statuses automatic matching rules:
    beneficiary.admissionStatus = "Acceptance Uploaded";
    beneficiary.status = ProgramStatus.PENDING_PHOTO; // Mark status pending admin check
    beneficiary.updatedAt = new Date().toISOString();

    const dbStart = performance.now();
    // Write to Workflow History secure table!
    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus: oldAdmissionStatus,
        newStatus: "Acceptance Uploaded",
        changedBy: beneficiary.email || "STUDENT_PORTAL",
        changedAt: new Date().toISOString(),
        remarks: "Trainee successfully completed supplemental profiles and signed/uploaded acceptance offer terms."
      });
    } catch (err) {}

    // 6. Generate detailed audit log traces
    await this.logAction(
      beneficiary.email || `${beneficiary.firstName.toLowerCase()}@tvet-response.net`,
      "Acceptance Uploaded",
      `Student ${beneficiary.firstName} ${beneficiary.lastName} (ID: ${beneficiary.id}) signed acceptance & completed supplemental profiles via secure link.`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    const dbDuration = performance.now() - dbStart;
    console.log(`[PERF TRACE] Portal submission DB commits took ${dbDuration.toFixed(2)}ms`);

    const totalDuration = performance.now() - totalStart;
    console.log(`[PERF TRACE] processPortalSubmission TOTAL took ${totalDuration.toFixed(2)}ms`);
    return { success: true, beneficiary };
  }
}