import pg from "pg";

const connectionString = "postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log("Checking Users...");
    const users = await client.query("SELECT id, email, role, tenant_id, state_id, tsp_id FROM users LIMIT 15");
    console.log("Users found:", users.rows);

  } catch (err: any) {
    console.error("Diagnostic error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
