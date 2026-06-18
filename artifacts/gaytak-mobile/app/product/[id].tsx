import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useGetProduct, useCreateConversation, useDeleteProduct } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { data: product, isLoading } = useGetProduct(id ?? "");
  const createConv = useCreateConversation();
  const deleteProduct = useDeleteProduct();
  const [imgIndex, setImgIndex] = useState(0);

  const isOwner = !!user && !!product && user.id === product.sellerId;

  async function handleDelete() {
    Alert.alert("حذف المنتج", "هل تريد حذف هذا المنتج نهائياً؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteProduct.mutateAsync({ id: product!.id });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (e: any) {
            Alert.alert("خطأ", e?.message || "فشل حذف المنتج، حاول مرة أخرى");
          }
        },
      },
    ]);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleContact() {
    if (!isLoggedIn) {
      router.push("/(auth)/login");
      return;
    }
    if (user?.id === product?.sellerId) {
      Alert.alert("هذا منتجك", "لا يمكنك مراسلة نفسك");
      return;
    }
    try {
      const conv = await createConv.mutateAsync({
        data: { recipientId: product!.sellerId, productId: product!.id },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/conversation/${conv.id}`);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="search" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.foreground }]}>المنتج غير موجود</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.foreground }}>عودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = product.images ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Back Button */}
      <TouchableOpacity
        style={[styles.back, { top: topPad + 8, backgroundColor: colors.card + "CC", borderColor: colors.border }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-right" size={20} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + botPad }}>
        {/* Images */}
        <View style={[styles.imageArea, { backgroundColor: colors.muted }]}>
          {images.length > 0 ? (
            <Image source={{ uri: images[imgIndex] }} style={styles.mainImage} contentFit="cover" />
          ) : (
            <View style={[styles.mainImage, { alignItems: "center", justifyContent: "center" }]}>
              <Feather name="image" size={60} color={colors.mutedForeground} />
            </View>
          )}
          {images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {images.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setImgIndex(i)}>
                  <Image
                    source={{ uri: img }}
                    style={[styles.thumb, { borderColor: i === imgIndex ? colors.primary : "transparent" }]}
                    contentFit="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Info */}
        <View style={{ padding: 16, gap: 12 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.price, { color: colors.primary }]}>
              {product.price.toFixed(0)} دج
            </Text>
            <Text style={[styles.productTitle, { color: colors.foreground }]}>{product.title}</Text>
          </View>

          {product.category && (
            <View style={[styles.catBadge, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
              <Text style={[styles.catText, { color: colors.primary }]}>{product.category}</Text>
            </View>
          )}

          {product.description && (
            <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.descLabel, { color: colors.mutedForeground }]}>الوصف</Text>
              <Text style={[styles.desc, { color: colors.foreground }]}>{product.description}</Text>
            </View>
          )}

          {/* Seller */}
          {product.seller && (
            <View style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerName, { color: colors.foreground }]}>{product.seller.name}</Text>
                <Text style={[styles.sellerLabel, { color: colors.mutedForeground }]}>البائع</Text>
              </View>
              <View style={[styles.sellerAvatar, { backgroundColor: colors.primary + "25" }]}>
                <Text style={[styles.sellerAvatarText, { color: colors.primary }]}>
                  {product.seller.name[0].toUpperCase()}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: botPad + 12 }]}>
        {isOwner ? (
          /* Owner: Delete button */
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}
            onPress={handleDelete}
            disabled={deleteProduct.isPending}
          >
            {deleteProduct.isPending ? (
              <ActivityIndicator color={colors.destructive} />
            ) : (
              <>
                <Feather name="trash-2" size={20} color={colors.destructive} />
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>حذف المنتج</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          /* Visitor: Contact button */
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: colors.primary }]}
            onPress={handleContact}
            disabled={createConv.isPending}
          >
            {createConv.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="message-circle" size={20} color="#FFF" />
                <Text style={styles.contactText}>تواصل مع البائع</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  back: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  imageArea: { width: "100%", paddingBottom: 8 },
  mainImage: { width: "100%", height: width * 0.85 },
  thumbRow: { paddingHorizontal: 12, paddingTop: 8 },
  thumb: { width: 60, height: 60, borderRadius: 10, marginRight: 8, borderWidth: 2 },
  titleRow: { alignItems: "flex-end", gap: 4 },
  productTitle: { fontSize: 22, fontWeight: "800", textAlign: "right", lineHeight: 30 },
  price: { fontSize: 28, fontWeight: "900" },
  catBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  catText: { fontSize: 12, fontWeight: "600" },
  descCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 6 },
  descLabel: { fontSize: 11, fontWeight: "700", textAlign: "right" },
  desc: { fontSize: 14, lineHeight: 22, textAlign: "right" },
  sellerCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  sellerInfo: { flex: 1, gap: 2, alignItems: "flex-end" },
  sellerLabel: { fontSize: 11 },
  sellerName: { fontSize: 15, fontWeight: "700" },
  sellerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sellerAvatarText: { fontSize: 18, fontWeight: "700" },
  footer: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  contactBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 15,
    shadowColor: "#AA33FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  contactText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  notFound: { fontSize: 18, fontWeight: "700" },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16 },
  deleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 15,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 16, fontWeight: "700" },
});
