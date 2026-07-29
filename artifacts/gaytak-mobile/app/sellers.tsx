import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const LIMIT = 20;

interface Seller {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  isVerified?: boolean | null;
  productCount: number;
}

export default function SellersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSellers = async (q: string, p: number, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (q) params.set("search", q);
      const res = await fetch(`${BASE}/api/sellers?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setSellers(prev =>
        reset ? data.sellers : [...prev, ...data.sellers.filter((s: Seller) => !prev.find(x => x.id === s.id))]
      );
      setTotal(data.total);
      setHasMore(p * LIMIT < data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSellers("", 1, true); }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchSellers(search, 1, true);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchSellers(search, next);
  };

  const renderSeller = ({ item: seller }: { item: Seller }) => (
    <TouchableOpacity
      style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/seller/${seller.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "30" }]}>
        {seller.avatar ? (
          <Image source={{ uri: seller.avatar }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {seller.name[0]?.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.sellerInfo}>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
          <Text style={[styles.sellerName, { color: colors.foreground }]}>{seller.name}</Text>
          {(seller.isVerified || seller.role === "admin") && (
            <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="check-circle" size={11} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>موثق</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 3 }}>
          <Feather name="package" size={12} color={colors.mutedForeground} />
          <Text style={[styles.sellerSub, { color: colors.mutedForeground }]}>{seller.productCount} منتج</Text>
        </View>
      </View>

      {/* Arrow */}
      <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "30" }]}>
            <Feather name="shopping-bag" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>المتاجر</Text>
            {total > 0 && (
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{total} متجر</Text>
            )}
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="ابحث عن متجر..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            textAlign="right"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading && sellers.length === 0 ? (
        <View style={{ gap: 10, padding: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <View key={i} style={[styles.skeleton, { backgroundColor: colors.muted }]} />
          ))}
        </View>
      ) : sellers.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="shopping-bag" size={48} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? `لا توجد متاجر تطابق "${search}"` : "لا توجد متاجر بعد"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sellers}
          keyExtractor={item => item.id}
          renderItem={renderSeller}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            loading && sellers.length > 0 ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : hasMore && !loading ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={loadMore}
              >
                <Text style={[styles.loadMoreText, { color: colors.mutedForeground }]}>تحميل المزيد</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitleRow: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  headerSub: { fontSize: 11, marginTop: 1 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14 },
  sellerCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  avatar: { width: 54, height: 54, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { fontSize: 22, fontWeight: "800" },
  sellerInfo: { flex: 1 },
  sellerName: { fontSize: 15, fontWeight: "700" },
  sellerSub: { fontSize: 12 },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  skeleton: { height: 72, borderRadius: 16 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyText: { fontSize: 14, textAlign: "center" },
  loadMoreBtn: { padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", marginTop: 4 },
  loadMoreText: { fontSize: 13, fontWeight: "600" },
});
