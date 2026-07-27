import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useListProducts, useUpdateUser, customFetch } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { Image } from "expo-image";
import { router } from "expo-router";
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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, logout, updateUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { data: myProducts, isLoading } = useListProducts(
    { sellerId: user?.id },
    { query: { enabled: !!user } }
  );

  const { mutateAsync: patchUser } = useUpdateUser();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handlePickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("الإذن مطلوب", "نحتاج إذن الوصول إلى معرض الصور");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    try {
      setUploading(true);
      const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await patchUser({ id: user!.id, data: { avatar: base64Uri } });
      updateUser({ avatar: base64Uri });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("خطأ", "فشل تحديث الصورة، حاول مرة أخرى");
    } finally {
      setUploading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad + 20 }]}>
        <View style={[styles.bigAvatar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="user" size={40} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>حسابي</Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>سجّل دخولك لعرض حسابك</Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.primaryBtnText}>دخول / تسجيل</Text>
        </TouchableOpacity>

        {/* Privacy Policy Card */}
        <TouchableOpacity
          style={[styles.guestPrivacyCard, { backgroundColor: colors.card, borderColor: colors.primary + "50" }]}
          onPress={() => router.push("/privacy-policy")}
          activeOpacity={0.75}
        >
          <View style={[styles.guestPrivacyIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="shield" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.guestPrivacyTitle, { color: colors.foreground }]}>سياسة الخصوصية</Text>
            <Text style={[styles.guestPrivacyText, { color: colors.mutedForeground }]}>
              اضغط لقراءة سياسة الخصوصية الخاصة بنا
            </Text>
          </View>
          <Feather name="chevron-left" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  async function handleSaveName() {
    if (!nameInput.trim() || savingName) return;
    try {
      setSavingName(true);
      await patchUser({ id: user!.id, data: { name: nameInput.trim() } });
      updateUser({ name: nameInput.trim() });
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("خطأ", "فشل تحديث الاسم، حاول مرة أخرى");
    } finally {
      setSavingName(false);
    }
  }

  function handleLogout() {
    Alert.alert("تسجيل الخروج", "هل تريد الخروج من حسابك؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: async () => {
          await logout();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "حذف الحساب",
      "سيتم حذف حسابك وجميع بياناتك ومنتجاتك نهائياً. هذا الإجراء لا يمكن التراجع عنه.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف الحساب",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "تأكيد الحذف",
              "هل أنت متأكد تماماً؟ لن تتمكن من استعادة حسابك.",
              [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "نعم، احذف حسابي",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await customFetch("/api/users/me", { method: "DELETE" });
                      await logout();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    } catch (e: any) {
                      Alert.alert("خطأ", e?.message || "فشل حذف الحساب، حاول مرة أخرى");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  const activeCount = myProducts?.products?.filter((p) => p.status === "active").length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: topPad + 12, paddingBottom: 80 + botPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} activeOpacity={0.8}>
          <View style={[styles.bigAvatar, { backgroundColor: colors.primary + "25", borderColor: colors.primary + "50" }]}>
            {user.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <Text style={[styles.bigAvatarText, { color: colors.primary }]}>
                {user.name[0].toUpperCase()}
              </Text>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFF" size="small" />
              </View>
            )}
          </View>
          <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={12} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nameRow}
          onPress={() => { setNameInput(user.name); setEditingName(true); }}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={14} color={colors.primary} />
          <Text style={[styles.name, { color: colors.foreground }]}>{user.name}</Text>
        </TouchableOpacity>
        <Text style={[styles.phone, { color: colors.mutedForeground }]}>{user.phone || user.email}</Text>

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>منشور</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{myProducts?.total ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>إجمالي</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 10 }}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/sell")}
        >
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={styles.actionBtnText}>أضف منتجاً</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtnOutline, { borderColor: colors.primary + "60", backgroundColor: colors.card }]}
          onPress={() => router.push("/my-listings")}
        >
          <Feather name="package" size={18} color={colors.primary} />
          <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>إدارة منتجاتي</Text>
        </TouchableOpacity>
      </View>

      {/* Driver Section */}
      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>النقل</Text>
        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/ride-driver")}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>لوحة السائق</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>تفعيل وضع السائق وقبول الطلبات</Text>
          </View>
          <View style={[styles.menuIcon, { backgroundColor: colors.secondary + "18" }]}>
            <Feather name="truck" size={15} color={colors.secondary} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}
          onPress={() => router.push("/driver-register")}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>تسجيل كسائق</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>رفع وثائق + معلومات المركبة</Text>
          </View>
          <View style={[styles.menuIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="user-plus" size={15} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* My Listings */}
      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>منتجاتي</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : !myProducts?.products || myProducts.products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="package" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد منتجات بعد</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {myProducts.products.map((p) => (
              <ProductCard key={p.id} product={p} style={styles.gridItem} />
            ))}
          </View>
        )}
      </View>

      {/* Role Selection */}
      <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>حسابي</Text>
        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/role-select" as any)}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>تغيير الدور</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
              {user.role === "seller" ? "🏪 بائع" :
               user.role === "driver" ? "🚗 سائق" :
               user.role === "passenger" ? "🧳 راكب" :
               "🛍 متسوق"} — اضغط للتغيير
            </Text>
          </View>
          <View style={[styles.menuIcon, { backgroundColor: "#7C3AED18" }]}>
            <Feather name="users" size={15} color="#7C3AED" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Settings & Legal */}
      <View style={{ paddingHorizontal: 16, marginTop: 12, gap: 1 }}>
        <TouchableOpacity
          style={[styles.menuRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/privacy-policy")}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }} />
          <Text style={[styles.menuLabel, { color: colors.foreground }]}>سياسة الخصوصية</Text>
          <View style={[styles.menuIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="shield" size={15} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutBtn, { borderColor: colors.destructive + "40" }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>تسجيل الخروج</Text>
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={styles.deleteAccountBtn}
        onPress={handleDeleteAccount}
        activeOpacity={0.7}
      >
        <Feather name="trash-2" size={13} color={colors.mutedForeground} />
        <Text style={[styles.deleteAccountText, { color: colors.mutedForeground }]}>حذف الحساب نهائياً</Text>
      </TouchableOpacity>
    </ScrollView>

    {/* Edit Name Modal */}
    <Modal visible={editingName} animationType="fade" transparent onRequestClose={() => setEditingName(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingName(false)}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>تعديل الاسم</Text>
            <Feather name="user" size={20} color={colors.primary} />
          </View>
          <TextInput
            style={[styles.nameInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="اكتب اسمك الكامل"
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: nameInput.trim() ? 1 : 0.5 }]}
            onPress={handleSaveName}
            disabled={!nameInput.trim() || savingName}
          >
            {savingName
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>حفظ الاسم</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  bigAvatar: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#09090F",
  },
  bigAvatarText: { fontSize: 36, fontWeight: "900" },
  guestTitle: { fontSize: 22, fontWeight: "800" },
  guestSub: { fontSize: 14 },
  primaryBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20 },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  guestPrivacyCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignSelf: "stretch",
    marginHorizontal: 4,
  },
  guestPrivacyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  guestPrivacyTitle: { fontSize: 13, fontWeight: "700" },
  guestPrivacyText: { fontSize: 11 },
  profileHeader: { alignItems: "center", paddingTop: 12, paddingHorizontal: 16, gap: 6 },
  name: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  phone: { fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginTop: 16,
    width: "100%",
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statDivider: { width: 1, marginVertical: 4 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
  },
  actionBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  actionBtnOutline: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  actionBtnOutlineText: { fontSize: 15, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800", textAlign: "right", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "47%" },
  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14 },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { fontSize: 14, fontWeight: "600" },
  logoutBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 16,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
  deleteAccountBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 10,
  },
  deleteAccountText: { fontSize: 12, fontWeight: "500" },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    width: "100%",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  nameInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    textAlign: "right",
  },
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
