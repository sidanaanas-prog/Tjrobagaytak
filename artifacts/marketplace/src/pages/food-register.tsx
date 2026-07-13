import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Home, CheckCircle2, AlertTriangle } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { getMemToken, useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const BASE = getApiUrl("");

const CATEGORIES = ["برجر", "بيتزا", "مشاوي", "سوشي", "وجبات صحية", "حلويات", "مشروبات", "عام"];

export default function FoodRegisterPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "عام",
    address: "",
    phone: "",
    deliveryFee: "5",
    minOrder: "0",
    estimatedDeliveryMinutes: "30",
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center" dir="rtl">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <AlertTriangle className="w-20 h-20 text-amber-500" />
        </motion.div>
        <div>
          <h2 className="text-2xl font-black text-white">قسم خاص بالإدارة 🏠</h2>
          <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">
            عذراً، هذا القسم مخصص لإدارة المنصة فقط لإضافة منازل المناسبات وعرضها للحجز. لا يمكن للمستخدمين نشر عروضهم هنا.
          </p>
        </div>
        <button
          onClick={() => navigate("/food")}
          className="px-6 py-3 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)]"
        >
          العودة لمنزل المناسبات
        </button>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.name || !form.address) { toast({ title: "الاسم والعنوان مطلوبان", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/restaurants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, deliveryFee: form.deliveryFee, minOrder: form.minOrder, estimatedDeliveryMinutes: Number(form.estimatedDeliveryMinutes) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setDone(true);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <CheckCircle2 className="w-20 h-20 text-green-400" />
        </motion.div>
        <h2 className="text-2xl font-black text-white">تم إرسال الطلب! 🎉</h2>
        <p className="text-white/50 text-sm">سيتم مراجعة طلبك وإشعارك بالموافقة قريباً</p>
        <button onClick={() => navigate("/food")} className="px-6 py-3 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)]">
          العودة للمطاعم
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/food")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-black text-white">سجّل مطعمك 🍽️</h1>
        </div>
      </div>

      <div className="px-5 py-6 pb-24 max-w-lg mx-auto space-y-4">
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-3">
            <ChefHat className="w-10 h-10 text-primary" />
          </div>
          <p className="text-white/50 text-sm text-center">أدخل معلومات مطعمك وسيتم مراجعتها خلال 24 ساعة</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/40 mb-1 block">اسم المطعم *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="مثال: برجر الشيف"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">وصف مختصر</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="ماذا تقدم؟"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none" />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-2 block">الفئة *</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => set("category", cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    form.category === cat ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/50"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">العنوان *</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)}
              placeholder="اسم الحي والشارع"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1 block">رقم الجوال</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
              placeholder="+966..."
              type="tel"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/40 mb-1 block">رسوم التوصيل</label>
              <input value={form.deliveryFee} onChange={(e) => set("deliveryFee", e.target.value)}
                type="number" min="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">حد أدنى</label>
              <input value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)}
                type="number" min="0"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">وقت التوصيل</label>
              <input value={form.estimatedDeliveryMinutes} onChange={(e) => set("estimatedDeliveryMinutes", e.target.value)}
                type="number" min="5"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-primary/50" />
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.5)] disabled:opacity-50 mt-4"
        >
          {loading ? "جاري الإرسال..." : "إرسال الطلب للمراجعة"}
        </motion.button>
      </div>
    </div>
  );
}
