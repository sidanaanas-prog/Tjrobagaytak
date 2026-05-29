import { useState, useEffect, useCallback, useRef } from "react";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

export type ApiMessage = {
  id: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  voiceUrl?: string | null;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
    senderId: string;
  } | null;
  sender?: { id: string; name: string; avatar?: string | null } | null;
  createdAt: string;
};

export function useApiMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: ApiMessage[] = await res.json();
      setMessages(data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [conversationId, fetchMessages]);

  const sendMessage = useCallback(
    async (params: {
      senderId: string;
      content: string;
      imageUrl?: string | null;
      voiceUrl?: string | null;
      replyTo?: ApiMessage["replyTo"];
    }) => {
      if (!conversationId) return;
      const token = getMemToken();
      const res = await fetch(`${BASE}/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: params.content,
          imageUrl: params.imageUrl ?? null,
          voiceUrl: params.voiceUrl ?? null,
          replyToId: params.replyTo?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("فشل إرسال الرسالة");
      const sent: ApiMessage = await res.json();
      // أضف الرسالة فوراً بدون انتظار الـ poll
      setMessages((prev) => {
        if (prev.find((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      return sent;
    },
    [conversationId],
  );

  return { messages, loading, sendMessage, refetch: fetchMessages };
}
