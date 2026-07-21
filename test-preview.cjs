const { Client } = require('pg');

async function runTest() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ideas' });
  await client.connect();

  const tspId = "b9bf8b5d-bf68-450f-a492-95dfc0bb38f8"; // Let's try to query first to find a valid tspId
  console.log("Using Database URL:", process.env.DATABASE_URL ? "Exists" : "Missing");

  try {
    // 1. Let's find an active TSP or any TSP in beneficiaries to use for testing
    const tspRes = await client.query("SELECT DISTINCT tsp_id FROM beneficiaries WHERE tsp_id IS NOT NULL LIMIT 1");
    let testTspId = tspRes.rows[0]?.tsp_id || tspId;
    console.log("Selected Test TSP ID:", testTspId);

    // 2. Query training_schedules
    console.log("--- QUERYING TRAINING SCHEDULES ---");
    const scheduleRes = await client.query(
      `SELECT start_date, end_date FROM training_schedules WHERE tsp_id = $1::uuid AND active = TRUE LIMIT 1`,
      [testTspId]
    );
    console.log("Schedule Rows:", scheduleRes.rows);

    // 3. Query exceptions
    console.log("--- QUERYING SCHEDULE EXCEPTIONS ---");
    const exceptionsRes = await client.query(
      `SELECT exception_date, exception_type FROM training_schedule_exceptions WHERE tsp_id = $1::uuid`,
      [testTspId]
    );
    console.log("Exceptions Count:", exceptionsRes.rows.length);

    // 4. Query beneficiaries with OFFICIAL_ROSTER scope
    console.log("--- QUERYING BENEFICIARIES (OFFICIAL_ROSTER) ---");
    let traineesQuery = `
      SELECT b.id, b.first_name, b.last_name, b.batch as cohort, b.batch, b.id as tvet_id 
      FROM beneficiaries b
      INNER JOIN reporting_roster_members rrm ON b.id = rrm.beneficiary_id AND rrm.removed_at IS NULL
      INNER JOIN reporting_rosters rr ON rrm.roster_id = rr.id AND rr.is_active = TRUE
      WHERE b.deleted_at IS NULL
    `;
    let pIdx = 1;
    let traineesParams = [];
    if (testTspId) {
      traineesQuery += ` AND rr.tsp_id = $${pIdx++} AND b.tsp_id::text = rr.tsp_id`;
      traineesParams.push(testTspId);
    }
    traineesQuery += ` ORDER BY b.last_name ASC, b.first_name ASC`;
    console.log("Query:", traineesQuery);
    console.log("Params:", traineesParams);
    const traineesRes = await client.query(traineesQuery, traineesParams);
    console.log("Official Roster Trainees Count:", traineesRes.rows.length);

    // 5. Query beneficiaries with ALL_ELIGIBLE scope
    console.log("--- QUERYING BENEFICIARIES (ALL_ELIGIBLE) ---");
    let allQuery = `
      SELECT b.id, b.first_name, b.last_name, b.batch as cohort, b.batch, b.id as tvet_id 
      FROM beneficiaries b
      WHERE b.deleted_at IS NULL
    `;
    let allParams = [];
    let pIdxAll = 1;
    if (testTspId) {
      allQuery += ` AND b.tsp_id = $${pIdxAll++}::uuid`;
      allParams.push(testTspId);
    }
    console.log("Query:", allQuery);
    const allRes = await client.query(allQuery, allParams);
    console.log("All Eligible Trainees Count:", allRes.rows.length);

    // 6. Test existing attendance retrieval
    console.log("--- QUERYING EXISTING ATTENDANCE ---");
    const testIds = allRes.rows.slice(0, 5).map(t => t.id);
    const testDates = ["2026-06-15", "2026-06-17", "2026-06-19"];
    if (testIds.length > 0) {
      const existingRes = await client.query(
        `SELECT beneficiary_id, attendance_date, status FROM trainee_attendance WHERE beneficiary_id = ANY($1) AND attendance_date = ANY($2)`,
        [testIds, testDates]
      );
      console.log("Existing attendance count:", existingRes.rows.length);
    } else {
      console.log("No trainees to query attendance for.");
    }

  } catch (err) {
    console.error("TEST FAILED WITH ERROR:", err);
  } finally {
    await client.end();
  }
}

runTest();
