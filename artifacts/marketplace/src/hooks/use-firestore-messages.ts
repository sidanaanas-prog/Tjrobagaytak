import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { firestore, firebaseAuth } from "@/lib/firebase";

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

// تسجيل دخول مجهول لـ Firestore — يُستدعى مرة واحدة فقط
let _authReady: Promise<void> | null = null;
function ensureFirebaseAuth(): Promise<void> {
  if (_authReady) return _authReady;
  _authReady = new Promise<void>((resolve) => {
    if (firebaseAuth.currentUser) {
      resolve();
      return;
    }
    signInAnonymously(firebaseAuth)
      .then(() => resolve())
      .catch(() => resolve()); // نكمل حتى لو فشل
  });
  return _authReady;
}

export function useFirestoreMessages(conversationId: string | undefined) {
  const [messages, setMessages] = useState<FirestoreMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    ensureFirebaseAuth().then(() => {
      if (unsubRef.current) unsubRef.current();

      const msgsRef = collection(firestore, "conversations", conversationId, "messages");
      const q = query(msgsRef, orderBy("createdAt", "asc"));

      unsubRef.current = onSnapshot(
        q,
        (snap) => {
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
        },
        (err) => {
          console.error("[Firestore] snapshot error:", err.code);
          setLoading(false);
        },
      );
    });

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    async (params: {
      senderId: string;
      content: string;
      imageUrl?: string | null;
      replyTo?: FirestoreMessage["replyTo"];
    }) => {
      if (!conversationId) return;
      await ensureFirebaseAuth();
      const msgsRef = collection(firestore, "conversations", conversationId, "messages");
      await addDoc(msgsRef, {
        senderId: params.senderId,
        content: params.content,
        imageUrl: params.imageUrl ?? null,
        replyTo: params.replyTo ?? null,
        createdAt: serverTimestamp(),
      });
    },
    [conversationId],
  );

  return { messages, loading, sendMessage };
}
