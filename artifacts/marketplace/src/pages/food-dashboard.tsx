import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ChefHat, Clock, CheckCircle2, XCircle, Loader2,
  Settings, PackageCheck, Bike, ShoppingBag, Bell, ToggleLeft, ToggleRight,
  DollarSign, Save, RefreshCw, CreditCard, Crown, Camera, X,
  Banknote, CalendarDays, CheckCircle,
} from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress-image";

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
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
  subscriptionExpiresAt?: string | null;
};

const PLANS = [
  { key: "1month",   label: "شهر واحد",   months: 1,  price: 2000  },
  { key: "6months",  label: "6 أشهر",     months: 6,  price: 5000  },
  { key: "12months", label: "12 شهر",     months: 12, price: 10000 },
];

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
            <span className="text-white font-bold text-sm">طلب #{order.id.slice(0, 8)}</span>
            <span className={`flex items-center gap-1 text-xs font-semibold ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            {order.user?.name ?? "مستخدم"} · {order.user?.phone ?? ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-sm">{Number(order.totalPrice).toFixed(0)} دج</p>
          <p className="text-[11px] text-white/30">{order.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</p>
        </div>
      </div>

      <p className="text-xs text-white/50 mb-2">📍 {order.deliveryAddress}</p>

      {parsedItems.length > 0 && (
        <div className="bg-black/20 rounded-xl p-2.5 mb-3 space-y-1">
          {parsedItems.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-xs text-white/70">
              <span>{item.name} × {item.quantity}</span>
              <span>{(Number(item.price) * item.quantity).toFixed(0)} دج</span>
            </div>
          ))}
        </div>
      )}

      {order.notes && (
        <p className="text-xs text-yellow-300/70 mb-3">💬 {order.notes}</p>
      )}

      <div className="flex gap-2 flex-wrap">
        {nextStatus && (
          <button
            onClick={() => updateStatus(nextStatus)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/20 border border-primary/40 text-primary text-xs font-bold disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {NEXT_LABEL[order.status]}
          </button>
        )}
        {!["delivered", "cancelled"].includes(order.status) && (
          <button
            onClick={() => updateStatus("cancelled")}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold disabled:opacity-50"
          >
            إلغاء
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── تاب الاشتراك ──────────────────────────────────────────────────────────
function SubscriptionTab({ restaurant }: { restaurant: Restaurant }) {
  const { toast } = useToast();
  const token = getMemToken();

  const [selectedPlan, setSelectedPlan] = useState("6months");
  const [payMethod, setPayMethod] = useState<"ccp" | "cash">("ccp");
  const [proofImg, setProofImg]   = useState<string | null>(null);
  const [idImg, setIdImg]         = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [pendingSub, setPendingSub] = useState<any>(null);
  const proofRef = useRef<HTMLInputElement>(null);
  const idRef    = useRef<HTMLInputElement>(null);

  // جلب حالة الاشتراك الحالي
  useEffect(() => {
    const fetchSub = async () => {
      try {
        const res = await fetch(`${BASE}/api/subscriptions/restaurant/${restaurant.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPendingSub(data.latestRequest ?? null);
        }
      } catch {}
    };
    fetchSub();
  }, [restaurant.id, submitted]);

  const pickImage = async (setter: (v: string) => void, ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setter(compressed);
    e.target.value = "";
  };

  const submit = async () => {
    if (payMethod === "ccp" && !proofImg) { toast({ title: "⚠️ الرجاء إرفاق وصل الدفع", variant: "destructive" }); return; }
    if (!idImg) { toast({ title: "⚠️ الرجاء إرفاق صورة الهوية/الوثيقة", variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "restaurant",
          restaurantId: restaurant.id,
          plan: selectedPlan,
          paymentMethod: payMethod,
          paymentProofUrl: proofImg,
          idDocumentUrl: idImg,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "فشل الإرسال");
      toast({ title: "✅ تم إرسال طلب الاشتراك بنجاح! سيتم مراجعته قريباً" });
      setSubmitted(true);
      setProofImg(null);
      setIdImg(null);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const plan = PLANS.find((p) => p.key === selectedPlan) ?? PLANS[1];
  const isSubscribed = restaurant.isSubscribed;
  const expDate = restaurant.subscriptionExpiresAt
    ? new Date(restaurant.subscriptionExpiresAt).toLocaleDateString("ar-DZ")
    : null;
  const isExpired = restaurant.subscriptionExpiresAt
    ? new Date(restaurant.subscriptionExpiresAt) < new Date()
    : false;

  return (
    <div className="space-y-4 mt-2" dir="rtl">

      {/* حالة الاشتراك الحالي */}
      {isSubscribed && !isExpired ? (
        <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/25 p-4 flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-400 shrink-0" />
          <div>
            <p className="text-yellow-300 font-bold text-sm">مشترك ✅</p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              ينتهي الاشتراك: {expDate}
            </p>
          </div>
        </div>
      ) : isSubscribed && isExpired ? (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/25 p-4">
          <p className="text-red-400 font-bold text-sm">انتهى اشتراكك</p>
          <p className="text-red-400/60 text-xs mt-0.5">جدِّد الاشتراك ليستمر مطعمك</p>
        </div>
      ) : null}

      {/* طلب معلّق */}
      {pendingSub && pendingSub.status === "pending" && (
        <div className="rounded-2xl bg-blue-500/10 border border-blue-500/25 p-4">
          <p className="text-blue-400 font-bold text-sm">⏳ طلب اشتراك قيد المراجعة</p>
          <p className="text-blue-400/60 text-xs mt-1">
            الخطة: {PLANS.find(p => p.key === pendingSub.plan)?.label ?? pendingSub.plan} —
            المبلغ: {Number(pendingSub.price).toLocaleString()} دج
          </p>
        </div>
      )}

      {/* باقات الاشتراك */}
      <div>
        <p className="text-white/60 text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-yellow-400" /> اختر الباقة
        </p>
        <div className="space-y-2">
          {PLANS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPlan(p.key)}
              className={`w-full rounded-2xl border p-3.5 text-right transition-all ${
                selectedPlan === p.key
                  ? "bg-primary/15 border-primary text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{p.label}</p>
                  <p className="text-xs opacity-60 mt-0.5">{p.months} شهر اشتراك كامل</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${selectedPlan === p.key ? "text-primary" : ""}`}>
                    {p.price.toLocaleString()}
                  </p>
                  <p className="text-[11px] opacity-50">دج</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* طريقة الدفع */}
      <div>
        <p className="text-white/60 text-xs font-semibold mb-2 flex items-center gap-1.5">
          <CreditCard className="w-3.5 h-3.5" /> طريقة الدفع
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([["ccp", "CCP / تحويل", CreditCard], ["cash", "دفع نقدي", Banknote]] as const).map(([v, l, Icon]) => (
            <button
              key={v}
              onClick={() => setPayMethod(v)}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                payMethod === v
                  ? "bg-primary/15 border-primary text-primary"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              <Icon className="w-4 h-4" /> {l}
            </button>
          ))}
        </div>
      </div>

      {/* رفع الصور */}
      <div className="space-y-3">
        {payMethod === "ccp" && (
          <div>
            <p className="text-white/60 text-xs font-semibold mb-1.5">وصل الدفع (CCP)</p>
            <input ref={proofRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setProofImg)} />
            {proofImg ? (
              <div className="relative">
                <img src={proofImg} alt="وصل" className="w-full rounded-xl max-h-40 object-cover" />
                <button onClick={() => setProofImg(null)} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => pickImage(setProofImg, proofRef)}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 text-xs flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Camera className="w-4 h-4" /> ارفع صورة الوصل
              </button>
            )}
          </div>
        )}

        <div>
          <p className="text-white/60 text-xs font-semibold mb-1.5">
            {payMethod === "ccp" ? "بطاقة الهوية الوطنية" : "وثيقة التسجيل / الهوية"}
          </p>
          <input ref={idRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setIdImg)} />
          {idImg ? (
            <div className="relative">
              <img src={idImg} alt="هوية" className="w-full rounded-xl max-h-40 object-cover" />
              <button onClick={() => setIdImg(null)} className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => pickImage(setIdImg, idRef)}
              className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/40 text-xs flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Camera className="w-4 h-4" /> ارفع صورة الهوية
            </button>
          )}
        </div>
      </div>

      {/* ملخص + زر الإرسال */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs text-white/50">
        <div className="flex justify-between"><span>الباقة</span><span className="text-white">{plan.label}</span></div>
        <div className="flex justify-between"><span>المدة</span><span className="text-white">{plan.months} شهر</span></div>
        <div className="flex justify-between font-bold text-sm"><span className="text-white/70">الإجمالي</span><span className="text-primary">{plan.price.toLocaleString()} دج</span></div>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={submit}
        disabled={submitting || (pendingSub?.status === "pending")}
        className="w-full py-3.5 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
          : pendingSub?.status === "pending"
          ? <><CheckCircle className="w-4 h-4" /> طلبك قيد المراجعة</>
          : <><CreditCard className="w-4 h-4" /> إرسال طلب الاشتراك</>
        }
      </motion.button>

      <p className="text-center text-xs text-white/20">
        سيتم مراجعة طلبك وتفعيل الاشتراك خلال 24 ساعة
      </p>
    </div>
  );
}

// ── الصفحة الرئيسية ────────────────────────────────────────────────────────
export default function FoodDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const token = getMemToken();

  const [tab, setTab] = useState<"orders" | "settings" | "subscription">("orders");
  const [orders, setOrders]         = useState<Order[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null | undefined>(undefined);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState("active");

  const [isOpen, setIsOpen]       = useState(true);
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [minOrder, setMinOrder]   = useState("0");
  const [estTime, setEstTime]     = useState("30");
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchData = async () => {
    try {
      const [ordersRes, profileRes] = await Promise.all([
        fetch(`${BASE}/api/restaurants/my/orders`, { headers: { Authorization: `Bearer ${token}` } }),
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
      } else {
        setRestaurant(null);
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
    if (filterStatus === "active")    return !["delivered", "cancelled"].includes(o.status);
    if (filterStatus === "done")      return o.status === "delivered";
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
        <button onClick={() => navigate("/food")} className="text-white/30 text-sm mt-2">العودة</button>
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
                {restaurant.isSubscribed && (
                  <span className="text-xs text-yellow-400">• <Crown className="w-3 h-3 inline" /></span>
                )}
              </div>
            </div>
          </div>
          <button onClick={fetchData} className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { v: "orders",       l: "الطلبات",    icon: ShoppingBag },
            { v: "settings",     l: "الإعدادات",  icon: Settings },
            { v: "subscription", l: "الاشتراك",   icon: Crown },
          ].map(({ v, l, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v as any)}
              className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-semibold transition-all border-b-2 ${
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
            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
              {[
                { v: "active",    l: "جارية" },
                { v: "done",      l: "مكتملة" },
                { v: "cancelled", l: "ملغاة" },
                { v: "all",       l: "الكل" },
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
                  {l}{v === "active" && activeCount > 0 && ` (${activeCount})`}
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
                <span className="text-white/40">الفئة</span><span className="text-white">{restaurant.category}</span>
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

        {/* ── SUBSCRIPTION TAB ── */}
        {tab === "subscription" && <SubscriptionTab restaurant={restaurant} />}

      </div>
    </div>
  );
}
