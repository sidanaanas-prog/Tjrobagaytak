import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2, CheckCircle, XCircle, Clock, CreditCard, Banknote, User, Phone, Calendar, Eye, X } from "lucide-react";

const BASE = getApiUrl("");

type Sub = {
  id: string;
  plan: string;
  paymentMethod: "ccp" | "cash";
  status: "pending" | "approved" | "rejected";
  paymentProofUrl: string | null;
  idDocumentUrl: string | null;
  notes: string | null;
  price: number;
  createdAt: string;
  user: { id: string; name: string; phone: string | null; email: string; avatar: string | null };
};

const PLAN_LABELS: Record<string, string> = { "1month": "1 شهر", "6months": "6 أشهر", "12months": "12 شهر" };
const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25",
  approved: "text-green-400 bg-green-400/10 border-green-400/25",
  rejected: "text-red-400 bg-red-400/10 border-red-400/25",
};
const STATUS_LABELS: Record<string, string> = { pending: "معلّق", approved: "مقبول", rejected: "مرفوض" };

export default function Subscriptions() {
  useAdminAuth();
  const token = localStorage.getItem("glow_admin_token");
  const { toast } = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSubs(await res.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setActionId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/subscriptions/${id}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "تمت الموافقة ✅", description: "تم تفعيل اشتراك المستخدم" });
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
      toast({ title: "تم الرفض", description: "تم إرسال إشعار للمستخدم" });
      setRejectTarget(null);
      setRejectNote("");
      load();
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setActionId(null); }
  }

  const filtered = subs.filter(s => filter === "all" || s.status === filter);
  const pendingCount = subs.filter(s => s.status === "pending").length;

  return (
    <div className="p-6 space-y-5" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            طلبات الاشتراك
          </h1>
          <p className="text-sm text-muted-foreground mt-1">مراجعة وإدارة طلبات الاشتراك المدفوع</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm font-bold px-3 py-1.5 rounded-full">
            {pendingCount} معلّق
          </span>
        )}
      </div>

      {/* فلاتر */}
      <div className="flex gap-2 flex-wrap">
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filter === f
                ? "bg-primary text-white border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {{ pending: `معلّق (${subs.filter(s=>s.status==="pending").length})`, all: "الكل", approved: "مقبول", rejected: "مرفوض" }[f]}
          </button>
        ))}
      </div>

      {/* قائمة الطلبات */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((sub) => (
            <div key={sub.id} className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* معلومات المستخدم */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                    {sub.user.avatar
                      ? <img src={sub.user.avatar} alt="" className="w-full h-full object-cover" />
                      : <User className="w-5 h-5 text-primary/60" />}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{sub.user.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                      <Phone className="w-3 h-3" />
                      {sub.user.phone || sub.user.email}
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
                  <p className="text-sm font-bold text-foreground mt-0.5">{sub.price.toLocaleString()} دج</p>
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
                      <Eye className="w-3.5 h-3.5" />
                      عرض وصل الدفع
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
                  <p className="text-xs text-red-400">سبب الرفض: {sub.notes}</p>
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
                    <XCircle className="w-4 h-4" />
                    رفض
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
          ))}
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
