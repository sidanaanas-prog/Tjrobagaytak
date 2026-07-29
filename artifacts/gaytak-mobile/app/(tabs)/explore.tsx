import { ProductCard } from "@/components/ProductCard";
import { useColors } from "@/hooks/useColors";
import { useListProducts, useListCategories } from "@workspace/api-client-react";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | undefined>();

  const { data: products, isLoading } = useListProducts({
    search: search || undefined,
    category: selectedCat,
    limit: 30,
  });
  const { data: categories } = useListCategories();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>استكشف</Text>
        <View style={[styles.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="ابحث في Gaytak..."
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

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.cats, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
      >
        <TouchableOpacity
          style={[styles.catChip, {
            backgroundColor: !selectedCat ? colors.primary : colors.muted,
            borderColor: !selectedCat ? colors.primary : colors.border,
          }]}
          onPress={() => setSelectedCat(undefined)}
        >
          <Text style={[styles.catText, { color: !selectedCat ? "#FFF" : colors.foreground }]}>الكل</Text>
        </TouchableOpacity>
        {categories?.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catChip, {
              backgroundColor: selectedCat === cat.name ? colors.primary : colors.muted,
              borderColor: selectedCat === cat.name ? colors.primary : colors.border,
            }]}
            onPress={() => setSelectedCat(selectedCat === cat.name ? undefined : cat.name)}
          >
            <Text style={[styles.catText, { color: selectedCat === cat.name ? "#FFF" : colors.foreground }]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sellers Shortcut */}
      <View style={[styles.sellersRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.sellersBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
          onPress={() => router.push("/sellers" as any)}
        >
          <Feather name="shopping-bag" size={14} color={colors.primary} />
          <Text style={[styles.sellersBtnText, { color: colors.primary }]}>المتاجر</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sellersBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
          onPress={() => router.push("/wishlist" as any)}
        >
          <Feather name="heart" size={14} color="#EF4444" />
          <Text style={[styles.sellersBtnText, { color: "#EF4444" }]}>المفضلة</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !products?.products || products.products.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="search" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد نتائج</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>جرب بحثاً مختلفاً</Text>
        </View>
      ) : (
        <FlatList
          data={products.products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 + botPad }}
          renderItem={({ item }) => (
            <ProductCard product={item} style={styles.card} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: "900", textAlign: "right", marginBottom: 12 },
  searchBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  cats: { borderBottomWidth: 1, maxHeight: 60 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  catText: { fontSize: 13, fontWeight: "600" },
  row: { gap: 10, paddingHorizontal: 4, marginBottom: 10 },
  card: { flex: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14 },
  sellersRow: { flexDirection: "row-reverse", paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 1 },
  sellersBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  sellersBtnText: { fontSize: 13, fontWeight: "700" },
});
