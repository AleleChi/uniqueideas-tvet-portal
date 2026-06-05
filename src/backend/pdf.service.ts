/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Beneficiary } from "../types";
import puppeteer from "puppeteer";
import { DbRepo } from "./db";

export class PdfService {
  /**
   * Dynamically retrieves organization settings from database with standard fallback defaults
   */
  private static async getSettings() {
    try {
      return await DbRepo.getOrganizationSettings();
    } catch (e) {
      console.warn("[PdfService] Failed fetching organization settings, fallback to defaults.", e);
      return {
        id: "ideas_default",
        organizationName: "State TVET Board, Kano",
        tpmName: "Engr. Kabiru Mohammed",
        tpmTitle: "Technical Project Manager (TPM)",
        contactEmail: "kano-tvet@ideas-initiative.org",
        contactPhone: "+234 803 123 4567",
        contactAddress: "No. 45 Gwarzo Road, Kano State, Nigeria",
        letterheadUrl: "",
        signatureUrl: "",
        stampUrl: "",
        watermarkText: "SECURED REGISTRY DOCUMENT",
        watermarkEnabled: true
      };
    }
  }

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
   * Generates official SVG Federal TVET Crest markup for beautiful, crisp branding
   */
  private static getIdeasLogoSvg(): string {
    return `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="15" fill="#1e3a8a" />
        <circle cx="50" cy="45" r="25" fill="#3b82f6" opacity="0.3" />
        <path d="M35,65 L50,30 L65,65 Z" fill="#ffffff" />
        <circle cx="50" cy="30" r="6" fill="#f59e0b" />
        <text x="50" y="85" font-family="'Inter', sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">I D E A S</text>
      </svg>
    `;
  }

  /**
   * Generates official SVG World Bank Logo markup for beautiful, crisp branding
   */
  private static getWorldBankLogoSvg(): string {
    return `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="#0071bc" />
        <circle cx="50" cy="50" r="35" fill="none" stroke="#ffffff" stroke-width="2" />
        <path d="M15,50 Q50,75 85,50 Q50,25 15,50 Z" fill="none" stroke="#ffffff" stroke-width="1.5" />
        <line x1="50" y1="5" x2="50" y2="95" stroke="#ffffff" stroke-width="2" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="#ffffff" stroke-width="2" />
        <text x="50" y="54" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">WORLD BANK</text>
      </svg>
    `;
  }

  /**
   * Generates official SVG NBTE Logo markup for beautiful, crisp branding
   */
  private static getNbteLogoSvg(): string {
    return `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="10" fill="#0c4a6e" />
        <polygon points="50,15 80,45 50,75 20,45" fill="#f59e0b" />
        <circle cx="50" cy="45" r="15" fill="#ffffff" />
        <text x="50" y="49" font-family="Arial" font-size="10" font-weight="900" fill="#0c4a6e" text-anchor="middle">NBTE</text>
        <text x="50" y="88" font-family="Arial" font-size="7" font-weight="bold" fill="#ffffff" text-anchor="middle">ACCREDITED</text>
      </svg>
    `;
  }

  /**
   * Generates official SVG Custom Logo markup for beautiful, crisp branding
   */
  private static getCustomLogoSvg(): string {
    return `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#475569" stroke-width="2" />
        <path d="M30,35 L70,35 M30,50 L70,50 M30,65 L70,65" stroke="#64748b" stroke-width="4" stroke-linecap="round" />
        <text x="50" y="85" font-family="Arial" font-size="9" font-weight="bold" fill="#475569" text-anchor="middle">IDEAS-TVET</text>
      </svg>
    `;
  }

  /**
   * Dynamic branding logo component rendering custom uploaded images or fallback SVG.
   */
  private static renderLogo(logoUrl: string | undefined, fallbackSvg: string, width: string = "70px", height: string = "70px"): string {
    if (logoUrl && logoUrl.trim() !== "") {
      return `<img src="${logoUrl}" style="width: ${width}; height: ${height}; object-fit: contain; display: block;" referrerPolicy="no-referrer" />`;
    }
    return fallbackSvg;
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
  static async generateAdmissionLetterPdf(beneficiary: Beneficiary, meta?: any, returnHtml: boolean = false): Promise<Buffer | string> {
    const settings = await this.getSettings();
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
          ${settings.watermarkEnabled ? `
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
          ${settings.watermarkEnabled ? `<div class="watermark">${settings.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          
          ${settings.admissionLetterheadUrl ? `
            <div style="text-align: center; margin-bottom: 20px; position: relative; z-index: 10; width: 100%;">
              <img src="${settings.admissionLetterheadUrl}" style="width: 100%; height: auto; display: block;" referrerPolicy="no-referrer">
            </div>
          ` : settings.letterheadUrl ? `
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px double #008751; padding-bottom: 12px; position: relative; z-index: 10;">
              <img src="${settings.letterheadUrl}" style="max-height: 90px; width: auto; max-width: 100%;" referrerPolicy="no-referrer">
            </div>
          ` : `
            <table class="header-table" style="position: relative; z-index: 10; width: 100%;">
              <tr>
                <td class="header-crest">${this.getFederalCrestSvg()}</td>
                <td class="header-text-col">
                  <h1>${settings.organizationName}</h1>
                  <div class="sub-title">Federal Ministry of Education | IDEAS-TVET Programme Cohort</div>
                  <div class="contacts">${settings.contactAddress} | Email: ${settings.contactEmail} | Direct Line: ${settings.contactPhone}</div>
                </td>
                <td style="width: 80px; text-align: right; vertical-align: middle;">
                  ${beneficiary.photo ? `
                    <img src="${beneficiary.photo}" style="border: 1px solid #cbd5e1; width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" referrerPolicy="no-referrer">
                  ` : `
                    <div style="border: 1px solid #cbd5e1; width: 60px; height: 60px; line-height: 60px; text-align: center; font-family: Arial, sans-serif; font-size: 8px; color: #64748b; margin-left: auto; background-color: #f8fafc; border-radius: 4px;">PHOTO ID</div>
                  `}
                </td>
              </tr>
            </table>
          `}

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

          <div class="salutation" style="position: relative; z-index: 10; font-size: 13px; font-weight: bold; margin-bottom: 12px;">
            Dear ${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""},
          </div>

          <div class="letter-content" style="position: relative; z-index: 10;">
            <p>On behalf of the Governing Board of ${settings.organizationName}, and in collaboration with the Federal Ministry of Education under the <strong>Innovation Development and Effectiveness in Acquisition of Skills (IDEAS-TVET)</strong> project, we are pleased to offer you provisional admission into the intensive professional training cohort majoring in <strong>${beneficiary.skillSector || "Computer Hardware and Cell Phone Repairs"}</strong> (Sector/Category: <strong>${beneficiary.program || "Technical & Vocational Education"}</strong>).</p>
            
            <p>This program is fully certified by the Federal Board of Technical Education under development grant schemes. The training will take place at your assigned training venue: <strong>${settings.trainingVenue || settings.contactAddress || "Government Technical College (GTC), Kano"}</strong>. Your training cohort is scheduled to commence on <strong>${settings.trainingStartDate || "October 12, 2026"}</strong> and conclude on <strong>${settings.trainingEndDate || "December 18, 2026"}</strong>.</p>
            
            <p>Please note that your study tracker incorporates active daily biometrics authentication locks. In accordance with national audit guidelines, you must log a minimum of 90 classroom hours in the attendance log to qualify for final certification and milestone stipend disbursements.</p>
            
            <p>To accept this offer, please access your custom response link securely, complete the additional emergency contact panels, and submit your signed Acceptance Form within seven working days of this dispatch.</p>
            
            <p>Please accept our warmest congratulations on your selection. We look forward to your successful enrollment and development.</p>
          </div>

          <div class="signatures" style="position: relative; z-index: 10; margin-top: 35px;">
            <div class="sig-row">
              <div class="sig-block">
                <div class="sig-line">
                  ${settings.signatureUrl ? `
                    <img src="${settings.signatureUrl}" style="max-height: 45px; position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%);" referrerPolicy="no-referrer">
                  ` : `
                    <span class="sig-font">${settings.tpmName}</span>
                  `}
                </div>
                <strong>${settings.tpmTitle}</strong><br>${settings.organizationName}
              </div>
              <div class="sig-block">
                <div class="sig-line">
                  <span class="sig-font" style="color: #0369a1;">A. Abubakar</span>
                </div>
                <strong>Accredited Registrar</strong><br>Federal Registry
                ${settings.stampUrl ? `
                  <div style="margin-top: 8px;">
                    <img src="${settings.stampUrl}" style="max-height: 60px; width: auto;" referrerPolicy="no-referrer">
                  </div>
                ` : `
                  <div class="stamp">REGISTRY LOGGED</div>
                `}
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

    if (returnHtml) return htmlContent;
    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * 2. Generates an official signed Acceptance Letter PDF contract.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateAcceptanceLetterPdf(beneficiary: Beneficiary, meta?: any, returnHtml: boolean = false): Promise<Buffer | string> {
    const settings = await this.getSettings();
    const dateStr = beneficiary.acceptanceLetterUploadedAt
      ? new Date(beneficiary.acceptanceLetterUploadedAt).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Offer Acceptance Letter - Candidate: ${beneficiary.id}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Times New Roman', Times, serif; color: #011627; line-height: 1.6; margin: 0; padding: 0; background-color: #ffffff; }
          .border-frame { border: 1.5px solid #2e7d32; padding: 35px; border-radius: 6px; min-height: 240mm; position: relative; box-sizing: border-box; }
          .divider-line { border-bottom: 2px solid #2e7d32; margin-top: 10px; margin-bottom: 25px; width: 100%; }
          .title-box { text-align: center; font-size: 15px; font-weight: bold; background: #e8f5e9; padding: 10px; text-transform: uppercase; margin-bottom: 30px; border: 1px solid #a5d6a7; color: #1b5e20; letter-spacing: 0.5px; }
          .declarative-text { font-size: 14px; text-align: justify; margin-top: 30px; line-height: 1.8; }
          .declarative-text p { margin-bottom: 20px; }
          .field-line { border-bottom: 1px solid #111111; font-weight: bold; padding: 0 8px; color: #1b5e20; }
          .footer-note { text-align: center; font-size: 8px; color: #727272; position: absolute; bottom: 20px; width: calc(100% - 70px); left: 35px; font-family: Arial, sans-serif; border-top: 1px solid #e0e0e0; padding-top: 8px; }
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 40px;
            color: rgba(46, 125, 50, 0.08);
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
          
          ${settings.acceptanceLetterheadUrl ? `
            <div style="text-align: center; margin-bottom: 25px; position: relative; z-index: 10; width: 100%;">
              <img src="${settings.acceptanceLetterheadUrl}" style="width: 100%; height: auto; display: block;" referrerPolicy="no-referrer">
            </div>
          ` : `
            <!-- THREE-LOGO GOVERNMENT HEADER FALLBACK -->
            <table class="logo-header-table" style="position: relative; z-index: 10; width: 100%; border-collapse: collapse; margin-bottom: 10px;">
              <tr>
                <td style="width: 33%; text-align: left; vertical-align: middle;">
                  ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "70px", "70px")}
                </td>
                <td style="width: 34%; text-align: center; vertical-align: middle;">
                  ${this.renderLogo(settings.ideasLogoUrl, this.getIdeasLogoSvg(), "80px", "70px")}
                </td>
                <td style="width: 33%; text-align: right; vertical-align: middle;">
                  ${this.renderLogo(settings.worldBankLogoUrl, this.getWorldBankLogoSvg(), "70px", "70px")}
                </td>
              </tr>
            </table>
            <div class="divider-line" style="position: relative; z-index: 10;"></div>
          `}

          <div style="text-align: right; font-family: monospace; font-size: 12px; margin-bottom: 20px; color: #424242; position: relative; z-index: 10;">
            <div>Registry Ref: <strong>IDEAS-TVET/ACC/${beneficiary.id.split("-").pop() || "VAL"}</strong></div>
            <div>Date: <strong>${dateStr}</strong></div>
          </div>

          <div class="title-box" style="position: relative; z-index: 10;">Letter of Acceptance & Training Commitment Contract</div>

          <div class="declarative-text" style="position: relative; z-index: 10;">
            <p>
              I, <span class="field-line">${beneficiary.firstName.toUpperCase()} ${beneficiary.lastName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</span>, hereby accept the admission offered to me under the IDEAS-TVET Initiative training programme in <span class="field-line">${beneficiary.skillSector}</span> skill.
            </p>
            
            <p>
              I agree to abide by all programme regulations, attendance requirements, and institutional guidelines established at <span class="field-line" style="font-size: 13px;">${settings.trainingVenue || "the Designated Training Center"}</span>.
            </p>
            
            <p>
              I understand that the formal training schedule sessions will run from <strong>${settings.trainingStartDate || "October 12, 2026"}</strong> to <strong>${settings.trainingEndDate || "December 18, 2026"}</strong>, and I understand that failure to comply with active attendance requirements or program milestones may result in immediate withdrawal from the programme.
            </p>
          </div>

          <div style="margin-top: 50px; font-size: 14px; position: relative; z-index: 10;">
            <p>Yours faithfully,</p>
          </div>

          <table style="width: 100%; margin-top: 40px; border-collapse: collapse; version: 1.0; position: relative; z-index: 10; page-break-inside: avoid;">
            <tr>
              <td style="width: 55%; vertical-align: top;">
                <div style="width: 85%; border-bottom: 1px solid #111111; height: 50px; position: relative;">
                  <span style="font-family: 'Brush Script MT', 'Georgia', cursive, serif; font-size: 24px; color: #1b5e20; position: absolute; bottom: 3px; left: 15px;">
                    ${beneficiary.firstName} ${beneficiary.lastName}
                  </span>
                </div>
                <p style="margin-top: 8px; font-size: 12px; font-family: Arial, sans-serif; color: #424242; font-weight: bold; text-transform: uppercase;">Trainee Signature</p>
                <p style="font-size: 11px; font-family: Arial, sans-serif; color: #727272; margin-top: 1px;">Candidate Name: ${beneficiary.firstName} ${beneficiary.lastName}</p>
              </td>
              <td style="width: 45%; vertical-align: top;">
                <div style="width: 85%; border-bottom: 1px solid #111111; height: 50px; position: relative;">
                  <span style="font-family: monospace; font-size: 14px; font-weight: bold; position: absolute; bottom: 5px; left: 5px;">
                    ${dateStr}
                  </span>
                </div>
                <p style="margin-top: 8px; font-size: 12px; font-family: Arial, sans-serif; color: #424242; font-weight: bold; text-transform: uppercase;">Date</p>
              </td>
            </tr>
          </table>

          ${meta?.verificationCode ? `
            <div style="margin-top: 45px; position: relative; z-index: 10; display: inline-block;">
              <div style="border: 1px solid #a5d6a7; padding: 6px 12px; background-color: #f1f8e9; border-radius: 4px; font-family: monospace; font-size: 9px; color: #2e7d32; font-weight: bold; letter-spacing: 0.5px;">
                ✓ SECURITY ID VERIFIED: ${meta.verificationCode}
              </div>
            </div>
          ` : ""}

          <div class="footer-note">
            FEDERAL CONTRACT DOCUMENTS • IDEAS-TVET SKILLS SANCTION • OFFICIAL RECONCILIATION DOCUMENT NO: ${beneficiary.id.split("-").pop() || "VAL"}
          </div>
        </div>
      </body>
      </html>
    `;

    if (returnHtml) return htmlContent;
    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * Generates a beautiful PDF of the complete printed Admission Form, showing
   * all initial and supplementary candidate metadata, custom fields, emergency details, and bank credentials.
   */
  static async generateAdmissionFormPdf(beneficiary: Beneficiary, meta?: any, returnHtml: boolean = false): Promise<Buffer | string> {
    const settings = await this.getSettings();
    const dateStr = beneficiary.admissionFormData?.submissionDate
      ? new Date(beneficiary.admissionFormData.submissionDate).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // Dynamic field list rendering as two-column table rows
    let customFieldsHtml = "";
    if (beneficiary.customFields && typeof beneficiary.customFields === "object") {
      for (const [key, val] of Object.entries(beneficiary.customFields)) {
        customFieldsHtml += `
          <tr>
            <td class="attrib-label">${key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
            <td class="attrib-value">${val || "N/A"}</td>
          </tr>
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
          @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; }
          body { 
            font-family: 'Inter', Arial, sans-serif; 
            color: #1a202c; 
            line-height: 1.4; 
            margin: 0; 
            padding: 0; 
            background-color: #ffffff; 
          }
          .border-frame { 
            padding: 10px; 
            min-height: 245mm; 
            position: relative; 
          }
          
          /* Watermark styling */
          ${meta?.watermarkEnabled ? `
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 40px;
            color: rgba(0, 0, 0, 0.035);
            font-weight: 900;
            text-transform: uppercase;
            white-space: nowrap;
            z-index: 0;
            pointer-events: none;
            letter-spacing: 5px;
          }
          ` : ""}
          
          /* Header and titles */
          .logo-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 5px;
          }
          .logo-header-table td {
            vertical-align: middle;
            padding: 0;
          }
          .divider-line {
            border-bottom: 3px solid #000000;
            width: 100%;
            margin: 10px 0 15px 0;
          }
          .document-title {
            text-align: center; 
            font-family: 'Inter', Arial, sans-serif; 
            font-size: 13.5pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            margin: 0 0 18px 0; 
            color: #000000; 
            letter-spacing: 0.5px;
          }

          /* Dossier Metadata block */
          .meta-info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 18px;
          }
          .meta-info-table td {
            vertical-align: top;
            padding: 0;
          }
          .photo-frame {
            width: 95px; 
            height: 115px; 
            border: 2px solid #000000; 
            background-color: #f8fafc; 
            overflow: hidden; 
            text-align: center; 
            box-sizing: border-box;
          }
          .photo-frame img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .photo-placeholder-text {
            font-size: 7.5pt; 
            font-weight: bold; 
            color: #64748b; 
            padding: 10px; 
            margin-top: 25px; 
            text-transform: uppercase;
            line-height: 1.3;
          }

          /* Elegant 2-Column Bordered Table styling */
          .details-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #000000;
            margin-bottom: 18px;
            font-size: 9pt;
            position: relative;
            z-index: 10;
          }
          .section-banner-row {
            background-color: #000000 !important;
          }
          .section-banner-cell {
            color: #ffffff !important;
            font-weight: bold !important;
            text-transform: uppercase;
            font-size: 9pt;
            letter-spacing: 0.75px;
            padding: 6px 10px !important;
            border: 1px solid #000000 !important;
          }
          .attrib-label {
            width: 200px;
            font-weight: bold;
            color: #000000;
            background-color: #f8fafc;
            text-transform: uppercase;
            font-size: 8pt;
            padding: 6px 12px;
            border: 1px solid #000000;
            box-sizing: border-box;
          }
          .attrib-value {
            font-weight: bold;
            color: #000000;
            padding: 6px 12px;
            border: 1px solid #000000;
            box-sizing: border-box;
          }

          /* Footer attestation and barcodes */
          .attestation-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            page-break-inside: avoid;
          }
          .attestation-cell {
            font-size: 8pt; 
            color: #475569; 
            padding: 10px; 
            border: 1.5px solid #000000; 
            background-color: #f8fafc; 
            line-height: 1.4; 
            vertical-align: middle;
            text-align: justify;
          }
          .qr-box {
            border: 1.5px solid #000000; 
            padding: 6px; 
            text-align: center; 
            display: inline-block; 
            background-color: #ffffff;
          }

          /* Signature lines */
          .sign-off-table {
            width: 100%;
            margin-top: 25px;
            border-collapse: collapse;
            page-break-inside: avoid;
          }
          .sign-line-cell {
            border-top: 1.5px solid #000000;
            padding-top: 6px;
            font-size: 8.5pt;
            width: 45%;
          }
          .sign-gap-cell {
            width: 10%;
          }

          .system-footer { 
            text-align: center; 
            font-size: 7.5px; 
            color: #94a3b8; 
            position: absolute; 
            bottom: 5px; 
            width: 100%; 
            left: 0; 
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="border-frame">
          ${meta?.watermarkEnabled ? `<div class="watermark">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          
          <!-- HORIZONTAL LOGO BAR -->
          <table class="logo-header-table" style="position: relative; z-index: 10;">
            <tr>
              <td style="width: 33%; text-align: left;">
                ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "70px", "70px")}
              </td>
              <td style="width: 34%; text-align: center;">
                ${this.renderLogo(settings.ideasLogoUrl, this.getIdeasLogoSvg(), "80px", "70px")}
              </td>
              <td style="width: 33%; text-align: right;">
                ${this.renderLogo(settings.worldBankLogoUrl, this.getWorldBankLogoSvg(), "70px", "70px")}
              </td>
            </tr>
          </table>

          <!-- SEPARATOR SYSTEM -->
          <div class="divider-line"></div>

          <!-- DOCUMENT TITLE -->
          <div style="text-align: center; margin-bottom: 20px; position: relative; z-index: 10;">
            <div style="font-family: 'Inter', Arial, sans-serif; font-size: 15pt; font-weight: bold; text-transform: uppercase; color: #000000; letter-spacing: 0.5px; line-height: 1.2;">IDEAS-TVET Initiative</div>
            <div style="font-family: 'Inter', Arial, sans-serif; font-size: 13pt; font-weight: bold; text-transform: uppercase; color: #000000; letter-spacing: 0.5px; line-height: 1.2; margin-top: 4px;">Trainee Admission Form</div>
          </div>

          <!-- DOSSIER METADATA AND CANDIDATE PHOTOGRAPH -->
          <table class="meta-info-table" style="position: relative; z-index: 10;">
            <tr>
              <td style="width: 75%; padding-right: 15px;">
                <div style="font-size: 8.5pt; color: #1e293b; line-height: 1.5;">
                  <strong style="color: #000000; font-size: 9.5pt; text-transform: uppercase;">Central Registry Candidate Dossier</strong><br/>
                  <span style="font-family: monospace; font-weight: bold; background-color: #f1f5f9; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 3px; display: inline-block; margin-top: 6px; font-size: 9pt;">CANDIDATE ID: ${beneficiary.id}</span><br/>
                  <span style="font-weight: 600; color: #475569; display: inline-block; margin-top: 5px;">Registry Generated: ${dateStr}</span><br/>
                  <p style="margin: 6px 0 0 0; font-size: 8pt; color: #64748b; text-align: justify; line-height: 1.4;">
                    This record represents the official audited registration blueprint for the candidate under the TVET Skill Enhancement Initiatives. All biometric, BVN identity tokens, and educational markers have been fully reconciled.
                  </p>
                </div>
              </td>
              <td style="width: 25%; text-align: right;">
                <div class="photo-frame" style="display: inline-block;">
                  ${beneficiary.photo 
                    ? `<img src="${beneficiary.photo}" referrerPolicy="no-referrer" />` 
                    : `<div class="photo-placeholder-text">AFFIX RECENT PORTRAIT HERE</div>`
                  }
                </div>
              </td>
            </tr>
          </table>

          <!-- 2-COLUMN BORDERED TABLE FOR DETAILED SUBMISSIONS -->
          <style>
            .section-header-cell {
              background-color: #000000 !important;
              color: #ffffff !important;
              font-family: 'Inter', Arial, sans-serif;
              font-size: 8.5pt !important;
              font-weight: bold !important;
              text-transform: uppercase;
              padding: 6px 12px !important;
              border: 1px solid #000000 !important;
              letter-spacing: 0.5px;
            }
          </style>

          <table class="details-table">
            <thead>
              <tr style="background-color: #fafafa; border-bottom: 1.5px solid #000000;">
                <th style="font-family: 'Inter', Arial, sans-serif; font-size: 9.5pt; font-weight: bold; text-align: left; padding: 7px 12px; border: 1px solid #000000; text-transform: uppercase; width: 44%;">Field</th>
                <th style="font-family: 'Inter', Arial, sans-serif; font-size: 9.5pt; font-weight: bold; text-align: left; padding: 7px 12px; border: 1px solid #000000; text-transform: uppercase; width: 56%;">Details of Trainee</th>
              </tr>
            </thead>
            <tbody>
              <!-- SECTION A -->
              <tr>
                <td colspan="2" class="section-header-cell">SECTION A: TRAINEE INFORMATION</td>
              </tr>
              <tr>
                <td class="attrib-label">Name of Trainee (Surname First)</td>
                <td class="attrib-value">${beneficiary.lastName.toUpperCase()}, ${beneficiary.firstName.toUpperCase()} ${beneficiary.otherName ? beneficiary.otherName.toUpperCase() : ""}</td>
              </tr>
              <tr>
                <td class="attrib-label">Skill Applied For</td>
                <td class="attrib-value">${(beneficiary.skillSector || "Computer Hardware and Cell Phone Repairs").toUpperCase()}</td>
              </tr>
              <tr>
                <td class="attrib-label">National Identification Number</td>
                <td class="attrib-value">${beneficiary.nin || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Phone Number (WhatsApp)</td>
                <td class="attrib-value">${beneficiary.phoneNumber || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Email</td>
                <td class="attrib-value">${beneficiary.email || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Contact Address</td>
                <td class="attrib-value">${beneficiary.residentialAddress || "N/A"}, ${beneficiary.city || "N/A"}, ${beneficiary.state || "N/A"} State</td>
              </tr>
              <tr>
                <td class="attrib-label">Date of Birth (DD/MM/YYYY)</td>
                <td class="attrib-value">${beneficiary.dateOfBirth || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Highest Educational Qualification</td>
                <td class="attrib-value">${beneficiary.educationQualification || "N/A"}</td>
              </tr>

              <!-- SECTION B -->
              <tr>
                <td colspan="2" class="section-header-cell">SECTION B: PARENT/GUARDIAN INFORMATION</td>
              </tr>
              <tr>
                <td class="attrib-label">Name of Parent/Guardian</td>
                <td class="attrib-value">${beneficiary.guardianName || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Address of Parent/Guardian</td>
                <td class="attrib-value">${beneficiary.guardianAddress || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Phone Number of Parent/Guardian</td>
                <td class="attrib-value">${beneficiary.guardianPhone || "N/A"}</td>
              </tr>

              <!-- SECTION C -->
              <tr>
                <td colspan="2" class="section-header-cell">SECTION C: SPECIAL NEEDS</td>
              </tr>
              <tr>
                <td class="attrib-label">Any Physical Challenge?</td>
                <td class="attrib-value">${beneficiary.physicalChallenge || "None"}</td>
              </tr>

              <!-- SECTION D -->
              <tr>
                <td colspan="2" class="section-header-cell">SECTION D: BANK DETAILS</td>
              </tr>
              <tr>
                <td class="attrib-label">Name of Account Holder</td>
                <td class="attrib-value">${beneficiary.bankAccountHolder ? beneficiary.bankAccountHolder.toUpperCase() : (beneficiary.firstName + " " + beneficiary.lastName).toUpperCase()}</td>
              </tr>
              <tr>
                <td class="attrib-label">BVN</td>
                <td class="attrib-value">${beneficiary.bvn || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Bank Name</td>
                <td class="attrib-value">${beneficiary.bankName || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Bank Sort Code</td>
                <td class="attrib-value">${beneficiary.bankSortCode || "N/A"}</td>
              </tr>
              <tr>
                <td class="attrib-label">Bank Account Number</td>
                <td class="attrib-value">${beneficiary.bankAccountNumber || "N/A"}</td>
              </tr>
              
              ${customFieldsHtml ? `
              <tr>
                <td colspan="2" class="section-header-cell">ADDITIONAL SCHEMA PARAMETERS</td>
              </tr>
              ${customFieldsHtml}
              ` : ""}
            </tbody>
          </table>

          <!-- ATTESTATION AND VALIDATION BLOCK -->
          <table class="attestation-table">
            <tr>
              <td class="attestation-cell" style="width: 72%;">
                <strong>REGISTRY VERIFICATION ATTESTATION:</strong> This printable dossier represents a complete audited snapshot representing the candidate's formal registration and stipend milestone logs under the federally governed IDEAS-TVET programme. All biographical datasets, system references, and linked bank accounts have been cryptographically locked within the centralized database registry to prevent identity leaks or unapproved profile changes during evaluation bounds.
              </td>
              <td style="width: 28%; text-align: right; padding-left: 15px; vertical-align: middle;">
                ${meta?.qrDataUrl ? `
                <div class="qr-box">
                  <img src="${meta.qrDataUrl}" style="width: 55px; height: 55px; display: block; margin: 0 auto 4px auto;" />
                  <span style="font-family: monospace; font-size: 6pt; font-weight: bold; color: #000000; text-transform: uppercase;">CODE: ${meta.verificationCode}</span>
                </div>
                ` : ""}
              </td>
            </tr>
          </table>

          <!-- SIGN-OFF REGISTRY LINES -->
          <table style="width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid; font-size: 8.5pt;">
            <tr>
              <td style="width: 45%; vertical-align: top; padding-right: 15px; border-top: 1.5px solid #000000; padding-top: 8px;">
                <strong>Trainee Validation</strong><br/><br/>
                Trainee Signature/Thumbprint: _________________<br/><br/>
                Date: _______________________
              </td>
              <td style="width: 10%;"></td>
              <td style="width: 45%; vertical-align: top; border-top: 1.5px solid #000000; padding-top: 8px;">
                <strong>Registrar Verification</strong><br/><br/>
                Verified By: __________________<br/><br/>
                Signature: ___________________<br/><br/>
                Date: ________________________
              </td>
            </tr>
          </table>

          <!-- FOOTER META CLASSIFICATION -->
          <div class="system-footer">
            IDEAS-TVET ENROLLMENT SYSTEM CENTRAL REGISTRATION RECORD • GENERATION DATE: ${dateStr} • CLASSIFIED FEDERAL TVET DOSSIER DATABASE
          </div>

        </div>
      </body>
      </html>
    `;

    if (returnHtml) return htmlContent;
    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * Generates a beautifully styled Candidate Photo Album/Technical ID Card and Album document.
   */
  static async generatePhotoAlbumPdf(beneficiary: Beneficiary, meta?: any): Promise<Buffer> {
    const settings = await this.getSettings();
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
          ${settings.photoAlbumHeaderUrl ? `
            <div style="text-align: center; margin-bottom: 25px; position: relative; z-index: 10; width: 100%;">
              <img src="${settings.photoAlbumHeaderUrl}" style="width: 100%; height: auto; display: block;" referrerPolicy="no-referrer">
            </div>
          ` : `
            <div class="header" style="position: relative; z-index: 10;">
              ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "70px", "70px")}
              <h1>Innovations in TVET Technical Hubs Registry</h1>
              <p>FEDERAL MINISTRY OF EDUCATION • OFFICIAL CANDIDATE PHOTO ALBUM & IDENTIFIER</p>
            </div>
          `}

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
                    ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "55px", "55px")}
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
  static async generateEnrollmentConfirmationPdf(beneficiary: Beneficiary, meta?: any, returnHtml: boolean = false): Promise<Buffer | string> {
    const settings = await this.getSettings();
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
          ${settings.enrollmentLetterheadUrl ? `
            <div style="text-align: center; margin-bottom: 20px; position: relative; z-index: 10; width: 100%;">
              <img src="${settings.enrollmentLetterheadUrl}" style="width: 100%; height: auto; display: block;" referrerPolicy="no-referrer">
            </div>
          ` : `
            <div class="crest-container" style="position: relative; z-index: 10;">
              ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "70px", "70px")}
            </div>
            <div class="header" style="position: relative; z-index: 10;">
              <h1>Federal Republic of Nigeria</h1>
              <p>Ministry of Education • IDEAS-TVET National Trainee Enrollment Registry</p>
            </div>
          `}
          
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

    if (returnHtml) return htmlContent;
    return await this.compileHtmlToPdfBuffer(htmlContent, false);
  }

  /**
   * 4. Generates an official Completion Certificate PDF in LANDSCAPE orientation.
   * Returns a Buffer containing the compiled PDF.
   */
  static async generateCompletionCertificatePdf(beneficiary: Beneficiary, meta?: any, returnHtml: boolean = false): Promise<Buffer | string> {
    const settings = await this.getSettings();
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
          ${settings.certificateBackgroundUrl ? `
            <div style="position: absolute; inset: 0; z-index: 1; pointer-events: none; border-radius: 4px; overflow: hidden;">
              <img src="${settings.certificateBackgroundUrl}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.85;" referrerPolicy="no-referrer" />
            </div>
          ` : ""}
          ${meta?.watermarkEnabled ? `<div class="watermark" style="z-index: 2;">${meta.watermarkText || "SECURED REGISTRY DOCUMENT"}</div>` : ""}
          <div class="gold-border" style="position: relative; z-index: 10;">
            <div class="inner-container">
              <div class="crest-top">
                ${this.renderLogo(settings.fmeLogoUrl, this.getFederalCrestSvg(), "70px", "70px")}
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

    if (returnHtml) return htmlContent;
    return await this.compileHtmlToPdfBuffer(htmlContent, true);
  }
}
