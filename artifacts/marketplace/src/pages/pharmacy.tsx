import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useLocation } from "wouter";
import {
  Pill, Calendar, MessageCircle, Upload, Clock, ChevronRight,
  CheckCircle, AlertCircle, Phone, X, Send, ImageIcon, Loader2,
  Star, ShieldCheck, ArrowRight
} from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { uploadStoryImage } from "@/lib/upload-image";

const BASE = getApiUrl("");

type Tab = "prescriptions" | "appointments" | "consultations";
type Exam = { id: string; name: string; description: string | null; price: string; durationMinutes: number };
type Consultation = { id: string; question: string; userName: string; status: string; createdAt: string; replies: { reply: string; staffName: string; createdAt: string }[] };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: "قيد المراجعة", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    reviewing: { label: "جاري المراجعة", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    priced: { label: "تم تحديد السعر", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    confirmed: { label: "مؤكد", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    ready: { label: "جاهز للاستلام", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
    delivered: { label: "تم التسليم", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    cancelled: { label: "ملغى", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    open: { label: "في الانتظار", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    answered: { label: "تم الرد", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  };
  const s = map[status] ?? { label: status, color: "bg-white/10 text-white/50 border-white/10" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>;
}

// ── قسم الوصفة الطبية ──────────────────────────────────────────────────────
function PrescriptionSection() {
  const { user } = useAuth();
  const token = getMemToken();
  const [, navigate] = useLocation();
  const [imageUrl, setImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/pharmacy/my-prescriptions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setMyOrders).catch(() => {}).finally(() => setLoadingOrders(false));
  }, [done]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadStoryImage(file, user!.id);
      setImageUrl(url);
    } catch { setError("تعذر رفع الصورة"); }
    setUploading(false);
  }

  async function handleSubmit() {
    if (!user) { navigate("/login"); return; }
    if (!imageUrl) { setError("يرجى رفع صورة الوصفة"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/pharmacy/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prescriptionUrl: imageUrl, notes, deliveryType, address: deliveryType === "delivery" ? address : null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "حدث خطأ"); return; }
      setDone(true); setImageUrl(""); setNotes(""); setAddress("");
      setTimeout(() => setDone(false), 4000);
    } catch { setError("تعذر الاتصال"); }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* نموذج الإرسال */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
            <Upload className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-white">رفع الوصفة الطبية</h3>
        </div>

        {/* رفع الصورة */}
        <label className="block cursor-pointer">
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          {imageUrl ? (
            <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/10">
              <img src={imageUrl} className="w-full h-full object-cover" alt="وصفة" />
              <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ) : (
            <div className="w-full h-40 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
              {uploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <>
                <ImageIcon className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/50">اضغط لرفع صورة الوصفة</p>
              </>}
            </div>
          )}
        </label>

        {/* نوع الاستلام */}
        <div className="flex gap-2">
          {(["pickup", "delivery"] as const).map((type) => (
            <button key={type} onClick={() => setDeliveryType(type)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${deliveryType === type ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/5 border-white/10 text-white/50"}`}>
              {type === "pickup" ? "🏪 استلام من المؤسسة" : "🚚 توصيل للمنزل"}
            </button>
          ))}
        </div>

        {deliveryType === "delivery" && (
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="أدخل العنوان"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
        )}

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات إضافية (اختياري)" rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none" />

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        {done && <div className="flex items-center gap-2 text-emerald-400 text-sm justify-center"><CheckCircle className="w-4 h-4" /> تم إرسال طلبك بنجاح!</div>}

        <button onClick={handleSubmit} disabled={loading || !imageUrl}
          className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          إرسال الطلب
        </button>
      </div>

      {/* طلباتي */}
      {myOrders.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">طلباتي</h3>
          {myOrders.map((o) => (
            <div key={o.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center gap-3">
              <img src={o.prescriptionUrl} className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0" alt="وصفة" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={o.status} />
                  <span className="text-[10px] text-white/30">{new Date(o.createdAt).toLocaleDateString("ar")}</span>
                </div>
                {o.proposedPrice && <p className="text-sm font-bold text-primary">السعر: {o.proposedPrice} دورو</p>}
                {o.pharmacistNote && <p className="text-xs text-white/50 truncate">{o.pharmacistNote}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── قسم الحجوزات ──────────────────────────────────────────────────────────
function AppointmentsSection() {
  const { user } = useAuth();
  const token = getMemToken();
  const [, navigate] = useLocation();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [patientName, setPatientName] = useState(user?.name ?? "");
  const [patientPhone, setPatientPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [myApps, setMyApps] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${BASE}/api/pharmacy/exams`).then(r => r.ok ? r.json() : []).then(setExams).catch(() => {});
    if (token) fetch(`${BASE}/api/pharmacy/my-appointments`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : []).then(setMyApps).catch(() => {});
  }, [done]);

  async function handleBook() {
    if (!user) { navigate("/login"); return; }
    if (!selected || !date || !time || !patientName || !patientPhone) { setError("يرجى تعبئة جميع الحقول"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/pharmacy/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ examId: selected.id, appointmentDate: date, appointmentTime: time, patientName, patientPhone, notes }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "حدث خطأ"); return; }
      setDone(true); setSelected(null); setDate(""); setTime(""); setNotes("");
      setTimeout(() => setDone(false), 4000);
    } catch { setError("تعذر الاتصال"); }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* اختيار الفحص */}
      {exams.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">اختر نوع الفحص</h3>
          <div className="grid grid-cols-2 gap-2">
            {exams.map((exam) => (
              <button key={exam.id} onClick={() => setSelected(exam)}
                className={`p-4 rounded-2xl border text-right transition-all ${selected?.id === exam.id ? "bg-primary/20 border-primary/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                <p className="text-sm font-bold text-white mb-1">{exam.name}</p>
                {exam.description && <p className="text-xs text-white/40 mb-2 line-clamp-2">{exam.description}</p>}
                <div className="flex items-center justify-between">
                  {Number(exam.price) > 0
                    ? <span className="text-primary font-black text-sm">{exam.price} دج</span>
                    : <span className="text-white/40 text-xs">السعر يحدده الصيدلاني</span>
                  }
                  <span className="text-white/30 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{exam.durationMinutes}د</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center text-white/40 text-sm">
          لا توجد فحوصات متاحة حالياً
        </div>
      )}

      {/* نموذج الحجز */}
      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white/5 border border-primary/20 p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">حجز: {selected.name}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">التاريخ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">الوقت</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50" />
            </div>
          </div>
          <input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="اسم المريض"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
          <input value={patientPhone} onChange={e => setPatientPhone(e.target.value)} placeholder="رقم الهاتف" type="tel"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none" />

          {error && <p className="text-red-400 text-xs">{error}</p>}
          {done && <div className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" /> تم الحجز بنجاح!</div>}

          <button onClick={handleBook} disabled={loading}
            className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            {Number(selected.price) > 0 ? `تأكيد الحجز — ${selected.price} دج` : "تأكيد الحجز"}
          </button>
        </motion.div>
      )}

      {/* حجوزاتي */}
      {myApps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">حجوزاتي</h3>
          {myApps.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold text-white">{a.examName}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-xs text-white/40">{a.appointmentDate} — {a.appointmentTime}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── قسم الاستفسارات ────────────────────────────────────────────────────────
function ConsultationsSection() {
  const { user } = useAuth();
  const token = getMemToken();
  const [, navigate] = useLocation();
  const [question, setQuestion] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  const load = () => {
    fetch(`${BASE}/api/pharmacy/consultations`).then(r => r.ok ? r.json() : []).then(setConsultations).catch(() => {});
  };

  useEffect(() => { load(); }, [done]);

  async function handleAsk() {
    if (!user) { navigate("/login"); return; }
    if (!question.trim()) { setError("يرجى كتابة سؤالك"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/pharmacy/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, isPublic }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "حدث خطأ"); return; }
      setDone(true); setQuestion("");
      setTimeout(() => { setDone(false); load(); }, 2000);
    } catch { setError("تعذر الاتصال"); }
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* تحذير طبي */}
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/80">هذه استشارة عامة وليست تشخيصاً طبياً. للحالات الطارئة راجع الطبيب مباشرة.</p>
      </div>

      {/* نموذج السؤال */}
      <div className="rounded-3xl bg-white/5 border border-white/10 p-5 space-y-3">
        <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="اكتب سؤالك الطبي هنا..." rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none" />
        <div className="flex items-center gap-3">
          <button onClick={() => setIsPublic(!isPublic)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isPublic ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-white/50"}`}>
            {isPublic ? <CheckCircle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {isPublic ? "سؤال عام" : "سؤال خاص"}
          </button>
          <span className="text-xs text-white/30">{isPublic ? "يُعرض للجميع" : "بينك وبين الطبيب فقط"}</span>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        {done && <div className="flex items-center gap-2 text-emerald-400 text-sm"><CheckCircle className="w-4 h-4" /> تم إرسال سؤالك!</div>}
        <button onClick={handleAsk} disabled={loading || !question.trim()}
          className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          إرسال السؤال
        </button>
      </div>

      {/* الأسئلة العامة */}
      {consultations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">أسئلة المجتمع</h3>
          {consultations.map((c) => (
            <div key={c.id} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary">{c.userName}</span>
                    <span className="text-[10px] text-white/30">{new Date(c.createdAt).toLocaleDateString("ar")}</span>
                  </div>
                  <p className="text-sm text-white/80">{c.question}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {c.replies.map((r, i) => (
                <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400">{r.staffName}</span>
                    <span className="text-[10px] text-white/30">{new Date(r.createdAt).toLocaleDateString("ar")}</span>
                  </div>
                  <p className="text-sm text-white/80">{r.reply}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── الصفحة الرئيسية ────────────────────────────────────────────────────────
export default function PharmacyPage() {
  const [tab, setTab] = useState<Tab>("prescriptions");
  const [pharmacy, setPharmacy] = useState<any>(null);

  useEffect(() => {
    fetch(`${BASE}/api/pharmacy`).then(r => r.ok ? r.json() : null).then(setPharmacy).catch(() => {});
  }, []);

  const tabs = [
    { id: "prescriptions" as Tab, label: "وصفة طبية", icon: Pill, color: "text-emerald-400" },
    { id: "appointments" as Tab, label: "حجز فحص", icon: Calendar, color: "text-blue-400" },
    { id: "consultations" as Tab, label: "استفسار", icon: MessageCircle, color: "text-purple-400" },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="px-5 pt-12 pb-4">
            {pharmacy ? (
              <div className="flex items-center gap-3">
                {pharmacy.logo ? (
                  <img src={pharmacy.logo} className="w-12 h-12 rounded-2xl object-cover border border-white/10" alt="logo" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Pill className="w-6 h-6 text-emerald-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-white">{pharmacy.name}</h1>
                  <div className="flex items-center gap-3 mt-0.5">
                    {pharmacy.phone && (
                      <span className="text-xs text-white/40 flex items-center gap-1"><Phone className="w-3 h-3" />{pharmacy.phone}</span>
                    )}
                    {pharmacy.workHours && (
                      <span className="text-xs text-white/40 flex items-center gap-1"><Clock className="w-3 h-3" />{pharmacy.workHours}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Pill className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white">مؤسسة الشفاء</h1>
                  <p className="text-xs text-white/40">خدماتنا الصحية</p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 pb-4">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${tab === t.id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                <t.icon className={`w-3.5 h-3.5 ${tab === t.id ? t.color : ""}`} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5 pb-10">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {tab === "prescriptions" && <PrescriptionSection />}
              {tab === "appointments" && <AppointmentsSection />}
              {tab === "consultations" && <ConsultationsSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
