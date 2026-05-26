import { getMemToken } from "@/hooks/use-auth";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Loader2, Users, ChevronLeft, Store } from "lucide-react";

type Seller = {
  id: string;
  name: string;
  avatar: string | null;
  productCount?: number;
};

export default function FollowingPage() {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const token = getMemToken();
    fetch("/api/user/following", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSellers(Array.isArray(d) ? d : []))
      .catch(() => setSellers([]))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/profile">
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
          <h1 className="text-base font-bold text-white">المتابعون</h1>
          <div className="w-5" />
        </div>

        {/* List */}
        <div className="px-5 pb-8 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-24 h-4 bg-white/5 animate-pulse rounded" />
                    <div className="w-16 h-3 bg-white/5 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : sellers.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Users className="w-12 h-12 text-white/20" />
              <p className="text-white/40 text-sm">لم تتابع أي متجر بعد</p>
            </div>
          ) : (
            sellers.map((seller) => (
              <motion.div
                key={seller.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link href={`/seller/${seller.id}`}>
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 overflow-hidden">
                      {seller.avatar ? (
                        <img src={seller.avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="text-primary font-bold text-lg">{seller.name[0]?.toUpperCase() || "؟"}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{seller.name}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        <Store className="w-3 h-3 inline mr-1" />
                        {seller.productCount ?? 0} منتج
                      </p>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-white/30" />
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
