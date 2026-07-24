import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useDriverSubscription } from "@/hooks/use-driver-subscription";
import { getApiUrl } from "@/lib/api-url";
import { motion } from "framer-motion";
import { initNativeNotifications, triggerNativeRideCall, clearNativeRideCall } from "@/lib/native-notifications";

import { useToast } from "@/hooks/use-toast";
import {
  Car, MapPin, CheckCircle, XCircle, Loader2, DollarSign,
} from "lucide-react";

const BASE = getApiUrl("");

type Ride = {
  id: string;
  status: "pending" | "accepted" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  createdAt: string;
  passengerCount?: number;
};

type AlertType = "new_ride" | "price_update";

interface RideAlertState {
  ride: Ride | null;
  type: AlertType | null;
  countdown: number;
}

interface RideAlertContextType {
  alertState: RideAlertState;
  setAlertState: (s: RideAlertState) => void;
  handleAccept: (id: string) => Promise<boolean>;
  handleDismiss: () => void;
}

const RideAlertContext = createContext<RideAlertContextType | null>(null);

export function useRideAlert() {
  const ctx = useContext(RideAlertContext);
  if (!ctx) throw new Error("useRideAlert must be used within RideAlertProvider");
  return ctx;
}

// ملف صوت ممبلي للرنة المميزة (موشور)
const CALL_RING_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// نشطف audio لوك مقالب لمساعدة متصفحي
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  return audioCtx;
}

// فتح AudioContext بتفاعل مستخدم (لمساعدة Safari)
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume();
  }
  // شغل صوت صامت لفتح القيود
  const silent = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAA=");
  silent.play().catch(() => {});
}

// رنة مكالمة مستمرة (تكرار بشكل مستمر)
function playContinuousAlert() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return null;

    // تأكد أن الـ AudioContext مفتوح
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.8, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // رنة مكالمة: دددد... دددد... (تكرار 3 مرات)
    const playPattern = () => {
      for (let i = 0; i < 3; i++) {
        const t = i * 1.5;
        playTone(880, t, 0.3);
        playTone(1100, t + 0.35, 0.3);
        playTone(880, t + 0.7, 0.3);
        playTone(1100, t + 1.05, 0.3);
      }
    };

    playPattern();

    // تكرار الرنة كل 5 ثواني بشكل مستمر
    const interval = setInterval(() => {
      playPattern();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  } catch {
    return null;
  }
}

function getRole(): string | null {
  return localStorage.getItem("gaytak_active_role");
}

export function RideAlertProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  const { status: subStatus } = useDriverSubscription();

  const [alertState, setAlertState] = useState<RideAlertState>({
    ride: null,
    type: null,
    countdown: 30,
  });
  const [accepting, setAccepting] = useState(false);

  const role = getRole();
  const isDriver = role === "driver";
  const isSubscribed = subStatus?.isSubscribed ?? false;
  const isFree = subStatus?.isFree ?? false;
  const isDriverActive = isSubscribed || isFree;
  
  // Debug log for driver subscription status
  useEffect(() => {
    if (isDriver) {
      console.log('[RideAlert] Driver status:', { isSubscribed, isFree, isDriverActive, trialExpiresAt: subStatus?.trialExpiresAt });
    }
  }, [isDriver, isSubscribed, isFree, isDriverActive, subStatus?.trialExpiresAt]);

  const stopSoundRef = useRef<(() => void) | null>(null);
  const prevRequestsRef = useRef<Ride[]>([]);
  const isInitialFetchRef = useRef<boolean>(true);

  const handleDismiss = useCallback(() => {
    if (alertState.ride) {
      clearNativeRideCall(alertState.ride.id);
    }
    setAlertState({ ride: null, type: null, countdown: 0 });
    if (stopSoundRef.current) {
      stopSoundRef.current();
      stopSoundRef.current = null;
    }
  }, [alertState.ride]);

  const handleAccept = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides/${id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      handleDismiss();
      return { success: res.ok && data.success, error: data.error };
    } catch {
      handleDismiss();
      return { success: false, error: "فشل الاتصال بالخادم" };
    }
  }, [handleDismiss]);

  // جلب الطلبات
  const fetchRequests = useCallback(async () => {
    const token = getMemToken();
    if (!token || !isDriver || !isDriverActive) return;
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        fetch(`${BASE}/api/rides/driver?status=pending`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/rides/driver?status=accepted`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pending = await pendingRes.json();
      const accepted = await acceptedRes.json();
      const requests: Ride[] = [
        ...(Array.isArray(pending) ? pending : []),
        ...(Array.isArray(accepted) ? accepted : []),
      ];

      // إذا كان هذا أول جلب بعد فتح التطبيق
      if (isInitialFetchRef.current) {
        isInitialFetchRef.current = false;
        prevRequestsRef.current = requests;

        // التحقق فقط من الطلبات التي أنشئت خلال آخر 60 ثانية للتنبيه بها
        const now = Date.now();
        const superFresh = requests.find((r) => {
          if (r.status !== "pending") return false;
          const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
          return now - createdTime < 60000; // أحدث من دقيقة واحدة فقط
        });

        if (superFresh) {
          setAlertState({
            ride: superFresh,
            type: "new_ride",
            countdown: 30,
          });
          stopSoundRef.current = playContinuousAlert() ?? null;
          triggerNativeRideCall(superFresh);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200, 100, 500, 100, 500]);
        }
        return;
      }

      // اكتشاف طلبات جديدة لم تكن موجودة سابقاً
      const newOnes = requests.filter(
        (r: Ride) => r.status === "pending" && !prevRequestsRef.current.find((p) => p.id === r.id)
      );

      // اكتشاف تحديث سعر (طلب موجود لكن سعر تغير)
      const priceUpdated = requests.filter(
        (r: Ride) => {
          const prev = prevRequestsRef.current.find((p) => p.id === r.id);
          if (!prev || prev.price === r.price) return false;
          return r.status === "pending";
        }
      );

      // إذا كانت الرحلة المعروضة حالياً تم قبولها من سائق آخر أو تم إلغاؤها ← إيقاف الرنة فوراً
      if (alertState.ride && (alertState.type === "new_ride" || alertState.type === "price_update")) {
        const stillPending = requests.find((r: Ride) => r.id === alertState.ride!.id && r.status === "pending");
        if (!stillPending) {
          handleDismiss();
        }
      }

      if (newOnes.length > 0) {
        setAlertState({
          ride: newOnes[0],
          type: "new_ride",
          countdown: 30,
        });
        // رنة + اهتزاز + إشعار ناتيف أندرويد
        stopSoundRef.current = playContinuousAlert() ?? null;
        triggerNativeRideCall(newOnes[0]);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200, 100, 500, 100, 500]);
      } else if (priceUpdated.length > 0 && !alertState.ride) {
        setAlertState({
          ride: priceUpdated[0],
          type: "price_update",
          countdown: 30,
        });
        stopSoundRef.current = playContinuousAlert() ?? null;
        triggerNativeRideCall(priceUpdated[0]);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200, 100, 500, 100, 500]);
      }

      prevRequestsRef.current = requests;
    } catch {}
  }, [isDriver, isDriverActive, alertState.ride, handleDismiss]);

  // تهيئة الإشعارات الصوتية الناتيف على الأندرويد
  useEffect(() => {
    initNativeNotifications();
  }, []);

  // استماع للرسائل من Service Worker
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.rideId) {
        // إعادة جلب الطلبات لإظهار النافذة
        fetchRequests();
      }
    };
    window.addEventListener("ride_alert", handler);
    return () => window.removeEventListener("ride_alert", handler);
  }, [fetchRequests]);

  // استماع لإشعارات Foreground (Firebase)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "new_ride" || detail?.type === "price_update") {
        fetchRequests();
      }
    };
    window.addEventListener("ride_notification", handler);
    return () => window.removeEventListener("ride_notification", handler);
  }, [fetchRequests]);

  // استطلاع كل 1 ثانية عندما يكون هنالك تنبيه منبثق، وكل 5 ثواني في الحالة العادية
  useEffect(() => {
    if (!isDriver || !isDriverActive || !user?.id) return;
    fetchRequests();
    const intervalMs = alertState.ride ? 1000 : 5000;
    const iv = setInterval(fetchRequests, intervalMs);
    return () => clearInterval(iv);
  }, [isDriver, isDriverActive, user?.id, fetchRequests, alertState.ride]);

  // العداد التنازلي
  useEffect(() => {
    if (!alertState.ride) return;
    const iv = setInterval(() => {
      setAlertState((s) => {
        if (s.countdown <= 1) {
          if (stopSoundRef.current) {
            stopSoundRef.current();
            stopSoundRef.current = null;
          }
          return { ride: null, type: null, countdown: 0 };
        }
        return { ...s, countdown: s.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [alertState.ride]);

  // إيقاف الرنة عند قبول/رفض
  useEffect(() => {
    if (!alertState.ride && stopSoundRef.current) {
      stopSoundRef.current();
      stopSoundRef.current = null;
    }
  }, [alertState.ride]);

  const ctxValue: RideAlertContextType = {
    alertState,
    setAlertState,
    handleAccept,
    handleDismiss,
  };

  return (
    <RideAlertContext.Provider value={ctxValue}>
      {children}

      {/* نافذة السباق العاملة */}
      {alertState.ride && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" dir="rtl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-[#0c0c14] border border-primary/30 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(168,85,247,0.25)]"
          >
            {/* رأس */}
            <div className={`p-4 text-center border-b ${alertState.type === "price_update" ? "bg-yellow-500/20 border-yellow-500/20" : "bg-primary/20 border-primary/20"}`}>
              <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-2 animate-pulse ${alertState.type === "price_update" ? "bg-yellow-500/20 border-yellow-500/40" : "bg-primary/20 border-primary/40"}`}>
                <Car className={`w-8 h-8 ${alertState.type === "price_update" ? "text-yellow-400" : "text-primary"}`} />
              </div>
              <p className="text-lg font-black text-white">
                {alertState.type === "price_update" ? "سعر جديد!" : "طلب كورسا جديد!"}
              </p>
              <p className="text-xs text-white/50">
                {alertState.type === "price_update" ? "الراكب عدل السعر" : "الأول يقبل يفوز"}
              </p>
            </div>

            {/* تفاصيل */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-green-400" />
                <span className="text-white/80">{alertState.ride.fromAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-red-400" />
                <span className="text-white/80">{alertState.ride.toAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className={`w-4 h-4 ${alertState.type === "price_update" ? "text-yellow-400" : "text-primary"}`} />
                <span className={`font-bold ${alertState.type === "price_update" ? "text-yellow-400" : "text-white"}`}>
                  {alertState.ride.price} ألف دورو
                </span>
                {alertState.type === "price_update" && (
                  <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-1.5 rounded-full">سعر جديد</span>
                )}
              </div>

              {/* العداد */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="w-12 h-12 rounded-full border-2 border-red-400 flex items-center justify-center">
                  <span className="text-xl font-black text-red-400">{alertState.countdown}</span>
                </div>
              </div>

              {/* أزرار */}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setAccepting(true);
                    const res = await handleAccept(alertState.ride!.id);
                    if (res.success) {
                      toast({ title: "✅ تم القبول!", description: "الراكب ينتظرك" });
                      localStorage.setItem("gaytak_active_role", "driver");
                      window.location.href = "/rides";
                    } else {
                      toast({ title: "❌ تعذر القبول", description: res.error || "تم قبول الطلب من سائق آخر", variant: "destructive" });
                    }
                    setAccepting(false);
                  }}
                  disabled={accepting}
                  className="flex-1 py-4 rounded-2xl bg-primary text-white font-black text-lg shadow-[0_0_30px_rgba(168,85,247,0.4)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {accepting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                  قبول الرحلة
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-4 rounded-2xl border border-white/15 text-white/60 font-bold text-sm active:scale-[0.97]"
                >
                  رفض
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </RideAlertContext.Provider>
  );
}
