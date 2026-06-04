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
}
