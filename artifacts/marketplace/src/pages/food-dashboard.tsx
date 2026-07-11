import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ChefHat, Clock, CheckCircle2, XCircle, Loader2,
  Settings, PackageCheck, Bike, ShoppingBag, Bell, ToggleLeft, ToggleRight,
  DollarSign, Save, RefreshCw
} from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const BASE = getApiUrl("");

type Order = {
  id: string;
  userId: string;
  status: string;
  deliveryAddress: string;
  totalPrice: string;
  deliveryFee: string;
  paymentMethod: string;
  items: string;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string | null; avatar: string | null } | null;
};

type Restaurant = {
  id: string;
  name: string;
  status: string;
  isOpen: boolean;
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  category: string;
  address: string;
};

const STATUS_STEPS = [
  { value: "pending",    label: "قيد الانتظار",   color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30",  icon: Clock },
  { value: "confirmed",  label: "تأكيد",           color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30",      icon: CheckCircle2 },
  { value: "preparing",  label: "جاري التحضير",   color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/30",  icon: ChefHat },
  { value: "ready",      label: "جاهز للتوصيل",   color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30",    icon: PackageCheck },
  { value: "picked_up",  label: "مع المندوب",      color: "text-primary",     bg: "bg-primary/10 border-primary/30",        icon: Bike },
  { value: "delivered",  label: "تم التوصيل ✅",  color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30",icon: CheckCircle2 },
  { value: "cancelled",  label: "ملغي",            color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30",        icon: XCircle },
];

const NEXT_STATUS: Record<string, string> = {
  pending:   "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready:     "picked_up",
  picked_up: "delivered",
};

const NEXT_LABEL: Record<string, string> = {
  pending:   "تأكيد الطلب",
  confirmed: "بدأ التحضير",
  preparing: "جاهز للتوصيل",
  ready:     "استلمه المندوب",
  picked_up: "تم التوصيل",
};

function OrderCard({ order, onUpdate }: { order: Order; onUpdate: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const status = STATUS_STEPS.find((s) => s.value === order.status) ?? STATUS_STEPS[0];
  const StatusIcon = status.icon;
  const nextStatus = NEXT_STATUS[order.status];

  let parsedItems: any[] = [];
  try { parsedItems = JSON.parse(order.items); } catch {}

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/food-orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: "✅ تم تحديث الحالة" });
      onUpdate();
    } catch {
      toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${status.bg}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">طلب #{order.id}</span>
            <span className={`flex items-center gap-1 text-xs font-semibold ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
          {order.user && (
            <p className="text-xs text-white/50 mt-0.5">
              {order.user.name} {order.user.phone && `• ${order.user.phone}`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-black text-sm">{Number(order.totalPrice).toFixed(0)} دج</p>
          <p className="text-xs text-white/40">
            {order.paymentMethod === "cash" ? "💵 كاش" : "💳 محفظة"}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-0.5 mb-3">
        {parsedItems.map((it: any, i: number) => (
          <div key={i} className="flex justify-between text-xs text-white/60">
            <span>{it.name} × {it.quantity}</span>
            <span>{(Number(it.price) * Number(it.quantity)).toFixed(0)} دج</span>
          </div>
        ))}
      </div>

      {order.deliveryAddress && (
        <p className="text-xs text-white/40 mb-3 flex items-start gap-1">
          <span>📍</span><span>{order.deliveryAddress}</span>
        </p>
      )}
      {order.notes && (
        <p className="text-xs text-white/40 mb-3">📝 {order.notes}</p>
      )}

      <div className="text-[10px] text-white/20 mb-3">
        {new Date(order.createdAt).toLocaleString("ar-DZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>

      {/* Actions */}
      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="flex gap-2">
          {nextStatus && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => updateStatus(nextStatus)}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-[0_0_12px_rgba(168,85,247,0.4)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (NEXT_LABEL[order.status] ?? "تحديث")}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => updateStatus("cancelled")}
            disabled={loading}
            className="px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-50"
          >
            إلغاء
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

export default function FoodDashboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<"orders" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("active");

  // Settings state
  const [deliveryFee, setDeliveryFee] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [estTime, setEstTime] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const token = getMemToken();

  const fetchData = async () => {
    try {
      const [ordersRes, profileRes] = await Promise.all([
        fetch(`${BASE}/api/food-orders/restaurant`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/restaurants/my/profile`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(Array.isArray(data) ? data : []);
      }
      if (profileRes.ok) {
        const data = await profileRes.json();
        setRestaurant(data);
        setDeliveryFee(data.deliveryFee ?? "0");
        setMinOrder(data.minOrder ?? "0");
        setEstTime(String(data.estimatedDeliveryMinutes ?? 30));
        setIsOpen(data.isOpen ?? true);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${BASE}/api/restaurants/my`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          deliveryFee,
          minOrder,
          estimatedDeliveryMinutes: Number(estTime),
          isOpen,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ تم حفظ الإعدادات" });
      fetchData();
    } catch {
      toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === "active") return !["delivered", "cancelled"].includes(o.status);
    if (filterStatus === "done") return o.status === "delivered";
    if (filterStatus === "cancelled") return o.status === "cancelled";
    return true;
  });

  const activeCount = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center" dir="rtl">
        <ChefHat className="w-16 h-16 text-white/10" />
        <h2 className="text-xl font-black text-white">لا تملك مطعماً</h2>
        <p className="text-white/40 text-sm">سجّل مطعمك أولاً وانتظر الاعتماد</p>
        <button
          onClick={() => navigate("/food/register")}
          className="px-5 py-2.5 rounded-2xl bg-primary text-white font-bold text-sm"
        >
          تسجيل مطعم
        </button>
        {restaurant === null && (
          <button onClick={() => navigate("/food")} className="text-white/30 text-sm mt-2">العودة</button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 px-5 pt-12 pb-0 bg-background/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/food")} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg font-black text-white">{restaurant.name}</h1>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${restaurant.status === "approved" ? "text-green-400" : "text-yellow-400"}`}>
                  {restaurant.status === "approved" ? "✅ معتمد" : "⏳ بانتظار الاعتماد"}
                </span>
                <span className={`text-xs ${isOpen ? "text-green-400" : "text-red-400"}`}>
                  {isOpen ? "• مفتوح" : "• مغلق"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { v: "orders", l: "الطلبات", icon: ShoppingBag },
            { v: "settings", l: "الإعدادات", icon: Settings },
          ].map(({ v, l, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all border-b-2 ${
                tab === v ? "border-primary text-primary" : "border-transparent text-white/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {l}
              {v === "orders" && activeCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
                  {activeCount > 9 ? "9+" : activeCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">

        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div>
            {/* Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
              {[
                { v: "active", l: "جارية" },
                { v: "done", l: "مكتملة" },
                { v: "cancelled", l: "ملغاة" },
                { v: "all", l: "الكل" },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setFilterStatus(v)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    filterStatus === v
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/50 border border-white/10"
                  }`}
                >
                  {l}
                  {v === "active" && activeCount > 0 && ` (${activeCount})`}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Bell className="w-12 h-12 text-white/10" />
                <p className="text-white/40 text-sm">
                  {filterStatus === "active" ? "لا توجد طلبات جارية" : "لا توجد طلبات"}
                </p>
                <p className="text-white/20 text-xs">تحديث تلقائي كل 15 ثانية</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {filteredOrders.map((order) => (
                    <OrderCard key={order.id} order={order} onUpdate={fetchData} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === "settings" && (
          <div className="space-y-4 mt-2">
            {/* فتح / إغلاق المطعم */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">حالة المطعم</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {isOpen ? "المطعم مفتوح ويستقبل طلبات" : "المطعم مغلق ولا يستقبل طلبات"}
                  </p>
                </div>
                <button onClick={() => setIsOpen(!isOpen)}>
                  {isOpen
                    ? <ToggleRight className="w-10 h-10 text-green-400" />
                    : <ToggleLeft className="w-10 h-10 text-white/30" />
                  }
                </button>
              </div>
            </div>

            {/* رسوم التوصيل */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-white font-semibold text-sm">الأسعار</p>
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1.5">رسوم التوصيل (دج)</label>
                <input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50"
                  dir="ltr"
                />
                <p className="text-[11px] text-white/20 mt-1">اكتب 0 لتفعيل التوصيل المجاني</p>
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1.5">الحد الأدنى للطلب (دج)</label>
                <input
                  type="number"
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 block mb-1.5">وقت التوصيل التقديري (دقيقة)</label>
                <input
                  type="number"
                  value={estTime}
                  onChange={(e) => setEstTime(e.target.value)}
                  placeholder="30"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50"
                  dir="ltr"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={saveSettings}
              disabled={savingSettings}
              className="w-full py-3.5 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingSettings
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الحفظ...</>
                : <><Save className="w-4 h-4" /> حفظ الإعدادات</>
              }
            </motion.button>

            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
              <p className="text-xs text-white/40 font-semibold mb-2">معلومات المطعم</p>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">الفئة</span>
                <span className="text-white">{restaurant.category}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">العنوان</span>
                <span className="text-white text-left max-w-[60%]">{restaurant.address}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">حالة الاعتماد</span>
                <span className={restaurant.status === "approved" ? "text-green-400" : "text-yellow-400"}>
                  {restaurant.status === "approved" ? "معتمد ✅" : restaurant.status === "pending" ? "قيد المراجعة ⏳" : "مرفوض ❌"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
