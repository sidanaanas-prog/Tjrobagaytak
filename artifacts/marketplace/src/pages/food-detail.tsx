import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Star, Clock, MapPin, Minus, Plus, ShoppingCart,
  ChefHat, Flame, CheckCircle2, X
} from "lucide-react";
import { getApiUrl } from "@/lib/api-url";
import { getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const BASE = getApiUrl("");

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  category: string;
  isAvailable: boolean;
};

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
  menu: MenuItem[];
};

type CartItem = MenuItem & { quantity: number };

function CheckoutSheet({
  cart, restaurant, onClose, onSuccess,
}: {
  cart: CartItem[];
  restaurant: Restaurant;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const itemTotal = cart.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
  const deliveryFee = Number(restaurant.deliveryFee ?? 0);
  const total = itemTotal + deliveryFee;

  const handleOrder = async () => {
    if (!address.trim()) { toast({ title: "أدخل عنوان التوصيل", variant: "destructive" }); return; }
    const minOrder = Number(restaurant.minOrder ?? 0);
    if (itemTotal < minOrder) { toast({ title: `الحد الأدنى للطلب ${minOrder} ر.س`, variant: "destructive" }); return; }

    setLoading(true);
    try {
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/food-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          deliveryAddress: address,
          notes,
          paymentMethod,
          items: cart.map((it) => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity })),
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast({ title: "✅ تم إرسال الطلب!", description: "سيصلك تأكيد من المطعم قريباً" });
      onSuccess();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50 max-w-lg mx-auto bg-[#0e0e14] border-t border-white/10 rounded-t-3xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-white text-lg">تأكيد الطلب</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Cart summary */}
      <div className="space-y-2 mb-4 max-h-36 overflow-y-auto">
        {cart.map((it) => (
          <div key={it.id} className="flex items-center justify-between text-sm">
            <span className="text-white/80">{it.name} × {it.quantity}</span>
            <span className="text-white font-semibold">{(Number(it.price) * it.quantity).toFixed(1)} ر.س</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 pt-3 mb-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-white/60">
          <span>المجموع</span><span>{itemTotal.toFixed(1)} ر.س</span>
        </div>
        <div className="flex justify-between text-white/60">
          <span>رسوم التوصيل</span>
          <span>{deliveryFee === 0 ? "مجاني 🎉" : `${deliveryFee} ر.س`}</span>
        </div>
        <div className="flex justify-between text-white font-bold text-base">
          <span>الإجمالي</span><span>{total.toFixed(1)} ر.س</span>
        </div>
      </div>

      {/* Address */}
      <textarea
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="عنوان التوصيل..."
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 resize-none mb-3"
        dir="rtl"
      />

      {/* Notes */}
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظات (اختياري)..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50 mb-3"
        dir="rtl"
      />

      {/* Payment */}
      <div className="flex gap-2 mb-5">
        {[{ v: "cash", l: "💵 كاش" }, { v: "wallet", l: "💳 محفظة" }].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setPaymentMethod(v)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
              paymentMethod === v ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-white/50"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleOrder}
        disabled={loading}
        className="w-full py-3.5 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.5)] disabled:opacity-50"
      >
        {loading ? "جاري الإرسال..." : `تأكيد الطلب • ${total.toFixed(1)} ر.س`}
      </motion.button>
    </motion.div>
  );
}

export default function FoodDetailPage() {
  const [, params] = useRoute("/food/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? "";

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [activeCategory, setActiveCategory] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [ordered, setOrdered] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/restaurants/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setRestaurant(data);
        if (data?.menu?.length) setActiveCategory(data.menu[0].category);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const menuByCategory = useMemo(() => {
    if (!restaurant?.menu) return {};
    return restaurant.menu.reduce((acc: Record<string, MenuItem[]>, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [restaurant]);

  const categories = Object.keys(menuByCategory);

  const cartItems: CartItem[] = useMemo(() => {
    if (!restaurant?.menu) return [];
    return restaurant.menu
      .filter((it) => cart.has(it.id) && (cart.get(it.id) ?? 0) > 0)
      .map((it) => ({ ...it, quantity: cart.get(it.id) ?? 0 }));
  }, [cart, restaurant]);

  const cartTotal = cartItems.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
  const cartCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) next.delete(itemId);
      else next.set(itemId, updated);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <ChefHat className="w-14 h-14 text-white/10" />
        <p className="text-white/40">المطعم غير موجود</p>
        <button onClick={() => navigate("/food")} className="text-primary text-sm">العودة</button>
      </div>
    );
  }

  if (ordered) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <CheckCircle2 className="w-20 h-20 text-green-400" />
        </motion.div>
        <h2 className="text-2xl font-black text-white">تم الطلب! 🎉</h2>
        <p className="text-white/50 text-sm">سيصلك تأكيد من المطعم قريباً، يمكنك متابعة الطلب</p>
        <button
          onClick={() => navigate("/food/orders")}
          className="px-6 py-3 rounded-2xl bg-primary font-bold text-white text-sm shadow-[0_0_20px_rgba(168,85,247,0.4)]"
        >
          متابعة طلباتي
        </button>
        <button onClick={() => navigate("/food")} className="text-white/40 text-sm">العودة للمطاعم</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      <div className="relative h-52">
        {restaurant.coverImage ? (
          <img src={restaurant.coverImage} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <ChefHat className="w-16 h-16 text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <button
          onClick={() => navigate("/food")}
          className="absolute top-12 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"
        >
          <ArrowRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Info */}
      <div className="px-5 -mt-6 relative z-10 max-w-lg mx-auto">
        <div className="flex items-end gap-3 mb-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-background bg-black/80 shrink-0">
            {restaurant.logo ? (
              <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/30">
                <span className="text-white font-black text-xl">{restaurant.name[0]}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white">{restaurant.name}</h1>
            <p className="text-xs text-white/40">{restaurant.category}</p>
          </div>
          {!restaurant.isOpen && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">مغلق</span>
          )}
        </div>

        {restaurant.description && (
          <p className="text-sm text-white/50 mb-3">{restaurant.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-white/50 mb-4">
          {Number(restaurant.rating) > 0 && (
            <div className="flex items-center gap-1 text-yellow-400">
              <Star className="w-3.5 h-3.5 fill-yellow-400" />
              <span className="font-bold">{Number(restaurant.rating).toFixed(1)}</span>
              <span className="text-white/30">({restaurant.ratingCount})</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{restaurant.estimatedDeliveryMinutes} دقيقة</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            <span>{Number(restaurant.deliveryFee) === 0 ? "توصيل مجاني" : `${restaurant.deliveryFee} ر.س`}</span>
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? "bg-primary text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                    : "bg-white/5 text-white/50 border border-white/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-6 pb-40">
          {(activeCategory ? [activeCategory] : categories).map((cat) => (
            <div key={cat}>
              {categories.length > 1 && (
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">{cat}</h3>
              )}
              <div className="space-y-3">
                {(menuByCategory[cat] ?? []).map((item) => {
                  const qty = cart.get(item.id) ?? 0;
                  return (
                    <div key={item.id} className="flex gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                      {item.image && (
                        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-primary font-bold text-sm">{item.price} ر.س</span>
                          {restaurant.isOpen ? (
                            <div className="flex items-center gap-2">
                              {qty > 0 ? (
                                <>
                                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, -1)}
                                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                                    <Minus className="w-3.5 h-3.5 text-white" />
                                  </motion.button>
                                  <span className="text-white font-bold text-sm w-4 text-center">{qty}</span>
                                </>
                              ) : null}
                              <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, 1)}
                                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                                <Plus className="w-3.5 h-3.5 text-white" />
                              </motion.button>
                            </div>
                          ) : (
                            <span className="text-xs text-red-400/60">مغلق</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Bar */}
      <AnimatePresence>
        {cartCount > 0 && !showCheckout && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 inset-x-0 max-w-lg mx-auto p-4 z-40"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-primary shadow-[0_0_30px_rgba(168,85,247,0.6)]"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs font-black text-white">{cartCount}</span>
                </div>
                <span className="text-white font-bold text-sm">عرض السلة</span>
              </div>
              <span className="text-white font-black">{cartTotal.toFixed(1)} ر.س</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout Sheet */}
      <AnimatePresence>
        {showCheckout && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCheckout(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <CheckoutSheet
              cart={cartItems}
              restaurant={restaurant}
              onClose={() => setShowCheckout(false)}
              onSuccess={() => { setShowCheckout(false); setOrdered(true); setCart(new Map()); }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
