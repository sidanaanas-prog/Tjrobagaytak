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

// إشعارات الخلفية (عندما يكون التطبيق مغلقاً)
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || "Gaytak";
  const body  = payload.notification?.body  || "";
  const data  = payload.data || {};

  const isRideAlert = data.type === "new_ride";

  self.registration.showNotification(title, {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    data,
    dir: "rtl",
    lang: "ar",
    // إشعار حرج
    tag: isRideAlert ? "ride_alert" : "default",
    requireInteraction: isRideAlert,
    // رنة قوية واهتزاز
    ...(isRideAlert && {
      sound: "/notification.mp3",
      vibrate: [200, 100, 200, 100, 200, 100, 500, 100, 500],
      priority: "high",
      renotify: true,
    }),
    // أزرار لاعب
    actions: isRideAlert ? [
      { action: "accept", title: "قبول" },
      { action: "decline", title: "رفض" },
    ] : [],
  });
});

// معالجة الضغط على الأزرار
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const data = event.notification.data;

  if (event.action === "accept" && data?.type === "new_ride") {
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
    event.waitUntil(self.clients.openWindow("/rides"));
  }
});
