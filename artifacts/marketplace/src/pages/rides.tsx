import { useState, useEffect, useCallback } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DriverSubscriptionGate } from "@/components/DriverSubscriptionGate";
import {
  Car, MapPin, Clock, Star, CheckCircle, XCircle, Phone, MessageSquare,
  ChevronLeft, Loader2, Navigation, User, Circle, Flag,
  Plus, Trash2, DollarSign, TrendingUp,
} from "lucide-react";

const BASE = getApiUrl("");

type Ride = {
  id: string;
  status: "pending" | "accepted" | "picked_up" | "completed" | "cancelled";
  fromAddress: string;
  toAddress: string;
  price: string;
  createdAt: string;
  driver?: { id: string; name: string; phone: string | null; avatar: string | null };
  passenger?: { id: string; name: string; phone: string | null; avatar: string | null };
  acceptedAt?: string | null;
  completedAt?: string | null;
  rating?: number;
  driverRating?: number;
};

function getRole(): string | null {
  return localStorage.getItem("gaytak_active_role");
}

// ── الراكب: طلب نقل ──────────────────────────────────────────────────
function PassengerRequest() {
  const { toast } = useToast();
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyRides = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyRides(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMyRides();
    const iv = setInterval(fetchMyRides, 5000);
    return () => clearInterval(iv);
  }, [fetchMyRides]);

  const handleSubmit = async () => {
    if (!fromAddress || !toAddress || !price) {
      toast({ title: "المرجو", description: "املأ المكان والسعر", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromAddress, toAddress, price: Number(price), notes }),
      });
      if (res.ok) {
        toast({ title: "✅ تم!", description: "تم إرسال الطلب" });
        setFromAddress(""); setToAddress(""); setPrice(""); setNotes("");
        fetchMyRides();
      } else {
        const err = await res.json();
        toast({ title: "خطأ", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ", description: "فشل الاتصال", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/cancel`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchMyRides();
  };

  const handleRate = async (id: string, rating: number) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/rate`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating }),
    });
    fetchMyRides();
  };

  const statusConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
    pending: { color: "text-yellow-400", label: "يبحث عن سائق", icon: Clock },
    accepted: { color: "text-blue-400", label: "السائق في الطريق", icon: Navigation },
    picked_up: { color: "text-purple-400", label: "استلمك", icon: Car },
    completed: { color: "text-green-400", label: "وصلت", icon: CheckCircle },
    cancelled: { color: "text-red-400", label: "ملغية", icon: XCircle },
  };

  return (
    <div className="space-y-6">
      {/* فورم الطلب */}
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" /> احجز نقل
        </h3>
        <div className="space-y-2">
          <div className="relative">
            <MapPin className="absolute right-3 top-2.5 w-4 h-4 text-green-400" />
            <input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="من: اكتب المكان" className="w-full bg-background border rounded-xl pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="relative">
            <MapPin className="absolute right-3 top-2.5 w-4 h-4 text-red-400" />
            <input value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder="إلى: اكتب الوجهة" className="w-full bg-background border rounded-xl pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="relative">
            <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-primary" />
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="السعر (د.ج)" className="w-full bg-background border rounded-xl pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" className="w-full bg-background border rounded-xl p-3 text-sm focus:outline-none focus:border-primary min-h-[60px]" />
        </div>
        <button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
          ارسال الطلب
        </button>
      </div>

      {/* رحلاتي */}
      <div>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> رحلاتي
        </h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : myRides.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">ليس لديك رحلات بعد</p>
        ) : (
          <div className="space-y-3">
            {myRides.map((r) => {
              const s = statusConfig[r.status] ?? statusConfig.pending;
              const Icon = s.icon;
              return (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${s.color} bg-primary/10`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${s.color}`}>{s.label}</span>
                        <span className="text-xs text-muted-foreground">{r.price} د.ج</span>
                      </div>
                      <p className="text-sm mt-1">
                        <span className="text-green-400">{r.fromAddress}</span> → <span className="text-red-400">{r.toAddress}</span>
                      </p>
                      {r.driver && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" /> {r.driver.name}
                          {r.driver.phone && (
                            <a href={`tel:${r.driver.phone}`} className="text-primary flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> اتصل
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <button onClick={() => handleCancel(r.id)} className="w-full text-xs text-red-400 py-1.5 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors">
                      <XCircle className="w-3 h-3 inline mr-1" /> إلغاء
                    </button>
                  )}
                  {r.status === "completed" && !r.driverRating && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-xs text-muted-foreground">تقييم:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => handleRate(r.id, star)} className="text-yellow-400 hover:scale-110 transition-transform">
                          <Star className={`w-4 h-4 ${star <= (r.driverRating ?? 0) ? "fill-yellow-400" : ""}`} />
                        </button>
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

// ── السائق: طلبات النقل ──────────────────────────────────────────────────
function DriverDashboard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const fetchRequests = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/driver?status=pending`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setRequests(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/driver/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.error) {
        setProfile(data);
        setOnline(data.isOnline);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchProfile();
    const iv = setInterval(fetchRequests, 5000);
    return () => clearInterval(iv);
  }, [fetchRequests, fetchProfile]);

  const toggleOnline = async () => {
    const token = getMemToken();
    const newState = !online;
    setOnline(newState);
    await fetch(`${BASE}/api/driver/location`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isAvailable: newState }),
    });
    toast({ title: newState ? "✅ متصل" : "⏸️ غير متصل", description: newState ? "أنت الآن متاح للطلبات" : "لن تتلقى طلبات جديدة" });
  };

  const handleAccept = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/accept`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  const handlePickup = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/pickup`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  const handleComplete = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/complete`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  const handleCancel = async (id: string) => {
    const token = getMemToken();
    await fetch(`${BASE}/api/rides/${id}/cancel`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchRequests();
  };

  return (
    <div className="space-y-6">
      {/* وضع السائق */}
      <div className="bg-card border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${online ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm">{online ? "متاح للطلبات" : "غير متاح"}</p>
              <p className="text-xs text-muted-foreground">{online ? "الطلبات قريبة منك" : "اضغط لتبدأ"}</p>
            </div>
          </div>
          <button
            onClick={toggleOnline}
            className={`w-14 h-8 rounded-full transition-colors relative ${online ? "bg-green-500" : "bg-muted"}`}
          >
            <div className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-all ${online ? "left-7" : "left-1"}`} />
          </button>
        </div>
        {profile && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-primary/10 rounded-xl p-2">
              <p className="text-lg font-bold text-primary">{profile.totalRides}</p>
              <p className="text-[10px] text-muted-foreground">رحلات</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-2">
              <p className="text-lg font-bold text-primary">{profile.totalEarnings}</p>
              <p className="text-[10px] text-muted-foreground">أرباح</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-2">
              <p className="text-lg font-bold text-primary">{profile.avgRating}</p>
              <p className="text-[10px] text-muted-foreground">تقييم</p>
            </div>
          </div>
        )}
      </div>

      {/* الطلبات */}
      <div>
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> طلبات قريبة
        </h3>
        {!online ? (
          <p className="text-center text-sm text-muted-foreground py-8">اضغط زر التصل للرؤية الطلبات</p>
        ) : loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : requests.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">لا توجد طلبات حالياً</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border rounded-xl p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{r.passenger?.name ?? "راكب"}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-green-400">{r.fromAddress}</span> → <span className="text-red-400">{r.toAddress}</span>
                    </p>
                    <p className="text-xs text-primary font-bold mt-1">{r.price} د.ج</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAccept(r.id)} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" /> قبول
                  </button>
                  <button onClick={() => handleCancel(r.id)} className="px-3 py-2 border rounded-lg text-xs text-red-400 hover:bg-red-400/10">
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── الصفحة الرئيسية ──────────────────────────────────────────────────
export default function RidesPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(getRole());
  const [hasDriverRole, setHasDriverRole] = useState(false);
  const [hasPassengerRole, setHasPassengerRole] = useState(false);

  useEffect(() => {
    const token = getMemToken();
    if (!token) return;
    fetch(`${BASE}/api/user/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((roles: string[]) => {
        setHasDriverRole(roles.includes("driver"));
        setHasPassengerRole(roles.includes("passenger"));
      });
  }, []);

  if (!user) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Car className="w-16 h-16 text-muted" />
          <p className="text-lg font-bold">سجل الدخول لاستخدام النقل</p>
          <Link href="/login">
            <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold">تسجيل الدخول</button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black">🚕 النقل</h1>
          {hasDriverRole && hasPassengerRole && (
            <div className="flex bg-card border rounded-lg overflow-hidden">
              <button onClick={() => { setRole("passenger"); localStorage.setItem("gaytak_active_role", "passenger"); }} className={`px-3 py-1.5 text-xs font-bold ${role === "passenger" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                راكب
              </button>
              <button onClick={() => { setRole("driver"); localStorage.setItem("gaytak_active_role", "driver"); }} className={`px-3 py-1.5 text-xs font-bold ${role === "driver" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                سائق
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {role === "driver" ? (
          <DriverSubscriptionGate>
            <DriverDashboard />
          </DriverSubscriptionGate>
        ) : (
          <PassengerRequest />
        )}
      </div>
    </AppLayout>
  );
}
