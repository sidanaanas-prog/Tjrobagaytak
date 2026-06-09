import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2, Car, MapPin, Clock, CheckCircle, XCircle, Star, DollarSign, User, Phone } from "lucide-react";

const BASE = getApiUrl("");

type Ride = {
  id: string;
  status: "pending" | "accepted" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  passengerName: string;
  passengerPhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  rating: number | null;
  driverRating: number | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  accepted: "text-blue-400 bg-blue-400/10 border-blue-400/25",
  picked_up: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  completed: "text-green-400 bg-green-400/10 border-green-400/25",
  cancelled: "text-red-400 bg-red-400/10 border-red-400/25",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  accepted: "تم القبول",
  picked_up: "تم الاستلام",
  completed: "مكتملة",
  cancelled: "ملغية",
};

export default function RidesAdmin() {
  useAdminAuth();
  const token = localStorage.getItem("glow_admin_token");
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "completed" | "cancelled">("all");

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

  const filtered = rides.filter((r) => (filter === "all" ? true : r.status === filter));

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" />
            الرحلات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة ومتابعة طلبات النقل</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-primary/15 border border-primary/30 text-primary text-sm font-bold px-3 py-1.5 rounded-full">
            {rides.length} رحلة
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "accepted", "completed", "cancelled"] as const).map((f) => (
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
              accepted: `تم القبول (${rides.filter((r) => r.status === "accepted").length})`,
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
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
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

                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_COLORS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-foreground">
                <MapPin className="w-4 h-4 text-green-400" />
                <span className="text-green-400">{r.fromAddress}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-red-400">{r.toAddress}</span>
              </div>

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
          ))}
        </div>
      )}
    </div>
  );
}
