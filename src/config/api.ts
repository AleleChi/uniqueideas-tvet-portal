/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const isLocalOrPreview = typeof window !== "undefined" && (
  window.location.hostname.includes("localhost") ||
  window.location.hostname.includes("127.0.0.1") ||
  window.location.hostname.includes("run.app") ||
  window.location.hostname.includes("aistudio")
);

export const API_BASE_URL =
  isLocalOrPreview ? "" : (((import.meta as any).env?.VITE_API_BASE_URL as string) || "");

