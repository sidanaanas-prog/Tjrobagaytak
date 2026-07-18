import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DriverSubscriptionGate } from "@/components/DriverSubscriptionGate";
import { useDriverSubscription } from "@/hooks/use-driver-subscription";
import { TrialCountdownBanner, TrialWelcomePopup } from "@/components/TrialCountdownBanner";
import {
  Car, MapPin, Clock, Star, CheckCircle, XCircle, Phone,
  ChevronLeft, Loader2, Navigation, User, Circle, Flag, AlertTriangle,
  Plus, Trash2, TrendingUp, Shield, Gift, Wallet, CreditCard, Coins,
  LocateFixed, Siren, ChevronRight, RotateCw, Megaphone, Eye, Send, MessageSquare,
} from "lucide-react";

const RideMap = lazy(() => import("@/components/RideMap"));

const BASE = getApiUrl("");

type Ride = {
  id: string;
  status: "pending" | "accepted" | "arrived" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  createdAt: string;
  vehicleType?: string;
  driver?: { id: string; name: string; phone: string | null; avatar: string | null };
  passenger?: { id: string; name: string; phone: string | null; avatar: string | null };
  acceptedAt?: string | null;
  completedAt?: string | null;
  rating?: number;
  driverRating?: number;
  passengerCount?: number;
  conversationId?: string;
  paymentMethod?: string;
  estimatedPrice?: string;
  actualPrice?: string;
  driverLat?: number | null;
  driverLng?: number | null;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
};

function getRole(): string | null { return localStorage.getItem("gaytak_active_role"); }
const vehicleConfig: Record<string, { label: string }> = { car: { label: "عادي" }, ac: { label: "مكيف" }, suv: { label: "دفع رباعي" }, van: { label: "حافلة" }, truck: { label: "شحن" } };
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "قيد البحث", color: "text-yellow-400", icon: Clock },
  accepted: { label: "تم القبول", color: "text-blue-400", icon: CheckCircle },
  arrived: { label: "وصل", color: "text-blue-400", icon: Navigation },
  picked_up: { label: "في الرحلة", color: "text-primary", icon: Car },
  completed: { label: "منتهية", color: "text-green-400", icon: CheckCircle },
  cancelled: { label: "ملغاة", color: "text-red-400", icon: XCircle },
};

// ── الراكب: طلب كورسا ──────────────────────────────────────────────────────
function PassengerRequest() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [vehicleType, setVehicleType] = useState("car");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [countdownTrigger, setCountdownTrigger] = useState(0);
  // معرّف الرحلة المرسلة مؤخراً — يمنع العداد من الاختفاء قبل تحديث قائمة رحلاتي
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);
  const [ridesLoadedOnce, setRidesLoadedOnce] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<{ distance: number; estimatedPrice: number; estimatedMinutes: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [newlyAcceptedRide, setNewlyAcceptedRide] = useState<Ride | null>(null);
  const prevMyRidesRef = useRef<Ride[]>([]);
  const [, navigate] = useLocation();
  const [destinations, setDestinations] = useState<{ id: string; name: string; price: string }[]>([]); // الوجهات المحددة مسبقاً من الإدارة
  const [pricingMode, setPricingMode] = useState("flexible");
  const [commissionType, setCommissionType] = useState("percentage");
  const [commissionValue, setCommissionValue] = useState("10");
  const [loading, setLoading] = useState(true);
  const [pendingCountdown, setPendingCountdown] = useState<number | null>(null);
  const [showPriceTip, setShowPriceTip] = useState(false);

  // جلب الوجهات المعتمدة والإعدادات من الإدارة
  useEffect(() => {
    const token = getMemToken();
    if (token) {
      // Fetch destinations
      fetch(`${BASE}/api/rides/destinations`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setDestinations(data);
        })
        .catch((err) => console.error("[Destinations] Error fetching:", err));

      // Fetch public settings
      fetch(`${BASE}/api/rides/settings`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const pMode = data.find((s: any) => s.key === "pricing_mode");
            if (pMode) setPricingMode(pMode.value);

            const commType = data.find((s: any) => s.key === "commission_type");
            if (commType) setCommissionType(commType.value);

            const commVal = data.find((s: any) => s.key === "commission_value") || data.find((s: any) => s.key === "commission_rate");
            if (commVal) setCommissionValue(commVal.value);
          }
        })
        .catch((err) => console.error("[Settings] Error fetching:", err));
    }
  }, []);

  const fetchMyRides = useCallback(async () => {
    const token = getMemToken(); if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/my?_t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      // إذا فشل الطلب (401/500) — لا تُحدِّث الحالة، أبق الـ spinner للمحاولة التالية
      if (!res.ok) return;
      const data = await res.json();
      const fresh: Ride[] = Array.isArray(data) ? data : [];
      // كشف انتقال pending → accepted لعرض popup القبول
      const justAccepted = fresh.find((r) =>
        r.status === "accepted" &&
        prevMyRidesRef.current.some((p) => p.id === r.id && p.status === "pending"),
      );
      if (justAccepted) setNewlyAcceptedRide(justAccepted);
      prevMyRidesRef.current = fresh;
      setMyRides(fresh);
      setRidesLoadedOnce(true);
      setLoading(false); // أخفِ الـ spinner فقط عند النجاح
    } catch { setLoading(false); }
  }, []);

  const SEARCH_DURATION = 30;
  const pendingRide = myRides.find((r) => r.status === "pending");

  // الرحلة المُرسلة — نتحقق من حالتها في القائمة
  const submittedRide = justSubmittedId ? myRides.find((r) => r.id === justSubmittedId) : null;

  // البحث جارٍ إذا:
  //  - الرحلة لا تزال "pending" في القائمة، أو
  //  - الرحلة لم تظهر بعد (لم يُحمَّل الـ list بعد)
  // يتوقف فور أن تُحمَّل القائمة وتكون الرحلة غير pending (accepted/cancelled)
  const isStillSearching = !!justSubmittedId && (
    !ridesLoadedOnce ||                     // لم يُحمَّل الـ list بعد (أول مرة)
    submittedRide?.status === "pending"     // محُمِّل + الرحلة لا تزال pending
    // إذا ridesLoadedOnce=true والرحلة غير موجودة/accepted/cancelled → false تلقائياً
  );

  // activeSearchId: معرّف الرحلة قيد البحث — يصبح null فور قبولها
  const activeSearchId = pendingRide?.id ?? (isStillSearching ? justSubmittedId : null);

  // العد التنازلي — يعتمد على activeSearchId الذي يصبح null عند القبول
  useEffect(() => {
    if (!activeSearchId) { setPendingCountdown(null); setShowPriceTip(false); return; }
    setPendingCountdown(SEARCH_DURATION); setShowPriceTip(false);
    const iv = setInterval(() => {
      setPendingCountdown((c) => {
        if (c === null || c <= 1) { setShowPriceTip(true); return null; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [activeSearchId, countdownTrigger]);

  // polling: 2 ثانية أثناء البحث، 5 ثوانٍ في الحالة العادية
  useEffect(() => {
    fetchMyRides();
    const iv = setInterval(fetchMyRides, activeSearchId ? 2000 : 5000);
    return () => clearInterval(iv);
  }, [fetchMyRides, activeSearchId]);

  // نظّف justSubmittedId حين تُقبل الرحلة أو تُلغى
  useEffect(() => {
    if (!justSubmittedId) return;
    const found = myRides.find((r) => r.id === justSubmittedId);
    if (found && found.status !== "pending") setJustSubmittedId(null);
  }, [myRides, justSubmittedId]);

  // استمع لإشعار Firebase "ride_accepted" → جلب فوري بدون انتظار الـ polling
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === "ride_accepted") fetchMyRides();
    };
    window.addEventListener("ride_notification", handler);
    return () => window.removeEventListener("ride_notification", handler);
  }, [fetchMyRides]);

  // تقدير السعر التلقائي
  async function estimatePrice() {
    if (!fromLat || !fromLng || !toLat || !toLng) {
      toast({ title: "يجب تحديد الموقع بدقة", variant: "destructive" });
      return;
    }
    setIsEstimating(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromLat, fromLng, toLat, toLng, vehicleType }),
      });
      const data = await res.json();
      if (res.ok) { setEstimate(data); setPrice(String(data.estimatedPrice)); }
      else toast({ title: "خطأ", description: data.error, variant: "destructive" });
    } catch { toast({ title: "خطأ", description: "تعذر الاتصال", variant: "destructive" }); }
    setIsEstimating(false);
  }

  // GPS حديد الموقع
  function useGpsLocation(setter: "from" | "to") {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (setter === "from") { setFromLat(lat); setFromLng(lng); setFromAddress(`الموقع الحالي (${lat.toFixed(4)}, ${lng.toFixed(4)})`); }
        else { setToLat(lat); setToLng(lng); setToAddress(`الموقع الحالي (${lat.toFixed(4)}, ${lng.toFixed(4)})`); }
        setGpsLoading(false);
      },
      () => { toast({ title: "GPS غير متاح", description: "تأكد من تفعيل GPS", variant: "destructive" }); setGpsLoading(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  const handleSubmit = async () => {
    if (!fromAddress || !toAddress || !price) {
      toast({ title: "المرجو", description: "املأ المكان والسعر", variant: "destructive" }); return;
    }

    const basePrice = Number(price);
    let comm = 0;
    const commValNum = Number(commissionValue || 0);
    if (commissionType === "fixed") {
      comm = commValNum;
    } else {
      comm = Math.round(basePrice * (commValNum / 100));
    }
    const totalPrice = basePrice + comm;

    // ✅ إصلاح 2: تحقق من رصيد المحفظة قبل الإرسال
    if (paymentMethod === "wallet") {
      const balance = Number(user?.walletBalance ?? 0);
      if (balance < totalPrice) {
        toast({
          variant: "destructive",
          title: "رصيد غير كافٍ",
          description: `رصيدك ${balance.toLocaleString("ar-DZ")} دج والكورسة شاملة الرسوم ${totalPrice.toLocaleString("ar-DZ")} دج. اشحن المحفظة أو اختر الدفع نقداً`,
        });
        return;
      }
    }
    setSubmitting(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAddress, toAddress, price: totalPrice,
          passengerCount: Number(passengerCount) || 1, vehicleType, notes,
          paymentMethod, estimatedPrice: estimate?.estimatedPrice,
          fromLat, fromLng, toLat, toLng,
        }),
      });
      const data = await res.json();
      if (data.id) {
        toast({ title: "✅ تم الطلب!", description: "جاري البحث عن سائق..." });
        setJustSubmittedId(data.id); // يُطلق العداد فوراً
        fetchMyRides();
      } else toast({ title: "خطأ", description: data.error, variant: "destructive" });
    } catch { toast({ title: "خطأ", description: "تعذر الاتصال", variant: "destructive" }); }
    setSubmitting(false);
  };

  const handleCancel = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/cancel`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchMyRides();
  };

  const handleChangePrice = async (id: string) => {
    if (!newPrice || Number(newPrice) <= 0) { toast({ title: "سعر غير صالح" }); return; }
    const token = getMemToken();
    const res = await fetch(`${BASE}/api/rides/${id}/price`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ price: Number(newPrice) }),
    });
    if (res.ok) { setEditingPrice(null); setNewPrice(""); setCountdownTrigger(Date.now()); toast({ title: "✅ تم تحديث السعر" }); }
    fetchMyRides();
  };

  const handleRate = async (id: string, stars: number) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/rate`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: stars }),
    });
    fetchMyRides();
  };

  return (
    <div className="space-y-5 pb-4">
      {/* بطاقة الراكب */}
      <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-primary/70 font-medium">المحفظة</p>
              <p className="text-lg font-black text-primary">
                {user?.walletBalance ? Number(user.walletBalance).toLocaleString("ar-DZ") : "0"} <span className="text-[10px] font-bold">ألف دورو</span>
              </p>
            </div>
            <div className="border-r border-primary/20" />
            <div>
              <p className="text-xs text-yellow-500/70 font-medium">نقاط المكافآت 🎁</p>
              <p className="text-lg font-black text-yellow-500 flex items-center gap-1">
                {user?.points ? Number(user.points).toLocaleString("ar-DZ") : "0"} <span className="text-[10px] font-bold">نقطة</span>
              </p>
            </div>
          </div>
          <button onClick={() => navigate("/wallet")} className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
            <Wallet className="w-4 h-4" /> المحفظة
          </button>
        </div>
      </div>

      {/* فورم الطلب */}
      <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><Car className="w-4 h-4 text-primary" /></div>
            احجز كورسا
          </h3>
          <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">حجوزات سريعة</span>
        </div>

        {/* وجهات سريعة معتمدة من الإدارة */}
        {destinations.length > 0 && (
          <div className="space-y-2 bg-primary/5 p-3 rounded-xl border border-primary/10">
            <p className="text-[11px] text-muted-foreground font-bold flex items-center gap-1.5">📍 وجهات سريعة معتمدة من الإدارة بأسعار ثابتة:</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {destinations.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setFromAddress("موقعي الحالي");
                    setToAddress(d.name);
                    setPrice(String(d.price));
                    toast({ title: `📍 تم تحديد الوجهة: ${d.name}`, description: `السعر المعتمد: ${d.price} ألف دورو` });
                  }}
                  className="flex-shrink-0 bg-background hover:bg-primary/10 border border-border hover:border-primary px-3 py-2 rounded-xl text-xs font-bold text-foreground transition-all flex items-center gap-2"
                >
                  <span className="text-primary">{d.name}</span>
                  <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-md text-[10px] font-black">{d.price} ألف دورو</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* المسار */}
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => useGpsLocation("from")} disabled={gpsLoading} className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center hover:bg-green-500/30">
                {gpsLoading ? <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-green-400" />}
              </button>
            </div>
            <input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="الانطلاق من..." className="w-full bg-background border border-green-500/30 rounded-xl pr-12 pl-3 py-3 text-sm focus:outline-none focus:border-green-400" />
          </div>
          <div className="flex items-center gap-2 pr-5">
            <div className="w-0.5 h-6 bg-gradient-to-b from-green-400/50 to-red-400/50 rounded-full" />
            <span className="text-[10px] text-muted-foreground">المسار</span>
          </div>
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <button onClick={() => useGpsLocation("to")} disabled={gpsLoading} className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30">
                {gpsLoading ? <Loader2 className="w-3.5 h-3.5 text-red-400 animate-spin" /> : <MapPin className="w-3.5 h-3.5 text-red-400" />}
              </button>
            </div>
            <input value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder="الوصول إلى..." className="w-full bg-background border border-red-500/30 rounded-xl pr-12 pl-3 py-3 text-sm focus:outline-none focus:border-red-400" />
          </div>
        </div>

        {/* زر تقدير السعر التلقائي */}
        <button
          onClick={estimatePrice}
          disabled={isEstimating || !fromLat || !fromLng}
          className="w-full bg-blue-500/15 border border-blue-500/25 text-blue-400 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
        >
          {isEstimating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCw className="w-4 h-4" /> حساب السعر التلقائي</>}
        </button>

        {/* التقدير */}
        {estimate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">المسافة</span>
              <span className="text-sm font-bold">{estimate.distance} كم</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">الوقت التقريبي</span>
              <span className="text-sm font-bold">{estimate.estimatedMinutes} دقيقة</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">السعر التقديري</span>
              <span className="text-sm font-black text-primary">{estimate.estimatedPrice.toLocaleString("ar-DZ")} ألف دورو</span>
            </div>
          </motion.div>
        )}

        {/* السعر */}
        <div className="space-y-2">
          <label className="text-[10px] text-muted-foreground font-bold">تسعير الكورسة (ألف دورو)</label>
          <div className="relative">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="أدخل السعر المقترح (ألف دورو)"
              className="w-full bg-background border border-yellow-500/30 rounded-xl px-4 py-3 text-sm font-bold text-yellow-400 placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:border-yellow-400"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-400">ألف دورو</span>
          </div>
        </div>

        {/* طريقة الدفع */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">طريقة الدفع</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPaymentMethod("cash")} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${paymentMethod === "cash" ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400" : "bg-background border-border text-muted-foreground"}`}>
              <Coins className="w-4 h-4" /> نقدي
            </button>
            <button onClick={() => setPaymentMethod("wallet")} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${paymentMethod === "wallet" ? "bg-primary/15 border-primary/30 text-primary" : "bg-background border-border text-muted-foreground"}`}>
              <Wallet className="w-4 h-4" /> محفظة
            </button>
          </div>
        </div>

        {/* بقية معلومات الراكب */}
        {user?.noShowCount && user.noShowCount > 0 && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-bold">تبليغات الغياب: {user.noShowCount}/3</span>
            </div>
            {user.rideBannedUntil && new Date(user.rideBannedUntil) > new Date() && (
              <p className="text-[10px] text-red-400/70 mt-1">محظور من الطلب حتى {new Date(user.rideBannedUntil).toLocaleDateString("ar-DZ")}</p>
            )}
          </div>
        )}

        {/* نوع السيارة + الركاب + ملاحظات */}
        <div className="grid grid-cols-5 gap-2">
          {([{ key: "car", label: "🚗", desc: "عادي" }, { key: "ac", label: "❄️", desc: "مكيف" }, { key: "suv", label: "🚙", desc: "دفع رباعي" }, { key: "van", label: "🚐", desc: "حافلة" }, { key: "truck", label: "🚚", desc: "شحن" }] as const).map((v) => (
            <button key={v.key} onClick={() => setVehicleType(v.key)} className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-bold transition-all ${vehicleType === v.key ? "bg-primary/20 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>
              <span className="text-lg">{v.label}</span><span>{v.desc}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" min={1} max={10} value={passengerCount} onChange={(e) => setPassengerCount(e.target.value)} placeholder="الركاب" className="w-full bg-background border border-blue-500/30 rounded-xl px-4 py-3 text-sm font-bold text-blue-400" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="w-full bg-background border rounded-xl px-4 py-3 text-sm" />
        </div>

        {/* زر الإرسال */}
        <button onClick={handleSubmit} disabled={submitting} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98]">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Car className="w-5 h-5" /><span>اطلب الآن — السائق يرد عليك!</span></>}
        </button>
      </div>

      {/* ✅ إصلاح 1: بانر "قُبلت كورستك!" — يظهر فوراً عند قبول سائق */}
      <AnimatePresence>
        {newlyAcceptedRide && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setNewlyAcceptedRide(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              className="bg-card border-2 border-green-500/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-green-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-xl font-black text-green-400">✅ قُبلت كورستك!</h2>
                <p className="text-sm text-muted-foreground">السائق في طريقه إليك</p>
                {newlyAcceptedRide.driver && (
                  <div className="bg-muted/50 rounded-xl p-3 text-right space-y-1.5">
                    <p className="text-sm font-bold flex items-center gap-2"><User className="w-4 h-4 text-primary" />{newlyAcceptedRide.driver.name}</p>
                    {newlyAcceptedRide.driver.phone && (
                      <a href={`tel:${newlyAcceptedRide.driver.phone}`} className="flex items-center gap-2 text-green-400 font-bold text-sm hover:underline">
                        <Phone className="w-4 h-4" /> {newlyAcceptedRide.driver.phone}
                      </a>
                    )}
                  </div>
                )}
                <button onClick={() => setNewlyAcceptedRide(null)} className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-sm">
                  حسناً، شكراً!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* بانر البحث — يظهر طالما activeSearchId موجود، يختفي فور القبول */}
      {activeSearchId && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold">جاري البحث عن سائق قريب...</span>
          </div>
          {pendingCountdown !== null && (
            <>
              <div className="text-3xl font-mono font-black text-primary">
                {String(pendingCountdown).padStart(2, "0")} ث
              </div>
              <div className="w-full bg-primary/10 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(pendingCountdown / SEARCH_DURATION) * 100}%` }} />
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* رحلاتي */}
      <div>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> رحلاتي</h3>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> :
          myRides.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">ليس لديك رحلات بعد</p> : (
          <div className="space-y-3">
            {myRides.map((r) => {
              const s = statusConfig[r.status] ?? statusConfig.pending;
              const Icon = s.icon;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.color} bg-primary/10`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{r.price} ألف دورو</span>
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full">{r.passengerCount ?? 1} راكب</span>
                          {r.paymentMethod === "wallet" && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Wallet className="w-2.5 h-2.5" /> محفظة</span>}
                        </div>
                      </div>
                      <p className="text-sm mt-1"><span className="text-green-400">{r.fromAddress}</span> → <span className="text-red-400">{r.toAddress}</span></p>
                      {r.driver && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" /> {r.driver.name}
                          {r.vehicleType && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">{vehicleConfig[r.vehicleType]?.label ?? r.vehicleType}</span>}
                          {r.driver.phone && <a href={`tel:${r.driver.phone}`} className="text-primary flex items-center gap-0.5"><Phone className="w-3 h-3" /> اتصل</a>}
                        </div>
                      )}
                      {/* عرض رمز التأكيد المكون من 4 أرقام للراكب */}
                      {["accepted", "arrived", "picked_up"].includes(r.status) && r.completionCode && (
                        <div className="mt-2.5 bg-primary/10 border border-primary/20 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold">🎁 كود تأكيد الرحلة للسائق:</p>
                          <p className="text-base font-black text-primary tracking-widest mt-0.5 bg-primary/20 inline-block px-3 py-1 rounded-lg border border-primary/30">
                            {r.completionCode}
                          </p>
                          <p className="text-[9px] text-primary/70 mt-1">أعطِ هذا الرمز للسائق عند الوصول ليتمكن من إنهاء الرحلة وتحصل على نقاط مكافآت!</p>
                        </div>
                      )}
                      {/* معلومات السائق المباشرة */}
                      {r.status === "accepted" && r.driverLat && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <LocateFixed className="w-3 h-3 text-green-400" /> موقع السائق متاح</p>
                      )}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <div className="space-y-2">
                      {pendingCountdown !== null && r.id === activeSearchId && (
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 text-center">
                          <div className="flex items-center justify-center gap-2 text-primary"><Clock className="w-4 h-4 animate-pulse" /><span className="text-sm font-bold">جاري البحث...</span></div>
                          <div className="text-2xl font-mono font-bold text-primary mt-1">
                            {String(pendingCountdown).padStart(2, "0")} ث
                          </div>
                          <div className="w-full bg-primary/10 rounded-full h-1.5 mt-2">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(pendingCountdown / SEARCH_DURATION) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {showPriceTip && r.id === activeSearchId && (
                        <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-yellow-400"><TrendingUp className="w-4 h-4" /><span className="text-sm font-bold">لم يتم إيجاد سائق — أعد المحاولة أو زِد السعر</span></div>
                          {editingPrice === r.id ? (
                            <div className="flex gap-2">
                              <input type="number" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="السعر الجديد" className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm text-foreground" />
                              <button onClick={() => handleChangePrice(r.id)} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold">تحديث</button>
                              <button onClick={() => { setEditingPrice(null); setNewPrice(""); }} className="border border-border px-3 py-2 rounded-lg text-sm text-muted-foreground">إلغاء</button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => setCountdownTrigger(Date.now())} className="flex-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary py-2 rounded-lg text-sm font-bold transition-colors">🔄 أعد البحث</button>
                              <button onClick={() => { setEditingPrice(r.id); setNewPrice(r.price); }} className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 py-2 rounded-lg text-sm font-bold transition-colors"><TrendingUp className="w-4 h-4 inline mr-1" /> زِد السعر</button>
                            </div>
                          )}
                        </div>
                      )}
                      {/* ✅ إصلاح 1: زر الإلغاء دائماً مرئي */}
                      <button onClick={() => handleCancel(r.id)} className="w-full text-xs text-red-400 py-2 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5" /> إلغاء الطلب</button>
                    </div>
                  )}
                  {/* ✅ إصلاح 1: إلغاء متاح حتى بعد قبول السائق */}
                  {r.status === "accepted" && (
                    <div className="mt-2">
                      <button onClick={() => handleCancel(r.id)} className="w-full text-xs text-red-400 py-1.5 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> إلغاء الرحلة</button>
                    </div>
                  )}
                  {/* خريطة تتبع السائق — للراكب */}
                  {(r.status === "accepted" || r.status === "arrived" || r.status === "picked_up") && (
                    <div className="mt-2">
                      <Suspense fallback={<div className="h-[240px] rounded-xl bg-muted flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                        <RideMap
                          rideId={r.id}
                          fromLat={r.fromLat}
                          fromLng={r.fromLng}
                          toLat={r.toLat}
                          toLng={r.toLng}
                          fromAddress={r.fromAddress}
                          toAddress={r.toAddress}
                          initialDriverLat={r.driverLat}
                          initialDriverLng={r.driverLng}
                          isDriver={false}
                        />
                      </Suspense>
                    </div>
                  )}
                  {/* زر SOS */}
                  {r.status === "picked_up" && (
                    <button className="w-full mt-2 bg-red-500/15 border border-red-500/25 text-red-400 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                      <Siren className="w-4 h-4" /> زر SOS — إبلاغ طارئ
                    </button>
                  )}
                  {r.status === "completed" && !r.driverRating && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs text-muted-foreground">تقييم:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => handleRate(r.id, star)} className="text-yellow-400 hover:scale-110 transition-transform"><Star className={`w-4 h-4 ${star <= (r.driverRating ?? 0) ? "fill-yellow-400" : ""}`} /></button>
                      ))}
                    </div>
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

// ── السائق: لوحة السائق ──────────────────────────────────────────────────────
function DriverDashboard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { status: subStatus } = useDriverSubscription();
  const [_, setLocation] = useLocation();
  const [completionCodes, setCompletionCodes] = useState<Record<string, string>>({}); // رموز التأكيد المدخلة من السائق لإنهاء الرحلات
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const driverTrialDays = subStatus?.trialExpiresAt ? Math.max(0, Math.ceil((new Date(subStatus.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const isDriverTrialActive = driverTrialDays !== null && driverTrialDays > 0;

  const fetchRequests = useCallback(async () => {
    const token = getMemToken(); if (!token) return;
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        fetch(`${BASE}/api/rides/driver?status=pending`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/rides/driver?status=accepted`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pending = await pendingRes.json();
      const accepted = await acceptedRes.json();
      setRequests([...(Array.isArray(pending) ? pending : []), ...(Array.isArray(accepted) ? accepted : [])]);
    } catch {}
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    const token = getMemToken(); if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/driver/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) { setProfile(data); setOnline(data.isOnline); }
    } catch {}
  }, []);

  useEffect(() => { fetchRequests(); fetchProfile(); const iv = setInterval(fetchRequests, 5000); return () => clearInterval(iv); }, [fetchRequests, fetchProfile]);

  const toggleOnline = async () => {
    const token = getMemToken();
    const newState = !online;
    setOnline(newState);
    await fetch(`${BASE}/api/driver/location`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isAvailable: newState }),
    });
    toast({ title: newState ? "✅ متصل" : "⏸️ غير متصل", description: newState ? "أنت الآن متاح للطلبات" : "لن تتلقى طلبات جديدة" });
  };

  const handleAccept = async (id: string): Promise<boolean> => {
    if (acceptingId) return false;
    setAcceptingId(id);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides/${id}/accept`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      fetchRequests();
      // ✅ إصلاح 4: لا redirect للدردشة — رقم الراكب يظهر مباشرة في البطاقة
      if (!res.ok || !data.success) {
        toast({ variant: "destructive", title: "تعذر القبول", description: "قُبلت الكورسة من سائق آخر" });
      }
      return res.ok && data.success;
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل الاتصال بالخادم" });
      return false;
    } finally {
      setAcceptingId(null);
    }
  };

  const handlePickup = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/pickup`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  const handleComplete = async (id: string, code: string) => {
    if (!code || code.trim().length !== 4) {
      toast({ variant: "destructive", title: "⚠️ كود غير صالح", description: "الرجاء إدخال كود التأكيد المكون من 4 أرقام المستلم من الراكب." });
      return;
    }
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides/${id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "🎉 تم إنهاء الرحلة بنجاح!",
          description: data.commissionDeducted > 0
            ? `تم خصم عمولة التطبيق بقيمة ${data.commissionDeducted} ألف دورو.`
            : `الرحلة معفية من العمولة!`,
        });
        fetchRequests();
        fetchProfile();
      } else {
        toast({ variant: "destructive", title: "❌ خطأ في إنهاء الرحلة", description: data.error || "كود التأكيد خاطئ، يرجى مراجعة الراكب." });
      }
    } catch {
      toast({ variant: "destructive", title: "❌ خطأ", description: "تعذر الاتصال بالخادم." });
    }
  };

  const handleCancel = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/cancel`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  const handleNoShow = async (id: string) => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/rides/${id}/no-show`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        toast({ title: "⚠️ تم التبليغ", description: `الراكب لم يأتِ. عدد تبليغاته: ${data.noShowCount}/3` });
      } else {
        toast({ variant: "destructive", title: "تعذر التبليغ", description: data.error ?? "حاول مجدداً" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
    }
    fetchRequests();
  };


  return (
    <div className="space-y-6 pb-4">
      {/* وضع السائق */}
      <div className="bg-card border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${online ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}><Car className="w-6 h-6" /></div>
            <div>
              <p className="font-bold text-sm">{online ? "متاح للطلبات" : "غير متاح"}</p>
              <p className="text-xs text-muted-foreground">{online ? "الطلبات قريبة منك" : "اضغط لتبدأ"}</p>
            </div>
          </div>
          <button onClick={toggleOnline} className={`w-14 h-8 rounded-full transition-colors relative ${online ? "bg-green-500" : "bg-muted"}`}>
            <div className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all ${online ? "left-7" : "left-1"}`} />
          </button>
        </div>

        {profile && (
          <>


            {isDriverTrialActive ? (
              <div className="mb-4 rounded-xl p-3 border bg-amber-500/8 border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-400"><Gift className="w-4 h-4" /></div>
                    <div>
                      <p className="text-xs font-bold text-white">🎉 تجربة مجانية 7 أيام</p>
                      <p className="text-[10px] text-white/50">متبقى {driverTrialDays} أيام</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold animate-pulse">{driverTrialDays} أيام</span>
                </div>
              </div>
            ) : subStatus?.isFree ? (
              <div className="mb-4 rounded-xl p-3 border bg-green-500/8 border-green-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/15 text-green-400"><CheckCircle className="w-4 h-4" /></div>
                    <div><p className="text-xs font-bold text-white">اشتراك نشط</p><p className="text-[10px] text-white/50">حسابك مجاني</p></div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-bold">نشط</span>
                </div>
              </div>
            ) : subStatus?.isSubscribed ? (
              <div className="mb-4 rounded-xl p-3 border bg-primary/8 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15 text-primary"><Clock className="w-4 h-4" /></div>
                    <div><p className="text-xs font-bold text-white">اشتراك مدفوع</p><p className="text-[10px] text-white/50">{subStatus?.expiresAt ? `ينتهي ${new Date(subStatus.expiresAt).toLocaleDateString('ar-DZ')}` : 'نشط'}</p></div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">مدفوع</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl p-3 border bg-red-500/8 border-red-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 text-red-400"><Clock className="w-4 h-4" /></div>
                    <div><p className="text-xs font-bold text-white">التجربة انتهت</p><p className="text-[10px] text-white/50">اشترك الآن</p></div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-bold">منتهي</span>
                </div>
              </div>
            )}

            <div className={`mb-4 rounded-xl p-3 border ${profile.documentsStatus === "verified" ? "bg-green-500/8 border-green-500/20" : profile.documentsStatus === "pending" ? "bg-yellow-500/8 border-yellow-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${profile.documentsStatus === "verified" ? "bg-green-500/15 text-green-400" : profile.documentsStatus === "pending" ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"}`}><Shield className="w-4 h-4" /></div>
                  <div><p className="text-xs font-bold text-white">الوثائق</p><p className="text-[10px] text-white/50">{profile.documentsStatus === "verified" ? "✅ تم التأكيد" : profile.documentsStatus === "pending" ? "قيد المراجعة" : "لم تُرفع"}</p></div>
                </div>
                {profile.documentsStatus === "verified" ? <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-bold">متأكد</span> : profile.documentsStatus === "pending" ? <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-bold">قيد المراجعة</span> : <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-bold">لم تُرفع</span>}
              </div>
            </div>



            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-primary/10 rounded-xl p-2"><p className="text-lg font-bold text-primary">{profile.totalRides}</p><p className="text-[10px] text-muted-foreground">رحلات</p></div>
              <div className="bg-primary/10 rounded-xl p-2 cursor-pointer hover:bg-primary/15 transition-all border border-transparent hover:border-primary/20" onClick={() => setLocation("/wallet")}>
                <p className="text-lg font-bold text-primary">
                  {profile.walletBalance ? Number(profile.walletBalance).toLocaleString("ar-DZ") : "0"}
                </p>
                <p className="text-[10px] text-muted-foreground">الرصيد (دورو)</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-2"><p className="text-lg font-bold text-primary">{profile.avgRating}</p><p className="text-[10px] text-muted-foreground">تقييم</p></div>
            </div>
          </>
        )}
      </div>

      {/* الطلبات */}
      <div>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> طلبات قريبة</h3>
        {!online ? <p className="text-center text-sm text-muted-foreground py-8">اضغط زر التصل لرؤية الطلبات</p> :
          loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> :
          requests.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات حالياً</p> : (
          <div className="space-y-3">
            {requests.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{r.passenger?.name ?? "راكب"}</p>
                      {/* ✅ إصلاح 5: نوع السيارة في طلب السائق */}
                      {r.vehicleType && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">{r.vehicleType === "car" ? "🚗 عادي" : r.vehicleType === "ac" ? "❄️ مكيف" : r.vehicleType === "suv" ? "🚙 دفع رباعي" : r.vehicleType === "van" ? "🚐 حافلة" : r.vehicleType === "truck" ? "🚚 شحن" : r.vehicleType}</span>}
                      {r.passengerCount && r.passengerCount > 1 && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full">{r.passengerCount} ركاب</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5"><span className="text-green-400">{r.fromAddress}</span> → <span className="text-red-400">{r.toAddress}</span></p>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded-md font-black">
                          المبلغ المطلوب من الراكب: {r.price} ألف دورو
                        </span>
                        {r.paymentMethod === "wallet" && <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold"><Wallet className="w-2.5 h-2.5" /> محفظة</span>}
                      </div>
                      
                      {/* عرض العمولة والربح الصافي للشفافية المطلقة */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/15 px-1.5 py-0.5 rounded-md font-bold">
                          عمولة التطبيق: -{r.commission !== undefined ? r.commission : Math.round(Number(r.price) * 0.1)} ألف دورو
                        </span>
                        <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/15 px-1.5 py-0.5 rounded-md font-bold">
                          ربح السائق الصافي: +{r.netProfit !== undefined ? r.netProfit : Math.round(Number(r.price) * 0.9)} ألف دورو
                        </span>
                      </div>
                    </div>
                    {/* ✅ إصلاح 4: رقم الراكب بارز جداً بعد القبول */}
                    {r.status === "accepted" && r.passenger?.phone && (
                      <a href={`tel:${r.passenger.phone}`} className="mt-2 flex items-center gap-2 bg-green-500/15 border border-green-500/25 text-green-400 px-3 py-2 rounded-lg hover:bg-green-500/25 transition-colors w-full">
                        <Phone className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="text-[10px] font-medium opacity-70">اتصل بالراكب</p>
                          <p className="text-sm font-bold">{r.passenger.phone}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {r.status === "pending" ? (
                    <>
                      <button 
                        onClick={() => handleAccept(r.id)} 
                        disabled={acceptingId !== null} 
                        className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {acceptingId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                        قبول
                      </button>
                      <button onClick={() => handleCancel(r.id)} className="px-3 py-2 border rounded-lg text-xs text-red-400 hover:bg-red-400/10"><XCircle className="w-3 h-3" /></button>
                    </>
                  ) : r.status === "accepted" ? (
                    <>
                      <button onClick={() => handlePickup(r.id)} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Navigation className="w-3 h-3" /> استلام الراكب</button>
                      <button onClick={() => handleNoShow(r.id)} className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-center gap-1 hover:bg-red-500/20"><AlertTriangle className="w-3 h-3" /> لم يأتِ</button>
                    </>
                  ) : r.status === "picked_up" ? (
                    <div className="w-full space-y-2 mt-1">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={4}
                          pattern="\d*"
                          placeholder="كود إنهاء الرحلة (4 أرقام)"
                          value={completionCodes[r.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setCompletionCodes(prev => ({ ...prev, [r.id]: val }));
                          }}
                          className="flex-1 bg-background text-foreground border border-green-500/30 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-green-400 text-center tracking-widest placeholder:tracking-normal"
                        />
                        <button
                          onClick={() => handleComplete(r.id, completionCodes[r.id] ?? "")}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> إنهاء الكورسة
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground text-right font-medium">اطلب كود الأمان المكون من 4 أرقام من الراكب لإنهاء الرحلة بنجاح.</p>
                    </div>
                  ) : null}
                </div>
                {/* خريطة تتبع موقع الراكب — للسائق (تُرسل موقعه تلقائياً) */}
                {(r.status === "accepted" || r.status === "picked_up") && (
                  <div className="mt-3">
                    <Suspense fallback={<div className="h-[240px] rounded-xl bg-muted flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                      <RideMap
                        rideId={r.id}
                        fromLat={r.fromLat}
                        fromLng={r.fromLng}
                        toLat={r.toLat}
                        toLng={r.toLng}
                        fromAddress={r.fromAddress}
                        toAddress={r.toAddress}
                        isDriver={true}
                      />
                    </Suspense>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── الأدمن: لوحة التحكم في الكورسا ───────────────────────────────────────────
function AdminRidesDashboard() {
  const { toast } = useToast();
  const [destinations, setDestinations] = useState<any[]>([]);
  const [destName, setDestName] = useState("");
  const [destPrice, setDestPrice] = useState("");
  
  // Drivers verification / subscription states
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Commission & Pricing settings states
  const [commissionRate, setCommissionRate] = useState("10");
  const [pricingMode, setPricingMode] = useState("flexible"); // "fixed" | "flexible"
  const [commissionType, setCommissionType] = useState("percentage"); // "percentage" | "fixed"
  const [commissionValue, setCommissionValue] = useState("10");
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);

  // Wallet states
  const [walletUserId, setWalletUserId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw">("deposit");
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  // Free rides states
  const [driverIdForFree, setDriverIdForFree] = useState("");
  const [freeRidesCount, setFreeRidesCount] = useState("5");
  const [freeRidesSubmitting, setFreeRidesSubmitting] = useState(false);

  // Broadcast states
  const [broadcastText, setBroadcastText] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const [previousBroadcasts, setPreviousBroadcasts] = useState<any[]>([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [readersList, setReadersList] = useState<any[]>([]);
  const [loadingReaders, setLoadingReaders] = useState(false);
  const [showReadersModal, setShowReadersModal] = useState(false);

  const fetchDrivers = async () => {
    setLoadingDrivers(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/drivers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setDrivers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const fetchBroadcasts = async () => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/broadcasts`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setPreviousBroadcasts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى كتابة نص الرسالة أولاً." });
      return;
    }
    setBroadcastSubmitting(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: broadcastText, sendWhatsApp }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "📢 تم إرسال الرسالة الجماعية", description: `تم الإرسال بنجاح لـ ${data.sent} مستخدم.` });
        setBroadcastText("");
        fetchBroadcasts();
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "فشل إرسال البث" });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
    } finally {
      setBroadcastSubmitting(false);
    }
  };

  const fetchReaders = async (broadcastId: string) => {
    setSelectedBroadcastId(broadcastId);
    setLoadingReaders(true);
    setShowReadersModal(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/broadcasts/${broadcastId}/readers`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setReadersList(data);
      } else {
        setReadersList([]);
      }
    } catch (err) {
      console.error(err);
      setReadersList([]);
    } finally {
      setLoadingReaders(false);
    }
  };

  const fetchDestinations = async () => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/destinations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setDestinations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        const pMode = data.find((s: any) => s.key === "pricing_mode");
        if (pMode) setPricingMode(pMode.value);

        const commType = data.find((s: any) => s.key === "commission_type");
        if (commType) setCommissionType(commType.value);

        const commVal = data.find((s: any) => s.key === "commission_value") || data.find((s: any) => s.key === "commission_rate");
        if (commVal) {
          setCommissionValue(commVal.value);
          setCommissionRate(commVal.value);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDestinations();
    fetchSettings();
    fetchBroadcasts();
    fetchDrivers();
  }, []);

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionValue || Number(commissionValue) < 0) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال قيمة عمولة صحيحة." });
      return;
    }
    setCommissionSubmitting(true);
    const token = getMemToken();
    try {
      await Promise.all([
        fetch(`${BASE}/api/admin/settings/pricing_mode`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ value: pricingMode }),
        }),
        fetch(`${BASE}/api/admin/settings/commission_type`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ value: commissionType }),
        }),
        fetch(`${BASE}/api/admin/settings/commission_value`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ value: commissionValue }),
        }),
        // For backwards compatibility
        fetch(`${BASE}/api/admin/settings/commission_rate`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ value: commissionValue }),
        })
      ]);
      toast({ title: "✅ تم حفظ الإعدادات", description: "تم تحديث إعدادات التسعير والعمولة بنجاح." });
      fetchSettings();
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
    } finally {
      setCommissionSubmitting(false);
    }
  };

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName || !destPrice) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى تعبئة جميع الحقول" });
      return;
    }
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/destinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: destName, price: destPrice }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم الإضافة", description: "تم إضافة الوجهة بنجاح." });
        setDestName("");
        setDestPrice("");
        fetchDestinations();
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل الاتصال بالخادم" });
    }
  };

  const handleDeleteDestination = async (id: string) => {
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/destinations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم الحذف", description: "تم حذف الوجهة بنجاح." });
        fetchDestinations();
      }
    } catch {}
  };

  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletUserId || !walletAmount || Number(walletAmount) <= 0) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال معرف مستخدم صحيح ومبلغ أكبر من صفر." });
      return;
    }
    setWalletSubmitting(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/users/${walletUserId}/wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: walletAmount, action: walletAction }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم التعديل", description: `تم تعديل رصيد المحفظة بنجاح. الرصيد الجديد: ${data.newBalance} دج` });
        setWalletAmount("");
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
    } finally {
      setWalletSubmitting(false);
    }
  };

  const handleFreeRidesUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverIdForFree || freeRidesCount === "") {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال معرف السائق وعدد الرحلات المجانية." });
      return;
    }
    setFreeRidesSubmitting(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/admin/drivers/${driverIdForFree}/free-rides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ freeRidesLeft: Number(freeRidesCount) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم التحديث", description: "تم تحديث الرحلات المجانية للسائق بنجاح." });
        setDriverIdForFree("");
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
    } finally {
      setFreeRidesSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-6 text-right">
      <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
        <h2 className="font-black text-sm text-primary flex items-center gap-2">🛡️ لوحة الإدارة - نظام الرحلات والمحافظ</h2>
        <p className="text-[11px] text-muted-foreground mt-1">تحكم كامل بالوجهات، شحن أرصدة المستخدمين والسائقين، وتخصيص الفترات التجريبية.</p>
      </div>

      {/* طلبات توثيق السائقين واشتراكات الكورسا المعلقة */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            🗂️ طلبات توثيق السائقين واشتراكات الكورسا
            {drivers.filter((d) => d.documentsStatus === "pending").length > 0 && (
              <span className="bg-red-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                {drivers.filter((d) => d.documentsStatus === "pending").length} معلق
              </span>
            )}
          </h3>
          <button
            onClick={fetchDrivers}
            className="w-8 h-8 rounded-full bg-secondary/10 hover:bg-secondary/20 flex items-center justify-center transition-all"
            title="تحديث القائمة"
          >
            <RotateCw className={`w-3.5 h-3.5 text-secondary ${loadingDrivers ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingDrivers ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>جاري تحميل طلبات السائقين...</span>
          </div>
        ) : drivers.filter((d) => d.documentsStatus === "pending").length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">لا توجد طلبات توثيق سائقين معلقة حالياً.</p>
        ) : (
          <div className="space-y-4">
            {drivers
              .filter((d) => d.documentsStatus === "pending")
              .map((d) => (
                <div key={d.id} className="bg-background border rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                        {d.avatar ? (
                          <img src={d.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-black text-muted-foreground">{d.name?.[0] || "D"}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{d.phone || "بدون رقم هاتف"} • {d.email || "بدون بريد"}</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-[9px] px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-500 font-bold border border-yellow-500/20">
                        ⏳ في المراجعة
                      </span>
                    </div>
                  </div>

                  {/* بيانات السيارة */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-muted/30 p-2.5 rounded-lg border">
                    <div>
                      <span className="text-muted-foreground block">نوع المركبة:</span>
                      <span className="font-bold text-foreground">{d.vehicleType || "غير محدد"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">موديل المركبة:</span>
                      <span className="font-bold text-foreground">{d.vehicleModel || "غير محدد"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">رقم اللوحة:</span>
                      <span className="font-bold text-foreground font-mono">{d.vehiclePlate || "غير محدد"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">لون المركبة:</span>
                      <span className="font-bold text-foreground">{d.vehicleColor || "غير محدد"}</span>
                    </div>
                  </div>

                  {/* صور الوثائق */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-bold">الوثائق المرفوعة:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {d.licenseImage && (
                        <div className="group relative border rounded-lg overflow-hidden bg-black/20 aspect-video flex flex-col justify-end">
                          <img src={d.licenseImage} alt="رخصة السياقة" className="w-full h-full object-cover absolute inset-0" />
                          <a href={d.licenseImage} target="_blank" rel="noreferrer" className="block text-center text-[9px] py-1 bg-black/70 text-white font-bold opacity-90 group-hover:opacity-100 transition-opacity z-10">رخصة السياقة ↗</a>
                        </div>
                      )}
                      {d.idCardImage && (
                        <div className="group relative border rounded-lg overflow-hidden bg-black/20 aspect-video flex flex-col justify-end">
                          <img src={d.idCardImage} alt="بطاقة الهوية" className="w-full h-full object-cover absolute inset-0" />
                          <a href={d.idCardImage} target="_blank" rel="noreferrer" className="block text-center text-[9px] py-1 bg-black/70 text-white font-bold opacity-90 group-hover:opacity-100 transition-opacity z-10">بطاقة الهوية ↗</a>
                        </div>
                      )}
                      {d.vehicleDocImage && (
                        <div className="group relative border rounded-lg overflow-hidden bg-black/20 aspect-video flex flex-col justify-end">
                          <img src={d.vehicleDocImage} alt="البطاقة الرمادية" className="w-full h-full object-cover absolute inset-0" />
                          <a href={d.vehicleDocImage} target="_blank" rel="noreferrer" className="block text-center text-[9px] py-1 bg-black/70 text-white font-bold opacity-90 group-hover:opacity-100 transition-opacity z-10">البطاقة الرمادية ↗</a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex items-center gap-2 pt-1 justify-end">
                    <button
                      onClick={async () => {
                        if (!window.confirm(`هل أنت متأكد من تفعيل اشتراك وقبول وثائق السائق ${d.name}؟`)) return;
                        const token = getMemToken();
                        try {
                          const res = await fetch(`${BASE}/api/admin/drivers/${d.id}/verify-documents`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ status: "verified" }),
                          });
                          if (res.ok) {
                            toast({ title: "✅ تم قبول السائق وتوثيق وثائقه", description: "تم تفعيل الحساب ومنحه 5 رحلات تجريبية." });
                            fetchDrivers();
                          } else {
                            toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث الحالة" });
                          }
                        } catch {
                          toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      قبول وتوثيق السائق (منح 5 كورسات) ✓
                    </button>
                    <button
                      onClick={async () => {
                        const reason = window.prompt("اكتب سبب الرفض (اختياري):");
                        if (reason === null) return;
                        const token = getMemToken();
                        try {
                          const res = await fetch(`${BASE}/api/admin/drivers/${d.id}/verify-documents`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ status: "rejected", reason }),
                          });
                          if (res.ok) {
                            toast({ title: "❌ تم رفض وثائق السائق", description: "تم إرسال إشعار بالرفض لتعديل الوثائق." });
                            fetchDrivers();
                          } else {
                            toast({ variant: "destructive", title: "خطأ", description: "فشل تحديث الحالة" });
                          }
                        } catch {
                          toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بالخادم" });
                        }
                      }}
                      className="bg-red-500/10 hover:bg-red-500/25 text-red-500 border border-red-500/20 text-[10px] font-bold px-4 py-2 rounded-lg transition-all"
                    >
                      رفض الوثائق ✗
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 1. إدارة الوجهات */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">📍 إدارة الوجهات والأسعار المعتمدة</h3>
        <form onSubmit={handleAddDestination} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="اسم الوجهة (مثال: الجزائر العاصمة)"
            value={destName}
            onChange={(e) => setDestName(e.target.value)}
            className="bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
          />
          <input
            type="number"
            placeholder="السعر المقدر بالدج (مثال: 500)"
            value={destPrice}
            onChange={(e) => setDestPrice(e.target.value)}
            className="bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
          />
          <button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors">
            إضافة وجهة جديدة
          </button>
        </form>

        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-bold text-muted-foreground">الوجهات الحالية المضافة:</p>
          {destinations.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد وجهات مضافة بعد.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {destinations.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-background border rounded-xl p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-foreground">{d.name}</span>
                    <span className="bg-primary/15 text-primary text-[10px] px-2 py-0.5 rounded-full font-black">{d.price} دج</span>
                  </div>
                  <button onClick={() => handleDeleteDestination(d.id)} className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. إعدادات التسعير وعمولة التطبيق */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">🛠️ إعدادات التسعير وعمولة التطبيق</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          قم بضبط طريقة تسعير الرحلات في التطبيق وكيفية احتساب عمولتك المستحقة من السائقين بعد انقضاء فترة تجربتهم المجانية.
        </p>
        
        <form onSubmit={handleSaveAllSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* طريقة تسعير الرحلات */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">طريقة تسعير الرحلات (للركاب)</label>
              <select
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
              >
                <option value="flexible">📈 مرن (الراكب يقترح السعر وتضاف له عمولة تلقائية)</option>
                <option value="fixed">📍 ثابت (الراكب يختار من الوجهات المعتمدة فقط مع عمولة مضافة)</option>
              </select>
            </div>

            {/* نوع العمولة */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">طريقة احتساب العمولة (من السائق)</label>
              <select
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary"
              >
                <option value="percentage">٪ نسبة مئوية من سعر الرحلة</option>
                <option value="fixed">💵 مبلغ مالي ثابت لكل رحلة</option>
              </select>
            </div>

            {/* قيمة العمولة */}
            <div className="space-y-1 md:col-span-2 max-w-sm">
              <label className="text-[10px] text-muted-foreground font-bold">قيمة العمولة المستحقة للتطبيق</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder="مثال: 10 أو 150"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  className="w-full bg-background text-foreground border rounded-xl pl-12 pr-3 py-2 text-xs font-bold text-left"
                />
                <span className="absolute left-3 top-2 text-xs text-muted-foreground font-black">
                  {commissionType === "fixed" ? "ألف دورو" : "٪"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left pt-2">
            <button
              type="submit"
              disabled={commissionSubmitting}
              className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-6 rounded-xl text-xs transition-colors disabled:opacity-50 h-[34px]"
            >
              {commissionSubmitting ? "جاري الحفظ..." : "حفظ الإعدادات بالكامل"}
            </button>
          </div>
        </form>
      </div>

      {/* 3. شحن وخصم المحافظ */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">💰 شحن وخصم المحافظ للسائقين والمستخدمين</h3>
        <form onSubmit={handleWalletAdjust} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">معرّف المستخدم أو السائق (User ID)</label>
              <input
                type="text"
                placeholder="أدخل معرف المستخدم"
                value={walletUserId}
                onChange={(e) => setWalletUserId(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">المبلغ بألف دورو</label>
              <input
                type="number"
                placeholder="مثال: 1000"
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex bg-background border rounded-xl p-1 overflow-hidden gap-1">
              <button
                type="button"
                onClick={() => setWalletAction("deposit")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${walletAction === "deposit" ? "bg-green-500 text-white" : "text-muted-foreground"}`}
              >
                شحن / إيداع رصيد
              </button>
              <button
                type="button"
                onClick={() => setWalletAction("withdraw")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${walletAction === "withdraw" ? "bg-red-500 text-white" : "text-muted-foreground"}`}
              >
                خصم / سحب رصيد
              </button>
            </div>
            <button
              type="submit"
              disabled={walletSubmitting}
              className="bg-primary text-white font-bold py-2 px-6 rounded-xl text-xs transition-colors hover:bg-primary/95 disabled:opacity-50"
            >
              {walletSubmitting ? "جاري التحديث..." : "تأكيد العملية"}
            </button>
          </div>
        </form>
      </div>

      {/* 4. التحكم بالرحلات المجانية */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">🎁 التحكم في الرحلات التجريبية المجانية للسائقين</h3>
        <form onSubmit={handleFreeRidesUpdate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">معرّف السائق (Driver User ID)</label>
              <input
                type="text"
                placeholder="أدخل معرف السائق"
                value={driverIdForFree}
                onChange={(e) => setDriverIdForFree(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-bold">عدد الرحلات المجانية المسموحة</label>
              <input
                type="number"
                placeholder="مثال: 5"
                value={freeRidesCount}
                onChange={(e) => setFreeRidesCount(e.target.value)}
                className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold"
              />
            </div>
          </div>
          <div className="text-left">
            <button
              type="submit"
              disabled={freeRidesSubmitting}
              className="bg-primary text-white font-bold py-2 px-6 rounded-xl text-xs transition-colors hover:bg-primary/95 disabled:opacity-50"
            >
              {freeRidesSubmitting ? "جاري التحديث..." : "تحديث عدد الرحلات"}
            </button>
          </div>
        </form>
      </div>

      {/* 5. إرسال رسالة جماعية وترويجية (بث) */}
      <div className="bg-card border rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">📢 إرسال رسائل جماعية وترويجية لجميع المستخدمين</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          أرسل رسالة فورية جماعية (بث) لجميع ركاب وسائقي التطبيق دفعة واحدة. تظهر الرسالة كدردشة مباشرة مع الإدارة، مع إرسال إشعار فوري على الهواتف. يمكنك تفعيل خيار الإرسال عبر WhatsApp أيضاً لضمان استلامها خارج التطبيق.
        </p>

        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground font-bold">نص الرسالة الترويجية أو الإعلانية</label>
            <textarea
              rows={4}
              placeholder="اكتب رسالتك هنا... (مثال: 🎉 مسابقة Gaytak الكبرى! شاركوا الآن واربحوا رصيداً مجانياً...)"
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full bg-background text-foreground border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-primary resize-y"
            />
          </div>

          <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-xl p-3">
            <input
              type="checkbox"
              id="sendWhatsApp"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
            />
            <label htmlFor="sendWhatsApp" className="text-xs font-bold text-foreground cursor-pointer select-none leading-normal">
              🟢 إرسال الإشعار والرسالة عبر WhatsApp أيضاً (لضمان وصولها لجميع المستخدمين خارج التطبيق)
            </label>
          </div>

          <div className="text-left">
            <button
              type="submit"
              disabled={broadcastSubmitting}
              className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-colors disabled:opacity-50 flex items-center gap-2 justify-center mr-auto"
            >
              {broadcastSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال البث...</span>
                </>
              ) : (
                <>
                  <span>إرسال الرسالة الجماعية الآن 🚀</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* قائمة الرسائل السابقة ومتابعة المشاهدات */}
        <div className="border-t border-border pt-4 space-y-3">
          <h4 className="font-bold text-xs text-foreground flex items-center gap-2">📊 سجل الرسائل الجماعية السابقة ومتابعة من شاهدها</h4>
          
          {previousBroadcasts.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد رسائل جماعية مرسلة سابقاً.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {previousBroadcasts.map((b) => (
                <div key={b.id} className="bg-background border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right">
                  <div className="space-y-1 max-w-[70%]">
                    <p className="text-xs font-black text-foreground break-words line-clamp-2">{b.message}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span>📅 {new Date(b.createdAt).toLocaleString("ar-DZ")}</span>
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">👤 المستلمون: {b.recipientCount}</span>
                      <span className="bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-md font-bold">👁️ المشاهدات: {b.readCount}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => fetchReaders(b.id)}
                    className="shrink-0 bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/20 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all self-start sm:self-center"
                  >
                    <span>تتبع من قرأ الرسالة 👁️</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* نافذة عرض من شاهد الرسالة */}
      <AnimatePresence>
        {showReadersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl flex flex-col text-right"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground">👥 تفاصيل المشاهدة والقراءة</h3>
                <button
                  onClick={() => setShowReadersModal(false)}
                  className="text-muted-foreground hover:text-foreground text-xs font-bold bg-background border rounded-lg px-2.5 py-1"
                >
                  إغلاق
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {loadingReaders ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs">جاري تحميل قائمة القراء...</p>
                  </div>
                ) : readersList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-xs">لا توجد قراءات مسجلة بعد لهذه الرسالة.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-bold">المستخدمون الذين شاهدوا الرسالة ({readersList.length}):</p>
                    <div className="space-y-1.5">
                      {readersList.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-background border border-border/60">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                              {r.avatar ? (
                                <img src={r.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-black text-muted-foreground">{r.name?.[0] || "U"}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{r.name}</p>
                              <p className="text-[9px] text-muted-foreground">{r.phone || "بدون رقم هاتف"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-green-500">
                            <span className="text-[10px] font-bold">قرأها</span>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────────
export default function RidesPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(getRole());
  const [hasDriverRole, setHasDriverRole] = useState(false);
  const [hasPassengerRole, setHasPassengerRole] = useState(false);
  const [pendingDriversCount, setPendingDriversCount] = useState(0);

  useEffect(() => {
    const token = getMemToken(); if (!token) return;
    fetch(`${BASE}/api/user/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((roles: string[]) => { setHasDriverRole(roles.includes("driver")); setHasPassengerRole(roles.includes("passenger")); });

    if (user?.role === "admin") {
      fetch(`${BASE}/api/admin/drivers`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const pending = data.filter((d: any) => d.documentsStatus === "pending");
            setPendingDriversCount(pending.length);
          }
        })
        .catch(console.error);
    }
  }, [user]);

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-col items-center justify-center min-h-[60vh] gap-4">
          <Car className="w-16 h-16 text-muted" />
          <p className="text-lg font-bold">سجل الدخول لاستخدام كورسا</p>
          <Link href="/login"><button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold">تسجيل الدخول</button></Link>
        </div>
      </AppLayout>
    );
  }

  const { status: driverSub } = useDriverSubscription();
  const trialDays = driverSub?.trialExpiresAt ? Math.ceil((new Date(driverSub.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user && role === "driver" && trialDays && trialDays > 0 && trialDays <= 7) {
      const shown = localStorage.getItem(`rides_welcome_${user.id}`);
      if (!shown) { setShowWelcome(true); localStorage.setItem(`rides_welcome_${user.id}`, "true"); }
    }
  }, [user, role, trialDays]);

  return (
    <AppLayout>
      <div className="p-4 space-y-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black">🚕 كورسا</h1>
          <div className="flex bg-card border rounded-lg overflow-hidden">
            <button onClick={() => { setRole("passenger"); localStorage.setItem("gaytak_active_role", "passenger"); }} className={`px-3 py-1.5 text-xs font-bold ${role === "passenger" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>راكب</button>
            <button onClick={() => { setRole("driver"); localStorage.setItem("gaytak_active_role", "driver"); }} className={`px-3 py-1.5 text-xs font-bold ${role === "driver" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>سائق</button>
            {user?.role === "admin" && (
              <button
                onClick={() => { setRole("admin"); localStorage.setItem("gaytak_active_role", "admin"); }}
                className={`relative px-3 py-1.5 text-xs font-bold ${role === "admin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                <span>الإدارة</span>
                {pendingDriversCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            )}
          </div>
        </div>
        {role === "driver" && trialDays && trialDays > 0 && <TrialCountdownBanner trialExpiresAt={driverSub?.trialExpiresAt} role="driver" />}
        {showWelcome && trialDays && trialDays > 0 && <TrialWelcomePopup role="driver" daysLeft={trialDays} onClose={() => setShowWelcome(false)} />}
        
        {role === "admin" ? (
          <AdminRidesDashboard />
        ) : role === "driver" ? (
          <DriverSubscriptionGate><DriverDashboard /></DriverSubscriptionGate>
        ) : (
          <PassengerRequest />
        )}
      </div>
    </AppLayout>
  );
}
