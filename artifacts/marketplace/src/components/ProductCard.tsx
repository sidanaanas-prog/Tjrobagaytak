import { Link } from "wouter";
import { motion } from "framer-motion";
import { type Product } from "@workspace/api-client-react";
import { Clock, CheckCircle, XCircle, Heart } from "lucide-react";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface ProductCardProps {
  product: Product;
  index?: number;
  compact?: boolean;
  showStatus?: boolean;
}

const statusBadge = {
  active: {
    label: "مقبول",
    icon: CheckCircle,
    className: "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30",
  },
  pending: {
    label: "مراجعة",
    icon: Clock,
    className: "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30",
  },
  rejected: {
    label: "مرفوض",
    icon: XCircle,
    className: "bg-red-400/15 text-red-400 border border-red-400/30",
  },
};

export function ProductCard({ product, index = 0, compact = false, showStatus = false }: ProductCardProps) {
  const hasImages = product.images && product.images.length > 0;
  const mainImage = hasImages ? product.images![0] : "";
  const { user } = useAuth();
  const { wishlistIds, toggle } = useWishlist();
  const [, navigate] = useLocation();
  const isWishlisted = wishlistIds.has(product.id);

  const hash = product.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 2) % 360;
  const fallbackGradient = `linear-gradient(135deg, hsl(${hue1}, 100%, 25%), hsl(${hue2}, 100%, 12%))`;

  const status = product.status as keyof typeof statusBadge;
  const badge = statusBadge[status] || statusBadge.pending;
  const BadgeIcon = badge.icon;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate("/login"); return; }
    toggle(product.id);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <Link href={`/products/${product.id}`}>
          <div className="rounded-2xl overflow-hidden bg-card border border-white/5 active:border-primary/50 transition-colors">
            <div className="relative aspect-square w-full overflow-hidden bg-black">
              {hasImages ? (
                <img
                  src={mainImage}
                  alt={product.title}
                  className="object-cover w-full h-full"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: fallbackGradient }}
                >
                  <span className="text-2xl font-black text-white/10 tracking-tighter uppercase">
                    Gaytak
                  </span>
                </div>
              )}
              {showStatus && (
                <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold backdrop-blur-sm ${badge.className}`}>
                  <BadgeIcon className="w-2.5 h-2.5" />
                  {badge.label}
                </div>
              )}
              {/* زر المفضلة */}
              <button
                onClick={handleWishlist}
                className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-white/70"}`}
                />
              </button>
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm text-white line-clamp-1">{product.title}</h3>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{product.category || "—"}</span>
                <span className="text-sm font-bold text-accent font-mono">{product.price.toFixed(0)} د.ج</span>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link href={`/products/${product.id}`}>
        <div className="rounded-2xl overflow-hidden bg-card border border-white/5 active:border-primary/50 transition-colors">
          <div className="relative aspect-square w-full overflow-hidden bg-black">
            {hasImages ? (
              <img src={mainImage} alt={product.title} className="object-cover w-full h-full" loading="lazy" decoding="async" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: fallbackGradient }}
              >
                <span className="text-3xl font-black text-white/10 tracking-tighter uppercase">Gaytak</span>
              </div>
            )}
            {showStatus && (
              <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm ${badge.className}`}>
                <BadgeIcon className="w-3 h-3" />
                {badge.label}
              </div>
            )}
            {/* زر المفضلة */}
            <button
              onClick={handleWishlist}
              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${isWishlisted ? "fill-red-500 text-red-500" : "text-white/70"}`}
              />
            </button>
          </div>
          <div className="p-4">
            <div className="flex justify-between items-start gap-2 mb-1">
              <h3 className="font-semibold text-base text-white line-clamp-1">{product.title}</h3>
              <span className="font-mono font-bold text-accent whitespace-nowrap">
                {product.price.toFixed(0)} د.ج
              </span>
            </div>
            {product.category && (
              <span className="text-xs text-muted-foreground">{product.category}</span>
            )}
            <div className="mt-2 text-xs text-white/40">
              بواسطة {product.seller?.name || "مجهول"}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
