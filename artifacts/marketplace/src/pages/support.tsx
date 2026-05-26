import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, ArrowRight, Loader2, CheckCheck, Check, BadgeCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { getListConversationsQueryKey, getGetMessagesQueryKey } from "@workspace/api-client-react";

const SUPPORT_USER_ID = "e0757f35-e7d4-4c07-ae0b-339252aecfa6";

interface Message {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
  imageUrl?: string | null;
}

export default function SupportPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [convId, setConvId] = useState<string | null>(null);
  const [supportInfo, setSupportInfo] = useState<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => { if (!user) setLocation("/login"); }, [user, setLocation]);

  // Get or create support conversation
  useEffect(() => {
    if (!user) return;
    const token = getMemToken();
    (async () => {
      try {
        // Try to find existing conversation with support
        const listRes = await fetch("/api/conversations", { headers: { Authorization: `Bearer ${token}` } });
        if (listRes.ok) {
          const convs = await listRes.json();
          const supportConv = convs.find((c: any) =>
            c.participants?.some((p: any) => p.id === SUPPORT_USER_ID)
          );
          if (supportConv) {
            setConvId(supportConv.id);
            const other = supportConv.participants?.find((p: any) => p.id === SUPPORT_USER_ID);
            setSupportInfo({ name: other?.name ?? "دعم Gaytak", avatar: other?.avatar ?? null });
            // Load messages
            const msgRes = await fetch(`/api/conversations/${supportConv.id}/messages`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (msgRes.ok) setMessages(await msgRes.json());
            // Mark read
            await fetch(`/api/conversations/${supportConv.id}/mark-read`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          } else {
            // Create new conversation with support
            const createRes = await fetch("/api/conversations", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ recipientId: SUPPORT_USER_ID }),
            });
            if (createRes.ok) {
              const newConv = await createRes.json();
              setConvId(newConv.id);
              const other = newConv.participants?.find((p: any) => p.id === SUPPORT_USER_ID);
              setSupportInfo({ name: other?.name ?? "دعم Gaytak", avatar: other?.avatar ?? null });
            }
          }
        }
      } catch {
        toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال بدعم Gaytak" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, toast]);

  // Poll messages (منسال تلقائي بطيء — تجميد إذا التب غير نشط)
  useEffect(() => {
    if (!convId || !user) return;
    const token = getMemToken();
    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/conversations/${convId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch {}
    }, 10_000);
    return () => clearInterval(interval);
  }, [convId, user]);

  // Mark read on open
  useEffect(() => {
    if (!convId || !user) return;
    const token = getMemToken();
    fetch(`/api/conversations/${convId}/mark-read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [convId, user]);

  // Scroll to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function ensureConversation(): Promise<string | null> {
    if (convId) return convId;
    const token = getMemToken();
    try {
      // Try to find existing
      const listRes = await fetch("/api/conversations", { headers: { Authorization: `Bearer ${token}` } });
      if (listRes.ok) {
        const convs = await listRes.json();
        const supportConv = convs.find((c: any) =>
          c.participants?.some((p: any) => p.id === SUPPORT_USER_ID)
        );
        if (supportConv) {
          setConvId(supportConv.id);
          const other = supportConv.participants?.find((p: any) => p.id === SUPPORT_USER_ID);
          setSupportInfo({ name: other?.name ?? "دعم Gaytak", avatar: other?.avatar ?? null });
          return supportConv.id;
        }
      }
      // Create new
      const createRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: SUPPORT_USER_ID }),
      });
      if (createRes.ok) {
        const newConv = await createRes.json();
        setConvId(newConv.id);
        const other = newConv.participants?.find((p: any) => p.id === SUPPORT_USER_ID);
        setSupportInfo({ name: other?.name ?? "دعم Gaytak", avatar: other?.avatar ?? null });
        return newConv.id;
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إنشاء محادثة الدعم" });
    }
    return null;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    const token = getMemToken();
    setSending(true);
    try {
      const activeConvId = convId || await ensureConversation();
      if (!activeConvId) {
        toast({ variant: "destructive", title: "خطأ", description: "لم يتم إنشاء محادثة الدعم. أعد المحاولة." });
        return;
      }
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      if (res.ok) {
        setMessage("");
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        // إعادة تحميل قائمة المحادثات والرسائل
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        if (activeConvId) {
          queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(activeConvId) });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e?.message || "تعذر إرسال الرسالة" });
    } finally {
      setSending(false);
    }
  }

  if (!user) return null;

  return (
    <AppLayout hideNav>
      <div className="fixed inset-0 bg-background flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <Link href="/profile">
            <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white/60" />
            </button>
          </Link>
          <Avatar className="w-9 h-9 border border-primary/30">
            <AvatarImage src={supportInfo?.avatar ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-sm font-bold">G</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h2 className="font-bold text-white text-sm truncate">{supportInfo?.name ?? "دعم Gaytak"}</h2>
              <BadgeCheck className="w-4 h-4 text-blue-400 fill-blue-400/20 shrink-0" />
            </div>
            <p className="text-[10px] text-green-400 truncate flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              متوفر للمساعدة
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse" />
              <div className="w-32 h-3 bg-white/5 animate-pulse rounded" />
              <div className="w-20 h-2 bg-white/5 animate-pulse rounded" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/40">
              <BadgeCheck className="w-12 h-12 text-blue-400/40" />
              <p className="text-sm">مرحباً بك في دعم Gaytak</p>
              <p className="text-xs text-white/30">ارسل رسالتك وسنرد عليك في أقرب وقت</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMe = msg.senderId === user.id;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-1.5 ${isMe ? "justify-start" : "justify-end"}`}
                  >
                    {!isMe && (
                      <Avatar className="w-7 h-7 border border-white/10 shrink-0 mb-1">
                        <AvatarImage src={supportInfo?.avatar ?? undefined} />
                        <AvatarFallback className="bg-blue-500/20 text-[10px] font-bold text-blue-400">G</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                        ${isMe
                          ? "bg-primary text-white rounded-br-sm shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                          : "bg-white/10 text-white rounded-bl-sm border border-white/5"
                        }`}
                    >
                      {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <p className={`text-[9px] ${isMe ? "text-white/60" : "text-white/40"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {isMe && (
                          msg.isRead
                            ? <CheckCheck className="w-3 h-3 text-blue-400" />
                            : <Check className="w-3 h-3 text-white/40" />
                        )}
                      </div>
                    </div>
                    {isMe && (
                      <Avatar className="w-7 h-7 border border-primary/30 shrink-0 mb-1">
                        <AvatarImage src={user?.avatar} />
                        <AvatarFallback className="bg-primary/20 text-[10px] font-bold">{user?.name?.[0]}</AvatarFallback>
                      </Avatar>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-6 pt-2 bg-black/60 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب رسالتك..."
              className="flex-1 bg-white/5 border-white/10 rounded-xl h-11 text-sm"
            />
            <button
              type="submit"
              disabled={!message.trim() || sending}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 shrink-0"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 text-white" />}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
