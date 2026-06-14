import crypto from "crypto";

/**
 * Utility to build proper, clean, and sanitized filename based on Trainee name and document type
 */
export function buildSanitizedFilename(beneficiary: any, docType: string, ext: string = "pdf"): string {
  const fName = (beneficiary.firstName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const lName = (beneficiary.lastName || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const namePart = fName && lName ? `${fName}_${lName}` : `${(beneficiary.id || "TRAINEE").replace(/[^A-Z0-9-]/g, "")}`;
  const docPart = docType.toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return `${namePart}_${docPart}.${ext}`;
}

/**
 * Utility to log the forensic state of a PDF at any stage of the pipeline
 */
export function logForensicPdfTrace(label: string, filename: string, buffer: Buffer) {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const size = buffer.length;
  const first20 = buffer.subarray(0, 20).toString("hex");
  const last20 = buffer.length >= 20 ? buffer.subarray(-20).toString("hex") : buffer.toString("hex");
  const first20Ascii = JSON.stringify(buffer.subarray(0, 20).toString("ascii"));
  const last20Ascii = JSON.stringify(buffer.length >= 20 ? buffer.subarray(-20).toString("ascii") : buffer.toString("ascii"));
  
  console.log(`
======================================================================
[FORENSIC PDF TRACE AUDIT] - STAGE: ${label.toUpperCase()}
======================================================================
{
  "filename": "${filename}",
  "size": ${size},
  "sha256": "${sha256}",
  "first20": "${first20}",
  "last20": "${last20}",
  "first20Ascii": ${first20Ascii},
  "last20Ascii": ${last20Ascii}
}
======================================================================
`);

  // Extra validation check: confirm first 5 bytes are '%PDF-' if it is a PDF document
  const ext = filename.split(".").pop()?.toLowerCase();
  const nonPdfExts = ["png", "jpg", "jpeg", "docx", "doc", "gif"];
  const isPdf = !ext || !nonPdfExts.includes(ext);

  if (isPdf) {
    const sig = buffer.subarray(0, 5).toString("ascii");
    if (sig !== "%PDF-") {
      console.error(`[PDF INTEGRITY REJECTED] PDF binary corrupt at STAGE: ${label}. Starts with '${sig}' instead of '%PDF-'.`);
      throw new Error(`PDF Integrity Violation: File ${filename} at stage ${label} does not begin with %PDF-`);
    } else {
      console.log(`[PDF INTEGRITY CONFIRMED] File ${filename} begins with valid '%PDF-' header at STAGE: ${label}.`);
    }
  } else {
    console.log(`[FILE INTEGRITY CONFIRMED] Non-PDF file ${filename} (ext: ${ext}) bypasses PDF signature validation at STAGE: ${label}.`);
  }
}
