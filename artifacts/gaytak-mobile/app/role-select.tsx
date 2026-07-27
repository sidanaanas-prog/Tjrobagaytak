import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const ROLES = [
  {
    id: "seller",
    label: "بائع",
    desc: "أبيع منتجاتي على المنصة",
    icon: "shopping-bag" as const,
    color: "#7C3AED",
    bg: "#7C3AED18",
    border: "#7C3AED40",
  },
  {
    id: "driver",
    label: "سائق",
    desc: "أوصل ركاب وأربح من كورسا",
    icon: "truck" as const,
    color: "#F97316",
    bg: "#F9731618",
    border: "#F9731640",
  },
  {
    id: "passenger",
    label: "راكب",
    desc: "أحجز كورسا بسرعة وأمان",
    icon: "navigation" as const,
    color: "#3B82F6",
    bg: "#3B82F618",
    border: "#3B82F640",
  },
  {
    id: "shopper",
    label: "متسوق",
    desc: "أشتري من متاجر موثقة",
    icon: "tag" as const,
    color: "#10B981",
    bg: "#10B98118",
    border: "#10B98140",
  },
];

export default function RoleSelectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();

  const [selected, setSelected] = useState<string[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { router.replace("/(auth)/login"); return; }
    fetch(`${BASE}/api/user/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((roles: string[]) => {
        const safe = Array.isArray(roles) ? roles : [];
        setMyRoles(safe);
        setSelected(safe);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      Alert.alert("مطلوب", "اختر دوراً واحداً على الأقل");
      return;
    }
    setSaving(true);
    try {
      // إضافة الأدوار الجديدة
      for (const role of selected) {
        if (!myRoles.includes(role)) {
          await fetch(`${BASE}/api/user/roles`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ role }),
          });
        }
      }
      // حذف الأدوار المُزالة
      for (const role of myRoles) {
        if (!selected.includes(role)) {
          await fetch(`${BASE}/api/user/roles/${role}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      // تحديث الدور الأساسي محلياً
      if (selected.length > 0) {
        updateUser({ role: selected[0] as any });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const isNewDriver = selected.includes("driver") && !myRoles.includes("driver");
      const isNewSeller = selected.includes("seller") && !myRoles.includes("seller");

      if (isNewDriver) {
        Alert.alert("✅ تم!", "تم حفظ أدوارك. يجب رفع وثائق السائق.", [
          { text: "رفع الوثائق", onPress: () => router.replace("/driver-register") },
          { text: "لاحقاً", onPress: () => router.back() },
        ]);
      } else if (isNewSeller) {
        Alert.alert("✅ تم!", "تم حفظ أدوارك بنجاح!", [
          { text: "حسناً", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("✅ تم!", "تم حفظ أدوارك بنجاح!", [
          { text: "حسناً", onPress: () => router.back() },
        ]);
      }

      setMyRoles(selected);
    } catch {
      Alert.alert("خطأ", "فشل حفظ الأدوار، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: colors.muted,
      alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 22, fontWeight: "900", color: colors.foreground },
    subtitle: {
      fontSize: 13, color: colors.mutedForeground,
      textAlign: "right", paddingHorizontal: 16,
      paddingTop: 12, lineHeight: 20,
    },
    roleCard: {
      marginHorizontal: 16, marginTop: 10,
      borderRadius: 20, borderWidth: 1.5,
      padding: 16,
      flexDirection: "row-reverse", alignItems: "center", gap: 14,
    },
    iconBox: {
      width: 52, height: 52, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
    },
    roleLabel: { fontSize: 16, fontWeight: "800" },
    roleDesc: { fontSize: 12, marginTop: 3, lineHeight: 16 },
    checkCircle: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: "center", justifyContent: "center",
    },
    saveBtn: {
      margin: 16, marginTop: 24,
      borderRadius: 18, paddingVertical: 16,
      flexDirection: "row-reverse", alignItems: "center",
      justifyContent: "center", gap: 10,
    },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    hint: {
      fontSize: 11, color: colors.mutedForeground,
      textAlign: "center", marginTop: 8, marginHorizontal: 24,
    },
  });

  if (!user) return null;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.title}>اختر أدوارك</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={s.subtitle}>
            كيف تريد استخدام Gaytak؟ يمكنك اختيار أكثر من دور.
          </Text>

          {ROLES.map((role) => {
            const isSelected = selected.includes(role.id);
            return (
              <TouchableOpacity
                key={role.id}
                style={[s.roleCard, {
                  backgroundColor: isSelected ? role.bg : colors.card,
                  borderColor: isSelected ? role.border : colors.border,
                }]}
                onPress={() => toggle(role.id)}
                activeOpacity={0.8}
              >
                {/* Checkmark */}
                <View style={[s.checkCircle, {
                  backgroundColor: isSelected ? role.color : colors.muted,
                }]}>
                  <Feather
                    name={isSelected ? "check" : "plus"}
                    size={16}
                    color={isSelected ? "#FFF" : colors.mutedForeground}
                  />
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={[s.roleLabel, { color: isSelected ? role.color : colors.foreground }]}>
                    {role.label}
                  </Text>
                  <Text style={[s.roleDesc, { color: colors.mutedForeground }]}>
                    {role.desc}
                  </Text>
                </View>

                {/* Icon */}
                <View style={[s.iconBox, {
                  backgroundColor: isSelected ? role.bg : colors.muted,
                }]}>
                  <Feather
                    name={role.icon}
                    size={24}
                    color={isSelected ? role.color : colors.mutedForeground}
                  />
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Save Button */}
          <TouchableOpacity
            style={[s.saveBtn, {
              backgroundColor: selected.length > 0 ? colors.primary : colors.muted,
              opacity: saving ? 0.7 : 1,
            }]}
            onPress={handleSave}
            disabled={saving || selected.length === 0}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#FFF" />
                <Text style={s.saveBtnText}>
                  {selected.length === 0 ? "اختر دوراً واحداً على الأقل" : "حفظ وابدأ"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={s.hint}>
            إضافة دور السائق يتطلب رفع وثائق المركبة ورخصة القيادة للمراجعة
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
