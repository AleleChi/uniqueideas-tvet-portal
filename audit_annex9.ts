import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runAudit() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== START ANNEX 9 FORENSIC AUDIT ===");

    // 1. Attendance totals by source table and month
    console.log("\n--- 1. Attendance Totals by Source Table and Month ---");
    const taTotals = await pool.query(`
      SELECT TO_CHAR(attendance_date, 'YYYY-MM') AS month,
             COUNT(*)::int AS records,
             COUNT(DISTINCT beneficiary_id)::int AS trainees,
             COUNT(DISTINCT attendance_date)::int AS marked_dates
      FROM trainee_attendance
      GROUP BY 1
      ORDER BY 1;
    `);
    console.log("=== trainee_attendance totals ===");
    console.table(taTotals.rows);

    const alTotals = await pool.query(`
      SELECT TO_CHAR(date, 'YYYY-MM') AS month,
             COUNT(*)::int AS records,
             COUNT(DISTINCT beneficiary_id)::int AS trainees,
             COUNT(DISTINCT date)::int AS marked_dates
      FROM attendance_logs
      WHERE deleted_at IS NULL
      GROUP BY 1
      ORDER BY 1;
    `);
    console.log("=== attendance_logs totals ===");
    console.table(alTotals.rows);

    // 2. Status values and bad formatting
    console.log("\n--- 2. Status Values and Normalization Check ---");
    const taStatus = await pool.query(`
      SELECT status,
             UPPER(TRIM(status)) AS normalized_status,
             COUNT(*)::int AS count
      FROM trainee_attendance
      GROUP BY status, UPPER(TRIM(status))
      ORDER BY count DESC;
    `);
    console.log("=== trainee_attendance status values ===");
    console.table(taStatus.rows);

    const alStatus = await pool.query(`
      SELECT status,
             UPPER(TRIM(status)) AS normalized_status,
             COUNT(*)::int AS count
      FROM attendance_logs
      WHERE deleted_at IS NULL
      GROUP BY status, UPPER(TRIM(status))
      ORDER BY count DESC;
    `);
    console.log("=== attendance_logs status values ===");
    console.table(alStatus.rows);

    // 3. Attendance rows that do not join to an active beneficiary
    console.log("\n--- 3. Orphaned Attendance Rows ---");
    const taOrphans = await pool.query(`
      SELECT COUNT(*)::int AS orphan_count
      FROM trainee_attendance ta
      LEFT JOIN beneficiaries b ON b.id = ta.beneficiary_id
      WHERE b.id IS NULL;
    `);
    console.log("Orphan trainee_attendance count:", taOrphans.rows[0].orphan_count);

    // 4. Legacy records that are absent from trainee_attendance
    console.log("\n--- 4. Legacy Only Records (Absent from trainee_attendance) ---");
    const alLegacyOnly = await pool.query(`
      SELECT COUNT(*)::int AS legacy_only_count
      FROM attendance_logs al
      LEFT JOIN trainee_attendance ta
        ON ta.beneficiary_id = al.beneficiary_id
       AND ta.attendance_date = al.date
      WHERE al.deleted_at IS NULL
        AND ta.id IS NULL;
    `);
    console.log("Legacy only count:", alLegacyOnly.rows[0].legacy_only_count);

    // 5. TSP linkage and session scoping
    console.log("\n--- 5. TSP Linkage and Session Scoping ---");
    // Let's get list of TSPs
    const tspsRes = await pool.query(`
      SELECT id, name, code FROM tsps LIMIT 5;
    `);
    console.log("TSPs samples:");
    console.table(tspsRes.rows);

    // Let's query users with TSP role to see their TSP IDs
    const tspUsers = await pool.query(`
      SELECT id, email, role, tsp_id FROM users WHERE role LIKE '%TSP%' LIMIT 5;
    `);
    console.log("TSP Users samples:");
    console.table(tspUsers.rows);

    // Count beneficiaries by tsp_id vs text tsp name
    const bTspCounts = await pool.query(`
      SELECT tsp_id, COUNT(*)::int AS count 
      FROM beneficiaries 
      WHERE deleted_at IS NULL
      GROUP BY tsp_id
      ORDER BY count DESC;
    `);
    console.log("Beneficiaries count grouped by b.tsp_id:");
    console.table(bTspCounts.rows);

    // Let's check for any mismatch where tsp_id is null but tsp string is set
    const bTspStringCounts = await pool.query(`
      SELECT COUNT(*)::int AS count 
      FROM beneficiaries 
      WHERE deleted_at IS NULL AND tsp_id IS NULL AND custom_fields->>'tsp' IS NOT NULL;
    `);
    console.log("Beneficiaries with NULL tsp_id but custom_fields->>'tsp' present:", bTspStringCounts.rows[0].count);

    // Let's audit June records for each TSP
    if (bTspCounts.rows.length > 0) {
      const activeTspId = bTspCounts.rows[0].tsp_id;
      console.log(`\n--- 6. Direct June Reconciliation for top TSP: ${activeTspId} ---`);
      const reconciliationRes = await pool.query(`
        SELECT
          ta.beneficiary_id,
          b.first_name,
          b.last_name,
          COUNT(*) FILTER (WHERE UPPER(TRIM(ta.status)) = 'PRESENT')::int AS present,
          COUNT(*) FILTER (WHERE UPPER(TRIM(ta.status)) = 'LATE')::int AS late,
          COUNT(*) FILTER (WHERE UPPER(TRIM(ta.status)) = 'ABSENT')::int AS absent,
          COUNT(*) FILTER (WHERE UPPER(TRIM(ta.status)) = 'EXCUSED')::int AS excused
        FROM trainee_attendance ta
        JOIN beneficiaries b ON b.id = ta.beneficiary_id
        WHERE ta.attendance_date >= DATE '2026-06-01'
          AND ta.attendance_date < DATE '2026-07-01'
          AND b.deleted_at IS NULL
          AND b.tsp_id = $1
        GROUP BY ta.beneficiary_id, b.first_name, b.last_name
        LIMIT 5;
      `, [activeTspId]);
      console.log(`June attendance reconciliation sample for TSP ${activeTspId}:`);
      console.table(reconciliationRes.rows);

      // Compare at least one trainee
      if (reconciliationRes.rows.length > 0) {
        const traineeId = reconciliationRes.rows[0].beneficiary_id;
        console.log(`\n--- 7. Forensic Check for Trainee: ${traineeId} ---`);
        const bDetail = await pool.query("SELECT first_name, last_name, status, beneficiary_status FROM beneficiaries WHERE id = $1", [traineeId]);
        console.log("Beneficiary detail:", bDetail.rows[0]);
        
        const taCount = await pool.query("SELECT COUNT(*)::int AS count FROM trainee_attendance WHERE beneficiary_id = $1", [traineeId]);
        console.log("trainee_attendance rows count:", taCount.rows[0].count);

        const alCount = await pool.query("SELECT COUNT(*)::int AS count FROM attendance_logs WHERE beneficiary_id = $1 AND deleted_at IS NULL", [traineeId]);
        console.log("attendance_logs rows count:", alCount.rows[0].count);
      }
    }

  } catch (err: any) {
    console.error("Audit error:", err.message);
  } finally {
    await pool.end();
  }
}

runAudit();
