import dotenv from "dotenv";
dotenv.config();
import { getPgPool, checkPgStatus } from "./src/backend/db";

async function runInspection() {
  console.log("Checking DB status...");
  const active = await checkPgStatus();
  if (!active) {
    console.error("PG is not active/configured.");
    return;
  }

  const pool = getPgPool();
  if (!pool) {
    console.error("Could not get PG pool.");
    return;
  }

  console.log("\n=== A. COLUMNS AND TYPES ===");
  const colRes = await pool.query(`
    SELECT
      column_name,
      data_type,
      udt_name,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'reporting_roster_members'
    ORDER BY ordinal_position;
  `);
  console.table(colRes.rows);

  console.log("\n=== B. CONSTRAINTS ===");
  try {
    const consRes = await pool.query(`
      SELECT
        c.conname,
        c.contype,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.conrelid = 'reporting_roster_members'::regclass
      ORDER BY c.conname;
    `);
    console.table(consRes.rows);
  } catch (err: any) {
    console.error("Error fetching constraints:", err.message);
  }

  console.log("\n=== C. INDEXES ===");
  try {
    const indRes = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'reporting_roster_members'
      ORDER BY indexname;
    `);
    console.table(indRes.rows);
  } catch (err: any) {
    console.error("Error fetching indexes:", err.message);
  }

  console.log("\n=== D. DUPLICATE ROSTER/BENEFICIARY PAIRS ===");
  try {
    const dupRes = await pool.query(`
      SELECT
        roster_id,
        beneficiary_id,
        COUNT(*) AS row_count,
        COUNT(*) FILTER (WHERE removed_at IS NULL) AS active_count
      FROM reporting_roster_members
      GROUP BY roster_id, beneficiary_id
      HAVING COUNT(*) > 1
          OR COUNT(*) FILTER (WHERE removed_at IS NULL) > 1
      ORDER BY row_count DESC;
    `);
    console.table(dupRes.rows);
  } catch (err: any) {
    console.error("Error fetching duplicates:", err.message);
  }

  console.log("\n=== E. ROW COUNT OF TABLE ===");
  try {
    const countRes = await pool.query(`SELECT COUNT(*)::int as count FROM reporting_roster_members`);
    console.log("Total row count in reporting_roster_members:", countRes.rows[0].count);
  } catch (err: any) {
    console.error("Error fetching row count:", err.message);
  }
}

runInspection().catch(console.error);
