import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useListProducts } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";

type StatusFilter = "all" | "active" | "rejected";

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "منشور" },
  { key: "rejected", label: "مرفوض" },
];

export default function MyListingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: productsData, isLoading } = useListProducts(
    { sellerId: user?.id, limit: 50 },
    { query: { enabled: !!user?.id } }
  );

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.navHeader, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-right" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.foreground }]}>منتجاتي</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="lock" size={48} color={colors.mutedForeground} />
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>سجّل دخولك أولاً</Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.loginBtnText}>دخول</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const products = productsData?.products || [];

  const counts: Record<StatusFilter, number> = {
    all: products.length,
    active: products.filter((p) => p.status === "active").length,
    rejected: products.filter((p) => p.status === "rejected").length,
  };

  const filtered =
    activeFilter === "all"
      ? products
      : products.filter((p) => p.status === activeFilter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.navHeader, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>منتجاتي</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/sell")}
        >
          <Feather name="plus" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : products.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>📦</Text>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>لا توجد منتجات</Text>
          <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>ابدأ بإضافة منتجك الأول الآن!</Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/sell")}
          >
            <Text style={styles.loginBtnText}>أضف منتجاً</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Stats Cards */}
          <View style={[styles.statsRow, { paddingTop: 16, paddingHorizontal: 16 }]}>
            <TouchableOpacity
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: activeFilter === "active" ? "#34D399" : colors.border,
                },
              ]}
              onPress={() => setActiveFilter("active")}
              activeOpacity={0.8}
            >
              <Feather name="check-circle" size={20} color="#34D399" />
              <Text style={[styles.statNum, { color: "#34D399" }]}>{counts.active}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>منشور</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: activeFilter === "rejected" ? "#F87171" : colors.border,
                },
              ]}
              onPress={() => setActiveFilter("rejected")}
              activeOpacity={0.8}
            >
              <Feather name="x-circle" size={20} color="#F87171" />
              <Text style={[styles.statNum, { color: "#F87171" }]}>{counts.rejected}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>مرفوض</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
          >
            {FILTER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === tab.key ? colors.primary : colors.muted,
                    borderColor: activeFilter === tab.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveFilter(tab.key)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: activeFilter === tab.key ? "#FFF" : colors.mutedForeground },
                  ]}
                >
                  {tab.label}
                </Text>
                <Text
                  style={[
                    styles.filterCount,
                    { color: activeFilter === tab.key ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
                  ]}
                >
                  {counts[tab.key]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Products */}
          {filtered.length === 0 ? (
            <View style={styles.centered}>
              <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                لا توجد منتجات في هذه الحالة
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={{ padding: 12, paddingBottom: 80 + botPad }}
              renderItem={({ item }) => (
                <ProductCard product={item} style={styles.card} showStatus />
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 18, fontWeight: "800" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  guestTitle: { fontSize: 20, fontWeight: "800" },
  guestSub: { fontSize: 14, textAlign: "center" },
  loginBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 4 },
  loginBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  statsRow: { flexDirection: "row-reverse", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statNum: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 11, fontWeight: "600" },
  filterRow: { maxHeight: 60 },
  filterChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "700" },
  filterCount: { fontSize: 11, fontWeight: "600" },
  row: { gap: 10, paddingHorizontal: 4, marginBottom: 10 },
  card: { flex: 1 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
