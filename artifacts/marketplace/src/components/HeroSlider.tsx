import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  emoji: string | null;
  bg: string;
  accent: string;
  imageUrl: string | null;
  linkUrl: string | null;
}

const FALLBACK: Banner[] = [
  { id: "1", emoji: "🏕️", title: "أفضل سوق في المخيم", subtitle: "اكتشف منتجات فريدة من أهل المخيم", bg: "from-violet-600/40 to-fuchsia-600/20", accent: "#a855f7", imageUrl: null, linkUrl: null },
  { id: "2", emoji: "⚡", title: "تسوق سريع وموثوق", subtitle: "تواصل مباشر مع البائعين", bg: "from-cyan-600/30 to-blue-600/20", accent: "#06b6d4", imageUrl: null, linkUrl: null },
  { id: "3", emoji: "🛍️", title: "أشياء جميلة من إبداع أهل المخيم", subtitle: "يدوية، فريدة، ومميزة", bg: "from-amber-600/30 to-orange-600/20", accent: "#f59e0b", imageUrl: null, linkUrl: null },
  { id: "4", emoji: "🚀", title: "ابحث، اشتري، بيع", subtitle: "كل شيء بين يديك في ثوانٍ", bg: "from-emerald-600/30 to-teal-600/20", accent: "#10b981", imageUrl: null, linkUrl: null },
  { id: "5", emoji: "💜", title: "Gaytak — من المخيم للمخيم", subtitle: "مجتمعنا، سوقنا، فخرنا", bg: "from-pink-600/30 to-rose-600/20", accent: "#ec4899", imageUrl: null, linkUrl: null },
];

export function HeroSlider() {
  const [slides, setSlides] = useState<Banner[]>(FALLBACK);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/banners")
      .then((r) => r.json())
      .then((data: Banner[]) => { if (data?.length) setSlides(data); })
      .catch(() => {});
  }, []);

  const next = useCallback(() => {
    setSlides((sl) => { setIndex((i) => (i + 1) % sl.length); return sl; });
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [next]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const content = (
    <div className="mx-4 mt-2 rounded-3xl overflow-hidden relative h-[180px] bg-black border border-white/5 cursor-pointer">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          {slide.imageUrl ? (
            <>
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* تدرج داكن فوق الصورة لقراءة النص */}
              <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg}`} />
          )}
        </motion.div>
      </AnimatePresence>

      {!slide.imageUrl && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(236,72,153,0.15),transparent_50%)]" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`, backgroundSize: "20px 20px" }}
          />
        </>
      )}

      <div className="relative z-10 h-full flex flex-col justify-center px-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {!slide.imageUrl && <span className="text-3xl mb-1 block">{slide.emoji ?? "🛍️"}</span>}
            <h2 className="text-[22px] font-black text-white leading-tight drop-shadow-lg">{slide.title}</h2>
            {slide.subtitle && <p className="text-sm text-white/70 mt-1 drop-shadow">{slide.subtitle}</p>}
          </motion.div>
        </AnimatePresence>

        <motion.span
          whileTap={{ scale: 0.95 }}
          className="mt-3 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-4 py-2 rounded-full w-fit hover:bg-white/20 transition-colors inline-block"
        >
          استكشف الآن →
        </motion.span>
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); setIndex(i); }}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
          />
        ))}
      </div>
    </div>
  );

  return slide.linkUrl
    ? <Link href={slide.linkUrl}>{content}</Link>
    : <Link href="/products">{content}</Link>;
}
