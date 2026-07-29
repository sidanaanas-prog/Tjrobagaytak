import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ProductCard } from "@/components/ProductCard";
import { useGetUser, useListProducts, getListProductsQueryKey, getGetUserQueryKey, useCreateConversation } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function SellerStoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();

  const { data: seller, isLoading: loadingSeller, error: sellerError } = useGetUser(id || "", {
    query: { enabled: !!id, queryKey: getGetUserQueryKey(id || "") },
  });

  const { data: productsData, isLoading: loadingProducts } = useListProducts(
    { sellerId: id },
    { query: { enabled: !!id, queryKey: getListProductsQueryKey({ sellerId: id }) } }
  );

  const createConversation = useCreateConversation();

  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/seller/${id}/followers`)
      .then(r => r.json())
      .then(d => setFollowerCount(d.count ?? 0))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user || !id || !token) return;
    fetch(`${BASE}/api/follows/check?sellerId=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setFollowing(d.following))
      .catch(() => {});
  }, [user, id, token]);

  useEffect(() => {
    if (!user || !id || !token) return;
    fetch(`${BASE}/api/orders?role=buyer`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((orders: any[]) => {
        const found = Array.isArray(orders) && orders.some(o => o.seller?.id === id || o.sellerId === id);
        setHasOrder(found);
      })
      .catch(() => {});
  }, [user, id, token]);

  async function toggleFollow() {
    if (!user) { router.push("/(auth)/login"); return; }
    setFollowLoading(true);
    try {
      if (following) {
        await fetch(`${BASE}/api/follows`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sellerId: id }),
        });
        setFollowing(false);
        setFollowerCount(c => Math.max(0, c - 1));
      } else {
        await fetch(`${BASE}/api/follows`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sellerId: id }),
        });
        setFollowing(true);
        setFollowerCount(c => c + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("خطأ", "تعذر تحديث المتابعة");
    }
    setFollowLoading(false);
  }

  function handleContact() {
    if (!user) { router.push("/(auth)/login"); return; }
    if (user.id === id) { Alert.alert("هذا متجرك!", "لا يمكنك مراسلة نفسك."); return; }
    createConversation.mutate(
      { data: { recipientId: id! } },
      {
        onSuccess: (conv: any) => router.push(`/conversation/${conv.id}` as any),
        onError: (err: any) => Alert.alert("خطأ", err?.message || "تعذر بدء المحادثة"),
      }
    );
  }

  if (loadingSeller) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={{ padding: 20, gap: 12 }}>
          <View style={[styles.skeleton, { height: 140, backgroundColor: colors.muted }]} />
          <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: -20 }}>
            <View style={[styles.skeleton, { width: 76, height: 76, borderRadius: 20, backgroundColor: colors.muted }]} />
            <View style={{ flex: 1, gap: 8, paddingTop: 20 }}>
              <View style={[styles.skeleton, { height: 18, width: "60%", backgroundColor: colors.muted }]} />
              <View style={[styles.skeleton, { height: 12, width: "40%", backgroundColor: colors.muted }]} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <View style={[styles.skeleton, { flex: 1, height: 42, backgroundColor: colors.muted }]} />
            <View style={[styles.skeleton, { flex: 1, height: 42, backgroundColor: colors.muted }]} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.skeleton, { width: "47%", height: 160, backgroundColor: colors.muted }]} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (sellerError || !seller) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }]}>
        <Text style={{ fontSize: 48 }}>🔍</Text>
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>البائع غير موجود</Text>
        <TouchableOpacity
          style={[styles.backBtnLarge, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/explore")}
        >
          <Text style={styles.backBtnLargeText}>العودة للسوق</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const products = productsData?.products ?? [];
  const isMe = user?.id === seller.id;
  const isVerified = (seller as any).isVerified || (seller as any).role === "admin";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Cover + Back */}
        <View style={{ position: "relative" }}>
          <View style={[styles.cover, { paddingTop: insets.top }]}>
            <View style={{ flex: 1, position: "relative" }}>
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.primary, opacity: 0.15 }]} />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.backCircle, { top: insets.top + 12, backgroundColor: "rgba(0,0,0,0.4)", borderColor: "rgba(255,255,255,0.1)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-right" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Avatar + Info */}
        <View style={{ paddingHorizontal: 20, marginTop: -38 }}>
          <View style={{ flexDirection: "row-reverse", alignItems: "flex-end", gap: 12 }}>
            <View style={[styles.avatarLarge, { backgroundColor: colors.muted, borderColor: colors.background }]}>
              {seller.avatar ? (
                <Image source={{ uri: seller.avatar }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {seller.name?.[0] || "؟"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={[styles.sellerName, { color: colors.foreground }]}>{seller.name}</Text>
                {isVerified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="check-circle" size={11} color={colors.primary} />
                    <Text style={[styles.verifiedText, { color: colors.primary }]}>موثق</Text>
                  </View>
                )}
                {!isMe && (
                  <TouchableOpacity
                    onPress={toggleFollow}
                    disabled={followLoading}
                    style={[
                      styles.followBtn,
                      following
                        ? { backgroundColor: colors.muted, borderColor: colors.border }
                        : { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    {followLoading
                      ? <ActivityIndicator size="small" color={following ? colors.mutedForeground : "#FFF"} />
                      : <>
                          <Feather name={following ? "user-check" : "user-plus"} size={12} color={following ? colors.foreground : "#FFF"} />
                          <Text style={[styles.followBtnText, { color: following ? colors.foreground : "#FFF" }]}>
                            {following ? "متابع" : "تابع"}
                          </Text>
                        </>
                    }
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 16, marginTop: 6 }}>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                  <Feather name="package" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.statText, { color: colors.mutedForeground }]}>{(seller as any).productCount ?? 0} منتج</Text>
                </View>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.statText, { color: colors.mutedForeground }]}>{followerCount} متابع</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {!isMe && (
          <View style={{ paddingHorizontal: 20, marginTop: 16, flexDirection: "row-reverse", gap: 10 }}>
            {hasOrder && (
              <TouchableOpacity
                onPress={handleContact}
                disabled={createConversation.isPending}
                style={[styles.actionBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30", flex: 1 }]}
              >
                {createConversation.isPending
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Feather name="message-circle" size={16} color={colors.primary} />
                }
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>مراسلة</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={() => {}}
            >
              <Feather name="shopping-bag" size={16} color="#FFF" />
              <Text style={[styles.actionBtnText, { color: "#FFF" }]}>منتجات المتجر</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Products */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>منتجات المتجر</Text>

          {loadingProducts ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.skeleton, { width: "47%", height: 160, backgroundColor: colors.muted }]} />
              ))}
            </View>
          ) : products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Feather name="package" size={36} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا يوجد منتجات في هذا المتجر</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} style={styles.gridItem} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cover: { height: 160 },
  backCircle: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backdropFilter: "blur(10px)",
  },
  avatarLarge: { width: 76, height: 76, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 3 },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitial: { fontSize: 30, fontWeight: "900" },
  sellerName: { fontSize: 18, fontWeight: "900" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  verifiedText: { fontSize: 10, fontWeight: "700" },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  followBtnText: { fontSize: 12, fontWeight: "700" },
  statText: { fontSize: 12 },
  actionBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "47%" },
  emptyProducts: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13 },
  skeleton: { borderRadius: 12 },
  notFoundTitle: { fontSize: 20, fontWeight: "900" },
  backBtnLarge: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14 },
  backBtnLargeText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
});
