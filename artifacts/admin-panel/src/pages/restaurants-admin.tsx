import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2, ChefHat, CheckCircle, XCircle, Star, Clock, MapPin, Flame, RefreshCw, Eye, EyeOff } from "lucide-react";

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
  createdAt: string;
};

const STATUS_MAP = {
  pending:  { label: "بانتظار المراجعة", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  approved: { label: "معتمد", color: "text-green-400 bg-green-400/10 border-green-400/25" },
  rejected: { label: "مرفوض", color: "text-red-400 bg-red-400/10 border-red-400/25" },
};

const FILTER_TABS = ["الكل", "بانتظار المراجعة", "معتمد", "مرفوض"];

export default function RestaurantsAdminPage() {
  const { token } = useAdminAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("الكل");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      toast({ title: status === "approved" ? "✅ تم الاعتماد" : "❌ تم الرفض" });
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
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: !current ? "⭐ تم التمييز" : "تم إلغاء التمييز" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const filtered = restaurants.filter((r) => {
    if (filter === "الكل") return true;
    if (filter === "بانتظار المراجعة") return r.status === "pending";
    if (filter === "معتمد") return r.status === "approved";
    if (filter === "مرفوض") return r.status === "rejected";
    return true;
  });

  const pendingCount = restaurants.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6" dir="rtl">
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
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "الكل", count: restaurants.length, color: "text-white" },
          { label: "معتمد", count: restaurants.filter((r) => r.status === "approved").length, color: "text-green-400" },
          { label: "انتظار", count: pendingCount, color: "text-yellow-400" },
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
              filter === tab ? "bg-primary text-white" : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
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
            return (
              <div key={r.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
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
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{r.category}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</span>
                        {r.phone && <span>{r.phone}</span>}
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.estimatedDeliveryMinutes} دقيقة</span>
                        {Number(r.rating) > 0 && (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Star className="w-3 h-3 fill-yellow-400" />{Number(r.rating).toFixed(1)} ({r.ratingCount})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-white/30 mt-1">
                        تسجيل: {new Date(r.createdAt).toLocaleDateString("ar-SA")}
                        {" • "} رسوم توصيل: {r.deliveryFee} ر.س
                        {" • "} حد أدنى: {r.minOrder} ر.س
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
