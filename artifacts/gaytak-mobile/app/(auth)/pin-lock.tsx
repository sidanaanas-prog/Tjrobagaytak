import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function PinLockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();

  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(3);

  const handleDigit = (d: string) => {
    if (locked || submitting || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.length === 4) verifyPin(next);
  };

  const handleBackspace = () => {
    if (locked || submitting) return;
    setPin((p) => p.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  async function verifyPin(code: string) {
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/pin/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        if (data.error === "locked") {
          setLocked(true);
          Alert.alert("حساب مقفل", data.message || "تواصل مع الدعم");
        } else if (data.error === "wrong") {
          setRemaining(data.remaining ?? 0);
          setPin("");
          Alert.alert("كود خاطئ", `متبقى ${data.remaining} محاولات`);
        } else {
          Alert.alert("خطأ", data.error || "فشل التحقق");
          setPin("");
        }
        setSubmitting(false);
        return;
      }

      await AsyncStorage.setItem(`pin_unlocked_${user?.id}`, Date.now().toString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
      setPin("");
      setSubmitting(false);
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    iconBox: {
      width: 80, height: 80, borderRadius: 24,
      backgroundColor: colors.primary + "25",
      borderWidth: 1, borderColor: colors.primary + "40",
      alignItems: "center", justifyContent: "center", marginBottom: 20,
    },
    title: { fontSize: 22, fontWeight: "900", color: colors.foreground, marginBottom: 6 },
    subtitle: { fontSize: 14, color: colors.mutedForeground, marginBottom: 36 },
    dotsRow: { flexDirection: "row", gap: 16, marginBottom: 44 },
    dot: { width: 16, height: 16, borderRadius: 8 },
    keypad: { width: "100%", maxWidth: 280 },
    keypadRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 12 },
    key: {
      width: 82, height: 72, borderRadius: 20,
      backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    keyText: { color: colors.foreground, fontSize: 22, fontWeight: "700" },
    lockedBox: {
      backgroundColor: "#EF444415", borderRadius: 16, borderWidth: 1, borderColor: "#EF444430",
      padding: 16, alignItems: "center", gap: 8, marginBottom: 24, width: "100%",
    },
  });

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[s.iconBox, locked && { backgroundColor: "#EF444420", borderColor: "#EF444440" }]}>
        <Feather name="lock" size={36} color={locked ? "#EF4444" : colors.primary} />
      </View>
      <Text style={s.title}>قفل التطبيق</Text>
      <Text style={s.subtitle}>أدخل الكود الأربعي لفتح الحساب</Text>

      {/* النقاط */}
      <View style={s.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.dot, {
            backgroundColor: i < pin.length ? colors.primary : "transparent",
            borderWidth: 2,
            borderColor: i < pin.length ? colors.primary : colors.border,
          }]} />
        ))}
      </View>

      {remaining < 3 && !locked && (
        <Text style={{ color: "#EF4444", fontSize: 13, marginBottom: 16 }}>متبقى {remaining} محاولات</Text>
      )}

      {locked && (
        <View style={s.lockedBox}>
          <Feather name="shield-off" size={28} color="#EF4444" />
          <Text style={{ color: "#FCA5A5", fontWeight: "700", fontSize: 15 }}>تم تجاوز الحد الأقصى</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" }}>تواصل مع الدعم لإعادة تفعيل الحساب</Text>
        </View>
      )}

      {/* لوحة المفاتيح */}
      {!locked && (
        <View style={s.keypad}>
          {[["1","2","3"],["4","5","6"],["7","8","9"]].map((row, ri) => (
            <View key={ri} style={s.keypadRow}>
              {row.map((d) => (
                <TouchableOpacity key={d} style={s.key} onPress={() => handleDigit(d)} activeOpacity={0.7}>
                  <Text style={s.keyText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={s.keypadRow}>
            <View style={[s.key, { backgroundColor: "transparent", borderColor: "transparent" }]} />
            <TouchableOpacity style={s.key} onPress={() => handleDigit("0")} activeOpacity={0.7}>
              <Text style={s.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.key} onPress={handleBackspace} activeOpacity={0.7}>
              {submitting
                ? <ActivityIndicator color={colors.mutedForeground} />
                : <Feather name="delete" size={22} color={colors.mutedForeground} />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={{ marginTop: 28, paddingVertical: 8 }} onPress={async () => { await logout(); router.replace("/(auth)/login"); }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}
