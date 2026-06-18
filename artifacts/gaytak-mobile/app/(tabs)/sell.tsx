import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useCreateProduct, useListCategories } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SellScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { data: categories } = useListCategories();
  const createProduct = useCreateProduct();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!isLoggedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>سجّل دخولك أولاً</Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>لنشر منتجاتك للبيع</Text>
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.loginBtnText}>دخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function pickImage() {
    if (images.length >= 4) {
      Alert.alert("الحد الأقصى", "يمكنك رفع 4 صور فقط");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 900 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) return;
      const b64 = `data:image/jpeg;base64,${compressed.base64}`;
      setImages((prev) => [...prev, b64]);
    }
  }

  async function handleSubmit() {
    if (!title.trim() || !price.trim()) {
      Alert.alert("خطأ", "العنوان والسعر مطلوبان");
      return;
    }
    setLoading(true);
    try {
      await createProduct.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          price: parseFloat(price),
          images: images.length > 0 ? images : undefined,
          categoryId: categoryId || undefined,
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم النشر ✓", "منتجك أصبح مرئياً للجميع الآن");
      setTitle(""); setDescription(""); setPrice(""); setImages([]); setCategoryId(undefined);
      router.push("/(tabs)/profile");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 80 + botPad, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.foreground }]}>منتج جديد</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>انشر منتجك وابدأ البيع</Text>

      {/* Images */}
      <View style={styles.imageSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {images.map((img, i) => (
            <View key={i} style={styles.imgWrap}>
              <Image source={{ uri: img }} style={styles.imgPreview} contentFit="cover" />
              <TouchableOpacity
                style={[styles.removeImg, { backgroundColor: colors.destructive }]}
                onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Feather name="x" size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 4 && (
            <TouchableOpacity
              style={[styles.addImg, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={pickImage}
            >
              <Feather name="camera" size={24} color={colors.mutedForeground} />
              <Text style={[styles.addImgText, { color: colors.mutedForeground }]}>{images.length}/4</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Fields */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>عنوان المنتج *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="مثال: هاتف سامسونج S24"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          textAlign="right"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>الوصف</Text>
        <TextInput
          style={[styles.input, styles.textarea, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="وصف تفصيلي للمنتج..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlign="right"
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>السعر (دج) *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          textAlign="right"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>التصنيف</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories?.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, {
                backgroundColor: categoryId === cat.id ? colors.primary : colors.muted,
                borderColor: categoryId === cat.id ? colors.primary : colors.border,
              }]}
              onPress={() => setCategoryId(categoryId === cat.id ? undefined : cat.id)}
            >
              <Text style={[styles.catText, { color: categoryId === cat.id ? "#FFF" : colors.foreground }]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <>
            <Feather name="send" size={18} color="#FFF" />
            <Text style={styles.submitText}>نشر للبيع</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  guestTitle: { fontSize: 20, fontWeight: "800" },
  guestSub: { fontSize: 14 },
  loginBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 8 },
  loginBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "900", textAlign: "right" },
  subtitle: { fontSize: 14, textAlign: "right", marginTop: 4, marginBottom: 20 },
  imageSection: { marginBottom: 16 },
  imgWrap: { width: 90, height: 90, borderRadius: 12, marginRight: 10, overflow: "hidden", position: "relative" },
  imgPreview: { width: "100%", height: "100%" },
  removeImg: {
    position: "absolute", top: 4, right: 4, width: 20, height: 20,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  addImg: {
    width: 90, height: 90, borderRadius: 12, alignItems: "center",
    justifyContent: "center", borderWidth: 1, borderStyle: "dashed", gap: 4,
  },
  addImgText: { fontSize: 11 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", textAlign: "right", marginBottom: 6 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, borderWidth: 1 },
  textarea: { height: 100 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1,
  },
  catText: { fontSize: 13, fontWeight: "600" },
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: "#AA33FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
