import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runAudit() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== TSPS AUDIT ===");
    const tspsRes = await pool.query("SELECT id, name, code, state_id, contact_email FROM tsps");
    console.log(`Found ${tspsRes.rowCount} TSPs in database:`);
    tspsRes.rows.forEach(r => console.log(`  - ${r.id}: ${r.name} (${r.code}) -> email: ${r.contact_email}`));

    const beneficiariesRes = await pool.query("SELECT id, first_name, last_name, tsp, skill_sector FROM beneficiaries LIMIT 5");
    console.log(`\nSample beneficiaries (${beneficiariesRes.rowCount} total checked):`);
    beneficiariesRes.rows.forEach(r => console.log(`  - ${r.id}: ${r.first_name} ${r.last_name} -> TSP: ${r.tsp}, Sector: ${r.skill_sector}`));

    const admissionsRes = await pool.query("SELECT id, beneficiary_id, tsp_id FROM admissions LIMIT 5");
    console.log(`\nSample admissions (${admissionsRes.rowCount} total checked):`);
    admissionsRes.rows.forEach(r => console.log(`  - Admission: ${r.id} for beneficiary ${r.beneficiary_id} -> TSP: ${r.tsp_id}`));

  } catch (err: any) {
    console.error("Audit error:", err.message);
  } finally {
    await pool.end();
  }
}

runAudit();
