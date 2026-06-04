/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary, ProgramStatus, AuditLog } from "../types";
import { PdfService } from "./pdf.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";
import { DbRepo } from "./db";
import { CloudinaryService } from "./cloudinary.service";

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
    const beneficiary = await DbRepo.getBeneficiaryById(beneficiaryId);
    
    if (!beneficiary) {
      throw new Error(`Beneficiary candidate '${beneficiaryId}' not found in registry.`);
    }
    
    // 1. Generate Letter references and update beneficiary local parameters
    const admissionRef = beneficiary.admissionRef || `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
    
    if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Pending") {
      beneficiary.admissionStatus = "Admission Generated";
    }
    beneficiary.admissionRef = admissionRef;
    beneficiary.admissionLetterGeneratedAt = beneficiary.admissionLetterGeneratedAt || new Date().toISOString();
    beneficiary.updatedAt = new Date().toISOString();

    // 2. Generate secure single-use response token link
    const secureToken = TokenService.generateToken(beneficiary.id);
    const secureLink = `${customDomain}/?token=${secureToken}`;

    // 3. Generate dynamic documents as PDF buffers
    console.log("[AdmissionService] Compiling PDFs via Puppeteer...");
    const admissionPdfBuffer = await PdfService.generateAdmissionLetterPdf(beneficiary);
    const acceptancePdfBuffer = await PdfService.generateAcceptanceLetterPdf(beneficiary);

    // 4. Upload PDFs to Cloudinary
    console.log("[AdmissionService] Uploading compiled files to Cloudinary...");
    const admissionPdfUrl = await CloudinaryService.uploadDocument(
      admissionPdfBuffer, 
      `Admission_Letter_${beneficiary.id}`
    );
    const acceptancePdfUrl = await CloudinaryService.uploadDocument(
      acceptancePdfBuffer, 
      `Acceptance_Template_${beneficiary.id}`
    );

    // Sync URLs to main columns
    beneficiary.admissionLetterUrl = admissionPdfUrl;
    beneficiary.acceptanceLetterUrl = acceptancePdfUrl;

    // 5. Document Versioning for Admission Letter
    const currentVersions = beneficiary.admissionLetterVersions || [];
    const nextVersionNum = currentVersions.length + 1;
    const newVersionItem = {
      version: nextVersionNum,
      url: admissionPdfUrl,
      name: `Official_TVET_Admission_Letter_v${nextVersionNum}.pdf`,
      generatedAt: new Date().toISOString()
    };
    beneficiary.admissionLetterVersions = [...currentVersions, newVersionItem];

    // 6. Save documents inside Candidate's local document database lists for backwards-compatibility
    const currentDocs = beneficiary.documentsList || [];
    const updatedDocs = [...currentDocs];
    updatedDocs.push({
      id: "doc_adm_" + Date.now() + "_" + nextVersionNum,
      name: `Official TVET Admission Letter (v${nextVersionNum}).pdf`,
      type: "admission",
      url: admissionPdfUrl,
      uploadedAt: new Date().toISOString(),
      version: nextVersionNum
    });
    beneficiary.documentsList = updatedDocs;

    // 7. Send automated email using formal unique email coordinates
    const toEmail = beneficiary.email || "uniqueideasproject@gmail.com";
    const admissionPdfBase64 = admissionPdfBuffer.toString("base64");
    const acceptancePdfBase64 = acceptancePdfBuffer.toString("base64");

    const mailResult = await EmailService.sendAdmissionEmail(
      toEmail, 
      `${beneficiary.firstName} ${beneficiary.lastName}`, 
      secureLink,
      [
        { name: `Admission_Letter_${beneficiary.id}.pdf`, content: admissionPdfBase64, contentType: "application/pdf" },
        { name: `Acceptance_Letter_Template_${beneficiary.id}.pdf`, content: acceptancePdfBase64, contentType: "application/pdf" }
      ]
    );

    // Set Separate Email Status as requested
    if (mailResult.success) {
      beneficiary.emailStatus = "Sent";
      if (!beneficiary.admissionStatus || beneficiary.admissionStatus === "Admission Generated") {
        beneficiary.admissionStatus = "Admission Sent";
      }
      beneficiary.admissionLetterSentAt = new Date().toISOString();
      beneficiary.smtpErrorDetails = undefined;
    } else {
      beneficiary.emailStatus = "Failed";
      beneficiary.smtpErrorDetails = mailResult.status;
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

    // 8. Append secure logs and write to storage
    await this.logAction(
      "admission@uniqueideas.dontechservicesconst.com", 
      "Email Sent", 
      `Dispatched formal admission offer & PDFs to '${beneficiary.firstName} ${beneficiary.lastName}'. Delivery Status: ${mailResult.success ? 'Success' : 'Failed'}`
    );

    await DbRepo.upsertBeneficiary(beneficiary);

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

    console.log("[AdmissionService] Generating Enrollment Confirmation & Certificate PDFs...");
    
    // Generate Enrollment Confirmation PDF
    const enrollmentPdfBuffer = await PdfService.generateEnrollmentConfirmationPdf(beneficiary);
    const enrollmentUrl = await CloudinaryService.uploadDocument(
      enrollmentPdfBuffer, 
      `Enrollment_Confirmation_${beneficiary.id}`
    );
    beneficiary.enrollmentLetterUrl = enrollmentUrl;

    // Generate Completion Certificate PDF (future use)
    const certPdfBuffer = await PdfService.generateCompletionCertificatePdf(beneficiary);
    const certUrl = await CloudinaryService.uploadDocument(
      certPdfBuffer, 
      `Completion_Certificate_${beneficiary.id}`
    );
    beneficiary.certificateUrl = certUrl;

    // Append core document lists for retrospective audit compliance
    const currentDocs = beneficiary.documentsList || [];
    beneficiary.documentsList = [
      ...currentDocs,
      {
        id: "doc_enr_" + Date.now(),
        name: "Official Trainee Biometrics Enrollment Confirmation.pdf",
        type: "enrollment",
        url: enrollmentUrl,
        uploadedAt: new Date().toISOString(),
        version: 1
      },
      {
        id: "doc_cert_" + Date.now(),
        name: "Official Skill Competency Certificate of Completion.pdf",
        type: "certificate",
        url: certUrl,
        uploadedAt: new Date().toISOString(),
        version: 1
      }
    ];

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
    const decoded = TokenService.verifyToken(token);
    if (!decoded || !decoded.id) {
      throw new Error("Activation session token is invalid, corrupted, or has expired.");
    }

    const beneficiary = await DbRepo.getBeneficiaryById(decoded.id);
    if (!beneficiary) {
      throw new Error("Primary biographical record corresponding to portal session could not be tracked.");
    }

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
    let signedAcceptanceUrl = "";
    if (formData.uploadedAcceptanceLetter) {
      console.log("[AdmissionService] Custom hand-signed file detected, syncing to Cloudinary...");
      if (formData.uploadedAcceptanceLetter.startsWith("data:")) {
        signedAcceptanceUrl = await CloudinaryService.uploadDocument(
          formData.uploadedAcceptanceLetter, 
          `Signed_Acceptance_${beneficiary.id}`
        );
      } else {
        signedAcceptanceUrl = formData.uploadedAcceptanceLetter;
      }
    } else {
      console.log("[AdmissionService] Compiling signed Acceptance Letter contract PDF via Puppeteer...");
      const signedAcceptancePdfBuffer = await PdfService.generateAcceptanceLetterPdf(beneficiary);
      signedAcceptanceUrl = await CloudinaryService.uploadDocument(
        signedAcceptancePdfBuffer, 
        `Signed_Acceptance_Auto_${beneficiary.id}`
      );
    }

    beneficiary.acceptanceLetterUploaded = true;
    beneficiary.acceptanceLetterUrl = signedAcceptanceUrl;
    beneficiary.acceptanceLetterUploadedAt = new Date().toISOString();

    // Document Versioning for Acceptance Letter
    const currentAccLetters = beneficiary.acceptanceLetterVersions || [];
    const nextAccLetterVer = currentAccLetters.length + 1;
    const newAccLetterItem = {
      version: nextAccLetterVer,
      url: signedAcceptanceUrl,
      name: `Signed_Acceptance_Declaration_v${nextAccLetterVer}.pdf`,
      uploadedAt: new Date().toISOString()
    };
    beneficiary.acceptanceLetterVersions = [...currentAccLetters, newAccLetterItem];

    // 4. Update core document lists
    const currentDocs = beneficiary.documentsList || [];
    const updatedDocs = [...currentDocs];
    updatedDocs.push({
      id: "doc_acc_" + Date.now() + "_" + nextAccLetterVer,
      name: `Signed Acceptance Declaration (v${nextAccLetterVer}).pdf`,
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

    // 6. Generate detailed audit log traces
    await this.logAction(
      beneficiary.email || `${beneficiary.firstName.toLowerCase()}@tvet-response.net`,
      "Acceptance Uploaded",
      `Student ${beneficiary.firstName} ${beneficiary.lastName} (ID: ${beneficiary.id}) signed acceptance & completed supplemental profiles via secure link.`
    );

    await DbRepo.upsertBeneficiary(beneficiary);
    return { success: true, beneficiary };
  }
}
