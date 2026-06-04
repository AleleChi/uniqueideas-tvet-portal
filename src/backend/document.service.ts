/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DbRepo } from "./db";
import { PdfService } from "./pdf.service";
import { CloudinaryService } from "./cloudinary.service";
import { EmailService } from "./email.service";
import { GeneratedDocument, DocumentType, Beneficiary } from "../types";
import QRCode from "qrcode";

export class DocumentService {
  /**
   * Helper to retrieve a beneficiary by ID, looking in database or JSON fallback.
   */
  private static async getBeneficiary(beneficiaryId: string): Promise<Beneficiary | null> {
    try {
      const b = await DbRepo.getBeneficiaryById(beneficiaryId);
      return b || null;
    } catch (e) {
      console.error(`[DocumentService] Error finding beneficiary ${beneficiaryId}:`, e);
      return null;
    }
  }

  /**
   * Generates a new versioned document for a beneficiary, uploads to Cloudinary, and registers it.
   */
  static async generateDocument(
    beneficiaryId: string,
    documentType: DocumentType,
    generatedBy: string,
    forceNewVersion: boolean = false
  ): Promise<GeneratedDocument> {
    const beneficiary = await this.getBeneficiary(beneficiaryId);
    if (!beneficiary) {
      throw new Error(`Beneficiary with ID ${beneficiaryId} not found.`);
    }

    // 1. Determine next version number
    const latestVersion =
      await DbRepo.getLatestDocumentVersion(
        beneficiaryId,
        documentType
      );

    const nextVersion =
      latestVersion === 0
        ? 1
        : forceNewVersion
          ? latestVersion + 1
          : latestVersion;

    // 1.5 Generate unique verification properties and lookup watermark configs
    let prefix = "TVET-DOC";
    switch (documentType) {
      case DocumentType.ADMISSION_LETTER:
        prefix = "TVET-ADM";
        break;
      case DocumentType.ACCEPTANCE_LETTER:
        prefix = "TVET-ACC";
        break;
      case DocumentType.ADMISSION_FORM:
        prefix = "TVET-FRM";
        break;
      case DocumentType.PHOTO_ALBUM:
        prefix = "TVET-ALB";
        break;
      case DocumentType.ENROLLMENT_CONFIRMATION:
        prefix = "TVET-ENR";
        break;
      case DocumentType.COMPLETION_CERTIFICATE:
        prefix = "TVET-CRT";
        break;
    }
    const hex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, "0");
    const verificationCode = `${prefix}-${hex}`;

    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify-document?code=${verificationCode}`;
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(verificationUrl);
    } catch (e) {
      console.error("[DocumentService] Failed to generate validation QR Code:", e);
    }

    let watermarkText = "SECURED REGISTRY";
    let watermarkEnabled = false;
    try {
      const settings = await DbRepo.getOrganizationSettings();
      if (settings) {
        watermarkText = settings.watermarkText || "SECURED REGISTRY";
        watermarkEnabled = !!settings.watermarkEnabled;
      }
    } catch (e) {
      console.error("[DocumentService] Failed to load organization settings for watermark:", e);
    }

    const meta = {
      watermarkText,
      watermarkEnabled,
      qrDataUrl,
      verificationCode,
    };

    // 2. Generate the PDF buffer depending on type
    let pdfBuffer: Buffer;
    switch (documentType) {
      case DocumentType.ADMISSION_LETTER:
        pdfBuffer = await PdfService.generateAdmissionLetterPdf(beneficiary, meta);
        break;
      case DocumentType.ACCEPTANCE_LETTER:
        pdfBuffer = await PdfService.generateAcceptanceLetterPdf(beneficiary, meta);
        break;
      case DocumentType.ADMISSION_FORM:
        pdfBuffer = await PdfService.generateAdmissionFormPdf(beneficiary, meta);
        break;
      case DocumentType.PHOTO_ALBUM:
        pdfBuffer = await PdfService.generatePhotoAlbumPdf(beneficiary, meta);
        break;
      case DocumentType.ENROLLMENT_CONFIRMATION:
        pdfBuffer = await PdfService.generateEnrollmentConfirmationPdf(beneficiary, meta);
        break;
      case DocumentType.COMPLETION_CERTIFICATE:
        pdfBuffer = await PdfService.generateCompletionCertificatePdf(beneficiary, meta);
        break;
      default:
        throw new Error(`Unsupported document type requested: ${documentType}`);
    }

    // 3. Upload to Cloudinary with metadata context
    const publicId = `beneficiary_${beneficiaryId}_${documentType.toLowerCase()}_v${nextVersion}`;
    const uploadResult = await CloudinaryService.uploadDocument(pdfBuffer, publicId);
    const pdfUrl = uploadResult || `https://res.cloudinary.com/simulation/image/upload/${publicId}.pdf`;

    // 4. Create and register GeneratedDocument model
    const docId = `gdoc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newDoc: GeneratedDocument = {
      id: docId,
      beneficiaryId,
      documentType,
      version: nextVersion,
      pdfUrl,
      generatedBy,
      createdAt: new Date().toISOString(),
      verificationCode,
      verificationStatus: "UNVERIFIED",
      verificationDate: "",
      emailDeliveryStatus: "NOT_SENT",
    };

    const registered = await DbRepo.saveGeneratedDocument(newDoc);
    if (!registered) {
      throw new Error(`Failed to save generated document record for ${documentType} in the database.`);
    }

    // If it's a new version, log audit trail
    const actionType = latestVersion === 0 ? "DOC_GENERATE" : "DOC_REGENERATE";
    await DocumentService.logAuditAction(
      generatedBy,
      actionType,
      `Generated ${documentType} (v${nextVersion}) for candidate ${beneficiary.firstName} ${beneficiary.lastName}. Url: ${pdfUrl}`
    );

    return newDoc;
  }

  /**
   * Regenerates a document, explicitly advancing the version number.
   */
  static async regenerateDocument(
    beneficiaryId: string,
    documentType: DocumentType,
    generatedBy: string
  ): Promise<GeneratedDocument> {
    return await this.generateDocument(beneficiaryId, documentType, generatedBy, true);
  }

  /**
   * Retrieves all generated document history for a beneficiary, structured by type.
   */
  static async getDocumentHistory(beneficiaryId: string): Promise<GeneratedDocument[]> {
    return await DbRepo.getGeneratedDocuments(beneficiaryId);
  }

  /**
   * Dispatches a versioned document PDF to the candidate's verified email address.
   */
  static async sendDocumentEmail(
    documentId: string,
    recipientEmail?: string
  ): Promise<{ success: boolean; message: string }> {
    // Set status to Pending at email start
    try {
      await DbRepo.updateGeneratedDocumentEmailStatus(documentId, "Pending");
    } catch (e) {
      console.error("[DocumentService] Failed to set delivery status to Pending:", e);
    }

    // 1. Locate the document record
    const pool = (global as any)._pgPool;
    let doc: GeneratedDocument | null = null;

    if (pool) {
      try {
        const res = await pool.query(
          "SELECT id, beneficiary_id, document_type, version, pdf_url, docx_url, generated_by, created_at, verification_code, verification_status, verification_date, email_delivery_status FROM generated_documents WHERE id = $1",
          [documentId]
        );
        if (res.rows.length > 0) {
          const r = res.rows[0];
          doc = {
            id: r.id,
            beneficiaryId: r.beneficiary_id,
            documentType: r.document_type as DocumentType,
            version: r.version,
            pdfUrl: r.pdf_url,
            docxUrl: r.docx_url || undefined,
            generatedBy: r.generated_by,
            createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
            verificationCode: r.verification_code || undefined,
            verificationStatus: r.verification_status || undefined,
            verificationDate: r.verification_date || undefined,
            emailDeliveryStatus: r.email_delivery_status || undefined,
          };
        }
      } catch (e) {
        console.error("[DocumentService] Failed to load generated document of id:", documentId, e);
      }
    }

    // Fallback if postgres is offline
    if (!doc) {
      const state = (require("./db").loadJsonState)() as any;
      const jsonDoc = (state.generatedDocuments || []).find((d: any) => d.id === documentId);
      if (jsonDoc) {
        doc = jsonDoc;
      }
    }

    if (!doc) {
      try {
        await DbRepo.updateGeneratedDocumentEmailStatus(documentId, "Failed");
      } catch (dbErr) {}
      throw new Error(`Generated document record of ID ${documentId} is missing.`);
    }

    // 2. Fetch target beneficiary details
    const beneficiary = await this.getBeneficiary(doc.beneficiaryId);
    if (!beneficiary) {
      try {
        await DbRepo.updateGeneratedDocumentEmailStatus(documentId, "Failed");
      } catch (dbErr) {}
      throw new Error(`Beneficiary for document ${documentId} cannot be verified.`);
    }

    const emailToDeliver = recipientEmail || beneficiary.email;
    if (!emailToDeliver) {
      try {
        await DbRepo.updateGeneratedDocumentEmailStatus(documentId, "Failed");
      } catch (dbErr) {}
      throw new Error(`No recipient email address is configured for beneficiary ${beneficiary.id}.`);
    }

    // 3. Compose elegant document dispatch email
    const subject = `Official IDEAS-TVET Document Issued - ${doc.documentType.replace(/_/g, " ")}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 6px;">
        <div style="text-align: center; border-bottom: 2px solid #008751; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="color: #008751; margin: 0;">IDEAS-TVET Programme</h2>
          <p style="font-size: 11px; margin: 4px 0 0 0; color: #475569; font-weight: bold; text-transform: uppercase;">Central Admissions & Registry Hub</p>
        </div>
        
        <p>Dear <strong>${beneficiary.firstName} ${beneficiary.lastName}</strong>,</p>
        
        <p>An official document has been published and assigned to your trainee profile registry:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; background: #f8fafc; border: 1px solid #e2e8f0; width: 140px;">Document Type:</td>
            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #008751;">${doc.documentType.replace(/_/g, " ")}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; background: #f8fafc; border: 1px solid #e2e8f0;">Registered Version:</td>
            <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-family: monospace;">v${doc.version}</td>
          </tr>
          <tr>
            <td style="padding: 6px 10px; font-weight: bold; background: #f8fafc; border: 1px solid #e2e8f0;">Issued Date/Time:</td>
            <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${new Date(doc.createdAt).toLocaleString("en-GB")}</td>
          </tr>
        </table>
        
        <p style="margin: 20px 0; text-align: center;">
          <a href="${doc.pdfUrl}" target="_blank" style="background-color: #008751; color: white; padding: 10px 22px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">
            Download Published Document PDF
          </a>
        </p>
        
        <p style="font-size: 11px; color: #64748b; line-height: 1.4; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">
          This is an automated delivery from Kano State TVET board admissions team. If you did not registers, please discard this message.
        </p>
      </div>
    `;

    // 4. Send via EmailService
    const outcome = await EmailService.sendEmail({
      recipient: emailToDeliver,
      subject,
      body: emailBody,
    });

    if (outcome.success) {
      try {
        await DbRepo.updateGeneratedDocumentEmailStatus(doc.id, "Delivered");
      } catch (dbErr) {
        console.error("Failed to update status to Delivered:", dbErr);
      }
      await DocumentService.logAuditAction(
        doc.generatedBy,
        "DOC_EMAIL_DELIVERY",
        `Sent ${doc.documentType} v${doc.version} to email ${emailToDeliver} (doc ID: ${doc.id})`
      );
      return { success: true, message: `Email dispatched successfully to ${emailToDeliver}.` };
    } else {
      try {
        await DbRepo.updateGeneratedDocumentEmailStatus(doc.id, "Failed");
      } catch (dbErr) {}
      throw new Error(`Email sender failed to deliver package to ${emailToDeliver}.`);
    }
  }

  /**
   * Internal auditor log helper
   */
  private static async logAuditAction(username: string, action: string, details: string) {
    try {
      const newLog = {
        id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        username,
        role: "Operations Manager",
        action,
        details,
      };
      await DbRepo.saveAuditLog(newLog);
    } catch (e) {
      console.error("[DocumentService Audit] Failed to record audit log:", e);
    }
  }
}
