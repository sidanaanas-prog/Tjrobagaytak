import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

const PLANS = [
  { id: "driver_monthly", label: "الاشتراك الشهري", price: "2000", period: "شهر", features: ["وصول لطلبات النقل", "محادثة مع الركاب", "دعم 24/7"] },
];

export default function DriverSubscribeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`https://${DOMAIN}/api/driver/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSubscription(data))
      .catch(() => {});
  }, [token]);

  async function handleSubscribe() {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`https://${DOMAIN}/api/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "driver",
          plan: "driver_monthly",
          amount: 2000,
          period: "monthly",
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert(
          "✅ تم إرسال الطلب",
          "تم إرسال طلب اشتراكك. يرجى إرسال إيصال الدفع (2000 دج) عبر الواتساب لنفس الرقم المستخدم في التطبيق. سيقوم فريق التحقق بمراجعة طلبك خلال 24 ساعة."
        );
        setSubscription((s: any) => ({ ...s, isPending: true }));
      } else {
        Alert.alert("خطأ", data.error || "فشل إرسال الطلب");
      }
    } catch (e: any) {
      Alert.alert("خطأ", e.message || "تعذر الاتصال بالخادم");
    }
    setSubmitting(false);
  }

  function copyPhone() {
    if (user?.phone) {
      Clipboard.setString(user.phone);
      setCopied(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isSubscribed = subscription?.isSubscribed ?? false;
  const isFree = subscription?.isFree ?? false;
  const isPending = subscription?.isPending ?? false;
  const hasProfile = subscription?.hasProfile ?? false;
  const expiresAt = subscription?.expiresAt
    ? new Date(subscription.expiresAt).toLocaleDateString("ar-DZ")
    : null;

  const topPad = insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          اشتراك السائق
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
        {/* Status card */}
        {isFree ? (
          <View style={[styles.statusCard, { backgroundColor: "#FFAA0020", borderColor: "#FFAA00" }]}>
            <Feather name="gift" size={24} color="#FFAA00" />
            <Text style={[styles.statusTitle, { color: "#FFAA00" }]}>
              سائق مجاني
            </Text>
            <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
              لديك حساب مجاني من الأدمن
            </Text>
          </View>
        ) : isSubscribed ? (
          <View style={[styles.statusCard, { backgroundColor: "#00CC6620", borderColor: "#00CC66" }]}>
            <Feather name="check-circle" size={24} color="#00CC66" />
            <Text style={[styles.statusTitle, { color: "#00CC66" }]}>
              الاشتراك مفعل
            </Text>
            {expiresAt && (
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                ينتهي في: {expiresAt}
              </Text>
            )}
          </View>
        ) : isPending ? (
          <View style={[styles.statusCard, { backgroundColor: "#FFAA0020", borderColor: "#FFAA00" }]}>
            <Feather name="clock" size={24} color="#FFAA00" />
            <Text style={[styles.statusTitle, { color: "#FFAA00" }]}>
              طلب الاشتراك قيد المراجعة
            </Text>
            <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
              سيتم تفعيل حسابك بعد التحقق من الدفع
            </Text>
          </View>
        ) : (
          <View style={[styles.statusCard, { backgroundColor: colors.destructive + "20", borderColor: colors.destructive }]}>
            <Feather name="alert-circle" size={24} color={colors.destructive} />
            <Text style={[styles.statusTitle, { color: colors.destructive }]}>
              غير مشترك
            </Text>
            <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
              يجب الاشتراك لتفعيل وضع السائق
            </Text>
          </View>
        )}

        {/* Driver profile check */}
        {!hasProfile && !isSubscribed && !isFree && (
          <View style={[styles.warningBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={[styles.warningText, { color: colors.text }]}>
              يجب إكمال تسجيل السائق (معلومات المركبة + الوثائق) قبل الاشتراك.
            </Text>
            <TouchableOpacity onPress={() => router.push("/driver-register")} style={{ marginTop: 8 }}>
              <Text style={[styles.link, { color: colors.primary }]}>
                إكمال التسجيل ←
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan card */}
        {!isSubscribed && (
          <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.planTitle, { color: colors.text }]}>
              {PLANS[0].label}
            </Text>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.primary }]}>
                {PLANS[0].price} دج
              </Text>
              <Text style={[styles.period, { color: colors.mutedForeground }]}>
                / {PLANS[0].period}
              </Text>
            </View>
            <View style={styles.features}>
              {PLANS[0].features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Feather name="check" size={14} color="#00CC66" />
                  <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Payment instructions */}
        {!isSubscribed && !isPending && hasProfile && (
          <View style={[styles.paymentBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Text style={[styles.paymentTitle, { color: colors.text }]}>
              طريقة الدفع
            </Text>
            <Text style={[styles.paymentText, { color: colors.mutedForeground }]}>
              1. أرسل 2000 دج إلى نفس الرقم المستخدم في التطبيق عبر الواتساب
            </Text>
            <Text style={[styles.paymentText, { color: colors.mutedForeground }]}>
              2. احتفظ بإيصال الدفع
            </Text>
            <Text style={[styles.paymentText, { color: colors.mutedForeground }]}>
              3. اضغط "إرسال طلب" وسيتم التحقق خلال 24 ساعة
            </Text>

            {user?.phone && (
              <TouchableOpacity
                onPress={copyPhone}
                style={[styles.copyBtn, { borderColor: colors.border }]}
              >
                <Feather name="phone" size={14} color={colors.primary} />
                <Text style={[styles.copyText, { color: colors.text }]}>
                  {user.phone}
                </Text>
                <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#00CC66" : colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Submit button */}
        {!isSubscribed && !isPending && hasProfile && (
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>إرسال طلب الاشتراك</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { flex: 1 },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: { fontSize: 16, fontWeight: "800", marginTop: 8 },
  statusSub: { fontSize: 13, marginTop: 4 },
  warningBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  warningText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  link: { fontSize: 14, fontWeight: "700" },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  planTitle: { fontSize: 18, fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 10 },
  price: { fontSize: 28, fontWeight: "900" },
  period: { fontSize: 14 },
  features: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14 },
  paymentBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  paymentTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  paymentText: { fontSize: 13, lineHeight: 20 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  copyText: { flex: 1, fontSize: 14, fontWeight: "700" },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
