import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  category: string;
  address: string;
  isOpen: boolean;
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  rating: string;
  ratingCount: number;
  isFeatured: boolean;
};

type Competition = {
  enabled: boolean;
  status: string;
  prize: string;
  endTime: string;
  leaderboard: any[];
  userParticipant: any | null;
};

const CATEGORIES = ["الكل", "فلل فاخرة", "شاليهات", "قاعات كبيرة", "منازل ريفية", "خيم ومساحات مفتوحة", "أخرى"];

export default function FoodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [compLoading, setCompLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("الكل");
  const [search, setSearch] = useState("");

  const fetchCompetition = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${BASE}/api/competition/status`, { headers });
      if (r.ok) setCompetition(await r.json());
    } catch {}
    setCompLoading(false);
  }, [token]);

  const fetchRestaurants = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== "الكل") params.set("category", category);
      if (search) params.set("q", search);
      const r = await fetch(`${BASE}/api/restaurants?${params}`);
      if (r.ok) setRestaurants(await r.json() ?? []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [category, search]);

  useEffect(() => { fetchCompetition(); }, [fetchCompetition]);
  useEffect(() => {
    if (!compLoading && !competition?.enabled) fetchRestaurants();
  }, [compLoading, competition, fetchRestaurants]);

  async function handleJoin() {
    if (!user) { router.push("/(auth)/login"); return; }
    setJoining(true);
    try {
      const res = await fetch(`${BASE}/api/competition/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الاشتراك");
      Alert.alert("تم الاشتراك 🎉", `كود الإحالة: ${data.inviteCode}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchCompetition();
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    }
    setJoining(false);
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingBottom: 12 },
    title: { fontSize: 26, fontWeight: "900", color: colors.foreground },
    subtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    searchBar: {
      flexDirection: "row-reverse", alignItems: "center", gap: 10,
      backgroundColor: colors.muted, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border, margin: 16, marginTop: 8,
    },
    searchInput: { flex: 1, color: colors.foreground, fontSize: 14, textAlign: "right" },
    catList: { paddingHorizontal: 16, marginBottom: 12 },
    catBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginLeft: 8,
      borderWidth: 1,
    },
    catText: { fontSize: 13, fontWeight: "600" },
    card: {
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: colors.card, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    cover: { height: 140, backgroundColor: colors.muted },
    cardBody: { padding: 12, paddingTop: 20 },
    cardName: { fontSize: 16, fontWeight: "800", color: colors.foreground },
    cardSub: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    meta: { flexDirection: "row-reverse", gap: 10, marginTop: 8 },
    metaText: { fontSize: 11, color: colors.mutedForeground },
    badge: { position: "absolute", top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    closedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
    logoThumb: { position: "absolute", bottom: -20, right: 12, width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: colors.background },
    compCard: {
      margin: 16, borderRadius: 20, padding: 18,
      borderWidth: 1, borderColor: colors.primary + "40",
      backgroundColor: colors.primary + "10",
    },
    compTitle: { fontSize: 20, fontWeight: "900", color: colors.foreground, textAlign: "right" },
    compPrize: { fontSize: 14, color: colors.mutedForeground, textAlign: "right", marginTop: 4 },
    joinBtn: {
      marginTop: 14, backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 14, alignItems: "center",
    },
    joinBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
    leaderRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    leaderRank: { fontSize: 18, fontWeight: "900", width: 30, textAlign: "center" },
    leaderName: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.foreground, textAlign: "right" },
    leaderPts: { fontSize: 13, color: colors.primary, fontWeight: "700" },
  });

  if (compLoading) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // عرض المسابقة إذا كانت مفعّلة
  if (competition?.enabled) {
    const leaderboard = competition.leaderboard || [];
    const isJoined = !!competition.userParticipant;
    const medals = ["🥇", "🥈", "🥉"];

    return (
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCompetition(); }} tintColor={colors.primary} />}
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.title}>🏆 مسابقة Gaytak</Text>
          <Text style={s.subtitle}>الجائزة الكبرى: {competition.prize}</Text>
        </View>

        <View style={s.compCard}>
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700", textAlign: "right", marginBottom: 4 }}>
            {competition.status === "open" ? "🔥 نشطة الآن" : competition.status === "preparing" ? "⏳ قيد التجهيز" : "🏁 منتهية"}
          </Text>
          <Text style={s.compTitle}>شارك وادعُ أصدقاءك</Text>
          <Text style={s.compPrize}>من يحصل على أكبر عدد من الإحالات يفوز!</Text>

          {competition.status === "open" && !isJoined && (
            <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={joining}>
              {joining ? <ActivityIndicator color="#FFF" /> : <Text style={s.joinBtnText}>اشترك الآن</Text>}
            </TouchableOpacity>
          )}

          {isJoined && competition.userParticipant && (
            <View style={{ marginTop: 14, backgroundColor: colors.card, borderRadius: 14, padding: 12 }}>
              <Text style={{ color: colors.primary, fontWeight: "800", textAlign: "right" }}>
                كودك: {competition.userParticipant.inviteCode}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "right", marginTop: 4 }}>
                نقاطك: {competition.userParticipant.points}
              </Text>
            </View>
          )}
        </View>

        {leaderboard.length > 0 && (
          <View style={{ marginHorizontal: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground, textAlign: "right", marginBottom: 10 }}>🏅 المتصدرون</Text>
            {leaderboard.slice(0, 10).map((item: any, idx: number) => (
              <View key={item.id || idx} style={s.leaderRow}>
                <Text style={s.leaderRank}>{medals[idx] || idx + 1}</Text>
                <Text style={s.leaderName}>{item.name || item.userName}</Text>
                <Text style={s.leaderPts}>{item.points} نقطة</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  // عرض المناسبات العادية
  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.title}>🏠 منازل المناسبات</Text>
        <Text style={s.subtitle}>فلل وشاليهات وقاعات للإيجار</Text>
      </View>

      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          placeholder="ابحث عن مناسبة..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        <Feather name="search" size={18} color={colors.mutedForeground} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catList}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[s.catBtn, { backgroundColor: category === c ? colors.primary : colors.muted, borderColor: category === c ? colors.primary : colors.border }]}
            onPress={() => setCategory(c)}
          >
            <Text style={[s.catText, { color: category === c ? "#FFF" : colors.foreground }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRestaurants(); }} tintColor={colors.primary} />}
        ListEmptyComponent={loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Feather name="home" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>لا توجد مناسبات حالياً</Text>
          </View>
        )}
        renderItem={({ item: r }) => (
          <TouchableOpacity style={s.card} activeOpacity={0.85}>
            <View style={s.cover}>
              {r.coverImage
                ? <Image source={{ uri: r.coverImage }} style={{ flex: 1 }} contentFit="cover" />
                : <View style={[s.cover, { alignItems: "center", justifyContent: "center" }]}>
                    <Feather name="home" size={40} color={colors.mutedForeground} />
                  </View>
              }
              {r.isFeatured && (
                <View style={[s.badge, { backgroundColor: "#F97316" }]}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>🔥 مميز</Text>
                </View>
              )}
              {!r.isOpen && (
                <View style={s.closedOverlay}>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700" }}>مغلق الآن</Text>
                </View>
              )}
              {r.logo && <Image source={{ uri: r.logo }} style={[s.logoThumb, { backgroundColor: colors.card }]} contentFit="cover" />}
            </View>

            <View style={[s.cardBody, r.logo ? { paddingTop: 24 } : {}]}>
              <Text style={s.cardName}>{r.name}</Text>
              <Text style={s.cardSub}>{r.category}</Text>
              <View style={s.meta}>
                <Text style={s.metaText}>⏱ {r.estimatedDeliveryMinutes} د</Text>
                <Text style={s.metaText}>📍 {r.address}</Text>
                {Number(r.rating) > 0 && <Text style={s.metaText}>⭐ {Number(r.rating).toFixed(1)}</Text>}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
