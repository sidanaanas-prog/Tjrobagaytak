import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";

export type FirestoreMessage = {
  id: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
    senderId: string;
  } | null;
  createdAt: string;
};

export function useFirestoreMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<FirestoreMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const msgsRef = collection(firestore, "conversations", conversationId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs: FirestoreMessage[] = snap.docs.map((doc) => {
        const d = doc.data();
        const ts = d.createdAt as Timestamp | null;
        return {
          id: doc.id,
          senderId: d.senderId as string,
          content: d.content as string,
          imageUrl: d.imageUrl ?? null,
          replyTo: d.replyTo ?? null,
          createdAt: ts ? ts.toDate().toISOString() : new Date().toISOString(),
        };
      });
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsub();
  }, [conversationId]);

  const sendMessage = useCallback(
    async (params: {
      senderId: string;
      content: string;
      imageUrl?: string | null;
      replyTo?: FirestoreMessage["replyTo"];
    }) => {
      if (!conversationId) return;
      const msgsRef = collection(firestore, "conversations", conversationId, "messages");
      await addDoc(msgsRef, {
        senderId: params.senderId,
        content: params.content,
        imageUrl: params.imageUrl ?? null,
        replyTo: params.replyTo ?? null,
        createdAt: serverTimestamp(),
      });
    },
    [conversationId]
  );

  return { messages, loading, sendMessage };
}
