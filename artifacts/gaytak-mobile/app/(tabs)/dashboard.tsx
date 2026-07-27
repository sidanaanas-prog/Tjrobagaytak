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

type Order = {
  id: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  buyer?: { name: string } | null;
  items?: { product?: { title: string }; quantity: number; price: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ انتظار",
  confirmed: "✅ مؤكد",
  shipped: "🚚 شحن",
  delivered: "📦 مسلّم",
  cancelled: "❌ ملغى",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#6366F1",
  shipped: "#3B82F6",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0 });

  const fetchOrders = useCallback(async () => {
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await fetch(`${BASE}/api/orders?role=seller`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Order[] = await res.json() ?? [];
        setOrders(data);
        const pending = data.filter((o) => o.status === "pending").length;
        const revenue = data
          .filter((o) => o.status === "delivered")
          .reduce((s, o) => s + Number(o.totalAmount || 0), 0);
        setStats({ total: data.length, pending, revenue });
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(orderId: string, status: string) {
    try {
      await fetch(`${BASE}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      fetchOrders();
    } catch {}
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    title: { fontSize: 26, fontWeight: "900", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    statsRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 16 },
    statCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: "center", gap: 4,
    },
    statNum: { fontSize: 24, fontWeight: "900", color: colors.foreground },
    statLabel: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
    sectionTitle: { fontSize: 15, fontWeight: "800", color: colors.foreground, textAlign: "right", marginHorizontal: 16, marginBottom: 10 },
    orderCard: {
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border, padding: 14,
    },
    orderRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    orderStatus: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    orderAmount: { fontSize: 16, fontWeight: "900", color: colors.primary },
    orderBuyer: { fontSize: 13, color: colors.foreground, textAlign: "right", marginBottom: 4 },
    orderDate: { fontSize: 11, color: colors.mutedForeground, textAlign: "right", marginBottom: 10 },
    actionsRow: { flexDirection: "row", gap: 8 },
    actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: "center", borderWidth: 1 },
    actionBtnText: { fontSize: 12, fontWeight: "700" },
  });

  if (!user) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center", gap: 16 }]}>
        <Feather name="briefcase" size={48} color={colors.mutedForeground} />
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={colors.primary} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>🏪 أعمالي</Text>
        <Text style={s.subtitle}>إدارة طلباتك ومبيعاتك</Text>
      </View>

      {/* الإحصائيات */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statNum}>{stats.total}</Text>
          <Text style={s.statLabel}>إجمالي الطلبات</Text>
        </View>
        <View style={[s.statCard, stats.pending > 0 && { borderColor: "#F59E0B50" }]}>
          <Text style={[s.statNum, { color: stats.pending > 0 ? "#F59E0B" : colors.foreground }]}>{stats.pending}</Text>
          <Text style={s.statLabel}>انتظار</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#10B981", fontSize: 18 }]}>{stats.revenue.toLocaleString("ar-DZ")}</Text>
          <Text style={s.statLabel}>إيرادات (دج)</Text>
        </View>
      </View>

      <Text style={s.sectionTitle}>📋 الطلبات</Text>

      {loading ? (
        <View style={{ alignItems: "center", paddingTop: 40 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={{ alignItems: "center", paddingTop: 40, gap: 10 }}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>لا توجد طلبات بعد</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>أضف منتجاً وابدأ البيع!</Text>
          <TouchableOpacity
            style={{ marginTop: 8, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
            onPress={() => router.push("/(tabs)/sell")}
          >
            <Text style={{ color: "#FFF", fontWeight: "700" }}>أضف منتجاً</Text>
          </TouchableOpacity>
        </View>
      ) : (
        orders.map((order) => {
          const sc = STATUS_COLORS[order.status] || colors.mutedForeground;
          return (
            <View key={order.id} style={s.orderCard}>
              <View style={s.orderRow}>
                <View style={{ backgroundColor: sc + "20", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={[s.orderStatus, { color: sc }]}>{STATUS_LABELS[order.status] || order.status}</Text>
                </View>
                <Text style={s.orderAmount}>{Number(order.totalAmount || 0).toLocaleString("ar-DZ")} دج</Text>
              </View>
              {order.buyer && <Text style={s.orderBuyer}>المشتري: {order.buyer.name}</Text>}
              {order.items && order.items.length > 0 && (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "right", marginBottom: 4 }}>
                  {order.items.map((i) => `${i.product?.title ?? "منتج"} ×${i.quantity}`).join(" | ")}
                </Text>
              )}
              <Text style={s.orderDate}>{new Date(order.createdAt).toLocaleDateString("ar-DZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>

              {order.status === "pending" && (
                <View style={s.actionsRow}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#10B98115", borderColor: "#10B98130" }]}
                    onPress={() => updateStatus(order.id, "confirmed")}
                  >
                    <Text style={[s.actionBtnText, { color: "#10B981" }]}>✅ قبول</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
                    onPress={() => updateStatus(order.id, "cancelled")}
                  >
                    <Text style={[s.actionBtnText, { color: "#EF4444" }]}>❌ رفض</Text>
                  </TouchableOpacity>
                </View>
              )}
              {order.status === "confirmed" && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#3B82F615", borderColor: "#3B82F630" }]}
                  onPress={() => updateStatus(order.id, "shipped")}
                >
                  <Text style={[s.actionBtnText, { color: "#3B82F6" }]}>🚚 تم الشحن</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
