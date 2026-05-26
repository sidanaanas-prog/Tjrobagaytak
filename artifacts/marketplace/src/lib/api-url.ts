// اكتشاف Render: باستخدام window (runtime) أو import.meta.env.PROD (build time)
const isRenderRuntime = typeof window !== "undefined" && window.location.hostname.includes(".onrender.com");
const isRenderBuild = import.meta.env.PROD && !import.meta.env.BASE_URL?.includes("replit");
const isRender = isRenderRuntime || isRenderBuild;

const RENDER_API_URL = "https://gaytak-api.onrender.com";

export function getApiUrl(path: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;
  if (isRender && !base) return `${RENDER_API_URL}${path}`;
  return `${base}${path}`;
}

export { RENDER_API_URL };
