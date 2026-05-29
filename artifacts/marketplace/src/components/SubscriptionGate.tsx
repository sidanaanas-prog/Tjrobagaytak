import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Crown, Star, TrendingUp, Users, ShieldCheck, Copy, Check,
  Upload, ChevronRight, Loader2, X, Clock, BadgeCheck,
  Eye, Bell, Search, Sparkles, ArrowRight, Zap,
} from "lucide-react";

const BASE = getApiUrl("");

const PLANS = {
  "6months": {
    label: "6 أشهر",
    price: "5,000",
    priceNum: 5000,
    monthly: "833",
    doro: "100,000",
    months: 6,
    badge: null,
    perks: "كل مزايا التوثيق",
  },
  "12months": {
    label: "12 شهر",
    price: "10,000",
    priceNum: 10000,
    monthly: "833",
    doro: "مليون",
    months: 12,
    badge: "الأفضل",
    perks: "+ أولوية كاملة",
  },
} as const;

type Plan = keyof typeof PLANS;
type Step = "plan" | "method" | "ccp" | "cash";

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
  const [plan, setPlan] = useState<Plan>("12months");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  function openModal() { setStep("plan"); setShowModal(true); }
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

  async function submitCcp() {
    if (!proofFile) { toast({ variant: "destructive", title: "أرفق صورة وصل الدفع" }); return; }
    setSubmitting(true);
    try {
      const proofBase64 = await fileToBase64(proofFile);
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getMemToken()}` },
        body: JSON.stringify({ plan, paymentMethod: "ccp", paymentProofUrl: proofBase64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      toast({ title: "تم إرسال طلبك! ✅", description: "سيتم مراجعته خلال 24 ساعة" });
      closeModal(); refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setSubmitting(false); }
  }

  async function submitCash() {
    if (!idFile) { toast({ variant: "destructive", title: "أرفق صورة وثيقتك الرسمية" }); return; }
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
      toast({ title: "تم إرسال طلبك للإدارة! ✅", description: "سيتواصل معك فريق الدعم قريباً" });
      closeModal(); refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (status?.isActive) return <>{children}</>;

  /* ── طلب قيد المراجعة ── */
  if (status?.latestRequest?.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] px-6 text-center gap-5">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 rounded-3xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(234,179,8,0.15)]">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">طلبك قيد المراجعة</h2>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            طلب اشتراكك وصلنا وهو قيد المراجعة من الفريق.<br />
            ستتلقى إشعاراً فور الموافقة.
          </p>
        </div>
        <div className="bg-yellow-500/8 border border-yellow-500/20 rounded-2xl px-5 py-3">
          <p className="text-xs text-yellow-400/70">⏱ وقت المراجعة المعتاد: 24–48 ساعة</p>
        </div>
      </div>
    );
  }

  const planInfo = PLANS[plan];
  const typeLabel = type === "product" ? "المنتجات" : "الفيديوهات";

  /* ── شاشة البوابة الرئيسية ── */
  return (
    <>
      <div className="flex flex-col min-h-[85vh] px-5 pb-10 overflow-y-auto" dir="rtl">

        {/* ── Hero ── */}
        <div className="pt-10 pb-6 text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 14 }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/30 to-purple-900/40 border border-primary/40 flex items-center justify-center mx-auto mb-5 shadow-[0_0_50px_rgba(168,85,247,0.3)]"
          >
            <Crown className="w-12 h-12 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 }}
            className="text-2xl font-black text-white mb-2"
          >
            متجرك يستحق أن يُرى
          </motion.h1>
          <motion.p
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.13 }}
            className="text-sm text-white/50 max-w-xs mx-auto leading-relaxed"
          >
            وثّق متجرك على Gaytak وابدأ نشر {typeLabel} — اشتراك واحد يفتح كل الأبواب
          </motion.p>
        </div>

        {/* ── مقارنة بدون vs مع ── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.16 }}
          className="grid grid-cols-2 gap-3 mb-5"
        >
          {/* بدون اشتراك */}
          <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-3.5 space-y-2">
            <p className="text-[11px] text-red-400/70 font-bold text-center">بدون اشتراك</p>
            {[
              "منتجاتك مخفية عن الجميع",
              "لا توثيق = لا ثقة",
              "آخر نتائج البحث",
              "لا إشعارات للمتابعين",
            ].map((t) => (
              <div key={t} className="flex items-start gap-1.5">
                <X className="w-3 h-3 text-red-400/60 mt-0.5 shrink-0" />
                <span className="text-[11px] text-white/35 leading-snug">{t}</span>
              </div>
            ))}
          </div>

          {/* مع اشتراك */}
          <div className="bg-primary/8 border border-primary/25 rounded-2xl p-3.5 space-y-2 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
            <p className="text-[11px] text-primary font-bold text-center flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> مع Gaytak
            </p>
            {[
              "تظهر لجميع المشترين",
              "نجمة توثيق على حسابك ✓",
              "أول نتائج البحث دائماً",
              "متابعوك يُعلَمون فوراً",
            ].map((t) => (
              <div key={t} className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                <span className="text-[11px] text-white/70 leading-snug">{t}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── مزايا تفصيلية ── */}
        <motion.div
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="space-y-2.5 mb-6"
        >
          {[
            {
              icon: BadgeCheck, color: "text-primary", bg: "bg-primary/10 border-primary/20",
              title: "نجمة متجر موثّق ✓",
              desc: "يثق المشترون في المتاجر الموثّقة أكثر بكثير — مبيعاتك ترتفع فور التوثيق",
            },
            {
              icon: Eye, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20",
              title: "ظهور مميّز في الرئيسية",
              desc: "منتجاتك في المقدمة قبل آلاف المنتجات الأخرى غير الموثّقة",
            },
            {
              icon: Bell, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20",
              title: "إشعارات فورية للمتابعين",
              desc: "كل متابع يتلقى إشعاراً فور نشرك — لا تفوّت أي عميل محتمل",
            },
            {
              icon: TrendingUp, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20",
              title: "أولوية في قسم الأكثر رواجاً",
              desc: "احتل مكانك في أبرز قسم على التطبيق وزد وصولك بشكل كبير",
            },
            {
              icon: Zap, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20",
              title: "دعم مميّز وسريع",
              desc: "المشتركون الموثّقون لهم أولوية في الدعم والتوصيل والتفعيل",
            },
          ].map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className={`flex items-start gap-3 p-3.5 rounded-2xl border ${bg}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} style={{ width: "18px", height: "18px" }} />
              </div>
              <div className="flex-1 text-right">
                <p className={`text-sm font-bold ${color}`}>{title}</p>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── نبذة عن السعر ── */}
        <motion.div
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-gradient-to-b from-primary/10 to-transparent border border-primary/20 rounded-2xl p-4 mb-5 text-center"
        >
          <p className="text-xs text-white/40 mb-1">يبدأ من</p>
          <p className="text-3xl font-black text-white">5,000 <span className="text-lg text-white/50">دج</span></p>
          <p className="text-xs text-primary mt-1">= 100,000 دورو أو ما يعادلها بالأوقية</p>
          <p className="text-[10px] text-white/30 mt-2">خطة 6 أشهر • لا تجديد تلقائي</p>
        </motion.div>

        {/* ── زر الاشتراك ── */}
        <motion.button
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
          onClick={openModal}
          className="w-full h-14 rounded-2xl bg-primary font-black text-white text-base shadow-[0_0_30px_rgba(168,85,247,0.45)] hover:shadow-[0_0_45px_rgba(168,85,247,0.65)] active:scale-[0.97] transition-all flex items-center justify-center gap-2.5"
        >
          <Crown className="w-5 h-5" />
          اشترك الآن — ابدأ النشر فوراً
          <ArrowRight className="w-4 h-4" />
        </motion.button>

        <p className="mt-3 text-center text-xs text-white/25">
          الحالات مجانية دائماً ✓ — الاشتراك للنشر التجاري فقط
        </p>
      </div>

      {/* ──────────── المودال ──────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              key="sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-full max-w-lg bg-[#0d0d14] border-t border-white/10 rounded-t-3xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-3 mb-1" />

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
                <h3 className="text-sm font-bold text-white">
                  {step === "plan" && "اختر خطتك"}
                  {step === "method" && "طريقة الدفع"}
                  {step === "ccp" && "دفع عبر CCP"}
                  {step === "cash" && "دفع نقدي"}
                </h3>
                {step !== "plan" ? (
                  <button onClick={() => setStep(step === "ccp" || step === "cash" ? "method" : "plan")}
                    className="text-xs text-white/40 hover:text-white/60">رجوع</button>
                ) : <div className="w-8" />}
              </div>

              <div className="px-5 py-5 pb-10 max-h-[82vh] overflow-y-auto space-y-4">

                {/* ── الخطوة 1: الخطة ── */}
                {step === "plan" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => setPlan(key)}
                          className={`relative p-4 rounded-2xl border text-right transition-all ${
                            plan === key
                              ? "border-primary bg-primary/15 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                              : "border-white/10 bg-white/4 hover:bg-white/8"
                          }`}
                        >
                          {info.badge && (
                            <span className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                              {info.badge}
                            </span>
                          )}
                          <p className="text-[11px] text-white/40 mb-0.5">{info.label}</p>
                          <p className="text-2xl font-black text-white leading-none">{info.price}</p>
                          <p className="text-[10px] text-white/30 mb-2">دج</p>
                          <div className="border-t border-white/5 pt-2 space-y-0.5">
                            <p className="text-[11px] text-primary font-bold">{info.doro} دورو</p>
                            <p className="text-[10px] text-white/25">أو ما يعادلها بالأوقية</p>
                          </div>
                          <div className="mt-2">
                            <p className="text-[10px] text-white/40">{info.perks}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="bg-white/4 rounded-2xl p-3.5 space-y-2">
                      {["منتجاتك تظهر للجميع فوراً", "نجمة توثيق على حسابك", "أولوية في نتائج البحث", "إشعارات فورية للمتابعين", "دعم مميّز وأولوية التوصيل"].map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs text-white/65">{f}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setStep("method")}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_20px_rgba(168,85,247,0.35)] active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                    >
                      التالي — اختر طريقة الدفع
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 2: طريقة الدفع ── */}
                {step === "method" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <div className="bg-white/4 rounded-xl px-4 py-2.5 text-center">
                      <p className="text-xs text-white/40">
                        الخطة: <span className="text-primary font-bold">{PLANS[plan].label}</span>
                        {" · "}
                        <span className="text-white font-bold">{PLANS[plan].price} دج</span>
                      </p>
                    </div>

                    <button
                      onClick={() => setStep("ccp")}
                      className="w-full p-4 rounded-2xl border border-blue-500/25 bg-blue-500/8 hover:bg-blue-500/15 active:scale-[0.98] transition-all text-right flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 text-2xl">🏦</div>
                      <div className="flex-1">
                        <p className="font-black text-white text-sm">تحويل بنكي — CCP</p>
                        <p className="text-xs text-white/35 mt-0.5">حوّل المبلغ وأرسل صورة الوصل</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/25" />
                    </button>

                    <button
                      onClick={() => setStep("cash")}
                      className="w-full p-4 rounded-2xl border border-green-500/25 bg-green-500/8 hover:bg-green-500/15 active:scale-[0.98] transition-all text-right flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0 text-2xl">💵</div>
                      <div className="flex-1">
                        <p className="font-black text-white text-sm">دفع نقدي</p>
                        <p className="text-xs text-white/35 mt-0.5">سيتواصل معك فريق الدعم لاستلام المبلغ</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/25" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 3أ: CCP ── */}
                {step === "ccp" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-4 space-y-4">
                      <p className="text-xs text-white/45 text-center font-medium">حوّل المبلغ إلى الحساب التالي</p>

                      <button
                        onClick={copyAccount}
                        className="w-full flex items-center justify-between bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl px-4 py-3.5 transition-all active:scale-[0.98]"
                      >
                        <div className={`flex items-center gap-2 text-sm font-bold transition-colors ${copied ? "text-green-400" : "text-white/50"}`}>
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copied ? "تم النسخ!" : "انسخ"}</span>
                        </div>
                        <span dir="ltr" className="text-2xl font-black text-white tracking-widest">22978051</span>
                      </button>

                      <div className="text-center">
                        <p className="text-xs text-white/40">المبلغ المطلوب</p>
                        <p className="text-3xl font-black text-primary mt-1">{PLANS[plan].price} <span className="text-lg text-white/50">دج</span></p>
                        <p className="text-xs text-white/35 mt-1">
                          ما يعادل <span className="text-white/60 font-bold">{PLANS[plan].doro} دورو</span> أو ما يعادلها بالأوقية
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">أرسل صورة وصل الدفع <span className="text-red-400">*</span></p>
                      <input ref={proofRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f, "proof"); }} />
                      {proofPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border border-primary/30">
                          <img src={proofPreview} alt="وصل" className="w-full max-h-44 object-cover" />
                          <button onClick={() => { setProofFile(null); setProofPreview(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center">
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => proofRef.current?.click()}
                          className="w-full h-24 rounded-2xl border-2 border-dashed border-primary/25 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/4 transition-all">
                          <Upload className="w-6 h-6 text-primary/50" />
                          <span className="text-xs text-white/35">اضغط لرفع صورة الوصل</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={submitCcp}
                      disabled={submitting || !proofFile}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      إرسال الطلب للمراجعة
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 3ب: نقدي ── */}
                {step === "cash" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="bg-green-500/8 border border-green-500/20 rounded-2xl p-4 text-center space-y-2">
                      <p className="text-2xl">💵</p>
                      <p className="text-sm font-black text-white">دفع نقدي</p>
                      <p className="text-xs text-white/45 leading-relaxed">
                        أرسل طلبك، سيتواصل معك فريق الدعم لتحديد موعد واستلام المبلغ
                      </p>
                      <p className="text-2xl font-black text-green-400 mt-1">{PLANS[plan].price} دج</p>
                      <p className="text-xs text-white/35">
                        = <span className="font-bold text-white/55">{PLANS[plan].doro} دورو</span> أو ما يعادلها بالأوقية
                      </p>
                    </div>

                    <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-white/35">رقمك المسجّل</span>
                      <span dir="ltr" className="text-sm font-bold text-white">{(user as any)?.phone || "—"}</span>
                    </div>

                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">أرفق صورة وثيقتك الرسمية <span className="text-red-400">*</span></p>
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
                          className="w-full h-24 rounded-2xl border-2 border-dashed border-green-500/25 flex flex-col items-center justify-center gap-2 hover:border-green-500/50 hover:bg-green-500/4 transition-all">
                          <Upload className="w-6 h-6 text-green-400/50" />
                          <span className="text-xs text-white/35">اضغط لرفع صورة الوثيقة</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={submitCash}
                      disabled={submitting || !idFile}
                      className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-black text-sm shadow-[0_0_20px_rgba(22,163,74,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
    </>
  );
}
