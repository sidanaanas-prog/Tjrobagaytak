import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Store, Package, ChevronRight, Loader2, X } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { motion, AnimatePresence } from "framer-motion";

interface Seller {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  productCount: number;
}

export default function SellersPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIMIT = 20;

  const fetchSellers = async (q: string, p: number, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/sellers?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setSellers(prev => reset ? data.sellers : [...prev, ...data.sellers.filter((s: Seller) => !prev.find(x => x.id === s.id))]);
      setTotal(data.total);
      setHasMore(p * LIMIT < data.total);
    } finally {
      setLoading(false);
    }
  };

  // البحث الأولي
  useEffect(() => { fetchSellers("", 1, true); }, []);

  // debounce البحث
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSellers(search, 1, true);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchSellers(search, next);
  };

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-3 bg-background/95 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Store className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-black text-white">المتاجر</h1>
            {total > 0 && (
              <span className="ml-auto text-xs text-white/40">{total} متجر</span>
            )}
          </div>

          {/* تبديل بين منتجات ومتاجر */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setLocation("/products")}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              المنتجات
            </button>
            <button
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary border border-primary/30"
            >
              المتاجر
            </button>
          </div>

          {/* شريط البحث */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن متجر باسمه..."
              className="bg-white/5 border-white/10 rounded-xl h-10 pr-9 text-sm focus-visible:border-primary/50 text-right"
              dir="rtl"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white/60" />
              </button>
            )}
          </div>
        </div>

        {/* قائمة المتاجر */}
        <div className="px-4 py-3 space-y-2.5">
          {loading && sellers.length === 0 ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-4 rounded-2xl bg-white/5">
                <div className="w-14 h-14 rounded-2xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-2/3" />
                  <div className="h-3 bg-white/5 rounded w-1/3" />
                </div>
              </div>
            ))
          ) : sellers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <Store className="w-12 h-12 text-white/10 mb-3" />
              <p className="text-white/40 text-sm">لا توجد متاجر تطابق "{search}"</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {sellers.map((seller, i) => (
                <motion.div
                  key={seller.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/seller/${seller.id}`}>
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 hover:bg-white/8 active:scale-[0.98] transition-all border border-white/5 cursor-pointer">
                      {/* Avatar */}
                      <Avatar className="w-14 h-14 rounded-2xl border border-white/10 shrink-0">
                        <AvatarImage src={seller.avatar ?? undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg rounded-2xl">
                          {seller.name[0]}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-bold text-white text-sm truncate">{seller.name}</p>
                          {seller.role === "admin" && <VerifiedBadge size="xs" />}
                        </div>
                        <div className="flex items-center gap-1 text-white/40">
                          <Package className="w-3 h-3" />
                          <span className="text-xs">{seller.productCount} منتج</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* تحميل المزيد */}
          {hasMore && !loading && (
            <button
              onClick={loadMore}
              className="w-full py-3 mt-2 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm hover:bg-white/10 transition-colors"
            >
              تحميل المزيد
            </button>
          )}

          {loading && sellers.length > 0 && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary/50" />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
