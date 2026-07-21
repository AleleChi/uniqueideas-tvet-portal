import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runMigration() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== PHASE 2 - REPAIR UNIQUE TSP ACCOUNT MAPPING ===");

    await pool.query("BEGIN;");

    const migrationRes = await pool.query(`
      WITH unique_tsp AS (
        SELECT id, tenant_id, state_id
        FROM tsps
        WHERE lower(name) LIKE '%unique%technology%'
        ORDER BY created_at NULLS LAST
        LIMIT 1
      )
      UPDATE users u
      SET tsp_id = t.id,
          tenant_id = t.tenant_id,
          state_id = t.state_id,
          role = CASE
            WHEN u.role IN ('TSP','TSP_ADMIN','TSP_TRAINING_MANAGER','TSP_REVIEW_OFFICER','ADMIN_OFFICER','REVIEW_OFFICER') THEN u.role
            ELSE 'TSP_ADMIN'
          END,
          updated_at = NOW()
      FROM unique_tsp t
      WHERE lower(u.email) = lower('uniqueideasproject@gmail.com');
    `);

    console.log(`Updated users table row count: ${migrationRes.rowCount}`);

    const deleteSessionsRes = await pool.query(`
      DELETE FROM user_sessions
      WHERE user_id IN (
        SELECT id FROM users WHERE lower(email) = lower('uniqueideasproject@gmail.com')
      );
    `);
    console.log(`Deleted user sessions: ${deleteSessionsRes.rowCount}`);

    await pool.query("COMMIT;");

    // Verify
    const verifyRes = await pool.query(`
      SELECT id, email, role, tenant_id, state_id, tsp_id
      FROM users
      WHERE lower(email) = lower('uniqueideasproject@gmail.com');
    `);
    console.log("Verified User Mapping after migration:", verifyRes.rows);

  } catch (err: any) {
    await pool.query("ROLLBACK;");
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
