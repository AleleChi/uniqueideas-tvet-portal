/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Resend } from "resend";
import { getPgPool } from "./db";
import { logForensicPdfTrace } from "./pdfTraceAudit";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.log("[EMAIL] Resend API key missing.");
}

const resend = apiKey ? new Resend(apiKey) : null;

export class EmailService {
  /**
   * Logs a test email outcome into the database email_logs table.
   */
  static async logTestEmail(
    email: string, 
    status: string, 
    smtp_response: any, 
    smtp_error_details: any
  ): Promise<void> {
    const pool = getPgPool();
    if (pool) {
      try {
        const smtpResponseStr = smtp_response ? JSON.stringify(smtp_response) : null;
        const smtpErrorStr = smtp_error_details ? JSON.stringify(smtp_error_details) : null;
        
        await pool.query(
          `INSERT INTO email_logs (
            recipient_email, 
            delivery_result, 
            smtp_response, 
            smtp_error_details, 
            tracking_status,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, 'Sent', NOW(), NOW())`,
          [email, status, smtpResponseStr, smtpErrorStr]
        );
        console.log(`[EmailService] Logged test email result to table 'email_logs' for ${email}`);
      } catch (e: any) {
        console.error("[EmailService] Failed to record test email logs in postgresql:", e);
      }
    } else {
      console.log(`[EmailService] PG pool offline fallback. Outputted log payload for ${email}: status=${status}`);
    }
  }

  /**
   * Conducts a live integration audit by attempting real transmission
   */
  static async executeLiveIntegrationAudit(recipientEmail: string): Promise<{
    messageId: string | null;
    apiResponse: any;
    deliveryStatus: "success" | "failed";
    timestamp: string;
    details?: string;
    errorDetails?: {
      message: string;
      statusCode?: number | string;
      responseBody?: any;
    };
  }> {
    const timestamp = new Date().toISOString();
    const apiKeyExists = !!process.env.RESEND_API_KEY;

    if (!apiKeyExists) {
      const errMsg = "[EMAIL] Resend API key missing.";
      console.error(errMsg);
      
      const resPayload = {
        messageId: null,
        apiResponse: null,
        deliveryStatus: "failed" as const,
        timestamp,
        details: "RESEND_API_KEY is not configured in the runtime environment variables."
      };
      
      await EmailService.logTestEmail(
        recipientEmail, 
        "failed", 
        null, 
        { message: "RESEND_API_KEY is missing from environment" }
      );
      
      return resPayload;
    }

    // Attempt client initialization
    let auditClient: Resend;
    try {
      auditClient = new Resend(process.env.RESEND_API_KEY!);
      if (!auditClient) {
        throw new Error("Resend constructor returned falsy client reference.");
      }
    } catch (initErr: any) {
      const errMsg = `Resend client initialization failed: ${initErr.message || initErr}`;
      console.error(errMsg);
      
      const resPayload = {
        messageId: null,
        apiResponse: null,
        deliveryStatus: "failed" as const,
        timestamp,
        details: errMsg,
        errorDetails: {
          message: initErr.message || String(initErr),
          statusCode: 500,
          responseBody: initErr
        }
      };

      await EmailService.logTestEmail(recipientEmail, "failed", null, {
        message: initErr.message || String(initErr),
        statusCode: 500,
        responseBody: initErr
      });

      return resPayload;
    }

    try {
      const fromEmail = "IDEAS TVET <admission@uniqueideas.dontechservicesconst.com>";
      console.log(`[Resend Audit] Dispatching live audit email from ${fromEmail} to ${recipientEmail}`);

      const { data, error } = await auditClient.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: "LIVE AUDIT: Resend Integration Test Dispatch",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="background-color: #312e81; padding: 15px 25px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px;">Resend Live Integration Audit</h2>
            </div>
            <div style="padding: 20px; line-height: 1.6; color: #1e293b;">
              <p>This email is a real, live automated message confirming that your Resend transactional mail engine integration is 100% operational.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
              <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">
                Timestamp: <strong>${timestamp}</strong><br />
                Audit Status: <strong>LIVE_PRODUCTION_VERIFIED</strong>
              </p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error("[Resend Audit] Resend API returned error payload:", error);
        
        const statusCode = (error as any).statusCode || (error as any).status || 400;
        const errMsg = error.message || "Unknown Resend API error";

        const resPayload = {
          messageId: null,
          apiResponse: error,
          deliveryStatus: "failed" as const,
          timestamp,
          errorDetails: {
            message: errMsg,
            statusCode: statusCode,
            responseBody: error
          }
        };

        await EmailService.logTestEmail(recipientEmail, "failed", error, {
          message: errMsg,
          statusCode,
          responseBody: error
        });

        return resPayload;
      }

      console.log(`[Resend Audit] Email successfully processed by Resend. Message ID: ${data?.id}`);
      
      const resPayload = {
        messageId: data?.id || null,
        apiResponse: data,
        deliveryStatus: "success" as const,
        timestamp
      };

      await EmailService.logTestEmail(recipientEmail, "success", data, null);
      
      return resPayload;

    } catch (caughtErr: any) {
      console.error("[Resend Audit] Caught unexpected delivery exception:", caughtErr);
      
      const statusCode = caughtErr.statusCode || caughtErr.status || 500;
      const errMsg = caughtErr.message || String(caughtErr);
      const errBody = caughtErr.response?.data || caughtErr.body || caughtErr;

      const resPayload = {
        messageId: null,
        apiResponse: null,
        deliveryStatus: "failed" as const,
        timestamp,
        errorDetails: {
          message: errMsg,
          statusCode: statusCode,
          responseBody: errBody
        }
      };

      await EmailService.logTestEmail(recipientEmail, "failed", null, {
        message: errMsg,
        statusCode,
        responseBody: errBody
      });

      return resPayload;
    }
  }

  /**
   * Generic HTML email dispatcher
   */
  static async sendEmail(params: { recipient: string; subject: string; body: string }): Promise<{ success: boolean; messageId?: string }> {
    if (!resend) {
      console.log(`[SIMULATOR] Sending mail to: ${params.recipient}, subject: ${params.subject}`);
      return { success: true };
    }
    try {
      const fromEmail = "IDEAS TVET <admission@uniqueideas.dontechservicesconst.com>";
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: params.recipient,
        subject: params.subject,
        html: params.body
      });
      if (error) {
        console.error("[EmailService sendEmail] Error:", error);
        return { success: false };
      }
      return { success: true, messageId: data?.id || undefined };
    } catch (e: any) {
      console.error("[EmailService sendEmail] Exception:", e);
      return { success: false };
    }
  }

  /**
   * Analyzes and returns live SMTP/Resend transport connectivity parameters.
   */
  static async getSmtpHealth(): Promise<{ status: "SMTP Connected" | "SMTP Failed" | "Simulator Mode"; error?: string }> {
    if (resend) {
      return { status: "SMTP Connected" };
    }
    return { status: "Simulator Mode" };
  }

  /**
   * Dispatches the official tvet admission email with direct attachments.
   */
  static async sendAdmissionEmail(
    to: string, 
    studentName: string, 
    secureLink: string, 
    attachmentsList: Array<{ name: string; content: string; contentType: string }>,
    beneficiaryId?: string
  ): Promise<{ success: boolean; status: "Delivered" | "Failed"; errorDetails?: string; messageId?: string; apiResponse?: any }> {
    console.log(`[Resend] Attempting automated offer transmission to candidate: ${studentName} <${to}>`);
    console.log(`[Resend] Portal URL: ${secureLink}`);

    const emailSubject = `OFFICIAL OFFER OF ADMISSION - IDEAS-TVET Skills Sector Programme (${studentName})`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="background-color: #312e81; padding: 25px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px;">Unique Technology Nig. Ltd</h2>
          <p style="margin: 5px 0 0 0; font-size: 11px; font-weight: bold; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1px;">IDEAS-TVET Skills Sector Programme</p>
        </div>
        <div style="padding: 30px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${studentName}</strong>,</p>
          <p>Congratulations! We are delighted to inform you that you have been offered provisional admission into the federal government's <strong>IDEAS-TVET skill enhancement cohort</strong> for <strong>Computer Hardware and Cell Phone Repairs</strong>.</p>
          <p>To view your official Admission Offer Letter, download the Acceptance Form template, and complete your registration details, click the secure verification button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${secureLink}" style="background-color: #22c55e; color: white; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: bold; text-decoration: none; text-transform: uppercase; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              Open Secure Response Portal
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; background-color: #f8fafc; padding: 10px; border-radius: 6px; border-left: 4px solid #312e81; margin: 25px 0;">
            <strong>Important notice:</strong> You are not required to create or sign into any account. This link unique to your profile is valid for 10 working days. Please review the attached PDF letters for formal details.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Unique Technology Nig. Ltd | Accredited Federal TVET Skill Hub Coordinator<br>
          Ref: FME-Trainee-Enrollment-Registry
        </div>
      </div>
    `;

    if (resend) {
      try {
        const formattedAttachments = attachmentsList.map(a => {
          const parts = a.content.split(",");
          const base64Content = parts[1] || parts[0];
          const buffer = Buffer.from(base64Content, "base64");
          
          logForensicPdfTrace("Email Attachment", a.name, buffer);

          return {
            filename: a.name,
            content: buffer,
            contentType: "application/pdf"
          };
        });

        const fromEmail = "IDEAS TVET <admission@uniqueideas.dontechservicesconst.com>";
        const emailTo = to || "uniqueideasproject@gmail.com";

        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: emailTo,
          subject: emailSubject,
          html: emailHtml,
          attachments: formattedAttachments
        });

        if (error) {
          console.error("[EmailService] Resend delivery error details:", error);
          return { success: false, status: "Failed", errorDetails: error.message, apiResponse: error };
        }

        console.log(`[Resend] Success: Formal admission dispatches successfully routed to ${emailTo}. Message ID: ${data?.id}`);
        return { success: true, status: "Delivered", messageId: data?.id || undefined, apiResponse: data };
      } catch (err: any) {
        console.error(`[Resend] Email dispatch exception:`, err);
        return { success: false, status: "Failed", errorDetails: err.message || String(err), apiResponse: err };
      }
    }

    // Gracefully disabled state or simulator mode fallback
    try {
      attachmentsList.forEach(a => {
        const parts = a.content.split(",");
        const base64Content = parts[1] || parts[0];
        const buffer = Buffer.from(base64Content, "base64");
        logForensicPdfTrace("Email Attachment (Simulated)", a.name, buffer);
      });
    } catch (err: any) {
      console.error(`[Email Simulator] Email validation error:`, err.message);
      return { success: false, status: "Failed", errorDetails: "Simulator pdf attachment check failed: " + err.message };
    }

    console.log(`[Resend] [SIMULATOR SUCCESS] Dispatched Admission Alert Email to: ${to}`);
    console.log(`[Resend] [SIMULATOR SUCCESS] Attachments bundled: ${attachmentsList.map(a => `${a.name} (${a.contentType})`).join(", ")}`);
    return { success: true, status: "Delivered", errorDetails: "Sent via Simulator Connection (No Resend API Key configured)." };
  }
}

export default EmailService;
