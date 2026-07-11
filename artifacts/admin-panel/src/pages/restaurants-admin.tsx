import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Loader2, ChefHat, CheckCircle, XCircle, Star, Clock, MapPin,
  Flame, RefreshCw, ShoppingBag, User, Phone, Mail, UtensilsCrossed,
  CreditCard, Crown, CalendarDays, X,
} from "lucide-react";

const BASE = getApiUrl("");

type Restaurant = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  logo: string | null;
  category: string;
  address: string;
  phone: string | null;
  isOpen: boolean;
  status: "pending" | "approved" | "rejected";
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  rating: string;
  ratingCount: number;
  isFeatured: boolean;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  orderCount: number;
  menuCount: number;
};

const STATUS_MAP = {
  pending:  { label: "انتظار", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  approved: { label: "معتمد",  color: "text-green-400 bg-green-400/10 border-green-400/25" },
  rejected: { label: "مرفوض", color: "text-red-400 bg-red-400/10 border-red-400/25" },
};

const PLAN_MAP: Record<string, { label: string; color: string }> = {
  free:    { label: "مجاني",   color: "text-white/40 bg-white/5 border-white/10" },
  basic:   { label: "أساسي",   color: "text-blue-400 bg-blue-400/10 border-blue-400/25" },
  premium: { label: "بريميوم", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
};

const FILTER_TABS = ["الكل", "انتظار", "معتمد", "مرفوض"];

type SubModal = { restaurantId: string; name: string; current: boolean; plan: string; expires: string | null };

export default function RestaurantsAdminPage() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("الكل");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subModal, setSubModal] = useState<SubModal | null>(null);
  const [subForm, setSubForm] = useState({ isSubscribed: false, plan: "basic", months: 1 });
  const [subLoading, setSubLoading] = useState(false);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRestaurants(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: status === "approved" ? "✅ تم الاعتماد" : status === "rejected" ? "❌ تم الرفض" : "⏸ تم الإيقاف" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    setActionLoading(id + "feat");
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isFeatured: !current }),
      });
      if (!res.ok) throw new Error("فشل");
      toast({ title: !current ? "⭐ تم التمييز" : "تم إلغاء التمييز" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const openSubModal = (r: Restaurant) => {
    setSubForm({
      isSubscribed: r.isSubscribed,
      plan: r.subscriptionPlan ?? "basic",
      months: 1,
    });
    setSubModal({
      restaurantId: r.id,
      name: r.name,
      current: r.isSubscribed,
      plan: r.subscriptionPlan ?? "free",
      expires: r.subscriptionExpiresAt,
    });
  };

  const saveSubscription = async () => {
    if (!subModal) return;
    setSubLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${subModal.restaurantId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          isSubscribed: subForm.isSubscribed,
          subscriptionPlan: subForm.plan,
          months: subForm.isSubscribed ? subForm.months : 0,
        }),
      });
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: subForm.isSubscribed ? "✅ تم تفعيل الاشتراك" : "⏹ تم إلغاء الاشتراك" });
      setSubModal(null);
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setSubLoading(false);
  };

  const filtered = restaurants.filter((r) => {
    if (filter === "الكل") return true;
    if (filter === "انتظار") return r.status === "pending";
    if (filter === "معتمد") return r.status === "approved";
    if (filter === "مرفوض") return r.status === "rejected";
    return true;
  });

  const totalOrders    = restaurants.reduce((s, r) => s + Number(r.orderCount ?? 0), 0);
  const subscribedCount = restaurants.filter((r) => r.isSubscribed).length;
  const pendingCount   = restaurants.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-primary" /> إدارة المطاعم
          </h1>
          {pendingCount > 0 && (
            <p className="text-yellow-400 text-sm mt-1">⚠️ {pendingCount} مطعم بانتظار المراجعة</p>
          )}
        </div>
        <button
          onClick={fetchRestaurants}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "إجمالي",    count: restaurants.length,                        color: "text-white" },
          { label: "معتمد",    count: restaurants.filter((r) => r.status === "approved").length, color: "text-green-400" },
          { label: "مشتركون", count: subscribedCount,                             color: "text-yellow-400" },
          { label: "طلبات",    count: totalOrders,                                color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.count}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              filter === tab
                ? "bg-primary text-white"
                : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ChefHat className="w-14 h-14 text-white/10" />
          <p className="text-white/40">لا توجد مطاعم</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const status = STATUS_MAP[r.status];
            const plan   = PLAN_MAP[r.subscriptionPlan ?? "free"] ?? PLAN_MAP.free;
            const expDate = r.subscriptionExpiresAt
              ? new Date(r.subscriptionExpiresAt).toLocaleDateString("ar-DZ")
              : null;
            const expired = r.subscriptionExpiresAt
              ? new Date(r.subscriptionExpiresAt) < new Date()
              : false;

            return (
              <div key={r.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                {/* Row 1: Logo + name + badges */}
                <div className="flex items-start gap-3">
                  {r.logo ? (
                    <img src={r.logo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-lg">{r.name[0]}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white">{r.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${status.color}`}>
                        {status.label}
                      </span>
                      {r.isFeatured && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">
                          <Flame className="w-3 h-3" /> مميز
                        </span>
                      )}
                      {r.isSubscribed && !expired && (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${plan.color}`}>
                          <Crown className="w-3 h-3" /> {plan.label}
                        </span>
                      )}
                      {r.isSubscribed && expired && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border text-red-400 bg-red-400/10 border-red-400/25">
                          منتهي
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/40 mt-0.5">{r.category}</p>

                    {/* Location + time + rating */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</span>
                      {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.estimatedDeliveryMinutes} دقيقة</span>
                      {Number(r.rating) > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-3 h-3 fill-yellow-400" />{Number(r.rating).toFixed(1)} ({r.ratingCount})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Owner + stats + subscription info */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* Owner info */}
                  <div className="rounded-xl bg-white/3 border border-white/8 p-3">
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wide">المالك</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <User className="w-3 h-3 text-white/30 shrink-0" />
                        <span className="truncate">{r.ownerName ?? "—"}</span>
                      </div>
                      {r.ownerPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-white/70">
                          <Phone className="w-3 h-3 text-white/30 shrink-0" />
                          <span dir="ltr">{r.ownerPhone}</span>
                        </div>
                      )}
                      {r.ownerEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Mail className="w-3 h-3 text-white/30 shrink-0" />
                          <span className="truncate">{r.ownerEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats + subscription */}
                  <div className="rounded-xl bg-white/3 border border-white/8 p-3">
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wide">الإحصائيات</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <ShoppingBag className="w-3 h-3 text-primary/60 shrink-0" />
                        <span>{Number(r.orderCount)} طلب</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <UtensilsCrossed className="w-3 h-3 text-white/30 shrink-0" />
                        <span>{Number(r.menuCount)} عنصر في القائمة</span>
                      </div>
                      {r.isSubscribed && expDate && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <CalendarDays className="w-3 h-3 text-white/30 shrink-0" />
                          <span className={expired ? "text-red-400" : ""}>
                            {expired ? "انتهى " : "ينتهي "}{expDate}
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] text-white/30 mt-0.5">
                        رسوم: {r.deliveryFee} دج | حد أدنى: {r.minOrder} دج
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {r.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(r.id, "approved")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id + "approved" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      اعتماد
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(r.id, "rejected")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id + "rejected" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      رفض
                    </button>
                  )}
                  <button
                    onClick={() => toggleFeatured(r.id, r.isFeatured)}
                    disabled={!!actionLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
                      r.isFeatured
                        ? "bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25"
                        : "bg-white/5 border-white/15 text-white/50 hover:text-white hover:border-white/30"
                    }`}
                  >
                    {actionLoading === r.id + "feat" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                    {r.isFeatured ? "إلغاء التمييز" : "تمييز"}
                  </button>
                  {r.status === "approved" && (
                    <button
                      onClick={() => updateStatus(r.id, "pending")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:text-white transition-colors disabled:opacity-50"
                    >
                      إيقاف
                    </button>
                  )}
                  <button
                    onClick={() => openSubModal(r)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      r.isSubscribed && !expired
                        ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25"
                        : "bg-white/5 border-white/15 text-white/50 hover:text-white hover:border-white/30"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    الاشتراك
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription Modal */}
      {subModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSubModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#1a1a2e] border border-white/10 p-5"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" /> إدارة اشتراك
              </h3>
              <button onClick={() => setSubModal(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-white/60 mb-4">{subModal.name}</p>

            {/* Current status */}
            {subModal.current && (
              <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
                <p>الخطة الحالية: <strong>{PLAN_MAP[subModal.plan]?.label ?? subModal.plan}</strong></p>
                {subModal.expires && (
                  <p className="mt-0.5">تنتهي: {new Date(subModal.expires).toLocaleDateString("ar-DZ")}</p>
                )}
              </div>
            )}

            {/* Toggle */}
            <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-sm text-white/80">تفعيل الاشتراك</span>
              <button
                onClick={() => setSubForm((f) => ({ ...f, isSubscribed: !f.isSubscribed }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${subForm.isSubscribed ? "bg-primary" : "bg-white/20"}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${subForm.isSubscribed ? "right-1" : "right-6"}`}
                />
              </button>
            </div>

            {subForm.isSubscribed && (
              <>
                {/* Plan */}
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-2">الخطة</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["basic", "premium", "free"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSubForm((f) => ({ ...f, plan: p }))}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          subForm.plan === p
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {PLAN_MAP[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-2">المدة (أشهر)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setSubForm((f) => ({ ...f, months: m }))}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          subForm.months === m
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={saveSubscription}
              disabled={subLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {subForm.isSubscribed ? "تفعيل الاشتراك" : "إلغاء الاشتراك"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
