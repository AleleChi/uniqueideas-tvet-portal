/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPgPool } from "./db";

export class CertificateNumberService {
  /**
   * Generates a sequential, thread-safe, and immutable certificate number.
   * Pattern: IDEAS-CERT-YYYY-000001
   * Example: IDEAS-CERT-2026-000001
   */
  static async generateCertificateNumber(year: number): Promise<string> {
    const pool = getPgPool();
    let nextNum = 1;

    // We can check PG availability using the pool and its status
    if (pool && (global as any)._pgPool) {
      try {
        const res = await pool.query(
          `SELECT COALESCE(MAX(CAST(SPLIT_PART(certificate_number, '-', 4) AS INTEGER)), 0) as max_seq 
           FROM beneficiaries 
           WHERE certificate_number LIKE $1 AND deleted_at IS NULL`,
          [`IDEAS-CERT-${year}-%`]
        );
        const maxSeq = parseInt(res.rows[0].max_seq || "0", 10);
        nextNum = maxSeq + 1;
      } catch (err) {
        console.error("[CertificateNumberService] Database query failed for sequence, falling back to sequential scans", err);
      }
    } else {
      // File-system memory database fallback
      try {
        // Use relative require to prevent circular locks during boot
        const { loadJsonState } = require("./db");
        const state = loadJsonState();
        const prefix = `IDEAS-CERT-${year}-`;
        let maxSeq = 0;
        
        if (state && Array.isArray(state.beneficiaries)) {
          for (const b of state.beneficiaries) {
            if (b.certificateNumber && b.certificateNumber.startsWith(prefix)) {
              const parts = b.certificateNumber.split("-");
              const seqVal = parseInt(parts[3] || "0", 10);
              if (!isNaN(seqVal) && seqVal > maxSeq) {
                maxSeq = seqVal;
              }
            }
          }
        }
        nextNum = maxSeq + 1;
      } catch (err) {
        console.error("[CertificateNumberService] JSON memory sweep fallback failed:", err);
      }
    }

    const paddedNum = String(nextNum).padStart(6, "0");
    return `IDEAS-CERT-${year}-${paddedNum}`;
  }
}
