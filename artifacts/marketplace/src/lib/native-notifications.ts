import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

// Initialize Native Notification Channels on Android
export async function initNativeNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Request permission
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display === "granted") {
      // Create high-priority incoming call channel for drivers
      await LocalNotifications.createChannel({
        id: "incoming_rides_call",
        name: "تنبيه الكورسات والرحلات الجديدة",
        description: "إشعارات ذات أولوية قصوى تجعل الهاتف يرن مثل المكالمة القادمة",
        importance: 5, // MAX IMPORTANCE
        sound: "ringtone.wav",
        visibility: 1, // PUBLIC
        vibration: true,
        lights: true,
        lightColor: "#F59E0B",
      });
    }

    // Push Notifications
    const pushPerm = await PushNotifications.requestPermissions();
    if (pushPerm.receive === "granted") {
      await PushNotifications.register();
    }
  } catch (err) {
    console.error("Failed to initialize native notifications:", err);
  }
}

// Trigger High-Priority Call Notification on Mobile Native
export async function triggerNativeRideCall(ride: { id: string; fromAddress: string; toAddress: string; price: string }) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: "🚖 كورس جديد قادم! (طلب رحلة)",
          body: `من: ${ride.fromAddress}\nإلى: ${ride.toAddress}\nالسعر: ${ride.price} د.ج`,
          id: Math.abs(hashCode(ride.id)),
          channelId: "incoming_rides_call",
          schedule: { at: new Date(Date.now() + 100) },
          sound: "ringtone.wav",
          actionTypeId: "RIDE_CALL",
          extra: { rideId: ride.id },
        },
      ],
    });
  } catch (err) {
    console.error("Failed to trigger native ride call:", err);
  }
}

// Clear Native Call Notification
export async function clearNativeRideCall(rideId: string) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: Math.abs(hashCode(rideId)) }],
    });
  } catch (err) {
    console.error("Failed to cancel native notification:", err);
  }
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
