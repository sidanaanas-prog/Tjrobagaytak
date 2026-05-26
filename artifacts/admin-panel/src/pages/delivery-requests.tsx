import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Phone, MapPin, Package, CheckCircle, XCircle, Clock, Navigation, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DeliveryRequest {
  id: string;
  status: string;
  deliveryStatus: string | null;
  price: number;
  quantity: number;
  shippingAddress: string | null;
  notes: string | null;
  createdAt: string;
  buyer: { id: string; name: string; phone: string | null; avatar: string | null } | null;
  seller: { id: string; name: string; phone: string | null; avatar: string | null } | null;
  product: { id: string; title: string; images: string[] } | null;
}

const deliveryStatusLabels: Record<string, string> = {
  pending: "بانتظار القبول",
  accepted: "تم القبول",
  rejected: "مرفوض",
  in_transit: "في الطريق",
  delivered: "تم التسليم",
};

const deliveryStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  accepted: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  in_transit: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  delivered: "bg-green-500/10 text-green-400 border-green-500/30",
};

export default function DeliveryRequestsPage() {
  const token = localStorage.getItem("glow_admin_token") || "";
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/delivery-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setRequests(data);
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  async function updateDelivery(orderId: string, deliveryStatus: string) {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/admin/delivery-requests/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deliveryStatus }),
      });
      await fetchData();
    } finally {
      setUpdatingId(null);
    }
  }

  const pending = requests.filter(r => r.deliveryStatus === "pending");
  const active = requests.filter(r => ["accepted", "in_transit"].includes(r.deliveryStatus ?? ""));
  const done = requests.filter(r => ["delivered", "rejected"].includes(r.deliveryStatus ?? ""));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase flex items-center gap-3">
            <Truck className="w-7 h-7" />
            Delivery Requests
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            MANAGE DELIVERY SERVICE ORDERS
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-yellow-400">{pending.length}</div>
            <div className="text-[10px] text-muted-foreground font-mono">PENDING</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-blue-400">{active.length}</div>
            <div className="text-[10px] text-muted-foreground font-mono">ACTIVE</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-green-400">{done.filter(d => d.deliveryStatus === "delivered").length}</div>
            <div className="text-[10px] text-muted-foreground font-mono">DELIVERED</div>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-primary/20 bg-card">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <Truck className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground font-mono">NO DELIVERY REQUESTS YET</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* طلبات بانتظار القبول */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-mono text-yellow-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" /> بانتظار القبول ({pending.length})
              </h2>
              <div className="grid gap-3">
                <AnimatePresence>
                  {pending.map(req => (
                    <DeliveryCard key={req.id} req={req} updatingId={updatingId} onUpdate={updateDelivery} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* طلبات نشطة */}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-mono text-blue-400 mb-3 flex items-center gap-2">
                <Navigation className="w-4 h-4" /> جارية ({active.length})
              </h2>
              <div className="grid gap-3">
                {active.map(req => (
                  <DeliveryCard key={req.id} req={req} updatingId={updatingId} onUpdate={updateDelivery} />
                ))}
              </div>
            </div>
          )}

          {/* مكتملة/مرفوضة */}
          {done.length > 0 && (
            <div>
              <h2 className="text-sm font-mono text-muted-foreground mb-3">مكتملة / مرفوضة ({done.length})</h2>
              <div className="grid gap-3">
                {done.map(req => (
                  <DeliveryCard key={req.id} req={req} updatingId={updatingId} onUpdate={updateDelivery} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function DeliveryCard({ req, updatingId, onUpdate }: {
  req: DeliveryRequest;
  updatingId: string | null;
  onUpdate: (id: string, status: string) => void;
}) {
  const ds = req.deliveryStatus ?? "pending";
  const isUpdating = updatingId === req.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="border-primary/10 bg-card hover:border-primary/30 transition-colors">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
              {req.product?.images?.[0] ? (
                <img src={req.product.images[0]} className="w-full h-full object-cover" alt="" />
              ) : (
                <Package className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="font-mono text-sm text-white">{req.product?.title ?? "منتج"}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                #{req.id.slice(0, 8)} — {new Date(req.createdAt).toLocaleDateString("ar-DZ")}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={`font-mono text-xs ${deliveryStatusColors[ds]}`}>
            {deliveryStatusLabels[ds] ?? ds}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* البائع والمشتري */}
          <div className="grid grid-cols-2 gap-3">
            {/* البائع */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <p className="text-[10px] font-mono text-blue-400 mb-2 uppercase">البائع</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-[11px] text-blue-400 font-bold overflow-hidden border border-blue-500/20">
                  {req.seller?.avatar ? <img src={req.seller.avatar} className="w-full h-full object-cover" alt="" /> : req.seller?.name?.[0]}
                </div>
                <span className="text-sm text-white font-medium truncate">{req.seller?.name ?? "-"}</span>
              </div>
              {req.seller?.phone && (
                <a href={`tel:${req.seller.phone}`} className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors">
                  <Phone className="w-3 h-3" />
                  <span dir="ltr">{req.seller.phone}</span>
                </a>
              )}
            </div>

            {/* المشتري */}
            <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <p className="text-[10px] font-mono text-purple-400 mb-2 uppercase">المشتري</p>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-[11px] text-purple-400 font-bold overflow-hidden border border-purple-500/20">
                  {req.buyer?.avatar ? <img src={req.buyer.avatar} className="w-full h-full object-cover" alt="" /> : req.buyer?.name?.[0]}
                </div>
                <span className="text-sm text-white font-medium truncate">{req.buyer?.name ?? "-"}</span>
              </div>
              {req.buyer?.phone && (
                <a href={`tel:${req.buyer.phone}`} className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 transition-colors">
                  <Phone className="w-3 h-3" />
                  <span dir="ltr">{req.buyer.phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* العنوان */}
          {req.shippingAddress && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/5">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-white/80">{req.shippingAddress}</span>
            </div>
          )}

          {req.notes && (
            <p className="text-xs text-muted-foreground px-1">ملاحظات: {req.notes}</p>
          )}

          {/* أزرار الإجراءات */}
          {ds === "pending" && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => onUpdate(req.id, "accepted")}
                disabled={isUpdating}
                className="flex-1 h-9 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-green-500/25 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                قبول التوصيل
              </button>
              <button
                onClick={() => onUpdate(req.id, "rejected")}
                disabled={isUpdating}
                className="flex-1 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                رفض
              </button>
            </div>
          )}

          {ds === "accepted" && (
            <button
              onClick={() => onUpdate(req.id, "in_transit")}
              disabled={isUpdating}
              className="w-full h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
            >
              <Truck className="w-3.5 h-3.5" />
              بدء التوصيل (في الطريق)
            </button>
          )}

          {ds === "in_transit" && (
            <button
              onClick={() => onUpdate(req.id, "delivered")}
              disabled={isUpdating}
              className="w-full h-9 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-mono font-bold flex items-center justify-center gap-2 hover:bg-green-500/25 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              تم التسليم
            </button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
