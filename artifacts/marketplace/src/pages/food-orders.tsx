import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Clock, CheckCircle2, XCircle, ChefHat, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { getMemToken } from "@/hooks/use-auth";

const BASE = getApiUrl("");

type FoodOrder = {
  id: string;
  restaurantId: string;
  status: string;
  deliveryAddress: string;
  totalPrice: string;
  deliveryFee: string;
  paymentMethod: string;
  items: string;
  notes: string | null;
  createdAt: string;
  restaurant: { id: string; name: string; logo: string | null } | null;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: "قيد الانتظار", color: "text-yellow-400", icon: Clock },
  confirmed:  { label: "مؤكد", color: "text-blue-400", icon: CheckCircle2 },
  preparing:  { label: "يتم التحضير", color: "text-orange-400", icon: ChefHat },
  ready:      { label: "جاهز للتوصيل", color: "text-green-400", icon: CheckCircle2 },
  picked_up:  { label: "في الطريق", color: "text-primary", icon: Loader2 },
  delivered:  { label: "تم التوصيل ✅", color: "text-green-400", icon: CheckCircle2 },
  cancelled:  { label: "ملغي", color: "text-red-400", icon: XCircle },
};

export default function FoodOrdersPage() {
  const [, navigate] = useLocation();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getMemToken();
    fetch(`${BASE}/api/food-orders/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setOrders(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));

    const iv = setInterval(() => {
      fetch(`${BASE}/api/food-orders/my`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => { if (Array.isArray(data)) setOrders(data); })
        .catch(() => {});
    }, 10_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/food")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-xl font-black text-white">طلباتي 🍽️</h1>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <ShoppingBag className="w-14 h-14 text-white/10" />
            <p className="text-white/40 text-sm">لا توجد طلبات بعد</p>
            <button onClick={() => navigate("/food")} className="text-primary text-sm font-semibold">اطلب الآن</button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = STATUS_MAP[order.status] ?? { label: order.status, color: "text-white/50", icon: Clock };
              const StatusIcon = status.icon;
              let parsedItems: any[] = [];
              try { parsedItems = JSON.parse(order.items); } catch {}

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-white/5 border border-white/10 p-4"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {order.restaurant?.logo ? (
                        <img src={order.restaurant.logo} alt="" className="w-9 h-9 rounded-xl object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                          <ChefHat className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white text-sm">{order.restaurant?.name ?? "مطعم"}</p>
                        <p className="text-xs text-white/30">#{order.id}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${status.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{status.label}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {parsedItems.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs text-white/60">
                        <span>{it.name} × {it.quantity}</span>
                        <span>{(Number(it.price) * Number(it.quantity)).toFixed(1)} ر.س</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                    <div className="text-xs text-white/40">
                      {new Date(order.createdAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="text-sm font-black text-white">{Number(order.totalPrice).toFixed(1)} ر.س</div>
                  </div>

                  {order.deliveryAddress && (
                    <p className="text-[11px] text-white/30 mt-2 truncate">📍 {order.deliveryAddress}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
