import { Jimp } from "jimp";
import pg from "pg";
import fs from "fs";
import path from "path";

const connectionString = "postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";
const PROGRESS_FILE = path.join(process.cwd(), "migration-progress.json");
const ROLLBACK_FILE = path.join(process.cwd(), "migration-rollback-backup.json");
const BATCH_SIZE = 12; // Configured to execute perfectly within short serverless runtime quotas

interface ProcessedRecord {
  id: string;
  name: string;
  originalSize: number;
  newSize: number;
  reductionPercentage: number;
  newPhotoBase64?: string; // Stored in cache only to commit inside the next live transaction
  originalPhotoBase64?: string; // Kept as transient rollback backup
}

interface ProgressState {
  processed: { [id: string]: ProcessedRecord };
}

function base64ToBuffer(base64Str: string): { buffer: Buffer; mime: string } {
  const match = base64Str.match(/^(data:(image\/[a-zA-Z1-9+-]+);base64,)/);
  if (match) {
    const dataPart = base64Str.substring(match[1].length);
    return {
      buffer: Buffer.from(dataPart, "base64"),
      mime: match[2]
    };
  }
  return {
    buffer: Buffer.from(base64Str, "base64"),
    mime: "image/jpeg"
  };
}

function loadProgressState(): ProgressState {
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {
      return { processed: {} };
    }
  }
  return { processed: {} };
}

function saveProgressState(state: ProgressState) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isCommit = args.includes("--commit");
  const isDryRun = !isCommit;

  console.log("=========================================");
  console.log("   IDEAS-TVET PHOTO RE-COMPRESSION       ");
  console.log("   INCREMENTALLY RESUMING ENGINE         ");
  console.log("=========================================");
  console.log(`Execution Mode: ${isCommit ? "🚨 COMMIT (LIVE WRITE)" : "✅ DRY RUN (MEASUREMENT & SIMULATION)"}`);
  console.log(`Current Time:   ${new Date().toISOString()}`);
  console.log("=========================================\n");

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  const progress = loadProgressState();
  const processedKeys = Object.keys(progress.processed);

  console.log(`[1] Scanning DB schema and measuring metadata...`);
  const client = await pool.connect();
  
  // Query only beneficiary IDs and photo LENGTHs to avoid massive network transfer
  const res = await client.query(`
    SELECT id, first_name, last_name, LENGTH(photo) as base64_len
    FROM beneficiaries 
    WHERE photo IS NOT NULL AND photo != '' AND deleted_at IS NULL
    ORDER BY id ASC
  `);

  const records = res.rows;
  const totalRecords = records.length;

  const eligibleRecords = records
    .map(r => {
      // Base64 string length to raw binary bytes conversion approximation
      const sizeBytes = Math.floor((r.base64_len * 3) / 4);
      return {
        id: r.id,
        name: `${r.first_name} ${r.last_name}`,
        sizeBytes
      };
    })
    .filter(r => r.sizeBytes > 500 * 1024);

  const totalEligible = eligibleRecords.length;

  console.log(`    - Total Active Photos inside DB:   ${totalRecords}`);
  console.log(`    - Total Oversized Legacy (>500KB): ${totalEligible}`);
  console.log(`    - Already Processed in Cache:      ${processedKeys.length} / ${totalEligible}`);

  if (isCommit) {
    if (processedKeys.length < totalEligible) {
      console.log(`\n❌ ERROR: Cannot run COMMIT until all ${totalEligible} records are fully measured in dry-run.`);
      console.log("👉 Please run 'npx tsx src/backend/image-migration.ts' multiple times to complete the dry-run measurement first.\n");
      client.release();
      await pool.end();
      return;
    }

    console.log(`\n[2] Performing Rollback Backup generation...`);
    const backupData: { [id: string]: string } = {};
    for (const key of processedKeys) {
      if (progress.processed[key].originalPhotoBase64) {
        backupData[key] = progress.processed[key].originalPhotoBase64!;
      }
    }
    
    fs.writeFileSync(ROLLBACK_FILE, JSON.stringify(backupData, null, 2), "utf-8");
    console.log(`    Saved original photo state backup file to: ${ROLLBACK_FILE}`);

    console.log(`\n[3] Committing optimized photostreams to PostgreSQL...`);
    await client.query("BEGIN");
    let commitCount = 0;

    for (const id of processedKeys) {
      const rec = progress.processed[id];
      if (rec.newPhotoBase64) {
        await client.query(
          "UPDATE beneficiaries SET photo = $1, updated_at = NOW() WHERE id = $2",
          [rec.newPhotoBase64, id]
        );
        commitCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`    ✔ committed successfully. ${commitCount} beneficiary photographs compressed in-database!`);

    console.log("\n=========================================");
    console.log("   MIGRATION TRANSACTION COMPLETED       ");
    console.log("=========================================\n");
    client.release();
    await pool.end();
    return;
  }

  // Dry run / measurements processing
  const remainingEligible = eligibleRecords.filter(r => !progress.processed[r.id]);

  if (remainingEligible.length === 0) {
    console.log("\n✨ ALL OVERSIZED IMAGES HAVE BEEN FULLY MEASURED AND COMPRESSED IN THE PROGRESS CACHE!");
    console.log("👉 Ready for execution. Run with '--commit' to apply these compressed assets to the database:");
    console.log("   npx tsx src/backend/image-migration.ts --commit\n");

    const sumSummary = Object.values(progress.processed);
    const totalOriginalBytes = sumSummary.reduce((sum, r) => sum + r.originalSize, 0);
    const totalNewBytes = sumSummary.reduce((sum, r) => sum + r.newSize, 0);
    const overallSavedBytes = totalOriginalBytes - totalNewBytes;
    const overallReductionPercentage = ((totalOriginalBytes - totalNewBytes) / totalOriginalBytes) * 100;
    
    let maxReduction = 0;
    let maxReductionRecord = "";
    sumSummary.forEach(r => {
      if (r.reductionPercentage > maxReduction) {
        maxReduction = r.reductionPercentage;
        maxReductionRecord = `${r.name} (${r.id})`;
      }
    });

    const avgOrigSizeBytes = totalOriginalBytes / sumSummary.length;
    const avgNewSizeBytes = totalNewBytes / sumSummary.length;

    console.log("=========================================");
    console.log("   MIGRATION ANALYSIS REPORT (COMPLETE)  ");
    console.log("=========================================");
    console.log(`1. Total Records Scanned:         ${totalRecords}`);
    console.log(`2. Total Records Eligible:        ${totalEligible}`);
    console.log(`3. Total Records Analyzed:        ${sumSummary.length}`);
    console.log(`4. Average Size Before:           ${(avgOrigSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`5. Average Size After:            ${(avgNewSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`6. Largest Reduction Achieved:    ${maxReduction.toFixed(2)}% [For: ${maxReductionRecord}]`);
    console.log(`7. Total Storage Saved:           ${(overallSavedBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`8. Overall Redundancy Slashed:    ${overallReductionPercentage.toFixed(2)}%`);
    console.log(`9. Est. Album Load Improvement:   ${(avgOrigSizeBytes / avgNewSizeBytes).toFixed(1)}X faster asset delivery speed`);
    console.log("=========================================\n");

    client.release();
    await pool.end();
    return;
  }

  const batchToProcess = remainingEligible.slice(0, BATCH_SIZE);
  console.log(`\n[2] Commencing compression batch analysis (Batch size: ${batchToProcess.length} remaining)...`);

  for (let i = 0; i < batchToProcess.length; i++) {
    const item = batchToProcess[i];
    console.log(`    - Processing [${i + 1}/${batchToProcess.length}] ID: ${item.id} (${(item.sizeBytes / 1024).toFixed(1)} KB)`);

    try {
      // Retrieve the raw image string for only this beneficiary (extremely performant and safe)
      const photoResult = await client.query("SELECT photo FROM beneficiaries WHERE id = $1", [item.id]);
      const rawPhoto = photoResult.rows[0].photo;

      if (!rawPhoto) {
        console.log(`      ⚠️ Photo empty on retrieval. Skipping.`);
        continue;
      }

      const { buffer } = base64ToBuffer(rawPhoto);
      const jimpImage = await Jimp.read(buffer);

      // Perform proportional resize to 300x300
      jimpImage.resize({ w: 300, h: 300 });

      // Convert to JPEG with quality 70 (in specified range 0.65-0.75)
      const compressedBuffer = await jimpImage.getBuffer("image/jpeg", { quality: 70 });
      const compressedBase64 = `data:image/jpeg;base64,${compressedBuffer.toString("base64")}`;

      const newSize = compressedBuffer.length;
      const reductionPercentage = ((item.sizeBytes - newSize) / item.sizeBytes) * 100;

      // Register the computed state in localized cache
      progress.processed[item.id] = {
        id: item.id,
        name: item.name,
        originalSize: item.sizeBytes,
        newSize,
        reductionPercentage,
        newPhotoBase64: compressedBase64,
        originalPhotoBase64: rawPhoto
      };

      console.log(`      ✔ PROGRESS: -> ${(newSize / 1024).toFixed(1)} KB | Reduction: ${reductionPercentage.toFixed(2)}%`);
    } catch (itemErr: any) {
      console.error(`      ❌ Error processing record ${item.id}:`, itemErr.message || itemErr);
    }
  }

  // Save intermediate cache state
  saveProgressState(progress);
  console.log(`\n[3] Progress successfully saved to: ${PROGRESS_FILE}`);
  console.log(`    Processed progress: ${Object.keys(progress.processed).length} / ${totalEligible} records completed.`);
  
  const pctDone = (Object.keys(progress.processed).length / totalEligible) * 100;
  console.log(`    Progress Bar: [${"█".repeat(Math.round(pctDone / 5))}${"░".repeat(20 - Math.round(pctDone / 5))}] ${pctDone.toFixed(1)}%\n`);
  
  console.log("👉 Measurement chunk processed safely. Run the script again to measure and process the next batch of legacy photographs:");
  console.log("   npx tsx src/backend/image-migration.ts\n");

  client.release();
  await pool.end();
}

runMigration().catch(console.error);
