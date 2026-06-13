import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

async function runAudit() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== START FORENSIC DATABASE AUDIT ===");

    // 1. Sectors Count
    const sectorsRes = await pool.query("SELECT COUNT(*) as count FROM sectors");
    const sectorCount = parseInt(sectorsRes.rows[0].count);
    console.log("Existing Sector Count:", sectorCount);

    // List all sectors
    const sectorsList = await pool.query("SELECT id, sector_code, sector_name FROM sectors ORDER BY id");
    console.log("Sectors in database:");
    sectorsList.rows.forEach(r => console.log(`  - ${r.id}: ${r.sector_code} (${r.sector_name})`));

    // 2. Skills Count
    const skillsRes = await pool.query("SELECT COUNT(*) as count FROM skills");
    const skillCount = parseInt(skillsRes.rows[0].count);
    console.log("Existing Skill Count:", skillCount);

    // List all skills
    const skillsList = await pool.query("SELECT id, skill_code, skill_name, sector_id FROM skills ORDER BY id");
    console.log("Skills in database:");
    skillsList.rows.forEach(r => console.log(`  - ${r.id}: ${r.skill_code} (${r.skill_name}) -> Sector: ${r.sector_id}`));

    // 3. Orphaned Skills (skills with invalid sector_id)
    const orphanedRes = await pool.query(`
      SELECT s.id, s.skill_code, s.skill_name, s.sector_id 
      FROM skills s 
      LEFT JOIN sectors sec ON s.sector_id = sec.id 
      WHERE sec.id IS NULL
    `);
    console.log("Orphaned Skills:", orphanedRes.rowCount);
    orphanedRes.rows.forEach(r => console.log(`  - Orphan: ${r.id}: ${r.skill_code} (${r.skill_name}) -> Ref: ${r.sector_id}`));

    // 4. Duplicate Skills
    const duplicateRes = await pool.query(`
      SELECT skill_code, COUNT(*) as count 
      FROM skills 
      GROUP BY skill_code 
      HAVING COUNT(*) > 1
    `);
    console.log("Duplicate Skills (by skill_code):", duplicateRes.rowCount);
    duplicateRes.rows.forEach(r => console.log(`  - Duplicate code: ${r.skill_code} (${r.count} occurrences)`));

    // 5. Broken relationships (Foreign keys lookup)
    // Checking external references from beneficiaries, admissions, etc. to sectors or skills
    // We want to see how skills are referenced in beneficiaries or admissions tables:
    console.log("\nChecking database columns referencing skills/sectors on principal tables:");
    const columnsRes = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND (column_name LIKE '%skill%' OR column_name LIKE '%sector%')
      ORDER BY table_name, column_name
    `);
    columnsRes.rows.forEach(r => console.log(`  - ${r.table_name}.${r.column_name}`));

    // Let's check tsp_sector / tsp_skill assignments
    console.log("\nChecking if tsp_sector or tsp_skill tables exist:");
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'tsp_%'
    `);
    tablesRes.rows.forEach(r => console.log(`  - Found Table: ${r.table_name}`));

  } catch (err: any) {
    console.error("Audit error:", err.message);
  } finally {
    await pool.end();
  }
}

runAudit();
