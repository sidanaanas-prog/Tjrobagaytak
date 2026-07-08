import { useState, useEffect } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ShieldAlert, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

export default function PinLockPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(3);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    setLocation("/login");
    return null;
  }

  const userId = user.id;

  const handleDigit = (d: string) => {
    if (locked || submitting || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      verifyPin(next);
    }
  };

  const handleBackspace = () => {
    if (locked || submitting) return;
    setPin((p) => p.slice(0, -1));
  };

  async function verifyPin(code: string) {
    setSubmitting(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/auth/pin/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "locked") {
          setLocked(true);
          toast({ variant: "destructive", title: "حساب مقفل", description: data.message });
        } else if (data.error === "wrong") {
          setRemaining(data.remaining ?? 0);
          setShaking(true);
          setTimeout(() => setShaking(false), 400);
          setPin("");
          toast({ variant: "destructive", title: "كود خاطئ", description: `متبقى ${data.remaining} محاولات` });
        } else {
          toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل التحقق" });
        }
        setSubmitting(false);
        return;
      }

      // Success — unlock
      localStorage.setItem(`pin_unlocked_${userId}`, Date.now().toString());
      toast({ title: "✅ تم فتح القفل" });
      setLocation("/");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالسيرفر" });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6" dir="rtl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-xs flex flex-col items-center"
      >
        <div className="w-20 h-20 rounded-3xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(168,85,247,0.2)]">
          <Lock className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-xl font-black text-white mb-1">قفل التطبيق</h1>
        <p className="text-sm text-white/40 mb-8">أدخل الكود الأربعي لفتح الحساب</p>

        {/* PIN dots */}
        <motion.div
          animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex gap-3 mb-10"
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? "bg-primary border-primary shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  : "border-white/20 bg-transparent"
              }`}
            />
          ))}
        </motion.div>

        {remaining < 3 && !locked && (
          <p className="text-xs text-red-400 mb-4">متبقى {remaining} محاولات</p>
        )}

        {locked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-2"
          >
            <ShieldAlert className="w-8 h-8 text-red-400" />
            <p className="text-sm font-bold text-red-300 text-center">تم تجاوز الحد الأقصى</p>
            <p className="text-xs text-white/50 text-center">
              تواصل مع الدعم لإعادة تفعيل الحساب
            </p>
            <button
              onClick={() => setLocation("/support")}
              className="mt-1 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-xs font-bold"
            >
              ✆ التواصل مع الدعم
            </button>
          </motion.div>
        )}

        {/* Keypad */}
        {!locked && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <motion.button
                key={d}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleDigit(d)}
                className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-xl font-bold flex items-center justify-center active:bg-white/10"
              >
                {d}
              </motion.button>
            ))}
            <div /> {/* spacer */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => handleDigit("0")}
              className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white text-xl font-bold flex items-center justify-center active:bg-white/10"
            >
              0
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleBackspace}
              className="aspect-square rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold flex items-center justify-center active:bg-white/10"
            >
              &#9003;
            </motion.button>
          </div>
        )}

        <button
          onClick={() => { localStorage.removeItem("glow_token"); setLocation("/login"); }}
          className="mt-8 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          تسجيل الخروج ←
        </button>
      </motion.div>
    </div>
  );
}
