import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res1 = await pool.query("SELECT * FROM tenants WHERE name ILIKE '%unique%' OR name ILIKE '%technology%'");
    console.log("Matching Tenants:");
    console.table(res1.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
