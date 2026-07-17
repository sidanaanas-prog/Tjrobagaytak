import { useState } from "react";
import { motion } from "framer-motion";
import { useDriverSubscription } from "@/hooks/use-driver-subscription";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Clock, AlertTriangle, RefreshCw, Car, Shield, Check, Navigation, MapPin, Star, Wallet, Bell } from "lucide-react";

const DRIVER_BENEFITS = [
  {
    icon: MapPin,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    title: "تلقي طلبات فورية",
    desc: "تلقى طلبات الكورسا من الركاب القريبين منك فورياً وبدون عمولات لأول 5 رحلات.",
  },
  {
    icon: Star,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "شارة سائق موثّق ✓",
    desc: "حسابك يحصل على شارة التوثيق التي تكسب ثقة العملاء وتزيد الرحلات بنسبة 3 أضعاف.",
  },
  {
    icon: Wallet,
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
    title: "دخل يومي إضافي ومرن",
    desc: "استقبل طلبات يومياً واجنِ أرباحك نقداً بالكامل.",
  },
];

type Props = { children: React.ReactNode; onOpen?: () => void };

export function DriverSubscriptionGate({ children }: Props) {
  const { status, loading, refetch } = useDriverSubscription();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // If driver is verified/subscribed or has free mode, let them pass
  if (status?.isSubscribed || status?.isFree) {
    return <>{children}</>;
  }

  // ── حالة وثائق معلقة قيد المراجعة ──
  if (status?.documentsStatus === "pending" || status?.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(245,158,11,0.15)]">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
        </motion.div>
        
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
          <h2 className="text-xl font-black text-white">وثائقك قيد المراجعة ⏳</h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
            يعمل فريق الإدارة حالياً على مراجعة وثائقك لتفعيل حسابك ومباشرة العمل.
            <br />
            ستحصل على <span className="text-emerald-400 font-bold">5 رحلات مجانية</span> بالكامل فور الموافقة.
          </p>
        </motion.div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 w-full max-w-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">الوثائق المقدمة</span>
            <span className="text-amber-400 font-bold">قيد التدقيق</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">العرض الترحيبي</span>
            <span className="text-emerald-400 font-bold">5 رحلات مجانية 🎁</span>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 bg-white/5 px-4 py-2 rounded-xl transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
          تحديث الحالة
        </button>
      </div>
    );
  }

  // ── حالة مرفوض ──
  if (status?.documentsStatus === "rejected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(239,68,68,0.15)]">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </motion.div>

        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
          <h2 className="text-xl font-black text-white">تم رفض وثائقك ❌</h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
            للأسف، تم رفض الوثائق المقدمة من طرفك بسبب عدم وضوح الصور أو نقص المعلومات.
          </p>
        </motion.div>

        <button
          onClick={() => navigate("/driver-register")}
          className="w-full max-w-xs h-12 rounded-xl bg-primary font-bold text-white text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
        >
          <Car className="w-4 h-4" />
          إعادة تقديم الوثائق
        </button>
      </div>
    );
  }

  // ── غير مسجل ──
  return (
    <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(168,85,247,0.15)]">
          <Shield className="w-10 h-10 text-primary" />
        </div>
      </motion.div>

      <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
        <h2 className="text-xl font-black text-white">سجل كشريك سائق 🚗</h2>
        <p className="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
          للعمل معنا واستقبل الكورسا، يرجى تقديم وثائق الهوية والسيارة للتوثيق والاستفادة من <span className="text-emerald-400 font-bold">5 رحلات مجانية</span> عند التسجيل.
        </p>
      </motion.div>

      {/* مزايا السائق */}
      <div className="space-y-2 w-full max-w-xs my-2">
        {DRIVER_BENEFITS.map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} className={`flex items-start gap-3 p-3 rounded-xl border text-right ${bg}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
              <Icon className={`w-4.5 h-4.5 ${color}`} />
            </div>
            <div className="flex-1">
              <p className={`text-xs font-bold ${color}`}>{title}</p>
              <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/driver-register")}
        className="w-full max-w-xs h-12 rounded-xl bg-primary font-bold text-white text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
      >
        <Car className="w-4 h-4" />
        سجل الآن وابدأ العمل
      </button>
    </div>
  );
}
