const RENDER_API_URL = "https://gaytak-api.onrender.com";

function isRenderHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes(".onrender.com");
}

export function getApiUrl(path: string): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;

  if (isRenderHost()) {
    return `${RENDER_API_URL}${path}`;
  }

  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export { RENDER_API_URL };
