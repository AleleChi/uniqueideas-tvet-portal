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
  // 1. If we are in AI Studio, Localhost, Cloud Run Preview, or Google Sandbox, ALWAYS fall back to safe proxy routing ("")
  if (isAiStudioPreview()) {
    return "";
  }

  // 2. Otherwise, if we have a VITE_API_BASE_URL set, use it.
  const envApiUrl = typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (envApiUrl && envApiUrl.trim() !== "") {
    return envApiUrl.replace(/\/$/, "");
  }

  // 3. Fallback to safe relative path for production if no env var is provided
  return "";
};

export const API_BASE_URL = getApiBaseUrl();

// Only true if we are in production, on vercel, and lacking the VITE_API_BASE_URL config
export const isVercelMissingApi = typeof window !== "undefined" &&
  isProduction() &&
  isVercel() &&
  !(typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL);



