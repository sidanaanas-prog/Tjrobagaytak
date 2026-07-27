import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Ride = {
  id: string;
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  price: string;
  createdAt: string;
  driver?: { name: string; phone: string } | null;
};

export default function RidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isDriver = user?.role === "driver";

  const fetchRides = useCallback(async () => {
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await fetch(`${BASE}/api/rides/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRides(await res.json() ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: "⏳ انتظار",
      accepted: "✅ مقبولة",
      in_progress: "🚗 جارية",
      completed: "🏁 مكتملة",
      cancelled: "❌ ملغاة",
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "#10B981";
    if (s === "cancelled") return "#EF4444";
    if (s === "accepted" || s === "in_progress") return "#6366F1";
    return colors.mutedForeground;
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 26, fontWeight: "900", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    heroCard: {
      marginHorizontal: 16, marginBottom: 20,
      backgroundColor: colors.primary + "18",
      borderRadius: 24, padding: 20,
      borderWidth: 1, borderColor: colors.primary + "40",
    },
    heroIcon: {
      width: 60, height: 60, borderRadius: 20,
      backgroundColor: colors.primary + "25", alignItems: "center", justifyContent: "center",
      marginBottom: 14,
    },
    heroTitle: { fontSize: 19, fontWeight: "800", color: colors.foreground, textAlign: "right" },
    heroSub: { fontSize: 13, color: colors.mutedForeground, textAlign: "right", marginTop: 4, lineHeight: 20 },
    requestBtn: {
      marginTop: 16, backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 15, alignItems: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    requestBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
    driverBtn: {
      marginTop: 10, backgroundColor: colors.card, borderRadius: 14,
      paddingVertical: 13, alignItems: "center",
      borderWidth: 1, borderColor: colors.border,
    },
    driverBtnText: { color: colors.foreground, fontWeight: "700", fontSize: 14 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.foreground, textAlign: "right", marginHorizontal: 16, marginBottom: 10 },
    rideCard: {
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border, padding: 14,
    },
    rideRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    rideStatus: { fontSize: 13, fontWeight: "700" },
    ridePrice: { fontSize: 16, fontWeight: "900", color: colors.primary },
    rideLocation: { fontSize: 13, color: colors.foreground, textAlign: "right", marginBottom: 4 },
    rideDate: { fontSize: 11, color: colors.mutedForeground, textAlign: "right" },
  });

  if (!user) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <Feather name="car" size={48} color={colors.mutedForeground} />
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>سجل الدخول أولاً</Text>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRides(); }} tintColor={colors.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>🚗 كورسا</Text>
        <Text style={s.subtitle}>خدمة النقل الذكي</Text>
      </View>

      {/* بطاقة الطلب */}
      <View style={s.heroCard}>
        <View style={s.heroIcon}>
          <Feather name="map-pin" size={28} color={colors.primary} />
        </View>
        <Text style={s.heroTitle}>اطلب كورسا الآن</Text>
        <Text style={s.heroSub}>أدخل موقعك وجهتك وسيصلك السائق في دقائق</Text>

        <TouchableOpacity style={s.requestBtn} onPress={() => router.push("/ride-request")}>
          <Text style={s.requestBtnText}>طلب رحلة جديدة</Text>
        </TouchableOpacity>

        {isDriver && (
          <TouchableOpacity style={s.driverBtn} onPress={() => router.push("/ride-driver")}>
            <Text style={s.driverBtnText}>🚦 وضع السائق</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* سجل الرحلات */}
      {loading ? (
        <View style={{ alignItems: "center", paddingTop: 20 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : rides.length > 0 ? (
        <>
          <Text style={s.sectionTitle}>رحلاتي السابقة</Text>
          {rides.map((ride) => (
            <View key={ride.id} style={s.rideCard}>
              <View style={s.rideRow}>
                <Text style={[s.rideStatus, { color: statusColor(ride.status) }]}>{statusLabel(ride.status)}</Text>
                <Text style={s.ridePrice}>{Number(ride.price || 0).toLocaleString("ar-DZ")} دج</Text>
              </View>
              <Text style={s.rideLocation}>📍 من: {ride.pickupLocation}</Text>
              <Text style={s.rideLocation}>🏁 إلى: {ride.dropoffLocation}</Text>
              {ride.driver && (
                <Text style={s.rideDate}>السائق: {ride.driver.name}</Text>
              )}
              <Text style={s.rideDate}>{new Date(ride.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          ))}
        </>
      ) : (
        <View style={{ alignItems: "center", paddingTop: 20, gap: 8 }}>
          <Feather name="clock" size={36} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>لا توجد رحلات سابقة</Text>
        </View>
      )}
    </ScrollView>
  );
}
