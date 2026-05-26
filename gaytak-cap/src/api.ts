export const API = "https://544d2f7d-c000-41b2-90f1-aabed66935a0-00-2rgnrupiswp8s.spock.replit.dev/api-server";

export function getToken() {
  return localStorage.getItem("glow_token");
}

export function setToken(t: string) {
  localStorage.setItem("glow_token", t);
}

export function removeToken() {
  localStorage.removeItem("glow_token");
}

export async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
