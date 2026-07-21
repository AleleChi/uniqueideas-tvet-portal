import dotenv from "dotenv";
import pg from "pg";
import { DbRepo } from "./src/backend/db";

dotenv.config();

async function runQueries() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== DB QUERY VALUES ===");
    const res = await pool.query(`
      SELECT physical_challenge, COUNT(*) 
      FROM beneficiaries 
      GROUP BY physical_challenge
    `);
    console.log("Physical Challenges:", res.rows);

    const res2 = await pool.query(`
      SELECT education_qualification, COUNT(*) 
      FROM beneficiaries 
      GROUP BY education_qualification
    `);
    console.log("Education Qualifications:", res2.rows);

    const res3 = await pool.query(`
      SELECT b.id, b.first_name, b.last_name, b.bank_sort_code
      FROM beneficiaries b
      LIMIT 5
    `);
    console.log("Sample Bank Sort Codes:", res3.rows);

  } catch (err: any) {
    console.error("Error running query:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runQueries();
