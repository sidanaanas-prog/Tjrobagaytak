import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function SellerVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docBase64, setDocBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function pickDocument() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول إلى معرض الصور");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!compressed.base64) { Alert.alert("خطأ", "فشل معالجة الصورة"); return; }
      setDocPreview(compressed.uri);
      setDocBase64(`data:image/jpeg;base64,${compressed.base64}`);
    }
  }

  async function handleSubmit() {
    if (!docBase64) {
      Alert.alert("وثيقة ناقصة", "ارفع صورة بطاقة الهوية للتحقق");
      return;
    }
    setSubmitting(true);
    try {
      setUploading(true);
      // Upload to storage
      const fileName = `sellers/${user!.id}/id_${Date.now()}.jpg`;
      const uploadResult = await customFetch<{ url: string }>("/api/upload", {
        method: "POST",
        body: JSON.stringify({ base64: docBase64, path: fileName, contentType: "image/jpeg" }),
      });
      setUploading(false);

      const res = await fetch(`${BASE}/api/seller/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idDocumentUrl: uploadResult.url }),
      });
      const data = await res.json();
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "✅ تم التسجيل!",
          "🎉 مبروك! تم تفعيل التجربة المجانية لمدة 7 أيام",
          [{ text: "ابدأ البيع", onPress: () => router.push("/(tabs)/sell") }]
        );
      } else {
        Alert.alert("خطأ", data.error || "فشل التسجيل");
      }
    } catch (e: any) {
      Alert.alert("خطأ", e?.message || "تعذر الاتصال بالخادم");
    }
    setSubmitting(false);
    setUploading(false);
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>يجب تسجيل الدخول</Text>
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>توثيق البائع</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "25" }]}>
          <View style={[styles.infoBannerIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="gift" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoBannerTitle, { color: colors.foreground }]}>7 أيام مجانية بعد التوثيق</Text>
            <Text style={[styles.infoBannerText, { color: colors.mutedForeground }]}>
              بعد رفع بطاقة الهوية، يتم تفعيل تجربتك المجانية تلقائياً. عند انتهائها يجب الاشتراك للاستمرار.
            </Text>
          </View>
        </View>

        {/* Section Header */}
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10 }}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>الوثائق المطلوبة</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>ارفع صورة واضحة للتحقق</Text>
          </View>
        </View>

        {/* Document Card */}
        <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Feather name="file-text" size={16} color={colors.primary} />
            <Text style={[styles.docTitle, { color: colors.foreground }]}>بطاقة الهوية</Text>
            <View style={[styles.requiredBadge]}>
              <Text style={styles.requiredText}>مطلوبة</Text>
            </View>
          </View>

          {docPreview ? (
            <View style={{ position: "relative" }}>
              <Image source={{ uri: docPreview }} style={styles.docPreview} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.removeDocBtn, { backgroundColor: "#EF4444" }]}
                onPress={() => { setDocPreview(null); setDocBase64(null); }}
              >
                <Feather name="x" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.uploadArea, { borderColor: colors.border }]}
              onPress={pickDocument}
            >
              <Feather name="upload" size={24} color={colors.mutedForeground} />
              <Text style={[styles.uploadText, { color: colors.mutedForeground }]}>اضغط لرفع صورة بطاقة الهوية</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Trial Info */}
        <View style={[styles.trialCard, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B30" }]}>
          <Feather name="clock" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trialTitle}>تجربة مجانية 7 أيام</Text>
            <Text style={[styles.trialText, { color: colors.mutedForeground }]}>
              بعد التوثيق، ستحصل على شارة بائع موثق وإمكانية نشر منتجاتك. عند انتهاء التجربة يجب الاشتراك في باقة مدفوعة للاستمرار.
            </Text>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: (!docBase64 || submitting) ? 0.5 : 1 }]}
          onPress={handleSubmit}
          disabled={!docBase64 || submitting}
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.submitBtnText}>جاري رفع الصورة...</Text>
            </>
          ) : submitting ? (
            <>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={styles.submitBtnText}>جاري التفعيل...</Text>
            </>
          ) : (
            <>
              <Feather name="check" size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>تفعيل التجربة والبدء</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  guestTitle: { fontSize: 17, fontWeight: "700" },
  loginBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  loginBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "900", textAlign: "center" },
  infoBanner: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  infoBannerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  infoBannerTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  infoBannerText: { fontSize: 12, lineHeight: 18 },
  sectionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionSub: { fontSize: 12, marginTop: 1 },
  docCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  docTitle: { fontSize: 14, fontWeight: "700" },
  requiredBadge: { backgroundColor: "#EF444420", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  requiredText: { fontSize: 10, color: "#EF4444", fontWeight: "700" },
  docPreview: { width: "100%", height: 160, borderRadius: 12 },
  removeDocBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadArea: {
    height: 160,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: { fontSize: 13 },
  trialCard: {
    flexDirection: "row-reverse",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    alignItems: "flex-start",
  },
  trialTitle: { fontSize: 12, fontWeight: "700", color: "#F59E0B", marginBottom: 4 },
  trialText: { fontSize: 11, lineHeight: 17 },
  submitBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#FFF" },
});
