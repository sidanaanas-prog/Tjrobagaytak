import { useEffect, useRef } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

// التهيئة الافتراضية لمعالج الإشعارات على مستوى الملف لضمان تسجيله دائماً فور تشغيل التطبيق
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// ── Android: إنشاء channel للإشعارات المهمة ─────────────────────────────────

export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;

  // تسجيل كلتا القناتين (القديمة والجديدة) لضمان التوافق التام مع أي إصدار من التطبيق مثبت على هاتف المستخدم
  // القناة الرئيسية لطلبات النقل — أعلى أولوية ممكنة + fullScreenIntent
  await Notifications.setNotificationChannelAsync("ride_alerts", {
    name: "طلبات النقل 🚖",
    importance: Notifications.AndroidImportance.MAX,       // IMPORTANCE_HIGH = يوقظ الشاشة
    vibrationPattern: [0, 200, 100, 200, 100, 500, 100, 500],
    sound: "alert.mp3",
    lightColor: "#00FF88",
    showBadge: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // يظهر على شاشة القفل
    bypassDnd: true,                                        // يتجاوز وضع عدم الإزعاج
  });

  // نسخة احتياطية بنفس الإعدادات
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

// ── طلب إذن الإشعارات + USE_FULL_SCREEN_INTENT (Android 14+) ────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing: any = await Notifications.getPermissionsAsync();
  if (!existing.granted) {
    const result: any = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (!result.granted) return false;
  }

  // Android 14+ (API 34+): نطلب إذن USE_FULL_SCREEN_INTENT صراحةً
  // هذا الإذن يتيح فتح شاشة كاملة (كمكالمة) حتى لو التطبيق مغلق أو الشاشة مقفلة
  if (Platform.OS === "android" && Platform.Version >= 34) {
    try {
      const granted = await PermissionsAndroid.request(
        "android.permission.USE_FULL_SCREEN_INTENT" as any,
        {
          title: "إذن المكالمات الواردة",
          message:
            "يحتاج التطبيق هذا الإذن لعرض طلبات النقل كمكالمة كاملة الشاشة عند وصول طلب جديد.",
          buttonPositive: "السماح",
          buttonNegative: "رفض",
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn("[Notifications] USE_FULL_SCREEN_INTENT لم يُمنح — إشعارات عادية فقط");
      }
    } catch (e) {
      console.warn("[Notifications] فشل طلب USE_FULL_SCREEN_INTENT:", e);
    }
  }

  return true;
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
      async (notification) => {
        const data = notification.request.content.data as any;
        console.log("[Notifications] received:", data);

        // طلب نقل جديد والتطبيق مفتوح
        if (data?.type === "new_ride" && data?.rideId) {
          await AsyncStorage.setItem("incoming_ride_id", data.rideId).catch(() => {});
          // نُظهر إشعار محلي بأعلى أولوية حتى يُعمل الـ fullScreenIntent
          await showIncomingRideNotification(data.rideId, data.fromAddress, data.toAddress, data.price);
        }
        // الرحلة أُخذت من سائق آخر — امسح من الذاكرة
        if (data?.type === "ride_taken") {
          await AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
          // إلغاء إشعار المكالمة الواردة إن كان ظاهراً
          await Notifications.dismissNotificationAsync("incoming_ride").catch(() => {});
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

// ── إشعار مكالمة واردة للسائق (fullScreenIntent) ────────────────────────────

export async function showIncomingRideNotification(
  rideId: string,
  fromAddress?: string,
  toAddress?: string,
  price?: string | number
) {
  // نلغي أي إشعار مكالمة سابق أولاً
  await Notifications.dismissAllNotificationsAsync().catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: "incoming_ride",   // معرف ثابت ← يمنع تراكم إشعارات متعددة
    content: {
      title: "🚖 طلب نقل جديد!",
      body: fromAddress && toAddress
        ? `${fromAddress} → ${toAddress}${price ? ` · ${price} دج` : ""}`
        : "اضغط لقبول أو رفض الرحلة",
      data: { type: "new_ride", rideId },
      sound: "alert.mp3",
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 200, 100, 200, 100, 500, 100, 500],
      badge: 1,
      // الـ channelId هو ما يحدد أن هذا الإشعار يعمل بـ fullScreenIntent
      // (القناة ride_alerts مضبوطة على IMPORTANCE_MAX + bypassDnd + PUBLIC)
      ...(Platform.OS === "android" ? { channelId: "ride_alerts" } : {}),
    },
    trigger: null,  // فوري
  });
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
