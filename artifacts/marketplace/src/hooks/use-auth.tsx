import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react/src/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { RENDER_API_URL, getApiUrl } from "@/lib/api-url";
import { getFCMToken, listenForegroundMessages } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    fcmToken?: string;
    gaytakFCMToken?: string;
    Android?: { getFCMToken?: () => string };
    AppInterface?: { getFCMToken?: () => string };
    onNativeToken?: (token: string) => void;
  }
}

// اكتشاف FCM Token من التطبيق الأصلي (freewebsitetoapp)
async function detectNativeToken(): Promise<string | null> {
  const check = (): string | null => {
    if (window.fcmToken) return window.fcmToken;
    if (window.gaytakFCMToken) return window.gaytakFCMToken;
    try {
      if (window.Android?.getFCMToken) {
        const t = window.Android.getFCMToken();
        if (t) return t;
      }
      if (window.AppInterface?.getFCMToken) {
        const t = window.AppInterface.getFCMToken();
        if (t) return t;
      }
    } catch {}
    return null;
  };

  // محاولة فورية
  const immediate = check();
  if (immediate) return immediate;

  // انتظر حتى 5 ثوانٍ — التطبيق قد يحتاج وقتاً لحقن التوكن
  for (const delay of [500, 1000, 1500, 2000]) {
    await new Promise(r => setTimeout(r, delay));
    const token = check();
    if (token) {
      console.log(`[FCM] 📱 تم اكتشاف التوكن بعد ${delay}ms`);
      return token;
    }
  }

  return null;
}

// حفظ FCM Token في قاعدة البيانات — يسجّل في جدول push_tokens وفي users.push_token معاً
async function saveFCMToken(userId: string, fcmToken: string) {
  const authToken = localStorage.getItem("glow_token");
  if (!authToken) return;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };
  const base = getApiUrl("");
  try {
    // 1) جدول push_tokens — هو المصدر الرئيسي لإرسال الإشعارات
    await fetch(`${base}/api/push-tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: fcmToken, platform: "web" }),
    });
    // 2) عمود users.push_token — للتوافقية مع الكود القديم
    await fetch(`${base}/api/users/${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ pushToken: fcmToken }),
    });
    console.log("[FCM] ✅ Token محفوظ في push_tokens + users:", fcmToken.slice(0, 20) + "...");
  } catch (e) {
    console.warn("[FCM] خطأ في حفظ Token:", e);
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

// In-memory token cache — survives localStorage clears within the same session.
let _memToken: string | null = localStorage.getItem("glow_token");

export function getMemToken(): string | null {
  return _memToken ?? localStorage.getItem("glow_token");
}

// Call this whenever any fetch returns 401 — clears stale token and redirects to login.
export function handle401(): void {
  _memToken = null;
  localStorage.removeItem("glow_token");
  localStorage.removeItem("glow_user");
  if (!window.location.pathname.includes("/login")) {
    window.location.replace("/login");
  }
}

// Set auth token getter once at module level so every request gets the token
// even before AuthProvider mounts.
setAuthTokenGetter(getMemToken);

const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname.includes(".onrender.com")
    ? RENDER_API_URL
    : null);
setBaseUrl(API_URL);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("glow_token"));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error: meError } = useGetMe({
    query: { enabled: !!token, retry: false, queryKey: getGetMeQueryKey() }
  });

  // If token is rejected by server (401), clear it immediately so the user
  // gets redirected to login instead of being stuck in a broken "logged in" state.
  useEffect(() => {
    if (!meError) return;
    const status = (meError as any)?.status ?? (meError as any)?.response?.status;
    if (status === 401) {
      _memToken = null;
      localStorage.removeItem("glow_token");
      localStorage.removeItem("glow_user");
      setToken(null);
    }
  }, [meError]);

  // Persist user data in localStorage so app stays usable even offline
  useEffect(() => {
    if (user) {
      localStorage.setItem("glow_user", JSON.stringify(user));
    }
  }, [user]);

  // Only fall back to cached user when there is no error from the server.
  // If the server rejected the token (401 handled above), cachedUser is already cleared.
  const cachedUser = (() => {
    if (meError) return null;
    try {
      const raw = localStorage.getItem("glow_user");
      return raw ? (JSON.parse(raw) as User) : null;
    } catch { return null; }
  })();

  const effectiveUser = user || cachedUser;

  // عند تسجيل الدخول → جلب FCM Token وحفظه
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    // ✅ تحديث onNativeToken ليحفظ مباشرة لهذا المستخدم
    window.onNativeToken = (token: string) => {
      if (!token) return;
      console.log("[FCM] 📱 onNativeToken — حفظ مباشر");
      localStorage.setItem("pending_fcm_token", token);
      saveFCMToken(userId, token);
    };

    const registerToken = async () => {
      // أولاً: تحقق من توكن محفوظ مؤقتاً (استُلم قبل تسجيل الدخول)
      const pendingToken = localStorage.getItem("pending_fcm_token");
      if (pendingToken) {
        console.log("[FCM] 📱 توكن مؤقت موجود — إرساله للسيرفر");
        await saveFCMToken(userId, pendingToken);
        localStorage.removeItem("pending_fcm_token");
        return;
      }

      // ثانياً: جرّب bridges الأصلية القديمة
      const nativeToken = await detectNativeToken();
      if (nativeToken) {
        console.log("[FCM] 📱 تم اكتشاف Token أصلي من التطبيق");
        await saveFCMToken(userId, nativeToken);
        return;
      }

      // ثالثاً: جرّب Firebase Web SDK (للمتصفح فقط)
      const webToken = await getFCMToken();
      if (webToken) {
        console.log("[FCM] 🌐 تم الحصول على Web Token");
        await saveFCMToken(userId, webToken);
      }
    };

    registerToken();

    // الاستماع لـ postMessage من التطبيق الأصلي
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (typeof data === "string" && data.startsWith("fcmToken:")) {
        const fcmToken = data.replace("fcmToken:", "");
        console.log("[FCM] 📨 Token من postMessage");
        saveFCMToken(userId, fcmToken);
      } else if (data?.fcmToken) {
        console.log("[FCM] 📨 Token من postMessage object");
        saveFCMToken(userId, data.fcmToken);
      } else if (data?.type === "fcmToken" && data?.token) {
        console.log("[FCM] 📨 Token من postMessage type");
        saveFCMToken(userId, data.token);
      }
    };
    window.addEventListener("message", handleMessage);

    // إشعارات الواجهة الأمامية (التطبيق مفتوح)
    listenForegroundMessages((title, body, data) => {
      toast({ title, description: body });
      // إذا كان إشعار رحلة جديدة أو تحديث سعر → إطلاق حدث لإظهار نافذة السباق
      if (data?.type === "new_ride" || data?.type === "price_update" || data?.type === "ride_accepted") {
        window.dispatchEvent(new CustomEvent("ride_notification", { detail: data }));
      }
    });

    // استماع للرسائل من Service Worker (push notification buttons)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "ACCEPT_RIDE") {
        const rideId = event.data.rideId;
        // إطلاق إشعار موجه للأب لفتح نافذة التأكيد
        window.dispatchEvent(new CustomEvent("ride_alert", { detail: { rideId } }));
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleSwMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      navigator.serviceWorker?.removeEventListener("message", handleSwMessage);
      window.onNativeToken = undefined;
    };
  }, [user?.id]);

  // Removed: do NOT auto-logout on API errors — token is valid for 30 days
  // The user should only be logged out explicitly via logout() or expired token

  const login = (newToken: string) => {
    _memToken = newToken;
    localStorage.setItem("glow_token", newToken);
    setToken(newToken);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const logout = () => {
    _memToken = null;
    localStorage.removeItem("glow_token");
    setToken(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
  };

  return (
    <AuthContext.Provider value={{ user: effectiveUser || null, isLoading: isLoading && !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
