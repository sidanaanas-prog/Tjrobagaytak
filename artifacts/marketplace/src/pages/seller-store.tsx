import { useParams, useLocation } from "wouter";
import { useGetUser, useListProducts, getListProductsQueryKey, getGetUserQueryKey, useCreateConversation } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Loader2, ArrowRight, MessageSquare, Store, Package, UserPlus, UserCheck, Users } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

export default function SellerStorePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: seller, isLoading: loadingSeller, error: sellerError } = useGetUser(id || "", {
    query: { enabled: !!id, queryKey: getGetUserQueryKey(id || "") },
  });

  const { data: productsData, isLoading: loadingProducts } = useListProducts(
    { sellerId: id },
    { query: { enabled: !!id, queryKey: getListProductsQueryKey({ sellerId: id }) } }
  );

  const createConversation = useCreateConversation();

  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/seller/${id}/followers`).then((r) => r.json()).then((d) => setFollowerCount(d.count ?? 0)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const token = getMemToken();
    fetch(`/api/follows/check?sellerId=${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setFollowing(d.following)).catch(() => {});
  }, [user, id]);

  async function toggleFollow() {
    if (!user) { toast({ title: "يجب تسجيل الدخول" }); setLocation("/login"); return; }
    setFollowLoading(true);
    const token = getMemToken();
    try {
      if (following) {
        await fetch("/api/follows", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sellerId: id }) });
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await fetch("/api/follows", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sellerId: id }) });
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر تحديث المتابعة" });
    } finally {
      setFollowLoading(false);
    }
  }

  const handleContact = () => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول", description: "سجّل دخولك للتواصل مع البائع." });
      setLocation("/login");
      return;
    }
    if (user.id === id) {
      toast({ title: "هذا متجرك!", description: "لا يمكنك مراسلة نفسك." });
      return;
    }
    createConversation.mutate(
      { data: { recipientId: id! } },
      {
        onSuccess: (conv) => setLocation(`/chat/${conv.id}`),
        onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err?.message }),
      }
    );
  };

  if (loadingSeller) {
    return (
      <AppLayout>
        <div className="px-5 pt-8 space-y-4">
          <div className="w-full h-[180px] rounded-2xl bg-white/5 animate-pulse" />
          <div className="flex items-end gap-4 -mt-6">
            <div className="w-20 h-20 rounded-2xl bg-white/5 animate-pulse shrink-0" />
            <div className="space-y-2 pb-2">
              <div className="w-32 h-5 bg-white/5 animate-pulse rounded" />
              <div className="w-20 h-3 bg-white/5 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-9 rounded-xl bg-white/5 animate-pulse mt-4" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} compact />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (sellerError || !seller) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
          <div className="text-5xl">🔍</div>
          <h2 className="text-xl font-black text-white">البائع غير موجود</h2>
          <Link href="/products">
            <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm">العودة للسوق</button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const products = productsData?.products ?? [];
  const isMe = user?.id === seller.id;

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Header */}
        <div className="relative">
          {/* Cover gradient */}
          <div className="h-32 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/10" />

          {/* Back */}
          <button
            onClick={() => window.history.back()}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center z-10"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>

          {/* Avatar + Info */}
          <div className="px-5 -mt-10 relative z-10">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl bg-muted border-2 border-background overflow-hidden flex items-center justify-center shadow-lg">
                {seller.avatar ? (
                  <img src={seller.avatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <span className="text-3xl font-black text-primary">{seller.name?.[0] || "؟"}</span>
                )}
              </div>
              <div className="pb-1 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-white">{seller.name}</h1>
                  {(seller as any).role === "admin" && <VerifiedBadge size="sm" />}
                  {!isMe && (
                    <button
                      onClick={toggleFollow}
                      disabled={followLoading}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform border ${following ? "bg-accent/15 border-accent/30 text-accent" : "bg-primary border-primary text-white"}`}
                    >
                      {followLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : following ? (
                        <><UserCheck className="w-3 h-3" /> متابع</>
                      ) : (
                        <><UserPlus className="w-3 h-3" /> تابع</>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Package className="w-3 h-3" /> {seller.productCount ?? 0} منتج
                  </span>
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {followerCount} متابع
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isMe && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 mt-4 flex gap-2"
          >
            <button
              onClick={handleContact}
              disabled={createConversation.isPending}
              className="flex-1 h-11 bg-primary/15 border border-primary/30 text-primary text-sm font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <MessageSquare className="w-4 h-4" />
              دردشة
            </button>
            <button
              onClick={() => document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex-1 h-11 bg-primary text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95 transition-transform"
            >
              <Store className="w-4 h-4" />
              منتجات المتجر
            </button>
          </motion.div>
        )}

        {/* Products Grid */}
        <div id="products-section" className="px-5 mt-6">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">منتجات المتجر</h2>

          {loadingProducts ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} compact />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-white/10 mx-auto mb-2" />
              <p className="text-white/30 text-sm">لا يوجد منتجات في هذا المتجر بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} compact />
              ))}
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </AppLayout>
  );
}
