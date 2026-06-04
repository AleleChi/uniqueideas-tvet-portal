import { PdfService } from "./pdf.service";
import { Beneficiary } from "../types";

async function main() {
  console.log("=== 1. Starting Live PDF Generation Audit ===");
  
  const mockBeneficiary = {
    id: "test-user-uuid",
    firstName: "Auditor",
    lastName: "Tester",
    email: "test@example.com",
    nin: "12345678901",
    bvn: "12121212121",
    state: "Imo",
    city: "Owerri",
    admissionRef: "IDEAS/TVET/ADM/TEST/2026",
    admissionStatus: "Pending",
    admissionFormCompleted: false,
    admissionFormStatus: "Pending",
  } as Beneficiary;

  try {
    const start = Date.now();
    const pdfBuffer = await PdfService.generateAdmissionLetterPdf(mockBeneficiary);
    const duration = Date.now() - start;
    
    console.log(`\n=== 2. PDF Generaton Executed in ${duration}ms ===`);
    console.log(`Buffer length/Size: ${pdfBuffer.length} bytes`);
    
    // Check file signature / encoding
    const fileHeaderHex = pdfBuffer.slice(0, 4).toString("hex");
    const fileHeaderString = pdfBuffer.slice(0, 100).toString("utf8");
    
    console.log(`First 4 bytes hex: ${fileHeaderHex}`);
    console.log(`Is standard %PDF- header? ${fileHeaderHex === "25504446" ? "YES" : "NO"}`);
    
    if (fileHeaderHex === "25504446") {
      console.log(`PDF generation succeeded. Header signature: %PDF (hex 25504446)`);
    } else {
      console.log(`PDF generation FAILED and fell back to raw HTML!`);
      console.log(`First 100 characters of fallback content:\n${fileHeaderString}`);
    }
  } catch (error: any) {
    console.error("Fatal error during test run:", error);
  }
}

main().catch(console.error);
