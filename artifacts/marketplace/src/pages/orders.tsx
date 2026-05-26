import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { motion, AnimatePresence as AP } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Loader2, Package, ChevronLeft, Truck, CheckCircle, XCircle, Clock, Phone, MapPin, MessageSquare, UserCheck, Navigation } from "lucide-react";

type Order = {
  id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
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

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  confirmed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  shipped: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  delivered: "text-green-400 bg-green-400/10 border-green-400/20",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/20",
};

const statusIcons: Record<string, React.ReactNode> = {
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

export default function OrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"buyer" | "seller">("buyer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<string | null>(null); // orderId
  const [settingDelivery, setSettingDelivery] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const token = getMemToken();
    fetch(`/api/orders?role=${activeTab}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user, activeTab]);

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const token = getMemToken();
      const res = await fetch(`/api/orders/${orderId}/status`, {
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
        // بعد التأكيد مباشرة — اعرض نافذة اختيار التوصيل
        if (status === "confirmed") {
          setDeliveryModal(orderId);
        }
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
      const res = await fetch(`/api/orders/${orderId}/delivery-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deliveryType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      } else {
        const msg = deliveryType === "service"
          ? "تم إرسال طلب التوصيل للإدارة ✅"
          : "رائع! ستتولى التوصيل بنفسك 🚗";
        toast({ title: msg });
        setOrders(prev => prev.map(o => o.id === orderId
          ? { ...o, deliveryType: data.deliveryType, deliveryStatus: data.deliveryStatus }
          : o
        ));
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
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/profile">
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </Link>
          <h1 className="text-base font-bold text-white">طلباتي</h1>
          <div className="w-5" />
        </div>

        {/* Tabs */}
        <div className="px-5 mb-4">
          <div className="flex rounded-2xl bg-white/5 border border-white/5 p-1">
            <button
              onClick={() => setActiveTab("buyer")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "buyer" ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]" : "text-white/50"
              }`}
            >
              مشتري
            </button>
            <button
              onClick={() => setActiveTab("seller")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "seller" ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]" : "text-white/50"
              }`}
            >
              بائع
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="px-5 pb-8 space-y-3">
          {loading ? (
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
            orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden"
              >
                {/* Product info */}
                <div className="p-4 flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0">
                    {order.product?.images?.[0] ? (
                      <img src={order.product.images[0]} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{order.product?.title || "منتج غير متوفر"}</p>
                    <p className="text-xs text-primary font-bold mt-0.5">{Number(order.price).toFixed(0)} د.ج</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${statusColors[order.status]}`}>
                        {statusIcons[order.status]}
                        {statusLabels[order.status]}
                      </span>
                      {order.deliveryType === "service" && order.deliveryStatus && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold ${deliveryStatusColors[order.deliveryStatus] ?? ""}`}>
                          <Truck className="w-3 h-3" />
                          {deliveryStatusLabels[order.deliveryStatus] ?? order.deliveryStatus}
                        </span>
                      )}
                      {order.deliveryType === "self" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold text-cyan-400 bg-cyan-400/10 border-cyan-400/20">
                          <UserCheck className="w-3 h-3" />
                          توصيل ذاتي
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buyer contact info (visible when viewing as seller) */}
                {activeTab === "seller" && (
                  <div className="px-4 pb-2 space-y-1">
                    {order.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                        <Phone className="w-3 h-3" />
                        <span dir="ltr">{order.phone}</span>
                      </div>
                    )}
                    {order.shippingAddress && (
                      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                        <MapPin className="w-3 h-3" />
                        <span>{order.shippingAddress}</span>
                      </div>
                    )}
                    {order.notes && (
                      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                        <MessageSquare className="w-3 h-3" />
                        <span>{order.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="px-4 pb-3 flex items-center justify-between text-[11px] text-white/40">
                  <span>
                    {activeTab === "buyer"
                      ? `البائع: ${order.seller?.name || "-"}`
                      : `المشتري: ${order.buyer?.name || "-"}`}
                  </span>
                  <span>{new Date(order.createdAt).toLocaleDateString("ar-DZ")}</span>
                </div>

                {/* Seller actions */}
                {activeTab === "seller" && order.status !== "delivered" && order.status !== "cancelled" && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex gap-2">
                      {order.status === "pending" && (
                        <>
                          <button
                            onClick={() => updateStatus(order.id, "confirmed")}
                            disabled={updatingId === order.id}
                            className="flex-1 h-9 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            تأكيد
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, "cancelled")}
                            disabled={updatingId === order.id}
                            className="flex-1 h-9 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            إلغاء
                          </button>
                        </>
                      )}
                      {order.status === "confirmed" && order.deliveryType === "self" && (
                        <button
                          onClick={() => updateStatus(order.id, "shipped")}
                          disabled={updatingId === order.id}
                          className="flex-1 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                          تم الشحن
                        </button>
                      )}
                      {order.status === "shipped" && (
                        <button
                          onClick={() => updateStatus(order.id, "delivered")}
                          disabled={updatingId === order.id}
                          className="flex-1 h-9 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          تم التسليم
                        </button>
                      )}
                    </div>
                    {/* زر اختيار التوصيل — يظهر للبائع عند التأكيد إذا لم يختر بعد */}
                    {order.status === "confirmed" && !order.deliveryType && (
                      <button
                        onClick={() => setDeliveryModal(order.id)}
                        className="w-full h-9 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/25 transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        اختر طريقة التوصيل
                      </button>
                    )}
                  </div>
                )}

                {/* Buyer actions: cancel pending order */}
                {activeTab === "buyer" && order.status === "pending" && (
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => updateStatus(order.id, "cancelled")}
                      disabled={updatingId === order.id}
                      className="w-full h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {updatingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      إلغاء الطلب
                    </button>
                  </div>
                )}

                {/* Buyer: contact seller button */}
                {activeTab === "buyer" && order.status !== "cancelled" && order.status !== "delivered" && (
                  <div className="px-4 pb-4">
                    <Link href={`/chat`} className="block">
                      <button className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" />
                        مراسلة البائع
                      </button>
                    </Link>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ── نافذة اختيار طريقة التوصيل ── */}
      <AP>
        {deliveryModal && (
          <motion.div
            key="delivery-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => !settingDelivery && setDeliveryModal(null)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="w-full max-w-lg bg-[#111] border border-white/10 rounded-t-3xl p-6 pb-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">طريقة التوصيل</h3>
                  <p className="text-xs text-white/40">كيف ستوصل هذا الطلب؟</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {/* توصيل ذاتي */}
                <button
                  onClick={() => setDeliveryType(deliveryModal, "self")}
                  disabled={settingDelivery}
                  className="w-full p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-right flex items-center gap-4 disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <UserCheck className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">سأوصّل بنفسي</p>
                    <p className="text-xs text-white/40 mt-0.5">تتولى التوصيل مباشرة مع المشتري</p>
                  </div>
                </button>

                {/* خدمة التوصيل */}
                <button
                  onClick={() => setDeliveryType(deliveryModal, "service")}
                  disabled={settingDelivery}
                  className="w-full p-4 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-[0.98] transition-all text-right flex items-center gap-4 disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    {settingDelivery ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <Navigation className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-primary text-sm">خدمة التوصيل</p>
                    <p className="text-xs text-white/40 mt-0.5">يتولى الإدارة ترتيب التوصيل لك</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setDeliveryModal(null)}
                disabled={settingDelivery}
                className="w-full mt-4 h-10 rounded-2xl border border-white/10 text-white/40 text-sm hover:text-white/60 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
            </motion.div>
          </motion.div>
        )}
      </AP>
    </AppLayout>
  );
}
