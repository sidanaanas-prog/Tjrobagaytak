import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Transaction = {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  status: string;
};

type WalletData = {
  id: string;
  balance: string;
  currency: string;
  transactions: Transaction[];
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "شحن رصيد",
  withdrawal: "سحب",
  ride_payment: "دفع كورسا",
  ride_earning: "أرباح كورسا",
  refund: "استرداد",
  penalty: "غرامة",
};

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await fetch(`${BASE}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWallet(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const isNegative = wallet ? Number(wallet.balance) < 0 : false;
  const isDriver = user?.role === "driver" || user?.role === "admin";

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 26, fontWeight: "900", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    balanceCard: {
      marginHorizontal: 16, marginBottom: 16,
      borderRadius: 24, padding: 22, overflow: "hidden",
    },
    balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "right" },
    balanceAmount: { fontSize: 38, fontWeight: "900", color: "#FFF", textAlign: "right", marginTop: 6 },
    balanceUnit: { fontSize: 18, fontWeight: "600" },
    balanceOwner: { fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "right", marginTop: 12 },
    infoCard: {
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: colors.primary + "10", borderRadius: 18,
      borderWidth: 1, borderColor: colors.primary + "25", padding: 14,
    },
    infoTitle: { fontSize: 13, fontWeight: "700", color: colors.primary, textAlign: "right", marginBottom: 8 },
    infoText: { fontSize: 12, color: colors.mutedForeground, textAlign: "right", lineHeight: 20 },
    rechargeCard: {
      marginHorizontal: 16, marginBottom: 16,
      backgroundColor: "#3B82F610", borderRadius: 18,
      borderWidth: 1, borderColor: "#3B82F630", padding: 14, gap: 10,
    },
    rechargeTitle: { fontSize: 13, fontWeight: "700", color: "#60A5FA", textAlign: "right" },
    rechargeText: { fontSize: 12, color: colors.mutedForeground, textAlign: "right" },
    rechargeBtn: {
      flexDirection: "row-reverse", alignItems: "center", gap: 10,
      backgroundColor: colors.primary + "15", borderRadius: 14,
      borderWidth: 1, borderColor: colors.primary + "25", padding: 12,
    },
    rechargeBtnIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" },
    rechargeBtnText: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    rechargeBtnSub: { fontSize: 11, color: colors.mutedForeground },
    quickBtns: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 },
    quickBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.foreground, textAlign: "right", marginHorizontal: 16, marginBottom: 10 },
    txCard: {
      marginHorizontal: 16, marginBottom: 8,
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      flexDirection: "row-reverse", alignItems: "center", padding: 12, gap: 10,
    },
    txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    txName: { fontSize: 14, fontWeight: "700", color: colors.foreground, textAlign: "right" },
    txDate: { fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginTop: 2 },
    txAmount: { fontSize: 14, fontWeight: "900" },
  });

  if (!user) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <Feather name="credit-card" size={48} color={colors.mutedForeground} />
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>سجل الدخول للمحفظة</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWallet(); }} tintColor={colors.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>💳 محفظتي</Text>
        <Text style={s.subtitle}>رصيدك وسجل العمليات</Text>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", paddingTop: 60 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {/* بطاقة الرصيد */}
          <View style={[s.balanceCard, {
            backgroundColor: isNegative ? "#DC2626" : colors.primary,
            shadowColor: isNegative ? "#DC2626" : colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
          }]}>
            <Text style={s.balanceLabel}>
              {isNegative ? "⚠️ الرصيد المطلوب سداده" : "الرصيد المتوفر"}
            </Text>
            <Text style={s.balanceAmount}>
              {wallet ? Number(wallet.balance).toLocaleString("ar-DZ") : "0"}
              <Text style={s.balanceUnit}> ألف دورو</Text>
            </Text>
            <Text style={s.balanceOwner}>محفظة Gaytak — {user.name}</Text>
          </View>

          {/* دليل السائق */}
          {isDriver && (
            <View style={s.infoCard}>
              <Text style={s.infoTitle}>💡 دليل المحفظة للسائق</Text>
              <Text style={s.infoText}>تستلم 100% من أجرة الرحلات نقداً من الركاب. المحفظة تسجّل العمولة المستحقة للتطبيق تلقائياً. رصيد سالب يعني مستحقات عليك للتطبيق.</Text>
            </View>
          )}

          {/* طرق الشحن */}
          <View style={s.rechargeCard}>
            <Text style={s.rechargeTitle}>💰 كيف تشحن محفظتك؟</Text>
            <Text style={s.rechargeText}>تواصل مع الدعم أو زُر مكتبنا مباشرة، وسيتم إضافة الرصيد خلال دقائق.</Text>
            <TouchableOpacity style={s.rechargeBtn} onPress={() => router.push("/chat" as any)}>
              <View style={s.rechargeBtnIcon}>
                <Feather name="message-circle" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rechargeBtnText}>دعم التطبيق</Text>
                <Text style={s.rechargeBtnSub}>تواصل مع فريقنا مباشرة</Text>
              </View>
              <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* أزرار سريعة */}
          <View style={s.quickBtns}>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "25" }]}
              onPress={() => router.push("/(tabs)/rides")}
            >
              <Feather name="car" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>طلب كورسا</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B30" }]}
              onPress={() => router.push("/(auth)/pin-setup" as any)}
            >
              <Feather name="lock" size={16} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontWeight: "700", fontSize: 13 }}>قفل PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.quickBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => router.push("/chat" as any)}
            >
              <Feather name="phone" size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>تواصل معنا</Text>
            </TouchableOpacity>
          </View>

          {/* سجل العمليات */}
          <Text style={s.sectionTitle}>📋 سجل العمليات</Text>
          {!wallet || wallet.transactions.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 20, gap: 8 }}>
              <Feather name="credit-card" size={36} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>لا توجد عمليات بعد</Text>
            </View>
          ) : (
            wallet.transactions.map((t) => {
              const isIn = ["deposit", "ride_earning", "refund"].includes(t.type);
              return (
                <View key={t.id} style={s.txCard}>
                  <View style={[s.txIcon, { backgroundColor: isIn ? "#10B98115" : "#EF444415" }]}>
                    <Feather name={isIn ? "arrow-down-left" : "arrow-up-right"} size={20} color={isIn ? "#10B981" : "#EF4444"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.txName}>{TYPE_LABELS[t.type] ?? t.description ?? t.type}</Text>
                    <Text style={s.txDate}>{new Date(t.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                  </View>
                  <Text style={[s.txAmount, { color: isIn ? "#10B981" : "#EF4444" }]}>
                    {isIn ? "+" : "-"}{Math.abs(Number(t.amount)).toLocaleString("ar-DZ")} ألف دورو
                  </Text>
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}
