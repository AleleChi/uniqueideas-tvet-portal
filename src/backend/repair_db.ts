import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runRepair() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== REPAIRING UNIQUE TSP & ACCOUNT LINK ===");

    // 1. Resolve State (Imo)
    const stateRes = await pool.query("SELECT id FROM states WHERE name = 'Imo' LIMIT 1");
    if (stateRes.rows.length === 0) {
      throw new Error("Could not find Imo state in database");
    }
    const stateImoId = stateRes.rows[0].id;
    console.log(`Imo State ID resolved: ${stateImoId}`);

    // 2. Create or Find TSP Tenant
    let tenantId: string;
    const tenantCheck = await pool.query(
      `SELECT id FROM tenants WHERE name = 'Unique Technology Nig. Ltd Tenant' AND tier = 'TSP'`
    );

    if (tenantCheck.rows.length > 0) {
      tenantId = tenantCheck.rows[0].id;
      console.log(`Existing TSP tenant found: ${tenantId}`);
    } else {
      const tenantInsert = await pool.query(
        `INSERT INTO tenants (name, domain, tier, is_active, created_at, updated_at)
         VALUES ('Unique Technology Nig. Ltd Tenant', 'unique.tvet.local', 'TSP', true, NOW(), NOW())
         RETURNING id`
      );
      tenantId = tenantInsert.rows[0].id;
      console.log(`Created new TSP tenant: ${tenantId}`);
    }

    // 3. Update Unique TSP record
    const tspId = '00000000-0000-0000-0000-000000000001';
    const tspUpdate = await pool.query(
      `UPDATE tsps
       SET tenant_id = $1,
           state_id = $2,
           state = 'Imo',
           lga = 'Owerri Municipal',
           account_status = 'ACTIVE',
           profile_completed = true
       WHERE id = $3`,
      [tenantId, stateImoId, tspId]
    );
    console.log(`Updated TSP ${tspId} record. Rows affected: ${tspUpdate.rowCount}`);

    // 4. Update User account uniqueideasproject@gmail.com
    const userUpdate = await pool.query(
      `UPDATE users
       SET role = 'TSP_ADMIN',
           tsp_id = $1,
           tenant_id = $2,
           state_id = $3,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER('uniqueideasproject@gmail.com')`,
      [tspId, tenantId, stateImoId]
    );
    console.log(`Updated user uniqueideasproject@gmail.com record. Rows affected: ${userUpdate.rowCount}`);

    // 5. Invalidate existing sessions for this user to force clean re-login
    const sessionsDelete = await pool.query(
      `DELETE FROM user_sessions
       WHERE user_id IN (
         SELECT id FROM users WHERE LOWER(email) = LOWER('uniqueideasproject@gmail.com')
       )`
    );
    console.log(`Invalidated existing sessions. Rows deleted: ${sessionsDelete.rowCount}`);

    console.log("=== REPAIR COMPLETED SUCCESSFULLY ===");

  } catch (err) {
    console.error("Repair error:", err);
  } finally {
    await pool.end();
  }
}

runRepair();
