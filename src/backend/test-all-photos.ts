import pg from "pg";
import { Jimp } from "jimp";

const connectionString = "postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function checkAll() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const res = await client.query("SELECT id, first_name, last_name, LENGTH(photo) as len, photo FROM beneficiaries WHERE photo IS NOT NULL AND photo != '' AND deleted_at IS NULL ORDER BY id");
    
    console.log(`Analyzing ${res.rows.length} photos...`);
    let jimpFailCount = 0;
    
    for (const row of res.rows) {
      const { id, first_name, last_name, len, photo } = row;
      const match = photo.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        // Let's check if it doesn't have the data prefix
        if (photo.startsWith("http")) {
          console.log(`- ${id} (${first_name} ${last_name}): External URL photo -> ${photo}`);
        } else {
          console.log(`- ${id} (${first_name} ${last_name}): Fails regex! Length=${len}, starts with: ${photo.substring(0, 50)}`);
          jimpFailCount++;
        }
        continue;
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const imgBuffer = Buffer.from(base64Data, "base64");
      
      try {
        const image = await Jimp.read(imgBuffer);
        // Success
      } catch (err: any) {
        console.log(`- ${id} (${first_name} ${last_name}): Jimp failed to decode! Mime=${mimeType}, base64Length=${base64Data.length}, Error=${err.message}`);
        jimpFailCount++;
      }
    }
    
    console.log(`Done. Total failures detected: ${jimpFailCount} / ${res.rows.length}`);
    client.release();
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkAll();
