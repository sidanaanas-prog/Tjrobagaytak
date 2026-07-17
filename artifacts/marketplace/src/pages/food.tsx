import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Clock, Home, Sparkles, MapPin, Flame, ChevronRight, LayoutDashboard, Trophy, Gift, Calendar, Share2, Copy, Users, AlertCircle, HelpCircle, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { getApiUrl } from "@/lib/api-url";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const BASE = getApiUrl("");

const CATEGORIES = ["الكل", "فلل فاخرة", "شاليهات", "قاعات كبيرة", "منازل ريفية", "خيم ومساحات مفتوحة", "أخرى"];

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  category: string;
  address: string;
  isOpen: boolean;
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  rating: string;
  ratingCount: number;
  isFeatured: boolean;
};

function RestaurantCard({ r }: { r: Restaurant }) {
  return (
    <Link href={`/food/${r.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-primary/30 transition-all"
      >
        {/* Cover */}
        <div className="relative h-36 bg-gradient-to-br from-primary/20 to-secondary/20">
          {r.coverImage ? (
            <img src={r.coverImage} alt={r.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="w-12 h-12 text-white/20" />
            </div>
          )}
          {r.isFeatured && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/90 text-white text-[10px] font-bold">
              <Flame className="w-3 h-3" /> مميز
            </div>
          )}
          {!r.isOpen && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white/70 font-bold text-sm">مغلق الآن</span>
            </div>
          )}
          {/* Logo */}
          <div className="absolute -bottom-5 right-4 w-12 h-12 rounded-xl overflow-hidden border-2 border-background bg-black/80">
            {r.logo ? (
              <img src={r.logo} alt={r.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/30">
                <span className="text-white font-bold text-lg">{r.name[0]}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="pt-7 pb-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-sm">{r.name}</h3>
              <p className="text-xs text-white/40 mt-0.5">{r.category}</p>
            </div>
            {Number(r.rating) > 0 && (
              <div className="flex items-center gap-1 text-yellow-400 shrink-0">
                <Star className="w-3.5 h-3.5 fill-yellow-400" />
                <span className="text-xs font-bold">{Number(r.rating).toFixed(1)}</span>
              </div>
            )}
          </div>
          {r.description && (
            <p className="text-[11px] text-white/30 mt-1.5 line-clamp-1">{r.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white/50">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>تأكيد خلال {r.estimatedDeliveryMinutes} د</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{Number(r.deliveryFee) === 0 ? "تأمين مجاني" : `تأمين: ${r.deliveryFee} دج`}</span>
            </div>
            {Number(r.minOrder) > 0 && (
              <span>حد أدنى للحجز {r.minOrder} دج</span>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function FoodPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // 1. حالات المسابقة (Competition States)
  const [competition, setCompetition] = useState<{
    enabled: boolean;
    status: string;
    prize: string;
    terms: string;
    endTime: string;
    winnerId: string | null;
    winnerProfile: any | null;
    leaderboard: any[];
    userParticipant: any | null;
  } | null>(null);

  const [compLoading, setCompLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  // 2. حالات المناسبات (Event Homes States)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("الكل");
  const [search, setSearch] = useState("");

  const fetchCompetition = async () => {
    try {
      const token = getMemToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const r = await fetch(`${BASE}/api/competition/status`, { headers });
      if (r.ok) {
        const data = await r.json();
        setCompetition(data);
      }
    } catch (e) {
      console.error("Error fetching competition status:", e);
    } finally {
      setCompLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetition();
  }, [user]);

  useEffect(() => {
    if (competition && !competition.enabled) {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== "الكل") params.set("category", category);
      if (search) params.set("q", search);
      fetch(`${BASE}/api/restaurants?${params}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => { setRestaurants(Array.isArray(data) ? data : []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [category, search, competition]);

  // الاشتراك في المسابقة
  const handleJoinCompetition = async () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    setJoining(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/competition/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الاشتراك");

      toast({
        title: "تم الاشتراك بنجاح! 🎉",
        description: `كود الإحالة الخاص بك هو: ${data.inviteCode}`
      });
      fetchCompetition();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الاشتراك",
        description: err.message
      });
    } finally {
      setJoining(false);
    }
  };

  const handleCopyLink = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: "تم نسخ كود الإحالة! 📋",
      description: "شاركه الآن مع أصدقائك الركاب للحصول على نقاط المسابقة."
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = user?.role === "admin";

  // تصفية المناسبات العادية
  const featured = restaurants.filter((r) => r.isFeatured);
  const rest = restaurants.filter((r) => !r.isFeatured);

  // إذا تم تحميل بيانات المسابقة وكانت مفعلة، نعرض قسم المسابقات
  if (!compLoading && competition?.enabled) {
    const leaderboard = competition.leaderboard || [];
    const top1 = leaderboard[0] || null;
    const top2 = leaderboard[1] || null;
    const top3 = leaderboard[2] || null;
    const remaining = leaderboard.slice(3);

    const isJoined = !!competition.userParticipant;
    const userPart = competition.userParticipant;

    const statusBadgeColor = 
      competition.status === "open" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
      competition.status === "preparing" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
      "bg-red-500/10 text-red-400 border-red-500/20";

    const statusText = 
      competition.status === "open" ? "نشطة الآن 🔥" :
      competition.status === "preparing" ? "قيد التجهيز ⏳" :
      "منتهية 🏁";

    return (
      <AppLayout>
        <div className="flex flex-col pb-28 px-4" dir="rtl">
          {/* Header */}
          <div className="pt-10 pb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-primary font-bold tracking-widest uppercase font-mono">منافسة حية</p>
              <h1 className="text-2xl font-black text-white flex items-center gap-1.5 mt-0.5">
                🏆 <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">مسابقة غايتك</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchCompetition}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                title="تحديث البيانات"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white/60" />
              </button>
              {isAdmin && (
                <Link href="/food/dashboard">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
                    title="لوحة الإدارة"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-primary" />
                  </motion.button>
                </Link>
              )}
            </div>
          </div>

          {/* Winner Banner if Finished */}
          {competition.status === "finished" && competition.winnerProfile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-yellow-500/20 via-orange-500/10 to-transparent border border-yellow-500/30 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400" />
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
              <h3 className="text-lg font-black text-white">انتهت المسابقة وتم إعلان الفائز! 🎉</h3>
              <p className="text-xs text-white/50 mt-1">نهنئ الفائز بالمركز الأول لحصوله على أكبر عدد من الإحالات الناجحة</p>
              
              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden bg-black/40">
                  {competition.winnerProfile.avatar ? (
                    <img src={competition.winnerProfile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-yellow-400/20 text-yellow-400 font-bold">
                      {competition.winnerProfile.name[0]}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{competition.winnerProfile.name}</p>
                  <p className="text-xs text-yellow-400 font-mono font-bold">{competition.winnerProfile.points} نقطة إحالة</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between relative overflow-hidden">
              {competition.status === "open" && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-full blur-xl pointer-events-none animate-pulse" />
              )}
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-primary" /> الجائزة الكبرى
              </span>
              <span className="text-base font-black text-white mt-1.5">{competition.prize}</span>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between relative overflow-hidden">
              {competition.status === "open" && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none animate-pulse" />
              )}
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-secondary" /> حالة المنافسة
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border w-fit mt-2 flex items-center gap-1.5 ${statusBadgeColor}`}>
                {competition.status === "open" && (
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                  </span>
                )}
                {statusText}
              </span>
            </div>
          </div>

          {/* Top 3 Podium Cards */}
          {leaderboard.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                ✨ <span className="text-white/80">المراكز الثلاثة الأولى</span>
              </h2>

              <div className="grid grid-cols-3 gap-2.5 items-end pt-6 pb-2 px-1">
                {/* 2nd place (Left) */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-13 h-13 rounded-full border-2 border-slate-400 overflow-hidden bg-black/40">
                      {top2?.avatar ? (
                        <img src={top2.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-400/15 text-slate-400 font-bold text-sm">
                          {top2 ? top2.name[0] : "؟"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-slate-400 text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                      2
                    </div>
                  </div>
                  <div className="mt-2 text-center w-full">
                    <p className="text-[11px] font-bold text-white/80 truncate px-1">{top2 ? top2.name : "شاغر"}</p>
                    <p className="text-[10px] text-slate-400 font-bold font-mono">{top2 ? `${top2.points} ن` : "—"}</p>
                  </div>
                  <div className="w-full h-12 bg-gradient-to-t from-slate-400/5 to-slate-400/20 border-t border-slate-400/30 rounded-t-xl mt-2 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* 1st place (Center - Tallest) */}
                <div className="flex flex-col items-center">
                  <div className="relative -mt-6">
                    <div className="w-16 h-16 rounded-full border-2 border-yellow-400 overflow-hidden bg-black/40 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                      {top1?.avatar ? (
                        <img src={top1.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-yellow-400/15 text-yellow-400 font-bold text-base">
                          {top1 ? top1.name[0] : "؟"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                      1
                    </div>
                  </div>
                  <div className="mt-2 text-center w-full">
                    <p className="text-xs font-black text-white truncate px-1">{top1 ? top1.name : "شاغر"}</p>
                    <p className="text-[11px] text-yellow-400 font-black font-mono">{top1 ? `${top1.points} نقطة` : "—"}</p>
                  </div>
                  <div className="w-full h-18 bg-gradient-to-t from-yellow-400/5 to-yellow-400/25 border-t-2 border-yellow-400/50 rounded-t-xl mt-2 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]" />
                  </div>
                </div>

                {/* 3rd place (Right) */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-13 h-13 rounded-full border-2 border-amber-600 overflow-hidden bg-black/40">
                      {top3?.avatar ? (
                        <img src={top3.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-600/15 text-amber-600 font-bold text-sm">
                          {top3 ? top3.name[0] : "؟"}
                        </div>
                      )}
                    </div>
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-600 text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg">
                      3
                    </div>
                  </div>
                  <div className="mt-2 text-center w-full">
                    <p className="text-[11px] font-bold text-white/80 truncate px-1">{top3 ? top3.name : "شاغر"}</p>
                    <p className="text-[10px] text-amber-500 font-bold font-mono">{top3 ? `${top3.points} ن` : "—"}</p>
                  </div>
                  <div className="w-full h-9 bg-gradient-to-t from-amber-600/5 to-amber-600/20 border-t border-amber-600/30 rounded-t-xl mt-2 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Participation Panel */}
          <div className="mb-6">
            {!isJoined ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-primary/15 via-black/40 to-background border border-primary/30 text-center"
              >
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-2 animate-pulse" />
                <h3 className="text-sm font-black text-white">
                  {competition.status === "preparing" 
                    ? "المسابقة قيد التجهيز... احجز مقعدك واظهر اهتمامك! ⏳"
                    : "هل تريد الصعود في لائحة الصدارة والفوز؟"}
                </h3>
                <p className="text-xs text-white/50 mt-1 font-sans leading-relaxed">
                  {competition.status === "preparing"
                    ? "احجز مقعدك الآن لتكون من أوائل المشاركين والمهتمين فور انطلاق المسابقة رسمياً وكسب نقاط الإحالة!"
                    : "اشترك الآن بضغطة زر، انسخ كود إحالتك، واكسب نقطة واحدة عن كل راكب يجلب رحلة ويكملها!"}
                </p>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleJoinCompetition}
                  disabled={joining || (competition.status !== "open" && competition.status !== "preparing")}
                  className="w-full py-3 rounded-xl bg-primary text-white text-xs font-black shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all mt-4 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {joining ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : competition.status === "preparing" ? (
                    <>احجز مقعدي الآن! 🚀</>
                  ) : (
                    <>أنا جاهز للاشتراك الآن! 🚀</>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-white/5 to-black/30 border border-white/10"
              >
                <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                  <div>
                    <p className="text-xs text-white/40">المركز الخاص بك</p>
                    <p className="text-xl font-black text-primary mt-1 font-mono">
                      #{userPart.rank} <span className="text-xs text-white/40 font-normal">من أصل {leaderboard.length}</span>
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-white/40">مجموع النقاط</p>
                    <p className="text-xl font-black text-white mt-1 font-mono">{userPart.points} نقطة</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-white/80 mb-2">كود الإحالة الخاص بك</p>
                  <p className="text-[10px] text-white/40 mb-3 leading-relaxed">
                    انسخ كود الإحالة الخاص بك وأرسله لأصدقائك الركاب. بمجرد أن يسجلوا باستخدامه ويقوموا بإتمام أول رحلة لهم (كورسا)، ستضاف نقطة واحدة تلقائياً إلى محفظتك في هذه المسابقة!
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white/70 select-all truncate text-left" dir="ltr">
                      {userPart.inviteCode}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCopyLink(userPart.inviteCode)}
                      className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors shrink-0"
                      title="نسخ كود الإحالة"
                    >
                      <Copy className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Remaining Competitors */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" /> <span className="text-white/80">لوحة الصدارة الكاملة</span>
            </h2>

            {remaining.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-6 bg-white/5 rounded-2xl border border-white/5">لا يوجد مشاركون آخرون حالياً</p>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden divide-y divide-white/5">
                {remaining.map((item) => {
                  const isCurrentUser = item.userId === user?.id;
                  return (
                    <div key={item.userId} className={`flex items-center justify-between p-3 px-4 ${isCurrentUser ? "bg-primary/10" : ""}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-white/30 font-bold w-4">#{item.rank}</span>
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-black/40">
                          {item.avatar ? (
                            <img src={item.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/60 text-[10px] font-bold">
                              {item.name[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white flex items-center gap-1">
                            {item.name}
                            {isCurrentUser && <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/30 text-primary border border-primary/40">أنت</span>}
                          </p>
                          <p className="text-[10px] text-white/30">كود: {item.inviteCode}</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">{item.points} نقطة</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Terms & Conditions Accordion/Card */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0" /> شروط وميكانيكية المسابقة
            </h3>
            <p className="text-[11px] text-white/50 leading-relaxed whitespace-pre-line">
              {competition.terms}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── الحالة الافتراضية: المناسبات العادية (إذا كانت المسابقة غير مفعلة) ──
  return (
    <AppLayout>
      <div className="flex flex-col pb-24" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground tracking-widest uppercase font-mono">احجز الآن</p>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                🏠 <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">منازل المناسبات</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link href="/food/dashboard">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
                    title="لوحة الإدارة"
                  >
                    <LayoutDashboard className="w-4 h-4 text-white/50" />
                  </motion.button>
                </Link>
              )}
              <Link href="/food/orders">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold"
                >
                  حجوزاتي <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                </motion.button>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منزل مناسبات أو قاعة..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors"
              dir="rtl"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-5 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.92 }}
                onClick={() => setCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  category === cat
                    ? "bg-primary text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                    : "bg-white/5 text-white/50 border border-white/10"
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-4 space-y-6">
          {loading ? (
            <div className="space-y-3 mt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-white/5 border border-white/10 h-52 animate-pulse" />
              ))}
            </div>
          ) : restaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Home className="w-14 h-14 text-white/10" />
              <p className="text-white/40 text-sm">لا توجد منازل مناسبات متاحة حالياً</p>
              <p className="text-white/20 text-xs">جرب تغيير الفئة أو البحث</p>
            </div>
          ) : (
            <>
              {featured.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <h2 className="text-sm font-bold text-white">مميز</h2>
                  </div>
                  <div className="space-y-3">
                    {featured.map((r) => <RestaurantCard key={r.id} r={r} />)}
                  </div>
                </div>
              )}

              {rest.length > 0 && (
                <div>
                  {featured.length > 0 && (
                    <h2 className="text-sm font-bold text-white mb-3">جميع المنازل والقاعات</h2>
                  )}
                  <div className="space-y-3">
                    {rest.map((r) => <RestaurantCard key={r.id} r={r} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CTA */}
        {isAdmin && (
          <div className="px-4 mt-8">
            <Link href="/food/dashboard">
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="rounded-2xl p-4 bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 flex items-center justify-between"
              >
                <div>
                  <p className="text-white font-bold text-sm">إدارة منازل المناسبات</p>
                  <p className="text-white/50 text-xs mt-0.5">يمكنك إضافة وإدارة العروض وتلقي الحجوزات</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                </div>
              </motion.div>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
