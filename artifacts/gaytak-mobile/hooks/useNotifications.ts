import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import * as Device from "expo-device";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

// ── اسم مهمة الخلفية ─────────────────────────────────────────────────────────
export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND-NOTIFICATION-TASK";

// ── معرّفات أزرار الإشعار ────────────────────────────────────────────────────
export const ACCEPT_RIDE_ACTION = "ACCEPT_RIDE";
export const REJECT_RIDE_ACTION = "REJECT_RIDE";

// ── التهيئة الافتراضية لمعالج الإشعارات (native only) ──────────────────────
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

// ── تعريف مهمة الخلفية (native only) ────────────────────────────────────────
if (Platform.OS !== "web") {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error("[BG-TASK] خطأ:", error);
    return;
  }

  const notification = data?.notification as Notifications.Notification | undefined;
  if (!notification) return;

  const d = notification.request.content.data as any;
  console.log("[BG-TASK] وصل إشعار في الخلفية:", d?.type);

  if (d?.type === "new_ride" && d?.rideId) {
    // حفظ rideId في الذاكرة
    await AsyncStorage.setItem("incoming_ride_id", d.rideId).catch(() => {});

    // عرض إشعار محلي بشاشة كاملة + زري قبول/رفض
    await showIncomingRideNotification(
      d.rideId,
      d._fromAddress ?? d.fromAddress,
      d._toAddress  ?? d.toAddress,
      d._price      ?? d.price
    );
  }

  if (d?.type === "ride_taken") {
    await AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
    await Notifications.dismissNotificationAsync("incoming_ride").catch(() => {});
  }
  });
}

// ── Android: إنشاء channels + فئة الإشعار مع أزرار قبول/رفض ────────────────

export async function setupAndroidChannels() {
  if (Platform.OS !== "android" || Platform.OS === ("web" as any)) return;

  // قناة طلبات النقل — أعلى أولوية + تجاوز الصامت + شاشة القفل
  await Notifications.setNotificationChannelAsync("ride_alerts", {
    name: "طلبات النقل 🚖",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 200, 100, 200, 100, 500, 100, 500],
    sound: "alert.mp3",
    lightColor: "#00FF88",
    showBadge: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync("ride_alerts_v2", {
    name: "طلبات النقل (بديل) 🚖",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 200, 100, 200, 100, 500, 100, 500],
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

// ── فئة الإشعار مع زري قبول/رفض ────────────────────────────────────────────
async function setupNotificationCategories() {
  if (Platform.OS === "web") return;
  await Notifications.setNotificationCategoryAsync("incoming_ride_category", [
    {
      identifier: ACCEPT_RIDE_ACTION,
      buttonTitle: "✅ قبول",
      options: {
        opensAppToForeground: true,  // يفتح التطبيق عند الضغط على قبول
      },
    },
    {
      identifier: REJECT_RIDE_ACTION,
      buttonTitle: "❌ رفض",
      options: {
        opensAppToForeground: false, // يرفض بدون فتح التطبيق
        isDestructive: true,
      },
    },
  ]);
}

// ── طلب الأذونات اللازمة ─────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing: any = await Notifications.getPermissionsAsync();
  if (!existing.granted) {
    const result: any = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (!result.granted) return false;
  }

  // Android 14+ (API 34+): طلب USE_FULL_SCREEN_INTENT صراحةً
  if (Platform.OS === "android" && (Platform.Version as number) >= 34) {
    try {
      await PermissionsAndroid.request(
        "android.permission.USE_FULL_SCREEN_INTENT" as any,
        {
          title: "إذن المكالمات الواردة",
          message:
            "يحتاج Gaytak هذا الإذن لعرض طلبات النقل كمكالمة كاملة الشاشة حتى لو التطبيق مغلق.",
          buttonPositive: "السماح",
          buttonNegative: "رفض",
        }
      );
    } catch (e) {
      console.warn("[Notifications] فشل طلب USE_FULL_SCREEN_INTENT:", e);
    }
  }

  return true;
}

// ── حفظ push token في السيرفر ────────────────────────────────────────────────

async function registerPushToken(token: string, userId: string) {
  const storedToken  = await AsyncStorage.getItem("fcm_token");
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
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) {
      await AsyncStorage.setItem("fcm_token", token);
      await AsyncStorage.setItem("fcm_token_user", userId);
    }
  } catch (e) {
    console.warn("[PushToken] registration failed:", e);
  }
}

// ── التهيئة الكاملة (تُستدعى مرة عند بدء التطبيق) ──────────────────────────

export async function initNotifications() {
  if (Platform.OS === "web") return;
  await setupAndroidChannels();
  await setupNotificationCategories();

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn("[Notifications] permission not granted");
    return;
  }

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

// ── تسجيل مهمة الخلفية (تُستدعى بعد initNotifications) ──────────────────────

export async function registerBackgroundTask() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log("[Notifications] Background task registered ✅");
  } catch (e) {
    console.warn("[Notifications] Failed to register background task:", e);
  }
}

// ── معالجة النقر على الإشعار ─────────────────────────────────────────────────

export function useNotificationHandlers() {
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener     = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // إشعار وصل والتطبيق مفتوح (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data as any;
        console.log("[Notifications] received (fg):", data?.type);

        if (data?.type === "new_ride" && data?.rideId) {
          await AsyncStorage.setItem("incoming_ride_id", data.rideId).catch(() => {});
          await showIncomingRideNotification(
            data.rideId,
            data._fromAddress ?? data.fromAddress,
            data._toAddress  ?? data.toAddress,
            data._price      ?? data.price
          );
        }

        if (data?.type === "ride_taken") {
          await AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
          await Notifications.dismissNotificationAsync("incoming_ride").catch(() => {});
        }
      }
    );

    // المستخدم ضغط على الإشعار أو على زر قبول/رفض
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data       = response.notification.request.content.data as any;
        const actionId   = response.actionIdentifier;
        console.log("[Notifications] action:", actionId, "| type:", data?.type);

        // ── زر قبول ─────────────────────────────────────────────────────────
        if (actionId === ACCEPT_RIDE_ACTION || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          if (data?.type === "new_ride" && data?.rideId) {
            await AsyncStorage.setItem("incoming_ride_id", data.rideId).catch(() => {});
            router.push({ pathname: "/ride-driver", params: { incomingRideId: data.rideId } } as any);
          }
        }

        // ── زر رفض (بدون فتح التطبيق) ────────────────────────────────────
        if (actionId === REJECT_RIDE_ACTION && data?.rideId) {
          await AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
          await Notifications.dismissNotificationAsync("incoming_ride").catch(() => {});
          // إرسال رفض للسيرفر في الخلفية
          const authToken = await AsyncStorage.getItem("glow_token").catch(() => null);
          if (authToken) {
            fetch(`https://${DOMAIN}/api/rides/${data.rideId}/driver-reject`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${authToken}` },
            }).catch(() => {});
          }
        }

        // ── أنواع أخرى ───────────────────────────────────────────────────
        if (data?.type === "message" && data?.conversationId) {
          router.push(`/conversation/${data.conversationId}` as any);
        }
        if (data?.type === "product" && data?.productId) {
          router.push(`/product/${data.productId}` as any);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}

// ── حفظ token عند تسجيل الدخول ──────────────────────────────────────────────

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
          const token     = tokenData.data;
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

// ── إشعار المكالمة الواردة (fullScreenIntent + زري قبول/رفض) ────────────────
// يعمل هذا كـ "مكالة WhatsApp" — يفتح شاشة كاملة حتى لو الهاتف مقفل

export async function showIncomingRideNotification(
  rideId: string,
  fromAddress?: string,
  toAddress?: string,
  price?: string | number
) {
  // إلغاء أي إشعار مكالمة سابق لمنع التكرار
  await Notifications.dismissNotificationAsync("incoming_ride").catch(() => {});

  const body = fromAddress && toAddress
    ? `${fromAddress} → ${toAddress}${price ? ` · ${price} دج` : ""}`
    : "اضغط لقبول أو رفض الرحلة";

  await Notifications.scheduleNotificationAsync({
    identifier: "incoming_ride",    // معرف ثابت ← يمنع تراكم الإشعارات
    content: {
      title: "🚖 طلب نقل جديد!",
      body,
      data: {
        type: "new_ride",
        rideId,
        _fromAddress: fromAddress,
        _toAddress:   toAddress,
        _price:       String(price ?? ""),
      },
      sound: "alert.mp3",
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 200, 100, 200, 100, 500, 100, 500],
      badge: 1,
      // فئة الإشعار → تُضيف زري قبول/رفض على الإشعار
      categoryIdentifier: "incoming_ride_category",
      // fullScreenAction → يفتح التطبيق كشاشة كاملة (مثل WhatsApp)
      ...(Platform.OS === "android" ? {
        channelId: "ride_alerts",
        fullScreenAction: {
          identifier: "default",    // يفتح MainActivity ويُمرّر الإشعار
        },
      } : {}),
    },
    trigger: null,
  });
}

// ── إشعار محلي عام ───────────────────────────────────────────────────────────

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
