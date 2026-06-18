import { useEffect } from "react";
import { router } from "expo-router";
import OneSignal from "react-native-onesignal";

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "";

export function setupAndroidChannels() {}

export function initOneSignal() {
  if (!ONESIGNAL_APP_ID) return;
  try {
    OneSignal.initialize(ONESIGNAL_APP_ID);
    OneSignal.Notifications.requestPermission(true);
    OneSignal.Notifications.addEventListener("click", (event: any) => {
      const data = event?.notification?.additionalData as any;
      if (!data) return;
      if (data.type === "message" && data.conversationId) {
        router.push(`/conversation/${data.conversationId}`);
      } else if (data.type === "product" && data.productId) {
        router.push(`/product/${data.productId}`);
      }
    });
  } catch (e) {
    console.warn("[OneSignal] init failed:", e);
  }
}

export function loginOneSignal(userId: string) {
  if (!ONESIGNAL_APP_ID) return;
  try { OneSignal.login(userId); } catch (e) {}
}

export function logoutOneSignal() {
  if (!ONESIGNAL_APP_ID) return;
  try { OneSignal.logout(); } catch (e) {}
}

export function useNotifications(userId: string | null) {
  useEffect(() => {
    if (!ONESIGNAL_APP_ID) return;
    if (userId) loginOneSignal(userId);
    else logoutOneSignal();
  }, [userId]);
}
