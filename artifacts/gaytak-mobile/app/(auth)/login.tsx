import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COUNTRIES = [
  { code: "+213", flag: "🇩🇿", name: "الجزائر" },
  { code: "+966", flag: "🇸🇦", name: "السعودية" },
  { code: "+971", flag: "🇦🇪", name: "الإمارات" },
  { code: "+974", flag: "🇶🇦", name: "قطر" },
  { code: "+965", flag: "🇰🇼", name: "الكويت" },
  { code: "+973", flag: "🇧🇭", name: "البحرين" },
  { code: "+968", flag: "🇴🇲", name: "عُمان" },
  { code: "+962", flag: "🇯🇴", name: "الأردن" },
  { code: "+961", flag: "🇱🇧", name: "لبنان" },
  { code: "+963", flag: "🇸🇾", name: "سوريا" },
  { code: "+964", flag: "🇮🇶", name: "العراق" },
  { code: "+20",  flag: "🇪🇬", name: "مصر" },
  { code: "+212", flag: "🇲🇦", name: "المغرب" },
  { code: "+216", flag: "🇹🇳", name: "تونس" },
  { code: "+218", flag: "🇱🇾", name: "ليبيا" },
  { code: "+249", flag: "🇸🇩", name: "السودان" },
  { code: "+967", flag: "🇾🇪", name: "اليمن" },
  { code: "+970", flag: "🇵🇸", name: "فلسطين" },
  { code: "+222", flag: "🇲🇷", name: "موريتانيا" },
  { code: "+33",  flag: "🇫🇷", name: "فرنسا" },
  { code: "+49",  flag: "🇩🇪", name: "ألمانيا" },
  { code: "+44",  flag: "🇬🇧", name: "المملكة المتحدة" },
  { code: "+1",   flag: "🇺🇸", name: "الولايات المتحدة" },
  { code: "+90",  flag: "🇹🇷", name: "تركيا" },
  { code: "+7",   flag: "🇷🇺", name: "روسيا" },
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
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCodeValid, setInviteCodeValid] = useState<boolean | null>(null);
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullPhone, setFullPhone] = useState("");
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  // التحقق من كود الإحالة
  useEffect(() => {
    if (!inviteCode.trim()) { setInviteCodeValid(null); return; }
    const timer = setTimeout(async () => {
      setInviteCodeLoading(true);
      try {
        const res = await fetch(`${BASE}/api/auth/validate-invite-code/${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
        const data = await res.json();
        setInviteCodeValid(data.valid === true);
      } catch { setInviteCodeValid(null); }
      finally { setInviteCodeLoading(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [inviteCode]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      setIsNewUser(data.isNewUser || false);
      // إذا أرسل السيرفر الكود مباشرة → اعرضه على الشاشة
      if (data.code) {
        setOtpCode(String(data.code));
        setShowOtpModal(true);
      }
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim() || otp.length < 6) return;
    if (isNewUser && !name.trim()) {
      Alert.alert("مطلوب", "أدخل اسمك الكامل");
      return;
    }
    setLoading(true);
    try {
      const referredBy = inviteCode.trim().toUpperCase() || undefined;
      const res = await fetch(`${BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          code: otp,
          name: isNewUser ? name.trim() : undefined,
          referredBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "رمز خاطئ");
      await login(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // فحص PIN بعد تسجيل الدخول
      try {
        const pinRes = await fetch(`${BASE}/api/auth/pin/has-pin`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        const pinData = await pinRes.json().catch(() => ({ hasPin: false }));
        if (pinData.hasPin) {
          router.replace("/(auth)/pin-lock");
        } else {
          router.replace("/(auth)/pin-setup");
        }
      } catch {
        router.replace("/(tabs)/");
      }
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
    header: { alignItems: "center", marginBottom: 32 },
    appName: { fontSize: 36, fontWeight: "900", color: colors.foreground, letterSpacing: -1 },
    appNameAccent: { color: colors.primary },
    subtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    label: { fontSize: 12, color: colors.mutedForeground, textAlign: "right", fontWeight: "600", letterSpacing: 0.5 },
    phoneRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    countryBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.muted, borderRadius: 14,
      paddingHorizontal: 12, paddingVertical: 14,
      borderWidth: 1, borderColor: colors.border,
    },
    countryFlag: { fontSize: 20 },
    countryCode: { fontSize: 14, color: colors.foreground, fontWeight: "600" },
    input: {
      flex: 1, backgroundColor: colors.muted, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: colors.foreground, textAlign: "right",
      borderWidth: 1, borderColor: colors.border,
    },
    inputFull: {
      backgroundColor: colors.muted, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 16, color: colors.foreground, textAlign: "right",
      borderWidth: 1, borderColor: colors.border,
    },
    otpInput: {
      backgroundColor: colors.muted, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 14,
      fontSize: 28, color: colors.foreground, textAlign: "center",
      borderWidth: 1, borderColor: colors.border, letterSpacing: 10,
    },
    btn: {
      backgroundColor: colors.primary, borderRadius: 16,
      paddingVertical: 16, alignItems: "center", justifyContent: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    btnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    hint: { fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
    backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10 },
    backText: { color: colors.mutedForeground, fontSize: 14 },
    countriesList: {
      backgroundColor: colors.muted, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, maxHeight: 200,
    },
    countryItem: {
      flexDirection: "row-reverse", alignItems: "center", gap: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    countryName: { color: colors.foreground, fontSize: 14, flex: 1, textAlign: "right" },
    privacyCard: {
      flexDirection: "row-reverse", alignItems: "center", gap: 12,
      marginTop: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 14,
    },
    privacyIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    privacyTextCol: { flex: 1, gap: 2 },
    privacyTitle: { fontSize: 14, fontWeight: "700", textAlign: "right" },
    privacyText: { fontSize: 11, textAlign: "right", lineHeight: 16 },
    inviteRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    inviteStatus: { fontSize: 10, fontWeight: "700" },
  });

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <Text style={s.appName}>Gay<Text style={s.appNameAccent}>tak</Text></Text>
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
                  style={s.input}
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
                      key={`${c.code}-${c.name}`}
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
              <TouchableOpacity style={s.btn} onPress={handleSendOtp} disabled={loading || !phone.trim()}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>إرسال رمز التحقق</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* رقم الهاتف */}
              <View style={{ flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.muted, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontWeight: "600", direction: "ltr" }}>{selectedCountry.flag} {fullPhone}</Text>
                <TouchableOpacity onPress={() => setStep("phone")}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>تغيير</Text>
                </TouchableOpacity>
              </View>

              {/* رمز OTP */}
              <Text style={s.label}>رمز التحقق (6 أرقام)</Text>
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
                autoFocus
              />

              {/* اسم المستخدم الجديد */}
              {isNewUser && (
                <>
                  <Text style={s.label}>اسمك (حساب جديد)</Text>
                  <TextInput
                    style={s.inputFull}
                    placeholder="أدخل اسمك الكامل"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    returnKeyType="next"
                  />

                  {/* كود الإحالة */}
                  <View style={s.inviteRow}>
                    <Text style={s.label}>كود الإحالة (اختياري)</Text>
                    {inviteCode.trim() && (
                      inviteCodeLoading
                        ? <Text style={[s.inviteStatus, { color: "#F59E0B" }]}>جاري التحقق...</Text>
                        : inviteCodeValid
                        ? <Text style={[s.inviteStatus, { color: "#10B981" }]}>صحيح ✓</Text>
                        : <Text style={[s.inviteStatus, { color: "#EF4444" }]}>غير صحيح ❌</Text>
                    )}
                  </View>
                  <TextInput
                    style={[s.inputFull, {
                      textAlign: "left",
                      borderColor: inviteCode.trim()
                        ? inviteCodeValid ? "#10B981" : "#EF4444"
                        : colors.border
                    }]}
                    placeholder="مثال: GT-AMINE8"
                    placeholderTextColor={colors.mutedForeground}
                    value={inviteCode}
                    onChangeText={(v) => setInviteCode(v.toUpperCase())}
                  />
                </>
              )}

              <TouchableOpacity
                style={[s.btn, { opacity: otp.length < 6 ? 0.5 : 1 }]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>{isNewUser ? "إنشاء الحساب" : "تسجيل الدخول"}</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendOtp} style={{ alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>إعادة إرسال الرمز</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.backBtn} onPress={() => setStep("phone")}>
                <Text style={s.backText}>تغيير الرقم</Text>
                <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Privacy Policy */}
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

      {/* OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={() => setShowOtpModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 24 }} onPress={() => setShowOtpModal(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 340,
            backgroundColor: "#1a1a2e",
            borderRadius: 24, padding: 24,
            borderWidth: 1, borderColor: colors.primary + "50",
          }}>
            <View style={{ alignItems: "center", gap: 8, marginBottom: 20 }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary + "25", borderWidth: 1, borderColor: colors.primary + "50", alignItems: "center", justifyContent: "center" }}>
                <Feather name="shield" size={28} color={colors.primary} />
              </View>
              <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "800" }}>رمز التحقق</Text>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>يمكنك نسخ الرمز أو استخدامه مباشرة</Text>
            </View>

            <View style={{ backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", paddingVertical: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <Text style={{ color: "#FFF", fontSize: 36, fontWeight: "900", letterSpacing: 10, direction: "ltr" }}>{otpCode}</Text>
              <TouchableOpacity
                onPress={async () => {
                  await Clipboard.setStringAsync(otpCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + "25", borderWidth: 1, borderColor: colors.primary + "40", alignItems: "center", justifyContent: "center" }}
              >
                <Feather name={copied ? "check" : "copy"} size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setOtp(otpCode); setShowOtpModal(false); }}
              >
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>استخدم الرمز</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
                onPress={() => setShowOtpModal(false)}
              >
                <Text style={{ color: "rgba(255,255,255,0.6)", fontWeight: "700", fontSize: 15 }}>متابعة</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
