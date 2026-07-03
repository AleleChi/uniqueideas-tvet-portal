/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from "express";
import { AdmissionService } from "./admission.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { DbRepo, getPgPool } from "./db";
import { DocumentService } from "./document.service";
import { PdfService } from "./pdf.service";
import { DocumentType, Beneficiary } from "../types";
import { buildSanitizedFilename } from "./pdfTraceAudit";
import JSZip from "jszip";
import { buildPublicUrl } from "../config/api";
import { AuthenticatedRequest } from "./auth.middleware";
import { OfferService } from "./offer.service";
import { CloudinaryService } from "./cloudinary.service";


export class AdmissionController {
  /**
   * Controller for check SMTP health
   * GET /api/admissions/email-health
   */
  static async getEmailHealth(req: Request, res: Response) {
    try {
      const outcome = await EmailService.getSmtpHealth();
      return res.status(200).json(outcome);
    } catch (err: any) {
      console.error("[AdmissionController] getEmailHealth failed:", err);
      return res.status(500).json({ status: "SMTP Failed", error: err.message || String(err) });
    }
  }

  /**
   * Controller for Admin/TSP/STA endpoint to dispatch letters and send email notification
   * POST /api/admissions/send-offer
   */
  static async sendOffer(req: Request, res: Response) {
    try {
      const { beneficiaryId, origin } = req.body;
      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      // Check user authorization & scope isolation
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      if (!user) {
        return res.status(401).json({ error: "Access denied. Authentication required to view or dispatch offers." });
      }

      // Query candidate database record first
      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(beneficiaryId);
      const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
      if (!beneficiary) {
        return res.status(404).json({ error: `Beneficiary candidate '${beneficiaryId}' not found in registry.` });
      }

      // Enforce multi-tier role scope check
      const isFederal = user.role === "SUPER_ADMIN" || 
                        user.role === "FED" || 
                        user.role.startsWith("FED") || 
                        user.role.startsWith("FEDERAL");

      if (!isFederal) {
        const isStaUser = user.role === "STA" || user.role.startsWith("STA") || user.role.includes("STATE");
        const isTspUser = user.role === "TSP" || user.role.startsWith("TSP") || user.role === "REVIEW_OFFICER" || user.role === "ADMIN_OFFICER";

        if (isTspUser) {
          const userTspId = user.tspId || "00000000-0000-0000-0000-000000000001";
          const bTspId = beneficiary.tspId || "00000000-0000-0000-0000-000000000001";
          if (bTspId !== userTspId) {
            console.warn(`[AdmissionController] Scoping Denied: TSP User ${user.email} (TSP: ${userTspId}) tried to send offer to beneficiary in TSP: ${bTspId}`);
            return res.status(403).json({ error: "Access Denied: Tenant isolation active. This beneficiary belongs to another organization." });
          }
        } else if (isStaUser) {
          const userStateId = user.stateId || "state_imo_id_default";
          const bStateId = beneficiary.stateId || "state_imo_id_default";
          if (bStateId !== userStateId) {
            console.warn(`[AdmissionController] Scoping Denied: STA User ${user.email} (State: ${userStateId}) tried to send offer to beneficiary in State: ${bStateId}`);
            return res.status(403).json({ error: "Access Denied: State division isolation active. This beneficiary belongs to another State scope." });
          }
        } else {
          console.warn(`[AdmissionController] Role Denied: User ${user.email} with role ${user.role} is not authorized to dispatch offers.`);
          return res.status(403).json({ error: "Access Denied: You do not hold clearance to view or dispatch provisional offer notifications." });
        }
      }

      // Automatically construct origin domain if not provided, sanitizing out any preview environments
      const isPreviewOrLocal = (url: any): boolean => {
        if (!url || typeof url !== "string") return true;
        const l = url.toLowerCase();
        return (
          l.includes("aistudio") ||
          l.includes("google") ||
          l.includes("run.app") ||
          l.includes("localhost") ||
          l.includes("127.0.0.1") ||
          l.includes("sandbox") ||
          l.includes("ais-dev") ||
          l.includes("ais-pre") ||
          l.includes("my_app_url")
        );
      };

      const safeOrigin = (origin && typeof origin === "string" && !isPreviewOrLocal(origin)) ? origin : undefined;
      const customDomain = safeOrigin || buildPublicUrl("", req);

      // Invoke the single-source-of-truth service for offer dispatch
      const outcome = await OfferService.sendOffer(beneficiaryId, customDomain);
      if (outcome.error === "PDF_RENDER_UNAVAILABLE") {
        return res.status(200).json({
          success: false,
          error: "PDF_RENDER_UNAVAILABLE",
          message: outcome.message || "Offer link is ready, but official letters could not be generated. Please retry PDF generation after renderer is restored.",
          secureLink: outcome.secureLink,
          beneficiary: outcome.beneficiary
        });
      }

      return res.status(200).json({ 
        success: outcome.success, 
        message: outcome.success 
          ? "Provisional offer generated, letter compiled, and notification email successfully queued."
          : `SMTP delivery failed: ${outcome.smtpErrorDetails || "Unknown SMTP error."}`,
        secureLink: outcome.secureLink,
        emailStatus: outcome.emailStatus,
        smtpErrorDetails: outcome.smtpErrorDetails,
        beneficiary: outcome.beneficiary
      });
    } catch (err: any) {
      console.error("[AdmissionController] sendOffer failed:", err);
      return res.status(500).json({ error: err.message || "Internal server error compiling admission dispatch." });
    }
  }

  /**
   * Translates incoming string references resiliently. If a custom tracking text like "IDEAS-2026-003"
   * is provided, it automatically scans database profiles to return the accurate system UUID.
   */
  static async resolveBeneficiaryIdResiliently(idOrToken: any): Promise<string> {
    if (!idOrToken) return idOrToken;
    const cleanToken = String(idOrToken).trim();
    // Check if it's already a valid UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken)) {
      return cleanToken;
    }

    // Otherwise, delegate to DbRepo's resilient resolver
    try {
      const resolved = await DbRepo.resolveBeneficiaryIdResiliently(cleanToken);
      if (resolved) return resolved;
    } catch (err) {
      console.error("[AdmissionController.resolveBeneficiaryIdResiliently] DB lookup error:", err);
    }
    return cleanToken;
  }

  /**
   * Controller to check token validity and retrieve clean, non-sensitive biographical parameters of candidate
   * GET /api/admissions/validate-token
   * Refactored as authoritative read-only check against public_response_tokens.
   */
  static async validateToken(req: Request, res: Response) {
    let currentPhase = "TOKEN_RECEIVED";
    let decodedId: string | null = null;
    let resolvedId: string | null = null;
    let decodedTokenVersion: number | null = null;

    try {
      // ----------------------------------------------------
      // PHASE 1: TOKEN_RECEIVED
      // ----------------------------------------------------
      currentPhase = "TOKEN_RECEIVED";
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({
          error: "TOKEN_INVALID",
          phase: currentPhase,
          message: "No secure response token provided in verification query."
        });
      }

      const tokenHash = TokenService.hashToken(token);
      const pool = getPgPool();

      // ----------------------------------------------------
      // PHASE 2: TOKEN_DECODE
      // ----------------------------------------------------
      currentPhase = "TOKEN_DECODE";
      let decoded: any = null;
      try {
        decoded = TokenService.decodeToken(token);
      } catch (decodeErr: any) {
        console.error("TOKEN_DEBUG: [TOKEN_DECODE] decoding crashed:", decodeErr);
      }

      if (decoded) {
        decodedId = decoded.id;
        decodedTokenVersion = decoded.tokenVersion || 1;
      }

      // If token decoding completely failed, we check if we can find this token in public_response_tokens
      let tokenRow: any = null;
      if (pool) {
        try {
          const tRes = await pool.query(
            "SELECT * FROM public_response_tokens WHERE (token_hash = $1 OR token = $2) AND deleted_at IS NULL LIMIT 1",
            [tokenHash, token]
          );
          if (tRes.rows.length > 0) {
            tokenRow = tRes.rows[0];
          }
        } catch (dbErr) {
          console.error("TOKEN_DEBUG: [PUBLIC_RESPONSE_TOKEN_LOOKUP] pre-check query failed:", dbErr);
        }
      }

      if (!decoded && !tokenRow) {
        console.error("TOKEN_DEBUG: TOKEN_DECODE_FAILED (no valid payload and no database record found)");
        return res.status(401).json({
          error: "TOKEN_INVALID",
          phase: currentPhase,
          message: "We could not verify this link. Please contact your training provider.",
          debug: {
            phase: currentPhase,
            decodedId: null,
            resolvedBeneficiaryId: null,
            tokenVersion: null,
            errorMessage: "Token decoding failed and no corresponding DB entry found."
          }
        });
      }

      // ----------------------------------------------------
      // PHASE 3: BENEFICIARY_ID_RESOLUTION
      // ----------------------------------------------------
      currentPhase = "BENEFICIARY_ID_RESOLUTION";
      if (decodedId) {
        resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(decodedId);
      } else if (tokenRow) {
        resolvedId = tokenRow.beneficiary_id;
      }

      if (!resolvedId) {
        console.error("TOKEN_DEBUG: BENEFICIARY_ID_RESOLUTION failed");
        return res.status(401).json({
          error: "TOKEN_INVALID",
          phase: currentPhase,
          message: "We could not verify this link. Please contact your training provider.",
          debug: {
            phase: currentPhase,
            decodedId,
            resolvedBeneficiaryId: null,
            tokenVersion: decodedTokenVersion,
            errorMessage: "Could not resolve candidate ID from token payload."
          }
        });
      }

      // ----------------------------------------------------
      // PHASE 4: BENEFICIARY_LOAD
      // ----------------------------------------------------
      currentPhase = "BENEFICIARY_LOAD";
      const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
      if (!beneficiary) {
        console.error("TOKEN_DEBUG: BENEFICIARY_NOT_FOUND");
        return res.status(404).json({
          error: "BENEFICIARY_NOT_FOUND",
          phase: currentPhase,
          message: "The candidate profile could not be found. Please contact admissions support.",
          debug: {
            phase: currentPhase,
            decodedId,
            resolvedBeneficiaryId: resolvedId,
            tokenVersion: decodedTokenVersion,
            errorMessage: `Beneficiary ID ${resolvedId} not found in database.`
          }
        });
      }

      // ----------------------------------------------------
      // PHASE 5: PUBLIC_RESPONSE_TOKEN_LOOKUP
      // ----------------------------------------------------
      currentPhase = "PUBLIC_RESPONSE_TOKEN_LOOKUP";
      if (!tokenRow && pool) {
        try {
          const tRes = await pool.query(
            "SELECT * FROM public_response_tokens WHERE (token_hash = $1 OR token = $2) AND deleted_at IS NULL LIMIT 1",
            [tokenHash, token]
          );
          if (tRes.rows.length > 0) {
            tokenRow = tRes.rows[0];
          }
        } catch (dbErr: any) {
          console.error("TOKEN_DEBUG: [PUBLIC_RESPONSE_TOKEN_LOOKUP] Query failed:", dbErr);
        }
      }

      // ----------------------------------------------------
      // PHASE 6: TOKEN_STATUS_CHECK
      // ----------------------------------------------------
      currentPhase = "TOKEN_STATUS_CHECK";
      let statusFromDB = "ACTIVE";

      if (tokenRow) {
        statusFromDB = tokenRow.status || "ACTIVE";

        if (tokenRow.revoked_at || statusFromDB === "REVOKED") {
          console.error("TOKEN_DEBUG: TOKEN_REVOKED");
          await AdmissionService.logTokenEvent(resolvedId, "OFFER_TOKEN_REVOKED", token, "Token marked as revoked");
          return res.status(401).json({
            error: "TOKEN_REVOKED",
            phase: currentPhase,
            message: "This portal link is no longer active due to administrative status change or rollback.",
            debug: {
              phase: currentPhase,
              decodedId,
              resolvedBeneficiaryId: resolvedId,
              tokenVersion: decodedTokenVersion,
              errorMessage: "Token is marked as REVOKED."
            }
          });
        }

        if (statusFromDB === "EXPIRED") {
          console.error("TOKEN_DEBUG: TOKEN_EXPIRED");
          await AdmissionService.logTokenEvent(resolvedId, "OFFER_TOKEN_EXPIRED", token, "Offer explicitly marked as expired");
          return res.status(403).json({
            error: "TOKEN_EXPIRED",
            phase: currentPhase,
            message: "This offer link has expired. Please contact your training provider for a new link.",
            debug: {
              phase: currentPhase,
              decodedId,
              resolvedBeneficiaryId: resolvedId,
              tokenVersion: decodedTokenVersion,
              errorMessage: "Token is marked as EXPIRED."
            }
          });
        }
      } else {
        // Compatibility creation of ACTIVE row if not found but token decodes and resolves
        if (pool) {
          try {
            const expiresAt = beneficiary.offerExpiresAt ? new Date(beneficiary.offerExpiresAt) : new Date(Date.now() + 10 * 24 * 3600 * 1000);
            const tokenVerToInsert = decodedTokenVersion || 1;
            await pool.query(
              `INSERT INTO public_response_tokens (
                 beneficiary_id, token, token_hash, status, expires_at, is_used, purpose, token_version, created_at, updated_at
               ) VALUES ($1, $2, $3, \'ACTIVE\', $4, false, \'OFFER_ACCEPTANCE\', $5, NOW(), NOW())
               ON CONFLICT (token) DO NOTHING`,
              [beneficiary.id, token, tokenHash, expiresAt, tokenVerToInsert]
            );
            const tRes = await pool.query(
              "SELECT * FROM public_response_tokens WHERE (token_hash = $1 OR token = $2) AND deleted_at IS NULL LIMIT 1",
              [tokenHash, token]
            );
            if (tRes.rows.length > 0) {
              tokenRow = tRes.rows[0];
              statusFromDB = tokenRow.status || "ACTIVE";
            }
          } catch (compatErr: any) {
            console.error("TOKEN_DEBUG: [TOKEN_STATUS_CHECK] compatibility row insertion failed:", compatErr);
          }
        }
      }

      // Check legacy token version if tokenRow is STILL not found (e.g. SQLite or pool missing)
      const bTokenVersion = beneficiary.tokenVersion !== undefined && beneficiary.tokenVersion !== null ? beneficiary.tokenVersion : 1;
      const isLegacy = !tokenRow;
      if (isLegacy && bTokenVersion > (decodedTokenVersion || 1)) {
        console.error("TOKEN_DEBUG: TOKEN_VERSION_MISMATCH");
        await AdmissionService.logTokenEvent(beneficiary.id, "OFFER_TOKEN_REVOKED", token, `Candidate tokenVersion (${bTokenVersion}) > Token version (${decodedTokenVersion})`);
        return res.status(401).json({
          error: "TOKEN_REVOKED",
          phase: currentPhase,
          message: "We could not verify this link. Please contact your training provider.",
          debug: {
            phase: currentPhase,
            decodedId,
            resolvedBeneficiaryId: resolvedId,
            tokenVersion: decodedTokenVersion,
            errorMessage: `Candidate tokenVersion (${bTokenVersion}) is greater than Token version (${decodedTokenVersion}).`
          }
        });
      }

      // ----------------------------------------------------
      // PHASE 7: ADMISSION_ROW_LOOKUP
      // ----------------------------------------------------
      currentPhase = "ADMISSION_ROW_LOOKUP";
      if (!beneficiary.admissionRef) {
        console.warn(`TOKEN_DEBUG: [ADMISSION_ROW_LOOKUP] admissionRef not found for beneficiary ${resolvedId}`);
      }

      // ----------------------------------------------------
      // PHASE 8: FINAL_PORTAL_RESPONSE
      // ----------------------------------------------------
      currentPhase = "FINAL_PORTAL_RESPONSE";
      const alreadySubmitted = Boolean(
        (tokenRow && (tokenRow.is_used === true || statusFromDB === "SUBMITTED" || tokenRow.submitted_at)) ||
        beneficiary.admissionStatus === "ACCEPTED" ||
        beneficiary.admissionFormCompleted === true
      );

      if (alreadySubmitted) {
        console.log("TOKEN_DEBUG: TOKEN_ALREADY_SUBMITTED");
      }

      // Update opened_at timestamps asynchronously/harmlessly
      if (pool) {
        pool.query("UPDATE public_response_tokens SET opened_at = COALESCE(opened_at, NOW()) WHERE token = $1 OR token_hash = $2", [token, tokenHash]).catch(() => {});
        pool.query("UPDATE document_dispatches SET opened_at = COALESCE(opened_at, NOW()) WHERE secure_token = $1", [token]).catch(() => {});
      }

      await AdmissionService.logTokenEvent(beneficiary.id, "OFFER_LINK_OPENED", token, alreadySubmitted ? "Link opened (Already Submitted)" : "Link opened (Active Offer)");

      return res.status(200).json({
        valid: true,
        alreadySubmitted,
        candidate: {
          id: beneficiary.id,
          firstName: beneficiary.firstName,
          lastName: beneficiary.lastName,
          email: beneficiary.email,
          nin: beneficiary.nin,
          bvn: beneficiary.bvn,
          state: beneficiary.state,
          city: beneficiary.city,
          skillSector: beneficiary.skillSector || "Computer Hardware and Cell Phone Repairs",
          admissionRef: beneficiary.admissionRef,
          admissionStatus: beneficiary.admissionStatus || "Pending",
          admissionFormCompleted: beneficiary.admissionFormCompleted || false,
          admissionFormStatus: beneficiary.admissionFormStatus || "Pending",
          admissionFormData: beneficiary.admissionFormData || {},
          admissionLetterUrl: beneficiary.admissionLetterUrl || "",
          acceptanceLetterUrl: beneficiary.acceptanceLetterUrl || ""
        }
      });

    } catch (err: any) {
      console.error(`TOKEN_DEBUG: [Phase: ${currentPhase}] Global handler caught exception:`, err);
      const errMsg = err.message || String(err);
      return res.status(500).json({
        error: "SERVER_ERROR",
        phase: currentPhase,
        message: "We could not complete link verification due to a server error. Please retry or contact your training provider.",
        debug: {
          phase: currentPhase,
          decodedId: decodedId || null,
          resolvedBeneficiaryId: resolvedId || null,
          tokenVersion: decodedTokenVersion || null,
          errorMessage: errMsg
        }
      });
    }
  }

  /**
   * Controller for public Student submission endpoint to accept offer & complete supplemental form
   * POST /api/admissions/submit-response
   */
  static async submitResponse(req: Request, res: Response) {
    try {
      const { token, responseData } = req.body;
      if (!token || !responseData) {
        return res.status(400).json({ error: "Missing required response parameters: token or responseData" });
      }

      const outcome = await AdmissionService.processPortalSubmission(token, responseData);
      return res.status(200).json({
        success: true,
        message: outcome.warning || "Your e-Signature and admission enrollment profiles were successfully verified and logged.",
        candidate: outcome.beneficiary,
        warning: outcome.warning || null
      });
    } catch (err: any) {
      console.error("[AdmissionController] submitResponse failed:", err);
      return res.status(500).json({ error: err.message || "Failed validating and persisting portal response." });
    }
  }

  /**
   * Controller for administrator retry of acceptance letter PDF generation
   * POST /api/admissions/:beneficiaryId/render-acceptance-pdf
   */
  static async retryRenderAcceptancePdf(req: Request, res: Response) {
    try {
      const { beneficiaryId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const adminUser = authReq.user?.email || "SYSTEM_ADMIN";

      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing parameter: beneficiaryId" });
      }

      const outcome = await AdmissionService.retryRenderAcceptancePdf(beneficiaryId, adminUser);
      return res.status(200).json({
        success: true,
        message: "Successfully generated and registered official signed acceptance PDF.",
        beneficiary: outcome.beneficiary,
        document: outcome.document
      });
    } catch (err: any) {
      console.error("[AdmissionController] retryRenderAcceptancePdf failed:", err);
      return res.status(500).json({ error: err.message || "Failed retrying acceptance PDF generation." });
    }
  }

  /**
   * Admin endpoint to manually trigger regeneration of offer documents (admission & acceptance letters)
   * without altering the acceptance status or duplicate records.
   * POST /api/admissions/:beneficiaryId/render-offer-documents
   */
  static async renderOfferDocuments(req: Request, res: Response) {
    try {
      const { beneficiaryId } = req.params;
      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(beneficiaryId);
      const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
      if (!beneficiary) {
        return res.status(404).json({ error: "Candidate admissions record was not located in registry." });
      }

      // Check if PDF renderer is available
      const chromePath = PdfService.resolveChromePath();
      if (!chromePath) {
        return res.status(200).json({
          success: false,
          error: "PDF_RENDER_UNAVAILABLE",
          message: "PDF rendering is temporarily unavailable on the server. Please check the renderer health."
        });
      }

      // Retrieve latest sequential versions
      const latestVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ADMISSION_LETTER);
      const nextVersionNum = latestVersion + 1;

      const latestAccVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ACCEPTANCE_LETTER);
      const nextAccLetterVerNum = latestAccVersion + 1;

      // Compile unique validation codes
      const prefixAdm = "TVET-ADM";
      const hexAdm = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      const verificationCodeAdm = `${prefixAdm}-${hexAdm}`;

      const prefixAcc = "TVET-ACC";
      const hexAcc = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      const verificationCodeAcc = `${prefixAcc}-${hexAcc}`;

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

      // Generate PDF buffers
      let admissionPdfBuffer: Buffer;
      let acceptancePdfBuffer: Buffer;
      try {
        const compiled = await Promise.all([
          PdfService.generateAdmissionLetterPdf(beneficiary, metaAdm) as Promise<Buffer>,
          PdfService.generateAcceptanceLetterPdf(beneficiary, metaAcc) as Promise<Buffer>
        ]);
        admissionPdfBuffer = compiled[0];
        acceptancePdfBuffer = compiled[1];
      } catch (pdfErr: any) {
        return res.status(200).json({
          success: false,
          error: "PDF_RENDER_UNAVAILABLE",
          message: `PDF rendering failed: ${pdfErr.message || String(pdfErr)}`
        });
      }

      const publicIdAdm = `beneficiary_${resolvedId}_admission_letter_v${nextVersionNum}`;
      const publicIdAcc = `beneficiary_${resolvedId}_acceptance_letter_v${nextAccLetterVerNum}`;
      
      const admissionPdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAdm}.pdf`;
      const acceptancePdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAcc}.pdf`;

      // Upload to Cloudinary
      await Promise.all([
        CloudinaryService.uploadDocument(admissionPdfBuffer, publicIdAdm),
        CloudinaryService.uploadDocument(acceptancePdfBuffer, publicIdAcc)
      ]).catch(e => {
        console.error("[AdmissionController.renderOfferDocuments] Cloudinary Upload warning:", e);
      });

      // Save documents to DB ledger
      const admissionDocId = `gdoc_${Date.now()}_adm`;
      const acceptanceDocId = `gdoc_${Date.now()}_acc`;
      const operatorUsername = (req as any).user?.username || "ADMIN_OPERATOR";

      const newDocAdm = {
        id: admissionDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ADMISSION_LETTER,
        version: nextVersionNum,
        pdfUrl: admissionPdfUrl,
        generatedBy: operatorUsername,
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAdm,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };

      const newDocAcc = {
        id: acceptanceDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ACCEPTANCE_LETTER,
        version: nextAccLetterVerNum,
        pdfUrl: acceptancePdfUrl,
        generatedBy: operatorUsername,
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAcc,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };

      await Promise.all([
        DbRepo.saveGeneratedDocument(newDocAdm),
        DbRepo.saveGeneratedDocument(newDocAcc)
      ]);

      // Update beneficiary metadata without resetting status or deleting data
      beneficiary.admissionLetterUrl = admissionPdfUrl;
      beneficiary.acceptanceLetterUrl = acceptancePdfUrl;

      const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

      const currentVersions = beneficiary.admissionLetterVersions || [];
      beneficiary.admissionLetterVersions = [
        ...currentVersions,
        {
          version: nextVersionNum,
          url: admissionPdfUrl,
          name: `${namePart}_ADMISSION_LETTER_v${nextVersionNum}.pdf`,
          generatedAt: new Date().toISOString()
        }
      ];

      const currentDocs = beneficiary.documentsList || [];
      beneficiary.documentsList = [
        ...currentDocs,
        {
          id: admissionDocId,
          name: `${namePart}_ADMISSION_LETTER.pdf`,
          type: "admission",
          url: admissionPdfUrl,
          uploadedAt: new Date().toISOString(),
          version: nextVersionNum
        },
        {
          id: acceptanceDocId,
          name: `${namePart}_ACCEPTANCE_LETTER.pdf`,
          type: "acceptance",
          url: acceptancePdfUrl,
          uploadedAt: new Date().toISOString(),
          version: nextAccLetterVerNum
        }
      ];

      beneficiary.updatedAt = new Date().toISOString();
      await DbRepo.upsertBeneficiary(beneficiary);

      // Save history and audit
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus: beneficiary.admissionStatus || "Admission Sent",
        newStatus: beneficiary.admissionStatus || "Admission Sent",
        changedBy: operatorUsername,
        changedAt: new Date().toISOString(),
        remarks: "Manually retried document generation for offer package."
      }).catch(() => {});

      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUsername,
        role: "Operator",
        action: "Offer Documents Render Retried",
        details: `Manually regenerated and compiled official offer letter documents for candidate: ${beneficiary.firstName} ${beneficiary.lastName}.`
      }).catch(() => {});

      const updatedBeneficiary = await DbRepo.getBeneficiaryById(resolvedId);

      return res.status(200).json({
        success: true,
        admissionDocumentVersion: nextVersionNum,
        acceptanceDocumentVersion: nextAccLetterVerNum,
        admissionPdfUrl,
        acceptancePdfUrl,
        beneficiary: updatedBeneficiary
      });
    } catch (err: any) {
      console.error("[AdmissionController.renderOfferDocuments] Error:", err);
      return res.status(500).json({ error: err.message || "Failed to render offer documents." });
    }
  }

  /**
   * Controller for administrator verification: acceptance approval
   * POST /api/admissions/approve-acceptance
   */
  static async approveAcceptance(req: Request, res: Response) {
    try {
      const { beneficiaryId, adminUser } = req.body;
      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing parameter: beneficiaryId" });
      }
      const outcome = await AdmissionService.approveAcceptance(beneficiaryId, adminUser);
      return res.status(200).json({ success: true, beneficiary: outcome });
    } catch (err: any) {
      console.error("[AdmissionController] approveAcceptance failed:", err);
      return res.status(500).json({ error: err.message || "Failed to approve acceptance." });
    }
  }

  /**
   * Controller for administrator verification: acceptance rejection
   * POST /api/admissions/reject-acceptance
   */
  static async rejectAcceptance(req: Request, res: Response) {
    try {
      const { beneficiaryId, adminUser, reason } = req.body;
      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing parameter: beneficiaryId" });
      }
      const outcome = await AdmissionService.rejectAcceptance(beneficiaryId, adminUser, reason);
      return res.status(200).json({ success: true, beneficiary: outcome });
    } catch (err: any) {
      console.error("[AdmissionController] rejectAcceptance failed:", err);
      return res.status(500).json({ error: err.message || "Failed to reject acceptance." });
    }
  }

  /**
   * Controller to retrieve secure response link on-demand
   * GET /api/admissions/secure-link
   */
  static async getSecureLink(req: Request, res: Response) {
    try {
      const { beneficiaryId, origin } = req.query;
      if (!beneficiaryId || typeof beneficiaryId !== "string") {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      // Automatically construct origin domain if not provided, sanitizing out any preview environments
      const isPreviewOrLocal = (url: any): boolean => {
        if (!url || typeof url !== "string") return true;
        const l = url.toLowerCase();
        return (
          l.includes("aistudio") ||
          l.includes("google") ||
          l.includes("run.app") ||
          l.includes("localhost") ||
          l.includes("127.0.0.1") ||
          l.includes("sandbox") ||
          l.includes("ais-dev") ||
          l.includes("ais-pre") ||
          l.includes("my_app_url")
        );
      };

      const safeOrigin = (typeof origin === "string" && !isPreviewOrLocal(origin)) ? origin : undefined;
      const customDomain = safeOrigin || buildPublicUrl("", req);

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(beneficiaryId);
      const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
      if (!beneficiary) {
        return res.status(404).json({ error: "Candidate matching the secure token session could not be located." });
      }

      const tokenRes = await AdmissionService.getOrCreateActiveOfferToken(resolvedId, customDomain);
      const secureLink = tokenRes.secureLink;

      return res.status(200).json({ secureLink });
    } catch (err: any) {
      console.error("[AdmissionController] getSecureLink failed:", err);
      return res.status(500).json({ error: err.message || "Failed to generate secure link." });
    }
  }

  /**
   * Controller to load aggregated statistics/analytics
   * GET /api/admissions/stats
   */
  static async getAdmissionsStats(req: Request, res: Response) {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      
      let tenantId: string | undefined;
      let stateId: string | undefined;
      let tspId: string | undefined;

      const FED_ROLES = ["FED", "FED_SUPER_ADMIN", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "FEDERAL_REVIEW_MANAGER", "FEDERAL_ME_OFFICER"];
      const TSP_ROLES = ["TSP", "TSP_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"];
      const isFederal = user && (user.role === "SUPER_ADMIN" || FED_ROLES.includes(user.role));
      if (user && !isFederal) {
        tenantId = user.tenantId;
        stateId = user.stateId;
        tspId = user.tspId;

        if (TSP_ROLES.includes(user.role) || user.role.startsWith("TSP")) {
          if (!tspId) tspId = "00000000-0000-0000-0000-000000000001";
          if (!stateId) stateId = "state_imo_id_default";
          if (!tenantId) tenantId = "tsp_tenant_default";
        }
      }

      const stats = await DbRepo.getAdmissionsStats({
        tenantId,
        stateId,
        tspId
      });

      // Clear out FED-level multi-organization aggregates for localized users
      if (user && !isFederal && (TSP_ROLES.includes(user.role) || user.role.startsWith("TSP"))) {
        if (stats.byTsp) {
          const val = stats.byTsp[tspId || ""] || stats.byTsp[Object.keys(stats.byTsp)[0]] || stats.summary.total || 0;
          stats.byTsp = { [tspId || "assigned_tsp_center"]: val };
        }
        if (stats.byState) {
          const val = stats.byState[stateId || ""] || stats.byState[Object.keys(stats.byState)[0]] || stats.summary.total || 0;
          stats.byState = { [stateId || "assigned_state"]: val };
        }
      }

      return res.status(200).json(stats);
    } catch (err: any) {
      console.error("[AdmissionController] getAdmissionsStats failed:", err);
      return res.status(500).json({ error: err.message || "Failed loading admissions telemetry." });
    }
  }

  /**
   * Controller for paginated list registry queries
   * GET /api/admissions/list
   */
  static async getAdmissionsList(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string || "1", 10);
      const pageSize = parseInt(req.query.pageSize as string || "50", 10);
      const search = req.query.search as string || "";
      const status = req.query.status as string || "all";
      const sector = req.query.sector as string || "all";
      const tsp = req.query.tsp as string || "all";
      const state = req.query.state as string || "all";

      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;
      
      let tenantId: string | undefined;
      let stateId: string | undefined;
      let tspId: string | undefined;
      let beneficiaryId: string | undefined;

      const FED_ROLES = ["FED", "FED_SUPER_ADMIN", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "FEDERAL_REVIEW_MANAGER", "FEDERAL_ME_OFFICER"];
      const TSP_ROLES = ["TSP", "TSP_ADMIN", "ADMIN_OFFICER", "REVIEW_OFFICER"];
      const isFederal = user && (user.role === "SUPER_ADMIN" || FED_ROLES.includes(user.role));

      let filterTsp = tsp;
      let filterState = state;

      if (user && !isFederal) {
        tenantId = user.tenantId;
        stateId = user.stateId;
        tspId = user.tspId;
        beneficiaryId = user.beneficiaryId;

        if (TSP_ROLES.includes(user.role) || user.role.startsWith("TSP")) {
          if (!tspId) tspId = "00000000-0000-0000-0000-000000000001";
          if (!stateId) stateId = "state_imo_id_default";
          if (!tenantId) tenantId = "tsp_tenant_default";

          // Force narrow scope filter to TSP user assigned center boundary
          filterTsp = tspId;
          filterState = "all";
        }
      }

      const listPayload = await DbRepo.getAdmissionsPaged({
        page,
        pageSize,
        search,
        status,
        sector,
        tsp: filterTsp,
        state: filterState,
        tenantId,
        stateId,
        tspId,
        beneficiaryId
      });

      return res.status(200).json(listPayload);
    } catch (err: any) {
      console.error("[AdmissionController] getAdmissionsList failed:", err);
      return res.status(500).json({ error: err.message || "Failed loading paginated admissions records." });
    }
  }

  /**
   * Controller for bulk transition status
   * POST /api/admissions/bulk-transition
   */
  static async bulkTransitionStatus(req: Request, res: Response) {
    try {
      const { ids, newStatus, reason } = req.body;
      const operatorUser = (req as any).user?.email || "anonymous";

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Missing or invalid required parameter: ids" });
      }
      if (!newStatus) {
        return res.status(400).json({ error: "Missing required parameter: newStatus" });
      }

      const results = {
        successCount: 0,
        failedCount: 0,
        failures: [] as Array<{ id: string; error: string }>
      };

      // Process in small serialized chunks of 20 to constrain CPU and database locking cycles
      const CHUNK_SIZE = 20;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);

        await Promise.all(
          chunk.map(async (id) => {
            try {
              const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
              const b = await DbRepo.getBeneficiaryById(resolvedId);
              if (!b) {
                throw new Error("Candidate not found inside registry.");
              }

              // Apply transition rules
              const currentStatus = b.admissionStatus || "Pending";
              
              const normalizedOld = currentStatus.toLowerCase();
              const normalizedNew = newStatus.toLowerCase();

              let allowed = false;
              if (normalizedOld === "pending" || normalizedOld === "draft" || normalizedOld === "admission sent" || normalizedOld === "admission generated") {
                if (normalizedNew === "under review" || normalizedNew === "under_review") allowed = true;
              } else if (normalizedOld === "under review" || normalizedOld === "under_review" || normalizedOld === "acceptance uploaded") {
                if (normalizedNew === "accepted" || normalizedNew === "admitted") allowed = true;
                if (normalizedNew === "rejected" || normalizedNew === "acceptance rejected" || normalizedNew === "acceptance_rejected") allowed = true;
              } else if (normalizedOld === "accepted" || normalizedOld === "admitted" || normalizedOld === "enrolled" || normalizedOld === "training in progress") {
                if (normalizedNew === "under review" || normalizedNew === "under_review") allowed = true;
              } else if (normalizedOld === "rejected" || normalizedOld === "acceptance rejected" || normalizedOld === "acceptance_rejected") {
                if (normalizedNew === "under review" || normalizedNew === "under_review") allowed = true;
              }

              // Perform transition and save history
              const oldStatusStr = b.admissionStatus || "Pending";
              
              // Clean status name
              let statusToSave = newStatus;
              if (newStatus === "UNDER_REVIEW") statusToSave = "Under Review";
              if (newStatus === "ADMITTED") statusToSave = "Accepted";
              if (newStatus === "REJECTED") statusToSave = "Acceptance Rejected";

              b.admissionStatus = statusToSave as any;
              b.updatedAt = new Date().toISOString();

              await DbRepo.upsertBeneficiary(b);
              await DbRepo.saveWorkflowHistory({
                beneficiaryId: resolvedId,
                oldStatus: oldStatusStr,
                newStatus: statusToSave,
                changedBy: operatorUser,
                changedAt: new Date().toISOString(),
                remarks: reason || "Bulk admissions queue operation"
              });

              // Log audit trail
              await DbRepo.saveAuditLog({
                id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                timestamp: new Date().toISOString(),
                username: operatorUser,
                role: (req as any).user?.role || "System Admin",
                action: "ADMISSIONS_WORKFLOW_RECONCILE",
                details: `Transited candidate '${resolvedId}' from '${oldStatusStr}' to '${statusToSave}'. Remarks: ${reason || "none"}`
              });

              results.successCount++;
            } catch (err: any) {
              results.failedCount++;
              results.failures.push({ id, error: err.message || "Unknown error" });
            }
          })
        );

        // Sleep briefly between chunks of 20 to release the event loop
        if (i + CHUNK_SIZE < ids.length) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      return res.status(200).json({ success: true, results });
    } catch (e: any) {
      console.error("[AdmissionController] bulkTransitionStatus failed:", e);
      return res.status(500).json({ error: e.message || "Failed running bulk admissions transition." });
    }
  }

  /**
   * Controller to load structured official letter properties dynamically
   * GET /api/admissions/:id/letter
   */
  static async getAdmissionLetterData(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      const b = await DbRepo.getBeneficiaryById(resolvedId);
      if (!b) {
        return res.status(404).json({ error: "Candidate profile not found in registry." });
      }

      const settings = await DbRepo.getOrganizationSettings();

      // Ensure stable references or fallbacks
      const currentYear = new Date().getFullYear();
      const admissionRef = b.admissionRef || `IDEAS/TVET/ADM/${b.id.split("-").pop() || b.id}/${currentYear}`;
      const candidateSalutation = b.gender && String(b.gender).toUpperCase() === "FEMALE" ? "Miss" : "Mr";
      const candidateName = `${candidateSalutation} ${b.lastName} ${b.firstName} ${b.otherName || ""}`.trim().replace(/\s+/g, " ");
      
      const payload = {
        date: new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' }),
        beneficiaryName: candidateName,
        skillName: b.skillSector || "Computer Hardware and Cell Phone Repairs",
        sectorName: b.program || "Information Technology",
        trainingCentre: settings.trainingVenue || b.tsp || "National TVET TSP Center",
        startDate: settings.trainingStartDate || "October 12, 2026",
        endDate: settings.trainingEndDate || "December 18, 2026",
        tpmName: settings.tpmName || "Engr. Kabiru Mohammed",
        tpmTitle: settings.tpmTitle || "Technical Project Manager (TPM)",
        tspName: settings.organizationName || b.tsp || "State TVET Board, Kano",
        tspAddress: settings.contactAddress || "State TSP Head Office Compound, Nigeria",
        tspPhone: settings.contactPhone || "+234 803 123 4567",
        tspEmail: settings.contactEmail || "tvet-support@ideas-initiative.org",
        letterheadUrl: settings.letterheadUrl || settings.admissionLetterheadUrl || "",
        signatureUrl: settings.signatureUrl || "",
        admissionRef: admissionRef
      };

      // Also log audit trail that letter data was extracted for building the dynamic views
      const operatorUser = (req as any).user?.email || "anonymous";
      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUser,
        role: (req as any).user?.role || "System Admin",
        action: "ADMISSIONS_LETTER_VIEW",
        details: `Dispatched structured letters preview dataset for candidate ID '${resolvedId}' (${candidateName})`
      });

      return res.status(200).json(payload);
    } catch (e: any) {
      console.error("[AdmissionController] getAdmissionLetterData failed:", e);
      return res.status(500).json({ error: e.message || "Failed gathering unified letters parameters." });
    }
  }

  /**
   * Controller for review and audit verification of candidate uploaded acceptance letters
   * POST /api/admissions/acceptance/review
   */
  static async reviewAcceptanceLetter(req: Request, res: Response) {
    try {
      const { beneficiaryId, status, remarks } = req.body;
      const operatorUser = (req as any).user?.email || "anonymous";

      if (!beneficiaryId || !status) {
        return res.status(400).json({ error: "Missing required parameters: beneficiaryId and status" });
      }

      const validStatuses = ["NOT_SUBMITTED", "SUBMITTED", "UNDER_VERIFICATION", "ACCEPTED", "REJECTED"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status code '${status}'. Expected one of: ${validStatuses.join(", ")}` });
      }

      const verified = await DbRepo.updateAcceptanceLetterStatus(beneficiaryId, status, operatorUser, remarks || "");
      if (!verified) {
        return res.status(404).json({ error: "Candidate admissions record was not successfully located or updated." });
      }

      // Log to Workflow history
      await DbRepo.saveWorkflowHistory({
        beneficiaryId,
        oldStatus: "Acceptance Checklist Review",
        newStatus: `Acceptance Letter Status: ${status}`,
        changedBy: operatorUser,
        changedAt: new Date().toISOString(),
        remarks: remarks || "Acceptance document worksheet audit checked."
      });

      // Log central Audit Log
      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUser,
        role: (req as any).user?.role || "System Admin",
        action: "ADMISSIONS_ACCEPTANCE_CHECK",
        details: `Reviewed candidate '${beneficiaryId}' acceptance letters: status set to '${status}'. Remarks: ${remarks || "none"}`
      });

      return res.status(200).json({ success: true, message: `Candidate acceptance letter status marked as '${status}' successfully.` });
    } catch (err: any) {
      console.error("[AdmissionController] reviewAcceptanceLetter failed:", err);
      return res.status(500).json({ error: err.message || "Failed updating acceptance document review details." });
    }
  }

  /**
   * Generates a candidate's official system-generated Admission Form.
   * POST /api/admissions/:id/generate-form
   */
  static async generateForm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operatorUser = (req as any).user?.email || "SYSTEM";
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).json({ error: "Access Denied." });
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record was not located." });
      }

      // Lock check: prevent regeneration if confirmed or locked
      if (candidate.admissionFormStatus === "CONFIRMED" || candidate.admissionFormStatus === "LOCKED" || candidate.admissionFormConfirmedAt) {
        return res.status(409).json({ error: "Admission Form already finalized" });
      }

      // Generate the official document buffer via DocumentService
      const { document } = await DocumentService.generateDocumentWithBuffer(resolvedId, DocumentType.ADMISSION_FORM, operatorUser, true);

      // Mutate admissions fields for status progression: GENERATED (not yet completed/verified)
      candidate.admissionFormGeneratedAt = new Date().toISOString();
      candidate.admissionFormPdfUrl = document.pdfUrl;
      candidate.admissionFormCompleted = false;
      candidate.admissionFormStatus = "GENERATED";

      await DbRepo.upsertBeneficiary(candidate);

      // Log Event in workflow history (FORM_GENERATED)
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus: "NOT_GENERATED",
        newStatus: "GENERATED",
        changedBy: operatorUser,
        changedAt: new Date().toISOString(),
        remarks: "FORM_GENERATED: Official student admission registration form generated."
      });

      // Log central audit log
      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUser,
        role: (req as any).user?.role || "SYSTEM",
        action: "ADMISSIONS_FORM_GENERATED",
        details: `Generated official registry admission form for beneficiary '${resolvedId}'. Form URL: ${document.pdfUrl}`
      });

      return res.status(200).json({
        success: true,
        message: "Admission Form generated successfully",
        candidate
      });
    } catch (err: any) {
      console.error("[AdmissionController] generateForm failed:", err);
      return res.status(500).json({ error: err.message || "Failed to compile the official admission form." });
    }
  }

  /**
   * Retrieves admission form data and details.
   * GET /api/admissions/:id/form
   */
  static async getForm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).json({ error: "Access Denied." });
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record not found." });
      }

      // Progress status to VIEWED if currently GENERATED
      let statusUpdated = false;
      const oldStatus = candidate.admissionFormStatus || "NOT_GENERATED";
      if (candidate.admissionFormStatus === "GENERATED" || !candidate.admissionFormStatus || candidate.admissionFormStatus === "Pending" || candidate.admissionFormStatus === "Draft") {
        candidate.admissionFormStatus = "VIEWED";
        statusUpdated = true;
      }

      const firstView = !candidate.admissionFormViewedAt;
      if (firstView) {
        candidate.admissionFormViewedAt = new Date().toISOString();
        statusUpdated = true;
      }

      if (statusUpdated) {
        await DbRepo.upsertBeneficiary(candidate);
        await DbRepo.saveWorkflowHistory({
          beneficiaryId: resolvedId,
          oldStatus,
          newStatus: candidate.admissionFormStatus,
          changedBy: (req as any).user?.email || "TRAINEE",
          changedAt: new Date().toISOString(),
          remarks: "FORM_VIEWED: Official admission registration form opened for candidate review."
        });
      }

      return res.status(200).json({
        success: true,
        candidate
      });
    } catch (err: any) {
      console.error("[AdmissionController] getForm failed:", err);
      return res.status(500).json({ error: err.message || "Failed to retrieve student admission form." });
    }
  }

  /**
   * Saves a draft of trainee-completed fields.
   * POST /api/admissions/:id/save-form
   */
  static async saveForm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operatorUser = (req as any).user?.email || "SYSTEM";
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).json({ error: "Access Denied." });
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record was not located." });
      }

      // Lock check
      if (candidate.admissionFormStatus === "CONFIRMED" || candidate.admissionFormStatus === "LOCKED" || candidate.admissionFormConfirmedAt) {
        return res.status(409).json({ error: "Admission Form already finalized" });
      }

      const oldStatus = candidate.admissionFormStatus || "VIEWED";

      // Save fields onto root properties (mapped 1:1 with DB columns)
      candidate.guardianName = req.body.guardianName;
      candidate.guardianAddress = req.body.guardianAddress;
      candidate.guardianPhone = req.body.guardianPhone;
      candidate.physicalChallenge = req.body.physicalChallenge;
      candidate.bankAccountHolder = req.body.bankAccountHolder;
      candidate.bankName = req.body.bankName;
      candidate.bankSortCode = req.body.bankSortCode;
      candidate.bankAccountNumber = req.body.bankAccountNumber;
      candidate.bvn = req.body.bvn;

      // Also ensure synchronized inside admissionFormData JSON just in case!
      candidate.admissionFormData = {
        ...candidate.admissionFormData,
        guardianName: req.body.guardianName,
        guardianAddress: req.body.guardianAddress,
        guardianPhone: req.body.guardianPhone,
        physicalChallenge: req.body.physicalChallenge,
        bankAccountHolder: req.body.bankAccountHolder,
        bankName: req.body.bankName,
        bankSortCode: req.body.bankSortCode,
        bankAccountNumber: req.body.bankAccountNumber,
        bvn: req.body.bvn,
        submissionDate: new Date().toISOString()
      };

      candidate.admissionFormStatus = "IN_PROGRESS";
      await DbRepo.upsertBeneficiary(candidate);

      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus,
        newStatus: "IN_PROGRESS",
        changedBy: operatorUser,
        changedAt: new Date().toISOString(),
        remarks: "FORM_DRAFT_SAVED: Student saved active draft parameters of their registration form."
      });

      return res.status(200).json({
        success: true,
        message: "Admission draft saved successfully.",
        candidate
      });
    } catch (err: any) {
      console.error("[AdmissionController] saveForm failed:", err);
      return res.status(500).json({ error: err.message || "Failed to save draft form parameters." });
    }
  }

  /**
   * Confirms correctness of the official registry admission form.
   * POST /api/admissions/:id/confirm-form
   */
  static async confirmForm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operatorUser = (req as any).user?.email || "TRAINEE";
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).json({ error: "Access Denied." });
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record was not located." });
      }

      // Lock check
      if (candidate.admissionFormStatus === "CONFIRMED" || candidate.admissionFormStatus === "LOCKED" || candidate.admissionFormConfirmedAt) {
        return res.status(409).json({ error: "Admission Form already finalized" });
      }

      // Validation check both for root fields and body fields prior to finalize
      const guardianNm = candidate.guardianName?.trim() || req.body.guardianName?.trim();
      const guardianPh = candidate.guardianPhone?.trim() || req.body.guardianPhone?.trim();
      const acctHolder = candidate.bankAccountHolder?.trim() || req.body.bankAccountHolder?.trim();
      const bankNm = candidate.bankName?.trim() || req.body.bankName?.trim();
      const acctNumber = candidate.bankAccountNumber?.trim() || req.body.bankAccountNumber?.trim();
      const studentBvn = candidate.bvn?.trim() || req.body.bvn?.trim();

      if (!guardianNm || !guardianPh || !acctHolder || !bankNm || !acctNumber || !studentBvn) {
        return res.status(400).json({ error: "Missing required fields for confirmation: Guardian Name, Guardian Phone, Bank Account Holder Name, Bank Name, Account Number, and BVN are mandatory." });
      }

      const oldStatus = candidate.admissionFormStatus || "Draft";

      // Apply final fields if included in confirmation request body, or use loaded fields
      if (req.body.guardianName) candidate.guardianName = req.body.guardianName;
      if (req.body.guardianAddress) candidate.guardianAddress = req.body.guardianAddress;
      if (req.body.guardianPhone) candidate.guardianPhone = req.body.guardianPhone;
      if (req.body.physicalChallenge) candidate.physicalChallenge = req.body.physicalChallenge;
      if (req.body.bankAccountHolder) candidate.bankAccountHolder = req.body.bankAccountHolder;
      if (req.body.bankName) candidate.bankName = req.body.bankName;
      if (req.body.bankSortCode) candidate.bankSortCode = req.body.bankSortCode;
      if (req.body.bankAccountNumber) candidate.bankAccountNumber = req.body.bankAccountNumber;
      if (req.body.bvn) candidate.bvn = req.body.bvn;

      candidate.admissionFormData = {
        ...candidate.admissionFormData,
        guardianName: candidate.guardianName,
        guardianAddress: candidate.guardianAddress,
        guardianPhone: candidate.guardianPhone,
        physicalChallenge: candidate.physicalChallenge,
        bankAccountHolder: candidate.bankAccountHolder,
        bankName: candidate.bankName,
        bankSortCode: candidate.bankSortCode,
        bankAccountNumber: candidate.bankAccountNumber,
        bvn: candidate.bvn,
        submissionDate: new Date().toISOString()
      };

      // Mutate confirmation status step 1: CONFIRMED
      candidate.admissionFormStatus = "CONFIRMED";
      await DbRepo.upsertBeneficiary(candidate);

      // Log Event in workflow history (FORM_CONFIRMED)
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus,
        newStatus: "CONFIRMED",
        changedBy: operatorUser,
        changedAt: new Date().toISOString(),
        remarks: "FORM_CONFIRMED: Student officially confirmed and verified their registrar admission form records."
      });

      // Mutate confirmation status step 2: LOCKED
      candidate.admissionFormConfirmedAt = new Date().toISOString();
      candidate.admissionFormStatus = "LOCKED";
      candidate.admissionFormCompleted = true;

      await DbRepo.upsertBeneficiary(candidate);

      // Log Event in workflow history (FORM_LOCKED)
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus: "CONFIRMED",
        newStatus: "LOCKED",
        changedBy: "SYSTEM",
        changedAt: new Date().toISOString(),
        remarks: "FORM_LOCKED: Admissions form automatically finalized and cryptographically sealed on confirmation."
      });

      // Log central audit log
      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUser,
        role: (req as any).user?.role || "SYSTEM",
        action: "ADMISSIONS_FORM_CONFIRMED",
        details: `Trainee form parameters officially verified and locked for beneficiary '${resolvedId}'`
      });

      return res.status(200).json({
        success: true,
        message: "Your official registration records have been verified and sealed.",
        candidate
      });
    } catch (err: any) {
      console.error("[AdmissionController] confirmForm failed:", err);
      return res.status(500).json({ error: err.message || "Failed to submit verification confirmation seals." });
    }
  }

  /**
   * Serves print-ready system-rendered HTML/PDF structure.
   * GET /api/admissions/:id/form/pdf
   */
  static async getFormPdf(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).send("Access Denied.");
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).send("Candidate not found.");
      }

      // Generate styled HTML structure
      const htmlContent = await PdfService.generateAdmissionFormPdf(candidate, null, true) as string;

      // Update viewed status if currently GENERATED
      let statusUpdated = false;
      const oldStatus = candidate.admissionFormStatus || "NOT_GENERATED";
      if (candidate.admissionFormStatus === "GENERATED" || !candidate.admissionFormStatus || candidate.admissionFormStatus === "Pending" || candidate.admissionFormStatus === "Draft") {
        candidate.admissionFormStatus = "VIEWED";
        statusUpdated = true;
      }

      const firstView = !candidate.admissionFormViewedAt;
      if (firstView) {
        candidate.admissionFormViewedAt = new Date().toISOString();
        statusUpdated = true;
      }

      if (statusUpdated) {
        await DbRepo.upsertBeneficiary(candidate);
        await DbRepo.saveWorkflowHistory({
          beneficiaryId: resolvedId,
          oldStatus,
          newStatus: candidate.admissionFormStatus,
          changedBy: (req as any).user?.email || "TRAINEE",
          changedAt: new Date().toISOString(),
          remarks: "FORM_VIEWED: Printable official document loaded."
        });
      }

      // Check format query parameter - default to true compiled PDF streaming
      if (req.query.format === "html") {
        res.setHeader("Content-Type", "text/html");
        return res.status(200).send(htmlContent);
      }

      const inline = req.query.inline !== "false";
      const pdfBuffer = await PdfService.generateAdmissionFormPdf(candidate, null, false) as Buffer;

      const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      const signature = buffer.toString("ascii", 0, 5);
      const isRealPdf = buffer.length >= 5 && signature === "%PDF-";

      const filename = buildSanitizedFilename(candidate, "ADMISSION_FORM", "pdf");
      const mime = "application/pdf";

      console.log({
        filename,
        mime,
        size: buffer.length,
        header: buffer.slice(0, 50).toString()
      });

      if (!isRealPdf) {
        console.error(`[PDF Audit REJECTED] File does not begin with %PDF- header. Signature was: '${signature}'. Rejecting transmission. Filename: ${filename}`);
        res.status(500);
        res.setHeader("Content-Type", "application/json");
        return res.json({
          error: "PDF_BINARY_CORRUPTION",
          message: "INVALID PDF GENERATED: The requested PDF document failed binary integrity verification (missing standard %PDF- header)."
        });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`);
      return res.status(200).send(buffer);
    } catch (err: any) {
      console.error("[AdmissionController] getFormPdf failed:", err);
      return res.status(500).send("Failed to stream printable admission form: " + err.message);
    }
  }

  /**
   * Unlocks a locked or confirmed admission form.
   * POST /api/admissions/:id/unlock-form
   */
  static async unlockForm(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const operatorUser = (req as any).user?.email || "SYSTEM";

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record was not located." });
      }

      const oldStatus = candidate.admissionFormStatus || "LOCKED";
      const oldTokenVersion = candidate.tokenVersion || 1;
      const oldWorkflowVersion = candidate.workflowVersion || 1;

      candidate.admissionFormConfirmedAt = undefined;
      candidate.admissionFormStatus = "IN_PROGRESS";
      candidate.admissionFormCompleted = false;

      // Preserve tokenVersion so original student onboarding email links remain valid!
      candidate.tokenVersion = oldTokenVersion;
      candidate.workflowVersion = oldWorkflowVersion + 1;

      // Phase 3 - Archive any active forms or letters
      await DbRepo.archiveActiveDocuments(resolvedId);

      await DbRepo.upsertBeneficiary(candidate);

      const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus,
        newStatus: "IN_PROGRESS",
        changedBy: operatorUser,
        changedAt: new Date().toISOString(),
        remarks: "FORM_UNLOCKED: Administrator unlocked the admission form for candidate edits.",
        reason: "Unlock form for candidate updates",
        ipAddress: ipStr,
        tokenVersionBefore: oldTokenVersion,
        tokenVersionAfter: candidate.tokenVersion,
        workflowVersionBefore: oldWorkflowVersion,
        workflowVersionAfter: candidate.workflowVersion
      });

      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUser,
        role: "SUPER_ADMIN",
        action: "ADMISSIONS_FORM_UNLOCKED",
        ipAddress: ipStr,
        details: [
          `Unlocked official registration form for beneficiary '${resolvedId}'`,
          `Old Status: ${oldStatus}`,
          `New Status: IN_PROGRESS`,
          `Token Version: ${oldTokenVersion} -> ${candidate.tokenVersion}`,
          `Workflow Version: ${oldWorkflowVersion} -> ${candidate.workflowVersion}`
        ].join("\n")
      });

      return res.status(200).json({
        success: true,
        message: "Admission form unlocked successfully.",
        candidate
      });
    } catch (err: any) {
      console.error("[AdmissionController] unlockForm failed:", err);
      return res.status(500).json({ error: err.message || "Failed to unlock form." });
    }
  }

  /**
   * Generates and streams official Trainee Admission Form in Microsoft Word (.doc) format.
   * GET /api/admissions/:id/form/docx
   */
  static async getFormDocx(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(id);
      // Trainee Ownership Gate Check
      if (user && user.role === "TRAINEE" && user.beneficiaryId !== resolvedId) {
        return res.status(403).send("Access Denied.");
      }

      const candidate = await DbRepo.getBeneficiaryById(resolvedId);
      if (!candidate) {
        return res.status(404).send("Candidate not found.");
      }

      const docxBuffer = await PdfService.generateAdmissionFormDocx(candidate, null);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="Admission_Form_${candidate.lastName}_${candidate.firstName}.doc"`);
      return res.status(200).send(docxBuffer);
    } catch (err: any) {
      console.error("[AdmissionController] getFormDocx failed:", err);
      return res.status(500).send("Failed to stream printable Word form: " + err.message);
    }
  }

  /**
   * Compiles many Admission Forms based on custom filters and packages them into a single ZIP.
   * POST /api/admissions/bulk-export
   */
  static async bulkExportAdmissionForms(req: Request, res: Response) {
    try {
      const {
        option,
        format = "pdf",
        selectedIds,
        state,
        tsp,
        sector,
        batch,
        search,
        status,
        page,
        pageSize
      } = req.body;

      console.log(`[AdmissionController] Bulk export initiated. Option: ${option}, Format: ${format}`);

      // 1. Fetch active candidates
      let list = await DbRepo.getBeneficiaries({ includePhoto: true });

      // 2. Filter in memory to bypass intricate database joins and keep app compatible with SQLite and PG
      if (option === "selected") {
        const ids = Array.isArray(selectedIds) ? selectedIds : [];
        list = list.filter(b => ids.includes(b.id));
      } else if (option === "by_state" && state && state !== "all") {
        list = list.filter(b => (b.state || "").toLowerCase() === state.toLowerCase());
      } else if (option === "by_tsp" && tsp && tsp !== "all") {
        list = list.filter(b => (b.tsp || "").toLowerCase() === tsp.toLowerCase());
      } else if (option === "by_sector" && sector && sector !== "all") {
        list = list.filter(b => (b.skillSector || "").toLowerCase() === sector.toLowerCase());
      } else if (option === "by_batch" && batch && batch !== "all") {
        list = list.filter(b => (b.batch || "").toLowerCase() === batch.toLowerCase());
      } else if (option === "current_page") {
        // Apply table parameters
        const q = (search || "").toLowerCase();
        if (q) {
          list = list.filter(b => 
            (b.firstName || "").toLowerCase().includes(q) ||
            (b.lastName || "").toLowerCase().includes(q) ||
            (b.id || "").toLowerCase().includes(q) ||
            (b.nin || "").includes(q) ||
            (b.bvn || "").includes(q)
          );
        }
        if (status && status !== "all") {
          list = list.filter(b => (b.admissionStatus || "Pending").toLowerCase() === status.toLowerCase());
        }
        if (sector && sector !== "all") {
          list = list.filter(b => (b.skillSector || "").toLowerCase() === sector.toLowerCase());
        }
        if (tsp && tsp !== "all") {
          list = list.filter(b => (b.tsp || "").toLowerCase() === tsp.toLowerCase());
        }
        if (state && state !== "all") {
          list = list.filter(b => (b.state || "").toLowerCase() === state.toLowerCase());
        }
        
        const p = Math.max(1, Number(page || 1));
        const ps = Math.max(1, Number(pageSize || 50));
        const offset = (p - 1) * ps;
        list = list.slice(offset, offset + ps);
      } else if (option === "all") {
        // Export everything, no filters
      }

      if (list.length === 0) {
        return res.status(400).json({ error: "No candidates matched the selected criteria for bulk export." });
      }

      // Constrain compile runs to maximum 100 for safety bounds
      if (list.length > 100) {
        list = list.slice(0, 100);
      }

      console.log(`[AdmissionController] Compiling ${list.length} files in bulk...`);
      const zip = new JSZip();

      // Sequential iteration to prevent parallel Puppeteer instances from exceeding 512MB RAM bounds
      for (const candidate of list) {
        const fileExt = format === "docx" ? "doc" : "pdf";
        const candidateSlug = `${candidate.lastName || "Candidate"}_${candidate.firstName || "Form"}_${candidate.id}`;
        const fileName = `Admission_Form_${candidateSlug}.${fileExt}`;

        try {
          let fileBuffer: Buffer;
          if (format === "docx") {
            fileBuffer = await PdfService.generateAdmissionFormDocx(candidate, null);
          } else {
            fileBuffer = await PdfService.generateAdmissionFormPdf(candidate, null, false) as Buffer;
          }
          zip.file(fileName, fileBuffer);
        } catch (compileErr: any) {
          console.error(`[AdmissionController] Failed to compile document for candidate ${candidate.id}:`, compileErr);
          // Place error description TXT in the ZIP file so the batch does not halt completely
          zip.file(`ERROR_${candidateSlug}.txt`, `Failed to compile Admission Form: ${compileErr.message || compileErr}`);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="IDEAS_TVET_Admission_Forms_${Date.now()}.zip"`);
      return res.status(200).send(zipBuffer);
    } catch (err: any) {
      console.error("[AdmissionController] bulkExportAdmissionForms failed:", err);
      return res.status(500).json({ error: err.message || "Failed to process bulk enrollment forms export." });
    }
  }

  /**
   * GET /api/admissions/verify/:reference
   */
  static async verifyForm(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      if (!reference) {
        return res.status(400).json({ success: false, error: "Reference number is required for verification." });
      }

      const list = await DbRepo.getBeneficiaries({ includePhoto: false });
      const candidate = list.find(b => b.admissionFormRef && b.admissionFormRef.toLowerCase() === reference.toLowerCase());
      
      if (!candidate) {
        return res.status(404).json({
          success: false,
          valid: false,
          message: "No official registration record matches this reference number."
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        candidateName: `${candidate.lastName}, ${candidate.firstName} ${candidate.otherName || ""}`.trim(),
        status: candidate.admissionFormStatus || "Pending",
        confirmationDate: candidate.admissionFormConfirmedAt || candidate.admissionFormGeneratedAt || null,
        validity: candidate.admissionFormStatus === "CONFIRMED" || candidate.admissionFormStatus === "LOCKED" ? "VALID_AND_SEALED" : "VALID_UNCONFIRMED"
      });
    } catch (err: any) {
      console.error("[AdmissionController] verifyForm failed:", err);
      return res.status(500).json({ success: false, error: "Failed to query system verification logs: " + err.message });
    }
  }

  /**
   * POST /api/admissions/export-jobs
   */
  static async createExportJob(req: Request, res: Response) {
    try {
      const {
        option,
        format = "pdf",
        selectedIds,
        state,
        tsp,
        sector,
        batch,
        search,
        status,
        page,
        pageSize
      } = req.body;

      // 1. Fetch active candidates
      let list = await DbRepo.getBeneficiaries({ includePhoto: true });

      // 2. Clear old export jobs from memory to prevent leaks
      const ONE_HOUR = 60 * 60 * 1000;
      for (const [id, j] of exportJobs.entries()) {
        if (Date.now() - new Date(j.createdAt).getTime() > ONE_HOUR) {
          exportJobs.delete(id);
        }
      }

      // 3. Apply filters matching existing infrastructure
      if (option === "selected") {
        const ids = Array.isArray(selectedIds) ? selectedIds : [];
        list = list.filter(b => ids.includes(b.id));
      } else if (option === "by_state" && state && state !== "all") {
        list = list.filter(b => (b.state || "").toLowerCase() === state.toLowerCase());
      } else if (option === "by_tsp" && tsp && tsp !== "all") {
        list = list.filter(b => (b.tsp || "").toLowerCase() === tsp.toLowerCase());
      } else if (option === "by_sector" && sector && sector !== "all") {
        list = list.filter(b => (b.skillSector || "").toLowerCase() === sector.toLowerCase());
      } else if (option === "by_batch" && batch && batch !== "all") {
        list = list.filter(b => (b.batch || "").toLowerCase() === batch.toLowerCase());
      } else if (option === "current_page") {
        const q = (search || "").toLowerCase();
        if (q) {
          list = list.filter(b => 
            (b.firstName || "").toLowerCase().includes(q) ||
            (b.lastName || "").toLowerCase().includes(q) ||
            (b.id || "").toLowerCase().includes(q) ||
            (b.nin || "").includes(q) ||
            (b.bvn || "").includes(q)
          );
        }
        if (status && status !== "all") {
          list = list.filter(b => (b.admissionStatus || "Pending").toLowerCase() === status.toLowerCase());
        }
        if (sector && sector !== "all") {
          list = list.filter(b => (b.skillSector || "").toLowerCase() === sector.toLowerCase());
        }
        if (tsp && tsp !== "all") {
          list = list.filter(b => (b.tsp || "").toLowerCase() === tsp.toLowerCase());
        }
        if (state && state !== "all") {
          list = list.filter(b => (b.state || "").toLowerCase() === state.toLowerCase());
        }
        
        const p = Math.max(1, Number(page || 1));
        const ps = Math.max(1, Number(pageSize || 50));
        const offset = (p - 1) * ps;
        list = list.slice(offset, offset + ps);
      }

      if (list.length === 0) {
        return res.status(400).json({ error: "No candidates matched the selected criteria for background batch compilation." });
      }

      const jobId = "job_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const newJob: ExportJob = {
        id: jobId,
        status: "PENDING",
        progress: 0,
        totalCandidates: list.length,
        processedCandidates: 0,
        createdAt: new Date().toISOString()
      };

      exportJobs.set(jobId, newJob);

      // Trigger asynchronous block processing in background thread
      processExportJobInBackground(jobId, list, format).catch((asyncErr) => {
        console.error(`[ExportJobSystem] Error in job background runner ${jobId}:`, asyncErr);
      });

      return res.status(200).json({
        success: true,
        message: "Batch compile job successfully queued.",
        jobId,
        total: list.length
      });
    } catch (err: any) {
      console.error("[AdmissionController] createExportJob failed:", err);
      return res.status(500).json({ error: err.message || "Failed to start export job." });
    }
  }

  /**
   * GET /api/admissions/export-jobs/:jobId
   */
  static async getExportJobStatus(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = exportJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: "The requested batch job metadata was not located or has expired." });
    }

    return res.status(200).json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      totalCandidates: job.totalCandidates,
      processedCandidates: job.processedCandidates,
      error: job.error,
      downloadUrl: job.status === "COMPLETED" ? `/api/admissions/export-jobs/download/${job.id}` : null
    });
  }

  /**
   * GET /api/admissions/export-jobs/download/:jobId
   */
  static async downloadExportJob(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = exportJobs.get(jobId);
    if (!job) {
      return res.status(404).send("Batch output file was not found or has expired from memory cache.");
    }

    if (job.status !== "COMPLETED" || !job.zipBuffer) {
      return res.status(400).send("Batch output file is still being processed or has failed compilation.");
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="IDEAS_TVET_Admission_Batch_${jobId}.zip"`);
    return res.status(200).send(job.zipBuffer);
  }

  /**
   * POST /api/admissions/:id/regenerate-reference
   */
  static async regenerateReference(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const candidate = await DbRepo.getBeneficiaryById(id);
      if (!candidate) {
        return res.status(404).json({ error: "Candidate admissions record was not located." });
      }

      // Generate a new, forced sequential reference
      const newRef = await DbRepo.getOrGenerateAdmissionFormRef(id, true);
      
      return res.status(200).json({
        success: true,
        reference: newRef
      });
    } catch (err: any) {
      console.error("[AdmissionController] regenerateReference failed:", err);
      return res.status(500).json({ error: "Failed to regenerate reference: " + err.message });
    }
  }

  /**
   * Controller to truly regenerate the offer letter and acceptance form package.
   * Creates a fresh token version, generates updated PDFs, uploads to CDN, updates version histories.
   * POST /api/admissions/regenerate-offer-package
   */
  static async regenerateOfferPackage(req: Request, res: Response) {
    try {
      const { beneficiaryId, origin } = req.body;
      if (!beneficiaryId || typeof beneficiaryId !== "string") {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      const resolvedId = await AdmissionController.resolveBeneficiaryIdResiliently(beneficiaryId);
      const beneficiary = await DbRepo.getBeneficiaryById(resolvedId);
      if (!beneficiary) {
        return res.status(404).json({ error: "Candidate admissions record was not located in registry." });
      }

      // Automatically construct origin domain if not provided, sanitizing out any preview environments
      const isPreviewOrLocal = (url: any): boolean => {
        if (!url || typeof url !== "string") return true;
        const l = url.toLowerCase();
        return (
          l.includes("aistudio") ||
          l.includes("google") ||
          l.includes("run.app") ||
          l.includes("localhost") ||
          l.includes("127.0.0.1") ||
          l.includes("sandbox") ||
          l.includes("ais-dev") ||
          l.includes("ais-pre") ||
          l.includes("my_app_url")
        );
      };

      const safeOrigin = (typeof origin === "string" && !isPreviewOrLocal(origin)) ? origin : undefined;
      const customDomain = safeOrigin || buildPublicUrl("", req);

      // Do not increment token_version when regenerating offer (per Part 3 rules)
      const pool = getPgPool();
      const currentTokenVerNum = beneficiary.tokenVersion || 1;
      
      if (pool) {
        await pool.query(
          "UPDATE beneficiaries SET token_version = $1, updated_at = NOW() WHERE id = $2",
          [currentTokenVerNum, resolvedId]
        );
      } else {
        beneficiary.tokenVersion = currentTokenVerNum;
        await DbRepo.upsertBeneficiary(beneficiary);
      }

      // Create a fresh ACTIVE token
      const secureToken = await AdmissionService.createPublicResponseToken(resolvedId, "OFFER_ACCEPTANCE");
      const secureLink = `${customDomain}/?token=${secureToken}`;
      const tokenExpiresAt = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

      // Retrieve latest sequential versions
      const latestVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ADMISSION_LETTER);
      const nextVersionNum = latestVersion + 1;

      const latestAccVersion = await DbRepo.getLatestDocumentVersion(resolvedId, DocumentType.ACCEPTANCE_LETTER);
      const nextAccLetterVerNum = latestAccVersion + 1;

      // Compile unique validation codes
      const prefixAdm = "TVET-ADM";
      const hexAdm = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      const verificationCodeAdm = `${prefixAdm}-${hexAdm}`;

      const prefixAcc = "TVET-ACC";
      const hexAcc = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
      const verificationCodeAcc = `${prefixAcc}-${hexAcc}`;

      // Refresh beneficiary fields
      beneficiary.tokenVersion = currentTokenVerNum;
      beneficiary.admissionLetterGeneratedAt = new Date().toISOString();

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

      // Generate the fresh PDFs in memory
      let admissionPdfBuffer: Buffer;
      let acceptancePdfBuffer: Buffer;

      try {
        const chromePath = PdfService.resolveChromePath();
        if (!chromePath) {
          throw new Error("PDF_RENDER_UNAVAILABLE: PDF renderer is not configured or Chrome binary is missing on Render.");
        }

        const compiled = await Promise.all([
          PdfService.generateAdmissionLetterPdf(beneficiary, metaAdm) as Promise<Buffer>,
          PdfService.generateAcceptanceLetterPdf(beneficiary, metaAcc) as Promise<Buffer>
        ]);
        admissionPdfBuffer = compiled[0];
        acceptancePdfBuffer = compiled[1];
      } catch (pdfErr: any) {
        console.error("[AdmissionController.regenerateOfferPackage] PDF renderer is unavailable or failed:", pdfErr.message || pdfErr);
        // Clean return: Still generated token, but didn't overwrite existing PDFs or corrupt records
        return res.status(200).json({
          success: false,
          error: "PDF_RENDER_UNAVAILABLE",
          message: "Offer link was prepared, but official PDF rendering is temporarily unavailable.",
          secureLink,
          tokenExpiresAt,
          beneficiary
        });
      }

      const publicIdAdm = `beneficiary_${resolvedId}_admission_letter_v${nextVersionNum}`;
      const publicIdAcc = `beneficiary_${resolvedId}_acceptance_letter_v${nextAccLetterVerNum}`;
      
      const admissionPdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAdm}.pdf`;
      const acceptancePdfUrl = `https://res.cloudinary.com/ideas-tvet/raw/upload/${publicIdAcc}.pdf`;

      // Upload synchronously to Cloudinary so links work immediately on refresh
      await Promise.all([
        CloudinaryService.uploadDocument(admissionPdfBuffer, publicIdAdm),
        CloudinaryService.uploadDocument(acceptancePdfBuffer, publicIdAcc)
      ]).catch(e => {
        console.error("[AdmissionController.regenerateOfferPackage] Cloudinary Upload warning:", e);
      });

      // Save documents to DB ledger
      const admissionDocId = `gdoc_${Date.now()}_adm`;
      const acceptanceDocId = `gdoc_${Date.now()}_acc`;
      const operatorUsername = (req as any).user?.username || "ADMIN_OPERATOR";

      const newDocAdm = {
        id: admissionDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ADMISSION_LETTER,
        version: nextVersionNum,
        pdfUrl: admissionPdfUrl,
        generatedBy: operatorUsername,
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAdm,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };

      const newDocAcc = {
        id: acceptanceDocId,
        beneficiaryId: resolvedId,
        documentType: DocumentType.ACCEPTANCE_LETTER,
        version: nextAccLetterVerNum,
        pdfUrl: acceptancePdfUrl,
        generatedBy: operatorUsername,
        createdAt: new Date().toISOString(),
        verificationCode: verificationCodeAcc,
        verificationStatus: "UNVERIFIED",
        verificationDate: "",
        emailDeliveryStatus: "NOT_SENT",
      };

      await Promise.all([
        DbRepo.saveGeneratedDocument(newDocAdm),
        DbRepo.saveGeneratedDocument(newDocAcc)
      ]);

      // Update beneficiary metadata
      beneficiary.admissionLetterUrl = admissionPdfUrl;
      beneficiary.acceptanceLetterUrl = acceptancePdfUrl;

      const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;

      const currentVersions = beneficiary.admissionLetterVersions || [];
      beneficiary.admissionLetterVersions = [
        ...currentVersions,
        {
          version: nextVersionNum,
          url: admissionPdfUrl,
          name: `${namePart}_ADMISSION_LETTER_v${nextVersionNum}.pdf`,
          generatedAt: new Date().toISOString()
        }
      ];

      const currentDocs = beneficiary.documentsList || [];
      beneficiary.documentsList = [
        ...currentDocs,
        {
          id: admissionDocId,
          name: `${namePart}_ADMISSION_LETTER.pdf`,
          type: "admission",
          url: admissionPdfUrl,
          uploadedAt: new Date().toISOString(),
          version: nextVersionNum
        },
        {
          id: acceptanceDocId,
          name: `${namePart}_ACCEPTANCE_LETTER.pdf`,
          type: "acceptance",
          url: acceptancePdfUrl,
          uploadedAt: new Date().toISOString(),
          version: nextAccLetterVerNum
        }
      ];

      const originalAdmissionStatus = beneficiary.admissionStatus || "Pending";
      beneficiary.admissionStatus = "Admission Generated";
      beneficiary.updatedAt = new Date().toISOString();

      await DbRepo.upsertBeneficiary(beneficiary);

      // Workflow & audit records
      await DbRepo.saveWorkflowHistory({
        beneficiaryId: resolvedId,
        oldStatus: originalAdmissionStatus,
        newStatus: "Admission Generated",
        changedBy: operatorUsername,
        changedAt: new Date().toISOString(),
        remarks: "Regenerated official offer letters with updated configurations."
      }).catch(() => {});

      await DbRepo.saveAuditLog({
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username: operatorUsername,
        role: "Operator",
        action: "Offer Package Regenerated",
        details: `Regenerated and compiled official offer letter package for candidate: ${beneficiary.firstName} ${beneficiary.lastName}.`
      }).catch(() => {});

      const updatedBeneficiary = await DbRepo.getBeneficiaryById(resolvedId);

      return res.status(200).json({
        success: true,
        secureLink,
        tokenExpiresAt,
        admissionDocumentVersion: nextVersionNum,
        acceptanceDocumentVersion: nextAccLetterVerNum,
        admissionPdfUrl,
        acceptancePdfUrl,
        beneficiary: updatedBeneficiary
      });
    } catch (err: any) {
      console.error("[AdmissionController.regenerateOfferPackage] Critical error:", err);
      return res.status(500).json({ error: err.message || "Failed to regenerate offer package." });
    }
  }

  /**
   * Diagnostic Endpoint for FED-level & SUPER_ADMIN operations auditing
   * GET /api/admin/debug/offer-token?token=...
   */
  static async debugOfferToken(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const FED_ROLES = ["FED", "FED_SUPER_ADMIN", "FEDERAL_SUPER_ADMIN", "FEDERAL_PROGRAM_MANAGER", "FEDERAL_REVIEW_MANAGER", "FEDERAL_ME_OFFICER"];
      const isFed = user && (user.role === "SUPER_ADMIN" || FED_ROLES.includes(user.role) || (typeof user.role === "string" && user.role.startsWith("FED")));
      
      if (!isFed) {
        return res.status(403).json({ error: "Forbidden: This diagnostic endpoint is restricted as an exclusive FED-level privilege." });
      }

      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Missing required query parameter: token" });
      }

      const tokenHash = TokenService.hashToken(token);
      const pool = getPgPool();
      let tokenRow: any = null;
      let dispatchRow: any = null;

      if (pool) {
        const tRes = await pool.query("SELECT * FROM public_response_tokens WHERE token_hash = $1 OR token = $2 LIMIT 1", [tokenHash, token]);
        if (tRes.rows.length > 0) {
          tokenRow = tRes.rows[0];
        }

        const dRes = await pool.query("SELECT * FROM document_dispatches WHERE secure_token = $1 LIMIT 1", [token]);
        if (dRes.rows.length > 0) {
          dispatchRow = dRes.rows[0];
        }
      }

      const decoded = TokenService.decodeToken(token) as any;
      const secureDiagnosis: any = {
        existsInPublicResponseTokens: !!tokenRow,
        existsInDocumentDispatches: !!dispatchRow,
        tokenDecodes: !!decoded,
        tokenDecodedExpiry: decoded ? new Date(decoded.expires).toISOString() : null,
        decodedBeneficiaryIdSafe: decoded ? `${decoded.id.substring(0, 8)}-xxxx` : null,
        decodedTokenVersion: decoded ? decoded.tokenVersion || 1 : null,
        rowStatus: tokenRow ? tokenRow.status || "ACTIVE" : null,
        rowExpiresAt: tokenRow && tokenRow.expires_at ? new Date(tokenRow.expires_at).toISOString() : null,
        rowOpenedAt: tokenRow && tokenRow.opened_at ? new Date(tokenRow.opened_at).toISOString() : null,
        rowUsedAt: tokenRow && tokenRow.used_at ? new Date(tokenRow.used_at).toISOString() : null,
        rowBeneficiaryIdSafe: tokenRow ? `${tokenRow.beneficiary_id.substring(0, 8)}-xxxx` : null,
        rowTokenVersion: tokenRow ? tokenRow.token_version || 1 : null,
      };

      if (decoded && tokenRow) {
        secureDiagnosis.beneficiaryIdMatch = decoded.id === tokenRow.beneficiary_id;
        const beneficiary = await DbRepo.getBeneficiaryById(tokenRow.beneficiary_id);
        if (beneficiary) {
          secureDiagnosis.beneficiaryCurrentTokenVersion = beneficiary.tokenVersion || 1;
          secureDiagnosis.versionMismatch = (decoded.tokenVersion || 1) < (beneficiary.tokenVersion || 1);
        }
      }

      return res.status(200).json({ success: true, diagnosis: secureDiagnosis });
    } catch (err: any) {
      console.error("[AdmissionController.debugOfferToken] Diagnostic error:", err);
      return res.status(500).json({ error: "Internal diagnostic processing failure: " + err.message });
    }
  }
}

interface ExportJob {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  progress: number;
  totalCandidates: number;
  processedCandidates: number;
  createdAt: string;
  error?: string;
  zipBuffer?: Buffer;
}

const exportJobs = new Map<string, ExportJob>();

async function processExportJobInBackground(jobId: string, list: Beneficiary[], format: string) {
  const job = exportJobs.get(jobId);
  if (!job) return;

  job.status = "PROCESSING";
  console.log(`[ExportJob] Starting background job ${jobId} and compiling ${list.length} candidates in sequential chunks.`);

  try {
    const zip = new JSZip();

    for (let idx = 0; idx < list.length; idx++) {
      const candidate = list[idx];
      
      // Load candidate's reference number (guarantees assignment to DB/JSON fallback)
      const formRef = candidate.admissionFormRef || await DbRepo.getOrGenerateAdmissionFormRef(candidate.id);
      candidate.admissionFormRef = formRef;

      const fileExt = format === "docx" ? "docx" : "pdf";
      const candidateSlug = `${candidate.lastName || "Candidate"}_${candidate.firstName || "Form"}`;
      const fileName = `${formRef}_${candidateSlug}.${fileExt}`;

      try {
        let fileBuffer: Buffer;
        if (format === "docx") {
          fileBuffer = await PdfService.generateAdmissionFormDocx(candidate, null);
        } else {
          fileBuffer = await PdfService.generateAdmissionFormPdf(candidate, null, false) as Buffer;
        }
        zip.file(fileName, fileBuffer);
      } catch (compileErr: any) {
        console.error(`[ExportJob] Failed compiling candidate file ${candidate.id}:`, compileErr);
        zip.file(`ERROR_${formRef}_${candidateSlug}.txt`, `Failed compile: ${compileErr.message || compileErr}`);
      }

      // Safeguard progression metrics update
      job.processedCandidates = idx + 1;
      job.progress = Math.round(((idx + 1) / list.length) * 100);
      exportJobs.set(jobId, job);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    job.status = "COMPLETED";
    job.progress = 100;
    job.zipBuffer = zipBuffer;
    exportJobs.set(jobId, job);

    console.log(`[ExportJob] Background job ${jobId} completed successfully! Size: ${zipBuffer.length} bytes`);
  } catch (err: any) {
    console.error(`[ExportJob] Critical error in background job ${jobId}:`, err);
    job.status = "FAILED";
    job.error = err.message || String(err);
    exportJobs.set(jobId, job);
  }
}
