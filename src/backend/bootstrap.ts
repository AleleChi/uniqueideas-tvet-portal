/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Sanitize CLOUDINARY_URL to prevent Cloudinary SDK configuration parsing failures
if (process.env.CLOUDINARY_URL) {
  let url = process.env.CLOUDINARY_URL.trim();
  if (url.startsWith("CLOUDINARY_URL=")) {
    url = url.substring("CLOUDINARY_URL=".length).trim();
  }
  process.env.CLOUDINARY_URL = url;
  console.log("[Bootstrap] Sanitized CLOUDINARY_URL dynamic prefix successfully.");
}
