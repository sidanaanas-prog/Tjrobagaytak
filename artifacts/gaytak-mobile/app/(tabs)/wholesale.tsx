import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const categories = [
  { title: "ملابس نساء", description: "أزياء نسائية بالجملة", icon: "user", color: "#EC4899" },
  { title: "ملابس أطفال", description: "ملابس ومستلزمات الأطفال", icon: "smile", color: "#3B82F6" },
  { title: "نعال وأحذية", description: "بيع بالكرتون", icon: "shopping-bag", color: "#F59E0B" },
  { title: "إلكترونيات", description: "أجهزة وإكسسوارات", icon: "cpu", color: "#8B5CF6" },
  { title: "قطع غيار", description: "قطع ومستلزمات متنوعة", icon: "tool", color: "#10B981" },
  { title: "إكسسوارات سيارات", description: "تجهيزات السيارات", icon: "truck", color: "#EF4444" },
];

export default function WholesaleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/feature-flags`)
      .then((response) => response.ok ? response.json() : null)
      .then((flags) => setEnabled(flags?.wholesaleEnabled === true))
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === null) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!enabled) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.muted }}>هذا القسم غير متاح حالياً</Text></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-right" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <View style={[styles.logo, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B44" }]}>
              <Feather name="shopping-bag" size={25} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>سوق الجملة</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>منتجات للتجار وأصحاب المحلات</Text>
            </View>
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: "#F59E0B14", borderColor: "#F59E0B33" }]}>
          <Feather name="package" size={18} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>بيع بالكرتون وأسعار التجار</Text>
            <Text style={[styles.bannerText, { color: colors.muted }]}>اختر التصنيف الذي تبحث عنه. ستظهر المنتجات والأسعار هنا عند نشرها.</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>التصنيفات</Text>
        <View style={styles.grid}>
          {categories.map((category) => (
            <View key={category.title} style={[styles.category, { backgroundColor: category.color + "16", borderColor: category.color + "44" }]}>
              <View style={[styles.categoryIcon, { backgroundColor: category.color + "28" }]}>
                <Feather name={category.icon as any} size={21} color={category.color} />
              </View>
              <Text style={[styles.categoryTitle, { color: colors.text }]}>{category.title}</Text>
              <Text style={[styles.categoryText, { color: colors.muted }]}>{category.description}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="shopping-bag" size={28} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>المنتجات ستظهر هنا</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>أضف منتجات الجملة من لوحة التحكم عند جاهزيتك.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 18, borderBottomWidth: 1 },
  back: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 12, marginTop: 3 },
  banner: { margin: 16, padding: 14, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bannerTitle: { fontSize: 14, fontWeight: "800" },
  bannerText: { fontSize: 11, lineHeight: 18, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "900", marginHorizontal: 16, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  category: { width: "48%", minHeight: 132, borderRadius: 16, borderWidth: 1, padding: 12 },
  categoryIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  categoryTitle: { fontSize: 13, fontWeight: "800" },
  categoryText: { fontSize: 10, marginTop: 4 },
  empty: { margin: 16, marginTop: 22, borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center" },
  emptyTitle: { fontSize: 14, fontWeight: "800", marginTop: 10 },
  emptyText: { fontSize: 11, marginTop: 4, textAlign: "center" },
});