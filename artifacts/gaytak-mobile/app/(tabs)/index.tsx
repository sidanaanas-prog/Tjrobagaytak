import { ProductCard } from "@/components/ProductCard";
import { HeroBannerSlider } from "@/components/HeroBannerSlider";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useStories, useAddStory, type AddStoryPayload } from "@/hooks/useStories";
import { useGetFeaturedProducts, useListCategories, customFetch } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const BACKGROUNDS = [
  { id: "midnight", colors: ["#0f0c29", "#302b63", "#24243e"] },
  { id: "aurora",   colors: ["#0d9488", "#6366f1", "#a855f7"] },
  { id: "purple",   colors: ["#4c1d95", "#7c3aed", "#c026d3"] },
  { id: "ocean",    colors: ["#1e3a5f", "#2563eb", "#0ea5e9"] },
  { id: "sunset",   colors: ["#7c2d12", "#dc2626", "#f97316"] },
  { id: "forest",   colors: ["#064e3b", "#059669", "#16a34a"] },
  { id: "rose",     colors: ["#831843", "#db2777", "#fb7185"] },
  { id: "gold",     colors: ["#78350f", "#d97706", "#fcd34d"] },
  { id: "candy",    colors: ["#6d28d9", "#ec4899", "#f9a8d4"] },
  { id: "night",    colors: ["#0f172a", "#1e293b", "#334155"] },
  { id: "lava",     colors: ["#1a0000", "#7f1d1d", "#ef4444"] },
];

const CAT_COLORS = [
  "#7c3aed", "#db2777", "#0891b2", "#d97706",
  "#059669", "#ea580c", "#dc2626", "#2563eb",
  "#65a30d", "#0d9488",
];

type StoryTab = "gallery" | "url" | "text";

function FlashCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <Text style={styles.flashTimer}>{remaining}</Text>;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: products, isLoading: loadingProducts } = useGetFeaturedProducts();
  const { data: categories, isLoading: loadingCats } = useListCategories();
  const { data: storyGroups, isLoading: loadingStories } = useStories();
  const { mutateAsync: addStory } = useAddStory();

  // Competition + Flash Sale
  const [competition, setCompetition] = useState<any>(null);
  const [flashSale, setFlashSale] = useState<any>(null);

  useEffect(() => {
    fetch(`${BASE}/api/competition/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.enabled) setCompetition(d); })
      .catch(() => {});

    fetch(`${BASE}/api/flash-sale/active`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.product) setFlashSale(d); })
      .catch(() => {});
  }, []);

  // Story modal state
  const [addingStory, setAddingStory] = useState(false);
  const [storyTab, setStoryTab] = useState<StoryTab>("gallery");
  const [storyCaption, setStoryCaption] = useState("");
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [storyText, setStoryText] = useState("");
  const [selectedBg, setSelectedBg] = useState(BACKGROUNDS[0]);
  const [publishingStory, setPublishingStory] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handlePickStoryImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول إلى معرض الصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [9, 16], quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) { Alert.alert("خطأ", "فشل ضغط الصورة"); return; }
      const sizeKB = Math.round((compressed.base64.length * 3) / 4 / 1024);
      if (sizeKB > 800) { Alert.alert("الصورة كبيرة جداً", "اختر صورة أخرى"); return; }
      setPickedImage({ uri: compressed.uri, base64: `data:image/jpeg;base64,${compressed.base64}` });
      setAddingStory(true);
    }
  }

  async function handleSubmitStory() {
    if (publishingStory) return;
    try {
      setPublishingStory(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      let payload: AddStoryPayload;
      if (storyTab === "text") {
        if (!storyText.trim()) { Alert.alert("مطلوب", "اكتب نص الحالة أولاً"); return; }
        payload = { mediaType: "text", caption: storyText.trim(), bgColor: `linear-gradient(160deg,${selectedBg.colors.join(",")})`, fontFamily: "Cairo" };
      } else if (storyTab === "url") {
        if (!urlInput.trim()) { Alert.alert("مطلوب", "أدخل رابط الصورة"); return; }
        payload = { mediaUrl: urlInput.trim(), mediaType: "image", caption: storyCaption.trim() || null };
      } else {
        if (!pickedImage) { Alert.alert("مطلوب", "اختر صورة أولاً"); return; }
        const fileName = `stories/${Date.now()}.jpg`;
        const uploadResult = await customFetch<{ url: string }>("/api/upload", {
          method: "POST",
          body: JSON.stringify({ base64: pickedImage.base64, path: fileName, contentType: "image/jpeg" }),
        });
        payload = { mediaUrl: uploadResult.url, mediaType: "image", caption: storyCaption.trim() || null };
      }
      await addStory(payload);
      resetStoryModal();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const status = e?.status;
      const apiMsg = e?.data?.error || e?.data?.message || (typeof e?.data === "string" ? e.data : null) || e?.message;
      let msg = "فشل نشر الحالة، حاول مرة أخرى";
      if (status === 413) msg = "الصورة كبيرة جداً";
      else if (status === 401) msg = "انتهت جلستك، أعد تسجيل الدخول";
      else if (status === 400 && apiMsg) msg = apiMsg;
      else if (status === 500) msg = "خطأ في الخادم";
      else if (apiMsg) msg = apiMsg;
      Alert.alert("خطأ في النشر", msg);
    } finally {
      setPublishingStory(false);
    }
  }

  function resetStoryModal() {
    setAddingStory(false); setPickedImage(null); setStoryCaption("");
    setUrlInput(""); setStoryText(""); setStoryTab("gallery");
  }

  const canSubmit =
    storyTab === "text" ? storyText.trim().length > 0 :
    storyTab === "url" ? urlInput.trim().length > 0 :
    !!pickedImage;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ─── Header ─── */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "30", borderColor: colors.primary + "50" }]}>
            {user?.avatar
              ? <Image source={{ uri: user.avatar }} style={styles.avatarImg} contentFit="cover" />
              : <Text style={[styles.avatarText, { color: colors.primary }]}>{user ? user.name[0].toUpperCase() : "؟"}</Text>
            }
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {user ? `أهلاً، ${user.name.split(" ")[0]}` : "البازار الرقمي"}
          </Text>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            Gay<Text style={{ color: colors.primary }}>tak</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/explore")} style={[styles.searchBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 + botPad }}>

        {/* ─── Stories ─── */}
        <View style={styles.storiesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {user && (
              <TouchableOpacity style={styles.storyItem} onPress={handlePickStoryImage}>
                <View style={[styles.storyRing, { borderColor: colors.primary }]}>
                  <View style={[styles.storyCircle, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="plus" size={22} color={colors.primary} />
                  </View>
                </View>
                <Text style={[styles.storyName, { color: colors.foreground }]}>حالتي</Text>
              </TouchableOpacity>
            )}
            {loadingStories && [1,2,3].map(k => (
              <View key={k} style={styles.storyItem}>
                <View style={[styles.storyRing, { borderColor: colors.border }]}>
                  <View style={[styles.storyCircle, { backgroundColor: colors.muted }]} />
                </View>
                <View style={{ width: 40, height: 8, borderRadius: 4, backgroundColor: colors.muted }} />
              </View>
            ))}
            {!loadingStories && storyGroups?.map(group => (
              <TouchableOpacity key={group.userId} style={styles.storyItem} onPress={() => router.push(`/story/${group.userId}`)}>
                <View style={[styles.storyRing, { borderColor: group.allViewed ? colors.mutedForeground : colors.primary }]}>
                  <View style={[styles.storyCircle, { backgroundColor: colors.muted }]}>
                    {group.userAvatar
                      ? <Image source={{ uri: group.userAvatar }} style={styles.storyAvatar} contentFit="cover" />
                      : <Text style={[styles.storyInitial, { color: colors.primary }]}>{group.userName[0]?.toUpperCase()}</Text>
                    }
                  </View>
                </View>
                <Text style={[styles.storyName, { color: colors.foreground }]} numberOfLines={1}>
                  {group.userName.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
            {!loadingStories && (!storyGroups || storyGroups.length === 0) && (
              <View style={{ paddingHorizontal: 8, justifyContent: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {user ? "لا توجد حالات — كن أول من ينشر!" : "لا توجد حالات حالياً"}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ─── Banner Slider ─── */}
        <HeroBannerSlider />

        {/* ─── 🏆 بانر المسابقة ─── */}
        {competition?.enabled && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/food")}
            style={[styles.competitionBanner, { borderColor: "#EAB30850" }]}
            activeOpacity={0.85}
          >
            <View style={[styles.competitionGlow, { backgroundColor: "#EAB30815" }]} />
            <View style={styles.competitionInner}>
              <View style={[styles.trophyBox, { backgroundColor: "#EAB30820", borderColor: "#EAB30840" }]}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <View style={styles.pulseDot} />
                  <Text style={styles.competitionStatus}>
                    {competition.status === "open" ? "مسابقة نشطة الآن 🔥" : "المسابقة قيد التجهيز ⏳"}
                  </Text>
                </View>
                <Text style={[styles.competitionTitle, { color: colors.foreground }]}>مسابقة غايتك الكبرى</Text>
                <Text style={styles.competitionSub}>
                  الجائزة: <Text style={{ color: "#EAB308", fontWeight: "700" }}>{competition.prize}</Text>
                  {" "}• اضغط للتفاصيل
                </Text>
              </View>
              <Feather name="chevron-left" size={18} color={colors.mutedForeground} />
            </View>
          </TouchableOpacity>
        )}

        {/* ─── ⚡ Flash Sale ─── */}
        {flashSale?.product && (
          <TouchableOpacity
            onPress={() => router.push(`/product/${flashSale.productId}` as any)}
            style={[styles.flashBanner, { borderColor: "#F9731650" }]}
            activeOpacity={0.85}
          >
            <View style={[styles.flashImg, { backgroundColor: "#F9731620" }]}>
              {flashSale.product.images?.[0]
                ? <Image source={{ uri: flashSale.product.images[0] }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                : <Feather name="zap" size={24} color="#F97316" />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flashLabel}>⚡ عرض محدود</Text>
              <Text style={[styles.flashTitle, { color: colors.foreground }]} numberOfLines={1}>{flashSale.product.title}</Text>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                <Text style={styles.flashPrice}>{flashSale.salePrice} د.ج</Text>
                <Text style={[styles.flashOldPrice, { color: colors.mutedForeground }]}>{flashSale.product.price} د.ج</Text>
              </View>
            </View>
            <View style={{ alignItems: "center" }}>
              <Feather name="clock" size={14} color="#F97316" />
              <FlashCountdown endsAt={flashSale.endsAt} />
              <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>ينتهي</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ─── 💊 صيدلية شفاء ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14 }}>💊</Text>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>صيدلية شفاء</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/food")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>اكتشف ‹</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pharmacyRow}>
            {[
              { icon: "file-text", label: "وصفة طبية",  desc: "أرسل وصفتك", color: "#34D399" },
              { icon: "calendar",  label: "حجز فحص",    desc: "احجز موعدك", color: "#60A5FA" },
              { icon: "message-circle", label: "استفسار طبي", desc: "اسأل الطبيب", color: "#A78BFA" },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push("/(tabs)/food")}
                style={[styles.pharmacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.pharmacyIcon, { backgroundColor: item.color + "25" }]}>
                  <Feather name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={[styles.pharmacyLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.pharmacyDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── التصنيفات ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>التصنيفات</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>الكل</Text>
            </TouchableOpacity>
          </View>
          {loadingCats
            ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {categories?.map((cat, i) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => router.push(`/(tabs)/explore?category=${cat.name}` as any)}
                    style={[styles.catCard, {
                      backgroundColor: CAT_COLORS[i % CAT_COLORS.length] + "30",
                      borderColor: CAT_COLORS[i % CAT_COLORS.length] + "50",
                    }]}
                  >
                    <Text style={{ fontSize: 20 }}>{cat.icon || "📦"}</Text>
                    <Text style={[styles.catName, { color: colors.foreground }]} numberOfLines={2}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )
          }
        </View>

        {/* ─── الأكثر رواجاً ─── */}
        <View style={[styles.section, { paddingBottom: 8 }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>الأكثر رواجاً</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {loadingProducts
            ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            : !products || products.length === 0
              ? (
                <View style={styles.empty}>
                  <Feather name="package" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد منتجات بعد</Text>
                </View>
              )
              : (
                <View style={styles.grid}>
                  {products.slice(0, 6).map(p => (
                    <ProductCard key={p.id} product={p} style={styles.gridItem} />
                  ))}
                </View>
              )
          }
        </View>

      </ScrollView>

      {/* ─── Add Story Modal ─── */}
      <Modal visible={addingStory} animationType="slide" transparent={false} onRequestClose={() => !publishingStory && resetStoryModal()}>
        <View style={[styles.modalFullScreen, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: topPad + 8 }]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => !publishingStory && resetStoryModal()} disabled={publishingStory}>
                  <Feather name="x" size={20} color={publishingStory ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>نشر حالة جديدة</Text>
                <Feather name={storyTab === "text" ? "type" : "image"} size={20} color={colors.primary} />
              </View>

              <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
                {([["gallery","📷 صورة"],["url","🔗 رابط"],["text","✏️ نص"]] as [StoryTab,string][]).map(([t, label]) => (
                  <TouchableOpacity key={t} style={[styles.tabBtn, t === storyTab && { backgroundColor: colors.primary }]} onPress={() => setStoryTab(t)}>
                    <Text style={[styles.tabBtnText, { color: t === storyTab ? "#FFF" : colors.mutedForeground }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {storyTab === "gallery" && (
                <>
                  {pickedImage ? (
                    <View style={styles.previewWrap}>
                      <Image source={{ uri: pickedImage.uri }} style={styles.previewImg} contentFit="cover" />
                      {!publishingStory && (
                        <TouchableOpacity style={styles.changeImgBtn} onPress={handlePickStoryImage}>
                          <Feather name="refresh-cw" size={14} color="#FFF" />
                          <Text style={styles.changeImgText}>تغيير</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.pickImgBox, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={handlePickStoryImage}>
                      <Feather name="camera" size={28} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>اختر صورة</Text>
                    </TouchableOpacity>
                  )}
                  <TextInput style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    placeholder="أضف تعليقاً... (اختياري)" placeholderTextColor={colors.mutedForeground}
                    value={storyCaption} onChangeText={setStoryCaption} textAlign="right" editable={!publishingStory} />
                </>
              )}

              {storyTab === "url" && (
                <>
                  {urlInput.trim().length > 3 && <Image source={{ uri: urlInput.trim() }} style={styles.previewImg} contentFit="cover" />}
                  <TextInput style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: "left" }]}
                    placeholder="https://example.com/image.jpg" placeholderTextColor={colors.mutedForeground}
                    value={urlInput} onChangeText={setUrlInput} keyboardType="url" autoCapitalize="none" editable={!publishingStory} />
                  <TextInput style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    placeholder="تعليق (اختياري)" placeholderTextColor={colors.mutedForeground}
                    value={storyCaption} onChangeText={setStoryCaption} textAlign="right" editable={!publishingStory} />
                </>
              )}

              {storyTab === "text" && (
                <>
                  <View style={[styles.textPreview, { backgroundColor: selectedBg.colors[1] }]}>
                    <View style={[StyleSheet.absoluteFillObject, { opacity: 0.7, backgroundColor: selectedBg.colors[0] }]} />
                    <Text style={styles.textPreviewText}>{storyText.trim() || "اكتب حالتك هنا..."}</Text>
                  </View>
                  <TextInput style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, minHeight: 80 }]}
                    placeholder="اكتب نص حالتك..." placeholderTextColor={colors.mutedForeground}
                    value={storyText} onChangeText={setStoryText} textAlign="right" multiline maxLength={200} editable={!publishingStory} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, textAlign: "left" }}>{storyText.length}/200</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "700", textAlign: "right" }}>الخلفية</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
                    {BACKGROUNDS.map(bg => (
                      <TouchableOpacity key={bg.id} onPress={() => setSelectedBg(bg)}
                        style={[styles.bgSwatch, { backgroundColor: bg.colors[1] }, selectedBg.id === bg.id && { borderWidth: 2, borderColor: "#FFF", transform: [{ scale: 1.12 }] }]} />
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted, opacity: publishingStory ? 0.4 : 1 }]}
                  onPress={() => !publishingStory && resetStoryModal()} disabled={publishingStory}>
                  <Text style={[styles.modalBtnText, { color: colors.foreground }]}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, opacity: (!canSubmit || publishingStory) ? 0.5 : 1 }]}
                  onPress={handleSubmitStory} disabled={!canSubmit || publishingStory} activeOpacity={0.8}>
                  {publishingStory
                    ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ActivityIndicator color="#FFF" size="small" /><Text style={[styles.modalBtnText, { color: "#FFF" }]}>جارٍ النشر...</Text></View>
                    : <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Feather name="send" size={15} color="#FFF" /><Text style={[styles.modalBtnText, { color: "#FFF" }]}>نشر الحالة</Text></View>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row-reverse", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: 1 },
  headerCenter: { flex: 1, alignItems: "flex-end" },
  greeting: { fontSize: 11, fontWeight: "500" },
  appName: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontSize: 16, fontWeight: "700" },
  searchBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  storiesSection: { paddingVertical: 12 },
  storiesScroll: { paddingHorizontal: 16, gap: 14 },
  storyItem: { alignItems: "center", gap: 4, width: 64 },
  storyRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, padding: 2, alignItems: "center", justifyContent: "center" },
  storyCircle: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  storyAvatar: { width: "100%", height: "100%" },
  storyInitial: { fontSize: 22, fontWeight: "800" },
  storyName: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  // Competition Banner
  competitionBanner: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 20, borderWidth: 1,
    backgroundColor: "#1c1505", overflow: "hidden",
  },
  competitionGlow: { position: "absolute", right: -24, top: -24, width: 80, height: 80, borderRadius: 40 },
  competitionInner: { flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 12 },
  trophyBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  competitionStatus: { fontSize: 10, fontWeight: "700", color: "#EAB308", letterSpacing: 0.5 },
  competitionTitle: { fontSize: 14, fontWeight: "900", marginTop: 2 },
  competitionSub: { fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  // Flash Sale Banner
  flashBanner: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 18, borderWidth: 1,
    backgroundColor: "#1a0a02", flexDirection: "row-reverse", alignItems: "center",
    padding: 10, gap: 12,
  },
  flashImg: { width: 64, height: 64, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  flashLabel: { fontSize: 9, fontWeight: "700", color: "#F97316", letterSpacing: 1, marginBottom: 2 },
  flashTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  flashPrice: { fontSize: 16, fontWeight: "900", color: "#F97316", fontVariant: ["tabular-nums"] },
  flashOldPrice: { fontSize: 12, textDecorationLine: "line-through" },
  flashTimer: { fontSize: 13, fontWeight: "800", color: "#F97316", fontVariant: ["tabular-nums"] },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  seeAll: { fontSize: 12, fontWeight: "600" },

  // Pharmacy
  pharmacyRow: { flexDirection: "row-reverse", gap: 10 },
  pharmacyCard: { flex: 1, padding: 14, borderRadius: 18, borderWidth: 1, alignItems: "flex-end", gap: 8 },
  pharmacyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pharmacyLabel: { fontSize: 13, fontWeight: "700", textAlign: "right" },
  pharmacyDesc: { fontSize: 10, textAlign: "right", lineHeight: 15 },

  // Categories
  catCard: { width: 72, height: 72, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  catName: { fontSize: 9, fontWeight: "700", textAlign: "center", paddingHorizontal: 4, lineHeight: 13 },

  // Products
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "47%" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },

  // Modal
  modalFullScreen: { flex: 1 },
  modalScrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32 },
  modalBox: { width: "100%", borderRadius: 24, padding: 24, gap: 14, borderWidth: 1 },
  modalHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontWeight: "800" },
  previewWrap: { position: "relative" },
  previewImg: { width: "100%", height: 200, borderRadius: 16 },
  changeImgBtn: { position: "absolute", bottom: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  changeImgText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  pickImgBox: { height: 140, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  captionInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 48 },
  modalBtns: { flexDirection: "row-reverse", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
  tabRow: { flexDirection: "row-reverse", borderRadius: 16, padding: 4, gap: 4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabBtnText: { fontSize: 12, fontWeight: "700" },
  textPreview: { height: 160, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 16 },
  textPreviewText: { color: "#FFF", fontSize: 20, fontWeight: "800", textAlign: "center", lineHeight: 30 },
  bgSwatch: { width: 44, height: 44, borderRadius: 14, marginLeft: 8 },
});
