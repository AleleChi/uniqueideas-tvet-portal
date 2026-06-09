/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary, ProgramStatus, AuditLog, DocumentType } from "../types";
import { PdfService } from "./pdf.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { DbRepo } from "./db";
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
    const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);
    if (!beneficiary) return false;

    if (beneficiary.emailTrackingStatus !== "Opened") {
      beneficiary.emailTrackingStatus = "Opened";
      
      const trackingHistory = beneficiary.emailTrackingHistory || [];
      trackingHistory.push({
        status: "Opened",
        timestamp: new Date().toISOString(),
        description: "Student clicked secure portal URL, verifying that transmission was opened."
      });
      beneficiary.emailTrackingHistory = trackingHistory;

      const oldAdmissionStatus = beneficiary.admissionStatus || "Pending";
      let newAdmissionStatus = oldAdmissionStatus;
      if (oldAdmissionStatus === "Admission Sent" || oldAdmissionStatus === "Admission Generated" || oldAdmissionStatus === "Pending") {
        beneficiary.admissionStatus = "Offer Viewed";
        newAdmissionStatus = "Offer Viewed";
      }

      // Write to Workflow History table!
      try {
        await DbRepo.saveWorkflowHistory({
          beneficiaryId: beneficiary.id,
          oldStatus: oldAdmissionStatus,
          newStatus: newAdmissionStatus,
          changedBy: beneficiary.email || "STUDENT_PORTAL",
          changedAt: new Date().toISOString(),
          remarks: "Trainee loaded secure response link; logged Offer Viewed event."
        });
      } catch (err) {}

      // Audit Log
      await this.logAction(
        beneficiary.email || `${beneficiary.firstName.toLowerCase()}@tvet-response.net`,
        "Email Opened",
        `Trainee opened verification email portal of candidate '${beneficiary.firstName} ${beneficiary.lastName}' (ID: ${beneficiary.id})`
      );

      await DbRepo.upsertBeneficiary(beneficiary);
      return true;
    }
    return false;
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

    const fetchStart = performance.now();
    const beneficiary = await DbRepo.getBeneficiaryById(decoded.id);
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
      submissionDate: new Date().toISOString()
    };

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
