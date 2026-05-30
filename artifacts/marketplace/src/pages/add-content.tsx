import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Link as LinkIcon, Play, Upload, Video, X, CheckCircle, Image as ImageIcon, ShoppingBag, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMemToken, handle401, useAuth } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";
import { SubscriptionGate } from "@/components/SubscriptionGate";

const BASE = getApiUrl("");

type UploadTab = "file" | "url";

interface MyProduct {
  id: string;
  title: string;
  price: number;
  images: string[];
}

export default function AddContentPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const [tab, setTab] = useState<UploadTab>("file");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  const [myProducts, setMyProducts] = useState<MyProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const token = getMemToken();

  useEffect(() => {
    if (!token || !user?.id) return;
    fetch(`${BASE}/api/products?sellerId=${user.id}&status=active&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.products ?? []);
        setMyProducts(list);
      })
      .catch(() => {});
  }, [token, user?.id]);

  const selectedProduct = myProducts.find((p) => p.id === selectedProductId) ?? null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideoFile = file.type.startsWith("video/");
    const isImageFile = file.type.startsWith("image/");

    if (!isVideoFile && !isImageFile) {
      toast({ title: "اختر فيديو أو صورة فقط", variant: "destructive" });
      return;
    }

    const maxSize = isVideoFile ? 200 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: isVideoFile ? "الفيديو أكبر من 200 ميغابايت" : "الصورة أكبر من 20 ميغابايت",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setIsImage(isImageFile);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadProgress(0);
  }

  function clearFile() {
    setSelectedFile(null);
    setIsImage(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadFileToStorage(file: File): Promise<string> {
    const urlRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });

    if (!urlRes.ok) throw new Error("تعذّر الرفع، حاول مجدداً");
    const { uploadURL, objectPath } = await urlRes.json();

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadURL);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("فشل الرفع")));
      xhr.onerror = () => reject(new Error("خطأ في الشبكة"));
      xhr.send(file);
    });

    return `${BASE}/api/storage${objectPath}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let finalUrl = "";

    if (tab === "file") {
      if (!selectedFile) {
        toast({ title: "اختر ملفاً أولاً", variant: "destructive" });
        return;
      }
      setUploading(true);
      try {
        finalUrl = await uploadFileToStorage(selectedFile);
      } catch (err: any) {
        toast({ title: err.message ?? "خطأ في الرفع", variant: "destructive" });
        return;
      } finally {
        setUploading(false);
      }
    } else {
      if (!mediaUrl.trim()) {
        toast({ title: "أدخل الرابط", variant: "destructive" });
        return;
      }
      finalUrl = mediaUrl.trim();
    }

    setSaving(true);
    try {
      const tok = getMemToken() ?? "";

      const res = await fetch(`${BASE}/api/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          videoUrl: finalUrl,
          caption: caption.trim() || null,
          productId: selectedProductId ?? null,
        }),
      });

      if (res.ok) {
        toast({ title: "تم النشر!" });
        navigate("/content");
      } else if (res.status === 401) {
        handle401();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "خطأ في النشر", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  const isLoading = uploading || saving;

  return (
    <div className="min-h-screen bg-black" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <button onClick={() => navigate("/content")} className="text-white/70 hover:text-white">
            <ArrowRight className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-lg">إضافة منشور</h1>
        </div>

        <SubscriptionGate type="video">
        <div className="p-5">
          <div className="flex rounded-xl bg-white/5 p-1 mb-5 gap-1">
            {(["file", "url"] as UploadTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? "bg-primary text-white shadow-[0_0_16px_rgba(168,85,247,0.4)]" : "text-white/40"
                }`}
              >
                {t === "file" ? (
                  <><Upload className="w-4 h-4" /> من الجهاز</>
                ) : (
                  <><LinkIcon className="w-4 h-4" /> رابط خارجي</>
                )}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AnimatePresence mode="wait">
              {tab === "file" ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {!selectedFile ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Video className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-white font-semibold">اختر فيديو أو صورة</p>
                      <p className="text-white/40 text-xs">فيديو حتى 200 ميغابايت · صورة حتى 20 ميغابايت</p>
                    </button>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10">
                      {isImage ? (
                        <img
                          src={previewUrl!}
                          alt="معاينة"
                          className="w-full rounded-2xl object-cover"
                          style={{ maxHeight: 300 }}
                        />
                      ) : (
                        <video
                          src={previewUrl!}
                          className="w-full rounded-2xl"
                          style={{ maxHeight: 280, objectFit: "cover" }}
                          controls
                          playsInline
                        />
                      )}
                      <button
                        type="button"
                        onClick={clearFile}
                        className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="p-3 flex items-center gap-2">
                        {isImage ? (
                          <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                        <span className="text-white/70 text-xs truncate">{selectedFile.name}</span>
                        <span className="text-white/40 text-xs flex-shrink-0">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {uploading && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-white/60 mb-1">
                        <span>جارٍ الرفع...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="url"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label className="text-white/70 text-sm mb-2 block">رابط الفيديو أو الصورة</label>
                    <div className="relative">
                      <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="url"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary text-sm"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-white/30 text-xs mt-1">رابط MP4 أو صورة مباشرة</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-white/70 text-sm mb-2 block">الوصف</label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="اكتب وصف المنشور..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-primary text-sm resize-none"
              />
            </div>

            {/* ── ربط منتج (اختياري) ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/70 text-sm flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-primary/70" />
                  ربط منتج (اختياري)
                </label>
                {selectedProductId && (
                  <button
                    type="button"
                    onClick={() => setSelectedProductId(null)}
                    className="text-white/40 text-xs hover:text-white/70 transition-colors"
                  >
                    إلغاء الربط
                  </button>
                )}
              </div>

              {selectedProduct ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-3"
                >
                  {selectedProduct.images[0] && (
                    <img
                      src={selectedProduct.images[0]}
                      alt={selectedProduct.title}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{selectedProduct.title}</p>
                    <p className="text-primary text-xs font-bold mt-0.5">{selectedProduct.price.toLocaleString()} د.ج</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                </motion.div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowProductPicker(true)}
                  disabled={myProducts.length === 0}
                  className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/50 text-sm hover:border-primary/40 hover:text-white/70 transition-all disabled:opacity-30"
                >
                  <span>{myProducts.length === 0 ? "لا توجد منتجات معتمدة" : "اختر منتجاً لعرضه في المنشور"}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={isLoading || (tab === "file" ? !selectedFile : !mediaUrl.trim())}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base disabled:opacity-40 shadow-[0_0_24px_rgba(168,85,247,0.5)] mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {uploading ? `جارٍ الرفع ${uploadProgress}%` : "جارٍ النشر..."}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  نشر
                </>
              )}
            </motion.button>
          </form>
        </div>
        </SubscriptionGate>
      </div>

      {/* ── منتقي المنتجات ── */}
      <AnimatePresence>
        {showProductPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
              onClick={() => setShowProductPicker(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#111] border-t border-white/10 rounded-t-3xl z-50 max-h-[70vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                <h3 className="text-white font-bold text-base">اختر منتجاً</h3>
                <button onClick={() => setShowProductPicker(false)} className="text-white/50 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
                {myProducts.map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setShowProductPicker(false);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right w-full ${
                      selectedProductId === p.id
                        ? "bg-primary/15 border-primary/40"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ShoppingBag className="w-6 h-6 text-primary/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{p.title}</p>
                      <p className="text-primary text-sm font-bold mt-0.5">{p.price.toLocaleString()} د.ج</p>
                    </div>
                    {selectedProductId === p.id && (
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
