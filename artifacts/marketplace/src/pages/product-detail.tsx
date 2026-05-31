import { useParams, useLocation } from "wouter";
import {
  useGetProduct,
  getGetProductQueryKey,
  useCreateConversation,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowRight, Store, Phone, MapPin, Package, Loader2, ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getApiUrl } from "@/lib/api-url";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const BASE = getApiUrl("");

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: product, isLoading, error } = useGetProduct(id || "", {
    query: { enabled: !!id, queryKey: getGetProductQueryKey(id || "") },
  });

  const createConversation = useCreateConversation();

  // Order dialog state
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [orderPhone, setOrderPhone] = useState("");
  const [orderAddress, setOrderAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);

  // تحقق هل المستخدم طلب منتجاً من هذا البائع
  useEffect(() => {
    if (!user || !product?.sellerId) return;
    const token = getMemToken();
    fetch(`${BASE}/api/orders?role=buyer`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((orders: any[]) => {
        const found = Array.isArray(orders) && orders.some(
          (o) => (o.seller?.id === product.sellerId || o.sellerId === product.sellerId)
               && o.status !== "cancelled"
        );
        setHasOrder(found);
      })
      .catch(() => {});
  }, [user, product?.sellerId]);

  const handleContact = () => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول", description: "سجّل دخولك للتواصل مع البائعين." });
      setLocation("/login");
      return;
    }
    if (user.id === product?.sellerId) {
      toast({ title: "هذا منتجك!", description: "لا يمكنك مراسلة نفسك." });
      return;
    }
    createConversation.mutate(
      { data: { recipientId: product!.sellerId, productId: product!.id } },
      {
        onSuccess: (conv) => setLocation(`/chat/${conv.id}`),
        onError: (err: any) => toast({ variant: "destructive", title: "خطأ", description: err?.message }),
      }
    );
  };

  const handleOrderClick = () => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول", description: "سجّل دخولك لإنشاء طلب." });
      setLocation("/login");
      return;
    }
    if (user.id === product?.sellerId) {
      toast({ title: "هذا منتجك!", description: "لا يمكنك طلب منتجك الخاص." });
      return;
    }
    if (product?.status !== "active") {
      toast({ title: "المنتج غير متاح", description: "لا يمكن طلب هذا المنتج حالياً." });
      return;
    }
    setOrderPhone("");
    setShowOrderDialog(true);
  };

  async function submitOrder() {
    if (!orderPhone.trim()) {
      toast({ variant: "destructive", title: "رقم الهاتف مطلوب", description: "أدخل رقم هاتفك للتواصل مع البائع." });
      return;
    }
    setSubmitting(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: product!.id,
          phone: orderPhone.trim(),
          shippingAddress: orderAddress.trim() || null,
          notes: orderNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "خطأ", description: data.error || "تعذر إنشاء الطلب" });
        return;
      }
      toast({ title: "تم إنشاء الطلب! 📦", description: "سيتواصل معك البائع قريباً." });
      setShowOrderDialog(false);
      setOrderAddress("");
      setOrderNotes("");
      setHasOrder(true);
      setLocation("/orders");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إنشاء الطلب" });
    } finally {
      setSubmitting(false);
    }
  }

  // Gallery state
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const dragStartX = useRef(0);

  const images = product?.images && product.images.length > 0 ? product.images : [];

  const goNext = useCallback(() => setActiveImg((i) => (i + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setActiveImg((i) => (i - 1 + images.length) % images.length), [images.length]);

  // keyboard nav in lightbox
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, goNext, goPrev]);

  const hash = id ? id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  const hue1 = hash % 360;
  const hue2 = (hash * 2) % 360;
  const fallback = `linear-gradient(135deg, hsl(${hue1}, 100%, 25%), hsl(${hue2}, 100%, 12%))`;

  return (
    <AppLayout>
      <div className="flex flex-col">
        {isLoading ? (
          <div className="px-5 pt-8 space-y-4">
            <div className="w-full aspect-square rounded-2xl bg-white/5 animate-pulse" />
            <div className="space-y-3">
              <div className="w-3/4 h-6 bg-white/5 animate-pulse rounded" />
              <div className="w-1/3 h-5 bg-white/5 animate-pulse rounded" />
              <div className="w-full h-4 bg-white/5 animate-pulse rounded mt-4" />
              <div className="w-2/3 h-4 bg-white/5 animate-pulse rounded" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} compact />
              ))}
            </div>
          </div>
        ) : error || !product ? (
          <div className="flex flex-col items-center justify-center h-screen gap-4 px-6 text-center">
            <div className="text-5xl">🔍</div>
            <h2 className="text-xl font-black text-white">المنتج غير موجود</h2>
            <p className="text-muted-foreground text-sm">ربما تم حذفه من السوق</p>
            <Link href="/products">
              <button className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm">
                العودة للسوق
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* ── Image Gallery ── */}
            <div className="relative w-full aspect-square bg-black overflow-hidden select-none"
              onTouchStart={(e) => { dragStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - dragStartX.current;
                if (Math.abs(dx) > 40 && images.length > 1) dx < 0 ? goNext() : goPrev();
              }}
            >
              {images.length > 0 ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={activeImg}
                    src={images[activeImg]}
                    alt={`${product.title} - ${activeImg + 1}`}
                    className="w-full h-full object-cover cursor-zoom-in"
                    loading="eager"
                    decoding="async"
                    onClick={() => setLightbox(true)}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.22 }}
                  />
                </AnimatePresence>
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: fallback }}>
                  <span className="text-4xl font-black text-white/10 uppercase">Gaytak</span>
                </div>
              )}

              {/* Back Button */}
              <button
                onClick={() => window.history.back()}
                className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center z-10"
              >
                <ArrowRight className="w-5 h-5 text-white" />
              </button>

              {/* Zoom hint */}
              {images.length > 0 && (
                <button
                  onClick={() => setLightbox(true)}
                  className="absolute top-12 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center z-10"
                >
                  <ZoomIn className="w-4 h-4 text-white/70" />
                </button>
              )}

              {/* Arrow buttons — only when > 1 image */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center z-10"
                  >
                    <ChevronLeft className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center z-10"
                  >
                    <ChevronRight className="w-5 h-5 text-white" />
                  </button>
                </>
              )}

              {/* Dot indicators */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`rounded-full transition-all duration-200 ${
                        i === activeImg
                          ? "w-5 h-1.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                          : "w-1.5 h-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Image counter badge */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-4 bg-black/60 backdrop-blur-sm text-white/70 text-[11px] font-bold px-2 py-0.5 rounded-full z-10">
                  {activeImg + 1}/{images.length}
                </div>
              )}

              {/* Status Badge */}
              {product.status !== "active" && (
                <div className="absolute top-12 left-16 bg-black/70 text-red-400 text-xs font-bold px-3 py-1 rounded-full uppercase z-10">
                  {product.status}
                </div>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex gap-2 px-4 py-3 bg-black/30 overflow-x-auto scrollbar-none">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      i === activeImg
                        ? "border-accent shadow-[0_0_10px_rgba(168,85,247,0.5)] scale-105"
                        : "border-white/10 opacity-50"
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}

            {/* ── Lightbox ── */}
            <AnimatePresence>
              {lightbox && (
                <motion.div
                  key="lightbox"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
                  onClick={() => setLightbox(false)}
                  onTouchStart={(e) => { dragStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    const dx = e.changedTouches[0].clientX - dragStartX.current;
                    if (Math.abs(dx) > 40 && images.length > 1) { dx < 0 ? goNext() : goPrev(); }
                  }}
                >
                  <button
                    onClick={() => setLightbox(false)}
                    className="absolute top-12 right-4 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-10"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>

                  {images.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        className="absolute left-4 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-10">
                        <ChevronLeft className="w-6 h-6 text-white" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); goNext(); }}
                        className="absolute right-4 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center z-10">
                        <ChevronRight className="w-6 h-6 text-white" />
                      </button>
                    </>
                  )}

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.img
                      key={`lb-${activeImg}`}
                      src={images[activeImg]}
                      alt=""
                      className="max-w-full max-h-screen object-contain px-16"
                      onClick={(e) => e.stopPropagation()}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                    />
                  </AnimatePresence>

                  {images.length > 1 && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                      {images.map((_, i) => (
                        <button key={i} onClick={(e) => { e.stopPropagation(); setActiveImg(i); }}
                          className={`rounded-full transition-all ${i === activeImg ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-5 py-5"
            >
              {/* Title & Price */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-black text-white flex-1">{product.title}</h1>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black text-accent font-mono block">
                    {product.price.toFixed(0)} د.ج
                  </span>
                  {(product as any).originalPrice != null && (product as any).originalPrice > product.price && (
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <span className="font-mono text-sm text-white/30 line-through">
                        {Number((product as any).originalPrice).toFixed(0)} د.ج
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                        -{Math.round((1 - product.price / (product as any).originalPrice) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {product.category && (
                <span className="inline-block bg-white/10 text-white/60 text-xs px-3 py-1 rounded-full mb-4">
                  {product.category}
                </span>
              )}

              {/* Seller */}
              <Link href={`/seller/${product.sellerId}`}>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 mb-5 cursor-pointer hover:bg-white/10 transition-colors">
                  <Avatar className="w-10 h-10 border border-accent/30">
                    <AvatarImage src={product.seller?.avatar} />
                    <AvatarFallback className="bg-accent/20 font-bold">
                      {product.seller?.name?.[0] || "؟"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm">{product.seller?.name || "بائع مجهول"}</span>
                      {(product.seller?.isVerified || product.seller?.role === "admin") && <VerifiedBadge size="xs" role={product.seller?.role} />}
                    </div>
                    <span className="text-xs text-muted-foreground">اضغط لزيارة المتجر ←</span>
                  </div>
                </div>
              </Link>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h2 className="text-xs text-white/50 uppercase tracking-wider mb-2">الوصف</h2>
                  <p className="text-sm text-white/70 leading-relaxed">{product.description}</p>
                </div>
              )}

              {/* Date */}
              <p className="text-xs text-muted-foreground mb-6">
                أُضيف في {new Date(product.createdAt).toLocaleDateString("ar")}
              </p>

              {/* Action Buttons */}
              {user?.id === product.sellerId ? (
                <div className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-center text-white/50 text-sm">
                  هذا منتجك
                </div>
              ) : (
                <div className="flex gap-2">
                  {/* دردشة — تظهر فقط بعد طلب */}
                  {hasOrder ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleContact}
                      disabled={createConversation.isPending}
                      className="flex-1 h-14 bg-primary/15 border border-primary/30 text-primary font-bold text-sm rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {createConversation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          دردشة
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <Link href={`/seller/${product.sellerId}`} className="flex-1">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        className="w-full h-14 bg-white/5 border border-white/10 text-white/60 font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
                      >
                        <Store className="w-4 h-4" />
                        المتجر
                      </motion.button>
                    </Link>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleOrderClick}
                    disabled={product.status !== "active"}
                    className="flex-1 h-14 bg-primary text-white font-black text-sm rounded-2xl shadow-[0_0_24px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Package className="w-4 h-4" />
                    اطلب الآن
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>

      {/* Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="sm:max-w-[420px] bg-[#0a0a0f] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-center text-white font-black text-lg">تأكيد الطلب</DialogTitle>
            <DialogDescription className="text-center text-white/50 text-sm">
              أدخل بياناتك ليتواصل معك البائع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-accent" />
                رقم الهاتف <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={orderPhone}
                onChange={(e) => setOrderPhone(e.target.value)}
                placeholder="+213..."
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 text-right"
                dir="ltr"
              />
            </div>
            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                العنوان
              </label>
              <input
                type="text"
                value={orderAddress}
                onChange={(e) => setOrderAddress(e.target.value)}
                placeholder="الولاية، البلدية، الحي..."
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 text-right"
              />
            </div>
            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/70">ملاحظات إضافية</label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="أي تفاصيل إضافية للبائع..."
                rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 text-right resize-none"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 mt-2">
            <button
              onClick={() => setShowOrderDialog(false)}
              className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold"
            >
              إلغاء
            </button>
            <button
              onClick={submitOrder}
              disabled={submitting || !orderPhone.trim()}
              className="flex-1 h-11 rounded-xl bg-accent text-white text-sm font-black shadow-[0_0_16px_rgba(236,72,153,0.3)] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              تأكيد الطلب
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
