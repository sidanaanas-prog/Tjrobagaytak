import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Clock, ChefHat, MapPin, Flame, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

const CATEGORIES = ["الكل", "برجر", "بيتزا", "مشاوي", "سوشي", "وجبات صحية", "حلويات", "مشروبات", "عام"];

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  category: string;
  address: string;
  isOpen: boolean;
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  rating: string;
  ratingCount: number;
  isFeatured: boolean;
};

function RestaurantCard({ r }: { r: Restaurant }) {
  return (
    <Link href={`/food/${r.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-primary/30 transition-all"
      >
        {/* Cover */}
        <div className="relative h-36 bg-gradient-to-br from-primary/20 to-secondary/20">
          {r.coverImage ? (
            <img src={r.coverImage} alt={r.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="w-12 h-12 text-white/20" />
            </div>
          )}
          {r.isFeatured && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-[10px] font-bold">
              <Flame className="w-3 h-3" /> مميز
            </div>
          )}
          {!r.isOpen && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white/70 font-bold text-sm">مغلق الآن</span>
            </div>
          )}
          {/* Logo */}
          <div className="absolute -bottom-5 right-4 w-12 h-12 rounded-xl overflow-hidden border-2 border-background bg-black/80">
            {r.logo ? (
              <img src={r.logo} alt={r.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/30">
                <span className="text-white font-bold text-lg">{r.name[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="pt-7 pb-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-sm">{r.name}</h3>
              <p className="text-xs text-white/40 mt-0.5">{r.category}</p>
            </div>
            {Number(r.rating) > 0 && (
              <div className="flex items-center gap-1 text-yellow-400 shrink-0">
                <Star className="w-3.5 h-3.5 fill-yellow-400" />
                <span className="text-xs font-bold">{Number(r.rating).toFixed(1)}</span>
              </div>
            )}
          </div>
          {r.description && (
            <p className="text-[11px] text-white/30 mt-1.5 line-clamp-1">{r.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white/50">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{r.estimatedDeliveryMinutes} دقيقة</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{Number(r.deliveryFee) === 0 ? "توصيل مجاني" : `${r.deliveryFee} ر.س`}</span>
            </div>
            {Number(r.minOrder) > 0 && (
              <span>حد أدنى {r.minOrder} ر.س</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function FoodPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("الكل");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "الكل") params.set("category", category);
    if (search) params.set("q", search);
    fetch(`${BASE}/api/restaurants?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setRestaurants(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, search]);

  const featured = restaurants.filter((r) => r.isFeatured);
  const rest = restaurants.filter((r) => !r.isFeatured);

  return (
    <AppLayout>
      <div className="flex flex-col pb-24">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">اطلب الآن</p>
              <h1 className="text-2xl font-black text-white">
                🍽️ <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">مطاعم</span>
              </h1>
            </div>
            <Link href="/food/orders">
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold"
              >
                طلباتي <ChevronRight className="w-3.5 h-3.5" />
              </motion.button>
            </Link>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن مطعم..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
              dir="rtl"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-5 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.92 }}
                onClick={() => setCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  category === cat
                    ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                    : "bg-white/5 text-white/50 border border-white/10"
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-6">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 h-52 animate-pulse" />
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ChefHat className="w-14 h-14 text-white/10" />
              <p className="text-white/40 text-sm">لا توجد مطاعم متاحة</p>
              <p className="text-white/20 text-xs">جرب تغيير الفئة أو البحث</p>
            </div>
          ) : (
            <>
              {featured.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-bold text-white">مميز</h2>
                  </div>
                  <div className="space-y-3">
                    {featured.map((r) => <RestaurantCard key={r.id} r={r} />)}
                  </div>
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  {featured.length > 0 && (
                    <h2 className="text-sm font-bold text-white mb-3">جميع المطاعم</h2>
                  )}
                  <div className="space-y-3">
                    {rest.map((r) => <RestaurantCard key={r.id} r={r} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CTA: سجّل مطعمك */}
        <div className="px-4 mt-8">
          <Link href="/food/register">
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="rounded-2xl p-4 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-between"
            >
              <div>
                <p className="text-white font-bold text-sm">هل تملك مطعماً؟</p>
                <p className="text-white/50 text-xs mt-0.5">سجّل مطعمك واستقبل الطلبات</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-primary" />
              </div>
            </motion.div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
