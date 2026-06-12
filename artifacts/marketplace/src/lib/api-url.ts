// Use the same host for API calls (Replit deployment handles /api routing)
// Render API is deprecated - use relative paths for Replit deployment
const RENDER_API_URL = "https://gaytak-api.onrender.com";

function isRenderHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes(".onrender.com");
}

function isReplitHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes(".replit.app") || host.includes(".replit.dev");
}

export function getApiUrl(path: string): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;

  // On Replit deployment, use relative paths (same host)
  if (isReplitHost()) {
    return path;
  }

  // Fallback to Render API only for old Render frontend
  if (isRenderHost()) {
    return `${RENDER_API_URL}${path}`;
  }

  // Dev mode: use relative paths through proxy
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export { RENDER_API_URL };
