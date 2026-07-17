import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { 
  Trophy, 
  Settings, 
  Users, 
  RefreshCw, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Award, 
  Sparkles,
  BookOpen,
  Edit2,
  Trash2,
  Search,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = getApiUrl("");

function getNumericId(id: string | null | undefined): string {
  if (!id) return "—";
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

function apiReq(path: string, options?: RequestInit) {
  const token = localStorage.getItem("glow_admin_token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  }).then((r) => r.json());
}

type Participant = {
  userId: string;
  name: string;
  avatar: string | null;
  inviteCode: string;
  points: number;
  joinedAt: string;
  rank: number;
};

export default function CompetitionAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Competition Settings State
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("preparing"); // preparing, open, closed
  const [prize, setPrize] = useState("");
  const [endTime, setEndTime] = useState("");
  const [terms, setTerms] = useState("");
  const [winnerId, setWinnerId] = useState("");

  // Leaderboard / Participants State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [editingPointsUserId, setEditingPointsUserId] = useState<string | null>(null);
  const [newPointsValue, setNewPointsValue] = useState<number>(0);

  const fetchCompetitionData = async () => {
    try {
      setLoading(true);
      // Fetch public status which contains leaderboard and settings
      const data = await fetch(`${BASE}/api/competition/status`).then((r) => r.json());
      
      setEnabled(data.enabled);
      setStatus(data.status || "preparing");
      setPrize(data.prize || "");
      setEndTime(data.endTime || "");
      setTerms(data.terms || "");
      setWinnerId(data.winnerId || "");
      setParticipants(data.leaderboard || []);
    } catch (error) {
      console.error("Error loading competition admin data:", error);
      toast({
        title: "خطأ في التحميل ❌",
        description: "تعذر جلب بيانات المسابقة الحالية من الخادم.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitionData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const keysToUpdate = [
        { key: "competition_enabled", value: String(enabled) },
        { key: "competition_status", value: status },
        { key: "competition_prize", value: prize },
        { key: "competition_end_time", value: endTime },
        { key: "competition_terms", value: terms },
        { key: "competition_winner_id", value: winnerId },
      ];

      for (const item of keysToUpdate) {
        await apiReq(`${BASE}/api/admin/settings/${item.key}`, {
          method: "PATCH",
          body: JSON.stringify({ value: item.value }),
        });
      }

      toast({
        title: "تم الحفظ بنجاح ✅",
        description: "تم تحديث كافة إعدادات المسابقة وتعميمها على المستخدمين.",
      });
      
      // Refresh
      fetchCompetitionData();
    } catch (error) {
      console.error("Error saving competition settings:", error);
      toast({
        title: "خطأ أثناء الحفظ ❌",
        description: "حدث خطأ غير متوقع أثناء تحديث الإعدادات.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdatePoints = async (userId: string) => {
    try {
      const res = await apiReq(`${BASE}/api/admin/competition/participants/${userId}/points`, {
        method: "PATCH",
        body: JSON.stringify({ points: newPointsValue }),
      });

      if (res.success) {
        toast({
          title: "تم تحديث النقاط ✅",
          description: "تم تعديل رصيد نقاط المشترك بنجاح.",
        });
        setEditingPointsUserId(null);
        fetchCompetitionData();
      } else {
        toast({
          title: "فشل التحديث ❌",
          description: res.error || "تعذر تحديث النقاط.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ ❌",
        description: "حدث خطأ أثناء إرسال طلب التحديث.",
        variant: "destructive",
      });
    }
  };

  const handleResetCompetition = async () => {
    const confirm = window.confirm("⚠️ تحذير مهم جداً:\n\nهل أنت متأكد تماماً من رغبتك في تصفير المسابقة؟\nسيؤدي هذا الإجراء إلى حذف جميع المشتركين الحاليين وحذف كافة الإحالات وسجلات كود الإحالة وبدء جولة جديدة تماماً!");
    
    if (!confirm) return;

    setResetting(true);
    try {
      const res = await apiReq(`${BASE}/api/admin/competition/reset`, {
        method: "POST",
      });

      if (res.success) {
        toast({
          title: "تم التصفير بنجاح 🎉",
          description: "تمت إعادة تهيئة المسابقة بنجاح وبدء جولة جديدة.",
        });
        fetchCompetitionData();
      } else {
        toast({
          title: "فشل التصفير ❌",
          description: res.error || "حدث خطأ ما.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ ❌",
        description: "تعذر تصفير المسابقة.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  };

  const filteredParticipants = participants.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.inviteCode.toLowerCase().includes(query) ||
      p.userId.includes(query)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500 animate-pulse" />
            <span>إدارة المسابقات والإحالات</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            قم بضبط إعدادات المسابقة الحالية، إدارة الأكواد الترويجية، وجدول لوحة الصدارة للمشتركين.
          </p>
        </div>
        <button
          onClick={fetchCompetitionData}
          disabled={loading}
          className="flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all text-sm font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">جاري تحميل بيانات المسابقة من الخادم...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Section (Left side in LTR, Right side in RTL) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-white">إعدادات الجولة الحالية</h2>
              </div>

              {/* Toggle Enable/Disable */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">حالة تفعيل المسابقة العامة</label>
                <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    id="competition_enabled_checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-5 h-5 accent-primary cursor-pointer"
                  />
                  <label htmlFor="competition_enabled_checkbox" className="text-sm text-white font-medium cursor-pointer flex-1">
                    {enabled ? "المسابقة مفعلة وتظهر للمستخدمين" : "المسابقة معطلة ومخفية"}
                  </label>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">مرحلة المسابقة</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white/5 border border-border rounded-xl px-3 h-11 text-white focus:outline-none focus:border-primary"
                >
                  <option value="preparing" className="bg-[#121218]">تحضير / قريباً (Preparing)</option>
                  <option value="open" className="bg-[#121218]">مفتوحة ونشطة (Open)</option>
                  <option value="closed" className="bg-[#121218]">مغلقة بانتظار إعلان الفائز (Closed)</option>
                  <option value="ended" className="bg-[#121218]">منتهية رسمياً (Ended)</option>
                </select>
              </div>

              {/* Prize */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">جائزة المسابقة الكبرى</label>
                <input
                  type="text"
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  placeholder="مثال: 50 ألف دورو 🎉"
                  className="w-full bg-white/5 border border-border rounded-xl px-3 h-11 text-white focus:outline-none focus:border-primary"
                />
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">تاريخ ووقت انتهاء المسابقة</label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="مثال: 31 يوليو 2026 الساعة 11:59 م"
                  className="w-full bg-white/5 border border-border rounded-xl px-3 h-11 text-white text-left font-mono focus:outline-none focus:border-primary"
                  dir="ltr"
                />
              </div>

              {/* Winner ID */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">معرف الفائز بالمركز الأول (User ID)</label>
                <input
                  type="text"
                  value={winnerId}
                  onChange={(e) => setWinnerId(e.target.value)}
                  placeholder="اترك فارغاً حتى انتهاء المسابقة"
                  className="w-full bg-white/5 border border-border rounded-xl px-3 h-11 text-white text-left font-mono text-xs focus:outline-none focus:border-primary"
                  dir="ltr"
                />
              </div>

              {/* Terms and conditions */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-white/70 block">شروط وأحكام المسابقة (تنسيق نصي)</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={6}
                  placeholder="اكتب القواعد والشروط..."
                  className="w-full bg-white/5 border border-border rounded-xl p-3 text-white text-sm focus:outline-none focus:border-primary resize-y"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all shadow-lg"
                >
                  {savingSettings ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التعديلات...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ الإعدادات وتعميمها</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dangerous Area */}
              <div className="pt-4 border-t border-border/60">
                <p className="text-[11px] text-yellow-500/80 mb-3 flex items-center gap-1.5 justify-end">
                  <span>منطقة خطرة: تصفير كامل لإحصائيات المسابقة</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                </p>
                <button
                  onClick={handleResetCompetition}
                  disabled={resetting}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>تصفير كافة المشاركين والبدء من جديد</span>
                </button>
              </div>
            </div>
          </div>

          {/* Participants & Leaderboard List (Right side) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-white">جدول المشتركين ولوحة الصدارة ({participants.length})</h2>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-64" dir="rtl">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المشترك أو الكود..."
                    className="w-full bg-white/5 border border-border rounded-xl pr-10 pl-4 h-10 text-xs text-white focus:outline-none focus:border-primary/50 transition-all text-right"
                  />
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full border-collapse text-right">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-white/60 text-xs font-bold">
                      <th className="p-3 text-center w-16">المركز</th>
                      <th className="p-3">المشترك</th>
                      <th className="p-3 text-center">كود الإحالة</th>
                      <th className="p-3 text-center">النقاط الحالية</th>
                      <th className="p-3 text-center">تاريخ الانضمام</th>
                      <th className="p-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                          {searchQuery ? "لا توجد نتائج مطابقة لبحثك." : "لا يوجد مشتركين مسجلين في الجولة الحالية بعد."}
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((p, index) => {
                        const isTop1 = p.rank === 1;
                        const isTop2 = p.rank === 2;
                        const isTop3 = p.rank === 3;
                        
                        return (
                          <tr key={p.userId} className="border-b border-white/5 hover:bg-white/[0.02] text-sm text-white/80 transition-colors">
                            {/* Rank Column */}
                            <td className="p-3 text-center">
                              {isTop1 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-black text-xs">
                                  🥇 1
                                </span>
                              ) : isTop2 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-300/20 text-gray-300 border border-gray-300/30 font-black text-xs">
                                  🥈 2
                                </span>
                              ) : isTop3 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/30 font-black text-xs">
                                  🥉 3
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-white/40">#{p.rank}</span>
                              )}
                            </td>

                            {/* User Name & Info */}
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                {p.avatar ? (
                                  <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full border border-white/10" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
                                    {p.name.slice(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-white text-xs">{p.name}</p>
                                  <p className="text-[10px] text-white/40 font-mono font-bold" dir="ltr" title={`المعرف الكامل: ${p.userId}`}>ID: {getNumericId(p.userId)}</p>
                                </div>
                              </div>
                            </td>

                            {/* Invite Code */}
                            <td className="p-3 text-center">
                              <span className="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded select-all">
                                {p.inviteCode}
                              </span>
                            </td>

                            {/* Points */}
                            <td className="p-3 text-center font-bold text-white font-mono text-sm">
                              {editingPointsUserId === p.userId ? (
                                <div className="flex items-center justify-center gap-2" dir="ltr">
                                  <input
                                    type="number"
                                    value={newPointsValue}
                                    onChange={(e) => setNewPointsValue(Number(e.target.value))}
                                    className="w-16 h-8 bg-white/10 border border-primary rounded px-2 text-white font-bold text-center font-mono text-xs focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleUpdatePoints(p.userId)}
                                    className="px-2 h-8 rounded bg-primary text-primary-foreground text-xs font-bold"
                                  >
                                    تأكيد
                                  </button>
                                  <button
                                    onClick={() => setEditingPointsUserId(null)}
                                    className="px-2 h-8 rounded bg-white/10 text-white text-xs"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-primary font-black text-lg">{p.points}</span>
                                  <span className="text-[10px] text-white/40">نقطة</span>
                                </div>
                              )}
                            </td>

                            {/* Date joined */}
                            <td className="p-3 text-center font-mono text-xs text-white/40">
                              {new Date(p.joinedAt).toLocaleDateString("ar-DZ", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-center">
                              {editingPointsUserId !== p.userId && (
                                <button
                                  onClick={() => {
                                    setEditingPointsUserId(p.userId);
                                    setNewPointsValue(p.points);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white transition-all"
                                >
                                  <Edit2 className="w-3 h-3 text-primary" />
                                  <span>تعديل النقاط</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Informational Tips Card */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="text-right text-xs leading-relaxed text-emerald-300">
                  <p className="font-bold text-emerald-200 mb-1">كيف تعمل المسابقات ونظام الإحالة؟</p>
                  <p>
                    عندما يقوم مستخدم جديد بالتسجيل في التطبيق (سواء عبر نموذج رقم الهاتف بالـ OTP أو عبر نموذج البريد الإلكتروني) ويكتب كود إحالة صديقه، يتم ربط حسابه تلقائياً به. بمجرد أن يقوم بحجز كورس (رحلة) واكتمالها بنجاح، يقوم الخادم تلقائياً بزيادة رصيد نقاط الصاحب بنسبة (1 نقطة). يمكنك التعديل اليدوي على نقاط أي مشترك من الجدول أعلاه.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
