import { API_BASE_URL } from "../config/api";

/**
 * Reusable authenticated fetch helper for secure API requests.
 * Reads the secure JWT from the active session or localStorage,
 * automatically appends it to the Authorization: Bearer header,
 * handles Content-Type preservation, and returns the response.
 */
const activeRequests = new Map<string, Promise<Response>>();

function adaptResponse(response: Response, url: string): Response {
  const originalJson = response.json.bind(response);
  response.json = async function(): Promise<any> {
    const raw = await originalJson();
    let recordCount = 0;
    if (raw) {
      if (Array.isArray(raw)) {
        recordCount = raw.length;
      } else if (raw && typeof raw === "object" && raw.success && Array.isArray(raw.data)) {
        recordCount = raw.data.length;
      } else if (raw && typeof raw === "object" && Array.isArray(raw.rows)) {
        recordCount = raw.rows.length;
      } else if (raw && typeof raw === "object") {
        recordCount = 1;
      }
    }
    console.log(`[LIVE DATA RECEIVED] endpoint: "${url}", record count: ${recordCount}`);
    
    if (raw && typeof raw === "object" && "success" in raw && "data" in raw) {
      if (Array.isArray(raw.data)) {
        const arr = raw.data;
        Object.defineProperty(arr, "success", { value: raw.success, enumerable: false, writable: true });
        Object.defineProperty(arr, "data", { value: raw.data, enumerable: false, writable: true });
        return arr;
      } else if (raw.data && typeof raw.data === "object") {
        const obj = { ...raw.data };
        Object.defineProperty(obj, "success", { value: raw.success, enumerable: false, writable: true });
        Object.defineProperty(obj, "data", { value: raw.data, enumerable: false, writable: true });
        // Map any root properties (e.g. totalCount, totalPages) as enumerable properties
        for (const k of Object.keys(raw)) {
          if (k !== "data" && k !== "success" && !(k in obj)) {
            Object.defineProperty(obj, k, { value: raw[k], enumerable: true, writable: true });
          }
        }
        return obj;
      }
    }
    return raw;
  };
  return response;
}

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  let bodyStr = "";
  if (options.body) {
    if (typeof options.body === "string") {
      bodyStr = options.body;
    } else if (options.body instanceof FormData) {
      bodyStr = "[FormData]";
    } else {
      bodyStr = String(options.body);
    }
  }
  const requestKey = `${method}:${url}:${bodyStr}`;

  if (activeRequests.has(requestKey)) {
    console.log(`[DEDUPLICATOR] Deduping active concurrent request: ${method} "${url}"`);
    const existingPromise = activeRequests.get(requestKey)!;
    const res = await existingPromise;
    return adaptResponse(res.clone(), url);
  }

  const fetchPromise = (async () => {
    const headers = new Headers(options.headers || {});

    // Retrieve token from localStorage
    try {
      const cached = localStorage.getItem("ideas-session");
      if (cached) {
        const session = JSON.parse(cached);
        if (session && session.token) {
          headers.set("Authorization", `Bearer ${session.token}`);
        }
      }
    } catch (err) {
      console.error("Error parsing login session for authFetch:", err);
    }

    // Ensure Content-Type is set to application/json by default for body-bearing requests,
    // unless headers already has Content-Type, or we are uploading a file (e.g., FormData).
    if (options.body && !(options.body instanceof FormData)) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    const targetUrl = url.startsWith("/api/") ? `${API_BASE_URL}${url}` : url;

    const startTime = Date.now();
    const tokenExists = headers.has("Authorization");
    console.log(`[FETCH START] endpoint: "${url}", tokenPresent: ${tokenExists}`);

    let attempts = 0;
    const maxAttempts = 4; // 1 original + 3 retries
    let lastError: any = null;
    let response: Response | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

      try {
        response = await fetch(targetUrl, {
          ...options,
          headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        // If the response is successful (2xx) or client error (4xx) that shouldn't change, we break
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          const responseTime = Date.now() - startTime;
          console.log(`[FETCH SUCCESS] endpoint: "${url}", response time: ${responseTime}ms, retry count: ${attempts - 1}`);
          
          // Handle 401/403 security context boundaries without silent failures
          if (response.status === 401) {
            console.error(`[SESSION EXPIRED] 401 Unauthorized detected for ${url}. Current session state invalid.`);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ideas-auth-unauthorized", { detail: { url } }));
            }
          } else if (response.status === 403) {
            console.error(`[ACCESS DENIED] 403 Forbidden detected for ${url}. Security role context disallowed.`);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ideas-auth-forbidden", { detail: { url } }));
            }
          }
          break;
        }
        
        console.warn(`[FETCH RETRY] Received status ${response.status} on attempt ${attempts}/${maxAttempts} for ${url}. Retrying in 3s...`);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        console.warn(`[FETCH RETRY] Error on attempt ${attempts}/${maxAttempts} for ${url}: ${err.message || err}. Retrying in 3s...`);
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
        }
      }
    }

    if (!response) {
      const responseTime = Date.now() - startTime;
      console.error(`[FETCH FAILED] endpoint: "${url}", response time: ${responseTime}ms, retry count: ${attempts - 1}, error: ${lastError ? lastError.message : "Network error"}`);
      throw lastError || new Error(`Network failure: Failed to fetch ${url} after ${maxAttempts} attempts.`);
    }

    return response;
  })();

  activeRequests.set(requestKey, fetchPromise);

  try {
    const rawRes = await fetchPromise;
    activeRequests.delete(requestKey);
    return adaptResponse(rawRes.clone(), url);
  } catch (error) {
    activeRequests.delete(requestKey);
    throw error;
  }
}

/**
 * Downloads a file from a secure API endpoint using JWT credentials in the header,
 * bypassing cookie blockers inside Web iframe containers.
 */
export async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${filename}: ${res.statusText}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
