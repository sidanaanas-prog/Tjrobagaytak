import { useState, useRef } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { uploadDriverDocument } from "@/lib/upload-image";
import { motion } from "framer-motion";
import {
  Car, Upload, ChevronLeft, Check, Loader2, Shield,
  CreditCard, FileText, Camera, AlertTriangle,
} from "lucide-react";

const BASE = getApiUrl("");

const VEHICLE_TYPES = [
  { id: "car", label: "سيارة" },
  { id: "van", label: "فان" },
  { id: "bike", label: "دراجة" },
];

export default function DriverRegisterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [vehicleDocPreview, setVehicleDocPreview] = useState<string | null>(null);

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const licenseRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  async function handleFile(
    file: File,
    setter: (v: string) => void,
    fileSetter: (v: File) => void
  ) {
    try {
      // Create preview from original file
      const reader = new FileReader();
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(file);
      fileSetter(file);
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل معاينة الصورة" });
    }
  }

  async function handleSubmit() {
    if (!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor) {
      toast({ variant: "destructive", title: "معلومات ناقصة", description: "أكمل معلومات المركبة" });
      return;
    }
    if (!licenseFile || !idCardFile) {
      toast({ variant: "destructive", title: "وثائق ناقصة", description: "ارفع رخصة القيادة وبطاقة الهوية" });
      return;
    }

    setSubmitting(true);
    const token = getMemToken();
    try {
      // 1) Upload images to server
      setUploading(true);
      const [licenseUrl, idCardUrl, vehicleDocUrl] = await Promise.all([
        uploadDriverDocument(licenseFile, user!.id, "license"),
        uploadDriverDocument(idCardFile, user!.id, "id"),
        vehicleDocFile ? uploadDriverDocument(vehicleDocFile, user!.id, "vehicle") : Promise.resolve(null),
      ]);
      setUploading(false);

      // 2) Submit profile with URLs
      const res = await fetch(`${BASE}/api/driver/profile`, {
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
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم التسجيل!", description: "وثائقك قيد المراجعة. سيتم تفعيل حسابك بعد التحقق." });
        navigate("/rides");
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل التسجيل" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message || "تعذر الاتصال بالخادم" });
    }
    setSubmitting(false);
    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-background p-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">تسجيل كسائق</h1>
      </div>

      {/* خطوات التسجيل */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-2 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* الخطوة 1: معلومات المركبة */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">معلومات المركبة</p>
              <p className="text-xs text-muted-foreground">أدخل تفاصيل مركبتك</p>
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
            onClick={() => setStep(2)}
            disabled={!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor}
            className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            التالي <ChevronLeft className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* الخطوة 2: الوثائق */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">الوثائق المطلوبة</p>
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
                if (file) handleFile(file, setLicensePreview, setLicenseFile);
              }}
            />
            {licensePreview ? (
              <div className="relative">
                <img src={licensePreview} alt="رخصة" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => { setLicensePreview(null); setLicenseFile(null); }}
                  className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => licenseRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">اضغط لرفع صورة رخصة القيادة</p>
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
              ref={idRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, setIdCardPreview, setIdCardFile);
              }}
            />
            {idCardPreview ? (
              <div className="relative">
                <img src={idCardPreview} alt="هوية" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => { setIdCardPreview(null); setIdCardFile(null); }}
                  className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => idRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">اضغط لرفع صورة بطاقة الهوية</p>
              </button>
            )}
          </div>

          {/* رخصة السير (اختيارية) */}
          <div className="bg-card border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-sm font-bold">رخصة السير</p>
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">اختياري</span>
            </div>
            <input
              ref={docRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file, setVehicleDocPreview, setVehicleDocFile);
              }}
            />
            {vehicleDocPreview ? (
              <div className="relative">
                <img src={vehicleDocPreview} alt="رخصة سير" className="w-full h-32 object-cover rounded-lg" />
                <button
                  onClick={() => { setVehicleDocPreview(null); setVehicleDocFile(null); }}
                  className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => docRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">اضغط لرفع صورة رخصة السير</p>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-3.5 rounded-xl border font-bold text-sm">
              رجوع
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!licenseFile || !idCardFile}
              className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              التالي <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* الخطوة 3: المراجعة والتأكيد */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold">مراجعة التسجيل</p>
              <p className="text-xs text-muted-foreground">تأكد من المعلومات قبل الإرسال</p>
            </div>
          </div>

          {/* ملخص */}
          <div className="bg-card border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">نوع المركبة</span>
              <span className="font-bold">{VEHICLE_TYPES.find((v) => v.id === vehicleType)?.label}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الموديل</span>
              <span className="font-bold">{vehicleModel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">اللون</span>
              <span className="font-bold">{vehicleColor}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">رقم اللوحة</span>
              <span className="font-bold">{vehiclePlate}</span>
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-400" />
                <span>رخصة القيادة: مرفقة</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <Check className="w-4 h-4 text-green-400" />
                <span>بطاقة الهوية: مرفقة</span>
              </div>
              {vehicleDocFile && (
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Check className="w-4 h-4 text-green-400" />
                  <span>رخصة السير: مرفقة</span>
                </div>
              )}
            </div>
          </div>

          {/* تنبيه */}
          <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400 leading-relaxed">
              سيتم مراجعة وثائقك من قبل الإدارة. قد يستغرق التحقق من ساعة إلى 24 ساعة. سيتم إخطارك عند الموافقة.
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl border font-bold text-sm">
              رجوع
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="flex-1 bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {uploading ? "جاري رفع الصور..." : submitting ? "جاري الإرسال..." : "إرسال التسجيل"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
