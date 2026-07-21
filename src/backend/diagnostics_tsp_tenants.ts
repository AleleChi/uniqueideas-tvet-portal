import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tspTenants = await pool.query(
      `SELECT id, name, tier, parent_id FROM tenants WHERE tier = 'TSP'`
    );
    console.log("TSP TENANTS:");
    console.table(tspTenants.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
