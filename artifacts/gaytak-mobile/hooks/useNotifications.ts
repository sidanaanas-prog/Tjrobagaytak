import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

// ── Android: إنشاء channel للإشعارات المهمة ─────────────────────────────────

export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("ride_alerts", {
    name: "طلبات النقل",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [200, 100, 200, 100, 500, 100, 500],
    sound: "alert.mp3",
    lightColor: "#00FF88",
    showBadge: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync("default", {
    name: "إشعارات عامة",
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: true,
  });
}

// ── طلب إذن الإشعارات ────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing: any = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const result: any = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return result.granted;
}

// ── حفظ push token في السيرفر ─────────────────────────────────────────────

async function registerPushToken(token: string, userId: string) {
  const storedToken = await AsyncStorage.getItem("fcm_token");
  const storedUserId = await AsyncStorage.getItem("fcm_token_user");
  if (storedToken === token && storedUserId === userId) return;

  const authToken = await AsyncStorage.getItem("glow_token");
  if (!authToken) return;

  try {
    const res = await fetch(`https://${DOMAIN}/api/push-tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });
    if (res.ok) {
      await AsyncStorage.setItem("fcm_token", token);
      await AsyncStorage.setItem("fcm_token_user", userId);
    }
  } catch (e) {
    console.warn("[PushToken] registration failed:", e);
  }
}

// ── التهيئة ────────────────────────────────────────────────────────────────

export async function initNotifications() {
  await setupAndroidChannels();

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn("[Notifications] permission not granted");
    return;
  }

  // Set default notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });

  // Get native FCM token (Android) / APNs token (iOS)
  if (Device.isDevice) {
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data;
      await AsyncStorage.setItem("device_push_token", token);
      console.log("[Notifications] Device push token:", token);
    } catch (e) {
      console.warn("[Notifications] Failed to get device push token:", e);
    }
  }
}

// ── معالجة النقر على الإشعار ───────────────────────────────────────────────

export function useNotificationHandlers() {
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;
        console.log("[Notifications] received:", data);
        // لو جاه طلب نقل جديد والتطبيق مفتوح — خزّن ويروح لشاشة السائق
        if (data?.type === "new_ride" && data?.rideId) {
          AsyncStorage.setItem("incoming_ride_id", data.rideId).catch(() => {});
        }
        // الرحلة تم قبولها من سائق آخر — امسح من الذاكرة
        if (data?.type === "ride_taken" && data?.rideId) {
          AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
        }
      }
    );

    // Listen for user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        console.log("[Notifications] clicked:", data);

        if (!data) return;
        if (data.type === "new_ride" && data.rideId) {
          // خزّن rideId وافتح شاشة السائق مع طلب جديد
          AsyncStorage.setItem("incoming_ride_id", data.rideId)
            .then(() => {
              router.push({ pathname: "/ride-driver", params: { incomingRideId: data.rideId } });
            })
            .catch(() => {
              router.push({ pathname: "/ride-driver", params: { incomingRideId: data.rideId } });
            });
        } else if (data.type === "message" && data.conversationId) {
          router.push(`/conversation/${data.conversationId}`);
        } else if (data.type === "product" && data.productId) {
          router.push(`/product/${data.productId}`);
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);
}

// ── حفظ token عند تسجيل الدخول ───────────────────────────────────────────

export function useNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const registerToken = async () => {
      try {
        const deviceToken = await AsyncStorage.getItem("device_push_token");
        if (deviceToken) {
          await registerPushToken(deviceToken, userId);
          return;
        }

        if (Device.isDevice) {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          const token = tokenData.data;
          await AsyncStorage.setItem("device_push_token", token);
          await registerPushToken(token, userId);
        }
      } catch (e) {
        console.warn("[Notifications] useNotifications error:", e);
      }
    };

    registerToken();
  }, [userId]);

  useNotificationHandlers();
}

// ── عرض إشعار محلي (من التطبيق نفسه) ─────────────────────────────────────

export async function showLocalNotification({
  title,
  body,
  data,
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: "alert.mp3",
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [200, 100, 200, 100, 500, 100, 500],
      badge: 1,
    },
    trigger: null,
  });
}
