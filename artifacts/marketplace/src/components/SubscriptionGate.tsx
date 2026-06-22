import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Crown, Check, Upload, ChevronRight, Loader2, X,
  Clock, BadgeCheck, Eye, TrendingUp, Zap, Copy,
  ShieldCheck, AlertTriangle, RefreshCw, Smartphone, Banknote,
} from "lucide-react";

const BASE = getApiUrl("");

const PLANS = {
  "1month": {
    label: "1 شهر",
    price: "2,000",
    priceNum: 2000,
    doro: "20,000",
    tag: "أشهر",
    desc: "جرّب واحد مشاهد مخصرات",
  },
  "6months": {
    label: "6 أشهر",
    price: "5,000",
    priceNum: 5000,
    doro: "100,000",
    tag: null,
    desc: "ابدأ النشر وجرّب الفرق",
  },
  "12months": {
    label: "12 شهراً",
    price: "10,000",
    priceNum: 10000,
    doro: "مليون",
    tag: "الأوفر",
    desc: "سنة كاملة بسعر أقل شهرياً",
  },
} as const;

type Plan = keyof typeof PLANS;
type Step = "plan" | "method" | "bankily" | "cash";

const BENEFITS = [
  {
    icon: Eye,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    title: "منتجاتك تظهر للجميع",
    desc: "بدون اشتراك منتجاتك مخفية تماماً — الاشتراك يجعلها مرئية لكل المشترين",
  },
  {
    icon: BadgeCheck,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "نجمة متجر موثّق ✓",
    desc: "المتاجر الموثّقة تكسب ثقة المشترين وتحقق مبيعات أعلى",
  },
  {
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/20",
    title: "أولوية في المنتجات الرائجة",
    desc: "منتجاتك تظهر في أبرز قسم على التطبيق وتصل لآلاف المشترين",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
    title: "دعم ذو أولوية وتوصيل سريع",
    desc: "فريق الدعم يعطيك الأولوية في كل طلب أو مشكلة",
  },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Props = { children: React.ReactNode; type: "product" | "video" };

export function SubscriptionGate({ children, type }: Props) {
  const { status, loading, refetch } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<Step>("plan");
  const [plan, setPlan] = useState<Plan>("1month");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setStep("plan");
    setProofFile(null); setProofPreview(null);
    setIdFile(null); setIdPreview(null);
    setSubmitting(false);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setProofFile(null); setProofPreview(null);
    setIdFile(null); setIdPreview(null);
    setSubmitting(false);
  }

  function copyAccount() {
    navigator.clipboard.writeText("22978051").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function pickFile(file: File, t: "proof" | "id") {
    const url = URL.createObjectURL(file);
    if (t === "proof") { setProofFile(file); setProofPreview(url); }
    else { setIdFile(file); setIdPreview(url); }
  }

  async function submitBankily() {
    if (!proofFile) {
      toast({ variant: "destructive", title: "أرفق صورة وصل الدفع" });
      return;
    }
    if (!idFile) {
      toast({ variant: "destructive", title: "أرفق صورة بطاقة الهوية للتحقق" });
      return;
    }
    setSubmitting(true);
    try {
      const proofBase64 = await fileToBase64(proofFile);
      const idBase64 = await fileToBase64(idFile);
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getMemToken()}` },
        body: JSON.stringify({ plan, paymentMethod: "ccp", paymentProofUrl: proofBase64, idDocumentUrl: idBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      toast({ title: "✅ تم إرسال طلبك!", description: "سيتم مراجعته خلال 24 ساعة" });
      closeModal(); refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setSubmitting(false); }
  }

  async function submitCash() {
    if (!idFile) {
      toast({ variant: "destructive", title: "أرفق صورة وثيقتك الرسمية" });
      return;
    }
    setSubmitting(true);
    try {
      const idBase64 = await fileToBase64(idFile);
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getMemToken()}` },
        body: JSON.stringify({ plan, paymentMethod: "cash", idDocumentUrl: idBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      toast({ title: "✅ تم إرسال الطلب!", description: "سيتواصل معك فريق الدعم قريباً" });
      closeModal(); refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (status?.isActive || status?.isFree) return <>{children}</>;

  const typeLabel = type === "product" ? "المنتجات" : "الفيديوهات";
  const isExistingUser = !!(user as any)?.createdAt;
  const isPending = status?.latestRequest?.status === "pending";
  const isRejected = status?.latestRequest?.status === "rejected";

  /* ── قيد المراجعة ── */
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-24 h-24 rounded-3xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(234,179,8,0.15)]">
            <Clock className="w-12 h-12 text-yellow-400" />
          </div>
        </motion.div>
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
          <h2 className="text-2xl font-black text-white">طلبك قيد المراجعة</h2>
          <p className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed">
            وصلنا طلبك وهو الآن قيد المراجعة من فريق Gaytak.<br />
            ستتلقى إشعاراً فور الموافقة.
          </p>
        </motion.div>
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18 }}
          className="bg-yellow-500/8 border border-yellow-500/20 rounded-2xl px-6 py-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-400/80">وقت المراجعة المعتاد: 24 – 48 ساعة</p>
        </motion.div>
      </div>
    );
  }

  /* ── مرفوض ── */
  if (isRejected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto">
            <X className="w-12 h-12 text-red-400" />
          </div>
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">تم رفض طلبك</h2>
          <p className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed">
            للأسف تم رفض طلب الاشتراك. يمكنك إعادة المحاولة بمعلومات صحيحة.
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openModal}
          className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_24px_rgba(168,85,247,0.35)]"
        >
          <RefreshCw className="w-4 h-4" />
          أعد المحاولة
        </motion.button>
        {renderModal()}
      </div>
    );
  }

  /* ── مستخدم قديم (متجر موجود غير مشترك) ── */
  if (isExistingUser) {
    return (
      <>
        <div className="flex flex-col min-h-[82vh] px-5 pb-10" dir="rtl">

          {/* شعار تعليق المتجر */}
          <motion.div
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="mt-6 mb-5 rounded-3xl overflow-hidden border border-orange-500/25 bg-gradient-to-br from-orange-500/8 via-orange-500/4 to-transparent"
          >
            <div className="px-5 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5.5 h-5.5 text-orange-400" style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <p className="text-sm font-black text-orange-400">متجرك موقوف مؤقتاً</p>
                  <p className="text-[11px] text-white/40 mt-0.5">منتجاتك مخفية حتى تجدّد اشتراكك</p>
                </div>
              </div>

              <div className="h-px bg-white/5 mb-4" />

              <p className="text-xs text-white/55 leading-relaxed mb-4">
                لاستمرار الظهور ونشر {typeLabel}، وثّق متجرك على Gaytak واحصل على:
              </p>

              <div className="space-y-2 mb-5">
                {[
                  { icon: Eye, text: "منتجاتك تظهر لجميع المشترين فوراً" },
                  { icon: BadgeCheck, text: "نجمة متجر موثّق ✓ على حسابك" },
                  { icon: TrendingUp, text: "أولوية في قسم المنتجات الرائجة" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-xs text-white/65">{text}</span>
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openModal}
                className="w-full h-12 rounded-2xl bg-gradient-to-l from-orange-500 to-orange-400 text-white font-black text-sm shadow-[0_0_28px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                اشترك الآن وأعِد تفعيل متجرك
                <ChevronRight className="w-4 h-4" />
              </motion.button>

              <p className="text-center text-[11px] text-white/25 mt-3">
                الحالات مجانية دائماً ✓ — الاشتراك للنشر التجاري فقط
              </p>
            </div>
          </motion.div>

          {/* عرض الأسعار السريع */}
          <motion.div
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}
            className="grid grid-cols-3 gap-3 mb-5"
          >
            {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, info]) => (
              <div key={key} className={`relative rounded-2xl border p-4 text-center ${key === "12months" ? "border-primary/30 bg-primary/8" : "border-white/10 bg-white/4"}`}>
                {info.tag && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-0.5 rounded-full whitespace-nowrap">
                    {info.tag}
                  </span>
                )}
                <p className="text-[11px] text-white/40 mb-1">{info.label}</p>
                <p className="text-2xl font-black text-white leading-none">{info.price}</p>
                <p className="text-[10px] text-white/30 mt-0.5">دج</p>
                <p className="text-[11px] text-primary mt-1.5 font-bold">{info.doro} دورو</p>
              </div>
            ))}
          </motion.div>

        </div>
        {renderModal()}
      </>
    );
  }

  /* ── مستخدم جديد ── */
  return (
    <>
      <div className="flex flex-col min-h-[85vh] px-5 pb-10 overflow-y-auto" dir="rtl">

        {/* Hero */}
        <div className="pt-10 pb-6 text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 13 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-purple-900/50 border border-primary/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_60px_rgba(168,85,247,0.3)]"
          >
            <Crown className="w-12 h-12 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.07 }}
            className="text-2xl font-black text-white mb-2"
          >
            وثّق متجرك وابدأ البيع
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}
            className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed"
          >
            لنشر {typeLabel} على Gaytak يجب توثيق متجرك —<br />اشتراك واحد يفتح أمامك كل الأبواب
          </motion.p>
        </div>

        {/* مزايا */}
        <motion.div
          initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="space-y-2.5 mb-6"
        >
          {BENEFITS.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className={`flex items-start gap-3.5 p-3.5 rounded-2xl border ${bg}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${color}`}>{title}</p>
                <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* الأسعار */}
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, info]) => (
            <div key={key} className={`relative rounded-2xl border p-4 text-center ${key === "12months" ? "border-primary/30 bg-primary/8 shadow-[0_0_20px_rgba(168,85,247,0.1)]" : "border-white/10 bg-white/4"}`}>
              {info.tag && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black px-3 py-0.5 rounded-full whitespace-nowrap shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                  {info.tag}
                </span>
              )}
              <p className="text-[11px] text-white/35 mb-1">{info.label}</p>
              <p className="text-2xl font-black text-white leading-none">{info.price}</p>
              <p className="text-[10px] text-white/30">دج</p>
              <p className="text-[11px] text-primary font-bold mt-1">{info.doro} دورو</p>
              <p className="text-[10px] text-white/25 mt-0.5">{info.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* زر اشترك */}
        <motion.button
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.27 }}
          whileTap={{ scale: 0.97 }}
          onClick={openModal}
          className="w-full h-14 rounded-2xl bg-primary font-black text-white text-base shadow-[0_0_35px_rgba(168,85,247,0.45)] flex items-center justify-center gap-2.5"
        >
          <Crown className="w-5 h-5" />
          اشترك الآن — ابدأ النشر فوراً
          <ChevronRight className="w-4 h-4" />
        </motion.button>

        <p className="mt-3 text-center text-[11px] text-white/25">
          الحالات مجانية دائماً ✓ — الاشتراك للنشر التجاري فقط
        </p>
      </div>

      {renderModal()}
    </>
  );

  /* ─── المودال المشترك ─── */
  function renderModal() {
    const planInfo = PLANS[plan];

    return (
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              key="sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-lg bg-[#0c0c14] border-t border-white/8 rounded-t-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* مقبض */}
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-3 mb-0.5" />

              {/* رأس المودال */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                {step !== "plan" ? (
                  <button
                    onClick={() => setStep(step === "bankily" || step === "cash" ? "method" : "plan")}
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    ← رجوع
                  </button>
                ) : <div className="w-10" />}

                <h3 className="text-sm font-black text-white">
                  {step === "plan" && "اختر الباقة"}
                  {step === "method" && "طريقة الدفع"}
                  {step === "bankily" && "دفع عبر بنكيلي"}
                  {step === "cash" && "دفع نقدي"}
                </h3>

                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="px-5 py-5 pb-12 max-h-[84vh] overflow-y-auto space-y-4">

                {/* ── الخطوة 1: اختيار الباقة ── */}
                {step === "plan" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => setPlan(key)}
                          className={`relative p-4 rounded-2xl border text-right transition-all active:scale-[0.97] ${
                            plan === key
                              ? "border-primary bg-primary/12 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                              : "border-white/10 bg-white/4 hover:bg-white/7"
                          }`}
                        >
                          {info.tag && (
                            <span className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                              {info.tag}
                            </span>
                          )}
                          {plan === key && (
                            <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                          <p className="text-[11px] text-white/40 mb-0.5">{info.label}</p>
                          <p className="text-2xl font-black text-white leading-none">{info.price}</p>
                          <p className="text-[10px] text-white/30 mb-2">دج</p>
                          <div className="border-t border-white/6 pt-2 space-y-0.5">
                            <p className="text-[11px] text-primary font-bold">{info.doro} دورو</p>
                            <p className="text-[10px] text-white/25">أو ما يعادلها بالأوقية</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="bg-white/4 rounded-2xl p-3.5 space-y-2.5">
                      <p className="text-[11px] text-white/35 font-bold mb-1">ما تحصل عليه:</p>
                      {[
                        "منتجاتك تظهر لجميع المشترين فوراً",
                        "نجمة توثيق على حسابك ✓",
                        "أولوية في المنتجات الرائجة",
                        "إشعارات فورية لمتابعيك عند نشر منتج",
                        "دعم مميّز وأولوية في التوصيل",
                      ].map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs text-white/60">{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setStep("method")}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_22px_rgba(168,85,247,0.35)] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                    >
                      التالي — اختر طريقة الدفع
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 2: طريقة الدفع ── */}
                {step === "method" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                    <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-white/35">الباقة المختارة</span>
                      <span className="text-sm font-black text-white">
                        {planInfo.label} — <span className="text-primary">{planInfo.price} دج</span>
                      </span>
                    </div>

                    {/* بنكيلي */}
                    <button
                      onClick={() => setStep("bankily")}
                      className="w-full p-4 rounded-2xl border border-blue-500/20 bg-blue-500/6 hover:bg-blue-500/12 active:scale-[0.98] transition-all flex items-center gap-4"
                    >
                      <div className="w-13 h-13 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
                        <Smartphone className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-black text-white text-sm">بنكيلي</p>
                        <p className="text-xs text-white/35 mt-0.5">حوّل المبلغ وأرسل صورة الوصل</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </button>

                    {/* كاش */}
                    <button
                      onClick={() => setStep("cash")}
                      className="w-full p-4 rounded-2xl border border-green-500/20 bg-green-500/6 hover:bg-green-500/12 active:scale-[0.98] transition-all flex items-center gap-4"
                    >
                      <div className="rounded-2xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
                        <Banknote className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-black text-white text-sm">دفع نقدي</p>
                        <p className="text-xs text-white/35 mt-0.5">سيتواصل معك فريق الدعم لاستلام المبلغ</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 3أ: بنكيلي ── */}
                {step === "bankily" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

                    {/* رقم الحساب */}
                    <div className="bg-blue-500/6 border border-blue-500/18 rounded-2xl p-4 space-y-3">
                      <p className="text-xs text-white/40 text-center font-medium">حوّل المبلغ إلى رقم بنكيلي التالي</p>

                      <button
                        onClick={copyAccount}
                        className="w-full flex items-center justify-between bg-black/40 border border-white/10 hover:bg-black/60 rounded-2xl px-5 py-4 transition-all active:scale-[0.98]"
                      >
                        <div className={`flex items-center gap-2 text-sm font-bold transition-colors ${copied ? "text-green-400" : "text-white/40"}`}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied ? "تم النسخ!" : "انسخ"}
                        </div>
                        <span dir="ltr" className="text-2xl font-black text-white tracking-widest">22978051</span>
                      </button>

                      <div className="text-center border-t border-white/5 pt-3">
                        <p className="text-xs text-white/35 mb-1">المبلغ المطلوب</p>
                        <p className="text-3xl font-black text-primary leading-none">{planInfo.price}</p>
                        <p className="text-sm text-white/40 mt-0.5">دج</p>
                        <p className="text-[11px] text-white/30 mt-1">
                          ما يعادل <span className="text-white/50 font-bold">{planInfo.doro} دورو</span> أو ما يعادلها بالأوقية
                        </p>
                      </div>
                    </div>

                    {/* رفع الوصل */}
                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">
                        أرفق صورة وصل الدفع <span className="text-red-400">*</span>
                      </p>
                      <p className="text-[11px] text-white/30 mb-3">
                        بعد إتمام التحويل، أرسل لنا صورة وصل الدفع لتأكيد طلبك
                      </p>
                      <input ref={proofRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f, "proof"); }} />
                      {proofPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-blue-500/30">
                          <img src={proofPreview} alt="وصل" className="w-full max-h-44 object-cover" />
                          <button onClick={() => { setProofFile(null); setProofPreview(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => proofRef.current?.click()}
                          className="w-full h-24 rounded-2xl border-2 border-dashed border-blue-500/25 flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/4 transition-all active:scale-[0.98]">
                          <Upload className="w-6 h-6 text-blue-400/50" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة الوصل</span>
                        </button>
                      )}
                    </div>

                    {/* رفع بطاقة الهوية (Bankily) */}
                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">
                        أرفق صورة بطاقة هويتك <span className="text-red-400">*</span>
                      </p>
                      <p className="text-[11px] text-white/30 mb-3">
                        بطاقة التعريف أو جواز السفر — للتحقق من الهوية
                      </p>
                      <input ref={idRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f, "id"); }} />
                      {idPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-blue-500/30">
                          <img src={idPreview} alt="بطاقة" className="w-full max-h-44 object-cover" />
                          <button onClick={() => { setIdFile(null); setIdPreview(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => idRef.current?.click()}
                          className="w-full h-24 rounded-2xl border-2 border-dashed border-blue-500/25 flex flex-col items-center justify-center gap-2 hover:border-blue-500/50 hover:bg-blue-500/4 transition-all active:scale-[0.98]">
                          <Upload className="w-6 h-6 text-blue-400/50" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة بطاقة الهوية</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={submitBankily}
                      disabled={submitting || !proofFile || !idFile}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_22px_rgba(168,85,247,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-45"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      إرسال الطلب للمراجعة
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 3ب: كاش ── */}
                {step === "cash" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">

                    <div className="bg-green-500/6 border border-green-500/18 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                          <Banknote className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">دفع نقدي</p>
                          <p className="text-xs text-white/35">سيتواصل معك فريق الدعم بعد استلام طلبك</p>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-3 text-center">
                        <p className="text-xs text-white/35 mb-0.5">المبلغ المطلوب</p>
                        <p className="text-2xl font-black text-green-400">{planInfo.price} دج</p>
                        <p className="text-[11px] text-white/30 mt-0.5">
                          = <span className="font-bold text-white/50">{planInfo.doro} دورو</span> أو ما يعادلها بالأوقية
                        </p>
                      </div>
                    </div>

                    {/* رقم الهاتف */}
                    <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-white/35">رقمك المسجّل</span>
                      <span dir="ltr" className="text-sm font-bold text-white">{(user as any)?.phone || "—"}</span>
                    </div>

                    {/* رفع وثيقة الهوية */}
                    <div>
                      <p className="text-xs text-white/45 mb-1.5 font-medium">
                        أرفق صورة وثيقتك الرسمية <span className="text-red-400">*</span>
                      </p>
                      <p className="text-[11px] text-white/30 mb-3">
                        بطاقة الهوية أو جواز السفر — تُستخدم فقط للتحقق من هويتك
                      </p>
                      <input ref={idRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f, "id"); }} />
                      {idPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-green-500/30">
                          <img src={idPreview} alt="وثيقة" className="w-full max-h-44 object-cover" />
                          <button onClick={() => { setIdFile(null); setIdPreview(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => idRef.current?.click()}
                          className="w-full h-24 rounded-2xl border-2 border-dashed border-green-500/25 flex flex-col items-center justify-center gap-2 hover:border-green-500/50 hover:bg-green-500/4 transition-all active:scale-[0.98]">
                          <Upload className="w-6 h-6 text-green-400/50" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة الوثيقة</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={submitCash}
                      disabled={submitting || !idFile}
                      className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-black text-sm shadow-[0_0_22px_rgba(22,163,74,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-45"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      إرسال الطلب للإدارة
                    </button>
                  </motion.div>
                )}

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
}
