/**
 * Reusable authenticated fetch helper for secure API requests.
 * Reads the secure JWT from the active session or localStorage,
 * automatically appends it to the Authorization: Bearer header,
 * handles Content-Type preservation, and returns the response.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
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

  return fetch(url, {
    ...options,
    headers,
  });
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
