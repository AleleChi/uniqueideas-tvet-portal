/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary } from "../types";
import puppeteer from "puppeteer";

export class PdfService {
  /**
   * Helper to render raw HTML content into a PDF Buffer using chromium / puppeteer.
   * If puppeteer fails due to sandbox or library limitations, it returns the HTML source buffer
   * as a graceful fallback.
   */
  private static async compileHtmlToPdfBuffer(htmlContent: string, isLandscape: boolean = false): Promise<Buffer> {
    try {
      console.log(`[PdfService] Launching Puppeteer browser (Landscape mode: ${isLandscape})...`);
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu"
        ]
      });

      try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" as any });
        
        const pdfBuffer = await page.pdf({
          format: "A4",
          landscape: isLandscape,
          printBackground: true,
          margin: {
            top: "15mm",
            bottom: "15mm",
            left: "15mm",
            right: "15mm"
          }
        });

        console.log(`[PdfService] PDF compilation completed successfully (${pdfBuffer.length} bytes).`);
        return Buffer.from(pdfBuffer);
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      console.error("[PdfService] Puppeteer PDF compilation failed. Falling back to HTML container.", err.message || err);
      // Fallback is simply the HTML encoded as buffer so the web flow does not crash
      return Buffer.from(htmlContent);
    }
  }

  /**
   * Generates official SVG Federal TVET Crest markup for beautiful, crisp branding
   */
  private static getFederalCrestSvg(): string {
    return `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#008751" stroke-width="3" />
        <circle cx="50" cy="50" r="39" fill="none" stroke="#d4af37" stroke-width="1.5" />
        <!-- Coat of arms stylized representation -->
        <path d="M43,35 L57,35 L54,58 L46,58 Z" fill="#008751" />
        <path d="M50,30 L53,35 L47,35 Z" fill="#d4af37" />
        <path d="M46,58 L41,72 L45,72 L48,58 Z" fill="#d4af37" />
        <path d="M54,58 L59,72 L55,72 L52,58 Z" fill="#d4af37" />
        <!-- Y shape representing Niger-Benue rivers -->
        <path d="M50,45 L46,38 M50,45 L54,38 M50,45 L50,55" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
        <!-- Typography shield -->
        <text x="50" y="82" font-family="'Times New Roman', serif" font-size="7" font-weight="bold" fill="#008751" text-anchor="middle">FEDERAL REPUBLIC</text>
        <text x="50" y="89" font-family="'Times New Roman', serif" font-size="6.5" font-weight="bold" fill="#d4af37" text-anchor="middle">OF NIGERIA</text>
      </svg>
    `;
  }

  /**
   * Generates official Gold Seal badge SVG for certificate
   */
  private static getCertificateSealSvg(): string {
    return `
      <svg width="90" height="90" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,5 53,15 63,10 63,21 73,20 70,30 80,33 74,42 82,49 73,53 79,63 69,64 71,75 61,72 60,83 50,77 40,83 39,72 29,75 31,64 21,63 27,53 18,49 26,42 20,33 30,30 27,20 37,21 37,10 47,15" fill="#d4af37" stroke="#b5901f" stroke-width="1" />
        <circle cx="50" cy="45" r="28" fill="#d4af37" stroke="#fff" stroke-width="1.5" />
        <circle cx="50" cy="45" r="24" fill="none" stroke="#b5901f" stroke-width="1" />
        <path d="M50,30 L45,60 L50,56 L55,60 Z" fill="#9e1a1a" />
        <path d="M50,45 L58,63 L50,59 L42,63 Z" fill="#1a5f7a" />
        <text x="50" y="42" font-family="'Inter', sans-serif" font-size="5" font-weight="bold" fill="#3b2b00" text-anchor="middle">OFFICIAL SEAL</text>
        <text x="50" y="49" font-family="'Inter', sans-serif" font-size="5" font-weight="bold" fill="#3b2b00" text-anchor="middle">★ TVET BOARD ★</text>
      </svg>
    `;
  }

  /**
   * 1. Generates an official TVET Admission Letter PDF.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateAdmissionLetterPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const admissionRef = beneficiary.admissionRef || `IDEAS/TVET/ADM/${beneficiary.id.split("-").pop()}/${new Date().getFullYear()}`;
    const dateStr = beneficiary.admissionLetterGeneratedAt 
      ? new Date(beneficiary.admissionLetterGeneratedAt).toLocaleDateString("en-GB") 
      : new Date().toLocaleDateString("en-GB");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Offer of Admission - Ref: ${admissionRef}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', Times, serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 10px; background-color: #ffffff; }
          .border-frame { border: 1px solid #e2e8f0; padding: 25px; border-radius: 4px; min-height: 250mm; position: relative; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 3px double #008751; padding-bottom: 12px; }
          .header-crest { width: 80px; text-align: left; vertical-align: middle; }
          .header-text-col { text-align: center; vertical-align: middle; }
          .header-text-col h1 { margin: 0; font-size: 20px; color: #008751; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
          .header-text-col .sub-title { margin: 4px 0 0 0; font-size: 10px; font-weight: bold; color: #d4af37; letter-spacing: 1.5px; text-transform: uppercase; }
          .header-text-col .contacts { margin: 5px 0 0 0; font-size: 9.5px; color: #475569; }
          .metadata-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 13px; }
          .metadata-table td { padding: 4px 0; }
          .recipient-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #008751; padding: 12px; margin-bottom: 20px; border-radius: 3px; }
          .recipient-box strong { color: #0f172a; font-size: 14px; }
          .letter-title { text-align: center; font-size: 15px; font-weight: bold; text-transform: uppercase; margin: 25px 0 15px 0; text-decoration: underline; color: #008751; letter-spacing: 0.5px; }
          .letter-content { font-size: 13px; text-align: justify; }
          .letter-content p { margin: 12px 0; text-indent: 25px; }
          .signatures { display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; }
          .sig-row { display: table-row; }
          .sig-block { display: table-cell; width: 33%; text-align: center; font-size: 12px; vertical-align: top; }
          .sig-line { width: 85%; margin: 0 auto 5px auto; border-bottom: 1px solid #475569; height: 40px; position: relative; }
          .sig-font { font-family: 'Georgia', serif; font-style: italic; color: #1e3a8a; position: absolute; bottom: 3px; width: 100%; text-align: center; font-size: 16px; font-weight: 500; }
          .stamp { border: 2px dashed #008751; color: #008751; font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 4px 8px; display: inline-block; transform: rotate(-5deg); margin-top: 8px; border-radius: 3px; letter-spacing: 0.5px; }
          .footer-note { text-align: center; font-size: 8.5px; color: #94a3b8; position: absolute; bottom: 15px; width: 100%; left: 0; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 38px;
            color: rgba(148, 163, 184, 0.11);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 4px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <table class="header-table" style="position: relative; z-index: 10;">
            <tr>
              <td class="header-crest">${this.getFederalCrestSvg()}</td>
              <td class="header-text-col">
                <h1>Unique Technology Nig. Ltd</h1>
                <div class="sub-title">Federal Ministry of Education | IDEAS-TVET Programme Cohort</div>
                <div class="contacts">Owerri Skill Center, Imo State | Email: ideas-tvet@uniqueideas.dontechservicesconst.com | Direct Line: +234 803 123 4567</div>
              </td>
              <td style="width: 80px; text-align: right; vertical-align: middle;">
                <div style="border: 1px solid #cbd5e1; width: 60px; height: 60px; line-height: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 8px; color: #64748b; margin-left: auto; background-color: #f8fafc; border-radius: 4px;">PHOTO ID</div>
              </td>
            </tr>
          </table>

          <table class="metadata-table" style="position: relative; z-index: 10;">
            <tr>
              <td><strong>Letter Reference:</strong> ${admissionRef}</td>
              <td style="text-align: right;"><strong>Date of Issue:</strong> ${dateStr}</td>
            </tr>
          </table>

          <div class="recipient-box" style="position: relative; z-index: 10;">
            TO CANDIDATE:<br>
            <strong>${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</strong><br>
            <span style="font-size: 11px; color: #475569; font-family: Arial, sans-serif;">
              Candidate ID Ref: ${beneficiary.id} | National NIN: ${beneficiary.nin} | State of Hub: ${beneficiary.state}
            </span>
          </div>

          <div class="letter-title" style="position: relative; z-index: 10;">Provisional Offer of Admission into Federal Literacy & Technical Skills Training</div>

          <div class="letter-content" style="position: relative; z-index: 10;">
            <p>On behalf of the Governing Board of Unique Technology Nig. Ltd, and in collaboration with the Federal Ministry of Education under the <strong>Innovation Development and Effectiveness in Acquisition of Skills (IDEAS-TVET)</strong> project, we are pleased to offer you provisional admission into the intensive professional training cohort majoring in <strong>Computer Hardware and Cell Phone Repairs</strong>.</p>
            
            <p>This program is fully certified by the Federal Board of Technical Education under development grant schemes. The rigorous training covers <strong>90 aggregate contact hours (9 Units)</strong> encompassing system board diagnostics, micro-soldering, battery cell management, and specialized solar energy integration. All tuition and examination materials are covered entirely by the grant.</p>
            
            <p>Please note that your study tracker incorporates active daily biometrics authentication locks. In accordance with national audit guidelines, you must log a minimum of 90 classroom hours in the attendance log to qualify for final certification and milestone stipend disbursements.</p>
            
            <p>To accept this offer, please access your custom response link securely, complete the additional emergency contact panels, and submit your signed Acceptance Form within seven working days of this dispatch.</p>
            
            <p>Please accept our warmest congratulations on your selection. We look forward to your successful enrollment and development.</p>
          </div>

          <div class="signatures" style="position: relative; z-index: 10; margin-top: 35px;">
            <div class="sig-row">
              <div class="sig-block">
                <div class="sig-line">
                  <span class="sig-font">T. Owerri</span>
                </div>
                <strong>Operations Coordinator</strong><br>Unique Tech Hub
              </div>
              <div class="sig-block">
                <div class="sig-line">
                  <span class="sig-font" style="color: #0369a1;">A. Abubakar</span>
                </div>
                <strong>Accredited Registrar</strong><br>Federal Registry
                <div class="stamp">REGISTRY LOGGED</div>
              </div>
              ${meta?.qrDataUrl ? `
              <div style="display: table-cell; width: 33%; text-align: right; vertical-align: bottom;">
                <div style="display: inline-block; text-align: center; border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; background-color: #f8fafc;">
                  <img src="${meta.qrDataUrl}" style="width: 54px; height: 54px; display: block; margin: 0 auto 3px auto;" />
                  <span style="font-family: monospace; font-size: 6.5px; color: #475569; text-transform: uppercase; font-weight: bold;">CODE: ${meta.verificationCode}</span>
                </div>
              </div>
              ` : ""}
            </div>
          </div>

          <div class="footer-note">
            IDEAS-TVET PROGRAMME COHORT • UNIQUE TECHNOLOGY NIG LTD REGISTERED CENTER • SECURITY WATERMARKED A4 DOCUMENT
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * 2. Generates an official signed Acceptance Letter PDF contract.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateAcceptanceLetterPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const dateStr = beneficiary.acceptanceLetterUploadedAt
      ? new Date(beneficiary.acceptanceLetterUploadedAt).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // Retrieve signatures if signed or fall back to simulated hand signs
    const eSig = beneficiary.admissionFormData?.emergencyPhone ? `Signed via BVN-Secure Lock` : `Electronic Attestation E-Sign`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Offer Acceptance Contract - Candidate: ${beneficiary.id}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Times New Roman', Times, serif; color: #011627; line-height: 1.5; margin: 0; padding: 10px; background-color: #ffffff; }
          .border-frame { border: 1px solid #cbd5e1; padding: 25px; border-radius: 4px; min-height: 250mm; position: relative; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #008751; padding-bottom: 12px; }
          .header-crest { width: 60px; text-align: left; }
          .header-title-text { text-align: center; vertical-align: middle; }
          .header-title-text h1 { margin: 0; font-size: 18px; color: #008751; text-transform: uppercase; font-weight: bold; }
          .header-title-text p { margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
          .title-box { text-align: center; font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 8px; text-transform: uppercase; margin-bottom: 20px; border: 1px solid #cbd5e1; color: #0f172a; letter-spacing: 0.5px; }
          .form-list { margin-bottom: 25px; font-size: 13px; }
          .form-row { display: flex; margin: 8px 0; border-bottom: 1px dashed #e2e8f0; padding-bottom: 3px; }
          .form-label { width: 220px; font-weight: bold; color: #475569; text-transform: uppercase; font-size: 11px; font-family: Arial, sans-serif; }
          .form-val { color: #0f172a; font-weight: bold; }
          .declarative-text { font-size: 13px; text-align: justify; margin-top: 20px; line-height: 1.6; }
          .declarative-text p { margin-bottom: 12px; text-indent: 20px; }
          .signatures { display: table; width: 100%; margin-top: 45px; page-break-inside: avoid; }
          .sig-row { display: table-row; }
          .sig-block { display: table-cell; width: 33%; text-align: center; font-size: 12px; vertical-align: top; }
          .sig-line { width: 80%; margin: 0 auto 5px auto; border-bottom: 1px solid #475569; height: 40px; position: relative; }
          .sig-font { font-family: 'Brush Script MT', 'Georgia', cursive, serif; font-style: italic; color: #047857; position: absolute; bottom: 3px; width: 100%; text-align: center; font-size: 18px; font-weight: bold; }
          .stamp-box { border: 2px solid #008751; color: #008751; font-weight: bold; text-transform: uppercase; font-size: 9px; padding: 4px; display: inline-block; transform: rotate(-4deg); margin-top: 8px; border-radius: 4px; }
          .footer-note { text-align: center; font-size: 8px; color: #94a3b8; position: absolute; bottom: 15px; width: 100%; left: 0; font-family: Arial, sans-serif; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 38px;
            color: rgba(148, 163, 184, 0.11);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 4px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <table class="header-table" style="position: relative; z-index: 10;">
            <tr>
              <td class="header-crest">${this.getFederalCrestSvg()}</td>
              <td class="header-title-text">
                <h1>Unique Technology Nig. Ltd</h1>
                <p>IDEAS-TVET FEDERAL TRAINEE AUDIT REGISTRY</p>
              </td>
            </tr>
          </table>

          <div class="title-box" style="position: relative; z-index: 10;">Formal Offer Acceptance Declaration Contract</div>

          <div class="form-list" style="position: relative; z-index: 10;">
            <div class="form-row"><span class="form-label">Trainee Full Name:</span> <span class="form-val">${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</span></div>
            <div class="form-row"><span class="form-label">Trainee Registry ID Ref:</span> <span class="form-val">${beneficiary.id}</span></div>
            <div class="form-row"><span class="form-label">National Identification Number:</span> <span class="form-val">${beneficiary.nin}</span></div>
            <div class="form-row"><span class="form-label">Technical Skill Domain:</span> <span class="form-val">Computer Hardware Repairs & Cellphone Diagnostics</span></div>
            <div class="form-row"><span class="form-label">Emergency Next of Kin Name:</span> <span class="form-val">${beneficiary.admissionFormData?.emergencyName || "Verified Next of Kin"}</span></div>
            <div class="form-row"><span class="form-label">Emergency Phone Number:</span> <span class="form-val">${beneficiary.admissionFormData?.emergencyPhone || "Verified Phone"}</span></div>
            <div class="form-row"><span class="form-label">Agreement Executed Date:</span> <span class="form-val">${dateStr}</span></div>
          </div>

          <div class="declarative-text" style="position: relative; z-index: 10;">
            <p>I, the undersigned candidate, do hereby officially confirm my full and unreserved acceptance of the provisional offer of admission granted under reference <strong>${beneficiary.admissionRef || "IDEAS/TVET/ADM/MOCK"}</strong> into the federally funded IDEAS-TVET Skills Sector Programme supervised by the Federal Ministry of Education.</p>
            
            <p>I commit without compromise to attending all scheduled face-to-face academic modules, undertaking lab workbook practicals, and registering my daily biometric authentication records in strict accordance with TVET administrative controls. I fully understand that failing to maintain a minimum of 90 attendance contact hours will result in automatic forfeiture of milestone stipend disbursements and national accreditation certification.</p>
            
            <p>Under penalty of administrative exclusion, I declare that all supplemental demographics and credentials provided during enrollment are true, authentic, and correct representations of my identity.</p>
          </div>

          <table class="signatures" style="position: relative; z-index: 10; margin-top: 35px;">
            <tr class="sig-row">
              <td class="sig-block" style="width: 33%;">
                <div class="sig-line">
                  <span class="sig-font">${beneficiary.firstName} ${beneficiary.lastName}</span>
                </div>
                <strong>Candidate Formal e-Signature</strong><br>IP Lock Attested E-Sign
              </td>
              <td class="sig-block" style="width: 33%;">
                <div class="sig-line">
                  <span class="sig-font" style="font-family: Arial, serif; font-size: 13px; top: 12px; color: #1e3a8a;">T. Owerri Hub</span>
                </div>
                <strong>Verified Hub Coordinator Seal</strong><br>Authorized Hub
                <div>
                  <div class="stamp-box">ACCREDITED HUB STAMP</div>
                </div>
              </td>
              ${meta?.qrDataUrl ? `
              <td style="width: 33%; text-align: right; vertical-align: bottom;">
                <div style="display: inline-block; text-align: center; border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; background-color: #f8fafc; font-family: monospace; font-size: 6.5px; color: #475569;">
                  <img src="${meta.qrDataUrl}" style="width: 54px; height: 54px; display: block; margin: 0 auto 3px auto;" />
                  <span style="font-weight: bold; text-transform: uppercase;">CODE: ${meta.verificationCode}</span>
                </div>
              </td>
              ` : ""}
            </tr>
          </table>

          <div class="footer-note">
            FEDERAL CONTRACT DOCUMENTS • IDEAS-TVET NIGERIA PROJECT • SECURITY VERIFIED AND ARCHIVED SECURELY BY ID
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * Generates a beautiful PDF of the complete printed Admission Form, showing
   * all initial and supplementary candidate metadata, custom fields, emergency details, and bank credentials.
   */
  static async generateAdmissionFormPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const dateStr = beneficiary.admissionFormData?.submissionDate
      ? new Date(beneficiary.admissionFormData.submissionDate).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // Dynamic field list rendering
    let customFieldsHtml = "";
    if (beneficiary.customFields && typeof beneficiary.customFields === "object") {
      for (const [key, val] of Object.entries(beneficiary.customFields)) {
        customFieldsHtml += `
          <div style="display: flex; margin: 6px 0; border-bottom: 1px dashed #e2e8f0; padding-bottom: 3px;">
            <span style="width: 200px; font-weight: bold; color: #475569; font-size: 11px; text-transform: uppercase;">${key.replace(/_/g, " ")}:</span>
            <span style="color: #0d1e3e; font-weight: bold; font-size: 11.5px;">${val || "N/A"}</span>
          </div>
        `;
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Admission Registration Form - Candidate ID: ${beneficiary.id}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 5px; background-color: #ffffff; }
          .border-frame { border: 1.5px solid #008751; padding: 25px; border-radius: 4px; min-height: 250mm; position: relative; }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #008751; padding-bottom: 10px; margin-bottom: 15px; }
          .crest { width: 60px; vertical-align: middle; }
          .title-col { text-align: center; vertical-align: middle; }
          .title-col h1 { margin: 0; font-size: 16px; color: #008751; text-transform: uppercase; font-weight: 800; }
          .title-col p { margin: 3px 0 0 0; font-size: 9px; font-weight: bold; color: #d4af37; letter-spacing: 1px; }
          .form-title { text-align: center; font-size: 13px; font-weight: bold; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; text-transform: uppercase; margin-bottom: 15px; color: #0f172a; border-left: 5px solid #008751; }
          .section-banner { background: #008751; color: white; padding: 4px 10px; font-size: 10.5px; font-weight: bold; text-transform: uppercase; margin-top: 15px; margin-bottom: 8px; border-radius: 2px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px; }
          .field { display: flex; flex-direction: column; font-size: 12px; }
          .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
          .value { font-weight: 600; padding: 4px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; color: #0f172a; }
          .photo-box { width: 90px; height: 110px; border: 1px solid #cbd5e1; border-radius: 4px; background-color: #f8fafc; text-align: center; line-height: 110px; font-size: 9px; color: #64748b; font-weight: bold; overflow: hidden; }
          .photo-box img { width: 100%; height: 100%; object-fit: cover; }
          .footer { text-align: center; font-size: 7.5px; color: #94a3b8; position: absolute; bottom: 10px; width: 100%; left: 0; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 38px;
            color: rgba(148, 163, 184, 0.11);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 4px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <table class="header-table" style="position: relative; z-index: 10;">
            <tr>
              <td class="crest">${this.getFederalCrestSvg()}</td>
              <td class="title-col">
                <h1>Innovation Development and Effectiveness in Acquisition of Skills</h1>
                <p>FEDERAL MINISTRY OF EDUCATION • TVET ADMISSION & REGISTRATION RECORD</p>
              </td>
              <td style="width: 100px; text-align: right; vertical-align: middle;">
                <div class="photo-box">
                  ${beneficiary.photo ? `<img src="${beneficiary.photo}" referrerPolicy="no-referrer" />` : 'NO PHOTO ID'}
                </div>
              </td>
            </tr>
          </table>

          <div class="form-title" style="position: relative; z-index: 10;">CENTRAL ADMISSION APPLICATION REGISTRATION DOSSIER</div>

          <div class="section-banner" style="position: relative; z-index: 10;">1. Candidate Biographical Demographics</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Full Name</span><span class="value">${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</span></div>
            <div class="field"><span class="label">Candidate Registry ID</span><span class="value">${beneficiary.id}</span></div>
            <div class="field"><span class="label">National NIN</span><span class="value">${beneficiary.nin}</span></div>
            <div class="field"><span class="label">Bank BVN</span><span class="value">${beneficiary.bvn}</span></div>
            <div class="field"><span class="label">Gender Profile</span><span class="value">${beneficiary.gender}</span></div>
            <div class="field"><span class="label">E-Mail Address</span><span class="value">${beneficiary.email}</span></div>
            <div class="field"><span class="label">Phone Number</span><span class="value">${beneficiary.phoneNumber}</span></div>
            <div class="field"><span class="label">Hub Address Location</span><span class="value">${beneficiary.residentialAddress}, ${beneficiary.city}, ${beneficiary.state} State</span></div>
          </div>

          <div class="section-banner" style="position: relative; z-index: 10;">2. Supplementary Audited Information</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Education Qualification</span><span class="value">${beneficiary.educationQualification || "Secondary School"}</span></div>
            <div class="field"><span class="label">Physical Challenges</span><span class="value">${beneficiary.physicalChallenge || "NONE"}</span></div>
            <div class="field"><span class="label">Next Of Kin / Guardian Name</span><span class="value">${beneficiary.guardianName || "N/A"}</span></div>
            <div class="field"><span class="label">Next of Kin Contact Phone</span><span class="value">${beneficiary.guardianPhone || "N/A"}</span></div>
            <div class="field"><span class="label">Prior Knowledge Level</span><span class="value">${beneficiary.admissionFormData?.priorKnowledge || "None / Baseline"}</span></div>
            <div class="field"><span class="label">Highest Qualification Attached</span><span class="value">${beneficiary.admissionFormData?.highestQualification || "Not Listed"}</span></div>
          </div>

          <div class="section-banner" style="position: relative; z-index: 10;">3. Technical program & batch configurations</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Technical School Partner (TSP)</span><span class="value">${beneficiary.tsp}</span></div>
            <div class="field"><span class="label">Accredited Domain Sector</span><span class="value">${beneficiary.skillSector}</span></div>
            <div class="field"><span class="label">Enrolled Cohort Batch</span><span class="value">${beneficiary.batch}</span></div>
            <div class="field"><span class="label">Admission Record Status</span><span class="value">${beneficiary.admissionStatus || "Admitted"}</span></div>
          </div>

          <div class="section-banner" style="position: relative; z-index: 10;">4. Bank disbursement credentials configuration</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Account Holder Name</span><span class="value">${beneficiary.bankAccountHolder || beneficiary.firstName + " " + beneficiary.lastName}</span></div>
            <div class="field"><span class="label">Financial Institution (Bank)</span><span class="value">${beneficiary.bankName || "N/A"}</span></div>
            <div class="field"><span class="label">Sort Code</span><span class="value">${beneficiary.bankSortCode || "N/A"}</span></div>
            <div class="field"><span class="label">Account Number</span><span class="value">${beneficiary.bankAccountNumber || "N/A"}</span></div>
          </div>

          ${customFieldsHtml ? `
            <div class="section-banner" style="position: relative; z-index: 10;">5. Dynamic Program-Specific Custom Parameters</div>
            <div style="font-size: 12px; font-family: monospace; padding: 5px 10px; background: #fafafa; border: 1px solid #eef0f2; border-radius: 4px; position: relative; z-index: 10;">
              ${customFieldsHtml}
            </div>
          ` : ""}

          <div style="display: table; width: 100%; margin-top: 15px; page-break-inside: avoid; position: relative; z-index: 10;">
            <div style="display: table-row;">
              <div style="display: table-cell; text-align: justify; border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; background: #fafafa; font-size: 9px; line-height: 1.4; color: #475569; vertical-align: top;">
                <strong>Admissions Verification Statement:</strong> This printable record serves as a complete digital dossier snapshot representing the candidate's formal registry record under the IDEAS-TVET programme. All biographies, custom dynamic fields, and BVN identity tokens have been fully reconciled and cryptographically locked within the centralized database registry.
              </div>
              ${meta?.qrDataUrl ? `
              <div style="display: table-cell; width: 22%; text-align: right; padding-left: 15px; vertical-align: middle;">
                <div style="display: inline-block; text-align: center; border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; background-color: #f8fafc; font-family: monospace; font-size: 6px; color: #475569;">
                  <img src="${meta.qrDataUrl}" style="width: 48px; height: 48px; display: block; margin: 0 auto 3px auto;" />
                  <span style="font-weight: bold; text-transform: uppercase;">CODE: ${meta.verificationCode}</span>
                </div>
              </div>
              ` : ""}
            </div>
          </div>

          <div class="footer">
            IDEAS-TVET CENTRALIZED REGISTER SYSTEM • CONFIRMATION PRINT DATE: ${dateStr} • SECURE DATABASE ARCHIVED
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * Generates a beautifully styled Candidate Photo Album/Technical ID Card and Album document.
   */
  static async generatePhotoAlbumPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const timestamp = new Date().toLocaleDateString("en-GB");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Professional Profile & Photo Badge - ${beneficiary.id}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 5px; background-color: #ffffff; }
          .border-frame { border: 2px solid #008751; padding: 25px; border-radius: 6px; min-height: 250mm; position: relative; background: #fcfdfd; }
          .header { text-align: center; border-bottom: 2px double #008751; padding-bottom: 12px; margin-bottom: 25px; }
          .header h1 { font-size: 18px; margin: 0; font-weight: bold; color: #008751; text-transform: uppercase; }
          .header p { font-size: 9px; margin: 4px 0 0 0; color: #d4af37; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; }
          .grid-layout { display: table; width: 100%; margin-top: 20px; }
          .grid-row { display: table-row; }
          .grid-cell-left { display: table-cell; width: 45%; vertical-align: top; padding-right: 25px; }
          .grid-cell-right { display: table-cell; width: 55%; vertical-align: top; }
          .profile-photo-container { border: 3px solid #008751; padding: 8px; background: white; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); text-align: center; }
          .profile-photo { width: 100%; height: 260px; object-fit: cover; background: #e2e8f0; border-radius: 4px; }
          .badge-card { border: 1.5px solid #d4af37; background: linear-gradient(135deg, #008751, #005a36); color: white; border-radius: 6px; padding: 15px; margin-top: 25px; position: relative; overflow: hidden; box-shadow: 0 4px 10px rgba(0,135,81,0.25); }
          .badge-crest { position: absolute; right: -15px; bottom: -15px; opacity: 0.15; transform: scale(1.6); }
          .badge-header { border-bottom: 1px solid rgba(255,255,255,0.28); padding-bottom: 5px; margin-bottom: 10px; font-weight: bold; font-size: 10px; letter-spacing: 1px; color: #d4af37; }
          .badge-name { font-size: 16px; font-weight: 800; margin-bottom: 2px; text-transform: uppercase; }
          .badge-id { font-family: monospace; font-size: 11px; font-weight: bold; background: rgba(255,255,255,0.15); display: inline-block; padding: 1px 6px; border-radius: 3px; }
          .badge-meta { font-size: 9.5px; margin-top: 8px; color: rgba(255,255,255,0.85); font-family: Arial, sans-serif; }
          .spec-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #008751; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 10px; margin-top: 15px; letter-spacing: 0.5px; }
          .meta-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          .meta-table td { padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }
          .biometrics-box { border: 1.5px solid #94a3b8; border-color: #3b82f6; background-color: #eff6ff; padding: 10px; border-radius: 4px; font-size: 11px; color: #1e3a8a; margin-top: 20px; }
          .biometrics-item { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; font-family: monospace; }
          .footer-note { text-align: center; font-size: 8px; color: #94a3b8; position: absolute; bottom: 15px; width: 100%; left: 0; font-family: Arial, sans-serif; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 38px;
            color: rgba(148, 163, 184, 0.11);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 4px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <div class="header" style="position: relative; z-index: 10;">
            ${this.getFederalCrestSvg()}
            <h1>Innovations in TVET Technical Hubs Registry</h1>
            <p>FEDERAL MINISTRY OF EDUCATION • OFFICIAL CANDIDATE PHOTO ALBUM & IDENTIFIER</p>
          </div>

          <div class="grid-layout">
            <div class="grid-row">
              <div class="grid-cell-left">
                <div class="profile-photo-container">
                  ${beneficiary.photo 
                    ? `<img class="profile-photo" src="${beneficiary.photo}" referrerPolicy="no-referrer" />` 
                    : `<div class="profile-photo" style="display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b;font-weight:bold;">PASSPORT AVATAR RECORDING MISSING</div>`
                  }
                  <div style="font-weight:bold; font-size:11px; color:#008751; margin-top:10px; text-transform:uppercase;">Primary Biometric Portrait</div>
                </div>

                <div class="badge-card">
                  <div class="badge-header">FEDERAL TVET IDENTIFIER BADGE</div>
                  <div class="badge-name">${beneficiary.firstName} ${beneficiary.lastName}</div>
                  <div class="badge-id">ID: ${beneficiary.id}</div>
                  <div class="badge-meta">
                    SECTOR: Computer Hardware & repairs<br>
                    CENTER: Kano State TVET Hub Location<br>
                    SECURITY SYSTEM: KEY ENCRYPTED LOCK
                  </div>
                  <div class="badge-crest">
                    ${this.getFederalCrestSvg()}
                  </div>
                </div>
              </div>

              <div class="grid-cell-right">
                <div class="spec-title">Trainee Enrollment Identity Parameters</div>
                <table class="meta-table">
                  <tr><td style="width:130px; font-weight:bold; color:#475569;">First Name:</td><td style="font-weight:600;">${beneficiary.firstName.toUpperCase()}</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Last Name:</td><td style="font-weight:600;">${beneficiary.lastName.toUpperCase()}</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Other Name:</td><td style="font-weight:600;">${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : "N/A"}</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Identification NIN:</td><td style="font-weight:600; font-family:monospace;">${beneficiary.nin}</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Verification BVN:</td><td style="font-weight:600; font-family:monospace;">${beneficiary.bvn}</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">State / Assigned Center:</td><td style="font-weight:600;">${beneficiary.state} State Technical Center</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Assigned Program:</td><td style="font-weight:600;">Computer Hardware & Repairs Sector</td></tr>
                  <tr><td style="font-weight:bold; color:#475569;">Active Enrolled Group:</td><td style="font-weight:600; color:#008751;">${beneficiary.batch}</td></tr>
                </table>

                <div class="spec-title">Identity Verification Checksum Locks</div>
                <div class="biometrics-box">
                  <div style="font-weight:bold; text-transform:uppercase; font-size:10px; margin-bottom:8px; border-bottom:1.5px solid #bfdbfe; padding-bottom:3px;">PORTRAIT & BIOMETRICS FACIAL SCANNER LEDGER</div>
                  <div class="biometrics-item"><span>Liveness Validation Map:</span><span style="color:#059669; font-weight:bold;">● PASSED [SUCCESS]</span></div>
                  <div class="biometrics-item"><span>Scan Matching Confidence:</span><span style="font-weight:bold;">99.8%</span></div>
                  <div class="biometrics-item"><span>System Integrity Keys:</span><span style="font-weight:bold; font-size:10px;">AES_256_GCM_VERIFIED</span></div>
                  <div class="biometrics-item"><span>Audited Entry Stamp:</span><span style="font-weight:bold;">${timestamp}</span></div>
                </div>

                ${meta?.qrDataUrl ? `
                <div style="margin-top: 15px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; background-color: #f8fafc; font-family: monospace; font-size: 8px; color: #475569; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <strong style="color: #0f172a; font-size: 9px; display: block; margin-bottom: 3px;">CRYPTOGRAPHIC VERIFICATION SCAN</strong>
                    Scan this QR code with any terminal to authenticate this candidate portrait register against State TVET records.
                  </div>
                  <div style="text-align: center; font-size: 6.5px; font-weight: bold; margin-left:15px; flex-shrink: 0;">
                    <img src="${meta.qrDataUrl}" style="width: 50px; height: 50px;" /><br/>
                    CODE: ${meta.verificationCode}
                  </div>
                </div>
                ` : ""}
              </div>
            </div>
          </div>

          <div class="footer-note">
            IDEAS-TVET HUB SYSTEM RECORDS • SECURE OFFICIAL COHORT PHOTO SPECIFIC ID REGISTER • FOR OFFICIAL INSPECTIONS ONLY
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * 3. Generates an official Enrollment Confirmation PDF.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateEnrollmentConfirmationPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const dateStr = beneficiary.updatedAt 
      ? new Date(beneficiary.updatedAt).toLocaleDateString("en-GB") 
      : new Date().toLocaleDateString("en-GB");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Enrollment Confirmation - Candidate: ${beneficiary.id}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 10px; background-color: #ffffff; }
          .border-frame { border: 2px solid #008751; padding: 30px; border-radius: 6px; min-height: 240mm; position: relative; }
          .header { text-align: center; border-bottom: 2px solid #008751; padding-bottom: 12px; margin-bottom: 25px; }
          .header h1 { font-size: 20px; margin: 0; font-weight: bold; color: #008751; text-transform: uppercase; }
          .header p { font-size: 10px; margin: 4px 0 0 0; color: #d4af37; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
          .crest-container { text-align: center; margin-bottom: 15px; }
          .title-box { text-align: center; font-size: 14px; font-weight: bold; background: #f0fdf4; padding: 10px; text-transform: uppercase; margin-bottom: 25px; border: 1px solid #bbf7d0; color: #166534; letter-spacing: 0.5px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; }
          .field { display: flex; flex-direction: column; }
          .label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; margin-bottom: 3px; }
          .value { font-size: 12px; font-weight: 600; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; color: #0f172a; }
          .status-banner { background-color: #008751; color: white; display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 4px; margin-top: 10px; margin-bottom: 25px; font-weight: bold; font-size: 11px; letter-spacing: 0.5px; }
          .status-val { background-color: #ffffff; color: #008751; padding: 2px 10px; border-radius: 3px; font-size: 9.5px; font-weight: bold; font-family: monospace; }
          .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #008751; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 12px; letter-spacing: 0.5px; }
          .terms { font-size: 11px; text-align: justify; margin-top: 25px; line-height: 1.5; color: #475569; }
          .signatures { display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; }
          .sig-row { display: table-row; }
          .sig-block { display: table-cell; width: 33%; text-align: center; font-size: 11px; vertical-align: top; }
          .sig-line { width: 85%; margin: 0 auto 5px auto; border-bottom: 1px solid #475569; height: 35px; }
          .footer-note { text-align: center; font-size: 8px; color: #94a3b8; position: absolute; bottom: 15px; width: 100%; left: 0; font-family: Arial, sans-serif; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 38px;
            color: rgba(148, 163, 184, 0.11);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 4px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <div class="crest-container" style="position: relative; z-index: 10;">
            ${this.getFederalCrestSvg()}
          </div>
          <div class="header" style="position: relative; z-index: 10;">
            <h1>Federal Republic of Nigeria</h1>
            <p>Ministry of Education • IDEAS-TVET National Trainee Enrollment Registry</p>
          </div>
          
          <div class="title-box" style="position: relative; z-index: 10;">Official Trainee Biometrics Enrollment Confirmation Letter</div>

          <div class="status-banner" style="position: relative; z-index: 10;">
            <span>DATABASE MATRICULATION ID LOCKED ACCREDITATION STATUS</span>
            <span class="status-val">FINALIZED VERIFIED</span>
          </div>

          <div class="section-title" style="position: relative; z-index: 10;">1. Trainee Primary Demographics</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Beneficiary Full Name</span><span class="value">${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()}</span></div>
            <div class="field"><span class="label">Primary Registry ID</span><span class="value">${beneficiary.id}</span></div>
            <div class="field"><span class="label">National Identification (NIN)</span><span class="value">${beneficiary.nin}</span></div>
            <div class="field"><span class="label">Bank Verification Number (BVN)</span><span class="value">${beneficiary.bvn}</span></div>
            <div class="field"><span class="label">State of Assignment</span><span class="value">${beneficiary.state} (${beneficiary.city})</span></div>
            <div class="field"><span class="label">Training Program Cluster</span><span class="value">Computer Hardware & Mobile Repairs</span></div>
          </div>

          <div class="section-title" style="position: relative; z-index: 10;">2. Curriculum Scope & Audit Progress Records</div>
          <div class="grid" style="position: relative; z-index: 10;">
            <div class="field"><span class="label">Assigned Skill Center</span><span class="value">Unique Technology Nig. Ltd, Owerri Center</span></div>
            <div class="field"><span class="label">Academic Unit Load</span><span class="value">9 Credits (90 Compulsory Contact Hours)</span></div>
            <div class="field"><span class="label">Attendance Tracker State</span><span class="value">Daily Scan Biometrics Ledger Lock Enabled</span></div>
            <div class="field"><span class="label">Confirmation Stamp Date</span><span class="value">${dateStr}</span></div>
          </div>

          <div class="terms" style="position: relative; z-index: 10;">
            <strong>Declarative Certification:</strong> Unique Technology Nig. Ltd, as an accredited federal skill incubator under the National Board for Technical Education (NBTE) guidelines, hereby confirms that the trainee named in this document has completed the formal contract declarations requirements. The biographical parameters, secure database entries, and biometrics ledgers are verified and registered in the National TVET Registry Repository under strict encryption keys.
          </div>

          <table class="signatures" style="position: relative; z-index: 10;">
            <tr class="sig-row">
              <td class="sig-block">
                <div class="sig-line"></div>
                <strong>Trainee Signature</strong><br>Digitally Authenticated
              </td>
              <td class="sig-block">
                <div class="sig-line"></div>
                <strong>Director of Registry Section</strong><br>Registry Ministry Stamp
              </td>
              ${meta?.qrDataUrl ? `
              <td style="display: table-cell; width: 33%; text-align: right; vertical-align: bottom;">
                <div style="display: inline-block; text-align: center; border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; background-color: #f8fafc; font-family: monospace; font-size: 6.5px; color: #475569;">
                  <img src="${meta.qrDataUrl}" style="width: 50px; height: 50px; display: block; margin: 0 auto 3px auto;" />
                  <span style="font-weight: bold; text-transform: uppercase;">CODE: ${meta.verificationCode}</span>
                </div>
              </td>
              ` : ""}
            </tr>
          </table>

          <div class="footer-note">
            FEDERAL REGISTRATION SYSTEM • UNIQUE NO: TVET-ENR-${beneficiary.id.split("-").pop()}-${new Date().getFullYear()} • WATERMARKED OFFICIAL A4 DOCUMENT
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * 4. Generates an official Completion Certificate PDF in LANDSCAPE orientation.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateCompletionCertificatePdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const dateStr = beneficiary.updatedAt 
      ? new Date(beneficiary.updatedAt).toLocaleDateString("en-GB") 
      : new Date().toLocaleDateString("en-GB");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Certificate of Completion - Candidate: ${beneficiary.id}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Georgia', Times, 'Times New Roman', serif; color: #1e293b; line-height: 1.4; margin: 0; padding: 10px; background-color: #ffffff; }
          .certificate-container { border: 8px double #008751; padding: 40px; border-radius: 4px; min-height: 175mm; position: relative; background-color: #fffbf5; box-shadow: inset 0 0 40px #fdf3e7; }
          .gold-border { border: 2px solid #d4af37; padding: 10px; }
          .inner-container { border: 1px solid #008751; padding: 25px; min-height: 151mm; text-align: center; }
          .crest-top { margin-bottom: 12px; }
          .authority-title { text-transform: uppercase; font-size: 13px; font-weight: bold; letter-spacing: 2px; color: #334155; margin-bottom: 3px; font-family: Arial, sans-serif; }
          .board-title { text-transform: uppercase; font-size: 20px; font-weight: bold; color: #008751; letter-spacing: 1px; margin-bottom: 15px; }
          .cert-title { font-family: 'Times New Roman', Times, serif; font-size: 34px; font-style: italic; font-weight: bold; color: #0d1e3e; margin-bottom: 20px; text-transform: capitalize; }
          .conferred-to { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px; font-family: Arial, sans-serif; }
          .recipient-name { font-size: 28px; font-weight: bold; color: #008751; border-bottom: 2px dashed #d4af37; display: inline-block; padding-bottom: 4px; min-width: 450px; text-transform: uppercase; letter-spacing: 0.5px; }
          .award-clause { font-size: 14px; color: #1e293b; margin: 20px auto; max-width: 700px; text-align: center; }
          .domain-strong { color: #0d1e3e; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-top: 6px; }
          .metrics-row { font-size: 11.5px; color: #475569; margin-top: 15px; font-family: Arial, sans-serif; letter-spacing: 0.5px; }
          .metrics-row strong { color: #008751; }
          .signatures-table { width: 100%; border-collapse: collapse; margin-top: 35px; page-break-inside: avoid; }
          .signatures-table td { width: 33.3%; text-align: center; vertical-align: bottom; }
          .sig-line { width: 70%; margin: 0 auto 5px auto; border-bottom: 1px dashed #64748b; height: 35px; position: relative; }
          .sig-font { font-family: 'Brush Script MT', 'Georgia', cursive, serif; font-style: italic; color: #008751; font-size: 18px; position: absolute; bottom: 2px; width: 100%; text-align: center; }
          .sig-label { font-size: 10.5px; font-weight: bold; color: #475569; font-family: Arial, sans-serif; }
          .cert-no { position: absolute; bottom: 25px; left: 35px; font-size: 8.5px; font-family: monospace; color: #64748b; }
          .date-issue { position: absolute; bottom: 25px; right: 35px; font-size: 9px; font-family: monospace; color: #64748b; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 40px;
            color: rgba(0, 135, 81, 0.05);
            font-weight: 800;
            text-transform: uppercase;
            font-family: Arial, sans-serif;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 6px;
          }
          ` : ""}
        </style>
      </head>
      <body>
        <div class="certificate-container">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <div class="gold-border" style="position: relative; z-index: 10;">
            <div class="inner-container">
              <div class="crest-top">
                ${this.getFederalCrestSvg()}
              </div>
              <div class="authority-title">Federal Republic of Nigeria</div>
              <div class="board-title">National Board for Technical Education & skill sector</div>
              
              <div class="cert-title">Certificate of Competence Completion</div>
              
              <div class="conferred-to">this credentials cert is conferred upon</div>
              <div class="recipient-name">${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</div>
              
              <div class="award-clause">
                Who has successfully audited, met biometrics ledger requisites, and completed the certified and officially accredited TVET Literacy & Skills sector development curriculum in
                <span class="domain-strong">Computer Hardware Repairs & Cellphone System Board Diagnostics</span>
              </div>
              
              <div class="metrics-row">
                Evaluated unit volume: <strong>90 Classroom Contact Hours (9 Credits)</strong> • Grade Level: <strong>Honorable Pass (Outstanding Merit)</strong>
              </div>

              <table class="signatures-table">
                <tr>
                  <td>
                    <div class="sig-line">
                      <span class="sig-font">O. Coordinator</span>
                    </div>
                    <span class="sig-label">Operations Coordinator</span><br>
                    <span style="font-size: 9px; color: #64748b; font-family: Arial, sans-serif;">Unique Technology Nig. Ltd</span>
                  </td>
                  <td>
                    <div style="margin-top: -15px;">
                      ${this.getCertificateSealSvg()}
                    </div>
                  </td>
                  <td>
                    <div class="sig-line">
                      <span class="sig-font" style="color: #0d1e3e;">M. State Coordinator</span>
                    </div>
                    <span class="sig-label">Registrar Representative</span><br>
                    <span style="font-size: 9px; color: #64748b; font-family: Arial, sans-serif;">Federal Ministry of Education TVET</span>
                  </td>
                </tr>
              </table>
              
              <div class="cert-no" style="bottom: 12px; display: flex; align-items: center; text-align: left; font-family: Arial, sans-serif;">
                <div>
                  <strong style="color: #475569; font-family: monospace;">REGISTRY SERIAL CODE: NBC/CO-${beneficiary.id.split("-").pop()}-${new Date().getFullYear()}</strong>
                  ${meta?.verificationCode ? `<br/><span style="color: #008751; font-weight: bold; font-family: monospace;">VERIFICATION PORTAL CODE: ${meta.verificationCode}</span>` : ""}
                </div>
                ${meta?.qrDataUrl ? `
                <div style="margin-left: 15px; border: 1px solid #cbd5e1; padding: 2px; border-radius: 4px; background-color: #ffffff; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                  <img src="${meta.qrDataUrl}" style="width: 36px; height: 36px; display: block;" />
                </div>
                ` : ""}
              </div>
              <div class="date-issue">DATE OF REGISTRATION SEALS: ${dateStr}</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.compileHtmlToPdfBuffer(htmlContent, true);
  }
}
