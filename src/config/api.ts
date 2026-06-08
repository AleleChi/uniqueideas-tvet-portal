/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const isAiStudioPreview = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("run.app") ||
    host.includes("googleusercontent.com") ||
    host.includes("sandbox") ||
    host.includes("aistudio")
  );
};

export const isVercel = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase().includes("vercel.app");
};

export const isProduction = (): boolean => {
  return typeof import.meta !== "undefined" && !!(import.meta as any).env?.PROD;
};

export const getEnvironmentType = (): string => {
  if (typeof window === "undefined") return "SERVER";
  const host = window.location.hostname.toLowerCase();
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return "LOCAL_DEVELOPMENT";
  }
  if (isAiStudioPreview()) {
    return "AI_STUDIO_PREVIEW";
  }
  if (isVercel()) {
    return "VERCEL_PRODUCTION";
  }
  return "UNKNOWN_PRODUCTION";
};

const getApiBaseUrl = (): string => {
  // 1. VITE_API_URL
  const envApiUrl = typeof import.meta !== "undefined" && ((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL);
  if (envApiUrl && envApiUrl.trim() !== "") {
    return envApiUrl.replace(/\/$/, "");
  }

  // 2. window.__API_URL__
  if (typeof window !== "undefined") {
    const win = window as any;
    const winApiUrl = win.__API_URL__ || win.API_URL;
    if (winApiUrl && winApiUrl.trim() !== "") {
      return winApiUrl.trim().replace(/\/$/, "");
    }
  }

  // 3. Localhost Fallback
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    // If localhost/127.0.0.1, fallback to port 3000
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:3000";
    }
    // If running in preview container or deployed app but no VITE_API_URL, use same origin
    return window.location.origin;
  }

  return "http://localhost:3000";
};

export const API_BASE = getApiBaseUrl();
export const API_BASE_URL = API_BASE;

// Startup diagnostics required by user
console.log(`[API CONFIG]\nCurrent API: ${API_BASE}\nEnvironment: ${getEnvironmentType()}\nMode: ${typeof import.meta !== "undefined" && (import.meta as any).env?.MODE ? (import.meta as any).env.MODE : "unknown"}`);

// Only true if we are in production, on vercel, and lacking any active base URL
export const isVercelMissingApi = typeof window !== "undefined" &&
  isProduction() &&
  isVercel() &&
  !((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_API_BASE_URL);
