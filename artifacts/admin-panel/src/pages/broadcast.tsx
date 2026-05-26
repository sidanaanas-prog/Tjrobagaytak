import { useState, useEffect, useCallback } from "react";
import { Megaphone, Send, Loader2, CheckCircle, Users, Eye, EyeOff, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface BroadcastResult { broadcastId: string; sent: number; failed: number; total: number; }
interface BroadcastRecord { id: string; message: string; recipientCount: number; readCount: number; createdAt: string; }
interface Reader { id: string; name: string; avatar: string | null; phone: string | null; isRead: boolean; }

export default function BroadcastPage() {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readers, setReaders] = useState<Record<string, Reader[]>>({});
  const [loadingReaders, setLoadingReaders] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("glow_admin_token") : "";

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/broadcasts", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch {} finally { setLoadingHistory(false); }
  }, [token]);

  useEffect(() => {
    fetchHistory();
    const iv = setInterval(fetchHistory, 15000);
    return () => clearInterval(iv);
  }, [fetchHistory]);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (readers[id]) return;
    setLoadingReaders(id);
    try {
      const res = await fetch(`/api/admin/broadcasts/${id}/readers`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setReaders(prev => ({ ...prev, [id]: data })); }
    } catch {} finally { setLoadingReaders(null); }
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "فشل الإرسال"); }
      const data: BroadcastResult = await res.json();
      setResult(data);
      setMessage("");
      toast({ title: "تم الإرسال", description: `وصلت الرسالة لـ ${data.sent} مستخدم` });
      setTimeout(fetchHistory, 1000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message ?? "تعذر إرسال الرسالة" });
    } finally { setSending(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-wide">BROADCAST</h1>
          <p className="text-sm text-muted-foreground">إرسال رسالة جماعية + تتبع من شاهدها</p>
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2 pb-4 border-b border-border">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-mono">ستصل الرسالة كمحادثة مباشرة + إشعار Firebase لكل مستخدم</span>
        </div>
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-mono text-muted-foreground uppercase tracking-wide">نص الرسالة</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={5}
              className="w-full rounded-lg bg-muted border border-border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 text-right"
              dir="rtl"
              disabled={sending}
            />
            <div className="flex justify-between text-xs text-muted-foreground/60 font-mono">
              <span>{message.length} حرف</span>
              <span>الحد الأقصى: 1000 حرف</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={!message.trim() || sending || message.length > 1000}
            className="w-full h-11 rounded-lg bg-primary text-white font-mono font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ الإرسال...</> : <><Send className="w-4 h-4" />إرسال للجميع</>}
          </button>
        </form>
      </div>

      {/* Last result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="font-bold font-mono text-green-400">تم الإرسال بنجاح</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-background/50 p-3">
                <p className="text-2xl font-bold font-mono text-green-400">{result.sent}</p>
                <p className="text-xs text-muted-foreground mt-1">تم الإرسال</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3">
                <p className="text-2xl font-bold font-mono text-destructive">{result.failed}</p>
                <p className="text-xs text-muted-foreground mt-1">فشل</p>
              </div>
              <div className="rounded-lg bg-background/50 p-3">
                <p className="text-2xl font-bold font-mono">{result.total}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي المستخدمين</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4" /> سجل الرسائل الجماعية
          </h2>
          <button onClick={fetchHistory} className="text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm font-mono">
            لا توجد رسائل جماعية بعد
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((b) => {
              const readPct = b.recipientCount > 0 ? Math.round((b.readCount / b.recipientCount) * 100) : 0;
              const isExpanded = expandedId === b.id;
              return (
                <div key={b.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="w-full p-4 flex items-start gap-4 text-right hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2 text-right" dir="rtl">{b.message}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true, locale: ar })}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <Users className="w-3 h-3" /> {b.recipientCount} مستلم
                        </span>
                        <span className={`text-xs font-mono font-bold flex items-center gap-1 ${b.readCount > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                          <Eye className="w-3 h-3" /> {b.readCount} شاهد ({readPct}%)
                        </span>
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> {b.recipientCount - b.readCount} لم يشاهد
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-500"
                          style={{ width: `${readPct}%` }}
                        />
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-border overflow-hidden"
                      >
                        <div className="p-4 space-y-3">
                          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <Eye className="w-3 h-3" /> من شاهد الرسالة
                          </p>
                          {loadingReaders === b.id ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                          ) : !readers[b.id] || readers[b.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 font-mono">لا أحد شاهد الرسالة بعد</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {readers[b.id].filter(r => r.isRead).map((r) => (
                                <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                  <Avatar className="w-7 h-7 shrink-0">
                                    <AvatarImage src={r.avatar ?? undefined} />
                                    <AvatarFallback className="text-[10px] bg-green-500/20 text-green-400">{r.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate">{r.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{r.phone ?? ""}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
