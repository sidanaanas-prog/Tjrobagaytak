import { useState, useEffect, useRef } from "react";
import { useAuth, handle401, getMemToken } from "@/hooks/use-auth";
import { Link, useLocation, useParams } from "wouter";
import {
  useListConversations,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useFirestoreMessages } from "@/hooks/use-firestore-messages";
import { uploadChatImage } from "@/lib/upload-image";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Send, ArrowRight, MessageCircle, Loader2, Trash2, Copy, ChevronDown, ChevronUp,
  Reply, Share2, ImageIcon, X, Search, CheckCheck, Check, Headphones,
  MoreVertical, Flag, ShieldOff, ShieldCheck,
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const activeId = params.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversationsRaw, isLoading: loadingConversations } = useListConversations({
    query: { enabled: !!user, refetchInterval: 15_000, queryKey: getListConversationsQueryKey() },
  });

  // ترتيب المحادثات حسب آخر رسالة (من السيرفر أو العملاء)
  const conversations = conversationsRaw
    ? [...conversationsRaw].sort((a: any, b: any) => {
        const ta = new Date(a.updatedAt || a.createdAt).getTime();
        const tb = new Date(b.updatedAt || b.createdAt).getTime();
        return tb - ta;
      })
    : conversationsRaw;

  const [searchQuery, setSearchQuery] = useState("");
  const { messages: firestoreMessages, loading: loadingMessages, sendMessage: fsSendMessage } = useFirestoreMessages(activeId);

  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; senderName: string } | null>(null);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── حظر + تبليغ ──
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [blockStatus, setBlockStatus] = useState<{ blocked: boolean; iBlockedThem: boolean; theyBlockedMe: boolean } | null>(null);
  const [blockLoading, setBlockLoading] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSending, setReportSending] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    msgId: string; content: string; x: number; y: number; isMe: boolean;
    replyTo?: { id: string; content: string; senderName: string; senderId: string } | null;
    imageUrl?: string | null;
  } | null>(null);

  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [otherStatus, setOtherStatus] = useState<{ isOnline: boolean; lastSeenAt: string | null } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchInConv, setSearchInConv] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIdx, setCurrentSearchIdx] = useState(-1);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { if (!user) setLocation("/login"); }, [user, setLocation]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [firestoreMessages]);

  // فحص الحظر عند فتح محادثة
  useEffect(() => {
    if (!activeId || !conversationsRaw) return;
    const activeConv = (conversationsRaw as any[]).find((c: any) => c.id === activeId);
    const other = activeConv?.participants?.find((p: any) => p.id !== user?.id);
    if (!other) return;
    const token = getMemToken();
    fetch(`/api/blocks/check?userId=${other.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBlockStatus(d); })
      .catch(() => {});
  }, [activeId, conversationsRaw]);

  // mark read on open
  useEffect(() => {
    if (!activeId) return;
    const token = getMemToken();
    fetch(`/api/conversations/${activeId}/mark-read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [activeId, firestoreMessages]);

  // typing & online status poll (تجميد إذا التب غير نشط)
  useEffect(() => {
    if (!activeId) return;
    const token = getMemToken();
    const interval = setInterval(async () => {
      if (document.hidden) return; // لا تستطلع والتب معمي
      try {
        const [typingRes, statusRes] = await Promise.all([
          fetch(`/api/conversations/${activeId}/typing`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/conversations/${activeId}/status`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (typingRes.ok) {
          const data = await typingRes.json();
          setTypingIndicator(data.isTyping);
        }
        if (statusRes.ok) {
          const data = await statusRes.json();
          setOtherStatus(data);
        }
      } catch {}
    }, 8_000);
    return () => clearInterval(interval);
  }, [activeId]);

  // search in conversation
  useEffect(() => {
    if (!searchInConv.trim() || !firestoreMessages.length) { setSearchResults([]); setCurrentSearchIdx(-1); return; }
    const idxs: number[] = [];
    firestoreMessages.forEach((m, i) => {
      if (m.content?.toLowerCase().includes(searchInConv.toLowerCase())) idxs.push(i);
    });
    setSearchResults(idxs);
    if (idxs.length > 0) {
      setCurrentSearchIdx(0);
      setTimeout(() => {
        messageRefs.current[idxs[0]]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [searchInConv, firestoreMessages]);

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!nearBottom);
  }

  async function handleDeleteMessage(msgId: string) {
    if (!activeId) return;
    try {
      const token = getMemToken();
      const res = await fetch(`/api/conversations/${activeId}/messages/${msgId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم الحذف" });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حذف الرسالة" });
    } finally {
      setContextMenu(null);
    }
  }

  async function handleCopyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ" });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر النسخ" });
    }
    setContextMenu(null);
  }

  async function handleForward(msg: any) {
    setContextMenu(null);
    const otherConvs = conversations?.filter((c: any) => c.id !== activeId) || [];
    if (!otherConvs.length) {
      toast({ title: "لا توجد محادثات أخرى" });
      return;
    }
    const convNames = otherConvs.map((c: any) => {
      const other = c.participants?.find((p: any) => p.id !== user?.id);
      return `${other?.name || "مجهول"} (${c.id.slice(0, 6)})`;
    }).join("\n");
    const targetId = prompt(`إعادة توجيه إلى:\n${convNames}\n\nأدخل معرّف المحادثة:`);
    if (!targetId) return;
    const token = getMemToken();
    try {
      const res = await fetch(`/api/conversations/${activeId}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: msg.id, toConversationId: targetId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تمت إعادة التوجيه" });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إعادة التوجيه" });
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  }

  function scrollUp() {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollBy({ top: -300, behavior: "smooth" });
  }

  function scrollDown() {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollBy({ top: 300, behavior: "smooth" });
  }

  function handleReply(msg: any) {
    setReplyingTo({ id: msg.id, content: msg.content?.slice(0, 60) || "", senderName: msg.sender?.name || "مستخدم" });
    setContextMenu(null);
  }

  async function handleSendImage(file: File) {
    if (!activeId || !user) return;
    try {
      const imageUrl = await uploadChatImage(file, activeId);
      await fsSendMessage({ senderId: user.id, content: "", imageUrl });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إرسال الصورة" });
    }
  }

  const [sending, setSending] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeId || !user) return;
    const text = message;
    setMessage("");
    setSending(true);
    try {
      await fsSendMessage({
        senderId: user.id,
        content: text,
        replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, senderName: replyingTo.senderName, senderId: "" } : null,
      });
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      setMessage(text);
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إرسال الرسالة" });
    } finally {
      setSending(false);
    }
  };

  async function handleBlock() {
    if (!otherParticipant || !activeId) return;
    setBlockLoading(true);
    const token = getMemToken();
    try {
      if (blockStatus?.iBlockedThem) {
        await fetch("/api/blocks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ blockedId: otherParticipant.id }),
        });
        setBlockStatus({ blocked: false, iBlockedThem: false, theyBlockedMe: false });
        toast({ title: "تم إلغاء الحظر" });
      } else {
        await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ blockedId: otherParticipant.id }),
        });
        setBlockStatus({ blocked: true, iBlockedThem: true, theyBlockedMe: false });
        toast({ title: "تم الحظر", description: `لن يتمكن ${otherParticipant.name} من مراسلتك` });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذرت العملية" });
    } finally {
      setBlockLoading(false);
      setShowActionsMenu(false);
    }
  }

  async function handleSubmitReport() {
    if (!otherParticipant || !reportReason.trim()) return;
    setReportSending(true);
    const token = getMemToken();
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportedId: otherParticipant.id, conversationId: activeId, reason: reportReason.trim() }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ تم الإرسال", description: "سيراجع فريق Gaytak البلاغ قريباً" });
      setReportDialog(false);
      setReportReason("");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إرسال التبليغ" });
    } finally {
      setReportSending(false);
    }
  }

  async function handleDeleteConversation(convId: string) {
    setDeletingId(convId);
    try {
      const token = getMemToken();
      const res = await fetch(`/api/conversations/${convId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      toast({ title: "تم الحذف ✓", description: "تم حذف المحادثة." });
      if (activeId === convId) setLocation("/chat");
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر حذف المحادثة." });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  // send typing indicator
  function handleTyping() {
    if (!activeId) return;
    const token = getMemToken();
    fetch(`/api/conversations/${activeId}/typing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  const activeConversation = conversations?.find((c) => c.id === activeId);
  const otherParticipant = activeConversation?.participants?.find((p) => p.id !== user?.id);

  const filteredConversations = searchQuery
    ? conversations?.filter((c: any) => {
        const other = c.participants?.find((p: any) => p.id !== user?.id);
        return other?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  if (!user) return null;

  // ── Active chat view ───────────────────────────
  if (activeId) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col max-w-lg mx-auto" onClick={() => setContextMenu(null)}>
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-3 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <Link href="/chat">
            <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-white/60" />
            </button>
          </Link>
          {otherParticipant && (
            <>
              <Avatar className="w-9 h-9 border border-primary/30">
                <AvatarImage src={otherParticipant.avatar} />
                <AvatarFallback className="bg-primary/20 text-sm font-bold">{otherParticipant.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-white text-sm truncate flex items-center gap-1">
                  {otherParticipant.name}
                  {(otherParticipant as any).role === "admin" && <VerifiedBadge size="xs" />}
                </h2>
                {typingIndicator ? (
                  <p className="text-[10px] text-primary/70 truncate">يكتب الآن...</p>
                ) : otherStatus?.isOnline ? (
                  <p className="text-[10px] text-green-400 truncate flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    متصل
                  </p>
                ) : otherStatus?.lastSeenAt ? (
                  <p className="text-[10px] text-white/40 truncate">
                    آخر ظهور {new Date(otherStatus.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                ) : activeConversation?.product ? (
                  <p className="text-[10px] text-primary/70 truncate">{activeConversation.product.title}</p>
                ) : null}
              </div>
            </>
          )}
          <button
            onClick={() => setShowSearch(s => !s)}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0"
          >
            <Search className="w-4 h-4 text-white/60" />
          </button>

          {/* 3-dot menu */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setShowActionsMenu(s => !s); }}
              className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4 text-white/60" />
            </button>
            <AnimatePresence>
              {showActionsMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -6 }}
                  className="absolute left-0 top-11 w-48 bg-[#1a1a2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* تبليغ */}
                  <button
                    onClick={() => { setShowActionsMenu(false); setReportDialog(true); setReportReason(""); }}
                    className="flex items-center gap-2.5 px-4 py-3 text-sm text-orange-400 hover:bg-orange-500/10 w-full text-right transition-colors"
                  >
                    <Flag className="w-4 h-4" />
                    تبليغ عن المستخدم
                  </button>

                  {/* حظر / إلغاء حظر */}
                  <button
                    onClick={handleBlock}
                    disabled={blockLoading}
                    className={`flex items-center gap-2.5 px-4 py-3 text-sm w-full text-right transition-colors
                      ${blockStatus?.iBlockedThem
                        ? "text-green-400 hover:bg-green-500/10"
                        : "text-red-400 hover:bg-red-500/10"}`}
                  >
                    {blockLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : blockStatus?.iBlockedThem
                        ? <ShieldCheck className="w-4 h-4" />
                        : <ShieldOff className="w-4 h-4" />}
                    {blockStatus?.iBlockedThem ? "إلغاء الحظر" : "حظر المستخدم"}
                  </button>

                  <div className="border-t border-white/5" />

                  {/* حذف المحادثة */}
                  {confirmDeleteId === activeId ? (
                    <div className="flex gap-1.5 px-3 py-2">
                      <button onClick={() => handleDeleteConversation(activeId)} disabled={!!deletingId}
                        className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold">
                        {deletingId ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "احذف"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-1.5 rounded-lg bg-white/10 text-white/50 text-xs">
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(activeId)}
                      className="flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 w-full text-right transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف المحادثة
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-black/40 border-b border-white/5">
              <div className="px-4 py-2 flex gap-2 items-center">
                <Input
                  value={searchInConv}
                  onChange={(e) => setSearchInConv(e.target.value)}
                  placeholder="بحث في المحادثة..."
                  className="flex-1 bg-white/5 border-white/10 h-9 rounded-lg text-sm"
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <span className="text-[11px] text-white/50">
                    {currentSearchIdx + 1}/{searchResults.length}
                  </span>
                )}
                <button onClick={() => { setShowSearch(false); setSearchInConv(""); }}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Typing indicator */}
        {typingIndicator && (
          <div className="px-4 py-1 text-[11px] text-primary/60">
            {otherParticipant?.name} يكتب الآن...
          </div>
        )}

        {/* Reply bar */}
        <AnimatePresence>
          {replyingTo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-2">
              <Reply className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-primary font-bold">{replyingTo.senderName}</p>
                <p className="text-[11px] text-white/60 truncate">{replyingTo.content}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-3 h-3 text-white/50" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div ref={messagesContainerRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative">
          {loadingMessages ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {firestoreMessages.map((msg, idx) => {
                const isMe = msg.senderId === user.id;
                const isSearchMatch = searchInConv && searchResults.includes(idx);
                const sender = null;
                return (
                  <motion.div
                    key={msg.id}
                    ref={el => { messageRefs.current[idx] = el; }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-1.5 ${isMe ? "justify-start" : "justify-end"}`}
                  >
                    {/* Avatar placeholder for other person */}
                    {!isMe && (
                      <Avatar className="w-7 h-7 border border-white/10 shrink-0 mb-1">
                        <AvatarFallback className="bg-primary/20 text-[10px] font-bold">؟</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                          msgId: msg.id, content: msg.content, x: e.clientX, y: e.clientY, isMe,
                          replyTo: msg.replyTo, imageUrl: msg.imageUrl,
                        });
                      }}
                      className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed cursor-pointer select-text relative
                        ${isSearchMatch ? "ring-2 ring-yellow-400/60" : ""}
                        ${isMe
                          ? "bg-primary text-white rounded-br-sm shadow-[0_0_12px_rgba(168,85,247,0.3)]"
                          : "bg-white/10 text-white rounded-bl-sm border border-white/5"
                        }`}
                    >
                      {/* Reply quote */}
                      {msg.replyTo && (
                        <div className={`mb-2 px-2 py-1 rounded-lg text-[11px] border-l-2 ${isMe ? "bg-white/10 border-white/40" : "bg-white/5 border-primary/50"}`}>
                          <p className="font-bold text-[10px] opacity-70">{msg.replyTo.senderName}</p>
                          <p className="truncate">{msg.replyTo.content}</p>
                        </div>
                      )}
                      {/* Image */}
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="صورة"
                          className="rounded-lg max-w-full mb-1 cursor-zoom-in"
                          onClick={() => setShowImageModal(msg.imageUrl ?? null)}
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      {/* Text */}
                      {msg.content && <p className="whitespace-pre-line">{msg.content}</p>}
                      {/* Footer: time + read receipt */}
                      <div className="flex items-center gap-1 mt-1">
                        <p className={`text-[9px] ${isMe ? "text-white/60" : "text-white/40"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {isMe && <Check className="w-3 h-3 text-white/40" />}
                      </div>
                    </div>
                    {/* Avatar — shown for MY messages on the LEFT */}
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

          {/* Scroll to bottom */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg z-10"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 200) }}
          >
            <button onClick={() => handleReply({ id: contextMenu.msgId, content: contextMenu.content, sender: { name: contextMenu.isMe ? "أنا" : otherParticipant?.name || "مستخدم" } })}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 w-full text-right">
              <Reply className="w-4 h-4" />
              رد
            </button>
            {contextMenu.content && (
              <button onClick={() => handleCopyText(contextMenu.content)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 w-full text-right">
                <Copy className="w-4 h-4" />
                نسخ النص
              </button>
            )}
            <button onClick={() => handleForward({ id: contextMenu.msgId, content: contextMenu.content, imageUrl: contextMenu.imageUrl })}      
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 w-full text-right">
              <Share2 className="w-4 h-4" />
              إعادة توجيه
            </button>
            {contextMenu.isMe && (
              <button onClick={() => handleDeleteMessage(contextMenu.msgId)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 w-full text-right">
                <Trash2 className="w-4 h-4" />
                حذف
              </button>
            )}
          </div>
        )}

        {/* Image modal */}
        {showImageModal && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setShowImageModal(null)}>
            <img src={showImageModal} className="max-w-[90%] max-h-[80%] rounded-xl" alt="" />
            <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Block banner */}
        {blockStatus?.blocked && (
          <div className={`px-4 py-2.5 text-center text-xs border-b border-white/5 ${blockStatus.iBlockedThem ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"}`}>
            {blockStatus.iBlockedThem
              ? "🚫 لقد حظرت هذا المستخدم — لا يمكنكما التراسل"
              : "⚠️ هذا المستخدم حظرك — لا يمكنكما التراسل"}
          </div>
        )}

        {/* Input area */}
        <div className="px-4 pb-6 pt-2 bg-black/60 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={handleSend} className="flex gap-2 items-center">
            <button type="button"
              disabled={!!blockStatus?.blocked}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (file) await handleSendImage(file);
                };
                input.click();
              }}
              className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0 disabled:opacity-30"
            >
              <ImageIcon className="w-4 h-4 text-white/60" />
            </button>
            <Input
              value={message}
              onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
              placeholder={blockStatus?.blocked ? "لا يمكنك الإرسال..." : "اكتب رسالة..."}
              className="flex-1 bg-white/5 border-white/10 focus-visible:border-primary/50 h-11 rounded-xl text-sm"
              disabled={sending || !!blockStatus?.blocked}
            />
            <button type="button" onClick={scrollUp} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <ChevronUp className="w-4 h-4 text-white/60" />
            </button>
            <button type="button" onClick={scrollDown} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
              <ChevronDown className="w-4 h-4 text-white/60" />
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="submit"
              disabled={!message.trim() || sending}
              className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.5)] disabled:opacity-40 shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </motion.button>
          </form>
        </div>

        {/* ── ديالوج التبليغ ── */}
        <AnimatePresence>
          {reportDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center"
              onClick={() => setReportDialog(false)}
            >
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="w-full max-w-lg bg-[#0f0f1a] border border-orange-500/30 rounded-t-3xl p-6 space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Flag className="w-5 h-5 text-orange-400" />
                  <h3 className="text-white font-bold text-base">تبليغ عن {otherParticipant?.name}</h3>
                </div>
                <p className="text-white/50 text-xs">سيصل البلاغ لفريق Gaytak وسيتم مراجعته في أقرب وقت</p>

                {/* أسباب جاهزة */}
                <div className="grid grid-cols-2 gap-2">
                  {["محتوى مسيء", "احتيال أو نصب", "مضايقة", "محتوى مزيف", "بريد مزعج", "سبب آخر"].map(r => (
                    <button
                      key={r}
                      onClick={() => setReportReason(r)}
                      className={`px-3 py-2 rounded-xl text-xs text-right transition-all border
                        ${reportReason === r
                          ? "bg-orange-500/20 border-orange-500/50 text-orange-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="أو اكتب السبب بنفسك..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-orange-500/40"
                  rows={2}
                  dir="rtl"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setReportDialog(false)}
                    className="flex-1 py-3 rounded-xl bg-white/5 text-white/50 text-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={!reportReason.trim() || reportSending}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {reportSending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإرسال...</>
                      : <><Flag className="w-4 h-4" /> إرسال البلاغ</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Conversations list ───────────────────────────
  return (
    <AppLayout>
      <div className="flex flex-col">
        <div className="sticky top-0 z-30 px-5 pt-12 pb-4 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-xl font-black text-white">المحادثات</h1>
          </div>
          <div className="mt-3 space-y-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في المحادثات..."
              className="bg-white/5 border-white/10 h-10 rounded-xl text-sm"
            />
            {(() => {
              const supportConv = conversations?.find((c: any) =>
                c.participants?.some((p: any) => p.role === "admin")
              );
              const supportUnread = supportConv?.unreadCount && supportConv?.unreadCount > 0 && supportConv?.lastMessage?.senderId !== user?.id;
              return (
                <Link href="/support">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${supportUnread ? "bg-green-500/20 border-green-500/40 shadow-[0_0_12px_rgba(34,197,94,0.2)]" : "bg-green-500/10 border-green-500/20"}`}>
                    <div className="relative">
                      <Headphones className={`w-4 h-4 ${supportUnread ? "text-green-300" : "text-green-400"}`} />
                      {supportUnread && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                      )}
                    </div>
                    <span className={`text-xs font-medium ${supportUnread ? "text-green-200" : "text-green-300"}`}>الدعم — تواصل مع فريق Gaytak</span>
                    <span className="flex items-center gap-1.5 mr-auto">
                      {supportUnread && (
                        <span className="px-1.5 py-0.5 rounded-full bg-green-500 text-[9px] text-white font-bold min-w-[18px] text-center">
                          {supportConv.unreadCount}
                        </span>
                      )}
                      <span className={`text-[10px] ${supportUnread ? "text-green-300" : "text-green-400/50"}`}>→</span>
                    </span>
                  </div>
                </Link>
              );
            })()}
          </div>
        </div>

        <div className="px-4 py-3">
          {loadingConversations ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !filteredConversations?.length ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">💬</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد محادثات</h3>
              <p className="text-sm text-muted-foreground">تواصل مع البائعين من صفحات المنتجات</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conv: any) => {
                const other = conv.participants?.find((p: any) => p.id !== user.id);
                const isActive = conv.id === activeId;
                const hasUnread = conv.unreadCount && conv.unreadCount > 0 && conv.lastMessage?.senderId !== user.id;
                const isConfirming = confirmDeleteId === conv.id;
                const isDeleting = deletingId === conv.id;

                return (
                  <motion.div key={conv.id} layout
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-colors ${isActive ? "bg-primary/15 border border-primary/30" : "bg-white/3"}`}>
                    <div className="cursor-pointer shrink-0"
                      onClick={() => { setConfirmDeleteId(null); setLocation(`/chat/${conv.id}`); }}>
                      <Avatar className={`w-12 h-12 border-2 ${hasUnread ? "border-primary shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "border-white/10"}`}>
                        <AvatarImage src={other?.avatar} />
                        <AvatarFallback className="bg-primary/20 font-bold">{other?.name?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => { setConfirmDeleteId(null); setLocation(`/chat/${conv.id}`); }}>
                      <div className="flex items-baseline justify-between">
                        <span className={`font-bold text-sm flex items-center gap-1 ${hasUnread ? "text-white" : "text-white/80"}`}>
                          {other?.name || "مجهول"}
                          {other?.role === "admin" && <VerifiedBadge size="xs" />}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${hasUnread ? "text-white font-medium" : "text-muted-foreground"}`}>
                        {conv.lastMessage?.imageUrl ? "🖼️ صورة" : (conv.lastMessage?.content || "ابدأ المحادثة")}
                      </p>
                    </div>
                    {isConfirming ? (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => handleDeleteConversation(conv.id)} disabled={isDeleting}
                          className="px-3 py-1 rounded-xl bg-red-500 text-white text-[11px] font-bold">
                          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "احذف"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-xl bg-white/10 text-white/50 text-[11px]">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        {hasUnread && (
                          <div className="px-1.5 py-0.5 rounded-full bg-primary text-[9px] text-white font-bold min-w-[18px] text-center">
                            {conv.unreadCount}
                          </div>
                        )}
                        <button onClick={() => setConfirmDeleteId(conv.id)}
                          className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
