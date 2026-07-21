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
