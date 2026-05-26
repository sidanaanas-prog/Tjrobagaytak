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
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: payload.data || {},
    dir: "rtl",
    lang: "ar",
  });
});
