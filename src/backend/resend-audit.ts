/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import pg from "pg";
import { EmailService } from "./email.service";

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_njH9BPyQJ5wa@ep-damp-pond-apdkfn8y.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function queryRecentEmailLog(recipientEmail: string) {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query(
      "SELECT id, recipient_email, delivery_result, smtp_response, smtp_error_details, tracking_status, created_at FROM email_logs WHERE recipient_email = $1 ORDER BY id DESC LIMIT 1",
      [recipientEmail]
    );
    await pool.end();
    return res.rows[0] || null;
  } catch (err: any) {
    console.warn(`[DB Log Check] Failed to query email_logs table: ${err.message}`);
    await pool.end();
    return null;
  }
}

function postJson(url: string, data: any): Promise<{ statusCode?: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runAuditTest() {
  console.log("================================================================================");
  console.log("                PRODUCTION RESEND VERIFIED DOMAIN ADMISSION AUDIT             ");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`RESEND_API_KEY Configured: ${process.env.RESEND_API_KEY ? "YES" : "NO"}`);
  console.log(`Sender Coordinates: IDEAS TVET <admission@uniqueideas.dontechservicesconst.com>`);
  console.log("================================================================================\n");

  const recipient = "uniqueideasproject@gmail.com";
  const payload = { email: recipient };

  let success = false;

  // Method 1: Hit API endpoint via 127.0.0.1
  try {
    console.log(`👉 [Method 1] Sending POST to http://127.0.0.1:3000/api/email/production-test`);
    const response = await postJson("http://127.0.0.1:3000/api/email/production-test", payload);
    console.log(`✔ HTTP Response Status: ${response.statusCode}`);
    console.log(`✔ API Response Body: ${response.body}`);
    success = true;
  } catch (error: any) {
    console.log(`⚠ [Method 1] Loopback hit bypassed (expected in sandbox): ${error.message}`);
  }

  // Method 2: Hit API endpoint via 0.0.0.0
  if (!success) {
    try {
      console.log(`👉 [Method 2] Sending POST to http://0.0.0.0:3000/api/email/production-test`);
      const response = await postJson("http://0.0.0.0:3000/api/email/production-test", payload);
      console.log(`✔ HTTP Response Status: ${response.statusCode}`);
      console.log(`✔ API Response Body: ${response.body}`);
      success = true;
    } catch (error: any) {
      console.log(`⚠ [Method 2] Wildcard hit bypassed: ${error.message}`);
    }
  }

  // Method 3: Direct integration service audit run (invokes the exact same live pipeline)
  if (!success) {
    console.log(`👉 [Method 3] Invoking Service Method Directly: executeLiveIntegrationAudit()`);
    const directOutcome = await EmailService.executeLiveIntegrationAudit(recipient);
    console.log(`✔ Service execution completed.`);
    console.log(`✔ Delivery status: ${directOutcome.deliveryStatus}`);
    console.log(`✔ Service Response payload:`, JSON.stringify(directOutcome, null, 2));
    success = true;
  }

  // Final step: Query db for live audit trail logging evidence
  console.log(`\n👉 Verifying Postgres DB log write in 'email_logs' table...`);
  const dbLog = await queryRecentEmailLog(recipient);

  if (dbLog) {
    console.log(`✔ Found matching email log in PostgreSQL database!`);
    console.log(`  - Log Record ID: ${dbLog.id}`);
    console.log(`  - Recipient: ${dbLog.recipient_email}`);
    console.log(`  - Result: ${dbLog.delivery_result}`);
    console.log(`  - SMTP Response payload: ${dbLog.smtp_response}`);
    console.log(`  - SMTP Error Details: ${dbLog.smtp_error_details}`);
    console.log(`  - Tracking Status: ${dbLog.tracking_status}`);
    console.log(`  - Created At: ${dbLog.created_at}`);
  } else {
    console.log(`❌ No matching entry found in postgres 'email_logs' for recipient '${recipient}'`);
  }

  console.log("\n================================================================================");
  console.log("                     END OF LIVE RESEND INTEGRATION AUDIT                       ");
  console.log("================================================================================");
}

runAuditTest();
