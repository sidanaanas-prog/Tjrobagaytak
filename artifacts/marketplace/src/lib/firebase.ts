import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const appId = import.meta.env.VITE_FIREBASE_APP_ID || "";

const isAndroidApp =
  typeof window !== "undefined" &&
  !!(window.Android?.getFCMToken || window.AppInterface?.getFCMToken || window.gaytakFCMToken || window.fcmToken);

const hasFirebaseKey = !!import.meta.env.VITE_FIREBASE_API_KEY;

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId:             appId,
};

let app: ReturnType<typeof initializeApp> | undefined;
if (hasFirebaseKey) {
  try {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  } catch (e) {
    console.warn("[Firebase] init failed — notifications disabled", e);
  }
}

export const firebaseAuth: Auth | null = app ? getAuth(app) : null;
export const storage = app ? getStorage(app) : null;
export const firestore = app ? getFirestore(app) : null;

let _messaging: Messaging | null = null;
export function getFirebaseMessaging(): Messaging | null {
  if (isAndroidApp || !app) return null;
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

export function listenForegroundMessages(callback: (title: string, body: string, data?: Record<string, string>) => void) {
  if (isAndroidApp) return;
  const messaging = getFirebaseMessaging();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "Gaytak";
    const body  = payload.notification?.body  || "";
    const data  = payload.data as Record<string, string> | undefined;
    callback(title, body, data);
  });
}
