/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

export class TokenService {
  private static readonly SECRET = "ideas-tvet-super-security-secret-key-2026-unique-tech";

  /**
   * Generates an encrypted token string representing a beneficiary session
   */
  static generateToken(beneficiaryId: string, tokenVersion: number = 1): string {
    const payload = JSON.stringify({
      id: beneficiaryId,
      expires: Date.now() + 10 * 24 * 60 * 60 * 1000, // Valid for 10 days
      tokenVersion
    });
    
    // Derived static standard key from secret to ensure perfect compatibility
    const key = crypto.scryptSync(this.SECRET, "salt-tvet", 32);
    const iv = Buffer.alloc(16, 0); // Static IV for consistent base64 representation matching the portal URLs

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(payload, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return Buffer.from(encrypted, "hex").toString("base64url");
  }

  /**
   * Verifies and decrypts a token string, returning target beneficiary ID if valid
   */
  static verifyToken(token: string): { id: string; tokenVersion?: number; expires?: number } | null {
    try {
      const encryptedHex = Buffer.from(token, "base64url").toString("hex");
      const key = crypto.scryptSync(this.SECRET, "salt-tvet", 32);
      const iv = Buffer.alloc(16, 0);

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      const payload = JSON.parse(decrypted);
      return { id: payload.id, tokenVersion: payload.tokenVersion, expires: payload.expires };
    } catch (e) {
      console.error("[TOKEN] Cryptographic decrypt decode error:", e);
      return null;
    }
  }
}
