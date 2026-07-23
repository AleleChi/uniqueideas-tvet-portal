import dotenv from "dotenv";
import { DbRepo, getPgPool, isPgActive } from "./src/backend/db";

dotenv.config();

async function runQueries() {
  try {
    console.log("=== ALL BENEFICIARIES ===");
    const list = await DbRepo.getBeneficiaries({ systemContext: true });
    console.log("Count:", list.length);
    console.log(JSON.stringify(list, null, 2));
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

runQueries();
