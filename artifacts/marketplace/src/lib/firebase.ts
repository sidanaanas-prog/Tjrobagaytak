import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const appId = import.meta.env.VITE_FIREBASE_APP_ID || "";

const isAndroidApp =
  typeof window !== "undefined" &&
  !!(window.Android?.getFCMToken || window.AppInterface?.getFCMToken || window.gaytakFCMToken || window.fcmToken);

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId:             appId,
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const firebaseAuth: Auth = getAuth(app);
export const storage = getStorage(app);
export const firestore = getFirestore(app);

let _messaging: Messaging | null = null;
export function getFirebaseMessaging(): Messaging | null {
  if (isAndroidApp) return null;
  if (_messaging) return _messaging;
  try {
    _messaging = getMessaging(app);
    return _messaging;
  } catch {
    return null;
  }
}

export async function getFCMToken(): Promise<string | null> {
  if (isAndroidApp) return null;
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) return null;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js"),
    });
    return token;
  } catch {
    return null;
  }
}

export function listenForegroundMessages(callback: (title: string, body: string) => void) {
  if (isAndroidApp) return;
  const messaging = getFirebaseMessaging();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "Gaytak";
    const body  = payload.notification?.body  || "";
    callback(title, body);
  });
}
