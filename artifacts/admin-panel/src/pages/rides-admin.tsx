import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Loader2, Car, MapPin, Clock, CheckCircle, XCircle, Star, User, Phone,
  Settings, Trash2, ShieldAlert, Wallet, Sparkles, Map, Sliders, DollarSign, Copy, Search
} from "lucide-react";

const BASE = getApiUrl("");

function getNumericId(id: string | null | undefined): string {
  if (!id) return "—";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

function safeFormatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function safeFormatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ar");
  } catch {
    return "—";
  }
}

type Ride = {
  id: string;
  status: "pending" | "accepted" | "arrived" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  passengerName: string;
  passengerPhone: string | null;
  passengerId: string;
  driverName: string | null;
  driverPhone: string | null;
  driverId: string | null;
  vehicleType?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  rating: number | null;
  driverRating: number | null;
  createdAt: string;
  acceptedAt: string | null;
  arrivedAt: string | null;
  pickedUpAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  commissionDeducted?: number;
  expectedCommission?: number;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  accepted: "text-blue-400 bg-blue-400/10 border-blue-400/25",
  arrived: "text-cyan-400 bg-cyan-400/10 border-cyan-400/25",
  picked_up: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  completed: "text-green-400 bg-green-400/10 border-green-400/25",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/25",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  accepted: "تم القبول",
  arrived: "السائق وصل",
  picked_up: "في الرحلة",
  completed: "مكتملة",
  cancelled: "ملغية",
};
const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  accepted: MapPin,
  arrived: CheckCircle,
  picked_up: Car,
  completed: Star,
  cancelled: XCircle,
};

function vTypeLabel(t: string | null | undefined): string {
  const map: Record<string, string> = {
    car: "🚗 عادي",
    ac: "❄️ مكيف",
    suv: "🚙 دفع رباعي",
    van: "🚐 حافلة",
    truck: "🚚 شحن",
  };
  return map[t ?? "car"] ?? "🚗 عادي";
}

export default function RidesAdmin() {
  useAdminAuth();
  const token = localStorage.getItem("glow_admin_token");
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "completed" | "cancelled">("all");

  // Tabs
  const [activeTab, setActiveTab] = useState<"rides" | "settings">("rides");

  // Destination states
  const [destName, setDestName] = useState("");
  const [destPrice, setDestPrice] = useState("");
  const [destinations, setDestinations] = useState<{ id: string; name: string; price: string }[]>([]);

  // Settings states
  const [pricingMode, setPricingMode] = useState("flexible");
  const [commissionType, setCommissionType] = useState("percentage");
  const [commissionValue, setCommissionValue] = useState("10");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [debtFilterOnly5Plus, setDebtFilterOnly5Plus] = useState(false);

  // Wallet states
  const [walletUserId, setWalletUserId] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw" | "reset">("deposit");
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  // Free rides states
  const [driverIdForFree, setDriverIdForFree] = useState("");
  const [freeRidesCount, setFreeRidesCount] = useState("5");
  const [freeRidesSubmitting, setFreeRidesSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/rides?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRides(data);
        } else {
          console.error("Expected array but got:", data);
          setRides([]);
        }
      } else {
        setRides([]);
      }
    } catch (err) {
      console.error(err);
      setRides([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDestinations = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/admin/destinations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDestinations(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const pMode = data.find((s: any) => s.key === "pricing_mode");
          if (pMode) setPricingMode(pMode.value);

          const commType = data.find((s: any) => s.key === "commission_type");
          if (commType) setCommissionType(commType.value);

          const commVal = data.find((s: any) => s.key === "commission_value") || data.find((s: any) => s.key === "commission_rate");
          if (commVal) setCommissionValue(commVal.value);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    fetchDestinations();
    fetchSettings();
  }, [load, fetchDestinations, fetchSettings]);

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionValue || Number(commissionValue) < 0) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال قيمة عمولة صحيحة." });
      return;
    }
    setSettingsSubmitting(true);
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
      setSettingsSubmitting(false);
    }
  };

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destName || !destPrice) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى تعبئة جميع الحقول" });
      return;
    }
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
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حذف الوجهة" });
    }
  };

  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletUserId) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال معرف مستخدم صحيح." });
      return;
    }
    if (walletAction !== "reset" && (!walletAmount || Number(walletAmount) <= 0)) {
      toast({ variant: "destructive", title: "تنبيه", description: "يرجى إدخال مبلغ أكبر من صفر." });
      return;
    }
    setWalletSubmitting(true);
    try {
      const bodyPayload = walletAction === "reset" 
        ? { action: "reset" }
        : { amount: walletAmount, action: walletAction };

      const res = await fetch(`${BASE}/api/admin/users/${walletUserId}/wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم التعديل", description: walletAction === "reset" ? "تم تصفير محفظة السائق بنجاح وتسوية ديونه." : `تم تعديل رصيد المحفظة بنجاح. الرصيد الجديد: ${data.newBalance} ألف دورو` });
        setWalletAmount("");
        setWalletUserId("");
        setWalletAction("deposit");
        load();
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

  const activeStatuses = ["accepted", "arrived", "picked_up"];
  const filtered = rides.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return activeStatuses.includes(r.status);
    return r.status === filter;
  });

  const todayRides = rides.filter((r) => {
    if (!r.createdAt) return false;
    try {
      const d = new Date(r.createdAt);
      return !isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  });
  const activeCount = rides.filter((r) => activeStatuses.includes(r.status)).length;
  const revenue = rides.filter((r) => r.status === "completed").reduce((sum, r) => sum + Number(r.price), 0);

  // App Commission Calculations
  const completedRides = rides.filter((r) => r.status === "completed");
  const commVal = Number(commissionValue || "10");
  const commType = commissionType || "percentage";

  let totalExpectedCommission = 0;
  let totalDeductedCommission = 0;

  completedRides.forEach((r) => {
    const priceNum = Number(r.price || 0);
    let expected = 0;
    if (commType === "fixed") {
      expected = commVal;
    } else {
      expected = Math.round(priceNum * (commVal / 100));
    }
    totalExpectedCommission += expected;
    totalDeductedCommission += r.commissionDeducted ?? 0;
  });

  const totalUnpaidCommission = Math.max(0, totalExpectedCommission - totalDeductedCommission);

  // Group completed rides by driver to identify commission collections
  const driverStatsMap: Record<string, {
    driverId: string;
    driverName: string;
    driverPhone: string | null;
    completedCount: number;
    totalEarnings: number;
    commissionOwed: number;
    commissionDeducted: number;
    unpaidCommission: number;
    walletBalance: number;
  }> = {};

  completedRides.forEach((r: any) => {
    if (r.driverId) {
      const dId = r.driverId;
      const priceNum = Number(r.price || 0);
      let expected = 0;
      if (commType === "fixed") {
        expected = commVal;
      } else {
        expected = Math.round(priceNum * (commVal / 100));
      }
      const deducted = r.commissionDeducted ?? 0;

      if (!driverStatsMap[dId]) {
        driverStatsMap[dId] = {
          driverId: dId,
          driverName: r.driverName || "سائق غير معروف",
          driverPhone: r.driverPhone,
          completedCount: 0,
          totalEarnings: 0,
          commissionOwed: 0,
          commissionDeducted: 0,
          unpaidCommission: 0,
          walletBalance: Number(r.driverWalletBalance ?? 0),
        };
      }

      const d = driverStatsMap[dId];
      d.completedCount += 1;
      d.totalEarnings += priceNum;
      d.commissionOwed += expected;
      d.commissionDeducted += deducted;
    }
  });

  // Calculate unpaid commission based on the actual negative wallet balance
  Object.values(driverStatsMap).forEach((d) => {
    d.unpaidCommission = d.walletBalance < 0 ? Math.abs(d.walletBalance) : 0;
  });

  const driversDebtList = Object.values(driverStatsMap)
    .filter((d) => {
      const matchesSearch = d.driverName.toLowerCase().includes(driverSearchQuery.toLowerCase()) || 
                            (d.driverPhone && d.driverPhone.includes(driverSearchQuery)) ||
                            getNumericId(d.driverId).includes(driverSearchQuery) ||
                            d.driverId.includes(driverSearchQuery);
      
      const matchesCount = debtFilterOnly5Plus ? d.completedCount >= 5 : true;
      return matchesSearch && matchesCount;
    })
    .sort((a, b) => b.unpaidCommission - a.unpaidCommission || b.completedCount - a.completedCount);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            إدارة طلبات الكورسا والتحكم
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الرحلات النشطة، تعديل إعدادات التسعير، العمولات، الوجهات والمحافظ</p>
        </div>
        <button
          onClick={() => {
            load();
            fetchDestinations();
            fetchSettings();
          }}
          className="bg-primary/10 border border-primary/30 text-primary text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors"
        >
          تحديث الكل
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("rides")}
          className={`px-6 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "rides"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📈 طلبات الكورسا والمتابعة ({rides.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-6 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === "settings"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          🛠️ إعدادات التسعير، العمولة والمحافظ
        </button>
      </div>

      {activeTab === "rides" ? (
        <div className="space-y-6">
          {/* Big Highlighted App Commission Revenue Box */}
          <div className="bg-gradient-to-r from-[#10101a] via-[#151a24] to-[#0d0d12] border border-primary/20 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs uppercase tracking-wider">أرباح عمولة تطبيق تاكسي Tjroba</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">
                  {(totalExpectedCommission).toFixed(0)} <span className="text-lg font-bold text-muted-foreground">ألف دورو (إجمالي العمولات المستحقة)</span>
                </h2>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  هذا الصندوق يعرض مجموع مستحقات التطبيق (العمولات) المحتسبة على جميع الرحلات المكتملة بنجاح، سواء تَمّ خصمها تلقائياً من محافظ السائقين أو يجب تحصيلها يدوياً بالمكتب.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center shrink-0">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center min-w-[140px] sm:min-w-[160px]">
                  <p className="text-[10px] text-green-400 font-bold">✅ تم خصمها تلقائياً</p>
                  <p className="text-xl font-black text-green-300 mt-1">{totalDeductedCommission.toFixed(0)} ألف دورو</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">مخصومة من محافظ السائقين</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center min-w-[140px] sm:min-w-[160px]">
                  <p className="text-[10px] text-yellow-400 font-bold">⚠️ معلقة للتحصيل المكتبي</p>
                  <p className="text-xl font-black text-yellow-300 mt-1">{totalUnpaidCommission.toFixed(0)} ألف دورو</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">مستحقة للدفع في المكتب</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">رحلات اليوم</p>
              <p className="text-xl font-black text-primary mt-1">{todayRides.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">نشطة الآن</p>
              <p className="text-xl font-black text-blue-400 mt-1">{activeCount}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">مكتملة</p>
              <p className="text-xl font-black text-green-400 mt-1">{rides.filter((r) => r.status === "completed").length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">إيرادات</p>
              <p className="text-xl font-black text-yellow-400 mt-1">{revenue.toFixed(0)} ألف دورو</p>
            </div>
          </div>

          {/* Driver Commission Debt & Collection Dashboard */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-yellow-500" />
                  <span>لوحة تحصيل عمولات السائقين (المستحقات المكتبية)</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1">تتبع السائقين الذين أكملوا رحلات ولم يتم خصم عمولتهم بالكامل لتسوية حساباتهم.</p>
              </div>

              {/* Filtering Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setDebtFilterOnly5Plus(!debtFilterOnly5Plus)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    debtFilterOnly5Plus 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                  }`}
                >
                  {debtFilterOnly5Plus ? "🔴 عرض السائقين الحرجين (5+ رحلات) فقط" : "🔍 عرض جميع السائقين"}
                </button>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                  <input
                    type="text"
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    placeholder="ابحث باسم السائق، هاتف أو معرّف..."
                    className="w-full bg-white/5 border border-border rounded-xl pr-9 pl-3 h-9 text-xs text-white focus:outline-none focus:border-primary/50 transition-all text-right"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse text-right">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-white/60 text-xs font-bold">
                    <th className="p-3">السائق</th>
                    <th className="p-3 text-center">الرحلات المكتملة</th>
                    <th className="p-3 text-center">مجموع الإيرادات</th>
                    <th className="p-3 text-center">العمولة الكلية</th>
                    <th className="p-3 text-center">المخصوم تلقائياً</th>
                    <th className="p-3 text-center">المبلغ المتبقي للتحصيل المكتبى</th>
                    <th className="p-3 text-center">الإجراءات والسداد</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {driversDebtList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        لا يوجد سائقون تنطبق عليهم شروط البحث المحددة.
                      </td>
                    </tr>
                  ) : (
                    driversDebtList.map((d) => {
                      const isCritical = d.completedCount >= 5;
                      return (
                        <tr key={d.driverId} className={`border-b border-white/5 hover:bg-white/[0.01] transition-colors ${isCritical ? "bg-red-500/[0.02]" : ""}`}>
                          {/* Driver Info */}
                          <td className="p-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm">{d.driverName}</span>
                                {isCritical && (
                                  <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[9px] font-black animate-pulse">
                                    ⚠️ حرج (5+ رحلات)
                                  </span>
                                )}
                              </div>
                              {d.driverPhone && (
                                <p className="text-muted-foreground font-mono mt-0.5" dir="ltr">{d.driverPhone}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span 
                                  className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono select-all cursor-help font-bold"
                                  title={`المعرف الكامل للسائق: ${d.driverId}`}
                                >
                                  ID: {getNumericId(d.driverId)}
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(d.driverId);
                                    toast({ title: "تم نسخ معرف السائق ✅", description: "تم نسخ معرف السائق بالكامل لاستعماله" });
                                  }}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="نسخ المعرف الكامل"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Completed Count */}
                          <td className="p-3 text-center font-bold text-sm text-foreground">
                            {d.completedCount} رحلات
                          </td>

                          {/* Total Earnings */}
                          <td className="p-3 text-center font-mono">
                            {d.totalEarnings.toFixed(0)} ألف دورو
                          </td>

                          {/* Commission Owed */}
                          <td className="p-3 text-center font-mono text-white/80">
                            {d.commissionOwed.toFixed(0)} ألف دورو
                          </td>

                          {/* Commission Deducted */}
                          <td className="p-3 text-center font-mono text-green-400">
                            {d.commissionDeducted.toFixed(0)} ألف دورو
                          </td>

                          {/* Unpaid Commission (Debt to App) */}
                          <td className="p-3 text-center font-bold font-mono">
                            {d.unpaidCommission > 0 ? (
                              <span className="text-yellow-400 bg-yellow-400/10 border border-yellow-500/20 px-2 py-1 rounded">
                                {d.unpaidCommission.toFixed(0)} ألف دورو
                              </span>
                            ) : (
                              <span className="text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded">
                                مسدد بالكامل 🎉
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setWalletUserId(d.driverId);
                                  setWalletAmount(String(d.unpaidCommission));
                                  setWalletAction("withdraw");
                                  setActiveTab("settings");
                                  
                                  // Scroll down to the form
                                  setTimeout(() => {
                                    const formEl = document.getElementById("wallet-adjust-form");
                                    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
                                  }, 150);

                                  toast({
                                    title: "تم تجهيز الخصم 💸",
                                    description: "تم ملء معلومات السائق وقيمة العمولات المستحقة في نموذج تعديل المحفظة بالأسفل.",
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all"
                              >
                                خصم من المحفظة
                              </button>
                              
                              <button
                                onClick={() => {
                                  setDriverIdForFree(d.driverId);
                                  setActiveTab("settings");
                                  
                                  setTimeout(() => {
                                    const formEl = document.getElementById("free-rides-form");
                                    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
                                  }, 150);

                                  toast({
                                    title: "تجهيز رحلات مجانية 🎁",
                                    description: "تم ملء معرف السائق في نموذج منح الرحلات التجريبية بالأسفل.",
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-all"
                              >
                                منح رحلات مجانية
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "active", "completed", "cancelled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  filter === f
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {{
                  all: `الكل (${rides.length})`,
                  pending: `قيد الانتظار (${rides.filter((r) => r.status === "pending").length})`,
                  active: `نشطة (${activeCount})`,
                  completed: `مكتملة (${rides.filter((r) => r.status === "completed").length})`,
                  cancelled: `ملغية (${rides.filter((r) => r.status === "cancelled").length})`,
                }[f]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد رحلات</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((r) => {
                const StatusIcon = STATUS_ICONS[r.status] ?? Clock;
                return (
                  <div key={r.id} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors">
                    {/* Top row: Passenger + Status */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary/60" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{r.passengerName}</p>
                          {r.passengerPhone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                              <Phone className="w-3 h-3" />
                              {r.passengerPhone}
                            </p>
                          )}
                           <div className="flex items-center gap-1.5 mt-1">
                            <span 
                              className="text-[10px] text-muted-foreground bg-muted/60 border border-border px-1.5 py-0.5 rounded font-mono select-all cursor-help font-bold"
                              title={`المعرف الكامل للراكب: ${r.passengerId}`}
                            >
                              ID: {getNumericId(r.passengerId)}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(r.passengerId);
                                toast({ title: "تم النسخ بنجاح ✅", description: "تم نسخ معرف الراكب إلى الحافظة" });
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="نسخ المعرف"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setWalletUserId(r.passengerId);
                                setActiveTab("settings");
                                toast({ title: "تم التوجيه 📥", description: "تم ملء معرف الراكب في نموذج تعديل المحفظة بالأسفل" });
                              }}
                              className="text-[10px] text-primary hover:underline font-bold mr-1.5"
                            >
                              شحن/خصم المحفظة
                            </button>
                          </div>
                        </div>
                      </div>

                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1 ${STATUS_COLORS[r.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <MapPin className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">{r.fromAddress}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-red-400">{r.toAddress}</span>
                    </div>

                    {/* Vehicle type tag */}
                    {r.vehicleType && (
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full border border-primary/20">
                          {vTypeLabel(r.vehicleType)}
                        </span>
                        {r.vehicleModel && (
                          <span className="text-[10px] text-muted-foreground">{r.vehicleModel} · {r.vehiclePlate}</span>
                        )}
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {r.status === "pending" && <span>طُلبت {safeFormatTime(r.createdAt)}</span>}
                      {r.acceptedAt && <span>قُبِلت {safeFormatTime(r.acceptedAt)}</span>}
                      {r.arrivedAt && <span>· وصل {safeFormatTime(r.arrivedAt)}</span>}
                      {r.pickedUpAt && <span>· استُلِمت {safeFormatTime(r.pickedUpAt)}</span>}
                      {r.completedAt && <span>· وُصِلت {safeFormatTime(r.completedAt)}</span>}
                      {r.cancelledAt && <span>· أُلغِيت {safeFormatTime(r.cancelledAt)}</span>}
                    </div>

                     {/* Driver info */}
                     {r.driverName && (
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5">
                         <div className="flex items-center gap-2">
                           <Car className="w-3.5 h-3.5 text-blue-400" />
                           <span className="text-foreground font-medium">{r.driverName}</span>
                           {r.driverPhone && (
                             <span className="text-muted-foreground" dir="ltr">{r.driverPhone}</span>
                           )}
                         </div>
                         <div className="flex items-center gap-2 flex-wrap">
                           {r.driverId && (
                             <>
                               <span 
                                 className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono select-all cursor-help font-bold"
                                 title={`المعرف الكامل للسائق: ${r.driverId}`}
                               >
                                 ID: {getNumericId(r.driverId)}
                               </span>
                               <button
                                 onClick={() => {
                                   if (r.driverId) {
                                     navigator.clipboard.writeText(r.driverId);
                                     toast({ title: "تم النسخ بنجاح ✅", description: "تم نسخ معرف السائق إلى الحافظة" });
                                   }
                                 }}
                                 className="text-muted-foreground hover:text-primary transition-colors"
                                 title="نسخ المعرف"
                               >
                                 <Copy className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 onClick={() => {
                                   if (r.driverId) {
                                     setWalletUserId(r.driverId);
                                     setActiveTab("settings");
                                     toast({ title: "تم التوجيه 📥", description: "تم ملء معرف السائق في نموذج تعديل المحفظة بالأسفل" });
                                   }
                                 }}
                                 className="text-[10px] text-primary hover:underline font-bold mr-1"
                               >
                                 شحن/خصم المحفظة
                               </button>
                               <button
                                 onClick={() => {
                                   if (r.driverId) {
                                     setDriverIdForFree(r.driverId);
                                     setActiveTab("settings");
                                     toast({ title: "تم التوجيه 🌟", description: "تم ملء معرف السائق في نموذج الرحلات المجانية بالأسفل" });
                                   }
                                 }}
                                 className="text-[10px] text-yellow-500 hover:underline font-bold mr-1"
                               >
                                 تعديل الرحلات المجانية
                               </button>
                             </>
                           )}
                         </div>
                       </div>
                     )}

                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">السعر</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{Number(r.price).toFixed(0)} ألف دورو</p>
                      </div>
                      <div className="bg-[#0c0c14] border border-primary/20 rounded-lg p-2.5 text-center flex flex-col justify-center">
                        <p className="text-[10px] text-primary font-bold">ربح التطبيق (العمولة)</p>
                        <p className="text-xs font-black text-primary mt-0.5">
                          {r.status === "completed" ? (
                            r.commissionDeducted !== undefined && r.commissionDeducted > 0 ? (
                              `${r.commissionDeducted} ألف دورو`
                            ) : (
                              <span className="text-xs text-yellow-500 font-bold">0 (رحلة تجريبية 🎁)</span>
                            )
                          ) : (
                            <span className="text-[9px] text-muted-foreground font-medium">قيد الانتظار (يتوقع: {r.expectedCommission} ألف دورو)</span>
                          )}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">السائق</p>
                        <p className="text-sm font-bold text-foreground mt-0.5 truncate max-w-[80px] mx-auto">{r.driverName || "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">التقييم</p>
                        <p className="text-sm font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-yellow-400" />
                          {r.rating || "—"}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">التاريخ</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">
                          {safeFormatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Pricing Settings */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-md">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-2.5">
              <Settings className="w-5 h-5 text-primary" />
              طريقة تسعير الرحلات وعمولة التطبيق المستقطعة من السائقين
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              قم بضبط طريقة تسعير الكورسات الافتراضية المعتمدة للركاب في التطبيق، ومقدار العمولة المفروضة على السائقين بعد انتهاء فترة التجربة المجانية الممنوحة لهم.
            </p>

            <form onSubmit={handleSaveAllSettings} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-bold">طريقة تسعير الرحلات (للركاب)</label>
                  <select
                    value={pricingMode}
                    onChange={(e) => setPricingMode(e.target.value)}
                    className="w-full bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="flexible">📈 مرن (يقترح الراكب السعر مع إمكانية استخدام أداة تقدير السعر التلقائي)</option>
                    <option value="fixed">📍 ثابت (يجب على الراكب الاختيار من الوجهات والأسعار المحددة من قبلك فقط)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-bold">طريقة احتساب العمولة (من السائق)</label>
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value)}
                    className="w-full bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="percentage">٪ نسبة مئوية مقتطعة من سعر الرحلة</option>
                    <option value="fixed">💵 مبلغ مالي ثابت لكل رحلة منتهية</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2 max-w-sm">
                  <label className="text-xs text-muted-foreground font-bold">قيمة العمولة المستحقة للتطبيق</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      placeholder="مثال: 10 أو 150"
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(e.target.value)}
                      className="w-full bg-background text-foreground border border-border rounded-xl pl-12 pr-4 py-2.5 text-xs font-bold text-left"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-black">
                      {commissionType === "fixed" ? "ألف دورو" : "٪"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 text-left">
                <button
                  type="submit"
                  disabled={settingsSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-colors disabled:opacity-50 h-[38px] flex items-center gap-1.5"
                >
                  {settingsSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                  حفظ إعدادات التسعير بالكامل
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Destinations management */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-md">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-2.5">
              <Map className="w-5 h-5 text-primary" />
              إدارة الوجهات والأسعار المعتمدة (للتسعير الثابت والسريع)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              أضف وجهات مخصصة بأسعار محددة مسبقاً لتسهيل اختيار الركاب للرحلات السريعة في المدن، والتحكم في تعبئة الأسعار تلقائياً.
            </p>

            <form onSubmit={handleAddDestination} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <input
                type="text"
                placeholder="اسم الوجهة (مثال: الجزائر العاصمة)"
                value={destName}
                onChange={(e) => setDestName(e.target.value)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold"
              />
              <input
                type="number"
                placeholder="السعر المقدر بألف دورو (مثال: 500)"
                value={destPrice}
                onChange={(e) => setDestPrice(e.target.value)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
              >
                إضافة وجهة جديدة
              </button>
            </form>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground">الوجهات الحالية المعتمدة:</p>
              {destinations.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">لا توجد وجهات مضافة حالياً.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {destinations.map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-muted/40 border border-border rounded-xl p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-xs text-foreground">{d.name}</span>
                        <span className="bg-primary/15 text-primary text-[10px] px-2 py-0.5 rounded-full font-black">{d.price} ألف دورو</span>
                      </div>
                      <button
                        onClick={() => handleDeleteDestination(d.id)}
                        className="text-red-400 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Manual Wallet Adjustment */}
          <div id="wallet-adjust-form" className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-md scroll-mt-20">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-2.5">
              <Wallet className="w-5 h-5 text-primary" />
              تعديل رصيد المحفظة يدوياً للمستخدمين والسائقين
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              شحن أو اقتطاع مبالغ مالية من محفظة أي مستخدم أو سائق بشكل مباشر ويدوي من خلال إدخال معرف الحساب الفريد وقيمة المبلغ المطلوب تعديله.
            </p>

            <form onSubmit={handleWalletAdjust} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <input
                type="text"
                placeholder="معرف حساب المستخدم (User ID)"
                value={walletUserId}
                onChange={(e) => setWalletUserId(e.target.value)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold sm:col-span-2"
              />
              <input
                type="number"
                placeholder={walletAction === "reset" ? "التصفير لا يحتاج قيمة" : "المبلغ بألف دورو"}
                value={walletAction === "reset" ? "" : walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                disabled={walletAction === "reset"}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold disabled:opacity-50"
              />
              <select
                value={walletAction}
                onChange={(e) => setWalletAction(e.target.value as any)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none"
              >
                <option value="deposit">📥 إيداع / شحن رصيد</option>
                <option value="withdraw">📤 سحب / اقتطاع رصيد</option>
                <option value="reset">🔄 تصفير المحفظة وتسوية الديون</option>
              </select>

              <div className="sm:col-span-4 text-left">
                <button
                  type="submit"
                  disabled={walletSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-colors disabled:opacity-50 h-[38px] flex items-center gap-1.5 ml-auto"
                >
                  {walletSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  تعديل رصيد المحفظة
                </button>
              </div>
            </form>
          </div>

          {/* Section 4: Driver Free Rides */}
          <div id="free-rides-form" className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-md scroll-mt-20">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2 border-b border-border pb-2.5">
              <Sparkles className="w-5 h-5 text-primary" />
              تعديل عدد الرحلات المجانية الممنوحة للسائقين (فترة تجريبية)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              تحكم في عدد الرحلات التجريبية المعفاة تماماً من الرسوم وعمولات التطبيق لكل سائق على حدة لتشجيعهم وتحفيزهم على التسجيل وبدء العمل.
            </p>

            <form onSubmit={handleFreeRidesUpdate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <input
                type="text"
                placeholder="معرف حساب السائق الفريد (Driver ID)"
                value={driverIdForFree}
                onChange={(e) => setDriverIdForFree(e.target.value)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold sm:col-span-2"
              />
              <input
                type="number"
                placeholder="عدد الرحلات المجانية (مثال: 5)"
                value={freeRidesCount}
                onChange={(e) => setFreeRidesCount(e.target.value)}
                className="bg-background text-foreground border border-border rounded-xl px-3.5 py-2.5 text-xs font-bold"
              />

              <div className="sm:col-span-3 text-left">
                <button
                  type="submit"
                  disabled={freeRidesSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-colors disabled:opacity-50 h-[38px] flex items-center gap-1.5 ml-auto"
                >
                  {freeRidesSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  تحديث عدد الرحلات المجانية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
