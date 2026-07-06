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
    console.log("Migrating legacy user admission@uniqueideas.dontechservicesconst.com to TSP_ADMIN for Unique TSP...");
    const updateRes = await pool.query(
      `UPDATE users 
       SET role = 'TSP_ADMIN', 
           tsp_id = '00000000-0000-0000-0000-000000000001', 
           tenant_id = 'a5567a2e-f3b4-4f3a-9426-46483577cad2', 
           state_id = 'bc183dd7-3e5e-461c-8f23-b9e888339146',
           updated_at = NOW()
       WHERE email = 'admission@uniqueideas.dontechservicesconst.com' AND id = 'user_adm_unique'`
    );
    console.log(`Update row count: ${updateRes.rowCount}`);

    const usersRes = await pool.query("SELECT * FROM users WHERE email = 'admission@uniqueideas.dontechservicesconst.com'");
    console.log(`Found ${usersRes.rowCount} users for legacy search after migration:`);
    usersRes.rows.forEach(r => {
      console.log(`Legacy User details after migration:`, {
        id: r.id,
        email: r.email,
        role: r.role,
        tsp_id: r.tsp_id,
        tenant_id: r.tenant_id,
        state_id: r.state_id,
        updated_at: r.updated_at
      });
    });

    const tspsRes = await pool.query("SELECT id, name, code, state_id, contact_email, tenant_id FROM tsps");
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
