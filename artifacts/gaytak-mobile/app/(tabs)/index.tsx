import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useStories, useAddStory } from "@/hooks/useStories";
import { useGetFeaturedProducts, useListCategories } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CAT_ICONS: Record<string, string> = {
  Electronics: "smartphone",
  Fashion: "shopping-bag",
  "Home & Garden": "home",
  Sports: "activity",
  Books: "book",
  Art: "image",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: products, isLoading: loadingProducts } = useGetFeaturedProducts();
  const { data: categories, isLoading: loadingCats } = useListCategories();
  const { data: storyGroups } = useStories();
  const { mutateAsync: addStory } = useAddStory();

  const [addingStory, setAddingStory] = useState(false);
  const [storyCaption, setStoryCaption] = useState("");
  const [pickedImage, setPickedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [publishingStory, setPublishingStory] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handlePickStoryImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول إلى معرض الصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      // ضغط وتصغير الصورة بشكل مضمون قبل الرفع
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) {
        Alert.alert("خطأ", "فشل ضغط الصورة، حاول مرة أخرى");
        return;
      }
      const sizeKB = Math.round((compressed.base64.length * 3) / 4 / 1024);
      if (sizeKB > 800) {
        Alert.alert("الصورة كبيرة جداً", "اختر صورة أخرى");
        return;
      }
      setPickedImage({
        uri: compressed.uri,
        base64: `data:image/jpeg;base64,${compressed.base64}`,
      });
      setAddingStory(true);
    }
  }

  async function handleSubmitStory() {
    if (!pickedImage || publishingStory) return;
    try {
      setPublishingStory(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await addStory({ mediaUrl: pickedImage.base64, mediaType: "image", caption: storyCaption });
      setAddingStory(false);
      setPickedImage(null);
      setStoryCaption("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const status = e?.status;
      let msg = "فشل نشر الحالة، حاول مرة أخرى";
      if (status === 413) msg = "الصورة كبيرة جداً، اختر صورة أصغر";
      else if (status === 401) msg = "انتهت جلستك، أعد تسجيل الدخول";
      else if (status === 0 || e?.name === "TypeError") msg = "تحقق من اتصالك بالإنترنت";
      else if (e?.message) msg = e.message;
      Alert.alert("خطأ في النشر", msg);
    } finally {
      setPublishingStory(false);
    }
  }

  function handleCloseStoryModal() {
    if (publishingStory) return;
    setAddingStory(false);
    setPickedImage(null);
    setStoryCaption("");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile")}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "30", borderColor: colors.primary + "50" }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user ? user.name[0].toUpperCase() : "؟"}
              </Text>
            )}
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
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/explore")}
          style={[styles.searchBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 + botPad }}>

        {/* Stories Row */}
        <View style={styles.storiesSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {/* Add story button */}
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

            {/* Story groups */}
            {storyGroups?.map((group) => (
              <TouchableOpacity
                key={group.userId}
                style={styles.storyItem}
                onPress={() => router.push(`/story/${group.userId}`)}
              >
                <View style={[
                  styles.storyRing,
                  { borderColor: group.allViewed ? colors.mutedForeground : colors.primary }
                ]}>
                  <View style={[styles.storyCircle, { backgroundColor: colors.muted }]}>
                    {group.userAvatar ? (
                      <Image source={{ uri: group.userAvatar }} style={styles.storyAvatar} contentFit="cover" />
                    ) : (
                      <Text style={[styles.storyInitial, { color: colors.primary }]}>
                        {group.userName[0]?.toUpperCase()}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.storyName, { color: colors.foreground }]} numberOfLines={1}>
                  {group.userName.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Hero Banner */}
        <View style={[styles.hero, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <View style={styles.heroContent}>
            <Text style={[styles.heroLabel, { color: colors.primary }]}>السوق الرقمي</Text>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>اشتري وبيع بكل سهولة</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>آلاف المنتجات في مكان واحد</Text>
            <View style={styles.heroBtnRow}>
              <TouchableOpacity
                style={[styles.heroBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/explore")}
              >
                <Text style={styles.heroBtnText}>استكشف الآن</Text>
                <Feather name="arrow-left" size={14} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.heroBtn, { backgroundColor: colors.secondary }]}
                onPress={() => router.push("/ride-request")}
              >
                <Text style={styles.heroBtnText}>طلب نقل</Text>
                <Feather name="car" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.heroDecor, { backgroundColor: colors.primary + "20" }]} />
        </View>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>التصنيفات</Text>
          {loadingCats ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll}>
              <TouchableOpacity
                style={[styles.catChip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => router.push("/(tabs)/explore")}
              >
                <Text style={[styles.catText, { color: "#FFF" }]}>الكل</Text>
              </TouchableOpacity>
              {categories?.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  onPress={() => router.push(`/(tabs)/explore?category=${cat.name}`)}
                >
                  <Feather name={(CAT_ICONS[cat.name] || "tag") as any} size={14} color={colors.mutedForeground} />
                  <Text style={[styles.catText, { color: colors.foreground }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Featured Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>المميزة</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/explore")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {loadingProducts ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : !products || products.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="package" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد منتجات بعد</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} style={styles.gridItem} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Story Modal */}
      <Modal visible={addingStory} animationType="slide" transparent onRequestClose={handleCloseStoryModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseStoryModal} disabled={publishingStory}>
                <Feather name="x" size={20} color={publishingStory ? colors.border : colors.mutedForeground} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>نشر حالة جديدة</Text>
              <Feather name="image" size={20} color={colors.primary} />
            </View>

            {/* Image Preview */}
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
              <TouchableOpacity
                style={[styles.pickImgBox, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={handlePickStoryImage}
              >
                <Feather name="camera" size={28} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>اختر صورة</Text>
              </TouchableOpacity>
            )}

            {/* Caption */}
            <TextInput
              style={[styles.captionInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="أضف تعليقاً... (اختياري)"
              placeholderTextColor={colors.mutedForeground}
              value={storyCaption}
              onChangeText={setStoryCaption}
              textAlign="right"
              editable={!publishingStory}
            />

            {/* Buttons */}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.muted, opacity: publishingStory ? 0.4 : 1 }]}
                onPress={handleCloseStoryModal}
                disabled={publishingStory}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primary, opacity: (!pickedImage || publishingStory) ? 0.6 : 1 },
                ]}
                onPress={handleSubmitStory}
                disabled={!pickedImage || publishingStory}
                activeOpacity={0.8}
              >
                {publishingStory ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={[styles.modalBtnText, { color: "#FFF" }]}>جارٍ النشر...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="send" size={15} color="#FFF" />
                    <Text style={[styles.modalBtnText, { color: "#FFF" }]}>نشر الحالة</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: "flex-end" },
  greeting: { fontSize: 11, fontWeight: "500" },
  appName: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", borderWidth: 1, overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontSize: 16, fontWeight: "700" },
  searchBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  storiesSection: { paddingVertical: 12 },
  storiesScroll: { paddingHorizontal: 16, gap: 14 },
  storyItem: { alignItems: "center", gap: 4, width: 64 },
  storyRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2, padding: 2,
    alignItems: "center", justifyContent: "center",
  },
  storyCircle: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  storyAvatar: { width: "100%", height: "100%" },
  storyInitial: { fontSize: 22, fontWeight: "800" },
  storyName: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  hero: {
    margin: 16, borderRadius: 20, padding: 20, borderWidth: 1, overflow: "hidden",
  },
  heroContent: { alignItems: "flex-end" },
  heroLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  heroTitle: { fontSize: 22, fontWeight: "900", textAlign: "right", marginBottom: 4 },
  heroSub: { fontSize: 13, textAlign: "right", marginBottom: 14 },
  heroBtnRow: {
    flexDirection: "row-reverse", gap: 8,
  },
  heroBtn: {
    flexDirection: "row-reverse", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  heroBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  heroDecor: {
    position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: 60,
  },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", textAlign: "right" },
  seeAll: { fontSize: 13, fontWeight: "600" },
  catsScroll: { marginTop: 8 },
  catChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1,
  },
  catText: { fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "47%" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "flex-end",
  },
  modalBox: {
    width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14, borderWidth: 1, borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 17, fontWeight: "800" },
  previewWrap: { position: "relative" },
  previewImg: { width: "100%", height: 200, borderRadius: 16 },
  changeImgBtn: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeImgText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  pickImgBox: {
    height: 140,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  captionInput: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, minHeight: 48,
  },
  modalBtns: { flexDirection: "row-reverse", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
});
