import { useGetFeaturedProducts, useListCategories, getListCategoriesQueryKey, getGetFeaturedProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { AppLayout } from "@/components/AppLayout";
import { StoriesBar } from "@/components/Stories";
import { HeroSlider } from "@/components/HeroSlider";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, Flame, ChevronRight, Sparkles, Trophy, Pill, Calendar, MessageCircle, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getCachedData } from "@/hooks/use-cached-query";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStreak } from "@/hooks/use-streak";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

function FlashCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="font-mono font-bold tabular-nums">{remaining}</span>;
}

const CAT_COLORS = [
  "from-violet-500/30 to-violet-500/5 border-violet-500/30",
  "from-pink-500/30 to-pink-500/5 border-pink-500/30",
  "from-cyan-500/30 to-cyan-500/5 border-cyan-500/30",
  "from-yellow-500/30 to-yellow-500/5 border-yellow-500/30",
  "from-emerald-500/30 to-emerald-500/5 border-emerald-500/30",
  "from-orange-500/30 to-orange-500/5 border-orange-500/30",
  "from-red-500/30 to-red-500/5 border-red-500/30",
  "from-blue-500/30 to-blue-500/5 border-blue-500/30",
  "from-lime-500/30 to-lime-500/5 border-lime-500/30",
  "from-teal-500/30 to-teal-500/5 border-teal-500/30",
];

const ROTATE_INTERVAL = 30_000;
const PAGE_SIZE = 4;

function PharmacyStrip() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => {
        if (flags && typeof flags.pharmacyEnabled === "boolean") {
          setEnabled(flags.pharmacyEnabled);
        }
      })
      .catch(() => {});
  }, []);

  if (!enabled) return null;

  const services = [
    { icon: Pill, label: "وصفة طبية", desc: "أرسل وصفتك", color: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/30", iconColor: "text-emerald-400", href: "/pharmacy" },
    { icon: Calendar, label: "حجز فحص", desc: "احجز موعدك", color: "from-blue-500/30 to-blue-500/5 border-blue-500/30", iconColor: "text-blue-400", href: "/pharmacy" },
    { icon: MessageCircle, label: "استفسار طبي", desc: "اسأل الطبيب", color: "from-purple-500/30 to-purple-500/5 border-purple-500/30", iconColor: "text-purple-400", href: "/pharmacy" },
  ];
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-5 mb-3">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">مؤسسة الشفاء</h2>
        </div>
        <Link href="/pharmacy">
          <span className="text-xs text-primary font-semibold flex items-center gap-1">
            اكتشف <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-5 px-5">
        {services.map((s) => (
          <Link key={s.label} href={s.href}>
            <motion.div whileTap={{ scale: 0.93 }}
              className={`shrink-0 w-32 rounded-2xl bg-gradient-to-br ${s.color} border p-4 flex flex-col gap-2`}>
              <div className={`w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <p className="text-sm font-bold text-white leading-tight">{s.label}</p>
              <p className="text-[10px] text-white/50">{s.desc}</p>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WholesaleStrip() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => setEnabled(flags?.wholesaleEnabled === true))
      .catch(() => {});
  }, []);

  if (!enabled) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between px-5 mb-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">سوق الجملة</h2>
        </div>
        <Link href="/wholesale">
          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            اكتشف <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
      <Link href="/wholesale">
        <motion.div whileTap={{ scale: 0.98 }} className="mx-5 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-transparent p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-black text-white">ملابس، إلكترونيات وقطع غيار</p>
            <p className="text-xs text-white/45 mt-1">بيع بالكرتون وأسعار خاصة للتجار</p>
          </div>
        </motion.div>
      </Link>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { streakCount } = useStreak();
  const cachedCategories = getCachedData<any[]>("categories");
  const [competition, setCompetition] = useState<{ enabled: boolean; status: string; prize: string } | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/competition/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.enabled) {
          setCompetition(data);
        }
      })
      .catch(() => {});
  }, []);

  const { data: flashSale } = useQuery({
    queryKey: ["flash-sale-active"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/flash-sale/active`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // queryKey فريد لكل mount → يجلب مرة واحدة بمنتجات عشوائية جديدة
  const sessionSeed = useRef(Date.now()).current;
  const { data: featuredProducts, isLoading: loadingFeatured } = useGetFeaturedProducts({
    query: { staleTime: Infinity, queryKey: [...getGetFeaturedProductsQueryKey(), sessionSeed] },
  });
  const { data: categories, isLoading: loadingCategories } = useListCategories({
    query: { initialData: cachedCategories ?? undefined, queryKey: getListCategoriesQueryKey() },
  });

  // دوران المنتجات الرائجة كل 30 ثانية
  const [page, setPage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPages = Math.ceil((featuredProducts?.length ?? 0) / PAGE_SIZE);

  const startTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + (100 / (ROTATE_INTERVAL / 200)), 100));
    }, 200);

    timerRef.current = setInterval(() => {
      setPage((prev) => {
        const next = (prev + 1) % (totalPages || 1);
        setDirection(1);
        return next;
      });
      setProgress(0);
    }, ROTATE_INTERVAL);
  };

  useEffect(() => {
    if (!featuredProducts?.length || totalPages <= 1) return;
    startTimers();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [featuredProducts?.length, totalPages]);

  const visibleProducts = featuredProducts?.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) ?? [];

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
                {user ? `أهلاً، ${user.name.split(" ")[0]}` : "البازار الرقمي"}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  Gay<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">tak</span>
                </h1>
                {user && streakCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25"
                  >
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-[11px] font-bold text-orange-400 font-mono">{streakCount}</span>
                  </motion.div>
                )}
              </div>
            </div>
            <Link href={user ? "/profile" : "/login"}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-secondary/40 border border-primary/30 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                <span className="text-sm font-bold text-white">
                  {user ? user.name[0].toUpperCase() : "؟"}
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Stories Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between px-5 mb-3">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">الحالات</h2>
          </div>
          <StoriesBar />
        </div>

        {/* Image Slider Banner */}
        <HeroSlider />

        {/* 🏆 مسابقة غايتك الكبرى (Active Competition Banner) */}
        <AnimatePresence>
          {competition && competition.enabled && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mx-4 mt-4 rounded-2xl overflow-hidden border border-yellow-500/30 bg-gradient-to-r from-yellow-950/40 via-purple-950/40 to-background relative shadow-[0_0_20px_rgba(234,179,8,0.15)]"
            >
              {/* Glowing Ambient Light Background */}
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" />
              <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" />

              <Link href="/food">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Pulsing Trophy Icon Container */}
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 5, 0]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400/25 to-amber-500/10 border border-yellow-500/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                    >
                      <Trophy className="w-6 h-6 text-yellow-400" />
                    </motion.div>

                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                        </span>
                        <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
                          {competition.status === "open" ? "مسابقة نشطة الآن 🔥" : "المسابقة قيد التجهيز ⏳"}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-white mt-1">مسابقة غايتك الكبرى</h3>
                      <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                        الجائزة: <span className="text-yellow-400 font-bold">{competition.prize}</span> • اضغط للتفاصيل والاشتراك
                      </p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-4 h-4 text-white/60 rotate-180" />
                  </div>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ⚡ بانر العرض التنازلي */}
        <AnimatePresence>
          {flashSale && flashSale.product && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-4 mt-4 rounded-2xl overflow-hidden border border-orange-500/30 bg-gradient-to-r from-orange-950/60 to-red-950/60 backdrop-blur-sm"
            >
              <Link href={`/products/${flashSale.productId}`}>
                <div className="flex items-center gap-3 p-3">
                  {/* صورة المنتج */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0">
                    {flashSale.product.images?.[0] ? (
                      <img src={flashSale.product.images[0]} alt={flashSale.product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-orange-500/20 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-orange-400" />
                      </div>
                    )}
                  </div>

                  {/* تفاصيل العرض */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest">⚡ عرض محدود</span>
                    </div>
                    <p className="text-sm font-bold text-white line-clamp-1">{flashSale.product.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base font-black text-orange-400 font-mono">{flashSale.salePrice} د.ج</span>
                      <span className="text-xs text-white/30 line-through font-mono">{flashSale.product.price} د.ج</span>
                    </div>
                  </div>

                  {/* المؤقت */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="flex items-center gap-1 text-orange-400/70 mb-1">
                      <Clock className="w-3 h-3" />
                    </div>
                    <div className="text-orange-400 text-[13px]">
                      <FlashCountdown endsAt={flashSale.endsAt} />
                    </div>
                    <span className="text-[9px] text-white/30 mt-0.5">ينتهي</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 💊 مؤسسة الشفاء */}
        <PharmacyStrip />
        <WholesaleStrip />

        {/* Categories */}
        <div className="mt-6 px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">التصنيفات</h2>
            <Link href="/products">
              <span className="text-xs text-primary font-semibold">الكل</span>
            </Link>
          </div>
          {loadingCategories ? (
            <div className="flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-[72px] h-[72px] rounded-2xl bg-white/5 animate-pulse shrink-0" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-5 px-5">
              {categories?.map((cat, i) => (
                <Link key={cat.id} href={`/products?category=${cat.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    className={`shrink-0 w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${CAT_COLORS[i % CAT_COLORS.length]} border flex flex-col items-center justify-center gap-1`}
                  >
                    <span className="text-xl">{cat.icon || "📦"}</span>
                    <span className="text-[9px] font-bold text-white/70 text-center px-1 leading-tight">
                      {cat.name}
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Featured Products */}
        <div className="mt-6 px-5 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent" />
              الأكثر رواجاً
            </h2>
            <div className="flex items-center gap-2">
              {/* نقاط الصفحات */}
              {totalPages > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setDirection(i > page ? 1 : -1); setPage(i); startTimers(); }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === page ? "w-4 bg-primary" : "w-1.5 bg-white/20"}`}
                    />
                  ))}
                </div>
              )}
              <Link href="/products">
                <span className="text-xs text-primary font-semibold">عرض الكل</span>
              </Link>
            </div>
          </div>

          {/* شريط التقدم */}
          {totalPages > 1 && !loadingFeatured && (
            <div className="h-0.5 bg-white/5 rounded-full mb-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.2, ease: "linear" }}
              />
            </div>
          )}

          {loadingFeatured ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} compact />
              ))}
            </div>
          ) : (
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={page}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -40 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="grid grid-cols-2 gap-3"
                >
                  {visibleProducts.map((product, i) => (
                    <ProductCard key={product.id} product={product} index={i} compact />
                  ))}
                  {!featuredProducts?.length && (
                    <div className="col-span-2 text-center py-10 text-muted-foreground text-sm">
                      لا توجد منتجات حتى الآن
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
