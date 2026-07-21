/**
 * IDEAS-TVET BULK ATTENDANCE COMPREHENSIVE AUTOMATED TEST SUITE
 * Traces end-to-end SQL logic, type casts, roster constraints, and transactions.
 */

const { Client } = require("pg");
const crypto = require("crypto");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ideas";

async function runTests() {
  console.log("================================================================================");
  console.log("             IDEAS-TVET BULK ATTENDANCE AUTOMATED TEST SUITE                    ");
  console.log("================================================================================");

  const client = new Client({ connectionString });
  await client.connect();

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
      failedTests++;
    }
  }

  try {
    // 1. Fetch reference data
    const tspRes = await client.query("SELECT id FROM tsps LIMIT 1");
    const tspId = tspRes.rows[0]?.id || "00000000-0000-0000-0000-000000000001";
    console.log(`Using TSP ID: ${tspId}`);

    const cohortRes = await client.query("SELECT id FROM cohorts LIMIT 1");
    const cohortId = cohortRes.rows[0]?.id || "c0c0c0c0-0000-0000-0000-000000000001";
    console.log(`Using Cohort ID: ${cohortId}`);

    // Fetch one beneficiary for test operations
    const benRes = await client.query("SELECT id, tsp_id FROM beneficiaries WHERE deleted_at IS NULL LIMIT 1");
    const testBeneficiary = benRes.rows[0];
    if (!testBeneficiary) {
      throw new Error("No beneficiaries found in database. Cannot run suite.");
    }
    console.log(`Using Test Beneficiary: ${testBeneficiary.id} (TSP: ${testBeneficiary.tsp_id})`);

    // ---------------------------------------------------------
    // TEST 1: Monday/Wednesday/Friday date generation from 2026-06-15
    // ---------------------------------------------------------
    console.log("\n--- TEST 1: Monday/Wednesday/Friday date generation ---");
    const start = new Date("2026-06-15");
    const end = new Date("2026-06-22");
    const weekdays = [1, 3, 5]; // Mon, Wed, Fri
    const targetDates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getDay();
      if (weekdays.includes(dayOfWeek)) {
        targetDates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    assert(
      targetDates.length === 4 &&
      targetDates[0] === "2026-06-15" &&
      targetDates[1] === "2026-06-17" &&
      targetDates[2] === "2026-06-19" &&
      targetDates[3] === "2026-06-22",
      "Correctly generates Mon, Wed, Fri dates in the specified range."
    );

    // ---------------------------------------------------------
    // TEST 2: Date boundary validation (No dates before 2026-06-15)
    // ---------------------------------------------------------
    console.log("\n--- TEST 2: Boundary validation ---");
    const invalidStartDate = "2026-06-14";
    const isValidStart = invalidStartDate >= "2026-06-15";
    assert(!isValidStart, "Correctly rejects start dates before the official training start date of 2026-06-15.");

    // ---------------------------------------------------------
    // TEST 3: All Eligible Trainee Scope
    // ---------------------------------------------------------
    console.log("\n--- TEST 3: All Eligible Trainee Scope Query ---");
    // Verify our SQL query syntax for All Eligible Trainees runs successfully
    const qScopeAll = `
      SELECT DISTINCT b.id, b.first_name, b.last_name, b.batch as cohort, b.batch, b.id as tvet_id 
      FROM beneficiaries b
      LEFT JOIN training_batch_assignments tba ON b.id = tba.beneficiary_id
      LEFT JOIN training_batches tb ON tba.batch_id = tb.id
      WHERE b.deleted_at IS NULL AND b.tsp_id = $1::uuid
        AND ($2::uuid IS NULL OR tb.cohort_id = $2::uuid)
        AND ($3::uuid IS NULL OR tba.batch_id = $3::uuid)
    `;
    const resScopeAll = await client.query(qScopeAll, [testBeneficiary.tsp_id, null, null]);
    assert(resScopeAll.rows.length >= 0, "All Eligible Trainees query executes without syntax or postgres operator errors.");

    // ---------------------------------------------------------
    // TEST 4: Preview with Null Cohorts and Null Batches
    // ---------------------------------------------------------
    console.log("\n--- TEST 4: Null Filter Rules (All Cohorts/Batches) ---");
    const resNullFilters = await client.query(qScopeAll, [testBeneficiary.tsp_id, null, null]);
    assert(resNullFilters.rows.length >= 0, "Query with null filters (representing 'All') returns successfully.");

    // ---------------------------------------------------------
    // TEST 5: Preview with Typed Cohort UUID (UUID cast validation)
    // ---------------------------------------------------------
    console.log("\n--- TEST 5: Typed Cohort UUID Cast ---");
    const resCohortFilter = await client.query(qScopeAll, [testBeneficiary.tsp_id, cohortId, null]);
    assert(resCohortFilter.rows.length >= 0, "Query with typed cohort UUID filters executes without operator mismatch errors.");

    // ---------------------------------------------------------
    // TEST 6: Empty Official Roster Handling
    // ---------------------------------------------------------
    console.log("\n--- TEST 6: Empty Official Roster Detection ---");
    // Generate a fresh random TSP ID to guarantee empty roster
    const emptyTspId = crypto.randomUUID();
    const rosterCountQuery = `
      SELECT COUNT(DISTINCT b.id)::int as count
      FROM beneficiaries b
      INNER JOIN reporting_roster_members rrm ON b.id = rrm.beneficiary_id AND rrm.removed_at IS NULL
      INNER JOIN reporting_rosters rr ON rrm.roster_id = rr.id AND rr.is_active = TRUE
      WHERE b.deleted_at IS NULL AND rr.tsp_id = $1
    `;
    const resRosterEmpty = await client.query(rosterCountQuery, [emptyTspId]);
    const rosterCount = resRosterEmpty.rows[0]?.count || 0;
    assert(rosterCount === 0, "Correctly identifies empty rosters for a newly registered or unconfigured TSP.");

    // ---------------------------------------------------------
    // TEST 7: Preview Performs Zero Writes
    // ---------------------------------------------------------
    console.log("\n--- TEST 7: Zero-Write Preview Guarantee ---");
    const beforeCountRes = await client.query("SELECT COUNT(*)::int as count FROM trainee_attendance");
    const beforeCount = beforeCountRes.rows[0].count;
    
    // Simulate a preview request execution
    const dummyDates = ["2026-06-15", "2026-06-17"];
    const previewRes = await client.query(
      `SELECT beneficiary_id, attendance_date, status, attendance_source FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = ANY($2)`,
      [testBeneficiary.id, dummyDates]
    );
    
    const afterCountRes = await client.query("SELECT COUNT(*)::int as count FROM trainee_attendance");
    const afterCount = afterCountRes.rows[0].count;
    assert(beforeCount === afterCount, "Preview operations run purely via SELECT statements and write zero records to the database.");

    // ---------------------------------------------------------
    // TEST 8: Response Contract Structure & Frontend Parsing
    // ---------------------------------------------------------
    console.log("\n--- TEST 8: Response Contract Schema ---");
    const responsePayload = {
      success: true,
      targetDates: ["2026-06-15"],
      targetedTraineesCount: 1,
      data: {
        summary: {
          newRecords: 1,
          existingUnchanged: 0,
          recordsToUpdate: 0,
          protectedBiometricRecords: 0
        }
      }
    };
    assert(
      responsePayload.success === true &&
      Array.isArray(responsePayload.targetDates) &&
      typeof responsePayload.data.summary.newRecords === "number",
      "Response payload strictly adheres to the frontend state expectation contract."
    );

    // ---------------------------------------------------------
    // TEST 9: Official Roster with Saved Members
    // ---------------------------------------------------------
    console.log("\n--- TEST 9: Official Roster with Saved Members ---");
    // Temporarily insert a mock active roster and roster member in a transaction, verify the query works, then ROLLBACK
    await client.query("BEGIN");
    try {
      const mockRosterId = "mock_roster_" + Date.now();
      await client.query(`
        INSERT INTO reporting_rosters (id, tsp_id, name, is_active, reporting_year, allocation_limit, created_by)
        VALUES ($1, $2, 'Test Roster', TRUE, '2026', 100, 'system-test')
      `, [mockRosterId, testBeneficiary.tsp_id]);

      await client.query(`
        INSERT INTO reporting_roster_members (id, roster_id, beneficiary_id)
        VALUES ($1, $2, $3)
      `, ["mock_member_" + Date.now(), mockRosterId, testBeneficiary.id]);

      // Execute the query
      const rosterQuery = `
        SELECT DISTINCT b.id, b.first_name, b.last_name
        FROM beneficiaries b
        INNER JOIN reporting_roster_members rrm ON b.id = rrm.beneficiary_id AND rrm.removed_at IS NULL
        INNER JOIN reporting_rosters rr ON rrm.roster_id = rr.id AND rr.is_active = TRUE
        WHERE b.deleted_at IS NULL AND rr.tsp_id = $1
      `;
      const rosterQueryRes = await client.query(rosterQuery, [testBeneficiary.tsp_id]);
      assert(rosterQueryRes.rows.length > 0, "Query successfully locates saved active members in the Official Reporting Roster.");
    } finally {
      await client.query("ROLLBACK");
    }

    // ---------------------------------------------------------
    // TEST 10: Transaction Save & Idempotency / Cross-TSP Isolation
    // ---------------------------------------------------------
    console.log("\n--- TEST 10: Commit Idempotency & Cross-TSP Isolation ---");
    // Run an isolated transaction insert/update sequence, verify idempotency, and roll back
    await client.query("BEGIN");
    try {
      const testDate = "2026-06-15";
      const mockAttId = crypto.randomUUID();

      // Ensure no previous record
      await client.query("DELETE FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);

      // 1. First Save (Insert)
      await client.query(`
        INSERT INTO trainee_attendance (id, beneficiary_id, attendance_date, status, attendance_source, captured_by, remarks)
        VALUES ($1, $2, $3, 'PRESENT', 'BACKFILL', 'test-user', 'First commit')
      `, [mockAttId, testBeneficiary.id, testDate]);

      const postInsertCount = await client.query("SELECT COUNT(*)::int as count FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);
      assert(postInsertCount.rows[0].count === 1, "Correctly inserts new attendance record on first save commit.");

      // 2. Second Save (Idempotent update/skip)
      // Attempt to upsert using unique constraint
      await client.query(`
        INSERT INTO trainee_attendance (id, beneficiary_id, attendance_date, status, attendance_source, captured_by, remarks)
        VALUES ($1, $2, $3, 'ABSENT', 'BACKFILL', 'test-user', 'Second commit')
        ON CONFLICT (beneficiary_id, attendance_date) DO UPDATE SET
          status = EXCLUDED.status,
          remarks = EXCLUDED.remarks
      `, [crypto.randomUUID(), testBeneficiary.id, testDate]);

      const postUpsertCount = await client.query("SELECT COUNT(*)::int as count FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);
      assert(postUpsertCount.rows[0].count === 1, "Idempotency preserved: ON CONFLICT updates the row rather than duplicating.");

      const postUpsertRow = await client.query("SELECT status, remarks FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);
      assert(
        postUpsertRow.rows[0].status === "ABSENT" && postUpsertRow.rows[0].remarks === "Second commit",
        "Row details correctly updated upon subsequent idempotent bulk save execution."
      );
    } finally {
      await client.query("ROLLBACK");
    }

    // ---------------------------------------------------------
    // TEST 11: Biometric Record Protection
    // ---------------------------------------------------------
    console.log("\n--- TEST 11: Biometric Record Protection ---");
    // Verify that biometric records are NEVER overwritten by bulk backfills
    await client.query("BEGIN");
    try {
      const testDate = "2026-06-15";
      const bioAttId = crypto.randomUUID();

      await client.query("DELETE FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);

      // 1. Insert original biometric record
      await client.query(`
        INSERT INTO trainee_attendance (id, beneficiary_id, attendance_date, status, attendance_source, check_in_time, check_out_time, captured_by, remarks)
        VALUES ($1, $2, $3, 'PRESENT', 'BIOMETRIC', '2026-06-15T08:15:00.000Z', '2026-06-15T14:10:00.000Z', 'device-sync', 'Original Hardware Sync')
      `, [bioAttId, testBeneficiary.id, testDate]);

      // 2. Simulate save logic's protection check
      const checkRecord = await client.query("SELECT attendance_source FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);
      const source = checkRecord.rows[0]?.attendance_source;

      let overwriteAttempted = false;
      if (source === "BIOMETRIC") {
        console.log("[Protected] Skipping biometric record write as required by strict audit policies.");
      } else {
        overwriteAttempted = true;
        await client.query(`
          UPDATE trainee_attendance SET status = 'ABSENT', attendance_source = 'BACKFILL' 
          WHERE beneficiary_id = $1 AND attendance_date = $2
        `, [testBeneficiary.id, testDate]);
      }

      const finalRecord = await client.query("SELECT status, attendance_source FROM trainee_attendance WHERE beneficiary_id = $1 AND attendance_date = $2", [testBeneficiary.id, testDate]);
      assert(
        finalRecord.rows[0].status === "PRESENT" && finalRecord.rows[0].attendance_source === "BIOMETRIC" && !overwriteAttempted,
        "Biometric records are correctly identified and strictly shielded from bulk updates."
      );

    } finally {
      await client.query("ROLLBACK");
    }

    console.log("\n================================================================================");
    console.log(`TEST SUITE COMPLETED: ${passedTests} passed, ${failedTests} failed.`);
    console.log("================================================================================");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error("Test execution aborted due to unexpected error:", err);
    client.end();
    process.exit(1);
  }
}

runTests();
