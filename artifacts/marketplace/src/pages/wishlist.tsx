import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2, Zap, Clock, ShoppingBag } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchWishlist() {
  const token = localStorage.getItem("glow_token");
  const res = await fetch(`${BASE}/api/wishlist`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("failed");
  return res.json() as Promise<Array<{
    productId: string;
    createdAt: string;
    product: { id: string; title: string; price: number; images: string[]; status: string };
    activeSale: { salePrice: number; endsAt: string } | null;
  }>>;
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("انتهى"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="font-mono text-xs text-orange-400">{remaining}</span>;
}

export default function WishlistPage() {
  const { toggle } = useWishlist();
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
    staleTime: 30_000,
  });

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Heart className="w-4.5 h-4.5 text-red-400 fill-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">قائمة المفضلة</h1>
              <p className="text-xs text-white/40">{items.length} منتج محفوظ</p>
            </div>
          </div>
        </div>

        <div className="px-4 pb-28 flex-1">
          {isLoading ? (
            <div className="space-y-3 mt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Heart className="w-9 h-9 text-red-400/40" />
              </div>
              <p className="text-white/40 text-sm text-center">لا توجد منتجات في المفضلة بعد</p>
              <Link href="/products">
                <button className="px-6 py-2.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-sm font-bold">
                  تصفح المنتجات
                </button>
              </Link>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex gap-3 p-3 rounded-2xl bg-card border border-white/5 mb-3"
                >
                  {/* صورة المنتج */}
                  <Link href={`/products/${item.productId}`}>
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-black shrink-0">
                      {item.product.images?.[0] ? (
                        <img src={item.product.images[0]} alt={item.product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-white/20" />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* تفاصيل */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.productId}`}>
                      <p className="font-semibold text-sm text-white line-clamp-1">{item.product.title}</p>
                    </Link>

                    {item.activeSale ? (
                      <div className="mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-orange-400 font-mono">{item.activeSale.salePrice} د.ج</span>
                          <span className="text-xs text-white/30 line-through font-mono">{item.product.price} د.ج</span>
                          <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded-full font-bold">
                            ⚡ عرض
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-orange-400/60" />
                          <Countdown endsAt={item.activeSale.endsAt} />
                        </div>
                      </div>
                    ) : (
                      <p className="font-bold text-accent font-mono text-sm mt-1">{item.product.price} د.ج</p>
                    )}
                  </div>

                  {/* حذف */}
                  <button
                    onClick={() => { toggle(item.productId); refetch(); }}
                    className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors shrink-0 self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
