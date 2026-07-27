import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { markConversationRead } from "@/hooks/useUnreadCount";
import { useGetMessages, useSendMessage } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
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

  // ─── تسجيل الصوت ─────────────────────────────────────────────────────
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingRef = useRef<Audio.Sound | null>(null);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);

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

  // ─── إرسال نص ─────────────────────────────────────────────────────────
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

  // ─── بدء التسجيل ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("إذن مطلوب", "نحتاج إذن الميكروفون لتسجيل الرسائل الصوتية");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: "aac" as any,
          audioQuality: 96,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { mimeType: "audio/webm", bitsPerSecond: 64000 },
      });
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setRecordingSecs(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      recordTimerRef.current = setInterval(() => setRecordingSecs((s) => s + 1), 1000);
    } catch (e) {
      Alert.alert("خطأ", "تعذر بدء التسجيل");
    }
  }

  // ─── إلغاء التسجيل ────────────────────────────────────────────────────
  async function cancelRecording() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch {}
    setRecording(null);
    setIsRecording(false);
    setRecordingSecs(0);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // ─── إيقاف وإرسال ─────────────────────────────────────────────────────
  async function stopAndSend() {
    if (!recording || !id) return;
    setSendingVoice(true);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setRecordingSecs(0);

      if (!uri) { setSendingVoice(false); return; }

      // تحويل إلى base64 وإرسال
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const duration = recordingSecs;
        const content = `[voice]${duration}|${base64}`;
        try {
          await sendMsg.mutateAsync({ id, data: { content } });
          refetch();
          markConversationRead(id ?? "");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
        setSendingVoice(false);
      };
      reader.onerror = () => setSendingVoice(false);
    } catch {
      setSendingVoice(false);
    }
  }

  // ─── تشغيل رسالة صوتية ────────────────────────────────────────────────
  async function playVoice(msgId: string, base64: string) {
    if (playingRef.current) {
      await playingRef.current.stopAsync();
      await playingRef.current.unloadAsync();
      playingRef.current = null;
      if (playingMsgId === msgId) { setPlayingMsgId(null); return; }
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: base64 },
        { shouldPlay: true }
      );
      playingRef.current = sound;
      setPlayingMsgId(msgId);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setPlayingMsgId(null);
          playingRef.current = null;
          sound.unloadAsync();
        }
      });
    } catch {
      setPlayingMsgId(null);
    }
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>المحادثة</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Messages */}
      <FlatList
        data={[...msgs].reverse()}
        keyExtractor={(m) => m.id}
        inverted
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        renderItem={({ item: msg }) => {
          const isMine = msg.senderId === user?.id;
          const isVoice = typeof msg.content === "string" && msg.content.startsWith("[voice]");

          if (isVoice) {
            const rest = msg.content.slice(7);
            const pipeIdx = rest.indexOf("|");
            const dur = parseInt(rest.slice(0, pipeIdx)) || 0;
            const b64 = rest.slice(pipeIdx + 1);
            const isPlaying = playingMsgId === msg.id;

            return (
              <View style={[styles.msgWrap, isMine ? styles.msgRight : styles.msgLeft]}>
                <TouchableOpacity
                  onPress={() => playVoice(msg.id, b64)}
                  style={[
                    styles.voiceBubble,
                    isMine
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }
                  ]}
                >
                  <Feather name={isPlaying ? "pause" : "play"} size={20} color={isMine ? "#FFF" : colors.primary} />
                  <View style={[styles.waveform, { backgroundColor: isMine ? "rgba(255,255,255,0.3)" : colors.border }]} />
                  <Text style={{ color: isMine ? "rgba(255,255,255,0.8)" : colors.mutedForeground, fontSize: 12, fontWeight: "600" }}>
                    {formatDuration(dur)}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

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

      {/* منطقة الإدخال */}
      {isRecording ? (
        /* ─── واجهة التسجيل ─── */
        <View style={[styles.recordingArea, { borderTopColor: colors.border, paddingBottom: botPad + 8, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={cancelRecording} style={[styles.cancelRecBtn, { backgroundColor: colors.destructive + "20" }]}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
          </TouchableOpacity>

          <View style={[styles.recIndicator, { backgroundColor: colors.muted }]}>
            <View style={styles.recDot} />
            <Text style={[styles.recText, { color: colors.foreground }]}>جارٍ التسجيل... {formatDuration(recordingSecs)}</Text>
          </View>

          <TouchableOpacity
            onPress={stopAndSend}
            disabled={sendingVoice}
            style={[styles.sendVoiceBtn, { backgroundColor: colors.primary }]}
          >
            {sendingVoice ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Feather name="send" size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        /* ─── واجهة النص العادية ─── */
        <View style={[styles.inputArea, { borderTopColor: colors.border, paddingBottom: botPad + 8 }]}>
          {/* زر إرسال أو ميكروفون */}
          {text.trim() ? (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={handleSend}
              disabled={sendMsg.isPending}
            >
              {sendMsg.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Feather name="send" size={18} color="#FFF" />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: "#AA33FF" }]}
              onPress={startRecording}
            >
              <Feather name="mic" size={18} color="#FFF" />
            </TouchableOpacity>
          )}

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
      )}
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
  voiceBubble: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    minWidth: 140,
  },
  waveform: { flex: 1, height: 3, borderRadius: 2 },
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
  recordingArea: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  cancelRecBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  recIndicator: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FF3B30" },
  recText: { fontSize: 14, fontWeight: "600" },
  sendVoiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
