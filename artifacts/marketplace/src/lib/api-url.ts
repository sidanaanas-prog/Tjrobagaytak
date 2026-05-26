// اكتشاف Render: REPL_ID موجود فقط في Replit
const isReplit = !!import.meta.env.REPL_ID;
const isRender = !isReplit;

const RENDER_API_URL = "https://gaytak-api.onrender.com";

export function getApiUrl(path: string): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;
  if (isRender) return `${RENDER_API_URL}${path}`;
  return `${base}${path}`;
}

export { RENDER_API_URL };
