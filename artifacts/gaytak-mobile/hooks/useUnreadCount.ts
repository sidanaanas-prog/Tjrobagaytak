import { useAuth } from "@/contexts/AuthContext";
import { useListConversations } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const STORAGE_KEY = "gaytak_chat_read_at";

export async function markConversationRead(conversationId: string) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[conversationId] = new Date().toISOString();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function useUnreadCount() {
  const { isLoggedIn, user } = useAuth();
  const { data: conversations } = useListConversations({
    query: { enabled: isLoggedIn, refetchInterval: 5000 },
  } as any);
  const [readMap, setReadMap] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v) setReadMap(JSON.parse(v));
    });
    const interval = setInterval(async () => {
      const v = await AsyncStorage.getItem(STORAGE_KEY);
      if (v) setReadMap(JSON.parse(v));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!Array.isArray(conversations) || !user) return 0;

  return conversations.filter((conv: any) => {
    const last = conv.lastMessage;
    if (!last) return false;
    if (last.senderId === user.id) return false;
    const readAt = readMap[conv.id];
    if (!readAt) return true;
    return new Date(last.createdAt) > new Date(readAt);
  }).length;
}
