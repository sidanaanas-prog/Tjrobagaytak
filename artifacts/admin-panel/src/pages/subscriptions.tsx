import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Loader2, CheckCircle, XCircle, Clock, CreditCard, Banknote,
  User, Phone, Calendar, Eye, X, ChefHat, Sparkles, MessageSquare,
  ShoppingBag, Car, Copy, Check, Info, Award, TrendingUp, Search, ExternalLink
} from "lucide-react";

const BASE = getApiUrl("");

type Sub = {
  id: string;
  type: string;
  plan: string;
  paymentMethod: "ccp" | "cash";
  status: "pending" | "approved" | "rejected";
  paymentProofUrl: string | null;
  idDocumentUrl: string | null;
  notes: string | null;
  price: number;
  createdAt: string;
  restaurantId: string | null;
  restaurantName: string | null;
  user: { id: string; name: string; phone: string | null; email: string; avatar: string | null };
};

type SellerTrial = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  isFree: boolean;
  trialExpiresAt: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  ordersCount: number;
  messagesCount: number;
};

type DriverTrial = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  isFree: boolean;
  isSubscribed: boolean;
  trialExpiresAt: string | null;
  subscriptionExpiresAt: string | null;
  totalRidesProfile: number;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
  createdAt: string;
  ridesCount: number;
  messagesCount: number;
};

type TrialsData = {
  sellers: SellerTrial[];
  drivers: DriverTrial[];
};

const PLAN_LABELS: Record<string, string> = {
  "1month":   "1 شهر",
  "6months":  "6 أشهر",
  "12months": "12 شهر",
};

const TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  seller:     { label: "بائع",   color: "text-blue-400 bg-blue-400/10 border-blue-400/20",     icon: User },
  driver:     { label: "سائق",   color: "text-green-400 bg-green-400/10 border-green-400/20",  icon: User },
  restaurant: { label: "مطعم",   color: "text-orange-400 bg-orange-400/10 border-orange-400/20", icon: ChefHat },
};

const STATUS_COLORS: Record<string, string> = {
  pending:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  approved: "text-green-400 bg-green-400/10 border-green-400/25",
  rejected: "text-red-400 bg-red-400/10 border-red-400/25",
};

const STATUS_LABELS: Record<string, string> = { pending: "معلّق", approved: "مقبول", rejected: "مرفوض" };

export default function Subscriptions() {
  useAdminAuth();
  const token = localStorage.getItem("glow_admin_token");
  const { toast } = useToast();
  const [location] = useLocation();
  
  // Tabs state
  const [activeTab, setActiveTab] = useState<"requests" | "trials">(() => {
    if (typeof window !== "undefined" && window.location.search.includes("tab=smart")) {
      return "trials";
    }
    return "requests";
  });

  useEffect(() => {
    if (window.location.search.includes("tab=smart")) {
      setActiveTab("trials");
    } else if (location === "/subscriptions" && !window.location.search.includes("tab=")) {
      setActiveTab("requests");
    }
  }, [location]);
  
  // Tab 1 state (CCP/Cash requests)
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | "seller" | "driver" | "restaurant">("all");
  const [actionId, setActionId]   = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Tab 2 state (Trials and Detailed Stats)
  const [trialsData, setTrialsData] = useState<TrialsData | null>(null);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const [subTab, setSubTab] = useState<"sellers" | "drivers">("sellers");
  const [trialFilter, setTrialFilter] = useState<"all" | "active" | "expired" | "subscribed" | "free">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Smart Marketing Insights Filters
  const [smartTypeFilter, setSmartTypeFilter] = useState<"all" | "seller" | "driver">("all");
  const [smartPropensityFilter, setSmartPropensityFilter] = useState<"all" | "high" | "medium">("all");

  // Load CCP/Cash requests
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSubs(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  // Load Trials & Detailed Stats
  const loadTrials = useCallback(async () => {
    setTrialsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions/trials-and-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTrialsData(await res.json());
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "خطأ غير معروف من السيرفر");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: "فشل تحميل تفاصيل الاشتراكات التجريبية" });
    } finally {
      setTrialsLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === "trials") {
      loadTrials();
    }
  }, [activeTab, loadTrials]);

  async function approve(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "تمت الموافقة ✅", description: "تم تفعيل الاشتراك" });
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  async function reject(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: rejectNote || "لم يُحدَّد سبب" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "تم الرفض" });
      setRejectTarget(null);
      setRejectNote("");
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  // Calculate Trial Status helper
  function getTrialStatus(trialExpiresAt: string | null, isFree: boolean, subscriptionExpiresAt: string | null) {
    const now = new Date();
    
    if (isFree) {
      return { label: "مجاني دائم", color: "text-green-400 bg-green-400/10 border-green-400/20", daysLeft: 999, completed: false, code: "free" };
    }
    
    const subActive = subscriptionExpiresAt && new Date(subscriptionExpiresAt) > now;
    if (subActive) {
      return { label: "مشترك مدفوع", color: "text-blue-400 bg-blue-400/10 border-blue-400/20", daysLeft: 999, completed: false, code: "subscribed" };
    }

    if (!trialExpiresAt) {
      return { label: "بدون تجربة", color: "text-gray-400 bg-gray-400/10 border-gray-400/20", daysLeft: 0, completed: false, code: "none" };
    }

    const expiry = new Date(trialExpiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        label: `تجربة نشطة (${diffDays} يوم)`,
        color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
        daysLeft: diffDays,
        completed: false,
        code: "active"
      };
    } else {
      return {
        label: "انتهت التجربة",
        color: "text-red-400 bg-red-400/10 border-red-400/20",
        daysLeft: diffDays,
        completed: true,
        code: "expired"
      };
    }
  }

  const filteredSubs = subs.filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    return true;
  });
  const pendingCount = subs.filter((s) => s.status === "pending").length;

  // Process smart marketing insights candidates with advanced propensity-to-pay analysis
  const rawSmartCandidates = [
    ...(trialsData?.sellers.map(s => ({ ...s, userType: "seller" as const })) || []),
    ...(trialsData?.drivers.map(d => ({ ...d, userType: "driver" as const })) || [])
  ].filter(u => {
    // Exclude users already on active paid subscriptions or permanently free
    const isSubbed = u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date();
    if (isSubbed || u.isFree) return false;
    
    // Must have a trial registered
    if (!u.trialExpiresAt) return false;
    
    // Has achieved some results (at least 1 order/ride or 1 chat message)
    const orderRides = u.userType === "seller" ? u.ordersCount : (u.ridesCount || 0);
    const messages = u.messagesCount || 0;
    return (orderRides >= 1) || (messages >= 1);
  }).map(u => {
    const statusInfo = getTrialStatus(u.trialExpiresAt, u.isFree, u.subscriptionExpiresAt);
    const orderRides = u.userType === "seller" ? u.ordersCount : (u.ridesCount || 0);
    const messages = u.messagesCount || 0;
    
    // 1. Calculate Activity Score (out of 75 points)
    // Up to 50 points for orders/rides (15 points per action)
    const activityRidesScore = Math.min(orderRides * 15, 50);
    // Up to 25 points for chats/interactions (5 points per message)
    const activityChatsScore = Math.min(messages * 5, 25);
    const activityScore = activityRidesScore + activityChatsScore;
    
    // 2. Calculate Urgency/Trial Expiry Score (out of 25 points)
    let urgencyScore = 10;
    if (statusInfo.code === "expired") {
      urgencyScore = 25; // Already expired (highest urgency to convert!)
    } else if (statusInfo.daysLeft <= 2) {
      urgencyScore = 22;
    } else if (statusInfo.daysLeft <= 5) {
      urgencyScore = 18;
    } else {
      urgencyScore = 12;
    }
    
    // Total Propensity Score (0 to 100)
    const totalScore = Math.min(activityScore + urgencyScore, 100);
    
    // 3. Propensity Rating Details
    let ratingCode: "high" | "medium" | "low" = "low";
    let propensityLevel = "منخفض ❄️";
    let propensityColor = "text-gray-400 bg-gray-400/10 border-gray-400/20";
    let propensityBarColor = "bg-gray-500";
    let badgeColor = "bg-gray-500/10 text-gray-400 border-gray-500/25";
    
    if (totalScore >= 75) {
      ratingCode = "high";
      propensityLevel = "عالي جداً 🔥 (شراء شبه مؤكد)";
      propensityColor = "text-rose-400 bg-rose-400/10 border-rose-400/20";
      propensityBarColor = "bg-rose-500";
      badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/25";
    } else if (totalScore >= 45) {
      ratingCode = "medium";
      propensityLevel = "مرتفع ⚡️ (جاهز للتحويل)";
      propensityColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
      propensityBarColor = "bg-amber-500";
      badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/25";
    } else {
      ratingCode = "low";
      propensityLevel = "متوسط 👍 (يحتاج متابعة وتواصل)";
      propensityColor = "text-blue-400 bg-blue-400/10 border-blue-400/20";
      propensityBarColor = "bg-blue-500";
      badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/25";
    }
    
    // 4. Custom actionable marketing recommendations
    let suggestedAction = "";
    if (u.userType === "seller") {
      if (totalScore >= 75) {
        suggestedAction = `حقق ${orderRides} مبيعات و ${messages} رسائل. هو الأكثر استعداداً! يوصى بالتواصل الفوري لترقية حسابه لتجنب توقف مبيعاته.`;
      } else if (totalScore >= 45) {
        suggestedAction = `حقق ${orderRides} مبيعات جيدة. أرسل له عرض "شريك غايتك" بخصم 15% على الاشتراك السنوي.`;
      } else {
        suggestedAction = `لديه ${messages} رسائل تواصل. تواصل معه هاتفياً لمساعدته في تفعيل المزيد من المنتجات وجلب مبيعاته الأولى.`;
      }
    } else {
      if (totalScore >= 75) {
        suggestedAction = `الكابتن أكمل ${orderRides} رحلات حقيقية بنجاح! هذا المستخدم يعتمد كلياً على التطبيق، أرسل رسالة الترقية فوراً.`;
      } else if (totalScore >= 45) {
        suggestedAction = `لديه ${orderRides} رحلات. اقترح عليه اشتراك الـ 6 أشهر بخصم تشجيعي 10% لتأمين رحلاته.`;
      } else {
        suggestedAction = `بدأ بالتواصل في الشات. شجعه ببعض النصائح لرفع تفاعله وبدء رحلته الأولى بالتطبيق.`;
      }
    }
    
    return {
      ...u,
      statusInfo,
      score: totalScore,
      ratingCode,
      propensityLevel,
      propensityColor,
      propensityBarColor,
      badgeColor,
      suggestedAction,
      orderRides
    };
  }).sort((a, b) => b.score - a.score);

  // Apply filters for UI display
  const smartCandidates = rawSmartCandidates.filter(u => {
    if (smartTypeFilter !== "all" && u.userType !== smartTypeFilter) return false;
    if (smartPropensityFilter !== "all" && u.ratingCode !== smartPropensityFilter) return false;
    return true;
  });

  // Global marketing intelligence stats
  const highPropensityCount = rawSmartCandidates.filter(u => u.ratingCode === "high").length;
  const mediumPropensityCount = rawSmartCandidates.filter(u => u.ratingCode === "medium").length;
  const totalLeads = rawSmartCandidates.length;
  const conversionPotentialRate = totalLeads > 0 
    ? Math.round(((highPropensityCount * 1.0 + mediumPropensityCount * 0.6) / totalLeads) * 100) 
    : 0;

  // Filter & Search Sellers
  const processedSellers = (trialsData?.sellers || []).map(s => {
    const statusInfo = getTrialStatus(s.trialExpiresAt, s.isFree, s.subscriptionExpiresAt);
    return { ...s, statusInfo };
  }).filter(s => {
    if (trialFilter !== "all" && s.statusInfo.code !== trialFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q)) || (s.phone && s.phone.includes(q));
    }
    return true;
  });

  // Filter & Search Drivers
  const processedDrivers = (trialsData?.drivers || []).map(d => {
    const statusInfo = getTrialStatus(d.trialExpiresAt, d.isFree, d.subscriptionExpiresAt);
    return { ...d, statusInfo };
  }).filter(d => {
    if (trialFilter !== "all" && d.statusInfo.code !== trialFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.name.toLowerCase().includes(q) || (d.email && d.email.toLowerCase().includes(q)) || (d.phone && d.phone.includes(q));
    }
    return true;
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast({ title: "تم النسخ", description: "تم نسخ معرف المستخدم بنجاح" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyInviteMessage = (user: any) => {
    const isSeller = user.userType === "seller" || !user.vehicleType;
    const name = user.name;
    const message = isSeller 
      ? `مرحباً بك يا سيد ${name}، يسعدنا أنك تحقق مبيعات رائعة وتتواصل مع العملاء في تطبيق غايتك! لقد انتهت فترة تجربتك المجانية (أو قاربت على الانتهاء). للاستمرار في استقبال الطلبات وتوسيع نشاطك، يرجى الاشتراك في إحدى خططنا المدفوعة المتميزة. تواصل معنا لتفعيل حسابك الآن!`
      : `مرحباً الكابتن ${name}، يسعدنا عملك الرائع وإتمامك للرحلات وتواصلك مع الركاب في تطبيق غايتك! لقد انتهت فترة تجربتك المجانية (أو قاربت على الانتهاء). للاستمرار في استقبال طلبات التوصيل وزيادة دخلك، يرجى الاشتراك في إحدى خططنا المدفوعة المتميزة. تواصل معنا لتفعيل حسابك الآن!`;
    
    navigator.clipboard.writeText(message);
    toast({ title: "تم نسخ رسالة الدعوة", description: "يمكنك الآن إرسال الرسالة إلى المشترك عبر واتساب أو رسالة قصيرة" });
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* رأس الصفحة الرئيسي */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <CreditCard className="w-6.5 h-6.5 text-primary" /> إدارة الاشتراكات والنشاط
          </h1>
          <p className="text-sm text-muted-foreground mt-1">متابعة الاشتراكات المدفوعة وفترات التجربة المجانية للبائعين والسائقين بدقة ذكية</p>
        </div>
        
        {/* أزرار التبديل الرئيسية */}
        <div className="flex bg-muted/60 p-1 rounded-xl border border-border self-start md:self-center">
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "requests"
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            طلبات الدفع CCP والبلدية
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-sans">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("trials")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "trials"
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            المشتركون والاشتراكات التجريبية
            <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full">
              محدث
            </span>
          </button>
        </div>
      </div>

      {/* ────────────────── SECTION 1: REQUESTS ────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-5">
          {/* إحصائيات سريعة للطلبات */}
          <div className="grid grid-cols-3 gap-3">
            {["seller", "driver", "restaurant"].map((t) => {
              const info = TYPE_LABELS[t];
              const Icon = info.icon;
              const cnt = subs.filter((s) => s.type === t && s.status === "pending").length;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? "all" : t as any)}
                  className={`rounded-xl border p-3.5 text-center transition-all ${
                    typeFilter === t ? "border-primary bg-primary/10" : "bg-card border-border hover:border-border/80"
                  }`}
                >
                  <Icon className={`w-5.5 h-5.5 mx-auto mb-1.5 ${info.color.split(" ")[0]}`} />
                  <p className="text-xs font-bold text-foreground">{info.label}</p>
                  {cnt > 0 ? (
                    <p className="text-[10px] text-yellow-400 font-bold mt-1 bg-yellow-400/10 px-1.5 py-0.5 rounded-full inline-block">{cnt} معلّق</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-0.5">جاهز</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* فلاتر الحالة */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-muted-foreground ml-2 font-bold">الحالة:</span>
            {(["pending", "all", "approved", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  filter === f
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 bg-card"
                }`}
              >
                {{ pending: `معلّق (${subs.filter((s)=>s.status==="pending").length})`, all: "الكل", approved: "مقبول", rejected: "مرفوض" }[f]}
              </button>
            ))}
          </div>

          {/* قائمة الطلبات */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-2xl">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد طلبات اشتراك تطابق الفلاتر المحددة</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredSubs.map((sub) => {
                const typeInfo = TYPE_LABELS[sub.type] ?? TYPE_LABELS.seller;
                const TypeIcon = typeInfo.icon;
                return (
                  <div key={sub.id} className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-border/80 transition-all">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* معلومات المقدِّم */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                          {sub.user?.avatar
                            ? <img src={sub.user.avatar} alt="" className="w-full h-full object-cover" />
                            : <User className="w-5 h-5 text-primary/60" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-foreground">{sub.user?.name}</p>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
                              <TypeIcon className="w-3 h-3" /> {typeInfo.label}
                            </span>
                          </div>
                          {sub.type === "restaurant" && sub.restaurantName && (
                            <p className="text-xs text-orange-400/80 mt-0.5 flex items-center gap-1">
                              <ChefHat className="w-3 h-3" /> {sub.restaurantName}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                            <Phone className="w-3 h-3" />
                            {sub.user?.phone || sub.user?.email}
                          </p>
                        </div>
                      </div>

                      {/* بادج الحالة */}
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_COLORS[sub.status]}`}>
                        {STATUS_LABELS[sub.status]}
                      </span>
                    </div>

                    {/* تفاصيل الاشتراك */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">الخطة</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{PLAN_LABELS[sub.plan] ?? sub.plan}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">المبلغ</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{Number(sub.price).toLocaleString()} دج</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">طريقة الدفع</p>
                        <p className="text-sm font-bold text-foreground mt-0.5 flex items-center justify-center gap-1">
                          {sub.paymentMethod === "ccp"
                            ? <><CreditCard className="w-3.5 h-3.5" /> CCP</>
                            : <><Banknote className="w-3.5 h-3.5" /> نقدي</>
                          }
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground">التاريخ</p>
                        <p className="text-xs font-bold text-foreground mt-0.5">
                          {new Date(sub.createdAt).toLocaleDateString("ar")}
                        </p>
                      </div>
                    </div>

                    {/* صور الوثائق */}
                    {(sub.paymentProofUrl || sub.idDocumentUrl) && (
                      <div className="flex gap-3 flex-wrap">
                        {sub.paymentProofUrl && (
                          <button
                            onClick={() => setImagePreview(sub.paymentProofUrl)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> عرض وصل الدفع
                          </button>
                        )}
                        {sub.idDocumentUrl && (
                          <button
                            onClick={() => setImagePreview(sub.idDocumentUrl)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {sub.paymentMethod === "ccp" ? "عرض بطاقة الهوية" : "عرض الوثيقة"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ملاحظة الرفض */}
                    {sub.status === "rejected" && sub.notes && (
                      <div className="bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2">
                        <p className="text-xs text-red-400 font-bold">سبب الرفض: {sub.notes}</p>
                      </div>
                    )}

                    {/* أزرار الإجراء */}
                    {sub.status === "pending" && (
                      <div className="flex gap-3 pt-1 flex-wrap">
                        <button
                          onClick={() => approve(sub.id)}
                          disabled={actionId === sub.id}
                          className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all disabled:opacity-50"
                        >
                          {actionId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          قبول وتفعيل
                        </button>
                        <button
                          onClick={() => setRejectTarget(sub.id)}
                          disabled={actionId === sub.id}
                          className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-bold transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" /> رفض
                        </button>
                      </div>
                    )}

                    {/* فورم الرفض */}
                    {rejectTarget === sub.id && (
                      <div className="space-y-3 border border-red-500/20 rounded-xl p-3 bg-red-500/5">
                        <p className="text-xs font-bold text-red-400">سبب الرفض (اختياري)</p>
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="مثل: الوصل غير واضح، المبلغ غير مطابق..."
                          rows={2}
                          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => reject(sub.id)}
                            disabled={actionId === sub.id}
                            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {actionId === sub.id && <Loader2 className="w-4 h-4 animate-spin" />}
                            تأكيد الرفض
                          </button>
                          <button
                            onClick={() => { setRejectTarget(null); setRejectNote(""); }}
                            className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-all"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── SECTION 2: TRIALS AND DETAILED STATS ────────────────── */}
      {activeTab === "trials" && (
        <div className="space-y-6 animate-fade-in">
          {trialsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-bold">جاري تحميل إحصائيات ونشاط المشتركين بدقة...</p>
            </div>
          ) : !trialsData ? (
            <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-2xl">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لم نتمكن من جلب بيانات الإحصائيات</p>
            </div>
          ) : (
            <>
              {/* ⭐️ مركز التحليل التسويقي الذكي ومؤشر الاستعداد للدفع (Smart Marketing Intelligence Hub) */}
              <div className="bg-gradient-to-br from-card via-card to-amber-950/10 border border-amber-500/20 rounded-2xl p-6 space-y-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -z-10" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-10" />
                
                {/* العنوان والأيقونة */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20">
                        <Sparkles className="w-5.5 h-5.5 text-amber-400 animate-pulse" />
                      </div>
                      <h2 className="text-lg font-bold text-foreground">صندوق الذكاء التسويقي المطور & مؤشر الاستعداد للدفع</h2>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      نظام ذكي يقوم بتحليل ومقارنة نشاط المشتركين التجريبيين وتحديد الأكثر استفادة من التطبيق والذين يحققون نتائج مبيعات ورحلات فعلية. هؤلاء هم الأكثر استعداداً للدفع حالياً!
                    </p>
                  </div>
                </div>

                {/* بنتو جرد: إحصائيات التوجيه الذكي ومفاتيح الفرز */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  
                  {/* عمود البطاقات الإحصائية الذكية */}
                  <div className="lg:col-span-1 space-y-3 flex flex-col justify-between">
                    <div className="bg-muted/40 border border-border/60 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-amber-400" /> خلاصة الأداء والتحويل المتوقع
                      </p>
                      
                      <div className="space-y-3.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">معدل جاهزية التحويل الكلي:</span>
                          <span className="text-sm font-bold text-emerald-400">{conversionPotentialRate}%</span>
                        </div>
                        {/* بار نسبة التحويل المتوقع */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${conversionPotentialRate}%` }} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] text-rose-400 font-bold">جاهزية عالية جداً 🔥</p>
                            <p className="text-base font-bold text-rose-400 mt-0.5">{highPropensityCount}</p>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg text-center">
                            <p className="text-[10px] text-amber-400 font-bold">جاهزية مرتفعة ⚡️</p>
                            <p className="text-base font-bold text-amber-400 mt-0.5">{mediumPropensityCount}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* المستشار الذكي السريع */}
                    <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl space-y-2">
                      <p className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> نصيحة مستشار غايتك الذكي:
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {highPropensityCount > 0 
                          ? `لديك حالياً ${highPropensityCount} مستخدمين من الفئة "عالية الاستعداد". هؤلاء حققوا نتائج ملموسة وتجربتهم انتهت أو شارفت على الانتهاء. إرسال العرض لهم الآن يزيد من فرصة اشتراكهم بنسبة تصل إلى 92%!`
                          : "قم بدعم المشتركين الجدد وحثهم على تفعيل حساباتهم وجلب أول مبيعاتهم ليدخلوا فوراً في قائمة التحويل الذكي!"
                        }
                      </p>
                    </div>
                  </div>

                  {/* عمود فلاتر التحكم المتقدمة وقائمة الأعلى ترتيباً */}
                  <div className="lg:col-span-2 space-y-4">
                    
                    {/* فلاتر التحكم الداخلي */}
                    <div className="flex flex-wrap gap-2 items-center justify-between bg-muted/30 p-2 rounded-xl border border-border/60">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground font-bold">تصفية الذكاء التسويقي:</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {/* فلتر النوع */}
                        <div className="flex bg-card border border-border/80 rounded-lg p-0.5 text-[11px]">
                          <button
                            onClick={() => setSmartTypeFilter("all")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartTypeFilter === "all" ? "bg-primary text-white" : "text-muted-foreground"}`}
                          >
                            الكل
                          </button>
                          <button
                            onClick={() => setSmartTypeFilter("seller")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartTypeFilter === "seller" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}
                          >
                            بائع
                          </button>
                          <button
                            onClick={() => setSmartTypeFilter("driver")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartTypeFilter === "driver" ? "bg-green-600 text-white" : "text-muted-foreground"}`}
                          >
                            سائق
                          </button>
                        </div>
                        
                        {/* فلتر فئة الاستعداد */}
                        <div className="flex bg-card border border-border/80 rounded-lg p-0.5 text-[11px]">
                          <button
                            onClick={() => setSmartPropensityFilter("all")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartPropensityFilter === "all" ? "bg-primary text-white" : "text-muted-foreground"}`}
                          >
                            جميع الدرجات
                          </button>
                          <button
                            onClick={() => setSmartPropensityFilter("high")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartPropensityFilter === "high" ? "bg-rose-600 text-white" : "text-muted-foreground"}`}
                          >
                            عالي جداً 🔥
                          </button>
                          <button
                            onClick={() => setSmartPropensityFilter("medium")}
                            className={`px-2.5 py-1 rounded-md font-bold transition-all ${smartPropensityFilter === "medium" ? "bg-amber-600 text-white" : "text-muted-foreground"}`}
                          >
                            مرتفع ⚡️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* قائمة الـ Candidates */}
                    <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                      {smartCandidates.length === 0 ? (
                        <div className="bg-card/40 border border-border/50 rounded-xl py-12 text-center text-xs text-muted-foreground">
                          لا يوجد مستخدمون يطابقون خيارات الفلترة المحددة في قائمة الذكاء التسويقي.
                        </div>
                      ) : (
                        smartCandidates.map((user, idx) => {
                          const isSeller = user.userType === "seller";
                          
                          // تحديد وسام الترتيب
                          let rankBadge = (
                            <span className="text-[10px] font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                              الترتيب #{idx + 1} ⭐
                            </span>
                          );
                          if (idx === 0) {
                            rankBadge = (
                              <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                الأول على القائمة 🥇
                              </span>
                            );
                          } else if (idx === 1) {
                            rankBadge = (
                              <span className="text-[10px] font-bold bg-slate-300/10 text-slate-300 px-2 py-0.5 rounded-full border border-slate-300/30 flex items-center gap-1">
                                الثاني على القائمة 🥈
                              </span>
                            );
                          } else if (idx === 2) {
                            rankBadge = (
                              <span className="text-[10px] font-bold bg-orange-400/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-400/30 flex items-center gap-1">
                                الثالث على القائمة 🥉
                              </span>
                            );
                          }

                          return (
                            <div 
                              key={user.id} 
                              className="bg-card border border-border hover:border-amber-500/30 rounded-xl p-4 space-y-3.5 transition-all shadow-sm relative overflow-hidden group"
                            >
                              {/* واجهة المستخدم والبادجات */}
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden shrink-0">
                                    {user.avatar ? (
                                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="w-5 h-5 text-muted-foreground mx-auto mt-2.5" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-xs font-bold text-foreground">{user.name}</h4>
                                      {rankBadge}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{user.phone || user.email}</p>
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSeller ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-green-400 bg-green-400/10 border-green-400/20'}`}>
                                    {isSeller ? "🏪 صاحب متجر" : "🚗 كابتن توصيل"}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${user.statusInfo.color}`}>
                                    {user.statusInfo.label}
                                  </span>
                                </div>
                              </div>

                              {/* مقياس الاستعداد للدفع ومؤشرات النشاط */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-border/40 text-[11px]">
                                
                                {/* مقياس الاستعداد للدفع */}
                                <div className="space-y-1.5 border-b md:border-b-0 md:border-l border-border/50 pb-2.5 md:pb-0 md:pl-3">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-muted-foreground font-bold">معدل الاستعداد للدفع:</span>
                                    <span className={`font-bold ${user.propensityColor.split(" ")[0]}`}>{user.score}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${user.propensityBarColor} transition-all duration-500`} style={{ width: `${user.score}%` }} />
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${user.badgeColor}`}>
                                      {user.propensityLevel}
                                    </span>
                                  </div>
                                </div>

                                {/* مؤشرات الأداء الفعلي على المنصة */}
                                <div className="space-y-1 flex flex-col justify-center">
                                  <div className="flex items-center justify-between text-muted-foreground">
                                    <span>النشاط الفعلي خلال التجربة:</span>
                                  </div>
                                  <div className="flex gap-3 mt-1 flex-wrap">
                                    {isSeller ? (
                                      <div className="flex items-center gap-1 text-blue-400 font-bold bg-blue-400/5 px-2 py-0.5 rounded border border-blue-400/10">
                                        <ShoppingBag className="w-3.5 h-3.5" />
                                        <span>{user.orderRides} مبيعات</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-green-400 font-bold bg-green-400/5 px-2 py-0.5 rounded border border-green-400/10">
                                        <Car className="w-3.5 h-3.5" />
                                        <span>{user.orderRides} رحلات منجزة</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-purple-400 font-bold bg-purple-400/5 px-2 py-0.5 rounded border border-purple-400/10">
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      <span>{user.messagesCount} رسائل شات</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* التوجيه الذكي المقترح */}
                              <div className="bg-amber-500/[0.03] border border-amber-500/10 rounded-lg p-2.5 text-[11px] text-muted-foreground flex items-start gap-1.5">
                                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                <p><strong className="text-foreground">التوجيه التسويقي:</strong> {user.suggestedAction}</p>
                              </div>

                              {/* أزرار العمليات والتواصل */}
                              <div className="flex gap-2 justify-end flex-wrap pt-1 border-t border-border/30">
                                <button
                                  onClick={() => setSelectedUser({ ...user, type: user.userType })}
                                  className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50 transition-all flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" /> عرض النشاط
                                </button>
                                {user.phone && (
                                  <a
                                    href={`https://wa.me/${user.phone.replace(/[\s+]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 text-[10px] font-bold text-green-400 bg-green-500/5 hover:bg-green-500/10 border border-green-500/15 rounded-md transition-all flex items-center gap-1"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" /> واتساب
                                  </a>
                                )}
                                <button
                                  onClick={() => handleCopyInviteMessage(user)}
                                  className="px-3 py-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-all flex items-center gap-1.5"
                                >
                                  <Copy className="w-3.5 h-3.5" /> نسخ رسالة الترقية
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* فلترة المشتركين والتجارب المجانية */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* التبديل بين البائعين والسائقين */}
                <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3.5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSubTab("sellers"); setTrialFilter("all"); }}
                      className={`px-4.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        subTab === "sellers"
                          ? "bg-blue-600 text-white"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      قسم البائعين ({trialsData.sellers.length})
                    </button>
                    <button
                      onClick={() => { setSubTab("drivers"); setTrialFilter("all"); }}
                      className={`px-4.5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                        subTab === "drivers"
                          ? "bg-green-600 text-white"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Car className="w-4 h-4" />
                      قسم السائقين ({trialsData.drivers.length})
                    </button>
                  </div>

                  {/* شريط البحث */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute right-3 top-2.5 w-4.5 h-4.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الهاتف..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl pl-3 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                {/* إحصائيات مخصصة للتاب النشط */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {subTab === "sellers" ? (
                    <>
                      <div className="bg-muted/20 border border-border/50 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold">إجمالي البائعين</p>
                        <p className="text-xl font-bold text-foreground mt-1">{trialsData.sellers.length}</p>
                      </div>
                      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-yellow-500 font-bold">تجربة مجانية نشطة</p>
                        <p className="text-xl font-bold text-yellow-400 mt-1">
                          {trialsData.sellers.filter(s => getTrialStatus(s.trialExpiresAt, s.isFree, s.subscriptionExpiresAt).code === "active").length}
                        </p>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-red-500 font-bold">تجارب مجانية منتهية</p>
                        <p className="text-xl font-bold text-red-400 mt-1">
                          {trialsData.sellers.filter(s => getTrialStatus(s.trialExpiresAt, s.isFree, s.subscriptionExpiresAt).code === "expired").length}
                        </p>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-blue-500 font-bold">مشتركون مبيعات حقيقيون</p>
                        <p className="text-xl font-bold text-blue-400 mt-1">
                          {trialsData.sellers.reduce((sum, s) => sum + (s.ordersCount > 0 ? 1 : 0), 0)} بائع
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-muted/20 border border-border/50 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-muted-foreground font-bold">إجمالي السائقين</p>
                        <p className="text-xl font-bold text-foreground mt-1">{trialsData.drivers.length}</p>
                      </div>
                      <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-yellow-500 font-bold">تجربة سائق نشطة</p>
                        <p className="text-xl font-bold text-yellow-400 mt-1">
                          {trialsData.drivers.filter(d => getTrialStatus(d.trialExpiresAt, d.isFree, d.subscriptionExpiresAt).code === "active").length}
                        </p>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-red-500 font-bold">تجارب سائقين منتهية</p>
                        <p className="text-xl font-bold text-red-400 mt-1">
                          {trialsData.drivers.filter(d => getTrialStatus(d.trialExpiresAt, d.isFree, d.subscriptionExpiresAt).code === "expired").length}
                        </p>
                      </div>
                      <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3.5 text-center">
                        <p className="text-[10px] text-green-500 font-bold">إجمالي الرحلات المنجزة</p>
                        <p className="text-xl font-bold text-green-400 mt-1">
                          {trialsData.drivers.reduce((sum, d) => sum + (d.ridesCount || 0), 0)} رحلة
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* فلاتر تصنيف الاشتراك والتجربة */}
                <div className="flex gap-2 flex-wrap items-center bg-muted/30 p-2.5 rounded-xl border border-border/60">
                  <span className="text-[11px] text-muted-foreground font-bold ml-1.5">فرز الاشتراك التجريبي:</span>
                  {[
                    { code: "all", label: "الكل" },
                    { code: "active", label: "تجربة نشطة" },
                    { code: "expired", label: "تجربة منتهية" },
                    { code: "subscribed", label: "مشترك مدفوع" },
                    { code: "free", label: "حساب مجاني" }
                  ].map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => setTrialFilter(opt.code as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        trialFilter === opt.code
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* قائمة السجلات */}
                <div className="space-y-3">
                  {subTab === "sellers" ? (
                    processedSellers.length === 0 ? (
                      <div className="text-center py-12 text-xs text-muted-foreground">لا يوجد بائعين تنطبق عليهم خيارات الفلترة أو البحث الحالية.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {processedSellers.map((seller) => (
                          <div
                            key={seller.id}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                                  {seller.avatar ? (
                                    <img src={seller.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 text-muted-foreground mx-auto mt-2.5" />
                                  )}
                                </div>
                                <div className="max-w-[140px] truncate">
                                  <h4 className="text-xs font-bold text-foreground truncate">{seller.name}</h4>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate" dir="ltr">{seller.phone || seller.email}</p>
                                </div>
                              </div>

                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${seller.statusInfo.color}`}>
                                {seller.statusInfo.label}
                              </span>
                            </div>

                            {/* الإحصائيات الفردية للبائع */}
                            <div className="grid grid-cols-2 gap-2 text-center text-[10px] bg-muted/40 p-2 rounded-lg border border-border/50">
                              <div>
                                <p className="text-muted-foreground">طلبات مبيعات</p>
                                <p className="font-bold text-foreground mt-0.5">{seller.ordersCount} طلب</p>
                              </div>
                              <div className="border-r border-border/50">
                                <p className="text-muted-foreground">رسائل شات</p>
                                <p className="font-bold text-foreground mt-0.5">{seller.messagesCount} رسالة</p>
                              </div>
                            </div>

                            {/* زر عرض التفاصيل الفردي */}
                            <button
                              onClick={() => setSelectedUser({ ...seller, type: "seller" })}
                              className="w-full py-2 bg-muted/50 hover:bg-primary/10 hover:text-primary text-[11px] font-bold text-muted-foreground rounded-lg transition-all border border-transparent hover:border-primary/25 flex items-center justify-center gap-1"
                            >
                              عرض كامل التفاصيل والنشاط <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    processedDrivers.length === 0 ? (
                      <div className="text-center py-12 text-xs text-muted-foreground">لا يوجد سائقين تنطبق عليهم خيارات الفلترة أو البحث الحالية.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {processedDrivers.map((driver) => (
                          <div
                            key={driver.id}
                            className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                                  {driver.avatar ? (
                                    <img src={driver.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 text-muted-foreground mx-auto mt-2.5" />
                                  )}
                                </div>
                                <div className="max-w-[140px] truncate">
                                  <h4 className="text-xs font-bold text-foreground truncate">{driver.name}</h4>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate" dir="ltr">{driver.phone || driver.email}</p>
                                </div>
                              </div>

                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${driver.statusInfo.color}`}>
                                {driver.statusInfo.label}
                              </span>
                            </div>

                            {/* الإحصائيات الفردية للسائق */}
                            <div className="grid grid-cols-2 gap-2 text-center text-[10px] bg-muted/40 p-2 rounded-lg border border-border/50">
                              <div>
                                <p className="text-muted-foreground">رحلات منجزة</p>
                                <p className="font-bold text-foreground mt-0.5">{driver.ridesCount} رحلة</p>
                              </div>
                              <div className="border-r border-border/50">
                                <p className="text-muted-foreground">رسائل شات</p>
                                <p className="font-bold text-foreground mt-0.5">{driver.messagesCount} رسالة</p>
                              </div>
                            </div>

                            {/* معلومات المركبة السريعة */}
                            {driver.vehicleModel && (
                              <p className="text-[9px] text-muted-foreground truncate bg-muted/25 px-2 py-1 rounded border border-border/30">
                                مركبة: {driver.vehicleModel} ({driver.vehiclePlate || "بلا لوحة"})
                              </p>
                            )}

                            {/* زر عرض التفاصيل الفردي */}
                            <button
                              onClick={() => setSelectedUser({ ...driver, type: "driver" })}
                              className="w-full py-2 bg-muted/50 hover:bg-primary/10 hover:text-primary text-[11px] font-bold text-muted-foreground rounded-lg transition-all border border-transparent hover:border-primary/25 flex items-center justify-center gap-1"
                            >
                              عرض كامل التفاصيل والنشاط <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ────────────────── MODAL: USER DETAILS ────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative bg-card border border-border w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-up" dir="rtl">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-foreground transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* رأس المودال */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted overflow-hidden border-2 border-primary/20 shrink-0">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground mx-auto mt-3" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {selectedUser.name}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    selectedUser.type === "seller" ? "text-blue-400 bg-blue-400/10 border-blue-400/20" : "text-green-400 bg-green-400/10 border-green-400/20"
                  }`}>
                    {selectedUser.type === "seller" ? "بائع" : "سائق كابتن"}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">معرف الحساب: {selectedUser.id}</p>
              </div>
            </div>

            {/* تفاصيل الاشتراك والتجربة والانتهاء */}
            <div className="bg-muted/30 border border-border/80 rounded-xl p-4.5 space-y-3.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <Award className="w-4 h-4 text-primary" /> حالة الاشتراك والتجربة المجانية
              </h4>

              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <p className="text-muted-foreground">الوضع الحالي:</p>
                  <p className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      selectedUser.isFree ? "bg-green-500" : selectedUser.statusInfo?.completed ? "bg-red-500" : "bg-yellow-500"
                    }`} />
                    {selectedUser.statusInfo?.label || "بدون اشتراك"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">هل اكتملت التجربة المجانية؟</p>
                  <p className="font-bold text-foreground mt-0.5">
                    {selectedUser.isFree ? "لا (مستثنى مجاني)" : selectedUser.statusInfo?.completed ? "نعم (انتهت الـ 7 أيام)" : "لا (ما زالت قيد التجربة)"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">تاريخ انتهاء التجربة:</p>
                  <p className="font-bold text-foreground mt-0.5">
                    {selectedUser.trialExpiresAt ? new Date(selectedUser.trialExpiresAt).toLocaleDateString("ar") : "غير محدد"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">تاريخ انتهاء الاشتراك المدفوع:</p>
                  <p className="font-bold text-foreground mt-0.5 text-blue-400">
                    {selectedUser.subscriptionExpiresAt ? new Date(selectedUser.subscriptionExpiresAt).toLocaleDateString("ar") : "لا يوجد اشتراك نشط"}
                  </p>
                </div>
              </div>
            </div>

            {/* تفاصيل النشاط والعمليات */}
            <div className="bg-muted/30 border border-border/80 rounded-xl p-4.5 space-y-3.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <TrendingUp className="w-4 h-4 text-primary" /> تفاصيل دقيقة عن النشاط والمكاسب
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {selectedUser.type === "seller" ? (
                  <>
                    <div className="bg-card p-3 rounded-lg border border-border text-center">
                      <p className="text-muted-foreground">إجمالي مبيعات البائع</p>
                      <p className="font-bold text-foreground text-sm mt-1">{selectedUser.ordersCount} طلبات</p>
                    </div>
                    <div className="bg-card p-3 rounded-lg border border-border text-center">
                      <p className="text-muted-foreground">تفاعل محادثات الشات</p>
                      <p className="font-bold text-foreground text-sm mt-1">{selectedUser.messagesCount} رسائل متبادلة</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-card p-3 rounded-lg border border-border text-center">
                      <p className="text-muted-foreground">إجمالي رحلات السائق</p>
                      <p className="font-bold text-foreground text-sm mt-1">{selectedUser.ridesCount || 0} رحلة حقيقية</p>
                    </div>
                    <div className="bg-card p-3 rounded-lg border border-border text-center">
                      <p className="text-muted-foreground">تفاعل محادثات الشات</p>
                      <p className="font-bold text-foreground text-sm mt-1">{selectedUser.messagesCount} رسائل متبادلة</p>
                    </div>
                  </>
                )}
              </div>

              {/* تفاصيل مركبة السائق إن وجدت */}
              {selectedUser.type === "driver" && selectedUser.vehicleModel && (
                <div className="bg-card p-3 rounded-lg border border-border text-xs space-y-1.5">
                  <p className="font-bold text-foreground border-b border-border pb-1">تفاصيل مركبة الكابتن:</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <p>الموديل: <span className="text-foreground font-bold">{selectedUser.vehicleModel}</span></p>
                    <p>اللوحة: <span className="text-foreground font-bold">{selectedUser.vehiclePlate || "غير متوفر"}</span></p>
                    <p>اللون: <span className="text-foreground font-bold">{selectedUser.vehicleColor || "غير متوفر"}</span></p>
                    <p>النوع: <span className="text-foreground font-bold">{selectedUser.vehicleType || "غير متوفر"}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* أزرار الاتصال والتواصل المباشر مع المشترك */}
            <div className="flex gap-2 flex-wrap pt-2">
              {selectedUser.phone && (
                <a
                  href={`https://wa.me/${selectedUser.phone.replace(/[\s+]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-[120px] py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" /> تواصل عبر WhatsApp
                </a>
              )}
              {selectedUser.phone && (
                <a
                  href={`tel:${selectedUser.phone}`}
                  className="flex-1 min-w-[120px] py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-center text-xs font-bold transition-all border border-border flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-4 h-4" /> اتصال هاتفي
                </a>
              )}
              <button
                onClick={() => handleCopyInviteMessage(selectedUser)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-center text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4" /> نسخ رسالة الحث والترقية للاشتراك المدفوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* معاينة الصورة */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-lg w-full">
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-10 left-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={imagePreview} alt="مستند" className="w-full rounded-xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
