import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Product {
  id: string;
  title: string;
  price: number;
  images?: string[];
  category?: string | null;
  status: string;
  seller?: { name: string } | null;
}

interface ProductCardProps {
  product: Product;
  style?: object;
  showStatus?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "منشور",  color: "#34D399", bg: "rgba(52,211,153,0.15)" },
  rejected: { label: "مرفوض", color: "#F87171", bg: "rgba(248,113,113,0.15)" },
  pending:  { label: "قيد المراجعة", color: "#FBBF24", bg: "rgba(251,191,36,0.15)" },
  sold:     { label: "مباع",   color: "#A78BFA", bg: "rgba(167,139,250,0.15)" },
};

export function ProductCard({ product, style, showStatus }: ProductCardProps) {
  const colors = useColors();
  const hasImage = product.images && product.images.length > 0;
  const statusCfg = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.active;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.85}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
        {hasImage ? (
          <Image
            source={{ uri: product.images![0] }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
            <Feather name="image" size={28} color={colors.mutedForeground} />
          </View>
        )}
        {showStatus && (
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {product.title}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.price, { color: colors.primary }]}>
            {product.price.toFixed(0)} دج
          </Text>
          {product.category && (
            <Text style={[styles.category, { color: colors.mutedForeground }]} numberOfLines={1}>
              {product.category}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  info: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  row: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
  },
  category: {
    fontSize: 11,
    flex: 1,
    textAlign: "left",
  },
});
