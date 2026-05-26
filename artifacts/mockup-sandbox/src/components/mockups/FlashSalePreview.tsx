import { useState, useEffect } from "react";
import { Zap, Clock } from "lucide-react";

const MOCK = {
  salePrice: 89,
  endsAt: new Date(Date.now() + 2 * 3600_000 + 37 * 60_000 + 14_000).toISOString(),
  product: {
    title: "Nike Air Max — أبيض / أسود",
    price: 189,
    images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80"],
  },
  discount: Math.round((1 - 89 / 189) * 100),
};

function Countdown({ endsAt }: { endsAt: string }) {
  const [r, setR] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setR("انتهى"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setR(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="font-mono font-bold tabular-nums text-orange-400 text-sm">{r}</span>;
}

export default function FlashSalePreview() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 gap-6"
      style={{ background: "#0a0a0f", fontFamily: "system-ui, sans-serif" }}
      dir="rtl"
    >
      <p className="text-white/30 text-xs tracking-widest uppercase font-mono">
        Flash Sale — كيف يظهر في التطبيق
      </p>

      {/* ── البانر كما يظهر في الصفحة الرئيسية ── */}
      <div className="w-full max-w-sm">
        <p className="text-white/40 text-[10px] mb-2 font-mono">📱 الصفحة الرئيسية</p>
        <div className="rounded-2xl overflow-hidden border border-orange-500/30"
          style={{ background: "linear-gradient(to right, rgba(67,20,7,0.6), rgba(69,10,10,0.6))" }}>
          <div className="flex items-center gap-3 p-3">
            {/* صورة المنتج */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0">
              <img src={MOCK.product.images[0]} className="w-full h-full object-cover" />
            </div>
            {/* تفاصيل */}
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-bold text-orange-400 uppercase tracking-widest">⚡ عرض محدود</span>
              <p className="text-sm font-bold text-white line-clamp-1 mt-0.5">{MOCK.product.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base font-black text-orange-400 font-mono">{MOCK.salePrice} د.ج</span>
                <span className="text-xs text-white/30 line-through font-mono">{MOCK.product.price} د.ج</span>
                <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full">
                  -{MOCK.discount}%
                </span>
              </div>
            </div>
            {/* مؤقت */}
            <div className="flex flex-col items-center shrink-0">
              <Clock className="w-3 h-3 text-orange-400/70 mb-1" />
              <Countdown endsAt={MOCK.endsAt} />
              <span className="text-[9px] text-white/30 mt-0.5">ينتهي</span>
            </div>
          </div>
          {/* شريط التقدم */}
          <div className="h-0.5 bg-orange-950/60">
            <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 animate-pulse" style={{ width: "62%" }} />
          </div>
        </div>
      </div>

      {/* ── بطاقة المنتج كما تظهر في صفحة المنتج ── */}
      <div className="w-full max-w-sm">
        <p className="text-white/40 text-[10px] mb-2 font-mono">📦 صفحة المنتج</p>
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "rgba(249,115,22,0.25)", background: "rgba(15,15,25,0.95)" }}>
          <div className="relative">
            <img src={MOCK.product.images[0]} className="w-full h-40 object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }} />
            {/* شارة العرض */}
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ background: "rgba(249,115,22,0.9)", backdropFilter: "blur(4px)" }}>
              <Zap className="w-3 h-3 text-white" />
              <span className="text-[10px] font-black text-white">FLASH -{MOCK.discount}%</span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-white font-bold text-base">{MOCK.product.title}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-black text-orange-400 font-mono">{MOCK.salePrice}</span>
              <span className="text-sm text-white/30 line-through font-mono">{MOCK.product.price} د.ج</span>
            </div>
            <div className="flex items-center gap-2 mt-3 p-2 rounded-xl"
              style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
              <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="text-xs text-orange-400/80">ينتهي العرض خلال:</span>
              <Countdown endsAt={MOCK.endsAt} />
            </div>
            <button className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}>
              اشتري الآن ⚡
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
