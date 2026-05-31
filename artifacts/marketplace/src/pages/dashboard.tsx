import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useCreateConversation } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getApiUrl } from "@/lib/api-url";
import {
  Loader2, Package, Plus, CheckCircle, XCircle, AlertCircle,
  Trash2, Pencil, Truck, Clock, Phone, MapPin, MessageSquare,
  UserCheck, Navigation, Store,
} from "lucide-react";

const BASE = getApiUrl("");

type DashboardTab = "products" | "orders";
type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
type ProductStatusFilter = "all" | "active" | "rejected";

// ── Products config ──
const productStatusConfig = {
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

const productFilterTabs: { key: ProductStatusFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "منشور" },
  { key: "rejected", label: "مرفوض" },
];

// ── Orders config ──
const orderStatusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const orderStatusColors: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  confirmed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  shipped: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  delivered: "text-green-400 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-500/20",
};

const orderStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  confirmed: <CheckCircle className="w-3.5 h-3.5" />,
  shipped: <Truck className="w-3.5 h-3.5" />,
  delivered: <CheckCircle className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
};

const deliveryStatusLabels: Record<string, string> = {
  pending: "بانتظار خدمة التوصيل",
  accepted: "تم قبول التوصيل ✅",
  rejected: "رُفض التوصيل ❌",
  in_transit: "في الطريق 🚚",
  delivered: "تم التسليم 🎉",
};

const deliveryStatusColors: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  accepted: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  rejected: "text-red-400 bg-red-400/10 border-red-400/20",
  in_transit: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  delivered: "text-green-400 bg-green-400/10 border-green-400/20",
};

type Order = {
  id: string;
  status: OrderStatus;
  price: number;
  quantity: number;
  phone: string | null;
  shippingAddress: string | null;
  notes: string | null;
  deliveryType: string | null;
  deliveryStatus: string | null;
  createdAt: string;
  product: { id: string; title: string; images: string[]; price: number } | null;
  buyer: { id: string; name: string; avatar: string | null } | null;
  seller: { id: string; name: string; avatar: string | null } | null;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createConversation = useCreateConversation();

  const [activeTab, setActiveTab] = useState<DashboardTab>("products");

  // ── Products state ──
  const [productFilter, setProductFilter] = useState<ProductStatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: productsData, isLoading: productsLoading, refetch: refetchProducts } = useListProducts(
    { sellerId: user?.id, limit: 50 },
    { query: { enabled: !!user?.id && activeTab === "products", queryKey: getListProductsQueryKey({ sellerId: user?.id, limit: 50 }) } }
  );
  const products = productsData?.products || [];

  const productCounts = {
    all: products.length,
    active: products.filter((p) => p.status === "active").length,
    rejected: products.filter((p) => p.status === "rejected").length,
  };

  const filteredProducts = productFilter === "all"
    ? products
    : products.filter((p) => p.status === productFilter);

  // ── Orders state ──
  const [orderRole, setOrderRole] = useState<"buyer" | "seller">("seller");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [contactingId, setContactingId] = useState<string | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<string | null>(null);
  const [settingDelivery, setSettingDelivery] = useState(false);

  useEffect(() => {
    if (!user || activeTab !== "orders") return;

    const fetchOrders = (showLoading = false) => {
      if (showLoading) setOrdersLoading(true);
      const token = getMemToken();
      fetch(`${BASE}/api/orders?role=${orderRole}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setOrders(Array.isArray(d) ? d : []))
        .catch(() => setOrders([]))
        .finally(() => { if (showLoading) setOrdersLoading(false); });
    };

    fetchOrders(true);
    const interval = setInterval(() => fetchOrders(false), 15_000);
    return () => clearInterval(interval);
  }, [user, activeTab, orderRole]);

  // ── Handlers ──
  async function handleDeleteProduct(id: string) {
    setDeletingId(id);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("فشل الحذف");
      toast({ title: "تم الحذف ✓", description: "تم حذف المنتج بنجاح." });
      refetchProducts();
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حذف المنتج." });
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "تعذر التحديث" });
      } else {
        toast({ title: "تم تحديث الحالة!" });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: status as any } : o)));
        if (status === "confirmed") setDeliveryModal(orderId);
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر التحديث" });
    }
    setUpdatingId(null);
  }

  async function setDeliveryType(orderId: string, deliveryType: "self" | "service") {
    setSettingDelivery(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/orders/${orderId}/delivery-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deliveryType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      } else {
        const msg = deliveryType === "service" ? "تم إرسال طلب التوصيل للإدارة ✅" : "رائع! ستتولى التوصيل بنفسك 🚗";
        toast({ title: msg });
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, deliveryType: data.deliveryType, deliveryStatus: data.deliveryStatus } : o)));
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر التحديث" });
    }
    setSettingDelivery(false);
    setDeliveryModal(null);
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl font-black text-white">أعمالي</h1>
            </div>
            <Link href="/sell">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                <Plus className="w-5 h-5 text-white" />
              </div>
            </Link>
          </div>
        </div>

        {/* Main Tabs: Products | Orders */}
        <div className="px-5 mt-4 mb-4">
          <div className="flex rounded-2xl bg-white/5 border border-white/5 p-1">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "products" ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]" : "text-white/50"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Package className="w-4 h-4" /> منتجاتي
              </div>
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "orders" ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]" : "text-white/50"
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Truck className="w-4 h-4" /> طلباتي
              </div>
            </button>
          </div>
        </div>

        {/* ── Products View ── */}
        {activeTab === "products" && (
          <div className="px-5 pb-8 space-y-5">
            {productsLoading ? (
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
                  <button className="bg-primary text-white px-6 py-3 rounded-full font-bold text-sm shadow-[0_0_16px_rgba(168,85,247,0.4)]">أضف منتجاً</button>
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {(["active", "rejected"] as const).map((status) => {
                    const cfg = productStatusConfig[status];
                    const Icon = cfg.icon;
                    return (
                      <motion.button key={status} whileTap={{ scale: 0.95 }} onClick={() => setProductFilter(status)}
                        className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 transition-all ${cfg.bg} ${cfg.border} ${productFilter === status ? cfg.glow : ""}`}>
                        <Icon className={`w-5 h-5 ${cfg.color}`} />
                        <span className={`text-xl font-black ${cfg.color}`}>{productCounts[status]}</span>
                        <span className="text-[10px] text-white/60 font-medium">{cfg.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {productFilterTabs.map((tab) => (
                    <motion.button key={tab.key} whileTap={{ scale: 0.93 }} onClick={() => setProductFilter(tab.key)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        productFilter === tab.key ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "bg-white/5 text-white/50 border-white/10"
                      }`}>
                      {tab.label}<span className="mr-1.5 opacity-70">{tab.key === "all" ? productCounts.all : productCounts[tab.key]}</span>
                    </motion.button>
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  {filteredProducts.length === 0 ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12">
                      <AlertCircle className="w-10 h-10 text-white/20 mx-auto mb-3" />
                      <p className="text-white/40 text-sm">لا توجد منتجات في هذه الحالة</p>
                    </motion.div>
                  ) : (
                    <motion.div key={productFilter} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3">
                      <p className="text-xs text-muted-foreground">{filteredProducts.length} منتج</p>
                      {filteredProducts.map((product) => {
                        const cfg = productStatusConfig[product.status as "active" | "rejected"] ?? productStatusConfig.active;
                        const SIcon = cfg.icon;
                        return (
                          <motion.div key={product.id} layout className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white/5 cursor-pointer" onClick={() => setLocation(`/products/${product.id}`)}>
                              {product.images?.[0] ? <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>}
                            </div>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-white font-bold text-sm truncate">{product.title}</p>
                              <p className="text-accent text-xs font-mono mt-0.5">{Number(product.price).toFixed(0)} د.ج</p>
                              <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                                <SIcon className="w-3 h-3" />{cfg.label}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {confirmId === product.id ? (
                                <>
                                  <button onClick={() => handleDeleteProduct(product.id)} disabled={deletingId === product.id} className="px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold">
                                    {deletingId === product.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "تأكيد"}
                                  </button>
                                  <button onClick={() => setConfirmId(null)} className="px-3 py-1.5 rounded-xl bg-white/10 text-white/50 text-xs">إلغاء</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => setLocation(`/edit-product/${product.id}`)} className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Pencil className="w-4 h-4 text-primary" /></button>
                                  <button onClick={() => setConfirmId(product.id)} className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-400" /></button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        )}

        {/* ── Orders View ── */}
        {activeTab === "orders" && (
          <div className="px-5 pb-8 space-y-4">
            <div className="flex rounded-2xl bg-white/5 border border-white/5 p-1">
              <button onClick={() => setOrderRole("buyer")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${orderRole === "buyer" ? "bg-primary/20 text-primary" : "text-white/50"}`}>مشتري</button>
              <button onClick={() => setOrderRole("seller")} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${orderRole === "seller" ? "bg-primary/20 text-primary" : "text-white/50"}`}>بائع</button>
            </div>
            {ordersLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-white/5 border border-white/5 p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-xl bg-white/5 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="w-3/4 h-4 bg-white/5 animate-pulse rounded" />
                        <div className="w-16 h-3 bg-white/5 animate-pulse rounded" />
                        <div className="w-20 h-5 bg-white/5 animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-4">
                <Package className="w-12 h-12 text-white/20" />
                <p className="text-white/40 text-sm">لا توجد طلبات حالياً</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                    <div className="p-4 flex gap-3">
                      <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                        {order.product?.images?.[0] ? <img src={order.product.images[0]} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-white/20" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{order.product?.title || "منتج غير متوفر"}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">{Number(order.price).toFixed(0)} د.ج</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${orderStatusColors[order.status]}`}>{orderStatusIcons[order.status]}{orderStatusLabels[order.status]}</span>
                          {order.deliveryType === "service" && order.deliveryStatus && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${deliveryStatusColors[order.deliveryStatus] ?? ""}`}><Truck className="w-3 h-3" />{deliveryStatusLabels[order.deliveryStatus] ?? order.deliveryStatus}</span>
                          )}
                          {order.deliveryType === "self" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold text-cyan-400 bg-cyan-400/10 border-cyan-400/20"><UserCheck className="w-3 h-3" />توصيل ذاتي</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {orderRole === "seller" && (
                      <div className="px-4 pb-2 space-y-1">
                        {order.phone && <div className="flex items-center gap-1.5 text-[11px] text-white/40"><Phone className="w-3 h-3" /><span dir="ltr">{order.phone}</span></div>}
                        {order.shippingAddress && <div className="flex items-center gap-1.5 text-[11px] text-white/40"><MapPin className="w-3 h-3" /><span>{order.shippingAddress}</span></div>}
                        {order.notes && <div className="flex items-center gap-1.5 text-[11px] text-white/40"><MessageSquare className="w-3 h-3" /><span>{order.notes}</span></div>}
                      </div>
                    )}
                    <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-white/40">
                      <span>{orderRole === "buyer" ? `البائع: ${order.seller?.name || "-"}` : `المشتري: ${order.buyer?.name || "-"}`}</span>
                      <span>{new Date(order.createdAt).toLocaleDateString("ar-DZ")}</span>
                    </div>
                    {orderRole === "seller" && order.status !== "delivered" && order.status !== "cancelled" && (
                      <div className="px-4 pb-4 space-y-2">
                        <div className="flex gap-2">
                          {order.status === "pending" && (
                            <>
                              <button onClick={() => updateOrderStatus(order.id, "confirmed")} disabled={updatingId === order.id} className="flex-1 h-9 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                                {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}تأكيد
                              </button>
                              <button onClick={() => updateOrderStatus(order.id, "cancelled")} disabled={updatingId === order.id} className="flex-1 h-9 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                                <XCircle className="w-3.5 h-3.5" />إلغاء
                              </button>
                            </>
                          )}
                          {order.status === "confirmed" && order.deliveryType === "self" && (
                            <button onClick={() => updateOrderStatus(order.id, "shipped")} disabled={updatingId === order.id} className="flex-1 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                              {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}تم الشحن
                            </button>
                          )}
                          {order.status === "shipped" && (
                            <button onClick={() => updateOrderStatus(order.id, "delivered")} disabled={updatingId === order.id} className="flex-1 h-9 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                              {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}تم التسليم
                            </button>
                          )}
                        </div>
                        {order.status === "confirmed" && !order.deliveryType && (
                          <button onClick={() => setDeliveryModal(order.id)} className="w-full h-9 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/25 transition-colors">
                            <Truck className="w-3.5 h-3.5" />اختر طريقة التوصيل
                          </button>
                        )}
                      </div>
                    )}
                    {orderRole === "buyer" && order.status === "pending" && (
                      <div className="px-4 pb-4">
                        <button onClick={() => updateOrderStatus(order.id, "cancelled")} disabled={updatingId === order.id} className="w-full h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                          {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}إلغاء الطلب
                        </button>
                      </div>
                    )}
                    {orderRole === "buyer" && order.status !== "cancelled" && order.status !== "delivered" && order.seller && (
                      <div className="px-4 pb-4">
                        <button disabled={contactingId === order.id} onClick={() => {
                          setContactingId(order.id);
                          createConversation.mutate(
                            { data: { recipientId: order.seller!.id, productId: order.product?.id } },
                            {
                              onSuccess: (conv) => setLocation(`/chat/${conv.id}`),
                              onError: () => toast({ variant: "destructive", title: "خطأ", description: "تعذر فتح المحادثة" }),
                              onSettled: () => setContactingId(null),
                            }
                          );
                        }} className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors disabled:opacity-50">
                          {contactingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}مراسلة البائع
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Modal */}
      <AnimatePresence>
        {deliveryModal && (
          <motion.div key="delivery-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => !settingDelivery && setDeliveryModal(null)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 280 }} className="w-full max-w-lg bg-[#111] border border-white/10 rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center"><Truck className="w-5 h-5 text-primary" /></div>
                <div><h3 className="text-base font-bold text-white">طريقة التوصيل</h3><p className="text-xs text-white/40">كيف ستوصل هذا الطلب؟</p></div>
              </div>
              <div className="mt-5 space-y-3">
                <button onClick={() => setDeliveryType(deliveryModal, "self")} disabled={settingDelivery} className="w-full p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-right flex items-center gap-4 disabled:opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0"><UserCheck className="w-6 h-6 text-cyan-400" /></div>
                  <div className="flex-1"><p className="font-bold text-white text-sm">سأوصّل بنفسي</p><p className="text-xs text-white/40 mt-0.5">تتولى التوصيل مباشرة مع المشتري</p></div>
                </button>
                <button onClick={() => setDeliveryType(deliveryModal, "service")} disabled={settingDelivery} className="w-full p-4 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-[0.98] transition-all text-right flex items-center gap-4 disabled:opacity-50">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    {settingDelivery ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Navigation className="w-6 h-6 text-primary" />}
                  </div>
                  <div className="flex-1"><p className="font-bold text-primary text-sm">خدمة التوصيل</p><p className="text-xs text-white/40 mt-0.5">يتولى الإدارة ترتيب التوصيل لك</p></div>
                </button>
              </div>
              <button onClick={() => setDeliveryModal(null)} disabled={settingDelivery} className="w-full mt-4 h-10 rounded-2xl border border-white/10 text-white/40 text-sm hover:text-white/60 transition-colors disabled:opacity-50">إلغاء</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
