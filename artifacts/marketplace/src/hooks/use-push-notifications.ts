import { useState, useEffect, useCallback } from "react";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";
import { getFCMToken } from "@/lib/firebase";

const BASE = getApiUrl("");

const STORAGE_KEY = "push_token_registered";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
    setRegistered(Notification.permission === "granted" && !!localStorage.getItem(STORAGE_KEY));
  }, []);

  const register = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    setLoading(true);
    try {
      const token = await getFCMToken();
      if (!token) {
        const p = await Notification.requestPermission();
        setPermission(p);
        return p === "granted";
      }

      const authToken = getMemToken();
      if (!authToken) return false;

      const res = await fetch(`${BASE}/api/push-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ token, platform: "web" }),
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, "1");
        setRegistered(true);
        setPermission("granted");
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const unregister = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setRegistered(false);
  }, []);

  return { permission, loading, registered, register, unregister };
}

export async function autoRegisterPushToken(): Promise<void> {
  try {
    const authToken = getMemToken();
    if (!authToken) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const token = await getFCMToken();
    if (!token) return;

    await fetch(`${BASE}/api/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token, platform: "web" }),
    });
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}
