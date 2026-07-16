import { useState, useRef } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { uploadDriverDocument } from "@/lib/upload-image";
import { motion } from "framer-motion";
import {
  Car, Upload, ChevronLeft, Check, Loader2, Shield,
  CreditCard, FileText, AlertTriangle,
} from "lucide-react";

const BASE = getApiUrl("");

const VEHICLE_TYPES = [
  { id: "car", label: "سيارة" },
  { id: "van", label: "كار / حافلة" },
  { id: "bike", label: "دراجة نارية" },
];

export default function DriverRegisterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [vehicleType, setVehicleType] = useState("car");
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [vehicleDocPreview, setVehicleDocPreview] = useState<string | null>(null);

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [vehicleDocFile, setVehicleDocFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const idRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  async function handleFile(
    file: File,
    setter: (v: string) => void,
    fileSetter: (v: File) => void
  ) {
    try {
      const reader = new FileReader();
      reader.onload = () => setter(reader.result as string);
      reader.readAsDataURL(file);
      fileSetter(file);
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل معاينة الصورة" });
    }
  }

  async function handleSubmit() {
    if (!vehicleType) {
      toast({ variant: "destructive", title: "معلومات ناقصة", description: "الرجاء اختيار نوع المركبة" });
      return;
    }
    if (!idCardFile || !vehicleDocFile) {
      toast({ variant: "destructive", title: "وثائق ناقصة", description: "الرجاء رفع بطاقة الهوية والبطاقة الرمادية" });
      return;
    }

    setSubmitting(true);
    const token = getMemToken();
    try {
      setUploading(true);
      const [idCardUrl, vehicleDocUrl] = await Promise.all([
        uploadDriverDocument(idCardFile, user!.id, "id"),
        uploadDriverDocument(vehicleDocFile, user!.id, "vehicle"),
      ]);
      setUploading(false);

      const res = await fetch(`${BASE}/api/driver/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicleType,
          vehicleModel: "غير محدد",
          vehiclePlate: "غير محدد",
          vehicleColor: "غير محدد",
          licenseImage: idCardUrl, // map National ID to licenseImage for system compliance
          idCardImage: idCardUrl,
          vehicleDocImage: vehicleDocUrl, // map Gray Card to vehicleDocImage
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم تسجيل الطلب!", description: "🎉 تم إرسال وثائقك بنجاح للأدمن للمراجعة. ستبدأ تجربتك المجانية 7 أيام فور موافقة الإدارة." });
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
    <div className="min-h-screen bg-background p-5 md:p-10 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate("/")} className="p-2.5 hover:bg-muted rounded-2xl border border-border/50 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-foreground">التسجيل كسائق شريك</h1>
          <p className="text-xs text-muted-foreground mt-1">سجل الآن بخطوات بسيطة وابدأ بجني الأرباح نقداً</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* الخطوة 1: نوع المركبة */}
        <div className="space-y-3 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">نوع المركبة التي تقودها</h2>
              <p className="text-[11px] text-muted-foreground">اختر المركبة التي ستعمل بها لتلقي طلبات الكورسا المناسبة لك</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            {VEHICLE_TYPES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVehicleType(v.id)}
                className={`p-4 rounded-xl border font-bold text-xs transition-all flex flex-col items-center gap-2 ${
                  vehicleType === v.id
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {v.id === "car" && <span className="text-xl">🚗</span>}
                {v.id === "van" && <span className="text-xl">🚌</span>}
                {v.id === "bike" && <span className="text-xl">🏍️</span>}
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* الخطوة 2: رفع الوثائق */}
        <div className="space-y-4 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">الوثائق المطلوبة</h2>
              <p className="text-[11px] text-muted-foreground">ارفع صوراً واضحة لتأكيد هويتك ومركبتك</p>
            </div>
          </div>

          {/* بطاقة الهوية */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">بطاقة الهوية الوطنية</p>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full font-bold">مطلوبة</span>
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
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={idCardPreview} alt="بطاقة الهوية" className="w-full h-40 object-cover" />
                <button
                  onClick={() => { setIdCardPreview(null); setIdCardFile(null); }}
                  className="absolute top-2 left-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] rounded-full font-bold transition-colors"
                >
                  حذف وإعادة الرفع
                </button>
              </div>
            ) : (
              <button
                onClick={() => idRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-semibold">اضغط لرفع صورة بطاقة الهوية الوطنية</p>
                <p className="text-[10px] text-muted-foreground/60">صورة واضحة للجهتين الأمامية والخلفية</p>
              </button>
            )}
          </div>

          {/* البطاقة الرمادية */}
          <div className="bg-background border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">البطاقة الرمادية (Carte Grise)</p>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full font-bold">مطلوبة</span>
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
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img src={vehicleDocPreview} alt="البطاقة الرمادية" className="w-full h-40 object-cover" />
                <button
                  onClick={() => { setVehicleDocPreview(null); setVehicleDocFile(null); }}
                  className="absolute top-2 left-2 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-[10px] rounded-full font-bold transition-colors"
                >
                  حذف وإعادة الرفع
                </button>
              </div>
            ) : (
              <button
                onClick={() => docRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-semibold">اضغط لرفع صورة البطاقة الرمادية</p>
                <p className="text-[10px] text-muted-foreground/60">تأكيد لملكية المركبة وبياناتها القانونية</p>
              </button>
            )}
          </div>
        </div>

        {/* تنبيه المراجعة */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-yellow-500">نظام المراجعة والموافقة</p>
            <p className="text-[11px] text-yellow-500/80 leading-relaxed">
              بموجب سياسات التطبيق، سيتم مراجعة وثائقك من قبل الإدارة لضمان سلامة وجودة الخدمة. بمجرد تأكيد الأدمن لطلبك، ستبدأ مباشرة فترتك التجريبية المجانية لـ 7 أيام لتلقي الطلبات دون دفع أي عمولة!
            </p>
          </div>
        </div>

        {/* زر التقديم */}
        <button
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className="w-full bg-primary hover:bg-primary/95 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري رفع وثائق السائق...</span>
            </>
          ) : submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري تسجيل الطلب وإرساله...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>إرسال طلب التسجيل للمراجعة</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
