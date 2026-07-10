import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2, Car, MapPin, Clock, CheckCircle, XCircle, Star, User, Phone } from "lucide-react";

const BASE = getApiUrl("");

type Ride = {
  id: string;
  status: "pending" | "accepted" | "arrived" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  passengerName: string;
  passengerPhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/rides`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRides(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const activeStatuses = ["accepted", "arrived", "picked_up"];
  const filtered = rides.filter((r) => {
    if (filter === "all") return true;
    if (filter === "active") return activeStatuses.includes(r.status);
    return r.status === filter;
  });

  const todayRides = rides.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString());
  const activeCount = rides.filter((r) => activeStatuses.includes(r.status)).length;
  const revenue = rides.filter((r) => r.status === "completed").reduce((sum, r) => sum + Number(r.price), 0);

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            طلبات الكورسا
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة ومتابعة طلبات الكورسا — نظام ذكي متكامل</p>
        </div>
        <button onClick={load} className="bg-primary/10 border border-primary/30 text-primary text-sm font-bold px-4 py-2 rounded-lg hover:bg-primary/20 transition-colors">
          تحديث
        </button>
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
          <p className="text-xl font-black text-yellow-400 mt-1">{revenue.toFixed(0)} دج</p>
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
                {r.status === "pending" && <span>طُلبت {new Date(r.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
                {r.acceptedAt && <span>قُبِلت {new Date(r.acceptedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
                {r.arrivedAt && <span>· وصل {new Date(r.arrivedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
                {r.pickedUpAt && <span>· استُلِمت {new Date(r.pickedUpAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
                {r.completedAt && <span>· وُصِلت {new Date(r.completedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
                {r.cancelledAt && <span>· أُلغِيت {new Date(r.cancelledAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>

              {/* Driver info */}
              {r.driverName && (
                <div className="flex items-center gap-2 text-xs bg-blue-500/5 border border-blue-500/10 rounded-lg p-2">
                  <Car className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-foreground font-medium">{r.driverName}</span>
                  {r.driverPhone && (
                    <span className="text-muted-foreground" dir="ltr">{r.driverPhone}</span>
                  )}
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">السعر</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{Number(r.price).toFixed(0)} دج</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">السائق</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{r.driverName || "—"}</p>
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
                      {new Date(r.createdAt).toLocaleDateString("ar")}
                    </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
