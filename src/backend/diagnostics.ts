import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runDiagnostics() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== PHASE 1 DIAGNOSTICS ===");

    // 1. Check users table for uniqueideasproject@gmail.com
    console.log("\n--- 1. Users matching uniqueideasproject@gmail.com ---");
    const userRes = await pool.query(
      `SELECT id, email, role, tenant_id, state_id, tsp_id, deleted_at
       FROM users
       WHERE LOWER(email) = LOWER('uniqueideasproject@gmail.com')`
    );
    console.table(userRes.rows);

    // 2. Check TSPs matching Unique, or email, or legacy UUID
    console.log("\n--- 2. TSPs matching Unique or the user email ---");
    const tspRes = await pool.query(
      `SELECT id, name, code, contact_email, tenant_id, state_id, state, lga, deleted_at
       FROM tsps
       WHERE LOWER(name) LIKE '%unique%'
          OR LOWER(contact_email) = LOWER('uniqueideasproject@gmail.com')
          OR id = '00000000-0000-0000-0000-000000000001'`
    );
    console.table(tspRes.rows);

    // 3. Check active session payloads for this user
    console.log("\n--- 3. Active sessions for uniqueideasproject@gmail.com ---");
    const sessionsRes = await pool.query(
      `SELECT us.id, us.user_id, us.expires_at, us.tenant_id, us.tenant_tier, us.state_id, us.tsp_id,
              u.email, u.role, u.tenant_id AS user_tenant_id, u.state_id AS user_state_id, u.tsp_id AS user_tsp_id
       FROM user_sessions us
       JOIN users u ON u.id = us.user_id
       WHERE LOWER(u.email) = LOWER('uniqueideasproject@gmail.com')
       ORDER BY us.created_at DESC`
    );
    console.table(sessionsRes.rows);

    // 4. If we found a Unique TSP ID, count beneficiaries
    if (tspRes.rows.length > 0) {
      const tspId = tspRes.rows[0].id;
      console.log(`\n--- 4. Beneficiaries for Unique TSP (id=${tspId}) ---`);
      const benRes = await pool.query(
        `SELECT COUNT(*) AS trainee_count
         FROM beneficiaries
         WHERE deleted_at IS NULL
           AND tsp_id = $1`,
        [tspId]
      );
      console.table(benRes.rows);
    }

  } catch (err: any) {
    console.error("Diagnostics execution error:", err);
  } finally {
    await pool.end();
  }
}

runDiagnostics();
