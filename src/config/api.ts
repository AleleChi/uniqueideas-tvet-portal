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

export const buildPublicUrl = (requestPath: string, req?: any): string => {
  let base = "";
  
  // 1. Single Source of Truth - PUBLIC_APP_URL from environment
  if (typeof process !== "undefined" && process.env) {
    base = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "";
  }
  
  if (!base && typeof import.meta !== "undefined" && (import.meta as any).env) {
    const metaEnv = (import.meta as any).env;
    base = metaEnv.PUBLIC_APP_URL || metaEnv.VITE_PUBLIC_APP_URL || "";
  }

  // Under NO circumstances should emails or admission links use preview URL patterns
  const isPreviewOrLocal = (url: string): boolean => {
    if (!url) return true;
    const l = url.toLowerCase();
    return (
      l.includes("aistudio") ||
      l.includes("google") ||
      l.includes("run.app") ||
      l.includes("localhost") ||
      l.includes("127.0.0.1") ||
      l.includes("sandbox") ||
      l.includes("ais-dev") ||
      l.includes("ais-pre") ||
      l.includes("my_app_url")
    );
  };

  // If base was not set via PUBLIC_APP_URL, check other non-preview general environment variables
  if (!base) {
    if (typeof process !== "undefined" && process.env) {
      const candidates = [
        process.env.APP_URL,
        process.env.VITE_APP_URL,
        process.env.VITE_API_URL,
        process.env.VITE_API_BASE_URL
      ];
      for (const cand of candidates) {
        if (cand && !isPreviewOrLocal(cand)) {
          base = cand;
          break;
        }
      }
    }
  }

  if (!base) {
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const metaEnv = (import.meta as any).env;
      const candidates = [
        metaEnv.VITE_APP_URL,
        metaEnv.VITE_API_URL,
        metaEnv.VITE_API_BASE_URL
      ];
      for (const cand of candidates) {
        if (cand && !isPreviewOrLocal(cand)) {
          base = cand;
          break;
        }
      }
    }
  }

  // Do not dynamically derive from req if it resolves to a preview or sandbox host
  if (req) {
    const proto = req.get("X-Forwarded-Proto") || req.protocol || "http";
    const host = req.get("X-Forwarded-Host") || req.get("host");
    if (host) {
      const candidate = `${proto}://${host}`;
      if (!isPreviewOrLocal(candidate)) {
        base = candidate;
      }
    }
  }

  if (!base && typeof window !== "undefined") {
    const candidate = window.location.origin;
    if (!isPreviewOrLocal(candidate)) {
      base = candidate;
    }
  }

  // 3. Absolute fallback: production domain of Render (unless explicitly allowed localhost/5173 in dev)
  if (!base || isPreviewOrLocal(base)) {
    const explicitEnv = (typeof process !== "undefined" && process.env && (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL)) ||
                        (typeof import.meta !== "undefined" && (import.meta as any).env && ((import.meta as any).env.PUBLIC_APP_URL || (import.meta as any).env.VITE_PUBLIC_APP_URL));
    
    if (explicitEnv && explicitEnv.includes("localhost")) {
      base = explicitEnv;
    } else {
      base = "https://uniqueideas-tvet-portal.onrender.com";
    }
  }

  base = base.trim().replace(/\/$/, "");
  const cleanPath = requestPath ? (requestPath.startsWith("/") ? requestPath : `/${requestPath}`) : "";
  return `${base}${cleanPath}`;
};

