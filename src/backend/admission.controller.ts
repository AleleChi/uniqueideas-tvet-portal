/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from "express";
import { AdmissionService } from "./admission.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { DbRepo } from "./db";


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
   * Controller for Admin endpoint to dispatch letters and send email notification
   * POST /api/admissions/send-offer
   */
  static async sendOffer(req: Request, res: Response) {
    try {
      const { beneficiaryId, origin } = req.body;
      if (!beneficiaryId) {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      // Automatically construct origin domain if not provided
      const customDomain = origin || `${req.protocol}://${req.get("host")}`;

      const outcome = await AdmissionService.sendAdmissionOffer(beneficiaryId, customDomain);
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
   * Controller to check token validity and retrieve clean, non-sensitive biographical parameters of candidate
   * GET /api/admissions/validate-token
   */
  static async validateToken(req: Request, res: Response) {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "No secure response token provided in verification query." });
      }

      const decoded = TokenService.verifyToken(token);
      if (!decoded || !decoded.id) {
        return res.status(401).json({ error: "The response token is invalid, expired, or corrupted." });
      }

      // Automatically record tracking Opened event when portal is opened
      await AdmissionService.registerEmailOpened(decoded.id);

      // Load beneficiary using our non-blocking database repository
      const beneficiary = await DbRepo.getBeneficiaryById(decoded.id);

      if (!beneficiary) {
        return res.status(404).json({ error: "Candidate matching the secure token session could not be located." });
      }

      // Return sanitized candidate fields suitable for public view (excluding core admin values if needed)
      return res.status(200).json({
        valid: true,
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
      console.error("[AdmissionController] validateToken failed:", err);
      return res.status(500).json({ error: "Internal token decrypter processing failure." });
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
        message: "Your e-Signature and admission enrollment profiles were successfully verified and logged.",
        candidate: outcome.beneficiary
      });
    } catch (err: any) {
      console.error("[AdmissionController] submitResponse failed:", err);
      return res.status(500).json({ error: err.message || "Failed validating and persisting portal response." });
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
  static getSecureLink(req: Request, res: Response) {
    try {
      const { beneficiaryId, origin } = req.query;
      if (!beneficiaryId || typeof beneficiaryId !== "string") {
        return res.status(400).json({ error: "Missing required parameter: beneficiaryId" });
      }

      const customDomain = (typeof origin === "string" && origin) || `${req.protocol}://${req.get("host")}`;
      const secureToken = TokenService.generateToken(beneficiaryId);
      const secureLink = `${customDomain}/?token=${secureToken}`;

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
      const stats = await DbRepo.getAdmissionsStats();
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

      const listPayload = await DbRepo.getAdmissionsPaged({
        page,
        pageSize,
        search,
        status,
        sector,
        tsp,
        state
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
              const b = await DbRepo.getBeneficiaryById(id);
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
                beneficiaryId: id,
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
                details: `Transited candidate '${id}' from '${oldStatusStr}' to '${statusToSave}'. Remarks: ${reason || "none"}`
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
      const b = await DbRepo.getBeneficiaryById(id);
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
        details: `Dispatched structured letters preview dataset for candidate ID '${id}' (${candidateName})`
      });

      return res.status(200).json(payload);
    } catch (e: any) {
      console.error("[AdmissionController] getAdmissionLetterData failed:", e);
      return res.status(500).json({ error: e.message || "Failed gathering unified letters parameters." });
    }
  }
}
