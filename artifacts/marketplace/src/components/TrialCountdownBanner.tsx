import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Gift, X, Crown } from "lucide-react";

function getTrialDaysLeft(trialExpiresAt: string | null | undefined): number | null {
  if (!trialExpiresAt) return null;
  const diff = new Date(trialExpiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getTrialHoursLeft(trialExpiresAt: string | null | undefined): number {
  if (!trialExpiresAt) return 0;
  const diff = new Date(trialExpiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60));
}

type Props = {
  trialExpiresAt: string | null | undefined;
  role: "seller" | "driver";
  onDismiss?: () => void;
};

export function TrialCountdownBanner({ trialExpiresAt, role, onDismiss }: Props) {
  const daysLeft = getTrialDaysLeft(trialExpiresAt);
  const hoursLeft = getTrialHoursLeft(trialExpiresAt);
  const [dismissed, setDismissed] = useState(false);

  if (daysLeft === null || daysLeft <= 0 || dismissed) return null;

  const isUrgent = daysLeft <= 2;
  const isLastDay = daysLeft === 1;

  const roleLabel = role === "seller" ? "البائع" : "السائق";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`mx-5 mt-3 p-3.5 rounded-2xl border ${
        isUrgent
          ? "bg-red-500/10 border-red-500/30"
          : "bg-amber-500/10 border-amber-500/25"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isUrgent ? "bg-red-500/20" : "bg-amber-500/20"
          }`}
        >
          {isLastDay ? (
            <Clock className="w-4 h-4 text-red-400 animate-pulse" />
          ) : (
            <Gift className="w-4 h-4 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${isUrgent ? "text-red-400" : "text-amber-400"}`}>
            {isLastDay
              ? `⚠️ آخر يوم في تجربتك المجانية كـ${roleLabel}!`
              : `🎉 تجربة مجانية ${daysLeft} أيام كـ${roleLabel}`}
          </p>
          <p className="text-[11px] text-white/50 mt-0.5">
            {isLastDay
              ? "اشترك الآن لعدم فقدان وصولك"
              : `متبقى ${daysLeft} أيام — استخدم جميع الميزات الآن`}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={() => { setDismissed(true); onDismiss(); }}
            className="text-white/30 hover:text-white/60 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isUrgent && (
        <div className="mt-2.5">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: `${(hoursLeft / 168) * 100}%` }}
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
            />
          </div>
          <p className="text-[10px] text-white/30 mt-1 text-center">
            {hoursLeft} ساعة متبقية
          </p>
        </div>
      )}
    </motion.div>
  );
}

/* ── Welcome popup for first-time sellers/drivers ── */
type WelcomePopupProps = {
  role: "seller" | "driver";
  daysLeft: number;
  onClose: () => void;
};

export function TrialWelcomePopup({ role, daysLeft, onClose }: WelcomePopupProps) {
  const benefits = role === "seller"
    ? [
        "نشر منتجاتك لملايين المشترين",
        "شارة توثيق ذهبية ✓ على حسابك",
        "أولوية في قسم المنتجات الرائجة",
        "إشعارات فورية عند كل طلب",
      ]
    : [
        "استقبال طلبات كورسا فورية",
        "شارة سائق موثّق ✓ على حسابك",
        "دخل يومي مرن من كل رحلة",
        "إشعارات فورية عند كل طلب جديد",
      ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="w-full max-w-sm bg-[#0f0f1a] border border-primary/30 rounded-3xl p-6 shadow-[0_0_60px_rgba(168,85,247,0.2)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-black text-white">
              🎉 مبروك! تجربة مجانية {daysLeft} أيام
            </h3>
            <p className="text-xs text-white/50 leading-relaxed">
              {role === "seller"
                ? "تم تفعيل تجربتك المجانية كبائع. ابدأ بنشر منتجاتك الآن!"
                : "تم تفعيل تجربتك المجانية كسائق. ابدأ باستقبال طلبات الكورسا!"}
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {benefits.map((b, i) => (
              <motion.div
                key={b}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8"
              >
                <Crown className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-white/70">{b}</span>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="w-full mt-5 h-12 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_24px_rgba(168,85,247,0.35)]"
          >
            ابدأ الآن ←
          </motion.button>

          <p className="text-center text-[10px] text-white/25 mt-3">
            الاشتراك المجاني ينتهي تلقائياً بعد {daysLeft} أيام
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
