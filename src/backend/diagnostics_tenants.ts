import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tenantRes = await pool.query(
      `SELECT * FROM tenants WHERE id = 'a5567a2e-f3b4-4f3a-9426-46483577cad2'`
    );
    console.log("TENANT:");
    console.table(tenantRes.rows);

    const allTenants = await pool.query(
      `SELECT id, name, tier, parent_id FROM tenants`
    );
    console.log("ALL TENANTS:");
    console.table(allTenants.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
