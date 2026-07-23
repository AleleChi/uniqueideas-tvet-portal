import { normalizeAttendanceStatus } from "./annex9Report.service.js";
import { generateOfficialAnnex9Workbook } from "./excelExport.js";
import { initDb } from "./db.js";

async function runTests() {
  console.log("========================================");
  console.log("🧪 RUNNING ANNEX 9 REGRESSION TEST SUITE");
  console.log("========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- TEST CASE 1: Attendance Status Normalization ---
  try {
    console.log("--- Test Case 1: Status Normalization ---");
    assert(normalizeAttendanceStatus("PRESENT") === "PRESENT", "PRESENT is preserved");
    assert(normalizeAttendanceStatus("present") === "PRESENT", "present (lowercase) is uppercase-normalized");
    assert(normalizeAttendanceStatus(" PRESENT  ") === "PRESENT", "Whitespace is trimmed");
    assert(normalizeAttendanceStatus("FIELDWORK") === "PRESENT", "FIELDWORK maps to PRESENT");
    assert(normalizeAttendanceStatus("fieldwork") === "PRESENT", "fieldwork (lowercase) maps to PRESENT");
    assert(normalizeAttendanceStatus("LATE") === "LATE", "LATE is preserved");
    assert(normalizeAttendanceStatus("late") === "LATE", "late (lowercase) maps to LATE");
    assert(normalizeAttendanceStatus("EXCUSED") === "EXCUSED", "EXCUSED is preserved");
    assert(normalizeAttendanceStatus("excused") === "EXCUSED", "excused maps to EXCUSED");
    assert(normalizeAttendanceStatus("HOLIDAY") === "HOLIDAY", "HOLIDAY is preserved");
    assert(normalizeAttendanceStatus("holiday") === "HOLIDAY", "holiday maps to HOLIDAY");
    assert(normalizeAttendanceStatus("ABSENT") === "ABSENT", "ABSENT maps to ABSENT");
    assert(normalizeAttendanceStatus("unmarked_or_junk") === "ABSENT", "Junk statuses default to ABSENT");
  } catch (err: any) {
    console.error("Test Case 1 failed with error:", err);
    failed++;
  }

  // --- TEST CASE 2: Official Workbook Sheet Constraints ---
  try {
    console.log("\n--- Test Case 2: Workbook Sheet Constraints ---");
    
    // Initialize DB to fetch whatever metadata or configuration is active
    try {
      await initDb();
    } catch (dbErr) {
      // If DB is offline or in development container, catch gracefully
      console.log("Database offline or initializing; continuing integration test...");
    }

    const options = {
      month: "2026-06",
      tspId: "all"
    };

    const workbook = await generateOfficialAnnex9Workbook(options);
    assert(workbook !== null, "Workbook generation succeeds");
    
    const sheets = workbook.worksheets;
    assert(sheets.length === 2, `Workbook contains exactly 2 sheets (got ${sheets.length})`);
    
    const sheetNames = sheets.map(s => s.name);
    assert(sheetNames.includes("TRAINEE PROFILE"), "Workbook has TRAINEE PROFILE sheet");
    assert(sheetNames.includes("ATTENDANCE"), "Workbook has ATTENDANCE sheet");
    assert(!sheetNames.includes("TVET-PORTAL"), "Workbook does NOT contain TVET-PORTAL (sheet 3 successfully deprecated/removed)");

  } catch (err: any) {
    console.error("Test Case 2 failed with error:", err);
    failed++;
  }

  // --- TEST CASE 3: Canonical Bank Matcher & Sort-Code Normalization ---
  try {
    console.log("\n--- Test Case 3: Canonical Bank Matcher & Normalization ---");
    const { resolveOfficialBankMatch, normalizeSortCode } = await import("./bankReconciliation.service.js");

    // Check normalization
    assert(normalizeSortCode(33) === "033", "numeric 33 normalizes to '033'");
    assert(normalizeSortCode("33") === "033", "string '33' normalizes to '033'");
    assert(normalizeSortCode("033") === "033", "string '033' normalizes to '033'");
    assert(normalizeSortCode(70) === "070", "numeric 70 normalizes to '070'");
    assert(normalizeSortCode("070") === "070", "string '070' normalizes to '070'");
    assert(normalizeSortCode("1234") === "INVALID_FORMAT", "'1234' is INVALID_FORMAT");
    assert(normalizeSortCode("abc") === "INVALID_FORMAT", "non-numeric is INVALID_FORMAT");

    // Check UBA aliases
    assert(resolveOfficialBankMatch("UBA", "033").status === "MATCHED", "UBA + '033' is MATCHED");
    assert(resolveOfficialBankMatch("UBA PLC", "033").status === "MATCHED", "UBA PLC + '033' is MATCHED");
    assert(resolveOfficialBankMatch("United Bank for Africa", "033").status === "MATCHED", "United Bank for Africa + '033' is MATCHED");
    assert(resolveOfficialBankMatch("United Bank Of Africa", "033").status === "MATCHED", "United Bank Of Africa + '033' is MATCHED");
    assert(resolveOfficialBankMatch("United Bank For Africa", "033").status === "MATCHED", "United Bank For Africa + '033' is MATCHED");
    assert(resolveOfficialBankMatch("United Bank of Africa Plc", "033").status === "MATCHED", "United Bank of Africa Plc + '033' is MATCHED");

    // Check Fidelity aliases
    assert(resolveOfficialBankMatch("Fidelity Bank", "070").status === "MATCHED", "Fidelity Bank + '070' is MATCHED");
    assert(resolveOfficialBankMatch("Fidelity Bank PLC", "070").status === "MATCHED", "Fidelity Bank PLC + '070' is MATCHED");
    assert(resolveOfficialBankMatch("FIDELITY BANK PLC", "070").status === "MATCHED", "FIDELITY BANK PLC + '070' is MATCHED");

    // Check Union Bank aliases
    assert(resolveOfficialBankMatch("Union Bank", "032").status === "MATCHED", "Union Bank + '032' is MATCHED");
    assert(resolveOfficialBankMatch("Union Bank of Nigeria", "032").status === "MATCHED", "Union Bank of Nigeria + '032' is MATCHED");
    assert(resolveOfficialBankMatch("Union Bank Of Nigeria", "032").status === "MATCHED", "Union Bank Of Nigeria + '032' is MATCHED");
    assert(resolveOfficialBankMatch("UNION BANK OF NIG. PLC", "032").status === "MATCHED", "UNION BANK OF NIG. PLC + '032' is MATCHED");

    // Check other banks
    assert(resolveOfficialBankMatch("Access Bank", "044").status === "MATCHED", "Access Bank + '044' is MATCHED");
    assert(resolveOfficialBankMatch("Guaranty Trust Bank", "058").status === "MATCHED", "Guaranty Trust Bank + '058' is MATCHED");
    assert(resolveOfficialBankMatch("GTBank", "058").status === "MATCHED", "GTBank + '058' is MATCHED");
    assert(resolveOfficialBankMatch("GTB", "058").status === "MATCHED", "GTB + '058' is MATCHED");
    assert(resolveOfficialBankMatch("Ecobank", "050").status === "MATCHED", "Ecobank + '050' is MATCHED");
    assert(resolveOfficialBankMatch("Ecobank Nigeria", "050").status === "MATCHED", "Ecobank Nigeria + '050' is MATCHED");

    // Check mismatches
    assert(resolveOfficialBankMatch("Fidelity Bank", "123").status === "MISMATCH", "Fidelity Bank + '123' is MISMATCH");
    assert(resolveOfficialBankMatch("UBA", "123").status === "MISMATCH", "UBA + '123' is MISMATCH");

  } catch (err: any) {
    console.error("Test Case 3 failed with error:", err);
    failed++;
  }

  // --- SUMMARY ---
  console.log("\n========================================");
  console.log(`🏁 TEST RUN SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("========================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Unhandled test execution error:", err);
  process.exit(1);
});
