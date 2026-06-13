import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDriverSubscription } from "@/hooks/use-driver-subscription";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { compressImage } from "@/lib/compress-image";
import { uploadDriverDocument } from "@/lib/upload-image";
import { Crown, Upload, ChevronRight, Loader2, X, Clock, AlertTriangle, RefreshCw, ShieldCheck, Banknote, Copy, Check, Car, Shield, CreditCard, FileText, ChevronLeft } from "lucide-react";

const BASE = getApiUrl("");

const PLAN = {
  label: "1 شهر",
  price: "2,000",
  priceNum: 2000,
  doro: "20,000",
};

const VEHICLE_TYPES = [
  { id: "car", label: "سيارة" },
  { id: "van", label: "فان" },
  { id: "bike", label: "دراجة" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pickFile(file: File, setter: (v: string) => void) {
  compressImage(file, 1200, 0.85)
    .then((b64) => setter(b64))
    .catch(() => setter(""));
}

type Props = { children: React.ReactNode; onOpen?: () => void };

export function DriverSubscriptionGate({ children, onOpen }: Props) {
  const { status, loading, refetch } = useDriverSubscription();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);

  // Profile form state
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [vehicleDocImage, setVehicleDocImage] = useState<string | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);

  // Payment state
  const [step, setStep] = useState<"vehicle" | "documents" | "payment" | "bankily" | "cash">("vehicle");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const licenseRef = useRef<HTMLInputElement>(null);
  const docIdRef = useRef<HTMLInputElement>(null);
  const docVehicleRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setStep("vehicle");
    setVehicleType(""); setVehicleModel(""); setVehiclePlate(""); setVehicleColor("");
    setLicenseImage(null); setIdCardImage(null); setVehicleDocImage(null);
    setLicenseFile(null); setIdCardFile(null); setVehicleDocFile(null);
    setProofFile(null); setProofPreview(null);
    setIdFile(null); setIdPreview(null);
    setSubmitting(false);
    setShowModal(true);
    onOpen?.();
  }
  function closeModal() {
    setShowModal(false);
    setVehicleType(""); setVehicleModel(""); setVehiclePlate(""); setVehicleColor("");
    setLicenseImage(null); setIdCardImage(null); setVehicleDocImage(null);
    setLicenseFile(null); setIdCardFile(null); setVehicleDocFile(null);
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

  // Step 1 → 2
  function goToDocuments() {
    if (!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor) {
      toast({ variant: "destructive", title: "معلومات ناقصة", description: "أكمل معلومات المركبة" });
      return;
    }
    setStep("documents");
  }

  // Step 2 → 3
  function goToPayment() {
    if (!licenseFile || !idCardFile) {
      toast({ variant: "destructive", title: "وثائق ناقصة", description: "ارفع رخصة القيادة وبطاقة الهوية" });
      return;
    }
    setStep("payment");
  }

  async function submitBankily() {
    if (!proofFile) { toast({ variant: "destructive", title: "أرفق صورة وصل الدفع" }); return; }
    if (!idFile) { toast({ variant: "destructive", title: "أرفق صورة بطاقة الهوية" }); return; }
    setSubmitting(true);
    try {
      const token = getMemToken();
      // 1) Upload driver docs
      const [licenseUrl, idCardUrl, vehicleDocUrl] = await Promise.all([
        licenseFile ? uploadDriverDocument(licenseFile, user!.id, "license") : Promise.resolve(null),
        idCardFile ? uploadDriverDocument(idCardFile, user!.id, "id") : Promise.resolve(null),
        vehicleDocFile ? uploadDriverDocument(vehicleDocFile, user!.id, "vehicle") : Promise.resolve(null),
      ]);
      // 2) Save profile
      const profileRes = await fetch(`${BASE}/api/driver/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleType,
          vehicleModel,
          vehiclePlate,
          vehicleColor,
          licenseImage: licenseUrl,
          idCardImage: idCardUrl,
          vehicleDocImage: vehicleDocUrl,
        }),
      });
      const profileData = await profileRes.json();
      if (!profileData.success) throw new Error(profileData.error || "فشل حفظ الملف الشخصي");

      // 3) Submit subscription
      const proofBase64 = await fileToBase64(proofFile);
      const idBase64 = await fileToBase64(idFile);
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: "1month", paymentMethod: "ccp", paymentProofUrl: proofBase64, idDocumentUrl: idBase64, type: "driver" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      toast({ title: "✅ تم إرسال طلبك!", description: "تم حفظ وثائقك وطلب الاشتراك قيد المراجعة" });
      closeModal(); refetch();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setSubmitting(false); }
  }

  async function submitCash() {
    if (!idFile) { toast({ variant: "destructive", title: "أرفق صورة وثيقتك" }); return; }
    setSubmitting(true);
    try {
      const token = getMemToken();
      // 1) Upload driver docs
      const [licenseUrl, idCardUrl, vehicleDocUrl] = await Promise.all([
        licenseFile ? uploadDriverDocument(licenseFile, user!.id, "license") : Promise.resolve(null),
        idCardFile ? uploadDriverDocument(idCardFile, user!.id, "id") : Promise.resolve(null),
        vehicleDocFile ? uploadDriverDocument(vehicleDocFile, user!.id, "vehicle") : Promise.resolve(null),
      ]);
      // 2) Save profile
      const profileRes = await fetch(`${BASE}/api/driver/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleType,
          vehicleModel,
          vehiclePlate,
          vehicleColor,
          licenseImage: licenseUrl,
          idCardImage: idCardUrl,
          vehicleDocImage: vehicleDocUrl,
        }),
      });
      const profileData = await profileRes.json();
      if (!profileData.success) throw new Error(profileData.error || "فشل حفظ الملف الشخصي");

      // 3) Submit subscription
      const idBase64 = await fileToBase64(idFile);
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: "1month", paymentMethod: "cash", idDocumentUrl: idBase64, type: "driver" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      toast({ title: "✅ تم إرسال الطلب!", description: "سيتواصل معك فريق الدعم" });
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

  if (status?.isSubscribed) return <>{children}</>;

  // ── حالة الاشتراك القيد المراجعة ──
  if (status?.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(245,158,11,0.15)]">
            <Clock className="w-12 h-12 text-amber-500" />
          </div>
        </motion.div>
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
          <h2 className="text-2xl font-black text-white">إشتراكك قيد المراجعة</h2>
          <p className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed">
            طلبك ما قدمته قيد المراجعة من قبل الفريق التقني.
            <br />ستتمكن من استقبال الطلبات بمجرد الموافقة.
          </p>
        </motion.div>

        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl px-6 py-4 w-full max-w-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">الباقة</span>
            <span className="text-white font-bold text-sm">الشهرية — 2,000 دج</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-sm">الحالة</span>
            <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              قيد المراجعة
            </span>
          </div>
          {status.latestRequest?.createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-sm">التاريخ</span>
              <span className="text-white/70 text-sm">
                {new Date(status.latestRequest.createdAt).toLocaleDateString("ar-DZ")}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث الحالة
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[78vh] px-6 text-center gap-5" dir="rtl">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-24 h-24 rounded-3xl bg-primary/10 border border-primary/25 flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(168,85,247,0.15)]">
            <Crown className="w-12 h-12 text-primary" />
          </div>
        </motion.div>
        <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-2">
          <h2 className="text-2xl font-black text-white">اشتراك السائق الشهري</h2>
          <p className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed">
            لإتاحة وضع السائق واستقبال طلبات كورسا، يجب الاشتراك الشهري.
          </p>
        </motion.div>

        <div className="bg-primary/8 border border-primary/20 rounded-2xl px-6 py-4 w-full max-w-xs">
          <p className="text-[11px] text-white/40 mb-1">الباقة الشهرية</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-white">{PLAN.price}</span>
            <span className="text-sm text-white/50">دج / شهر</span>
          </div>
          <p className="text-[11px] text-primary mt-1">{PLAN.doro} دورو</p>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={openModal}
          className="w-full max-w-xs h-14 rounded-2xl bg-primary font-black text-white text-base shadow-[0_0_35px_rgba(168,85,247,0.45)] flex items-center justify-center gap-2"
        >
          <Crown className="w-5 h-5" />
          اشترك الآن — 2000 دج/شهر
          <ChevronRight className="w-4 h-4" />
        </motion.button>

        <p className="text-[11px] text-white/25">
          الاشتراك يُجدّد شهرياً — يمكن إلغاؤه في أي وقت
        </p>
      </div>

      {renderModal()}
    </>
  );

  function renderModal() {
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
              <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mt-3 mb-0.5" />

              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                {step !== "vehicle" ? (
                  <button
                    onClick={() => {
                      if (step === "payment") setStep("documents");
                      else if (step === "bankily" || step === "cash") setStep("payment");
                      else setStep("vehicle");
                    }}
                    className="text-xs text-white/40 hover:text-white/70"
                  >
                    ← رجوع
                  </button>
                ) : <div className="w-10" />}
                <h3 className="text-sm font-black text-white">
                  {step === "vehicle" && "معلومات المركبة"}
                  {step === "documents" && "الوثائق المطلوبة"}
                  {step === "payment" && "طريقة الدفع"}
                  {step === "bankily" && "دفع عبر بنكيلي"}
                  {step === "cash" && "دفع نقدي"}
                </h3>
                <button onClick={closeModal} className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              <div className="px-5 py-5 pb-12 max-h-[84vh] overflow-y-auto space-y-4">

                {/* ── الخطوة 1: معلومات المركبة ── */}
                {step === "vehicle" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Car className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">معلومات المركبة</p>
                        <p className="text-xs text-muted-foreground">أكمل معلومات سيارتك</p>
                      </div>
                    </div>

                    {/* نوع المركبة */}
                    <div className="space-y-2">
                      <p className="text-sm font-bold">نوع المركبة</p>
                      <div className="grid grid-cols-3 gap-2">
                        {VEHICLE_TYPES.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setVehicleType(v.id)}
                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                              vehicleType === v.id
                                ? "bg-primary/20 border-primary text-primary"
                                : "border-white/10 bg-card"
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* الموديل */}
                    <div className="space-y-2">
                      <p className="text-sm font-bold">الموديل</p>
                      <input
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        placeholder="مثال: Peugeot 301"
                        className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* اللون */}
                    <div className="space-y-2">
                      <p className="text-sm font-bold">اللون</p>
                      <input
                        value={vehicleColor}
                        onChange={(e) => setVehicleColor(e.target.value)}
                        placeholder="مثال: أبيض"
                        className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* رقم اللوحة */}
                    <div className="space-y-2">
                      <p className="text-sm font-bold">رقم اللوحة</p>
                      <input
                        value={vehiclePlate}
                        onChange={(e) => setVehiclePlate(e.target.value)}
                        placeholder="مثال: 12345-06-16"
                        className="w-full bg-card border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <button
                      onClick={goToDocuments}
                      disabled={!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor}
                      className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      التالي <ChevronLeft className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 2: الوثائق ── */}
                {step === "documents" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">الوثائق المطلوبة</p>
                        <p className="text-xs text-muted-foreground">ارفع صوراً واضحة للوثائق</p>
                      </div>
                    </div>

                    {/* رخصة القيادة */}
                    <div className="bg-card border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        <p className="text-sm font-bold">رخصة القيادة</p>
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">مطلوبة</span>
                      </div>
                      <input
                        ref={licenseRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { pickFile(file, setLicenseImage); setLicenseFile(file); }
                        }}
                      />
                      {licenseImage ? (
                        <div className="relative">
                          <img src={licenseImage} alt="رخصة" className="w-full h-32 object-cover rounded-lg" />
                          <button
                            onClick={() => { setLicenseImage(null); setLicenseFile(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => licenseRef.current?.click()}
                          className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/4 transition-all"
                        >
                          <Upload className="w-6 h-6 text-white/30" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة الرخصة</span>
                        </button>
                      )}
                    </div>

                    {/* بطاقة الهوية */}
                    <div className="bg-card border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <p className="text-sm font-bold">بطاقة الهوية</p>
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">مطلوبة</span>
                      </div>
                      <input
                        ref={docIdRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { pickFile(file, setIdCardImage); setIdCardFile(file); }
                        }}
                      />
                      {idCardImage ? (
                        <div className="relative">
                          <img src={idCardImage} alt="هوية" className="w-full h-32 object-cover rounded-lg" />
                          <button
                            onClick={() => { setIdCardImage(null); setIdCardFile(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => docIdRef.current?.click()}
                          className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/4 transition-all"
                        >
                          <Upload className="w-6 h-6 text-white/30" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة الهوية</span>
                        </button>
                      )}
                    </div>

                    {/* رخصة السير (اختياري) */}
                    <div className="bg-card border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-white/50" />
                        <p className="text-sm font-bold">رخصة السير</p>
                        <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded-full">اختياري</span>
                      </div>
                      <input
                        ref={docVehicleRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { pickFile(file, setVehicleDocImage); setVehicleDocFile(file); }
                        }}
                      />
                      {vehicleDocImage ? (
                        <div className="relative">
                          <img src={vehicleDocImage} alt="رخصة سير" className="w-full h-32 object-cover rounded-lg" />
                          <button
                            onClick={() => { setVehicleDocImage(null); setVehicleDocFile(null); }}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                          >
                            <X className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => docVehicleRef.current?.click()}
                          className="w-full h-24 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/4 transition-all"
                        >
                          <Upload className="w-6 h-6 text-white/30" />
                          <span className="text-xs text-white/30">اضغط لرفع صورة رخصة السير</span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={goToPayment}
                      disabled={!licenseFile || !idCardFile}
                      className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      التالي <ChevronLeft className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 3: اختيار طريقة الدفع ── */}
                {step === "payment" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="bg-primary/8 rounded-2xl p-4 text-center border border-primary/20">
                      <p className="text-[11px] text-white/40 mb-1">الباقة الشهرية</p>
                      <p className="text-3xl font-black text-white">{PLAN.price} <span className="text-base text-white/50">دج</span></p>
                      <p className="text-[11px] text-primary mt-1">{PLAN.doro} دورو</p>
                    </div>

                    <p className="text-xs text-white/45 mb-2 font-bold">اختر طريقة الدفع:</p>

                    <button onClick={() => setStep("bankily")}
                      className="w-full p-4 rounded-2xl border border-blue-500/25 bg-blue-500/8 text-right flex items-center gap-3 hover:bg-blue-500/12 transition-all active:scale-[0.98]">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">بنكيلي / CCP</p>
                        <p className="text-[11px] text-white/40">تحويل بنكي — وصل الدفع مطلوب</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    </button>

                    <button onClick={() => setStep("cash")}
                      className="w-full p-4 rounded-2xl border border-green-500/25 bg-green-500/8 text-right flex items-center gap-3 hover:bg-green-500/12 transition-all active:scale-[0.98]">
                      <div className="w-11 h-11 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                        <Banknote className="w-5 h-5 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">دفع نقدي</p>
                        <p className="text-[11px] text-white/40">سيتواصل معك فريق الدعم</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 4: بنكيلي ── */}
                {step === "bankily" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="bg-blue-500/6 border border-blue-500/18 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">بنكيلي / CCP</p>
                          <p className="text-xs text-white/35">أرسل المبلغ إلى الحساب التالي</p>
                        </div>
                      </div>
                      <button onClick={copyAccount}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-2 active:scale-[0.98]">
                        <div className="flex items-center gap-2">
                          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                          <span className="text-xs text-white/50">{copied ? "تم النسخ!" : "اضغط للنسخ"}</span>
                        </div>
                        <span dir="ltr" className="text-2xl font-black text-white tracking-widest">22978051</span>
                      </button>
                      <div className="text-center border-t border-white/5 pt-3">
                        <p className="text-xs text-white/35 mb-1">المبلغ المطلوب</p>
                        <p className="text-3xl font-black text-primary leading-none">{PLAN.price}</p>
                        <p className="text-sm text-white/40 mt-0.5">دج</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">أرفق صورة وصل الدفع <span className="text-red-400">*</span></p>
                      <input ref={proofRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setProofFile(f); pickFile(f, setProofPreview); } }} />
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

                    <div>
                      <p className="text-xs text-white/45 mb-2 font-medium">أرفق صورة بطاقة الهوية <span className="text-red-400">*</span></p>
                      <input ref={idRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIdFile(f); pickFile(f, setIdPreview); } }} />
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

                    <button onClick={submitBankily} disabled={submitting || !proofFile || !idFile}
                      className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm shadow-[0_0_22px_rgba(168,85,247,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-45">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      إرسال الطلب للمراجعة
                    </button>
                  </motion.div>
                )}

                {/* ── الخطوة 5: كاش ── */}
                {step === "cash" && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                    <div className="bg-green-500/6 border border-green-500/18 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/20 flex items-center justify-center shrink-0">
                          <Banknote className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">دفع نقدي</p>
                          <p className="text-xs text-white/35">سيتواصل معك فريق الدعم</p>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-3 text-center">
                        <p className="text-xs text-white/35 mb-0.5">المبلغ المطلوب</p>
                        <p className="text-2xl font-black text-green-400">{PLAN.price} دج</p>
                      </div>
                    </div>

                    <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <span className="text-xs text-white/35">رقمك المسجّل</span>
                      <span dir="ltr" className="text-sm font-bold text-white">{(user as any)?.phone || "—"}</span>
                    </div>

                    <div>
                      <p className="text-xs text-white/45 mb-1.5 font-medium">أرفق صورة وثيقتك الرسمية <span className="text-red-400">*</span></p>
                      <input ref={idRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIdFile(f); pickFile(f, setIdPreview); } }} />
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

                    <button onClick={submitCash} disabled={submitting || !idFile}
                      className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-black text-sm shadow-[0_0_22px_rgba(22,163,74,0.3)] active:scale-[0.97] transition-all flex items-center justify-center gap-2 disabled:opacity-45">
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
