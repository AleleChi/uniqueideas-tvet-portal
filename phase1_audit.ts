import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runAudit() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== PHASE 1 - READ-ONLY LIVE DATABASE AUDIT ===");

    const tspId = "00000000-0000-0000-0000-000000000001";

    // B. Count Unique trainees through every possible mapping and show status distribution
    console.log("\n--- B. Beneficiary status distribution for Unique TSP ---");
    const resB = await pool.query(`
      SELECT tsp_id, tsp, status, COUNT(*)
      FROM beneficiaries
      WHERE deleted_at IS NULL
        AND (tsp_id = $1 OR lower(coalesce(tsp,'')) LIKE '%unique%technology%')
      GROUP BY tsp_id, tsp, status
      ORDER BY status;
    `, [tspId]);
    console.table(resB.rows);

    // C. Count funnel for the report query
    console.log("\n--- C. Count Funnel for Unique TSP ---");
    const funnel1 = await pool.query(`
      SELECT COUNT(*) FROM beneficiaries 
      WHERE deleted_at IS NULL AND tsp_id = $1
    `, [tspId]);
    console.log("1. All non-deleted trainees assigned to Unique:", funnel1.rows[0].count);

    const funnel2 = await pool.query(`
      SELECT COUNT(*) FROM beneficiaries 
      WHERE deleted_at IS NULL AND tsp_id = $1 AND status IN ('VERIFIED', 'IN_TRAINING')
    `, [tspId]);
    console.log("2. Active status filter (VERIFIED or IN_TRAINING):", funnel2.rows[0].count);

    const funnel3 = await pool.query(`
      SELECT COUNT(*) FROM beneficiaries b
      JOIN trainee_profiles p ON b.id = p.beneficiary_id
      WHERE b.deleted_at IS NULL AND b.tsp_id = $1
    `, [tspId]);
    console.log("3. Assigned to Unique with trainee_profiles row:", funnel3.rows[0].count);

    const funnel4 = await pool.query(`
      SELECT COUNT(DISTINCT b.id) FROM beneficiaries b
      JOIN trainee_attendance ta ON b.id = ta.beneficiary_id
      WHERE b.deleted_at IS NULL AND b.tsp_id = $1
    `, [tspId]);
    console.log("4. Assigned to Unique with ANY attendance records:", funnel4.rows[0].count);

    const funnel5 = await pool.query(`
      SELECT COUNT(DISTINCT b.id) FROM beneficiaries b
      JOIN trainee_attendance ta ON b.id = ta.beneficiary_id
      WHERE b.deleted_at IS NULL AND b.tsp_id = $1
        AND ta.attendance_date >= '2026-06-01' AND ta.attendance_date < '2026-07-01'
    `, [tspId]);
    console.log("5. Assigned to Unique with attendance in June 2026:", funnel5.rows[0].count);

    // D. Audit both attendance stores
    console.log("\n--- D. Audit both attendance stores ---");
    const taAudit = await pool.query(`
      SELECT MIN(attendance_date) as min_date, MAX(attendance_date) as max_date, COUNT(*) as count, COUNT(DISTINCT beneficiary_id) as unique_trainees
      FROM trainee_attendance;
    `);
    console.log("trainee_attendance audit:", taAudit.rows[0]);

    const taStatus = await pool.query(`
      SELECT upper(trim(status)) AS status, COUNT(*)
      FROM trainee_attendance
      GROUP BY upper(trim(status))
      ORDER BY 2 DESC;
    `);
    console.log("trainee_attendance status distribution:");
    console.table(taStatus.rows);

    const taMonthly = await pool.query(`
      SELECT date_trunc('month', attendance_date)::date AS month,
             COUNT(*) AS records,
             COUNT(DISTINCT beneficiary_id) AS trainees
      FROM trainee_attendance
      GROUP BY 1
      ORDER BY 1;
    `);
    console.log("trainee_attendance records by month:");
    console.table(taMonthly.rows);

    // E. Find orphaned or mismatched attendance
    console.log("\n--- E. Orphaned or mismatched attendance ---");
    const taOrphans = await pool.query(`
      SELECT COUNT(*)
      FROM trainee_attendance ta
      LEFT JOIN beneficiaries b ON b.id = ta.beneficiary_id
      WHERE b.id IS NULL;
    `);
    console.log("Orphaned rows count:", taOrphans.rows[0].count);

    const taMismatches = await pool.query(`
      SELECT b.tsp_id, b.tsp, COUNT(*)
      FROM trainee_attendance ta
      JOIN beneficiaries b ON b.id = ta.beneficiary_id
      GROUP BY b.tsp_id, b.tsp;
    `);
    console.log("Mismatches/groupings:");
    console.table(taMismatches.rows);

  } catch (err: any) {
    console.error("Error during audit:", err);
  } finally {
    await pool.end();
  }
}

runAudit();
