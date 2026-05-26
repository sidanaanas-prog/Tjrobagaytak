const RENDER_API_URL = "https://gaytak-api.onrender.com";

function detectRuntimeRender(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes(".onrender.com") || host.includes("gaytak.onrender.com");
}

function detectBuildRender(): boolean {
  // REPL_ID موجود فقط في Replit
  const isReplit = !!import.meta.env.REPL_ID;
  const hasViteApiUrl = !!import.meta.env.VITE_API_URL;
  // إذا لم يكن هناك REPL_ID ولم يكن هناك VITE_API_URL → قد يكون Render
  return !isReplit && !hasViteApiUrl;
}

export function getApiUrl(path: string): string {
  // الأولوية: متغير البيئة (VITE_API_URL)
  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) return `${envApi.replace(/\/$/, "")}${path}`;

  // الثانية: اكتشاف Render بأي طريقة
  if (detectRuntimeRender() || detectBuildRender()) {
    return `${RENDER_API_URL}${path}`;
  }

  // الافتراضي: BASE_URL المحلي
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

export { RENDER_API_URL };
