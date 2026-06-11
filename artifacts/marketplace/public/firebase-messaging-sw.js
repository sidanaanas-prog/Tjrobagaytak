importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCM5zG2VfmVBKCTFHXRcS1gj6sxSAOfCTE",
  projectId: "gaytak-45ae1",
  messagingSenderId: "47975948307",
  storageBucket: "gaytak-45ae1.firebasestorage.app",
  appId: "1:47975948307:android:f5ad9b31f8a46d870d5fe6",
});

const messaging = firebase.messaging();

// توليد رنة مكالمة برمجياٍ في Service Worker
function playSwAlertTone() {
  try {
    const AudioCtx = self.AudioContext || self.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.9, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    // رنة مكالمة: دددد... دددد... دددد... (تكرار 3 مرات)
    for (let i = 0; i < 3; i++) {
      const t = i * 1.5;
      playTone(880, t, 0.3);
      playTone(1100, t + 0.35, 0.3);
      playTone(880, t + 0.7, 0.3);
      playTone(1100, t + 1.05, 0.3);
    }
    // إغلاق السياق بعد الرنة
    setTimeout(() => ctx.close(), 5000);
  } catch {}
}

// إشعارات الخلفية (payload يرسل فقط data لأن notification يعالجه FCM تلقائياً)
messaging.onBackgroundMessage(function(payload) {
  const data  = payload.data || {};
  const title = data._title || "Gaytak";
  const body  = data._body  || "";
  const isRideAlert = data.type === "new_ride" || data.type === "price_update" || data._isRideAlert === "1";

  // تشغيل الرنة البرمجية في الخلفية
  if (isRideAlert) {
    playSwAlertTone();
  }

  self.registration.showNotification(title, {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    data,
    dir: "rtl",
    lang: "ar",
    tag: isRideAlert ? "ride_alert" : "default",
    requireInteraction: isRideAlert,
    // رنة واهتزاز قوي
    ...(isRideAlert && {
      sound: "/notification.mp3",
      vibrate: [200, 100, 200, 100, 200, 100, 500, 100, 500, 200, 100, 200, 100, 500],
      priority: "high",
      renotify: true,
    }),
    // أزرار للرحلة
    actions: isRideAlert ? [
      { action: "accept", title: "قبول" },
      { action: "decline", title: "رفض" },
    ] : [],
  });
});

// معالجة الضغط على الأزرار أو على الإشعار نفسه
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const data = event.notification.data;
  const isRide = data?.type === "new_ride" || data?.type === "price_update";

  if (event.action === "accept" && isRide) {
    // فتح التطبيق وإرسال رسالة للأب لقبول الرحلة
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        const client = clientList[0];
        if (client) {
          client.postMessage({
            type: "ACCEPT_RIDE",
            rideId: data.rideId,
          });
          client.focus();
        } else {
          self.clients.openWindow("/rides");
        }
      })
    );
  } else {
    // الضغط على الإشعار نفسه → فتح التطبيق
    event.waitUntil(self.clients.openWindow("/rides"));
  }
});
