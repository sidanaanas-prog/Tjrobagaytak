import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProduct, useListCategories } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackagePlus, ImageIcon, X, Plus, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { uploadProductImages } from "@/lib/upload-image";

export default function SellPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: categories } = useListCategories();
  const createProduct = useCreateProduct();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: "", description: "", price: "", categoryId: "" });
  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [imgTab, setImgTab] = useState<"gallery" | "url">("gallery");
  const [compressing, setCompressing] = useState(false);

  if (!user) { setLocation("/login"); return null; }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > 4) {
      toast({ variant: "destructive", title: "الحد الأقصى 4 صور" });
      return;
    }
    setCompressing(true);
    try {
      const urls = await uploadProductImages(files, user!.id);
      setImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch {
      toast({ variant: "destructive", title: "تعذر رفع الصورة على Firebase" });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function addUrlImage() {
    if (!urlInput.trim()) return;
    if (images.length >= 4) { toast({ variant: "destructive", title: "الحد الأقصى 4 صور" }); return; }
    setImages((prev) => [...prev, urlInput.trim()]);
    setUrlInput("");
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      toast({ variant: "destructive", title: "بيانات ناقصة", description: "أدخل العنوان والسعر على الأقل." });
      return;
    }
    createProduct.mutate({
      data: {
        title: form.title,
        description: form.description || undefined,
        price: parseFloat(form.price),
        categoryId: form.categoryId || undefined,
        images,
      }
    }, {
      onSuccess: () => {
        toast({ title: "تم النشر ✓", description: "منتجك أصبح مرئياً للجميع الآن." });
        setLocation("/my-listings");
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "خطأ", description: err?.message || "حدث خطأ ما." });
      }
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col">
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <PackagePlus className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-black text-white">أضف منتجاً</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5 pb-10">

          {/* ── صور المنتج ── */}
          <div className="space-y-3">
            <Label className="text-xs text-white/60 uppercase tracking-wider">صور المنتج (حتى 4 صور)</Label>

            {/* Thumbnails */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                <AnimatePresence>
                  {images.map((src, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="relative w-20 h-20 rounded-2xl overflow-hidden border border-white/10"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 text-[8px] bg-primary/80 text-white px-1.5 py-0.5 rounded-full font-bold">رئيسية</span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Tabs */}
            {images.length < 4 && (
              <>
                <div className="flex gap-2 p-1 bg-white/5 rounded-2xl">
                  <button type="button" onClick={() => setImgTab("gallery")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${imgTab === "gallery" ? "bg-primary text-white" : "text-white/40"}`}>
                    📷 من المعرض
                  </button>
                  <button type="button" onClick={() => setImgTab("url")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${imgTab === "url" ? "bg-primary text-white" : "text-white/40"}`}>
                    🔗 رابط صورة
                  </button>
                </div>

                {imgTab === "gallery" ? (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={compressing}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-dashed border-white/20 hover:border-primary/40 transition-all"
                    >
                      {compressing ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="text-right flex-1">
                        <p className="text-white font-bold text-sm">{compressing ? "جاري التحميل..." : "اختر من الصور"}</p>
                        <p className="text-white/40 text-[11px]">يمكنك اختيار أكثر من صورة</p>
                      </div>
                      <Plus className="w-5 h-5 text-white/30" />
                    </motion.button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrlImage())}
                      placeholder="https://..."
                      dir="ltr"
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 transition-all"
                    />
                    <button type="button" onClick={addUrlImage}
                      className="px-4 py-3 rounded-2xl bg-primary text-white text-sm font-bold">
                      <LinkIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── عنوان المنتج ── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 uppercase tracking-wider">عنوان المنتج *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: iPhone 15 Pro Max"
              className="bg-white/5 border-white/10 focus-visible:border-primary/50 h-12 rounded-xl"
            />
          </div>

          {/* ── الوصف ── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 uppercase tracking-wider">الوصف</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="صِف منتجك بالتفصيل..."
              className="bg-white/5 border-white/10 focus-visible:border-primary/50 rounded-xl min-h-[90px]"
            />
          </div>

          {/* ── السعر ── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 uppercase tracking-wider">السعر (DZ) *</Label>
            <Input
              type="number" min="0" step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0.00"
              className="bg-white/5 border-white/10 focus-visible:border-primary/50 h-12 rounded-xl"
            />
          </div>

          {/* ── التصنيف ── */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 uppercase tracking-wider">التصنيف</Label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: form.categoryId ? "white" : "rgba(255,255,255,0.3)",
                padding: "0 16px",
                fontSize: 14,
                appearance: "auto",
                direction: "rtl",
              }}
            >
              <option value="" style={{ background: "#12121A", color: "rgba(255,255,255,0.4)" }}>اختر تصنيفاً</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "#12121A", color: "white" }}>
                  {c.icon || "\ud83d\udce6"}  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* ── زر النشر ── */}
          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={createProduct.isPending}
            className="w-full h-14 text-base font-bold bg-primary text-white rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {createProduct.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "نشر المنتج ←"}
          </motion.button>
        </form>
      </div>

    </AppLayout>
  );
}
