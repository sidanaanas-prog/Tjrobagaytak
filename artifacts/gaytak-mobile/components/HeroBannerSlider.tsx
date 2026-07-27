/**
 * HeroBannerSlider — نفس البانر المتحرك في الموقع
 * يجلب البانرات من /api/banners ويعرضها بتأثير fade مع نقاط تنقل
 */
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const SLIDE_HEIGHT = 170;
const INTERVAL_MS = 4000;
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  emoji: string | null;
  bg: string;          // Tailwind class — ignored on native, we use bgColors array
  accent: string;
  imageUrl: string | null;
  linkUrl: string | null;
}

// Accent colours matching the website fallback slides
const FALLBACK: Banner[] = [
  { id: "1", emoji: "🏕️", title: "أفضل سوق في المخيم",    subtitle: "اكتشف منتجات فريدة من أهل المخيم", bg: "", accent: "#a855f7", imageUrl: null, linkUrl: null },
  { id: "2", emoji: "⚡",  title: "تسوق سريع وموثوق",      subtitle: "تواصل مباشر مع البائعين",          bg: "", accent: "#06b6d4", imageUrl: null, linkUrl: null },
  { id: "3", emoji: "🛍️", title: "أشياء جميلة من إبداع أهل المخيم", subtitle: "يدوية، فريدة، ومميزة",  bg: "", accent: "#f59e0b", imageUrl: null, linkUrl: null },
  { id: "4", emoji: "🚀", title: "ابحث، اشتري، بيع",        subtitle: "كل شيء بين يديك في ثوانٍ",       bg: "", accent: "#10b981", imageUrl: null, linkUrl: null },
  { id: "5", emoji: "💜", title: "Gaytak — من المخيم للمخيم", subtitle: "مجتمعنا، سوقنا، فخرنا",       bg: "", accent: "#ec4899", imageUrl: null, linkUrl: null },
];

// ─────────────────────────────────────────────────────────────────────────────

export function HeroBannerSlider() {
  const [slides, setSlides]   = useState<Banner[]>(FALLBACK);
  const [index, setIndex]     = useState(0);
  const fadeAnim              = useRef(new Animated.Value(1)).current;
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch server banners once
  useEffect(() => {
    fetch(`https://${DOMAIN}/api/banners`)
      .then((r) => r.json())
      .then((data: Banner[]) => { if (Array.isArray(data) && data.length) setSlides(data); })
      .catch(() => {});
  }, []);

  const goTo = useCallback((next: number) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setIndex(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  const advance = useCallback(() => {
    setSlides((sl) => {
      const next = (index + 1) % sl.length;
      goTo(next);
      return sl;
    });
  }, [index, goTo]);

  useEffect(() => {
    timerRef.current = setInterval(advance, INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [advance]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  const accentColor = slide.accent || "#a855f7";

  function handlePress() {
    if (slide.linkUrl) {
      // external or internal link — try router first
      router.push("/(tabs)/explore" as any);
    } else {
      router.push("/(tabs)/explore" as any);
    }
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity activeOpacity={0.92} onPress={handlePress} style={styles.card}>
        {/* Slide content (fade transition) */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          {slide.imageUrl ? (
            <>
              <Image
                source={{ uri: slide.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              {/* Dark overlay for text readability */}
              <View style={styles.imgOverlay} />
            </>
          ) : (
            // Gradient-like solid background using accent colour
            <View style={[StyleSheet.absoluteFill, { backgroundColor: accentColor + "22" }]} />
          )}

          {/* Decorative circles */}
          {!slide.imageUrl && (
            <>
              <View style={[styles.decorCircle1, { backgroundColor: accentColor + "30" }]} />
              <View style={[styles.decorCircle2, { backgroundColor: accentColor + "18" }]} />
            </>
          )}

          {/* Text content */}
          <View style={styles.textBlock}>
            {!slide.imageUrl && slide.emoji && (
              <Text style={styles.emoji}>{slide.emoji}</Text>
            )}
            <Text style={styles.title} numberOfLines={2}>{slide.title}</Text>
            {slide.subtitle && (
              <Text style={styles.subtitle} numberOfLines={2}>{slide.subtitle}</Text>
            )}
            <View style={[styles.cta, { backgroundColor: accentColor + "33", borderColor: accentColor + "55" }]}>
              <Text style={[styles.ctaText, { color: "#FFF" }]}>استكشف الآن ←</Text>
            </View>
          </View>
        </Animated.View>

        {/* Dot indicators */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { if (timerRef.current) clearInterval(timerRef.current); goTo(i); timerRef.current = setInterval(advance, INTERVAL_MS); }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <View style={[
                styles.dot,
                i === index
                  ? { width: 20, backgroundColor: "#FFF" }
                  : { width: 6, backgroundColor: "rgba(255,255,255,0.4)" },
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  card: {
    height: SLIDE_HEIGHT,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0f0a1e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  imgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  decorCircle1: {
    position: "absolute", right: -30, top: -30,
    width: 140, height: 140, borderRadius: 70,
  },
  decorCircle2: {
    position: "absolute", left: -20, bottom: -20,
    width: 100, height: 100, borderRadius: 50,
  },
  textBlock: {
    position: "absolute",
    right: 20, top: 0, bottom: 0,
    justifyContent: "center",
    maxWidth: width * 0.65,
    alignItems: "flex-end",
  },
  emoji: { fontSize: 30, marginBottom: 4 },
  title: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "right",
    lineHeight: 26,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    textAlign: "right",
    marginBottom: 10,
  },
  cta: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  ctaText: { fontSize: 12, fontWeight: "700" },
  dots: {
    position: "absolute",
    bottom: 12,
    left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 6, borderRadius: 3,
  },
});
