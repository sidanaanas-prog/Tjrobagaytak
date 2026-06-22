import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2, CheckCircle, XCircle, Clock, Navigation, User, Phone, Calendar, CreditCard, Car, Shield, FileCheck, AlertTriangle, Eye, Gift } from "lucide-react";

const BASE = getApiUrl("");

type DriverSub = {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  email: string;
  avatar: string | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  isSubscribed: boolean;
  subscriptionExpiresAt: string | null;
  isOnline: boolean;
  isAvailable: boolean;
  totalRides: number;
  totalEarnings: string;
  createdAt: string;
  isFree: boolean;
  // الوثائق
  licenseImage: string | null;
  idCardImage: string | null;
  vehicleDocImage: string | null;
  licenseVerified: boolean;
  documentsStatus: string | null;
  documentsSubmittedAt: string | null;
};

export default function DriverSubscriptions() {
  useAdminAuth();
  const token = localStorage.getItem("glow_admin_token");
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<DriverSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "subscribed" | "not-subscribed" | "online" | "pending-docs">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverSub | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDrivers(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function approveSubscription(userId: string) {
    setActionId(userId);
    try {
      const res = await fetch(`${BASE}/api/admin/driver-subscriptions/${userId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "تم التفعيل ✅", description: "تم تفعيل اشتراك السائق" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  async function deactivateSubscription(userId: string) {
    setActionId(userId);
    try {
      const res = await fetch(`${BASE}/api/admin/drivers/${userId}/deactivate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "تم الإيقاف", description: "تم إيقاف اشتراك السائق" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  async function toggleFreeDriver(userId: string, isFree: boolean) {
    setActionId(userId);
    try {
      const res = await fetch(`${BASE}/api/admin/drivers/${userId}/free`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isFree }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: isFree ? "✅ تم التفعيل" : "تم الإلغاء", description: isFree ? "تم تفعيل وضع السائق المجاني" : "تم إلغاء وضع السائق المجاني" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  async function verifyDocuments(userId: string, status: "verified" | "rejected") {
    setActionId(userId);
    try {
      const res = await fetch(`${BASE}/api/admin/drivers/${userId}/verify-documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: status === "verified" ? "✅ تم التأكيد" : "❌ تم الرفض", description: status === "verified" ? "تم تأكيد وثائق السائق" : "تم رفض وثائق السائق" });
      load();
      setShowDocsModal(false);
      setSelectedDriver(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  function openDocsModal(driver: DriverSub) {
    setSelectedDriver(driver);
    setShowDocsModal(true);
  }

  const filtered = drivers.filter((d) => {
    if (filter === "subscribed") return d.isSubscribed;
    if (filter === "not-subscribed") return !d.isSubscribed;
    if (filter === "online") return d.isOnline;
    if (filter === "pending-docs") return d.documentsStatus === "pending";
    return true;
  });

  const subscribedCount = drivers.filter((d) => d.isSubscribed).length;
  const onlineCount = drivers.filter((d) => d.isOnline).length;

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Navigation className="w-6 h-6 text-primary" />
            اشتراكات السائقين
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة اشتراكات السائقين (2000 دج/شهر)</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-primary/15 border border-primary/30 text-primary text-sm font-bold px-3 py-1.5 rounded-full">
            {subscribedCount} مشترك
          </span>
          <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold px-3 py-1.5 rounded-full">
            {onlineCount} متصل
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "subscribed", "not-subscribed", "online", "pending-docs"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filter === f
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {{
              all: "الكل",
              subscribed: `مشترك (${drivers.filter((d) => d.isSubscribed).length})`,
              "not-subscribed": `غير مشترك (${drivers.filter((d) => !d.isSubscribed).length})`,
              online: `متصل (${drivers.filter((d) => d.isOnline).length})`,
              "pending-docs": `وثائق قيد المراجعة (${drivers.filter((d) => d.documentsStatus === "pending").length})`,
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
          <p className="text-sm">لا يوجد سائقين</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((driver) => (
            <div key={driver.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                    {driver.avatar ? (
                      <img src={driver.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-primary/60" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{driver.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                      <Phone className="w-3 h-3" />
                      {driver.phone || driver.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {driver.isOnline && (
                    <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      متصل
                    </span>
                  )}
                  {driver.isFree && (
                    <span className="bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      مجاني
                    </span>
                  )}
                  {driver.isSubscribed ? (
                    <span className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      مشترك
                    </span>
                  ) : (
                    <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      غير مشترك
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">المركبة</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {driver.vehicleType || "—"} {driver.vehicleModel || ""}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">اللوحة</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{driver.vehiclePlate || "—"}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">الرحلات</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{driver.totalRides}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground">الأرباح</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{Number(driver.totalEarnings).toFixed(0)} دج</p>
                </div>
              </div>

              {/* حالة الوثائق */}
              <div className="flex items-center gap-2">
                {driver.documentsStatus === "verified" ? (
                  <span className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> وثائق مؤكدة
                  </span>
                ) : driver.documentsStatus === "pending" ? (
                  <span className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> وثائق قيد المراجعة
                  </span>
                ) : (
                  <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> لا توجد وثائق
                  </span>
                )}
                {(driver.licenseImage || driver.idCardImage || driver.vehicleDocImage) && (
                  <button
                    onClick={() => openDocsModal(driver)}
                    className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> عرض الوثائق
                  </button>
                )}
              </div>

              {driver.isSubscribed && driver.subscriptionExpiresAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  ينتهي الاشتراك: {new Date(driver.subscriptionExpiresAt).toLocaleDateString("ar")}
                </div>
              )}

              <div className="flex gap-3 pt-1 flex-wrap">
                {!driver.isSubscribed ? (
                  <button
                    onClick={() => approveSubscription(driver.userId)}
                    disabled={actionId === driver.userId}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all disabled:opacity-50"
                  >
                    {actionId === driver.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    تفعيل الاشتراك
                  </button>
                ) : (
                  <button
                    onClick={() => deactivateSubscription(driver.userId)}
                    disabled={actionId === driver.userId}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-bold transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    إيقاف الاشتراك
                  </button>
                )}

                {/* زر السائق المجاني */}
                <button
                  onClick={() => toggleFreeDriver(driver.userId, !driver.isFree)}
                  disabled={actionId === driver.userId}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${
                    driver.isFree
                      ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400"
                      : "bg-slate-600/20 hover:bg-slate-600/30 border border-slate-500/30 text-slate-400"
                  }`}
                >
                  {actionId === driver.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  {driver.isFree ? "سائق مجاني" : "تفعيل مجاني"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نافذة عرض الوثائق */}
      {showDocsModal && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">وثائق {selectedDriver.name}</h2>
              <button onClick={() => setShowDocsModal(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {selectedDriver.licenseImage && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">رخصة القيادة</p>
                  <img src={selectedDriver.licenseImage} alt="License" className="w-full rounded-xl border border-border" />
                </div>
              )}
              {selectedDriver.idCardImage && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">بطاقة الهوية</p>
                  <img src={selectedDriver.idCardImage} alt="ID Card" className="w-full rounded-xl border border-border" />
                </div>
              )}
              {selectedDriver.vehicleDocImage && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">رخصة السير</p>
                  <img src={selectedDriver.vehicleDocImage} alt="Vehicle Doc" className="w-full rounded-xl border border-border" />
                </div>
              )}
            </div>

            {/* أزرار المراجعة */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={() => verifyDocuments(selectedDriver.userId, "verified")}
                disabled={actionId === selectedDriver.userId}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {actionId === selectedDriver.userId ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck className="w-4 h-4" />}
                تأكيد الوثائق
              </button>
              <button
                onClick={() => verifyDocuments(selectedDriver.userId, "rejected")}
                disabled={actionId === selectedDriver.userId}
                className="flex-1 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                رفض الوثائق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
