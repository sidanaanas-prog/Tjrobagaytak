import { useState, useRef } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { uploadImageToFirebase } from "@/lib/upload-image";
import { motion } from "framer-motion";
import { Upload, ChevronLeft, Check, Loader2, Store, Shield, FileText, Gift, Clock } from "lucide-react";

const BASE = getApiUrl("");

export default function SellerVerifyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [idDocPreview, setIdDocPreview] = useState<string | null>(null);
  const [idDocFile, setIdDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const idRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setIdDocPreview(reader.result as string);
    reader.readAsDataURL(file);
    setIdDocFile(file);
  }

  async function handleSubmit() {
    if (!idDocFile) {
      toast({ variant: "destructive", title: "وثيقة ناقصة", description: "ارفع صورة بطاقة الهوية للتحقق" });
      return;
    }

    setSubmitting(true);
    const token = getMemToken();
    try {
      setUploading(true);
      const docUrl = await uploadImageToFirebase(idDocFile, `sellers/${user!.id}/id_${Date.now()}.jpg`, 1200, 0.85);
      setUploading(false);

      const res = await fetch(`${BASE}/api/seller/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idDocumentUrl: docUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "✅ تم التسجيل!", description: "🎉 مبروك! تم تفعيل التجربة المجانية لمدة 7 أيام" });
        navigate("/sell");
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل التسجيل" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message || "تعذر الاتصال" });
    }
    setSubmitting(false);
    setUploading(false);
  }

  return (
    <div className="min-h-screen bg-background p-5 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-muted rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">توثيق البائع</h1>
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="mb-6 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm text-white">7 أيام مجانية بعد التوثيق</p>
            <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
              بعد رفع بطاقة الهوية، تم تفعيل تجربتك المجانية تلقائياً. عند انتهائها، يجب عليك الاشتراك للاستمرار.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Document Upload */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold">الوثائق المطلوبة</p>
            <p className="text-xs text-muted-foreground">ارفع صورة واضحة للتحقق</p>
          </div>
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
              if (file) handleFile(file);
            }}
          />
          {idDocPreview ? (
            <div className="relative">
              <img src={idDocPreview} alt="بطاقة الهوية" className="w-full h-40 object-cover rounded-lg" />
              <button
                onClick={() => { setIdDocPreview(null); setIdDocFile(null); }}
                className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => idRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">اضغط لرفع صورة بطاقة الهوية</p>
            </button>
          )}
        </div>

        {/* Trial Info Card */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex items-start gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-400 font-bold">تجربة مجانية 7 أيام</p>
            <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
              بعد التوثيق، ستحصل على شارة بائع موثق وإمكانية نشر منتجاتك. عند انتهاء التجربة، يجب الاشتراك في باقة مدفوعة للاستمرار.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={submitting || uploading || !idDocFile}
        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {uploading ? "جاري رفع الصورة..." : submitting ? "جاري التفعيل..." : "تفعيل التجربة والبدء"}
      </button>
    </div>
  );
}
