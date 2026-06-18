import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useListConversations } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { data: conversations, isLoading } = useListConversations({
    query: { enabled: isLoggedIn, refetchInterval: 4000 },
  } as any);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!isLoggedIn) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <Feather name="message-circle" size={48} color={colors.mutedForeground} />
        <Text style={[styles.guestTitle, { color: colors.foreground }]}>المحادثات</Text>
        <Text style={[styles.guestSub, { color: colors.mutedForeground }]}>سجّل دخولك للوصول إلى رسائلك</Text>
        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.loginBtnText}>دخول</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getOtherUser = (conv: any) => {
    return conv.participants?.find((p: any) => p?.id !== user?.id) || conv.participants?.[0];
  };

  const isUnread = (conv: any) => {
    const last = conv.lastMessage;
    if (!last) return false;
    return last.senderId !== user?.id && !last.isRead;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>المحادثات</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !conversations || conversations.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="message-circle" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>لا توجد محادثات</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>ابدأ بالتواصل مع البائعين</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 80 + botPad }}
          renderItem={({ item: conv }) => {
            const other = getOtherUser(conv);
            const lastMsg = conv.lastMessage;
            const unread = isUnread(conv);
            return (
              <TouchableOpacity
                style={[styles.convItem, { borderBottomColor: colors.border }]}
                onPress={() => router.push(`/conversation/${conv.id}`)}
                activeOpacity={0.8}
              >
                <View style={[styles.convAvatar, { backgroundColor: colors.primary + "30" }]}>
                  <Text style={[styles.convAvatarText, { color: colors.primary }]}>
                    {other?.name?.[0]?.toUpperCase() || "؟"}
                  </Text>
                  {unread && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <View style={styles.convInfo}>
                  <Text style={[styles.convName, { color: colors.foreground, fontWeight: unread ? "900" : "700" }]} numberOfLines={1}>
                    {other?.name || "مجهول"}
                  </Text>
                  {conv.product && (
                    <Text style={[styles.convProduct, { color: colors.primary }]} numberOfLines={1}>
                      {conv.product.title}
                    </Text>
                  )}
                  {lastMsg && (
                    <Text style={[styles.convLast, { color: unread ? colors.foreground : colors.mutedForeground, fontWeight: unread ? "700" : "400" }]} numberOfLines={1}>
                      {lastMsg.content}
                    </Text>
                  )}
                </View>
                {unread && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unreadBadgeText}>جديد</Text>
                  </View>
                )}
                <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: "900", textAlign: "right" },
  guestTitle: { fontSize: 22, fontWeight: "800" },
  guestSub: { fontSize: 14 },
  loginBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 20, marginTop: 8 },
  loginBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  convItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  convAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  convAvatarText: { fontSize: 18, fontWeight: "700" },
  convInfo: { flex: 1, gap: 2, alignItems: "flex-end" },
  convName: { fontSize: 15 },
  convProduct: { fontSize: 11, fontWeight: "600" },
  convLast: { fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14 },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#09090F",
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unreadBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
});
