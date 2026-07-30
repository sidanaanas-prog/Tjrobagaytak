import { useColors } from "@/hooks/useColors";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// ─── زر + المزيد ────────────────────────────────────────────────────────
function MoreButton({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  return (
    <TouchableOpacity onPress={handlePress} style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Animated.View style={[styles.moreCircle, { backgroundColor: colors.primary, transform: [{ scale: pulse }] }]}>
        <Feather name="grid" size={20} color="#FFF" />
      </Animated.View>
      <Text style={[styles.moreLabel, { color: colors.primary }]}>المزيد</Text>
    </TouchableOpacity>
  );
}

// ─── مودال المزيد ────────────────────────────────────────────────────────
interface MoreModalProps {
  visible: boolean;
  onClose: () => void;
}

function MoreModal({ visible, onClose }: MoreModalProps) {
  const colors = useColors();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const unread = useUnreadCount();

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  const isSeller = user?.role === "seller";
  const isDriver = user?.role === "driver";

  function go(path: string) {
    onClose();
    setTimeout(() => router.push(path as any), 200);
  }

  const items = [
    { icon: "search", label: "استكشف", path: "/(tabs)/explore", color: "#6366F1", show: true },
    { icon: "shopping-bag", label: "بيع منتج", path: "/(tabs)/sell", color: "#10B981", show: true },
    { icon: "credit-card", label: "محفظتي", path: "/(tabs)/wallet", color: "#F59E0B", show: true },
    { icon: "message-circle", label: "الرسائل", path: "/(tabs)/chat", color: "#8B5CF6", show: true, badge: unread > 0 ? unread : undefined },
    { icon: "plus-circle", label: "مؤسسة الشفاء", path: "/(tabs)/food", color: "#34D399", show: true },
    { icon: "briefcase", label: "أعمالي", path: "/(tabs)/dashboard", color: "#F97316", show: isSeller },
    { icon: "navigation", label: "لوحة السائق", path: "/ride-driver", color: "#00C48C", show: isDriver },
    { icon: "user-plus", label: "تغيير الدور", path: "/role-select", color: "#0EA5E9", show: true },
  ].filter((i) => i.show);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.moreOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.moreSheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={() => {}}>
            {/* Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>الأقسام</Text>

            <View style={styles.grid}>
              {items.map((item) => (
                <TouchableOpacity key={item.path} style={[styles.gridItem, { backgroundColor: item.color + "18" }]} onPress={() => go(item.path)}>
                  <View style={[styles.gridIcon, { backgroundColor: item.color + "25" }]}>
                    <Feather name={item.icon as any} size={22} color={item.color} />
                    {item.badge ? (
                      <View style={[styles.gridBadge, { backgroundColor: item.color }]}>
                        <Text style={styles.gridBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.gridLabel, { color: colors.foreground }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Layout ──────────────────────────────────────────────────────────────
export default function TabLayout() {
  const colors = useColors();
  const unreadCount = useUnreadCount();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const [showMore, setShowMore] = useState(false);

  const [isCompetition, setIsCompetition] = useState(false);

  const TAB_BAR_HEIGHT = isWeb ? 84 : 62;
  const bottomPad = isIOS ? 0 : insets.bottom;

  useEffect(() => {
    const check = async () => {
      try {
        const token = await AsyncStorage.getItem("glow_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(`${BASE}/api/competition/status`, { headers });
        if (r.ok) {
          const d = await r.json();
          setIsCompetition(!!d.enabled);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  const isSeller = user?.role === "seller";

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.card,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 0,
            height: TAB_BAR_HEIGHT + bottomPad,
            paddingBottom: bottomPad,
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            ) : null,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        }}
      >
        {/* ── الرئيسية ── */}
        <Tabs.Screen
          name="index"
          options={{
            title: "الرئيسية",
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />

        {/* ── كورسا ── */}
        <Tabs.Screen
          name="rides"
          options={{
            title: "تاكسي",
            tabBarIcon: ({ color }) => <Feather name="navigation" size={22} color={color} />,
          }}
        />

        {/* ── + المزيد (custom button) ── */}
        <Tabs.Screen
          name="explore"
          options={{
            title: "",
            tabBarIcon: () => null,
            tabBarLabel: () => null,
            tabBarButton: () => <MoreButton onPress={() => setShowMore(true)} />,
          }}
        />

        {/* ── حسابي ── */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "حسابي",
            tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
          }}
        />

        {/* ── الأقسام المخفية من الشريط (متاحة للتنقل) ── */}
        {/* ── مؤسسة الشفاء ── */}
        <Tabs.Screen
          name="food"
          options={{
            title: "مؤسسة الشفاء",
            tabBarIcon: ({ color }) => <Feather name="plus-circle" size={22} color={color} />,
            tabBarActiveTintColor: "#34D399",
          }}
        />

        <Tabs.Screen name="sell" options={{ href: null }} />
        <Tabs.Screen name="wallet" options={{ href: null }} />
        <Tabs.Screen
          name="chat"
          options={{
            href: null,
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen
          name="dashboard"
          options={{ href: isSeller ? undefined : null }}
        />
      </Tabs>

      <MoreModal visible={showMore} onClose={() => setShowMore(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  moreCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    shadowColor: "#AA33FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  moreLabel: { fontSize: 10, fontWeight: "700" },
  moreOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  moreSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingTop: 12,
  },
  sheetHandle: { width: 44, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  gridItem: {
    width: "28%",
    borderRadius: 18,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 8,
  },
  gridIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  gridBadge: { position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  gridBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  gridLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
