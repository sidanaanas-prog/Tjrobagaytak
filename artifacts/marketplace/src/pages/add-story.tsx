import { getMemToken } from "@/hooks/use-auth";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Type, ArrowRight, Loader2, CheckCircle, Link as LinkIcon, X } from "lucide-react";
import { uploadStoryImage } from "@/lib/upload-image";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

const BACKGROUNDS = [
  { id: "midnight", style: "linear-gradient(160deg,#0f0c29,#302b63,#24243e)" },
  { id: "aurora",   style: "linear-gradient(160deg,#0d9488,#6366f1,#a855f7)" },
  { id: "purple",   style: "linear-gradient(160deg,#4c1d95,#7c3aed,#c026d3)" },
  { id: "ocean",    style: "linear-gradient(160deg,#1e3a5f,#2563eb,#0ea5e9)" },
  { id: "sunset",   style: "linear-gradient(160deg,#7c2d12,#dc2626,#f97316)" },
  { id: "forest",   style: "linear-gradient(160deg,#064e3b,#059669,#16a34a)" },
  { id: "rose",     style: "linear-gradient(160deg,#831843,#db2777,#fb7185)" },
  { id: "gold",     style: "linear-gradient(160deg,#78350f,#d97706,#fcd34d)" },
  { id: "candy",    style: "linear-gradient(160deg,#6d28d9,#ec4899,#f9a8d4)" },
  { id: "coffee",   style: "linear-gradient(160deg,#1c0a00,#6f4e37,#c9a96e)" },
  { id: "night",    style: "linear-gradient(160deg,#0f172a,#1e293b,#334155)" },
  { id: "lava",     style: "linear-gradient(160deg,#1a0000,#7f1d1d,#ef4444)" },
];

const FONTS = [
  { id: "Amiri",               name: "أميري",   sample: "أميري" },
  { id: "Scheherazade New",    name: "شهرزاد",  sample: "شهرزاد" },
  { id: "Noto Naskh Arabic",   name: "نسخ",     sample: "نسخ" },
  { id: "Cairo",               name: "كايرو",   sample: "كايرو" },
  { id: "Tajawal",             name: "تجوّل",   sample: "تجوّل" },
  { id: "Reem Kufi",           name: "كوفي",    sample: "كوفي" },
];

type Tab = "gallery" | "url" | "text";

export default function AddStoryPage() {
  const { user } = useAuth();
  const token = getMemToken();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("gallery");

  // Image state
  const [mediaUrl, setMediaUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");

  // Text story state
  const [storyText, setStoryText] = useState("");
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState(FONTS[0]);

  // Common
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!user) { navigate("/login"); return null; }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("اختر صورة فقط"); return; }
    setError("");
    try {
      const url = await uploadStoryImage(file, user!.id);
      setMediaUrl(url);
    } catch { setError("تعذر رفع الصورة على Firebase"); }
  }

  function clearImage() {
    setMediaUrl("");
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setError("");
    let body: Record<string, any>;

    if (tab === "text") {
      if (!storyText.trim()) { setError("اكتب نصاً أولاً"); return; }
      body = {
        mediaType: "text",
        caption: storyText.trim(),
        bgColor: selectedBg.style,
        fontFamily: selectedFont.id,
      };
    } else {
      const url = tab === "gallery" ? mediaUrl : urlInput.trim();
      if (!url) { setError("اختر صورة أو أدخل رابط"); return; }
      body = { mediaUrl: url, mediaType: "image", caption: caption.trim() || null };
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "حدث خطأ"); return; }
      setDone(true);
      setTimeout(() => navigate("/"), 1500);
    } catch { setError("تعذر الاتصال بالخادم"); }
    finally { setLoading(false); }
  }

  const canSubmit = tab === "text"
    ? storyText.trim().length > 0
    : tab === "gallery" ? !!mediaUrl : !!urlInput.trim();

  return (
    <AppLayout>
      <div className="flex flex-col min-h-full" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
            <h1 className="text-xl font-black text-white">إضافة حالة</h1>
          </div>
        </div>

        <div className="px-5 py-5 space-y-4 pb-10">
          {done ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_24px_rgba(52,211,153,0.3)]">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-white font-bold text-lg">تم نشر حالتك!</p>
              <p className="text-white/40 text-sm">ستختفي بعد 24 ساعة</p>
            </motion.div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-white/5 rounded-2xl">
                {([["gallery","📷 صورة"],["url","🔗 رابط"],["text","✏️ نص"]] as [Tab,string][]).map(([t,label]) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tab===t ? "bg-primary text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "text-white/40"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">

                {/* ── صورة من المعرض ── */}
                {tab === "gallery" && (
                  <motion.div key="gallery" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} className="space-y-4">
                    {mediaUrl ? (
                      <div className="relative w-full aspect-[9/16] max-h-80 rounded-3xl overflow-hidden bg-black border border-white/10">
                        <img src={mediaUrl} alt="preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
                        {caption && <p className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-semibold px-4 drop-shadow">{caption}</p>}
                        <button onClick={clearImage} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-full aspect-[9/16] max-h-80 rounded-3xl bg-white/5 border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-3 hover:border-primary/40 transition-colors">
                        <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                          <ImageIcon className="w-7 h-7 text-primary" />
                        </div>
                        <p className="text-white font-bold">اختر من الصور</p>
                        <p className="text-white/30 text-xs">JPG, PNG — بحد أقصى 5MB</p>
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-widest">نص الحالة (اختياري)</label>
                      <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="اكتب شيئاً..." rows={2} maxLength={150}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none" />
                    </div>
                  </motion.div>
                )}

                {/* ── رابط صورة ── */}
                {tab === "url" && (
                  <motion.div key="url" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} className="space-y-4">
                    {urlInput && (
                      <div className="relative w-full aspect-[9/16] max-h-72 rounded-3xl overflow-hidden bg-black border border-white/10">
                        <img src={urlInput} alt="preview" className="w-full h-full object-cover" onError={()=>setError("رابط غير صالح")} onLoad={()=>setError("")} />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input type="url" value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://example.com/image.jpg" dir="ltr"
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-primary/50" />
                      {urlInput && <button onClick={()=>setUrlInput("")} className="px-3 rounded-2xl bg-white/10 text-white/60"><X className="w-4 h-4" /></button>}
                    </div>
                  </motion.div>
                )}

                {/* ── حالة نصية ── */}
                {tab === "text" && (
                  <motion.div key="text" initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-8 }} className="space-y-4">

                    {/* Preview canvas */}
                    <div className="relative w-full rounded-3xl overflow-hidden" style={{ aspectRatio:"9/16", maxHeight:320, background: selectedBg.style }}>
                      {/* Subtle texture overlay */}
                      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />
                      {/* Text overlay */}
                      <div className="absolute inset-0 flex items-center justify-center p-6">
                        {storyText ? (
                          <p className="text-white text-center text-2xl leading-relaxed break-words w-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                            style={{ fontFamily:`'${selectedFont.id}', serif`, textShadow:"0 2px 12px rgba(0,0,0,0.5)" }}>
                            {storyText}
                          </p>
                        ) : (
                          <p className="text-white/30 text-center text-lg" style={{ fontFamily:`'${selectedFont.id}', serif` }}>
                            اكتب حالتك هنا...
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Text input */}
                    <textarea
                      value={storyText}
                      onChange={e => setStoryText(e.target.value)}
                      placeholder="اكتب نص حالتك..."
                      rows={3}
                      maxLength={200}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-base placeholder:text-white/20 focus:outline-none focus:border-primary/50 resize-none text-right"
                      dir="rtl"
                    />
                    <div className="flex justify-between text-[10px] text-white/25 font-mono -mt-2 px-1">
                      <span>{storyText.length}/200</span>
                      <span>الخط: {selectedFont.name}</span>
                    </div>

                    {/* Background picker */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-widest">الخلفية</p>
                      <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1">
                        {BACKGROUNDS.map(bg => (
                          <button key={bg.id} onClick={() => setSelectedBg(bg)}
                            className={`shrink-0 w-12 h-12 rounded-2xl transition-all ${selectedBg.id === bg.id ? "scale-110 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.3)]" : "opacity-70 hover:opacity-90"}`}
                            style={{ background: bg.style }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Font picker */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-widest">الخط</p>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                        {FONTS.map(font => (
                          <button key={font.id} onClick={() => setSelectedFont(font)}
                            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl border transition-all ${selectedFont.id === font.id ? "bg-primary/20 border-primary/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "bg-white/5 border-white/10"}`}>
                            <span className="text-white text-lg leading-none" style={{ fontFamily:`'${font.id}', serif` }}>{font.sample}</span>
                            <span className="text-white/40 text-[10px]" style={{ fontFamily:`'${font.id}', serif` }}>{font.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info */}
              <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-xs text-primary/70">
                ⏱ تختفي الحالة تلقائياً بعد 24 ساعة
              </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

              {/* Submit */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading || !canSubmit}
                className="w-full py-4 rounded-2xl bg-primary font-bold text-white text-base shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "نشر الحالة"}
              </motion.button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
