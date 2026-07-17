import { useState, useEffect, useCallback } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { motion } from "framer-motion";
import {
  Wallet, ArrowLeft, ArrowUpRight, ArrowDownRight,
  Car, Loader2, MessageCircle, Phone, Building2, Info,
} from "lucide-react";

const BASE = getApiUrl("");

type Transaction = {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  status: string;
};

type WalletData = {
  id: string;
  balance: string;
  currency: string;
  transactions: Transaction[];
};

export default function WalletPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    const token = getMemToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWallet(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-4">
          <Wallet className="w-16 h-16 text-muted mx-auto" />
          <p className="text-lg font-bold">سجل الدخول للمحفظة</p>
          <button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold">
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-5 pb-24" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">المحفظة</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-5">
          {/* بطاقة الرصيد */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-lg transition-all ${
              wallet && Number(wallet.balance) < 0
                ? "bg-gradient-to-br from-red-600 via-red-500/90 to-red-400/80 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                : "bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-[0_0_40px_rgba(168,85,247,0.3)]"
            }`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/70 text-sm font-medium">
                {wallet && Number(wallet.balance) < 0 ? "الرصيد المطلوب سداده (مستحقات التطبيق) ⚠️" : "الرصيد المتوفر"}
              </p>
              <p className="text-4xl font-black mt-1 text-right" dir="ltr">
                {wallet ? Number(wallet.balance).toLocaleString("ar-DZ") : "0"}
                <span className="text-xl font-bold ml-2">ألف دورو</span>
              </p>
              <div className="flex items-center gap-2 mt-4 text-white/60 text-xs">
                <Wallet className="w-4 h-4" />
                <span>محفظة Gaytak — {user.name}</span>
              </div>
            </div>
          </motion.div>

          {/* دليل السائق التوضيحي للمحفظة والعمولة */}
          {(user.role === "driver" || user.role === "admin") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-2.5 text-right"
            >
              <div className="flex items-center gap-2 text-purple-400">
                <Wallet className="w-4.5 h-4.5 shrink-0" />
                <p className="text-xs font-bold">دليل المحفظة والحساب الإداري للشركاء</p>
              </div>
              <p className="text-[11px] text-white/75 leading-relaxed">
                مرحباً بك كشريك سائق! في تطبيق <b>Gaytak</b>، تستلم <b>100% من أجرة الرحلات نقداً (كاش)</b> بالكامل من الركاب مباشرة عند إكمال كل رحلة. 
              </p>
              <p className="text-[11px] text-white/70 leading-relaxed">
                تقوم المحفظة بدور <b>دفتر حسابات إداري</b> يسجل رصيدك المالي لدى التطبيق:
              </p>
              <ul className="text-[11px] text-white/60 space-y-1.5 list-disc list-inside pr-1">
                <li><span className="text-white/80 font-bold">رحلات ترحيبية:</span> أول 5 رحلات لك معفية تماماً من العمولات (0% عمولة).</li>
                <li><span className="text-white/80 font-bold">خصم العمولة:</span> بعد الرحلات المجانية الأولى، تُخصم عمولة الخدمة المحددة تلقائياً من رصيد محفظتك، مما يجعل رصيدك يتناقص تدريجياً.</li>
                <li><span className="text-white/80 font-bold">الرصيد السالب:</span> رصيدك يمكن أن يصبح سالباً بعد قبول الرحلات. يتطلب منك شحن رصيد المحفظة عبر الإدارة لمواصلة العمل واستلام طلبات جديدة عندما يقل عن الحد المسموح.</li>
              </ul>
            </motion.div>
          )}

          {/* كيفية الشحن */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400 shrink-0" />
              <p className="text-sm font-bold text-blue-300">كيف تشحن محفظتك؟</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              لشحن المحفظة تواصل مع الدعم داخل التطبيق أو زُر مكتبنا مباشرة، وسيتم إضافة الرصيد خلال دقائق.
            </p>

            {/* طريقة 1: دعم التطبيق */}
            <button
              onClick={() => navigate("/support")}
              className="w-full flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-xl p-3 hover:bg-primary/15 transition-colors text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">دعم التطبيق</p>
                <p className="text-[11px] text-muted-foreground">تواصل مع فريقنا مباشرة عبر المحادثة</p>
              </div>
              <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </button>

            {/* طريقة 2: زيارة المكتب */}
            <div className="flex items-center gap-3 bg-green-500/8 border border-green-500/20 rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">زيارة المكتب</p>
                <p className="text-[11px] text-muted-foreground">تفضّل بزيارتنا وادفع نقداً أو بطاقة</p>
              </div>
            </div>
          </motion.div>

          {/* أزرار سريعة */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate("/rides")}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/15 border border-primary/25 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            >
              <Car className="w-4 h-4" /> طلب كورسا
            </button>
            <button
              onClick={() => navigate("/support")}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted border border-border text-foreground font-bold text-sm hover:bg-muted/80 transition-colors"
            >
              <Phone className="w-4 h-4" /> تواصل معنا
            </button>
          </div>

          {/* سجل العمليات */}
          <div>
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-primary" /> سجل العمليات
            </h3>
            {!wallet || wallet.transactions.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Wallet className="w-10 h-10 text-muted mx-auto" />
                <p className="text-sm text-muted-foreground">لا توجد عمليات بعد</p>
                <p className="text-xs text-muted-foreground">ستظهر هنا عمليات الشحن والدفع</p>
              </div>
            ) : (
              <div className="space-y-2">
                {wallet.transactions.map((t) => {
                  const isIn = ["deposit", "ride_earning", "refund"].includes(t.type);
                  const typeLabels: Record<string, string> = {
                    deposit: "شحن رصيد",
                    withdrawal: "سحب",
                    ride_payment: "دفع كورسا",
                    ride_earning: "أرباح كورسا",
                    refund: "استرداد",
                    penalty: "غرامة",
                  };
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-card border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIn ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {isIn ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{typeLabels[t.type] ?? t.description ?? t.type}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <span className={`text-sm font-black ${isIn ? "text-green-400" : "text-red-400"}`}>
                        {isIn ? "+" : "-"}{Math.abs(Number(t.amount)).toLocaleString("ar-DZ")} ألف دورو
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
