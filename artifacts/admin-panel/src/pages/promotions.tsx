import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Zap, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Clock, CheckCircle, XCircle, Loader2, Gift, Target, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = getApiUrl("");

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

type Promo = {
  id: string;
  name: string;
  description: string | null;
  type: "challenge" | "discount" | "flash";
  plan: "6months" | "12months" | "both";
  originalPrice: string;
  discountedPrice: string;
  discountPercent: number;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  trialDays: number | null;
  goalDescription: string | null;
  reward: string | null;
  showCountdown: boolean;
  countdownMessage: string | null;
  maxUsers: number | null;
  usedCount: number;
  createdAt: string;
  createdByName: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  challenge: "تحدي",
  discount: "خصم",
  flash: "فلاش",
};

const TYPE_COLORS: Record<string, string> = {
  challenge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  discount: "bg-green-500/20 text-green-400 border-green-500/30",
  flash: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const PLAN_LABELS: Record<string, string> = {
  "6months": "6 أشهر",
  "12months": "12 شهر",
  both: "الكل",
};

export default function PromotionsPage() {
  const { toast } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    name: "",
    description: "",
    type: "discount" as "challenge" | "discount" | "flash",
    plan: "both" as "6months" | "12months" | "both",
    originalPrice: "5000",
    discountedPrice: "2500",
    discountPercent: 50 as number | string,
    isActive: true,
    startAt: "",
    endAt: "",
    trialDays: "" as string | number,
    goalDescription: "",
    reward: "",
    showCountdown: false,
    countdownMessage: "",
    maxUsers: "" as string | number,
  };
  const [form, setForm] = useState({ ...emptyForm });

  const fetchPromos = async () => {
    try {
      const data = await apiReq(`${BASE}/api/admin/promotions`);
      if (Array.isArray(data)) {
        setPromos(data);
      } else {
        setPromos([]);
        if (data && data.error) {
          toast({ title: "خطأ", description: data.error, variant: "destructive" });
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to load promotions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        originalPrice: Number(form.originalPrice),
        discountedPrice: Number(form.discountedPrice),
        discountPercent: Number(form.discountPercent),
        trialDays: form.trialDays ? Number(form.trialDays) : undefined,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
      };
      if (editing) {
        await apiReq(`${BASE}/api/admin/promotions/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "تم!", description: "تم تعديل العرض" });
      } else {
        await apiReq(`${BASE}/api/admin/promotions`, { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "تم!", description: "تم إنشاء العرض" });
      }
      setShowForm(false);
      setEditing(null);
      setForm({ ...emptyForm });
      fetchPromos();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    await apiReq(`${BASE}/api/admin/promotions/${id}/toggle`, { method: "PATCH" });
    fetchPromos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await apiReq(`${BASE}/api/admin/promotions/${id}`, { method: "DELETE" });
    toast({ title: "تم!", description: "تم حذف العرض" });
    fetchPromos();
  };

  const openEdit = (p: Promo) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      type: p.type,
      plan: p.plan,
      originalPrice: p.originalPrice,
      discountedPrice: p.discountedPrice,
      discountPercent: p.discountPercent,
      isActive: p.isActive,
      startAt: p.startAt ? p.startAt.slice(0, 16) : "",
      endAt: p.endAt ? p.endAt.slice(0, 16) : "",
      trialDays: p.trialDays ?? "",
      goalDescription: p.goalDescription ?? "",
      reward: p.reward ?? "",
      showCountdown: p.showCountdown,
      countdownMessage: p.countdownMessage ?? "",
      maxUsers: p.maxUsers ?? "",
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-wider">العروض الترويجية</h1>
          <p className="text-muted-foreground text-sm mt-1">إنشاء وإدارة العروض والتحديات للاشتراكات</p>
        </div>
        <button
          onClick={() => { setEditing(null); setForm({ ...emptyForm }); setShowForm(true); }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-mono text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> عرض جديد
        </button>
      </div>

      {/* Promo List */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : promos.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-4 text-muted" />
          <p className="font-mono text-lg">لا توجد عروض</p>
          <p className="text-sm mt-1">أنشئ عرضك الأول لتحفيز البائعين</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {promos.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-lg p-5 bg-card relative overflow-hidden ${!p.isActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center border ${TYPE_COLORS[p.type]}`}>
                  {p.type === "challenge" ? <Target className="w-6 h-6" /> : p.type === "discount" ? <Gift className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${TYPE_COLORS[p.type]}`}>{TYPE_LABELS[p.type]}</span>
                    <span className="text-xs px-2 py-0.5 rounded border bg-primary/10 text-primary font-mono">{PLAN_LABELS[p.plan]}</span>
                    {p.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded border bg-green-500/10 text-green-400 font-mono flex items-center gap-1"><CheckCircle className="w-3 h-3" /> نشط</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded border bg-red-500/10 text-red-400 font-mono flex items-center gap-1"><XCircle className="w-3 h-3" /> معطّل</span>
                    )}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground mb-2">{p.description}</p>}
                  <div className="flex flex-wrap gap-3 text-sm mb-2">
                    <span className="text-muted-foreground line-through">{p.originalPrice} د.ج</span>
                    <span className="text-primary font-bold">{p.discountedPrice} د.ج</span>
                    <span className="text-green-400 font-mono">-{p.discountPercent}%</span>
                    {p.trialDays && <span className="text-purple-400 font-mono">{p.trialDays} أيام تجريبية</span>}
                    {p.maxUsers && <span className="text-orange-400 font-mono">{p.usedCount}/{p.maxUsers} مشترك</span>}
                    {p.endAt && (
                      <span className="text-orange-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" /> ينتهي {isNaN(Date.parse(p.endAt)) ? p.endAt : new Date(p.endAt).toLocaleDateString("ar-DZ")}
                      </span>
                    )}
                  </div>
                  {p.goalDescription && (
                    <div className="text-sm bg-purple-500/10 text-purple-300 px-3 py-1.5 rounded border border-purple-500/20 mb-1">
                      <Target className="w-3 h-3 inline mr-1" /> {p.goalDescription}
                      {p.reward && <span className="text-green-300 mr-2">→ {p.reward}</span>}
                    </div>
                  )}
                  {p.countdownMessage && p.showCountdown && (
                    <div className="text-sm bg-orange-500/10 text-orange-300 px-3 py-1.5 rounded border border-orange-500/20">
                      <Clock className="w-3 h-3 inline mr-1" /> {p.countdownMessage}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(p.id)} className="p-2 hover:bg-primary/10 rounded transition-colors" title="تفعيل/تعطيل">
                    {p.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => openEdit(p)} className="p-2 hover:bg-primary/10 rounded transition-colors" title="تعديل">
                    <Edit2 className="w-4 h-4 text-primary" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-destructive/10 rounded transition-colors" title="حذف">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-mono">{editing ? "تعديل العرض" : "عرض جديد"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 hover:bg-destructive/10 rounded"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">الاسم</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="مثال: تحدي البائع النشيط" />
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">الوصف</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary min-h-[60px]" placeholder="وصف مختصر للعرض" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">النوع</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary">
                      <option value="discount">خصم</option>
                      <option value="challenge">تحدي</option>
                      <option value="flash">فلاش</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">الخطة</label>
                    <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as any })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary">
                      <option value="both">الكل</option>
                      <option value="6months">6 أشهر</option>
                      <option value="12months">12 شهر</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">السعر الأصلي</label>
                    <input type="number" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">السعر بعد الخصم</label>
                    <input type="number" value={form.discountedPrice} onChange={(e) => setForm({ ...form, discountedPrice: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">نسبة الخصم %</label>
                    <input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
                {form.type === "challenge" && (
                  <>
                    <div>
                      <label className="text-xs font-mono text-muted-foreground mb-1 block">أيام التجربة</label>
                      <input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="7" />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-muted-foreground mb-1 block">شرط التحدي</label>
                      <input value={form.goalDescription} onChange={(e) => setForm({ ...form, goalDescription: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="مثال: بِع منتج واحد في 7 أيام" />
                    </div>
                    <div>
                      <label className="text-xs font-mono text-muted-foreground mb-1 block">المكافأة</label>
                      <input value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="مثال: شهر مجاني" />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">تاريخ البدء</label>
                    <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">تاريخ الانتهاء</label>
                    <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">عدد المستخدمين المحدود</label>
                  <input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="50" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="countdown" checked={form.showCountdown} onChange={(e) => setForm({ ...form, showCountdown: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="countdown" className="text-sm">عرض عدّ تنازلي</label>
                </div>
                {form.showCountdown && (
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">رسالة العدّ التنازلي</label>
                    <input value={form.countdownMessage} onChange={(e) => setForm({ ...form, countdownMessage: e.target.value })} className="w-full bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="مثال: ينتهي العرض في 2:34:12" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                  <label htmlFor="active" className="text-sm">نشط</label>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2 rounded font-mono text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editing ? "حفظ التعديل" : "إنشاء العرض"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded font-mono text-sm hover:bg-muted transition-colors">إلغاء</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
