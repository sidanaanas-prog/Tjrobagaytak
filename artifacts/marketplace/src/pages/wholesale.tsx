import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getApiUrl } from "@/lib/api-url";
import { Redirect, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Baby, CarFront, Cpu, Gem, Shirt, ShoppingBag, Wrench } from "lucide-react";

const BASE = getApiUrl("");

const categories = [
  { title: "ملابس نساء", description: "أزياء وملابس نسائية بالجملة", icon: Shirt, color: "from-pink-500/25 to-rose-500/5 border-pink-500/25" },
  { title: "ملابس أطفال", description: "ملابس ومستلزمات الأطفال", icon: Baby, color: "from-blue-500/25 to-cyan-500/5 border-blue-500/25" },
  { title: "نعال وأحذية", description: "أحذية ونعال للبيع بالكرتون", icon: ShoppingBag, color: "from-amber-500/25 to-orange-500/5 border-amber-500/25" },
  { title: "إلكترونيات", description: "إكسسوارات وأجهزة إلكترونية", icon: Cpu, color: "from-violet-500/25 to-indigo-500/5 border-violet-500/25" },
  { title: "قطع غيار", description: "قطع غيار ومستلزمات متنوعة", icon: Wrench, color: "from-emerald-500/25 to-teal-500/5 border-emerald-500/25" },
  { title: "إكسسوارات سيارات", description: "إكسسوارات وتجهيزات السيارات", icon: CarFront, color: "from-red-500/25 to-orange-500/5 border-red-500/25" },
];

export default function WholesalePage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => setEnabled(flags?.wholesaleEnabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-white/50">جاري التحميل...</div>;
  }
  if (!enabled) return <Redirect to="/" />;

  return (
    <AppLayout>
      <div className="min-h-full bg-background pb-6" dir="rtl">
        <header className="px-5 pt-12 pb-5 border-b border-white/5">
          <Link href="/">
            <button className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 mb-5">
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">سوق الجملة</h1>
              <p className="text-sm text-white/45 mt-1">منتجات بالجملة للتجار وأصحاب المحلات</p>
            </div>
          </div>
        </header>

        <section className="px-5 pt-5">
          <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-4">
            <div className="flex items-center gap-2 text-amber-300">
              <Gem className="w-4 h-4" />
              <h2 className="font-bold">بيع بالكرتون وبأسعار التجار</h2>
            </div>
            <p className="text-xs text-white/50 mt-2 leading-5">
              اختر التصنيف الذي تبحث عنه. سيتم نشر المنتجات والأسعار والكميات المتوفرة هنا تدريجياً.
            </p>
          </div>
        </section>

        <section className="px-5 pt-6">
          <h2 className="text-sm font-black text-white mb-3">التصنيفات</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`rounded-2xl border bg-gradient-to-br ${category.color} p-4 min-h-[142px]`}
                >
                  <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-white/80" />
                  </div>
                  <h3 className="text-sm font-black text-white">{category.title}</h3>
                  <p className="text-[11px] text-white/45 leading-4 mt-1">{category.description}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="px-5 pt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <ShoppingBag className="w-8 h-8 text-white/25 mx-auto" />
            <h2 className="text-sm font-bold text-white/75 mt-3">المنتجات ستظهر هنا</h2>
            <p className="text-xs text-white/35 mt-1">أضف منتجات الجملة من لوحة التحكم عند جاهزيتك.</p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}