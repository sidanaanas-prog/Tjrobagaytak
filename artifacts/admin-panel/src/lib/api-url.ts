const RENDER_API_URL = "https://gaytak-api.onrender.com";

/** نتحقق من الـ hostname فقط — الطريقة الوحيدة الموثوقة في البراوزر */
function isRunningOnRender(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes(".onrender.com");
}

export function getApiUrl(path: string): string {
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;

  if (isRunningOnRender()) {
    return `${RENDER_API_URL}${path}`;
  }

  // Replit أو local → URLs نسبية عبر الـ proxy
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export { RENDER_API_URL };
