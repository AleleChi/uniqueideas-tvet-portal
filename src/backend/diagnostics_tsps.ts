import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const tspRes = await pool.query(
      `SELECT id, name, code, contact_email, tenant_id, state_id, state, lga, deleted_at
       FROM tsps`
    );
    console.log("ALL TSPS:");
    console.table(tspRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
