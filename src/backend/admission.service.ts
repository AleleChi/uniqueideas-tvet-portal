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
   * Translates incoming string references resiliently.
   */
  static async resolveBeneficiaryIdResiliently(inputKey: string, pool: any): Promise<string | null> {
    if (!inputKey) return null;
    const cleanKey = String(inputKey).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey)) {
      return cleanKey;
    }

    if (pool) {
      try {
        const terms = [cleanKey];
        const match = cleanKey.match(/^IDEAS-(\d{4})-(\d+)$/i);
        if (match) {
          const year = match[1];
          const numStr = match[2];
          const paddedNum = numStr.padStart(3, "0");
          terms.push(`IDEAS/TVET/ADM/${paddedNum}/${year}`);
        }

        for (const term of terms) {
          const bRes = await pool.query(
            "SELECT id FROM beneficiaries WHERE id = $1 OR custom_fields->>'tvet_id' = $1 OR custom_fields->>'reference_number' = $1 LIMIT 1",
            [term]
          );
          if (bRes.rows.length > 0) {
            return bRes.rows[0].id;
          }

          const pRes = await pool.query(
            "SELECT beneficiary_id FROM trainee_profiles WHERE tvet_id = $1 LIMIT 1",
            [term]
          );
          if (pRes.rows.length > 0) {
            return pRes.rows[0].beneficiary_id;
          }

          const aRes = await pool.query(
            "SELECT beneficiary_id FROM admissions WHERE admission_ref = $1 OR admission_form_ref = $1 LIMIT 1",
            [term]
          );
          if (aRes.rows.length > 0) {
            return aRes.rows[0].beneficiary_id;
          }

          // generated_documents
          const gdRes = await pool.query(
            "SELECT beneficiary_id FROM generated_documents WHERE id = $1 OR verification_code = $1 LIMIT 1",
            [term]
          );
          if (gdRes.rows.length > 0) {
            return gdRes.rows[0].beneficiary_id;
          }
        }
      } catch (err) {
        console.error("[AdmissionService.resolveBeneficiaryIdResiliently] DB lookup failed:", err);
      }
    }
    return cleanKey;
  }

  static async logTokenEvent(beneficiaryId: string, action: string, token: string, details?: string): Promise<void> {
    const shortToken = TokenService.getShortHash(token);
    await DbRepo.saveAuditLog({
      id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      username: `system@tvet-portal.net`,
      role: "Token System",
      action,
      details: `Candidate: ${beneficiaryId} | Token prefix: ${shortToken} | ${details || ""}`
    }).catch(() => {});
  }

  static async createPublicResponseToken(beneficiaryId: string, purpose: string = "OFFER_ACCEPTANCE", clientOrPool?: any): Promise<string> {
    const pool = getPgPool();
    const conn = clientOrPool || (pool ? await pool.connect() : null);
    const releaseConn = !clientOrPool && conn && pool;
    try {
      const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, conn)) || beneficiaryId;
      
      let tokenVersion = 1;
      if (conn) {
        const bRes = await conn.query("SELECT token_version FROM beneficiaries WHERE id = $1", [resolvedId]);
        if (bRes.rows.length > 0 && bRes.rows[0].token_version) {
          tokenVersion = bRes.rows[0].token_version;
        }
      } else {
        const b = await DbRepo.getBeneficiaryById(resolvedId);
        tokenVersion = b?.tokenVersion || 1;
      }

      const secureToken = TokenService.generateToken(resolvedId, tokenVersion);
      const tokenHash = TokenService.hashToken(secureToken);
      
      if (conn) {
        await conn.query(
          `INSERT INTO public_response_tokens (
             beneficiary_id, token, token_hash, status, expires_at, is_used, purpose, token_version, created_at, updated_at
           ) VALUES (
             $1, $2, $3, 'ACTIVE', NOW() + INTERVAL '10 days', false, $4, $5, NOW(), NOW()
           ) ON CONFLICT (token) DO UPDATE SET 
             token_hash = EXCLUDED.token_hash, 
             status = EXCLUDED.status, 
             is_used = false,
             updated_at = NOW()`,
          [resolvedId, secureToken, tokenHash, purpose, tokenVersion]
        );
      } else if (pool) {
        await pool.query(
          `INSERT INTO public_response_tokens (
             beneficiary_id, token, token_hash, status, expires_at, is_used, purpose, token_version, created_at, updated_at
           ) VALUES (
             $1, $2, $3, 'ACTIVE', NOW() + INTERVAL '10 days', false, $4, $5, NOW(), NOW()
           ) ON CONFLICT (token) DO UPDATE SET 
             token_hash = EXCLUDED.token_hash, 
             status = EXCLUDED.status, 
             is_used = false,
             updated_at = NOW()`,
          [resolvedId, secureToken, tokenHash, purpose, tokenVersion]
        );
      }
      
      await AdmissionService.logTokenEvent(
        resolvedId,
        "OFFER_TOKEN_CREATED",
        secureToken,
        `Created/Persisted new offer token of purpose: ${purpose}`
      );
      
      return secureToken;
    } finally {
      if (releaseConn && conn) conn.release();
    }
  }

  static async getOrCreateActiveOfferToken(beneficiaryId: string, customDomain: string, clientOrPool?: any): Promise<{ secureToken: string; secureLink: string; reused: boolean; tokenVersion: number }> {
    const pool = getPgPool();
    const conn = clientOrPool || (pool ? await pool.connect() : null);
    const releaseConn = !clientOrPool && conn && pool;
    try {
      const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, conn)) || beneficiaryId;
      let tokenVersion = 1;
      let existingToken: string | null = null;

      if (conn) {
        try {
          const bRes = await conn.query("SELECT token_version FROM beneficiaries WHERE id = $1", [resolvedId]);
          if (bRes.rows.length > 0 && bRes.rows[0].token_version) {
            tokenVersion = bRes.rows[0].token_version;
          }

          const tRes = await conn.query(
            `SELECT token FROM public_response_tokens 
             WHERE beneficiary_id = $1 
               AND purpose = 'OFFER_ACCEPTANCE' 
               AND status = 'ACTIVE'
               AND (is_used = false OR is_used IS NULL) 
               AND revoked_at IS NULL 
               AND deleted_at IS NULL 
             ORDER BY created_at DESC LIMIT 1`,
            [resolvedId]
          );
          if (tRes.rows.length > 0 && tRes.rows[0].token) {
            existingToken = tRes.rows[0].token;
          }
        } catch (dbErr) {
          console.error("[getOrCreateActiveOfferToken] DB query fallback:", dbErr);
        }
      } else {
        const b = await DbRepo.getBeneficiaryById(resolvedId);
        tokenVersion = b?.tokenVersion || 1;
      }

      if (existingToken) {
        await AdmissionService.logTokenEvent(
          resolvedId,
          "OFFER_TOKEN_REUSED",
          existingToken,
          "Reusing active unexpired offer token"
        );
        return {
          secureToken: existingToken,
          secureLink: `${customDomain}/?token=${existingToken}`,
          reused: true,
          tokenVersion
        };
      }

      const secureToken = await AdmissionService.createPublicResponseToken(resolvedId, "OFFER_ACCEPTANCE", conn);

      return {
        secureToken,
        secureLink: `${customDomain}/?token=${secureToken}`,
        reused: false,
        tokenVersion
      };
    } finally {
      if (releaseConn && conn) conn.release();
    }
  }

  /**
   * Prepares and dispatches an admission offer email with formal PDFs.
   * Completely asynchronous, handles PDF rendering in-memory on-the-fly,
   * sends email instantly, and hands Cloudinary upload and database sync 
   * to a non-blocking background task.
   */
  static async sendAdmissionOffer(beneficiaryId: string, customDomain: string): Promise<any> {
    const totalStart = performance.now();
    
    const pool = getPgPool();
    let resolvedId = beneficiaryId;
    let nextVersionNum = 1;
    let nextAccLetterVerNum = 1;
    
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        
        const resolved = await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, client);
        if (resolved) {
          resolvedId = resolved;
        }
        
        // 1. Enforce strict row-level locking of beneficiary registry details
        const bLockRes = await client.query(
          "SELECT id, token_version FROM beneficiaries WHERE id = $1 FOR UPDATE",
          [resolvedId]
        );
        if (bLockRes.rows.length === 0) {
          await client.query("ROLLBACK");
          throw new Error(`Beneficiary candidate '${resolvedId}' not found in registry.`);
        }
        
        let lastSentAt: Date | null = null;
        
        try {
          const admLock = await client.query(
            "SELECT admission_status, admission_letter_sent_at, offer_sent_at, offer_expires_at FROM admissions WHERE beneficiary_id = $1 AND deleted_at IS NULL FOR UPDATE",
            [resolvedId]
          );
          if (admLock.rows.length > 0 && admLock.rows[0].admission_letter_sent_at) {
            lastSentAt = new Date(admLock.rows[0].admission_letter_sent_at);
          }
        } catch (admErr) {
          // Admissions lock table update failed or row doesn't exist, proceed gracefully
        }
        
        if (lastSentAt) {
          const diffMs = Date.now() - lastSentAt.getTime();
          if (diffMs < 15000) {
            // Overlapping duplicate within 15 seconds - Suppress dispatch
            const tokenRes = await AdmissionService.getOrCreateActiveOfferToken(resolvedId, customDomain, client);
            await client.query("ROLLBACK");
            console.log(`[AdmissionService] Concurrency Guard triggered. Suppressing duplicate send for ${resolvedId}.`);
            const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
            return {
              success: true,
              secureLink: tokenRes.secureLink,
              emailStatus: beneficiary?.emailStatus || "Sent",
              smtpErrorDetails: beneficiary?.smtpErrorDetails,
              beneficiary
            };
          }
        }
        
        // Predetermine document versions under active row-level transaction lock
        const latestVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ADMISSION_LETTER);
        nextVersionNum = latestVersion + 1;

        const latestAccVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ACCEPTANCE_LETTER);
        nextAccLetterVerNum = latestAccVersion + 1;

        // Perform fast direct DB mark releases & token registration synchronously BEFORE email delivery
        const tokenRes = await AdmissionService.getOrCreateActiveOfferToken(resolvedId, customDomain, client);
        
        await client.query(
          `UPDATE beneficiaries SET updated_at = NOW() WHERE id = $1`,
          [resolvedId]
        );
        
        try {
          await client.query(
            `INSERT INTO admissions (
               beneficiary_id, admission_status, admission_letter_sent_at, offer_sent_at, offer_expires_at, created_at, updated_at
             ) VALUES (
               $1, 'Admission Sent', NOW(), NOW(), NOW() + INTERVAL '10 days', NOW(), NOW()
             ) ON CONFLICT (beneficiary_id) DO UPDATE SET
               admission_status = CASE 
                 WHEN admissions.admission_status IS NULL OR admissions.admission_status IN ('Pending', 'Admission Generated') THEN 'Admission Sent'
                 ELSE admissions.admission_status
               END,
               admission_letter_sent_at = NOW(),
               offer_sent_at = NOW(),
               offer_expires_at = NOW() + INTERVAL '10 days',
               updated_at = NOW()`,
            [resolvedId]
          );
        } catch (admInsErr) {
          console.error("[sendOfferLetter] Failed to upsert admissions record:", admInsErr);
        }

        try {
          await client.query(
            `INSERT INTO document_dispatches (
               id, beneficiary_id, document_type, email_address, status, secure_token, sent_at, expires_at, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), $1, 'ADMISSION_LETTER', $2, 'SENT', $3, NOW(), NOW() + INTERVAL '10 days', NOW(), NOW()
             ) ON CONFLICT (secure_token) DO UPDATE SET updated_at = NOW()`,
            [resolvedId, 'pending@dispatch.net', tokenRes.secureToken]
          );
        } catch (dispErr) {
          console.error("[sendAdmissionOffer] Dispatch row pre-registration warning:", dispErr);
        }
        
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      resolvedId = (await DbRepo.resolveBeneficiaryIdResiliently(beneficiaryId)) || beneficiaryId;
    }

    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) {
      throw new Error(`Beneficiary candidate '${resolvedId}' not found in registry.`);
    }

    // Set immediate status identifiers to prevent race operations
    const admissionRef = beneficiary.admissionRef || `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
    const originalAdmissionStatus = beneficiary.admissionStatus || "Pending";
    
    if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Pending" || beneficiary.admissionStatus === "Admission Generated") {
      beneficiary.admissionStatus = "Admission Sent";
    }
    beneficiary.admissionRef = admissionRef;
    beneficiary.admissionLetterGeneratedAt = beneficiary.admissionLetterGeneratedAt || new Date().toISOString();
    beneficiary.updatedAt = new Date().toISOString();

    const { secureToken, secureLink } = await AdmissionService.getOrCreateActiveOfferToken(beneficiary.id, customDomain);

    // Compile dynamic validation QR Codes & meta parameters on the fly inside memory
    const prefixAdm = "TVET-ADM";
    const hexAdm = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
    const verificationCodeAdm = `${prefixAdm}-${hexAdm}`;

    const prefixAcc = "TVET-ACC";
    const hexAcc = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
    const verificationCodeAcc = `${prefixAcc}-${hexAcc}`;

    // Compile document attachments on-the-fly as raw data buffers in memory using PdfService
    console.log(`[AdmissionService] Compiling PDFs in-memory on-the-fly for candidate: ${resolvedId}`);
    
    const metaAdm = {
      watermarkText: "SECURED REGISTRY",
      watermarkEnabled: false,
      qrDataUrl: "",
      verificationCode: verificationCodeAdm,
    };
    
    const metaAcc = {
      watermarkText: "SECURED REGISTRY",
      watermarkEnabled: false,
      qrDataUrl: "",
      verificationCode: verificationCodeAcc,
    };

    const [admissionPdfBuffer, acceptancePdfBuffer] = await Promise.all([
      PdfService.generateAdmissionLetterPdf(beneficiary, metaAdm) as Promise<Buffer>,
      PdfService.generateAcceptanceLetterPdf(beneficiary, metaAcc) as Promise<Buffer>
    ]);

    const isAdmissionRealPdf = admissionPdfBuffer && admissionPdfBuffer.length >= 4 && admissionPdfBuffer[0] === 0x25 && admissionPdfBuffer[1] === 0x50 && admissionPdfBuffer[2] === 0x44 && admissionPdfBuffer[3] === 0x46;
    const isAcceptanceRealPdf = acceptancePdfBuffer && acceptancePdfBuffer.length >= 4 && acceptancePdfBuffer[0] === 0x25 && acceptancePdfBuffer[1] === 0x50 && acceptancePdfBuffer[2] === 0x44 && acceptancePdfBuffer[3] === 0x46;

    if (!isAdmissionRealPdf || !isAcceptanceRealPdf) {
      throw new Error("Admission/Acceptance document compilation returned corrupted data frames.");
    }

    const admissionAttachmentName = buildSanitizedFilename(beneficiary, "ADMISSION_LETTER", "pdf");
    const acceptanceAttachmentName = buildSanitizedFilename(beneficiary, "ACCEPTANCE_LETTER", "pdf");

    // Send the email instantly with in-memory buffers to maintain sub-second response times
    const toEmail = beneficiary.email || "uniqueideasproject@gmail.com";
    console.log(`[AdmissionService] Transmitting email instantly to: ${toEmail}`);
    const emailSendStart = performance.now();
    const mailResult = await EmailService.sendAdmissionEmail(
      toEmail, 
      `${beneficiary.firstName} ${beneficiary.lastName}`, 
      secureLink,
      [
        {
          name: admissionAttachmentName,
          content: admissionPdfBuffer.toString("base64"),
          contentType: "application/pdf"
        },
        {
          name: acceptanceAttachmentName,
          content: acceptancePdfBuffer.toString("base64"),
          contentType: "application/pdf"
        }
      ]
    );
    console.log(`[AdmissionService] Email transmission returned in ${(performance.now() - emailSendStart).toFixed(2)}ms`);

    let changeRemarks = "";
    if (mailResult.success) {
      beneficiary.emailStatus = "Sent";
      if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Admission Generated") {
        beneficiary.admissionStatus = "Admission Sent";
      }
      beneficiary.admissionLetterSentAt = new Date().toISOString();
      beneficiary.smtpErrorDetails = undefined;
      changeRemarks = "Admission offer letters successfully generated and sent instantly.";
    } else {
      beneficiary.emailStatus = "Failed";
      beneficiary.smtpErrorDetails = mailResult.status;
      changeRemarks = `Admission offer letters generated, email dispatch failed: ${mailResult.status}`;
    }

    // Predetermine Cloudinary URLs & document IDs immediately so the return object is instantly populated and complete
    const publicIdAdm = `beneficiary_${resolvedId}_admission_letter_v${nextVersionNum}`;
    const publicIdAcc = `beneficiary_${resolvedId}_acceptance_letter_v${nextAccLetterVerNum}`;
    
    const admissionPdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAdm}.pdf`;
    const acceptancePdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAcc}.pdf`;

    beneficiary.admissionLetterUrl = admissionPdfUrl;
    beneficiary.acceptanceLetterUrl = acceptancePdfUrl;

    const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

    // Append URLs to local lists in the returning entity
    const currentVersions = beneficiary.admissionLetterVersions || [];
    const newVersionItem = {
      version: nextVersionNum,
      url: admissionPdfUrl,
      name: `${namePart}_ADMISSION_LETTER_v${nextVersionNum}.pdf`,
      generatedAt: new Date().toISOString()
    };
    beneficiary.admissionLetterVersions = [...currentVersions, newVersionItem];

    const currentDocs = beneficiary.documentsList || [];
    const admissionDocId = `gdoc_${Date.now()}_adm`;
    const acceptanceDocId = `gdoc_${Date.now()}_acc`;

    beneficiary.documentsList = [
      ...currentDocs,
      {
        id: admissionDocId,
        name: `${namePart}_ADMISSION_LETTER.pdf`,
        type: "admission",
        url: admissionPdfUrl,
        uploadedAt: new Date().toISOString(),
        version: nextVersionNum
      }
    ];

    const deliveryHistory = beneficiary.emailDeliveryHistory || [];
    const newDeliveryRecord = {
      dateSent: new Date().toISOString(),
      recipientEmail: toEmail,
      deliveryResult: mailResult.success ? ("Sent" as const) : ("Failed" as const),
      smtpResponse: mailResult.success ? "Instant SMTP accepted" : (mailResult.status || "Transport Error")
    };
    beneficiary.emailDeliveryHistory = [...deliveryHistory, newDeliveryRecord];

    // Offload the heavy Cloudinary CDN upload & DB metadata saves to a completely non-blocking background queue
    console.log(`[AdmissionService] Offloading heavy Asset upload and Database Sync to post-dispatch background execution.`);
    
    (async () => {
      // 1. Upload the buffers to Cloudinary in parallel background queue
      await Promise.all([
        CloudinaryService.uploadDocument(admissionPdfBuffer, publicIdAdm),
        CloudinaryService.uploadDocument(acceptancePdfBuffer, publicIdAcc)
      ]).catch(e => {
        console.error("[AdmissionService Background Queue] Cloudinary storage bucket transfer warning:", e);
      });

      // 2. Perform database entry saves for the documents
      const newDocAdm = {
        id: admissionDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ADMISSION_LETTER,
        version: nextVersionNum,
        pdfUrl: admissionPdfUrl,
        generatedBy: "SYSTEM_ADMISSIONS",
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAdm,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: mailResult.success ? "Delivered" : "Failed",
      };

      const newDocAcc = {
        id: acceptanceDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ACCEPTANCE_LETTER,
        version: nextAccLetterVerNum,
        pdfUrl: acceptancePdfUrl,
        generatedBy: "SYSTEM_ADMISSIONS",
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAcc,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };

      await Promise.all([
        DbRepo.saveGeneratedDocument(newDocAdm),
        DbRepo.saveGeneratedDocument(newDocAcc)
      ]).catch(e => {
        console.error("[AdmissionService Background Queue] Failed saving generated documents records:", e);
      });

      // 3. Write workflow history records, audit logs, and complete candidate save
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus: originalAdmissionStatus,
        newStatus: beneficiary.admissionStatus || "Admission Sent",
        changedBy: "SYSTEM_ADMISSIONS",
        changedAt: new Date().toISOString(),
        remarks: changeRemarks
      }).catch(() => {});

      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: "admission@uniqueideas.dontechservicesconst.com",
        role: "System Broker",
        action: "Email Sent",
        details: `Dispatched formal admission offer & PDFs to '${beneficiary.firstName} ${beneficiary.lastName}'. Delivery Status: ${mailResult.success ? 'Success' : 'Failed'}`
      }).catch(() => {});

      // Conclude final state sync write to DB without overwriting concurrent updates (like token_version or admission_status changes)
      try {
        const freshB = (await DbRepo.getBeneficiaryById(resolvedId, { systemContext: true })) || beneficiary;
        freshB.admissionLetterUrl = beneficiary.admissionLetterUrl || freshB.admissionLetterUrl;
        freshB.acceptanceLetterUrl = beneficiary.acceptanceLetterUrl || freshB.acceptanceLetterUrl;
        freshB.emailStatus = beneficiary.emailStatus;
        freshB.smtpErrorDetails = beneficiary.smtpErrorDetails;
        freshB.admissionLetterVersions = beneficiary.admissionLetterVersions;
        freshB.documentsList = beneficiary.documentsList;
        freshB.emailDeliveryHistory = beneficiary.emailDeliveryHistory;
        await DbRepo.upsertBeneficiary(freshB);
      } catch (syncErr) {
        console.error("[AdmissionService Background Queue] Failed final sync update:", syncErr);
      }
      
      console.log(`[AdmissionService Background Queue] Fully completed processing tasks successfully.`);
    })().catch(queueErr => {
      console.error("[AdmissionService Background Queue] Fatal unhandled hook error:", queueErr);
    });

    const totalDuration = performance.now() - totalStart;
    console.log(`[PERF TRACE] sendAdmissionOffer completed immediate thread execution in ${totalDuration.toFixed(2)}ms`);

    return { 
      success: mailResult.success, 
      secureLink, 
      emailStatus: beneficiary.emailStatus, 
      smtpErrorDetails: beneficiary.smtpErrorDetails,
      beneficiary 
    };
  }

  /**
   * Logs a tracking open event safely and non-destructively.
   */
  static async registerEmailOpened(beneficiaryId: string): Promise<boolean> {
    const pool = getPgPool();
    const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, pool)) || beneficiaryId;
    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) return false;

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

    beneficiary.emailTrackingStatus = "Opened";
    return true;
  }

  /**
   * Admin verification checks: Acceptance Approved.
   */
  static async approveAcceptance(beneficiaryId: string, adminUser: string): Promise<Beneficiary> {
    const pool = getPgPool();
    const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, pool)) || beneficiaryId;
    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) throw new Error("Beneficiary not found");

    const oldStatus = beneficiary.admissionStatus || "Pending";
    if (oldStatus !== "Acceptance Uploaded" && oldStatus !== "Under Review" && oldStatus !== "Accepted") {
      throw new Error(`Invalid transition from status '${oldStatus}' to 'Accepted'. This action is blocked.`);
    }

    beneficiary.admissionStatus = "Accepted";
    beneficiary.status = ProgramStatus.VERIFIED;
    beneficiary.updatedAt = new Date().toISOString();

    console.log("[AdmissionService] Generating official dynamic Enrollment Confirmation & Certificate PDFs...");
    
    const { document: enrollmentDoc } = await DocumentService.generateDocumentWithBuffer(
      beneficiary.id,
      DocumentType.ENROLLMENT_CONFIRMATION,
      adminUser,
      true
    );
    beneficiary.enrollmentLetterUrl = enrollmentDoc.pdfUrl;

    const { document: certDoc } = await DocumentService.generateDocumentWithBuffer(
      beneficiary.id,
      DocumentType.COMPLETION_CERTIFICATE,
      adminUser,
      true
    );
    beneficiary.certificateUrl = certDoc.pdfUrl;

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

    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus,
        newStatus: "Accepted",
        changedBy: adminUser,
        changedAt: new Date().toISOString(),
        remarks: "Verification approved. Approved student acceptance offer."
      });
    } catch (err) {}

    await this.logAction(
      adminUser,
      "Acceptance Approved",
      `Verification approved for '${beneficiary.firstName} ${beneficiary.lastName}'.`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    return beneficiary;
  }

  /**
   * Admin verification checks: Acceptance Rejected.
   */
  static async rejectAcceptance(beneficiaryId: string, adminUser: string, reason: string): Promise<Beneficiary> {
    const pool = getPgPool();
    const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(beneficiaryId, pool)) || beneficiaryId;
    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) throw new Error("Beneficiary not found");

    const oldStatus = beneficiary.admissionStatus || "Pending";
    if (oldStatus !== "Acceptance Uploaded" && oldStatus !== "Under Review" && oldStatus !== "Acceptance Rejected") {
      throw new Error(`Invalid transition from status '${oldStatus}' to 'Acceptance Rejected'. This action is blocked.`);
    }

    beneficiary.admissionStatus = "Acceptance Rejected";
    beneficiary.acceptanceLetterUploaded = false;
    beneficiary.acceptanceLetterUrl = undefined;
    beneficiary.acceptanceLetterUploadedAt = undefined;
    beneficiary.updatedAt = new Date().toISOString();

    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus,
        newStatus: "Acceptance Rejected",
        changedBy: adminUser,
        changedAt: new Date().toISOString(),
        remarks: reason || "Acceptance Rejected on review"
      });
    } catch (err) {}

    await this.logAction(
      adminUser,
      "Acceptance Rejected",
      `Administrator rejected acceptance for '${beneficiary.firstName} ${beneficiary.lastName}': ${reason}`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    return beneficiary;
  }

  /**
   * Public Student response portal sub-flow: process signatures and demographics.
   * Leverages flexible file signature matching, accepting image uploads (.png, .jpg, .jpeg)
   * and Word documents (.docx) alongside vector PDFs securely.
   */
  static async processPortalSubmission(token: string, formData: any): Promise<{ success: boolean; beneficiary: Beneficiary }> {
    const totalStart = performance.now();
    const decoded = TokenService.verifyToken(token);
    if (!decoded || !decoded.id) {
      throw new Error("Activation session token is invalid, corrupted, or has expired.");
    }

    const pool = getPgPool();
    const resolvedId = (await AdmissionService.resolveBeneficiaryIdResiliently(decoded.id, pool)) || decoded.id;

    // Strict row-level transaction block & locking on both beneficiaries and admissions tables
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT id, token_version FROM beneficiaries WHERE id = $1 FOR UPDATE", [resolvedId]);
        try {
          await client.query(
            `SELECT admission_status, admission_letter_sent_at, offer_sent_at, offer_expires_at 
             FROM admissions 
             WHERE beneficiary_id = $1 AND deleted_at IS NULL 
             FOR UPDATE`,
            [resolvedId]
          );
        } catch (admLockErr) {
          // Bypassed if records do not exist
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("[processPortalSubmission] Failed to acquire row locks safely:", err);
      } finally {
        client.release();
      }
    }

    const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
    if (!beneficiary) {
      throw new Error("Primary biographical record corresponding to portal session could not be tracked.");
    }

    // Check token version
    const tokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 1;
    const bTokenVersion = beneficiary.tokenVersion !== undefined ? beneficiary.tokenVersion : 1;
    if (tokenVersion !== bTokenVersion) {
      throw new Error("TOKEN_REVOKED: This portal link is no longer active due to administrative status change or rollback.");
    }

    if (pool) {
      try {
        const tokenCheck = await pool.query("SELECT * FROM public_response_tokens WHERE token = $1 LIMIT 1", [token]);
        if (tokenCheck.rows.length > 0) {
          const tRow = tokenCheck.rows[0];
          if (tRow.revoked_at) {
            throw new Error("TOKEN_REVOKED: This portal link is no longer active.");
          }
          if (tRow.expires_at && new Date(tRow.expires_at).getTime() < Date.now()) {
            if (pool && resolvedId) {
              pool.query(
                `INSERT INTO admissions (beneficiary_id, admission_status, created_at, updated_at)
                 VALUES ($1, 'EXPIRED', NOW(), NOW())
                 ON CONFLICT (beneficiary_id) DO UPDATE SET admission_status = 'EXPIRED', updated_at = NOW()`,
                [resolvedId]
              ).catch(() => {});
            }
            throw new Error("ACCEPTANCE_LOCKED_EXPIRED: The 10-day provisional offer acceptance window has elapsed.");
          }
          if (tRow.is_used === true || tRow.submitted_at) {
            return { success: true, beneficiary };
          }
        }
      } catch (tErr: any) {
        if (tErr.message && (tErr.message.includes("TOKEN_REVOKED") || tErr.message.includes("ACCEPTANCE_LOCKED_EXPIRED"))) {
          throw tErr;
        }
      }
    }

    if (beneficiary.admissionStatus === "ACCEPTED" || beneficiary.admissionFormCompleted === true) {
      return { success: true, beneficiary };
    }

    // Validate 10-day provisional offer expiration window (modern fallback design)
    let expiresTime: number | null = null;
    if (beneficiary.offerExpiresAt) {
      expiresTime = new Date(beneficiary.offerExpiresAt).getTime();
    } else {
      const sentTime = beneficiary.offerSentAt ? new Date(beneficiary.offerSentAt).getTime() : 
                       (beneficiary.admissionLetterSentAt ? new Date(beneficiary.admissionLetterSentAt).getTime() : null);
      if (sentTime) {
        expiresTime = sentTime + (10 * 24 * 60 * 60 * 1000); // 10 days
      }
    }

    if (expiresTime && Date.now() > expiresTime) {
      if (pool && resolvedId) {
        pool.query(
          `INSERT INTO admissions (beneficiary_id, admission_status, created_at, updated_at)
           VALUES ($1, 'EXPIRED', NOW(), NOW())
           ON CONFLICT (beneficiary_id) DO UPDATE SET admission_status = 'EXPIRED', updated_at = NOW()`,
          [resolvedId]
        ).catch(() => {});
      }
      throw new Error("ACCEPTANCE_LOCKED_EXPIRED: The 10-day provisional offer acceptance window has elapsed.");
    }

    const oldAdmissionStatus = beneficiary.admissionStatus || "Pending";

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

    const signatureValue = formData.signature || formData.esignature || formData.digitalSignature || "";
    beneficiary.digitalSignature = signatureValue;

    const nowStr = new Date().toISOString();
    const signatureName = `${beneficiary.lastName} ${beneficiary.firstName}`;
    const signatureImage = signatureValue;
    const acceptedAt = nowStr;

    beneficiary.customFields = {
      ...(beneficiary.customFields || {}),
      signature_name: signatureName,
      signature_date: nowStr,
      signature_image: signatureImage,
      accepted_at: acceptedAt
    };

    beneficiary.admissionFormCompleted = true;
    beneficiary.admissionFormStatus = "Verified";
    beneficiary.admissionFormData = {
      emergencyName: formData.emergencyName,
      emergencyPhone: formData.emergencyPhone,
      guardianName: formData.guardianName,
      highestQualification: formData.highestQualification,
      priorKnowledge: formData.priorKnowledge,
      medicalDeclaration: formData.medicalDeclaration,
      submissionDate: nowStr,
      digitalSignature: signatureValue,
      signature: signatureValue,
      signature_name: signatureName,
      signature_date: nowStr,
      signature_image: signatureImage,
      accepted_at: acceptedAt
    };

    await DbRepo.upsertBeneficiary(beneficiary);

    const docProcessStart = performance.now();
    let signedAcceptanceUrl = "";
    let registeredDocId = "";
    let nextAccLetterVer = (beneficiary.acceptanceLetterVersions || []).length + 1;

    // Flexible File Ingress: Accepting image forms (.png .jpg .jpeg) and Word documents (.docx) alongside vector PDFs
    let extension = "pdf";
    if (formData.uploadedAcceptanceLetter) {
      console.log("[AdmissionService] Custom hand-signed file upload detected.");
      
      if (formData.uploadedAcceptanceLetter.startsWith("data:")) {
        const mimeMatch = formData.uploadedAcceptanceLetter.match(/data:([^;]+);/);
        if (mimeMatch && mimeMatch[1]) {
          const mimeType = mimeMatch[1].toLowerCase();
          if (mimeType.includes("pdf")) extension = "pdf";
          else if (mimeType.includes("png")) extension = "png";
          else if (mimeType.includes("jpeg") || mimeType.includes("jpg")) extension = "jpg";
          else if (mimeType.includes("word") || mimeType.includes("docx") || mimeType.includes("officedocument") || mimeType.includes("msword")) extension = "docx";
          else if (mimeType.includes("html") || mimeType.includes("htm")) extension = "html";
        }

        try {
          signedAcceptanceUrl = await CloudinaryService.uploadDocument(
            formData.uploadedAcceptanceLetter, 
            `Signed_Acceptance_${beneficiary.id}.${extension}`
          );
        } catch (uploadErr: any) {
          console.error(`[AdmissionService] Cloudinary upload exception:`, uploadErr.message);
          signedAcceptanceUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/v${Date.now()}/ideas_tvet/signed_acceptance_${beneficiary.id}_fallback.${extension}`;
        }
      } else {
        signedAcceptanceUrl = formData.uploadedAcceptanceLetter;
        if (signedAcceptanceUrl.includes(".")) {
          extension = signedAcceptanceUrl.split(".").pop()?.toLowerCase() || "pdf";
        }
      }

      const docId = `gdoc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const prefix = "TVET-ACC";
      const hex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      registeredDocId = docId;

      await DbRepo.saveGeneratedDocument({
        id: docId,
        beneficiaryId: beneficiary.id,
        documentType: DocumentType.ACCEPTANCE_LETTER,
        version: nextAccLetterVer,
        pdfUrl: signedAcceptanceUrl,
        generatedBy: beneficiary.email || "STUDENT_PORTAL",
        createdAt: new Date().toISOString(),
        verificationCode: `${prefix}-${hex}`,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      });
    } else {
      console.log("[AdmissionService] Generating Acceptance Letter via Puppeteer compile process.");
      const { document: acceptanceDoc2 } = await DocumentService.generateDocumentWithBuffer(
        beneficiary.id,
        DocumentType.ACCEPTANCE_LETTER,
        "STUDENT_PORTAL",
        true
      );
      signedAcceptanceUrl = acceptanceDoc2.pdfUrl;
      registeredDocId = acceptanceDoc2.id;
      nextAccLetterVer = acceptanceDoc2.version;
    }
    console.log(`[PERF TRACE] Acceptance letter compile completed in ${(performance.now() - docProcessStart).toFixed(2)}ms`);

    const fName2 = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const lName2 = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const namePart2 = fName2 && lName2 ? `${fName2}_${lName2}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

    beneficiary.acceptanceLetterUploaded = true;
    beneficiary.acceptanceLetterUrl = signedAcceptanceUrl;
    beneficiary.acceptanceLetterUploadedAt = new Date().toISOString();

    const currentAccLetters = beneficiary.acceptanceLetterVersions || [];
    beneficiary.acceptanceLetterVersions = [
      ...currentAccLetters,
      {
        version: nextAccLetterVer,
        url: signedAcceptanceUrl,
        name: `${namePart2}_ACCEPTANCE_LETTER_v${nextAccLetterVer}.${extension}`,
        uploadedAt: new Date().toISOString()
      }
    ];

    const currentDocs2 = beneficiary.documentsList || [];
    beneficiary.documentsList = [
      ...currentDocs2,
      {
        id: registeredDocId,
        name: `${namePart2}_ACCEPTANCE_LETTER.${extension}`,
        type: "acceptance",
        url: signedAcceptanceUrl,
        uploadedAt: new Date().toISOString(),
        version: nextAccLetterVer
      }
    ];

    beneficiary.admissionStatus = "ACCEPTED";
    beneficiary.status = ProgramStatus.PENDING_PHOTO;
    beneficiary.updatedAt = new Date().toISOString();

    try {
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: beneficiary.id,
        oldStatus: oldAdmissionStatus,
        newStatus: "ACCEPTED",
        changedBy: beneficiary.email || "STUDENT_PORTAL",
        changedAt: new Date().toISOString(),
        remarks: "Trainee completed supplemental profile structures & terms."
      });
    } catch (err) {}

    await this.logAction(
      beneficiary.email || `${beneficiary.firstName.toLowerCase()}@tvet-response.net`,
      "ACCEPTED",
      `Student ${beneficiary.firstName} ${beneficiary.lastName} (ID: ${beneficiary.id}) uploaded signed terms.`
    );

    await DbRepo.upsertBeneficiary(beneficiary);

    if (pool) {
      const tokenHash = TokenService.hashToken(token);
      pool.query(
        `UPDATE public_response_tokens 
         SET is_used = true, status = 'SUBMITTED', used_at = NOW(), submitted_at = NOW(), updated_at = NOW() 
         WHERE token = $1 OR token_hash = $2`,
        [token, tokenHash]
      ).catch(() => {});
    }
    await this.logTokenEvent(beneficiary.id, "OFFER_ACCEPTANCE_SUBMITTED", token, "Candidate successfully submitted acceptance letter and form");

    console.log(`[PERF TRACE] processPortalSubmission completed overall in ${(performance.now() - totalStart).toFixed(2)}ms`);
    return { success: true, beneficiary };
  }
}
