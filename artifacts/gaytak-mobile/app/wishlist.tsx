import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
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

type WishlistItem = {
  productId: string;
  createdAt: string;
  product: { id: string; title: string; price: number; images: string[]; status: string };
  activeSale: { salePrice: number; endsAt: string } | null;
};

function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("انتهى"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#F97316" }}>{remaining}</Text>;
}

export default function WishlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchWishlist = useCallback(async () => {
    if (!token) { setLoading(false); setRefreshing(false); return; }
    try {
      const res = await fetch(`${BASE}/api/wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setItems(await res.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  async function removeItem(productId: string) {
    if (!token || removing) return;
    setRemoving(productId);
    try {
      await fetch(`${BASE}/api/wishlist/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(prev => prev.filter(i => i.productId !== productId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("خطأ", "تعذر حذف المنتج من المفضلة");
    }
    setRemoving(null);
  }

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.iconBox, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
          <Feather name="heart" size={36} color="#EF4444" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>المفضلة</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>سجّل دخولك لعرض قائمة المفضلة</Text>
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIcon, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
            <Feather name="heart" size={16} color="#EF4444" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>المفضلة</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{items.length} منتج محفوظ</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchWishlist(); }}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.skeleton, { backgroundColor: colors.muted }]} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.iconBox, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
              <Feather name="heart" size={36} color="#EF4444" style={{ opacity: 0.4 }} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد منتجات في المفضلة</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>تصفح المنتجات وأضف ما يعجبك</Text>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "30" }]}
              onPress={() => router.push("/(tabs)/explore")}
            >
              <Text style={[styles.browseBtnText, { color: colors.primary }]}>تصفح المنتجات</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {items.map(item => (
              <TouchableOpacity
                key={item.productId}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/product/${item.productId}` as any)}
                activeOpacity={0.85}
              >
                {/* صورة */}
                <View style={[styles.imgBox, { backgroundColor: colors.muted }]}>
                  {item.product.images?.[0] ? (
                    <Image source={{ uri: item.product.images[0] }} style={styles.img} contentFit="cover" />
                  ) : (
                    <Feather name="shopping-bag" size={24} color={colors.mutedForeground} />
                  )}
                </View>

                {/* تفاصيل */}
                <View style={styles.cardInfo}>
                  <Text style={[styles.productTitle, { color: colors.foreground }]} numberOfLines={2}>
                    {item.product.title}
                  </Text>
                  {item.activeSale ? (
                    <View>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
                        <Text style={styles.salePrice}>{item.activeSale.salePrice} د.ج</Text>
                        <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>{item.product.price} د.ج</Text>
                        <View style={styles.saleBadge}>
                          <Text style={styles.saleBadgeText}>⚡ عرض</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Feather name="clock" size={12} color="#F97316" />
                        <Countdown endsAt={item.activeSale.endsAt} />
                      </View>
                    </View>
                  ) : (
                    <Text style={[styles.price, { color: colors.primary }]}>{item.product.price} د.ج</Text>
                  )}
                </View>

                {/* حذف */}
                <TouchableOpacity
                  style={[styles.removeBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
                  onPress={() => removeItem(item.productId)}
                  disabled={removing === item.productId}
                >
                  {removing === item.productId
                    ? <ActivityIndicator size="small" color="#EF4444" />
                    : <Feather name="trash-2" size={14} color="#EF4444" />
                  }
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
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
  skeleton: { height: 88, borderRadius: 16 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  iconBox: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyText: { fontSize: 13, textAlign: "center" },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  browseBtnText: { fontSize: 14, fontWeight: "700" },
  loginBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  loginBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  card: {
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  imgBox: { width: 76, height: 76, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%" },
  cardInfo: { flex: 1 },
  productTitle: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  price: { fontSize: 15, fontWeight: "900" },
  salePrice: { fontSize: 15, fontWeight: "900", color: "#F97316" },
  oldPrice: { fontSize: 12, textDecorationLine: "line-through" },
  saleBadge: { backgroundColor: "#F9731620", borderWidth: 1, borderColor: "#F9731630", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  saleBadgeText: { fontSize: 9, color: "#F97316", fontWeight: "700" },
  removeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
