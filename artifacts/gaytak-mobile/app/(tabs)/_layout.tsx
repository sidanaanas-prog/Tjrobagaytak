import { useColors } from "@/hooks/useColors";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useAuth } from "@/contexts/AuthContext";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

function SellButton() {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/sell")}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: Platform.OS === "ios" ? 20 : 10,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <Feather name="plus" size={26} color="#FFF" />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const unreadCount = useUnreadCount();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const [pendingOrders, setPendingOrders] = useState(0);
  const [isCompetition, setIsCompetition] = useState(false);

  const TAB_BAR_HEIGHT = isWeb ? 84 : 60;
  const bottomPad = isIOS ? 0 : insets.bottom;

  // فحص المسابقة كل 30 ثانية
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

  // فحص الطلبات المعلقة (للبائعين)
  useEffect(() => {
    if (!user || user.role !== "seller") { setPendingOrders(0); return; }
    const fetch_ = async () => {
      try {
        const token = await AsyncStorage.getItem("glow_token");
        const r = await fetch(`${BASE}/api/orders?role=seller`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const orders: any[] = await r.json() ?? [];
          setPendingOrders(orders.filter((o) => o.status === "pending").length);
        }
      } catch {}
    };
    fetch_();
    const interval = setInterval(fetch_, 15_000);
    return () => clearInterval(interval);
  }, [user]);

  const isSeller = user?.role === "seller";
  const isDriver = user?.role === "driver";

  return (
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
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
        },
      }}
    >
      {/* الرئيسية */}
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color }) => <Feather name="home" size={20} color={color} />,
        }}
      />

      {/* استكشف */}
      <Tabs.Screen
        name="explore"
        options={{
          title: "استكشف",
          tabBarIcon: ({ color }) => <Feather name="search" size={20} color={color} />,
        }}
      />

      {/* بيع — زر مركزي */}
      <Tabs.Screen
        name="sell"
        options={{
          title: "بيع",
          tabBarIcon: () => null,
          tabBarLabel: () => null,
          tabBarButton: () => <SellButton />,
        }}
      />

      {/* المناسبات / المسابقات */}
      <Tabs.Screen
        name="food"
        options={{
          title: isCompetition ? "المسابقات" : "المناسبات",
          tabBarIcon: ({ color }) => (
            <Feather name={isCompetition ? "award" : "star"} size={20} color={isCompetition ? colors.primary : color} />
          ),
          tabBarBadge: isCompetition ? "🔥" : undefined,
          tabBarBadgeStyle: { backgroundColor: "transparent", fontSize: 10, top: -2 },
        }}
      />

      {/* كورسا */}
      <Tabs.Screen
        name="rides"
        options={{
          title: "كورسا",
          tabBarIcon: ({ color }) => <Feather name="navigation" size={20} color={color} />,
        }}
      />

      {/* محفظتي */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: "محفظتي",
          tabBarIcon: ({ color }) => <Feather name="credit-card" size={20} color={color} />,
        }}
      />

      {/* محادثات */}
      <Tabs.Screen
        name="chat"
        options={{
          title: "محادثات",
          tabBarIcon: ({ color }) => <Feather name="message-circle" size={20} color={color} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#AA33FF", color: "#FFF", fontSize: 10 },
        }}
      />

      {/* أعمالي — للبائعين فقط */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "أعمالي",
          tabBarIcon: ({ color }) => <Feather name="briefcase" size={20} color={color} />,
          tabBarBadge: pendingOrders > 0 ? pendingOrders : undefined,
          tabBarBadgeStyle: { backgroundColor: "#F97316", color: "#FFF", fontSize: 10 },
          href: isSeller ? "/(tabs)/dashboard" : null,
        }}
      />

      {/* حسابي */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "حسابي",
          tabBarIcon: ({ color }) => <Feather name="user" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
