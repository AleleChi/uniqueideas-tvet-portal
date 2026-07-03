import pg from "pg";

const connectionString = "postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log("=== COUNTS FOR UNIQUE TECHNOLOGY NIG. LTD ===");
    
    const tspRes = await client.query("SELECT * FROM tsps WHERE name ILIKE '%Unique Technology%'");
    if (tspRes.rows.length === 0) {
      console.log("Unique Technology Nig. Ltd not found!");
      return;
    }
    const tsp = tspRes.rows[0];
    const tspId = tsp.id;
    console.log(`TSP Name: ${tsp.name}`);
    console.log(`State: ${tsp.state}`);
    console.log(`LGA: ${tsp.lga}`);
    console.log(`Programme Manager: ${tsp.programme_manager}`);

    // Groups on status
    const statRes = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM beneficiaries 
      WHERE tsp_id = $1 AND deleted_at IS NULL
      GROUP BY status
    `, [tspId]);
    console.log("\nBeneficiary status counts:", statRes.rows);

    // Groups on beneficiary_status
    const benStatRes = await client.query(`
      SELECT beneficiary_status, COUNT(*) as count 
      FROM beneficiaries 
      WHERE tsp_id = $1 AND deleted_at IS NULL
      GROUP BY beneficiary_status
    `, [tspId]);
    console.log("\nBeneficiary beneficiary_status counts:", benStatRes.rows);

    // Group on admissions status
    const admStatRes = await client.query(`
      SELECT adm.admission_status, COUNT(*) as count
      FROM admissions adm
      JOIN beneficiaries b ON adm.beneficiary_id = b.id
      WHERE b.tsp_id = $1 AND b.deleted_at IS NULL AND adm.deleted_at IS NULL
      GROUP BY adm.admission_status
    `, [tspId]);
    console.log("\nAdmissions Status counts:", admStatRes.rows);

    // Check specific records with offer/acceptance letters
    const docCountRes = await client.query(`
      SELECT 
        COUNT(CASE WHEN adm.admission_letter_sent_at IS NOT NULL THEN 1 END) as letters_sent,
        COUNT(CASE WHEN adm.acceptance_letter_url IS NOT NULL THEN 1 END) as acceptance_letters,
        COUNT(CASE WHEN adm.admission_form_completed = true THEN 1 END) as form_completed
      FROM admissions adm
      JOIN beneficiaries b ON adm.beneficiary_id = b.id
      WHERE b.tsp_id = $1 AND b.deleted_at IS NULL AND adm.deleted_at IS NULL
    `, [tspId]);
    console.log("\nDocument details:", docCountRes.rows[0]);

    // Check if attendance, assessments, or skill tables exist and have entries
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    if (tables.includes("attendance_sheets")) {
      const shRes = await client.query("SELECT COUNT(*) FROM attendance_sheets");
      console.log("\nTotal attendance_sheets in system:", shRes.rows[0].count);
    } else {
      console.log("\nTable attendance_sheets does NOT exist.");
    }

    if (tables.includes("trainee_attendance")) {
      const attRes = await client.query("SELECT COUNT(*) FROM trainee_attendance");
      console.log("Total trainee_attendance records:", attRes.rows[0].count);
    } else {
      console.log("Table trainee_attendance does NOT exist.");
    }

    if (tables.includes("attendance_logs")) {
      const logsRes = await client.query("SELECT COUNT(*) FROM attendance_logs");
      console.log("Total attendance_logs records:", logsRes.rows[0].count);
    } else {
      console.log("Table attendance_logs does NOT exist.");
    }

    if (tables.includes("assessments")) {
      const asmRes = await client.query("SELECT COUNT(*) FROM assessments");
      console.log("Total assessments records:", asmRes.rows[0].count);
    } else {
      console.log("Table assessments does NOT exist.");
    }

  } catch (err: any) {
    console.error("Query failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
