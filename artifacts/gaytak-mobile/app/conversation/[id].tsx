import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { markConversationRead } from "@/hooks/useUnreadCount";
import { useGetMessages, useSendMessage } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: messages, refetch } = useGetMessages(id ?? "", undefined, {
    query: { enabled: !!id, refetchInterval: 3000 },
  } as any);
  const sendMsg = useSendMessage();
  const [text, setText] = useState("");
  const prevCountRef = useRef<number>(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const msgs = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    if (!id) return;
    markConversationRead(id);
  }, [id]);

  useEffect(() => {
    const count = msgs.length;
    if (prevCountRef.current > 0 && count > prevCountRef.current) {
      const newest = msgs[msgs.length - 1];
      if (newest && newest.senderId !== user?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        markConversationRead(id ?? "");
      }
    }
    prevCountRef.current = count;
  }, [msgs.length]);

  async function handleSend() {
    if (!text.trim() || !id) return;
    const content = text.trim();
    setText("");
    try {
      await sendMsg.mutateAsync({ id, data: { content } });
      refetch();
      markConversationRead(id);
    } catch (_) {}
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>المحادثة</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={[...msgs].reverse()}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        renderItem={({ item: msg }) => {
          const isMine = msg.senderId === user?.id;
          return (
            <View style={[styles.msgWrap, isMine ? styles.msgRight : styles.msgLeft]}>
              <View style={[
                styles.bubble,
                isMine
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
              ]}>
                <Text style={[styles.msgText, { color: isMine ? "#FFF" : colors.foreground }]}>
                  {msg.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputArea, { borderTopColor: colors.border, paddingBottom: botPad + 8 }]}>
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }]}
          onPress={handleSend}
          disabled={!text.trim() || sendMsg.isPending}
        >
          <Feather name="send" size={18} color="#FFF" />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          placeholder="اكتب رسالة..."
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          textAlign="right"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  msgWrap: { marginBottom: 8, maxWidth: "80%" },
  msgRight: { alignSelf: "flex-end" },
  msgLeft: { alignSelf: "flex-start" },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgText: { fontSize: 15, lineHeight: 22 },
  inputArea: {
    flexDirection: "row-reverse",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
