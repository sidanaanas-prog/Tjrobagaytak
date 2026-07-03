import { useState, useEffect, useCallback } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { DriverSubscriptionGate } from "@/components/DriverSubscriptionGate";
import { useDriverSubscription } from "@/hooks/use-driver-subscription";
import {
  Car, MapPin, Clock, Star, CheckCircle, XCircle, Phone, MessageSquare,
  ChevronLeft, Loader2, Navigation, User, Circle, Flag,
  Plus, Trash2, TrendingUp, Shield, Gift,
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
  passengerCount?: number;
};

function getRole(): string | null {
  return localStorage.getItem("gaytak_active_role");
}

// ── الراكب: طلب كورسا ──────────────────────────────────────────────────
function PassengerRequest() {
  const { toast } = useToast();
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [price, setPrice] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  // الراكب: اعداد تنازلي للطلب المحدد
  const [pendingCountdown, setPendingCountdown] = useState<number | null>(null);
  const [showPriceTip, setShowPriceTip] = useState(false);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [countdownTrigger, setCountdownTrigger] = useState(0); // لإعادة تشغيل العداد بعد تحديث السعر

  const fetchMyRides = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyRides(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMyRides();
    const iv = setInterval(fetchMyRides, 5000);
    return () => clearInterval(iv);
  }, [fetchMyRides]);

  // عداد تنازلي لرحلات الراكب القيد الانتظار
  const pendingRide = myRides.find((r) => r.status === "pending");
  useEffect(() => {
    if (!pendingRide) {
      setPendingCountdown(null);
      setShowPriceTip(false);
      return;
    }
    setPendingCountdown(30);
    setShowPriceTip(false);
    const iv = setInterval(() => {
      setPendingCountdown((c) => {
        if (c === null || c <= 1) {
          setShowPriceTip(true);
          return null;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [pendingRide?.id, countdownTrigger]);

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
        body: JSON.stringify({ fromAddress, toAddress, price: Number(price), passengerCount: Number(passengerCount), notes }),
      });
      if (res.ok) {
        toast({ title: "✅ تم!", description: "تم إرسال الطلب" });
        setFromAddress(""); setToAddress(""); setPrice(""); setPassengerCount("1"); setNotes("");
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
    setPendingCountdown(null);
    setShowPriceTip(false);
    setEditingPrice(null);
    fetchMyRides();
  };

  const handleChangePrice = async (rideId: string) => {
    if (!newPrice || Number(newPrice) <= 0) {
      toast({ title: "المرجو", description: "أدخل سعراً صالحاً", variant: "destructive" });
      return;
    }
    const token = getMemToken();
    const res = await fetch(`${BASE}/api/rides/${rideId}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ price: Number(newPrice) }),
    });
    if (res.ok) {
      toast({ title: "✅ تم!", description: "تم تحديث السعر" });
      setEditingPrice(null);
      setNewPrice("");
      setCountdownTrigger((t) => t + 1);
      fetchMyRides();
    } else {
      const err = await res.json();
      toast({ title: "خطأ", description: err.error, variant: "destructive" });
    }
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
      {/* فورم الطلب — تصميم متطور */}
      <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-4 shadow-lg shadow-primary/5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Car className="w-4 h-4 text-primary" />
            </div>
            احجز كورسا
          </h3>
          <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">
            السعر منك
          </span>
        </div>

        {/* شرح */}
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-primary font-bold">أنت تحدد السعر</span> — اكتب المبلغ الذي تراه مناسباً، والسائق يوافق أو يتفاوض.
          </p>
        </div>

        {/* المسار */}
        <div className="space-y-3">
          {/* من */}
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                <Navigation className="w-3.5 h-3.5 text-green-400" />
              </div>
            </div>
            <input
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="📍 من أين؟"
              className="w-full bg-background border border-green-500/30 rounded-xl pr-12 pl-3 py-3 text-sm focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400/20 transition-all"
            />
          </div>

          {/* خط وصل */}
          <div className="flex items-center gap-2 pr-5">
            <div className="w-0.5 h-6 bg-gradient-to-b from-green-400/50 to-red-400/50 rounded-full" />
            <span className="text-[10px] text-muted-foreground">المسار</span>
          </div>

          {/* إلى */}
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="🎯 إلى أين؟"
              className="w-full bg-background border border-red-500/30 rounded-xl pr-12 pl-3 py-3 text-sm focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 transition-all"
            />
          </div>
        </div>

        {/* السعر و عدد الركاب */}
        <div className="grid grid-cols-2 gap-3">
          {/* السعر */}
          <div className="relative">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="السعر"
              className="w-full bg-background border border-yellow-500/30 rounded-xl pr-3 pl-10 py-3 text-sm font-bold text-yellow-400 placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20 transition-all"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-yellow-400">دج</span>
          </div>

          {/* عدد الركاب */}
          <div className="relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-blue-400" />
              </div>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={passengerCount}
              onChange={(e) => setPassengerCount(e.target.value)}
              placeholder="الركاب"
              className="w-full bg-background border border-blue-500/30 rounded-xl pr-12 pl-3 py-3 text-sm font-bold text-blue-400 placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">راكب</span>
          </div>
        </div>

        {/* ملاحظات */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="💬 ملاحظات للسائق (اختياري)"
          className="w-full bg-background border rounded-xl p-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all min-h-[60px]"
        />

        {/* زر الإرسال */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/25 active:scale-[0.98]"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Car className="w-5 h-5" />
              <span>اطلب الآن — السائق يرد عليك!</span>
            </>
          )}
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{r.price} دج</span>
                          <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full">{r.passengerCount ?? 1} راكب</span>
                        </div>
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
                    <div className="space-y-2">
                      {/* العداد التنازلي */}
                      {pendingCountdown !== null && r.id === pendingRide?.id && (
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 text-center">
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <Clock className="w-4 h-4 animate-pulse" />
                            <span className="text-sm font-bold">جاري البحث عن سائق...</span>
                          </div>
                          <div className="text-2xl font-mono font-bold text-primary mt-1">
                            {pendingCountdown}s
                          </div>
                          <div className="w-full bg-primary/10 rounded-full h-1.5 mt-2">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(pendingCountdown / 30) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      {/* نصيحة ذكية: زِد السعر */}
                      {showPriceTip && r.id === pendingRide?.id && (
                        <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 text-yellow-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm font-bold">لم يتم إيجاد سائق</span>
                          </div>
                          <p className="text-xs text-yellow-400/80">
                            زِد السعر لتحسين فرصة إيجاد سائق بسرعة
                          </p>
                          {editingPrice === r.id ? (
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(e.target.value)}
                                placeholder="السعر الجديد"
                                className="flex-1 bg-background border rounded-lg px-3 py-2 text-sm text-foreground"
                              />
                              <button
                                onClick={() => handleChangePrice(r.id)}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold"
                              >
                                تحديث
                              </button>
                              <button
                                onClick={() => { setEditingPrice(null); setNewPrice(""); }}
                                className="border border-border px-3 py-2 rounded-lg text-sm text-muted-foreground"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingPrice(r.id); setNewPrice(r.price); }}
                              className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 py-2 rounded-lg text-sm font-bold transition-colors"
                            >
                              <TrendingUp className="w-4 h-4 inline mr-1" /> زِد السعر
                            </button>
                          )}
                        </div>
                      )}
                      <button onClick={() => handleCancel(r.id)} className="w-full text-xs text-red-400 py-1.5 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors">
                        <XCircle className="w-3 h-3 inline mr-1" /> إلغاء
                      </button>
                    </div>
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

// ── السائق: طلبات كورسا ──────────────────────────────────────────────────
function DriverDashboard() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const { status: subStatus } = useDriverSubscription();

  const driverTrialDays = subStatus?.trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(subStatus.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;
  const isDriverTrialActive = driverTrialDays !== null && driverTrialDays > 0;

  const fetchRequests = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        fetch(`${BASE}/api/rides/driver?status=pending`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE}/api/rides/driver?status=accepted`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pending = await pendingRes.json();
      const accepted = await acceptedRes.json();
      setRequests([
        ...(Array.isArray(pending) ? pending : []),
        ...(Array.isArray(accepted) ? accepted : []),
      ]);
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

  const [_, setLocation] = useLocation();

  const handleAccept = async (id: string): Promise<boolean> => {
    const token = getMemToken();
    const res = await fetch(`${BASE}/api/rides/${id}/accept`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    fetchRequests();
    // فتح المحادثة تلقائياً
    if (res.ok && data.success && data.conversationId) {
      setLocation(`/chat/${data.conversationId}`);
    }
    return res.ok && data.success;
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
          <>
            {/* حالة الاشتراك / التجربة المجانية */}
            {isDriverTrialActive ? (
              <div className="mb-4 rounded-xl p-3 border bg-amber-500/8 border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-400">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">🎉 تجربة مجانية 7 أيام</p>
                      <p className="text-[10px] text-white/50">
                        متبقى {driverTrialDays} أيام — استخدم جميع الميزات
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold animate-pulse">
                    {driverTrialDays} أيام
                  </span>
                </div>
              </div>
            ) : subStatus?.isFree ? (
              <div className="mb-4 rounded-xl p-3 border bg-green-500/8 border-green-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/15 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">اشتراك نشط</p>
                      <p className="text-[10px] text-white/50">
                        حسابك مجاني مدى الحياة
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-bold">نشط</span>
                </div>
              </div>
            ) : subStatus?.isSubscribed ? (
              <div className="mb-4 rounded-xl p-3 border bg-primary/8 border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15 text-primary">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">اشتراك مدفوع</p>
                      <p className="text-[10px] text-white/50">
                        {subStatus?.expiresAt ? `ينتهي ${new Date(subStatus.expiresAt).toLocaleDateString('ar-DZ')}` : 'اشتراك نشط'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">مدفوع</span>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl p-3 border bg-red-500/8 border-red-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/15 text-red-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">التجربة انتهت</p>
                      <p className="text-[10px] text-white/50">
                        اشترك الآن لاستقبال الطلبات
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-bold">منتهي</span>
                </div>
              </div>
            )}

            {/* حالة الوثائق */}
            <div className={`mb-4 rounded-xl p-3 border ${profile.documentsStatus === "verified" ? "bg-green-500/8 border-green-500/20" : profile.documentsStatus === "pending" ? "bg-yellow-500/8 border-yellow-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${profile.documentsStatus === "verified" ? "bg-green-500/15 text-green-400" : profile.documentsStatus === "pending" ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">الوثائق</p>
                    <p className="text-[10px] text-white/50">
                      {profile.documentsStatus === "verified" ? "✅ تم التأكيد" : profile.documentsStatus === "pending" ? "قيد المراجعة" : "لم تُرفع"}
                    </p>
                  </div>
                </div>
                {profile.documentsStatus === "verified" ? (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-bold">متأكد</span>
                ) : profile.documentsStatus === "pending" ? (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-bold">قيد المراجعة</span>
                ) : (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-bold">لم تُرفع</span>
                )}
              </div>
            </div>

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
          </>
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
                    <p className="text-xs text-primary font-bold mt-1">{r.price} دج</p>
                    {/* بيانات الراكب وزر المحادثة للرحلات المقبولة */}
                    {r.status === "accepted" && r.passenger && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        {r.passenger.phone && (
                          <a href={`tel:${r.passenger.phone}`} className="text-green-400 flex items-center gap-1 hover:underline">
                            <Phone className="w-3 h-3" /> {r.passenger.phone}
                          </a>
                        )}
                        <Link href={`/chat/${r.passenger.id}`}>
                          <span className="text-primary flex items-center gap-1 hover:underline">
                            <MessageSquare className="w-3 h-3" /> محادثة
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {r.status === "pending" ? (
                    <>
                      <button onClick={() => handleAccept(r.id)} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> قبول
                      </button>
                      <button onClick={() => handleCancel(r.id)} className="px-3 py-2 border rounded-lg text-xs text-red-400 hover:bg-red-400/10">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </>
                  ) : r.status === "accepted" ? (
                    <button onClick={() => handlePickup(r.id)} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                      <Navigation className="w-3 h-3" /> استلام الراكب
                    </button>
                  ) : r.status === "picked_up" ? (
                    <button onClick={() => handleComplete(r.id)} className="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> انهاء الرحلة
                    </button>
                  ) : null}
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
          <p className="text-lg font-bold">سجل الدخول لاستخدام كورسا</p>
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
          <h1 className="text-xl font-black">🚕 كورسا</h1>
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
