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

type Step = "create" | "confirm";

export default function PinSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();

  const [step, setStep] = useState<Step>("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const target = step === "create" ? pin : confirmPin;
  const setTarget = step === "create" ? setPin : setConfirmPin;

  const handleDigit = (d: string) => {
    if (submitting || target.length >= 4) return;
    const next = target + d;
    setTarget(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.length === 4) {
      if (step === "create") {
        setTimeout(() => setStep("confirm"), 200);
      } else {
        submitPin(next);
      }
    }
  };

  const handleBackspace = () => {
    if (submitting) return;
    setTarget((p) => p.slice(0, -1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  async function submitPin(code: string) {
    if (code !== pin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "الأكواد غير متطابقة، أعد المحاولة");
      setStep("create");
      setPin("");
      setConfirmPin("");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/auth/pin/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الكود");
      await AsyncStorage.setItem(`pin_unlocked_${user?.id}`, Date.now().toString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
      setSubmitting(false);
    }
  }

  const title = step === "create" ? "أنشئ كود حماية" : "أكد الكود";
  const subtitle = step === "create" ? "اختر كود أربعي لحماية حسابك" : "أدخل الكود مرة أخرى للتأكيد";

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
    skipBtn: { marginTop: 28, paddingVertical: 8 },
    skipText: { color: colors.mutedForeground, fontSize: 13, textAlign: "center" },
  });

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.iconBox}>
        <Feather name="lock" size={36} color={colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>

      {/* النقاط */}
      <View style={s.dotsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.dot, {
            backgroundColor: i < target.length ? colors.primary : "transparent",
            borderWidth: 2,
            borderColor: i < target.length ? colors.primary : colors.border,
            shadowColor: i < target.length ? colors.primary : "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: i < target.length ? 0.8 : 0,
            shadowRadius: 8,
            elevation: i < target.length ? 4 : 0,
          }]} />
        ))}
      </View>

      {/* لوحة المفاتيح */}
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

      {step === "confirm" && (
        <TouchableOpacity style={s.skipBtn} onPress={() => { setStep("create"); setPin(""); setConfirmPin(""); }}>
          <Text style={s.skipText}>← إعادة الإدخال</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={s.skipBtn} onPress={() => router.replace("/(tabs)/")}>
        <Text style={s.skipText}>تخطي الآن</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 8, paddingVertical: 8 }} onPress={async () => { await logout(); router.replace("/(auth)/login"); }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </View>
  );
}
