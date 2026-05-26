import { useState, useEffect, useRef } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send, ArrowRight, MessageCircle, Loader2, CheckCheck, Check,
  ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ADMIN_ID = "e0757f35-e7d4-4c07-ae0b-339252aecfa6";

interface SupportConversation {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  unreadCount: number;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  createdAt: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

export default function SupportPage() {
  const { user } = useAdminAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("glow_admin_token") : "";

  // Fetch support conversations
  useEffect(() => {
    if (!token) return;
    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const allConvs = await res.json();
        // Filter conversations where an admin is a participant (any user with role "admin")
        const supportConvs = allConvs
          .filter((c: any) => c.participants?.some((p: any) => p.role === "admin"))
          .map((c: any) => {
            const other = c.participants?.find((p: any) => p.role !== "admin");
            return {
              id: c.id,
              userId: other?.id,
              userName: other?.name ?? "مستخدم",
              userAvatar: other?.avatar ?? null,
              unreadCount: c.unreadCount ?? 0,
              lastMessage: c.lastMessage
                ? { content: c.lastMessage.content, senderId: c.lastMessage.senderId, createdAt: c.lastMessage.createdAt }
                : null,
              createdAt: c.createdAt,
            };
          });
        setConversations(supportConvs);
      } catch {
        toast({ variant: "destructive", title: "خطأ", description: "تعذر تحميل المحادثات" });
      } finally {
        setLoadingConversations(false);
      }
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [token, toast]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId || !token) return;
    setLoadingMessages(true);
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        setMessages(await res.json());
        // Mark read
        await fetch(`/api/conversations/${activeConvId}/mark-read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        toast({ variant: "destructive", title: "خطأ", description: "تعذر تحميل الرسائل" });
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [activeConvId, token, toast]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !activeConvId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) throw new Error();
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setMessage("");
      // Update conversation list with new last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? { ...c, lastMessage: { content: message, senderId: ADMIN_ID, createdAt: new Date().toISOString() } }
            : c
        )
      );
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إرسال الرسالة" });
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-mono">
        SESSION REQUIRED. REDIRECTING...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Conversations list */}
      <div className="w-80 flex flex-col border-r border-border bg-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg font-mono">SUPPORT TICKETS</h2>
          <span className="ml-auto text-xs text-muted-foreground font-mono">{conversations.length} open</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-4 text-center">
              <MessageCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm font-mono">NO SUPPORT TICKETS YET</p>
              <p className="text-xs opacity-50">Users will appear here when they start a support chat</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 border-b border-border",
                  activeConvId === conv.id ? "bg-primary/10" : ""
                )}
              >
                <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                  <AvatarImage src={conv.userAvatar ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-sm font-bold">
                    {conv.userName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-semibold text-sm truncate">{conv.userName}</p>
                    {conv.unreadCount > 0 && activeConvId !== conv.id && (
                      <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white font-bold px-1">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage
                      ? `${conv.lastMessage.senderId === ADMIN_ID ? "You: " : ""}${conv.lastMessage.content}`
                      : "No messages yet"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {conv.lastMessage
                      ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : new Date(conv.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-card rounded-xl overflow-hidden border border-border">
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
              <button onClick={() => setActiveConvId(null)} className="lg:hidden w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Avatar className="w-9 h-9 border border-primary/30">
                <AvatarImage src={activeConv.userAvatar ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-sm font-bold">{activeConv.userName[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-sm truncate">{activeConv.userName}</h2>
                <p className="text-[10px] text-green-400 truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  User ticket active
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => {
                    const isMe = msg.senderId === ADMIN_ID;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-end gap-1.5 ${isMe ? "justify-start" : "justify-end"}`}
                      >
                        {!isMe && (
                          <Avatar className="w-7 h-7 border border-white/10 shrink-0 mb-1">
                            <AvatarImage src={activeConv.userAvatar ?? undefined} />
                            <AvatarFallback className="bg-primary/20 text-[10px] font-bold">
                              {activeConv.userName[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                            ${isMe
                              ? "bg-primary text-white rounded-br-sm shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                              : "bg-muted text-foreground rounded-bl-sm border border-border"
                            }`}
                        >
                          {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                          <div className="flex items-center gap-1 mt-1">
                            <p className={`text-[9px] ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
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
                            <AvatarImage src={user?.avatar ?? undefined} />
                            <AvatarFallback className="bg-primary/20 text-[10px] font-bold">
                              {user?.name?.[0]}
                            </AvatarFallback>
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
            <div className="px-4 py-3 border-t border-border bg-card">
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 bg-muted border-border rounded-xl h-10 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={!message.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 shrink-0"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageCircle className="w-12 h-12 opacity-20" />
            <p className="text-sm font-mono">SELECT A TICKET TO REPLY</p>
            <p className="text-xs opacity-50">Choose a conversation from the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
}
