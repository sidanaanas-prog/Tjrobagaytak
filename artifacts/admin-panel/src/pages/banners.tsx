import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, Image, MoveUp, MoveDown, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  emoji: string | null;
  bg: string;
  accent: string;
  imageUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

const BG_OPTIONS = [
  { label: "بنفسجي", value: "from-violet-600/40 to-fuchsia-600/20" },
  { label: "سماوي",  value: "from-cyan-600/30 to-blue-600/20" },
  { label: "ذهبي",   value: "from-amber-600/30 to-orange-600/20" },
  { label: "أخضر",   value: "from-emerald-600/30 to-teal-600/20" },
  { label: "وردي",   value: "from-pink-600/30 to-rose-600/20" },
  { label: "أحمر",   value: "from-red-600/30 to-rose-600/20" },
  { label: "أزرق",   value: "from-indigo-600/40 to-blue-600/20" },
];

const ACCENT_OPTIONS = [
  "#a855f7", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", "#ef4444", "#3b82f6",
];

const EMPTY = {
  title: "", subtitle: "", emoji: "🛍️",
  bg: "from-violet-600/40 to-fuchsia-600/20",
  accent: "#a855f7", imageUrl: "", linkUrl: "",
};

function getToken() {
  return localStorage.getItem("glow_admin_token") ?? "";
}

async function uploadToStorage(file: File, onProgress: (p: number) => void): Promise<string> {
  const urlRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!urlRes.ok) throw new Error("تعذّر الحصول على رابط الرفع");
  const { uploadURL, objectPath } = await urlRes.json();

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadURL);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("فشل الرفع")));
    xhr.onerror = () => reject(new Error("خطأ في الشبكة"));
    xhr.send(file);
  });

  return `/api/storage${objectPath}`;
}

export default function Banners() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  async function fetchBanners() {
    try {
      const res = await fetch("/api/admin/banners", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) setBanners(await res.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchBanners(); }, []);

  function openCreate() {
    setEditBanner(null);
    setForm({ ...EMPTY });
    setUploadProgress(null);
    setDialogOpen(true);
  }

  function openEdit(b: Banner) {
    setEditBanner(b);
    setForm({
      title: b.title, subtitle: b.subtitle ?? "", emoji: b.emoji ?? "🛍️",
      bg: b.bg, accent: b.accent,
      imageUrl: b.imageUrl ?? "", linkUrl: b.linkUrl ?? "",
    });
    setUploadProgress(null);
    setDialogOpen(true);
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "اختر صورة فقط", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "الصورة أكبر من 10 ميغابايت", variant: "destructive" });
      return;
    }
    setUploadProgress(0);
    try {
      const url = await uploadToStorage(file, (p) => setUploadProgress(p));
      setForm((f) => ({ ...f, imageUrl: url }));
      toast({ title: "تم رفع الصورة ✓" });
    } catch (err: any) {
      toast({ title: err.message ?? "فشل الرفع", variant: "destructive" });
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        imageUrl: form.imageUrl?.trim() || null,
        linkUrl: form.linkUrl?.trim() || null,
        subtitle: form.subtitle?.trim() || null,
        isActive: editBanner?.isActive ?? true,
        sortOrder: editBanner?.sortOrder ?? banners.length,
      };
      const url = editBanner ? `/api/admin/banners/${editBanner.id}` : "/api/admin/banners";
      const res = await fetch(url, {
        method: editBanner ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: editBanner ? "تم التعديل" : "تم الإنشاء" });
        setDialogOpen(false);
        fetchBanners();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "خطأ", variant: "destructive" });
      }
    } finally { setSaving(false); }
  }

  async function handleToggle(b: Banner) {
    const res = await fetch(`/api/admin/banners/${b.id}/toggle`, {
      method: "PATCH", headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) fetchBanners();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await fetch(`/api/admin/banners/${deleteId}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    setDeleteId(null);
    fetchBanners();
  }

  async function handleReorder(b: Banner, dir: "up" | "down") {
    const sorted = [...banners].sort((a, z) => a.sortOrder - z.sortOrder);
    const idx = sorted.findIndex((x) => x.id === b.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx]!;
    await Promise.all([
      fetch(`/api/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ ...b, sortOrder: other.sortOrder }) }),
      fetch(`/api/admin/banners/${other.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ ...other, sortOrder: b.sortOrder }) }),
    ]);
    fetchBanners();
  }

  const sorted = [...banners].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-bold">البانرات</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة البانرات المتحركة في الصفحة الرئيسية</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> بانر جديد</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">جاري التحميل...</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Image className="w-10 h-10 opacity-30" />
            <p>لا توجد بانرات بعد</p>
            <Button variant="outline" onClick={openCreate} className="gap-2 mt-2"><Plus className="w-4 h-4" /> أضف أول بانر</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {sorted.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ delay: i * 0.05 }}>
                <Card className={b.isActive ? "" : "opacity-50"}>
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* معاينة */}
                    <div className={`w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 relative bg-gradient-to-br ${b.bg}`}>
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">{b.emoji ?? "🛍️"}</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate">{b.title}</p>
                        <Badge variant={b.isActive ? "default" : "secondary"} className="text-[10px] px-1.5">{b.isActive ? "نشط" : "مخفي"}</Badge>
                        {b.imageUrl && <Badge variant="outline" className="text-[10px] px-1.5 gap-1"><Image className="w-2.5 h-2.5" />صورة</Badge>}
                      </div>
                      {b.subtitle && <p className="text-muted-foreground text-xs truncate">{b.subtitle}</p>}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleReorder(b, "up")} disabled={i === 0}><MoveUp className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleReorder(b, "down")} disabled={i === sorted.length - 1}><MoveDown className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggle(b)}>{b.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── نموذج الإنشاء / التعديل ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editBanner ? "تعديل بانر" : "بانر جديد"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* معاينة مباشرة */}
            <div className={`w-full h-24 rounded-2xl overflow-hidden relative bg-gradient-to-br ${form.bg} border border-white/10`}>
              {form.imageUrl ? (
                <>
                  <img src={form.imageUrl} alt="معاينة" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/30 to-transparent" />
                </>
              ) : null}
              <div className="relative z-10 h-full flex items-center gap-3 px-4">
                {!form.imageUrl && <span className="text-3xl">{form.emoji || "🛍️"}</span>}
                <div>
                  <p className="text-white font-bold text-sm leading-tight drop-shadow">{form.title || "عنوان البانر"}</p>
                  {form.subtitle && <p className="text-white/70 text-xs mt-0.5 drop-shadow">{form.subtitle}</p>}
                </div>
              </div>
            </div>

            {/* رفع الصورة */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">صورة البانر (اختياري)</label>
              {form.imageUrl ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <img src={form.imageUrl} alt="thumbnail" className="w-12 h-8 object-cover rounded" />
                  <span className="text-xs text-muted-foreground flex-1 truncate">تم رفع الصورة</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : uploadProgress !== null ? (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />جاري الرفع...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
                    <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.2 }} />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 hover:border-primary/50 transition-colors text-muted-foreground hover:text-foreground text-sm"
                >
                  <Upload className="w-4 h-4" /> اختر صورة من جهازك
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <p className="text-xs text-muted-foreground mt-1">PNG، JPG، WEBP — حتى 10 ميغابايت. الصورة تظهر بدلاً من لون الخلفية.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">العنوان *</label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="أفضل سوق في المخيم" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">الوصف</label>
                <Input value={form.subtitle ?? ""} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="اكتشف منتجات فريدة..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الإيموجي {form.imageUrl && <span className="opacity-50">(يُخفى مع الصورة)</span>}</label>
                <Input value={form.emoji ?? ""} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} placeholder="🛍️" className="text-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">رابط البانر</label>
                <Input value={form.linkUrl ?? ""} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="/products" dir="ltr" />
              </div>
            </div>

            {!form.imageUrl && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">لون الخلفية</label>
                  <div className="flex flex-wrap gap-2">
                    {BG_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setForm((f) => ({ ...f, bg: opt.value }))}
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${opt.value} border-2 transition-all ${form.bg === opt.value ? "border-white scale-110" : "border-transparent"}`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">لون التمييز</label>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_OPTIONS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, accent: c }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${form.accent === c ? "border-white scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || uploadProgress !== null}>
              {saving ? "جاري الحفظ..." : editBanner ? "حفظ التعديلات" : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── تأكيد الحذف ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف البانر</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
