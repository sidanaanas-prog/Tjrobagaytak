import { useParams, useLocation } from "wouter";
import {
  useGetProduct,
  getGetProductQueryKey,
  useCreateConversation,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ArrowRight, Store, Phone, MapPin, Package, Loader2 } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useState } from "react";
import { SkeletonCard } from "@/components/SkeletonCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
      const res = await fetch("/api/orders", {
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
      setLocation("/orders");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إنشاء الطلب" });
    } finally {
      setSubmitting(false);
    }
  }

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
            {/* Image */}
            <div className="relative w-full aspect-square bg-black">
              {product.images && product.images.length > 0 ? (
                <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" loading="eager" decoding="async" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: fallback }}>
                  <span className="text-4xl font-black text-white/10 uppercase">Gaytak</span>
                </div>
              )}

              {/* Back Button */}
              <button
                onClick={() => window.history.back()}
                className="absolute top-12 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center"
              >
                <ArrowRight className="w-5 h-5 text-white" />
              </button>

              {/* Status Badge */}
              {product.status !== "active" && (
                <div className="absolute top-12 left-4 bg-black/70 text-red-400 text-xs font-bold px-3 py-1 rounded-full uppercase">
                  {product.status}
                </div>
              )}
            </div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-5 py-5"
            >
              {/* Title & Price */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-black text-white flex-1">{product.title}</h1>
                <span className="text-2xl font-black text-accent font-mono">
                  {product.price.toFixed(0)} د.ج
                </span>
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
                      {product.seller?.role === "admin" && <VerifiedBadge size="xs" />}
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
                  <Link href={`/seller/${product.sellerId}`} className="flex-1">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="w-full h-14 bg-primary/15 border border-primary/30 text-primary font-bold text-sm rounded-2xl flex items-center justify-center gap-2"
                    >
                      <Store className="w-4 h-4" />
                      دخل المتجر
                    </motion.button>
                  </Link>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleContact}
                    disabled={createConversation.isPending || product.status !== "active"}
                    className="flex-1 h-14 bg-primary text-white font-black text-sm rounded-2xl shadow-[0_0_24px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
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
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleOrderClick}
                    disabled={product.status !== "active"}
                    className="flex-1 h-14 bg-accent text-white font-black text-sm rounded-2xl shadow-[0_0_24px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
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
