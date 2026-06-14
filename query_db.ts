import dotenv from "dotenv";
import pg from "pg";
import { TokenService } from "./src/backend/token.service";

dotenv.config();

async function runQuery() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("=== TOKEN SERVICE STRESS TEST ===");
    const beneficiaryId = "IDEAS-2026-003";
    const tokenVersion = 1;

    const token = TokenService.generateToken(beneficiaryId, tokenVersion);
    console.log("Generated Token:", token);

    const verified = TokenService.verifyToken(token);
    console.log("Verified Token Result:", verified);

    if (verified && verified.id === beneficiaryId && verified.tokenVersion === tokenVersion) {
      console.log("SUCCESS: Cryptographic module generates and verifies perfectly!");
    } else {
      console.error("FAILURE: Mismatch in verified payload!");
    }
  } catch (err: any) {
    console.error("Execution error:", err.message);
  } finally {
    await pool.end();
  }
}

runQuery();
