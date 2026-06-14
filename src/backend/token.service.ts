/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

export class TokenService {
  private static readonly SECRET = "ideas-tvet-super-security-secret-key-2026-unique-tech";

  /**
   * Generates an encrypted token string representing a beneficiary offer-acceptance session.
   *
   * IMPORTANT: The `tokenVersion` field is stored in the payload for audit purposes
   * but is NO LONGER used to revoke student offer-acceptance links.
   * Only the `expires` timestamp governs link validity for students.
   * Admin session tokens (JWT via jsonwebtoken) continue to use their own expiry.
   */
  static generateToken(beneficiaryId: string, tokenVersion: number = 1): string {
    const payload = JSON.stringify({
      id: beneficiaryId,
      expires: Date.now() + 10 * 24 * 60 * 60 * 1000, // 10 days from generation
      tokenVersion,
      // Embed the version at generation time for audit trail only
      // validate-token will NOT reject mismatched versions for offer links
      type: "OFFER_ACCEPTANCE"
    });
    
    const key = crypto.scryptSync(this.SECRET, "salt-tvet", 32);
    const iv = Buffer.alloc(16, 0); // Static IV for consistent base64url output

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(payload, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    return Buffer.from(encrypted, "hex").toString("base64url");
  }

  /**
   * Verifies and decrypts an offer-acceptance token.
   * Returns the beneficiary ID if the token is valid and not expired.
   * Does NOT check tokenVersion — version bumps from admin actions must not
   * invalidate a student's emailed acceptance link.
   */
  static verifyToken(token: string): { id: string; tokenVersion?: number } | null {
    try {
      const encryptedHex = Buffer.from(token, "base64url").toString("hex");
      const key = crypto.scryptSync(this.SECRET, "salt-tvet", 32);
      const iv = Buffer.alloc(16, 0);

      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      const payload = JSON.parse(decrypted);

      // Validate expiry — this is the ONLY validity check for offer-acceptance tokens
      if (payload.expires < Date.now()) {
        console.warn("[TOKEN] Offer-acceptance token expired. Expiry:", new Date(payload.expires).toISOString());
        return null;
      }

      return { id: payload.id, tokenVersion: payload.tokenVersion };
    } catch (e) {
      console.error("[TOKEN] Cryptographic decrypt/decode error:", e);
      return null;
    }
  }

  /**
   * Returns the expiry date embedded in a token without full validation.
   * Used for display purposes (e.g. show "expires on DD/MM/YYYY" to the student).
   */
  static getTokenExpiry(token: string): Date | null {
    try {
      const encryptedHex = Buffer.from(token, "base64url").toString("hex");
      const key = crypto.scryptSync(this.SECRET, "salt-tvet", 32);
      const iv = Buffer.alloc(16, 0);
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      const payload = JSON.parse(decrypted);
      return new Date(payload.expires);
    } catch {
      return null;
    }
  }
}