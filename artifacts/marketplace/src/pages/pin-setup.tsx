import { useState } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Lock, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

type Step = "create" | "confirm";

export default function PinSetupPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shaking, setShaking] = useState(false);

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

  const target = step === "create" ? pin : confirmPin;
  const setTarget = step === "create" ? setPin : setConfirmPin;

  const handleDigit = (d: string) => {
    if (submitting || target.length >= 4) return;
    const next = target + d;
    setTarget(next);
    if (next.length === 4) {
      if (step === "create") {
        setTimeout(() => setStep("confirm"), 200);
      } else {
        submitPin(next);
      }
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
    setTarget((p) => p.slice(0, -1));
  };

  async function submitPin(code: string) {
    if (code !== pin) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      setConfirmPin("");
      toast({ variant: "destructive", title: "الأكواد غير متطابقة", description: "المرجو إعادة الإدخال" });
      return;
    }
    setSubmitting(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/auth/pin/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل إنشاء الكود" });
        setSubmitting(false);
        return;
      }
      localStorage.setItem(`pin_unlocked_${userId}`, Date.now().toString());
      toast({ title: "✅ تم إنشاء الكود", description: "الآن حسابك محمي بكود أربعي" });
      setLocation("/");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالسيرفر" });
      setSubmitting(false);
    }
  }

  const title = step === "create" ? "أنشئ كود حماية" : "أكد الكود";
  const subtitle = step === "create"
    ? "اختر كود أربعي لحماية حسابك"
    : "أدخل الكود مرة أخرى للتأكيد";

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
        <h1 className="text-xl font-black text-white mb-1">{title}</h1>
        <p className="text-sm text-white/40 mb-8">{subtitle}</p>

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
                i < target.length
                  ? "bg-primary border-primary shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                  : "border-white/20 bg-transparent"
              }`}
            />
          ))}
        </motion.div>

        {/* Keypad */}
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
          <div />
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

        {step === "confirm" && (
          <button
            onClick={() => { setStep("create"); setPin(""); setConfirmPin(""); }}
            className="mt-6 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            ← إعادة الإدخال
          </button>
        )}

        <button
          onClick={() => { localStorage.removeItem("glow_token"); setLocation("/login"); }}
          className="mt-4 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          تسجيل الخروج
        </button>
      </motion.div>
    </div>
  );
}
