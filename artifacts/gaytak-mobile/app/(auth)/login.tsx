import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COUNTRIES = [
  { code: "+213", flag: "🇩🇿", name: "الجزائر" },
  { code: "+966", flag: "🇸🇦", name: "السعودية" },
  { code: "+971", flag: "🇦🇪", name: "الإمارات" },
  { code: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "+965", flag: "🇰🇼", name: "الكويت" },
  { code: "+20",  flag: "🇪🇬", name: "مصر" },
  { code: "+212", flag: "🇲🇦", name: "المغرب" },
  { code: "+216", flag: "🇹🇳", name: "تونس" },
  { code: "+218", flag: "🇱🇾", name: "ليبيا" },
  { code: "+962", flag: "🇯🇴", name: "الأردن" },
  { code: "+961", flag: "🇱🇧", name: "لبنان" },
  { code: "+964", flag: "🇮🇶", name: "العراق" },
  { code: "+963", flag: "🇸🇾", name: "سوريا" },
  { code: "+249", flag: "🇸🇩", name: "السودان" },
  { code: "+967", flag: "🇾🇪", name: "اليمن" },
  { code: "+970", flag: "🇵🇸", name: "فلسطين" },
  { code: "+968", flag: "🇴🇲", name: "عُمان" },
  { code: "+973", flag: "🇧🇭", name: "البحرين" },
];

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countryCode, setCountryCode] = useState("+213");
  const [showCountries, setShowCountries] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullPhone, setFullPhone] = useState("");

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  async function handleSendOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      let num = phone.trim();
      if (num.startsWith("0")) num = num.slice(1);
      const fp = `${countryCode}${num}`;
      setFullPhone(fp);
      const res = await fetch(`${BASE}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fp }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error(`خطأ في الاتصال بالخادم (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      setIsNewUser(data.isNewUser || false);
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: otp, name: isNewUser ? name : undefined }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        throw new Error(`خطأ في الاتصال بالخادم (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "رمز خاطئ");
      await login(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
    header: { alignItems: "center", marginBottom: 40 },
    appName: {
      fontSize: 36,
      fontWeight: "900",
      color: colors.foreground,
      letterSpacing: -1,
    },
    appNameAccent: { color: colors.primary },
    subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    label: {
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: "right",
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    countryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.muted,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countryFlag: { fontSize: 20 },
    countryCode: { fontSize: 14, color: colors.foreground, fontWeight: "600" },
    input: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.foreground,
      textAlign: "right",
      borderWidth: 1,
      borderColor: colors.border,
    },
    otpInput: {
      backgroundColor: colors.muted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 24,
      color: colors.foreground,
      textAlign: "center",
      borderWidth: 1,
      borderColor: colors.border,
      letterSpacing: 8,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    btnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    demoBtn: {
      backgroundColor: colors.muted,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 8,
    },
    demoBtnText: { color: colors.foreground, fontSize: 14, fontWeight: "600" },
    hint: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      padding: 12,
    },
    backText: { color: colors.mutedForeground, fontSize: 14 },
    countriesList: {
      backgroundColor: colors.muted,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: 200,
      overflow: "hidden",
    },
    countryItem: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    countryName: { color: colors.foreground, fontSize: 14, flex: 1, textAlign: "right" },
    privacyCard: {
      flexDirection: "row-reverse",
      alignItems: "center",
      gap: 12,
      marginTop: 16,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
    },
    privacyIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    privacyTextCol: { flex: 1, gap: 2 },
    privacyTitle: { fontSize: 14, fontWeight: "700", textAlign: "right" },
    privacyText: { fontSize: 11, textAlign: "right", lineHeight: 16 },
  });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.appName}>
            Gay<Text style={s.appNameAccent}>tak</Text>
          </Text>
          <Text style={s.subtitle}>
            {step === "phone" ? "أدخل رقم هاتفك للدخول" : isNewUser ? "أدخل رمزك واسمك" : "أدخل رمز التحقق"}
          </Text>
        </View>

        <View style={s.card}>
          {step === "phone" ? (
            <>
              <Text style={s.label}>رقم الهاتف</Text>
              <View style={s.phoneRow}>
                <TextInput
                  style={[s.input]}
                  placeholder="0551234567"
                  placeholderTextColor={colors.mutedForeground}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
                <TouchableOpacity style={s.countryBtn} onPress={() => setShowCountries(v => !v)}>
                  <Text style={s.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={s.countryCode}>{selectedCountry.code}</Text>
                  <Feather name={showCountries ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              {showCountries && (
                <ScrollView style={s.countriesList} nestedScrollEnabled>
                  {COUNTRIES.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      style={s.countryItem}
                      onPress={() => { setCountryCode(c.code); setShowCountries(false); }}
                    >
                      <Text style={s.countryName}>{c.name}</Text>
                      <Text style={s.countryFlag}>{c.flag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={s.hint}>سيصلك رمز التحقق عبر واتساب</Text>
              <TouchableOpacity style={s.btn} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>إرسال رمز التحقق</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {isNewUser && (
                <>
                  <Text style={s.label}>الاسم</Text>
                  <TextInput
                    style={s.input}
                    placeholder="اسمك الكامل"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    returnKeyType="next"
                  />
                </>
              )}
              <Text style={s.label}>رمز التحقق</Text>
              <TextInput
                style={s.otpInput}
                placeholder="• • • • • •"
                placeholderTextColor={colors.mutedForeground}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />
              <Text style={s.hint}>تم إرسال الرمز إلى {fullPhone}</Text>
              <TouchableOpacity style={s.btn} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>تحقق ودخول</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.backBtn} onPress={() => setStep("phone")}>
                <Text style={s.backText}>تغيير الرقم</Text>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Privacy Policy Card */}
        <TouchableOpacity
          style={[s.privacyCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}
          onPress={() => router.push("/privacy-policy")}
          activeOpacity={0.75}
        >
          <View style={[s.privacyIconBox, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="shield" size={18} color={colors.primary} />
          </View>
          <View style={s.privacyTextCol}>
            <Text style={[s.privacyTitle, { color: colors.foreground }]}>سياسة الخصوصية</Text>
            <Text style={[s.privacyText, { color: colors.mutedForeground }]}>
              باستخدام التطبيق توافق على سياسة الخصوصية — اضغط لقراءتها
            </Text>
          </View>
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
