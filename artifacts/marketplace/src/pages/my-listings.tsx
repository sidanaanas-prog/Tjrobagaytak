import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Link, useLocation } from "wouter";
import { Loader2, Package, Plus, CheckCircle, XCircle, AlertCircle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

type StatusFilter = "all" | "active" | "rejected";

const statusConfig = {
  active: {
    label: "منشور",
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    glow: "shadow-[0_0_12px_rgba(52,211,153,0.3)]",
  },
  rejected: {
    label: "مرفوض",
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    glow: "shadow-[0_0_12px_rgba(248,113,113,0.3)]",
  },
};

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "منشور" },
  { key: "rejected", label: "مرفوض" },
];

export default function MyListingsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: productsData, isLoading, refetch } = useListProducts(
    { sellerId: user?.id, limit: 50 },
    { query: { enabled: !!user?.id, queryKey: getListProductsQueryKey({ sellerId: user?.id, limit: 50 }) } }
  );

  const products = productsData?.products || [];

  const counts = {
    all: products.length,
    active: products.filter((p) => p.status === "active").length,
    rejected: products.filter((p) => p.status === "rejected").length,
  };

  const filtered =
    activeFilter === "all"
      ? products
      : products.filter((p) => p.status === activeFilter);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const token = getMemToken();
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("فشل الحذف");
      toast({ title: "تم الحذف ✓", description: "تم حذف المنتج بنجاح." });
      refetch();
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حذف المنتج." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Package className="w-4 h-4 text-accent" />
              </div>
              <h1 className="text-xl font-black text-white">منتجاتي</h1>
            </div>
            <Link href="/sell">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                <Plus className="w-5 h-5 text-white" />
              </div>
            </Link>
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/5 p-4">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl bg-white/5 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-3/4 h-4 bg-white/5 animate-pulse rounded" />
                      <div className="w-1/2 h-3 bg-white/5 animate-pulse rounded" />
                      <div className="w-full h-6 bg-white/5 animate-pulse rounded mt-3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !products.length ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📦</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد منتجات</h3>
              <p className="text-muted-foreground text-sm mb-6">ابدأ بإضافة منتجك الأول الآن!</p>
              <Link href="/sell">
                <button className="bg-primary text-white px-6 py-3 rounded-full font-bold text-sm shadow-[0_0_16px_rgba(168,85,247,0.4)]">
                  أضف منتجاً
                </button>
              </Link>
            </div>
          ) : (
            <>
              {/* Status Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                {(["active", "rejected"] as const).map((status) => {
                  const cfg = statusConfig[status];
                  const Icon = cfg.icon;
                  return (
                    <motion.button
                      key={status}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveFilter(status)}
                      className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all ${cfg.bg} ${cfg.border} ${
                        activeFilter === status ? cfg.glow : ""
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                      <span className={`text-xl font-black ${cfg.color}`}>{counts[status]}</span>
                      <span className="text-[10px] text-white/60 font-medium">{cfg.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {filterTabs.map((tab) => (
                  <motion.button
                    key={tab.key}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      activeFilter === tab.key
                        ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 text-white/50 border-white/10"
                    }`}
                  >
                    {tab.label}
                    <span className="mr-1.5 opacity-70">
                      {tab.key === "all" ? counts.all : counts[tab.key]}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Products List */}
              <AnimatePresence mode="wait">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-12"
                  >
                    <AlertCircle className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">لا توجد منتجات في هذه الحالة</p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={activeFilter}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-muted-foreground">{filtered.length} منتج</p>
                    {filtered.map((product) => {
                      const statusCfg = statusConfig[product.status as "active" | "rejected"] ?? statusConfig.active;
                      const StatusIcon = statusCfg.icon;
                      return (
                        <motion.div
                          key={product.id}
                          layout
                          className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5"
                        >
                          {/* Thumbnail */}
                          <div
                            className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5 cursor-pointer"
                            onClick={() => setLocation(`/products/${product.id}`)}
                          >
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-white font-bold text-sm truncate">{product.title}</p>
                            <p className="text-accent text-xs font-mono mt-0.5">{Number(product.price).toFixed(0)} د.ج</p>
                            <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusCfg.label}
                            </div>
                          </div>

                          {/* Delete Button */}
                          {confirmId === product.id ? (
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <button
                                onClick={() => handleDelete(product.id)}
                                disabled={deletingId === product.id}
                                className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold"
                              >
                                {deletingId === product.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "تأكيد"}
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="px-3 py-1.5 rounded-xl bg-white/10 text-white/50 text-xs"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmId(product.id)}
                              className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
