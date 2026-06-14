import { DbRepo, getPgPool } from "./db";
import { EmailService } from "./email.service";
import { DocumentService } from "./document.service";
import { TokenService } from "./token.service";
import { DocumentType } from "../types";
import { buildPublicUrl } from "../config/api";

export interface CampaignConfig {
  campaignId: string;
  templateId?: string;
  sendPortalLink: boolean;
  attachments: string[]; // "ADMISSION_LETTER", "ACCEPTANCE_LETTER", etc.
  actor: string;
  actorRole: string;
  ipAddress?: string;
}

// Simple in-memory active jobs tracking for real-time progress updates & cancelling control
export const activeCampaignWorkers = new Map<string, {
  isCancelled: boolean;
  total: number;
  processed: number;
  success: number;
  failed: number;
}>();

export class EmailCampaignQueue {
  /**
   * Main entry point to queue a campaign and begin processing in the background.
   */
  static queueCampaign(config: CampaignConfig): void {
    // Run in background without blocking Express response
    setTimeout(async () => {
      try {
        await this.processCampaign(config);
      } catch (err) {
        console.error(`[EmailCampaignQueue] Campaign ${config.campaignId} failed processing:`, err);
      }
    }, 0);
  }

  /**
   * Background process execution loop.
   */
  private static async processCampaign(config: CampaignConfig): Promise<void> {
    const { campaignId, templateId, sendPortalLink, attachments, actor, actorRole, ipAddress } = config;

    console.log(`[EmailCampaignQueue] Started background processing for campaign: ${campaignId}`);
    
    // Set status to RUNNING
    const campaign = await DbRepo.getCommunicationCampaignById(campaignId);
    if (!campaign) {
      console.error(`[EmailCampaignQueue] Campaign with ID ${campaignId} not found.`);
      return;
    }

    campaign.status = "RUNNING";
    campaign.startedAt = new Date().toISOString();
    await DbRepo.saveCommunicationCampaign(campaign);

    // Audit Log: Started
    await DbRepo.saveAuditLog({
      id: require("crypto").randomUUID(),
      timestamp: new Date().toISOString(),
      username: actor,
      role: actorRole,
      action: "CAMPAIGN_STARTED",
      details: `Communication campaign "${campaign.campaignName}" started. Target size: ${campaign.totalRecipients || 0}`,
      ipAddress: ipAddress || null
    });

    const recipients = await DbRepo.getCommunicationRecipients(campaignId);
    const pendingRecipients = recipients.filter(r => r.status === "PENDING" || r.status === "QUEUED");
    
    // Track execution counts
    const trackingState = {
      isCancelled: false,
      total: recipients.length,
      processed: recipients.length - pendingRecipients.length,
      success: recipients.filter(r => r.status === "SENT").length,
      failed: recipients.filter(r => r.status === "FAILED").length,
    };
    activeCampaignWorkers.set(campaignId, trackingState);

    // Fetch Template
    let template: any = null;
    if (templateId) {
      const templates = await DbRepo.getCommunicationTemplates();
      template = templates.find(t => t.id === templateId);
    }

    if (!template) {
      // Default fallback template if none selected or found
      template = {
        subject: "IDEAS-TVET Programme Communication Notification",
        htmlBody: `
          <div style="font-family: Arial, sans-serif; padding: 25px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #312e81; padding: 20px; color: white; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="margin:0;">IDEAS-TVET Hub Notification</h2>
            </div>
            <div style="padding: 25px; line-height: 1.6; color: #1e293b;">
              <p>Dear {{firstName}} {{lastName}},</p>
              <p>You have a new update concerning your registration on the IDEAS-TVET skill enhancement cohort.</p>
              {{portalLinkBlock}}
              <p>Please check the attachments for formal details regarding your enrollment.</p>
            </div>
          </div>
        `
      };
    }

    // Process consecutively to be respectful of third-party API limits (Resend rate limits, PDF Puppeteer resources)
    for (const recipient of pendingRecipients) {
      // Check cancel directive
      const latestTrackState = activeCampaignWorkers.get(campaignId);
      if (latestTrackState?.isCancelled) {
        console.log(`[EmailCampaignQueue] Campaign ${campaignId} cancelled by admin user.`);
        campaign.status = "CANCELLED";
        campaign.completedAt = new Date().toISOString();
        await DbRepo.saveCommunicationCampaign(campaign);
        
        await DbRepo.saveAuditLog({
          id: require("crypto").randomUUID(),
          timestamp: new Date().toISOString(),
          username: actor,
          role: actorRole,
          action: "CAMPAIGN_CANCELLED",
          details: `Communication campaign "${campaign.campaignName}" cancelled. Final progress: ${trackingState.success} sent, ${trackingState.failed} failed.`,
          ipAddress: ipAddress || null
        });
        return;
      }

      console.log(`[EmailCampaignQueue] Processing Campaign Recipient: ${recipient.email} for beneficiary ${recipient.beneficiaryId}`);
      
      try {
        // Fetch beneficiary details
        const beneficiary = await DbRepo.getBeneficiaryById(recipient.beneficiaryId);
        if (!beneficiary) {
          throw new Error("Beneficiary record not found in registered rosters");
        }

        // 1. Compile variables
        const firstName = beneficiary.firstName || "";
        const lastName = beneficiary.lastName || "";
        const email = recipient.email;

        // Custom domain for portal links (Vite preview has current origin or we use default dev url)
        const customDomain = buildPublicUrl("");
        const tokenVersion = beneficiary.tokenVersion || 1;
        const secureToken = TokenService.generateToken(beneficiary.id, tokenVersion);
        const secureLink = `${customDomain}/?token=${secureToken}`;

        // Replace template placeholders
        let subject = template.subject
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{id\}\}/g, beneficiary.id);

        let htmlBody = template.htmlBody
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{email\}\}/g, email)
          .replace(/\{\{id\}\}/g, beneficiary.id);

        const portalLinkBlock = sendPortalLink
          ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${secureLink}" style="background-color: #22c55e; color: white; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block;">
                Open Secure Response Portal
              </a>
              <p style="font-size: 11px; color: #64748b; margin-top: 8px;">Direct Link: <a href="${secureLink}">${secureLink}</a></p>
            </div>
          `
          : "";

        htmlBody = htmlBody.replace(/\{\{portalLinkBlock\}\}/g, portalLinkBlock)
                           .replace(/\{\{secureLink\}\}/g, secureLink)
                           .replace(/\{\{portalLink\}\}/g, secureLink)
                           .replace(/\{\{tokenLink\}\}/g, secureLink);

        // 2. Attachments compiling with Document Reuse logic (Phase 6 & 7)
        const emailAttachments: Array<{ name: string; content: string; contentType: string }> = [];

        for (const attachType of attachments) {
          console.log(`[DocumentReuse] Evaluating attachment of type ${attachType} for beneficiary ${beneficiary.id}...`);
          let docType: DocumentType;

          if (attachType === "ADMISSION_LETTER") {
            docType = DocumentType.ADMISSION_LETTER;
          } else if (attachType === "ACCEPTANCE_LETTER" || attachType === "ACCEPTANCE_FORM") {
            docType = DocumentType.ACCEPTANCE_LETTER;
          } else if (attachType === "CERTIFICATE" || attachType === "COMPLETION_CERTIFICATE") {
            docType = DocumentType.COMPLETION_CERTIFICATE;
          } else {
            // Unrecognized or other
            continue;
          }

          // Check if there is an active document in registry
          const existingDocs = await DbRepo.getGeneratedDocuments(beneficiary.id);
          const activeDoc = existingDocs.find(
            d => d.document_type === docType && d.document_status === "ACTIVE"
          );

          let pdfBase64 = "";
          let fileName = `${beneficiary.id}_${docType.toLowerCase()}.pdf`;

          if (activeDoc) {
            console.log(`[DocumentReuse] Match found: Reusing existing active registered document code=${activeDoc.verification_code} (${activeDoc.pdf_url})`);
            try {
              // Fetch file from URL and convert to Base64
              pdfBase64 = await this.downloadPdfAsBase64(activeDoc.pdf_url);
              fileName = `${beneficiary.id}_${docType.toLowerCase()}_v${activeDoc.version || 1}.pdf`;
            } catch (dlErr: any) {
              console.error(`[DocumentReuse] Failed to reuse existing document from ${activeDoc.pdf_url}. Generating fallback:`, dlErr.message);
              // Fallback generate new version
              const newReg = await DocumentService.generateDocumentWithBuffer(beneficiary.id, docType, "SYSTEM_CAMPAIGN", true);
              pdfBase64 = newReg.pdfBuffer.toString("base64");
              fileName = `${beneficiary.id}_${docType.toLowerCase()}_v${newReg.document.version}.pdf`;
            }
          } else {
            console.log(`[DocumentReuse] No active matching document registry found. Compiling new versioned document...`);
            const newReg = await DocumentService.generateDocumentWithBuffer(beneficiary.id, docType, "SYSTEM_CAMPAIGN", true);
            pdfBase64 = newReg.pdfBuffer.toString("base64");
            fileName = `${beneficiary.id}_${docType.toLowerCase()}_v${newReg.document.version}.pdf`;
          }

          if (pdfBase64) {
            emailAttachments.push({
              name: fileName,
              content: pdfBase64.includes(",") ? pdfBase64 : `data:application/pdf;base64,${pdfBase64}`,
              contentType: "application/pdf"
            });
          }
        }

        // 3. Dispatch Email
        const dispatchResult = await EmailService.sendCampaignEmail(email, subject, htmlBody, emailAttachments);

        if (dispatchResult.success) {
          await DbRepo.updateRecipientStatus(recipient.id, "SENT");
          trackingState.success++;
        } else {
          throw new Error(dispatchResult.errorDetails || "SMTP transmission failure");
        }

      } catch (procErr: any) {
        console.error(`[EmailCampaignQueue] Failed delivering to ${recipient.email}:`, procErr.message);
        await DbRepo.updateRecipientStatus(recipient.id, "FAILED", procErr.message);
        trackingState.failed++;
      } finally {
        trackingState.processed++;
        activeCampaignWorkers.set(campaignId, trackingState);
        
        // Progress update to DB
        await DbRepo.updateCampaignCounts(campaignId, trackingState.success, trackingState.failed, "RUNNING");
      }
    }

    // Complete Campaign and Audit
    console.log(`[EmailCampaignQueue] Finished processing campaign ID ${campaignId}. Success: ${trackingState.success}, Failed: ${trackingState.failed}`);
    activeCampaignWorkers.delete(campaignId);

    campaign.status = "COMPLETED";
    campaign.completedAt = new Date().toISOString();
    campaign.successCount = trackingState.success;
    campaign.failedCount = trackingState.failed;
    await DbRepo.saveCommunicationCampaign(campaign);

    // Audit Log: Completed
    await DbRepo.saveAuditLog({
      id: require("crypto").randomUUID(),
      timestamp: new Date().toISOString(),
      username: actor,
      role: actorRole,
      action: "CAMPAIGN_COMPLETED",
      details: `Communication campaign "${campaign.campaignName}" finished. Successful delivery: ${trackingState.success}, Failed inputs: ${trackingState.failed}.`,
      ipAddress: ipAddress || null
    });
  }

  /**
   * Helper function to download an existing PDF from Cloudinary CDN to bundle as base64 content
   */
  private static async downloadPdfAsBase64(url: string): Promise<string> {
    const fetchWithNode = globalThis.fetch;
    const response = await fetchWithNode(url);
    if (!response.ok) {
      throw new Error(`Cloudinary file download returned raw status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  }
}
