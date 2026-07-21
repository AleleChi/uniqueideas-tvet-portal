import dotenv from "dotenv";
dotenv.config();
import { getPgPool, checkPgStatus } from "./src/backend/db";

async function createBackup() {
  const active = await checkPgStatus();
  if (!active) {
    console.error("PostgreSQL is not active/configured.");
    return;
  }

  const pool = getPgPool();
  if (!pool) {
    console.error("Could not get PG pool.");
    return;
  }

  const timestamp = "20260720_2005";
  const backupTableName = `reporting_roster_members_backup_${timestamp}`;

  console.log(`Checking row count before backup...`);
  const beforeRes = await pool.query(`SELECT COUNT(*)::int as count FROM reporting_roster_members`);
  const beforeCount = beforeRes.rows[0].count;
  console.log(`Current row count in reporting_roster_members: ${beforeCount}`);

  console.log(`Creating backup table: ${backupTableName}...`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${backupTableName} AS
    SELECT * FROM reporting_roster_members;
  `);

  console.log(`Verifying backup table row count...`);
  const backupRes = await pool.query(`SELECT COUNT(*)::int as count FROM ${backupTableName}`);
  const backupCount = backupRes.rows[0].count;
  console.log(`Backup table ${backupTableName} row count: ${backupCount}`);

  console.log("Database backup completed successfully.");
}

createBackup().catch(console.error);
