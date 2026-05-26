// اكتشاف Render تلقائياً — يستخدم API URL مباشرة
const isRender = typeof window !== "undefined" && window.location.hostname.includes(".onrender.com");
const RENDER_API_URL = "https://gaytak-api.onrender.com";

export function getApiUrl(path: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  if (isRender && !base) return `${RENDER_API_URL}${path}`;
  return `${base}${path}`;
}

export { RENDER_API_URL };
