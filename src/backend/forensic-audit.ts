import pg from "pg";

const connectionString = "postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function runForensicAudit() {
  console.log("=========================================");
  console.log("   IDEAS-TVET FORENSIC PHOTO AUDIT       ");
  console.log("=========================================\n");

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log("Connected to Neon DB successfully.");

    // Query total beneficiaries
    const totalRes = await client.query("SELECT COUNT(*) as count FROM beneficiaries WHERE deleted_at IS NULL");
    const totalBeneficiaries = parseInt(totalRes.rows[0].count, 10);

    // Query non-empty photo records and calculate base64 sizes and lengths
    const photoRes = await client.query(`
      SELECT id, first_name, last_name, LENGTH(photo) as base64_len 
      FROM beneficiaries 
      WHERE photo IS NOT NULL AND photo != '' AND deleted_at IS NULL
    `);

    let beneficiariesWithPhotos = photoRes.rows.length;
    let totalPhotoSize = 0;
    let maxPhotoSize = 0;
    let minPhotoSize = Infinity;
    let countAbove500KB = 0;
    
    let largestBeneficiaryId = "";
    let smallestBeneficiaryId = "";

    const affectedRecords: Array<{ id: string; name: string; size: number }> = [];

    for (const row of photoRes.rows) {
      // Base64 to binary byte size approximation: length * 3/4
      const sizeBytes = Math.floor((row.base64_len * 3) / 4);
      totalPhotoSize += sizeBytes;

      if (sizeBytes > maxPhotoSize) {
        maxPhotoSize = sizeBytes;
        largestBeneficiaryId = row.id;
      }
      if (sizeBytes < minPhotoSize) {
        minPhotoSize = sizeBytes;
        smallestBeneficiaryId = row.id;
      }

      if (sizeBytes > 500 * 1024) {
        countAbove500KB++;
        affectedRecords.push({
          id: row.id,
          name: `${row.first_name} ${row.last_name}`,
          size: sizeBytes
        });
      }
    }

    if (minPhotoSize === Infinity) minPhotoSize = 0;

    const averagePhotoSize = beneficiariesWithPhotos > 0 ? (totalPhotoSize / beneficiariesWithPhotos) : 0;
    const estimatedSavings = affectedRecords.reduce((total, rec) => {
      // Project average optimized size of 45KB (approx. 46080 bytes)
      const projectedNewSize = 45 * 1024;
      const savingsForRecord = Math.max(0, rec.size - projectedNewSize);
      return total + savingsForRecord;
    }, 0);

    console.log("--- RESULTS ---");
    console.log(`1. Total Beneficiaries:           ${totalBeneficiaries}`);
    console.log(`2. Beneficiaries with Photos:     ${beneficiariesWithPhotos}`);
    console.log(`3. Average Photo Size:            ${(averagePhotoSize / (1024 * 1024)).toFixed(3)} MB (${(averagePhotoSize / 1024).toFixed(1)} KB)`);
    console.log(`4. Largest Photo Size:            ${(maxPhotoSize / (1024 * 1024)).toFixed(3)} MB (${(maxPhotoSize / 1024).toFixed(1)} KB) [ID: ${largestBeneficiaryId}]`);
    console.log(`5. Smallest Photo Size:           ${(minPhotoSize / 1024).toFixed(1)} KB [ID: ${smallestBeneficiaryId}]`);
    console.log(`6. Records > 500KB (Legacy):      ${countAbove500KB}`);
    console.log(`7. Estimated Total Savings:       ${(estimatedSavings / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`8. Affected Legacy Records List (Count: ${affectedRecords.length}):`);
    affectedRecords.forEach(rec => {
      console.log(`   - ID: ${rec.id} | Name: ${rec.name.padEnd(25)} | Size: ${(rec.size / 1024).toFixed(1).padStart(7)} KB`);
    });
    console.log("=========================================\n");

    client.release();
  } catch (err) {
    console.error("Forensic audit database query failed:", err);
  } finally {
    await pool.end();
  }
}

runForensicAudit().catch(err => {
  console.error("Forensic audit failed:", err);
});
