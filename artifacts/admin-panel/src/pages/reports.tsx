import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flag, Clock, CheckCircle, XCircle, MessageSquare, Phone } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  conversationId: string | null;
  createdAt: string;
  reporter: { id: string; name: string; avatar: string | null; phone: string | null };
  reported: { id: string; name: string; avatar: string | null; phone: string | null };
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "قيد الانتظار", color: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10", icon: <Clock className="w-3 h-3" /> },
  reviewed:  { label: "تمت المراجعة", color: "border-green-500/50 text-green-400 bg-green-500/10",   icon: <CheckCircle className="w-3 h-3" /> },
  dismissed: { label: "مرفوض",        color: "border-muted/50 text-muted-foreground bg-muted/10",    icon: <XCircle className="w-3 h-3" /> },
};

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "dismissed">("all");
  const { toast } = useToast();

  const fetchReports = async () => {
    const token = localStorage.getItem("glow_admin_token");
    try {
      const res = await fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setReports(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const token = localStorage.getItem("glow_admin_token");
    const res = await fetch(`/api/admin/reports/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r));
      toast({ title: "✅ تم التحديث" });
    } else {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر التحديث" });
    }
  };

  const filtered = filter === "all" ? reports : reports.filter(r => r.status === filter);
  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase flex items-center gap-3">
          <Flag className="w-7 h-7" />
          التبليغات
          {pendingCount > 0 && (
            <span className="text-sm bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{pendingCount} جديد</span>
          )}
        </h1>
        <p className="text-muted-foreground font-mono text-sm">USER REPORTS — REVIEW & MANAGE</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "pending", "reviewed", "dismissed"] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase transition-all
              ${filter === f ? "bg-primary text-black" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
          >
            {f === "all" ? "الكل" : STATUS_LABELS[f]?.label}
            {f === "pending" && pendingCount > 0 && <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1 rounded-full">{pendingCount}</span>}
          </button>
        ))}
      </div>

      <Card className="border-primary/20 bg-card">
        <CardHeader className="border-b border-border/50 pb-3">
          <p className="font-mono text-xs text-muted-foreground uppercase">{filtered.length} تبليغ</p>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/30">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground font-mono text-sm">LOADING REPORTS...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground font-mono text-sm">NO REPORTS FOUND</div>
          ) : (
            filtered.map(report => {
              const s = STATUS_LABELS[report.status];
              return (
                <div key={report.id} className="p-5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* المُبلَّغ عنه */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase gap-1 ${s.color}`}>
                          {s.icon}{s.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}
                        </span>
                      </div>

                      {/* المُبلِّغ ← المُبلَّغ عنه */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <UserChip user={report.reporter} label="المُبلِّغ" />
                        <span className="text-muted-foreground/40 font-mono text-xs">→</span>
                        <UserChip user={report.reported} label="المُبلَّغ عنه" danger />
                      </div>

                      {/* السبب */}
                      <div className="bg-muted/20 rounded-lg px-4 py-2.5 border border-border/30">
                        <p className="text-xs text-muted-foreground font-mono uppercase mb-1">السبب</p>
                        <p className="text-sm text-foreground">{report.reason}</p>
                      </div>

                      {/* الإجراءات */}
                      {report.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline"
                            className="text-green-400 border-green-500/30 hover:bg-green-500/10 font-mono text-xs gap-1"
                            onClick={() => updateStatus(report.id, "reviewed")}>
                            <CheckCircle className="w-3.5 h-3.5" /> تمت المراجعة
                          </Button>
                          <Button size="sm" variant="outline"
                            className="text-muted-foreground border-muted/30 hover:bg-muted/20 font-mono text-xs gap-1"
                            onClick={() => updateStatus(report.id, "dismissed")}>
                            <XCircle className="w-3.5 h-3.5" /> رفض
                          </Button>
                          {report.conversationId && (
                            <Button size="sm" variant="ghost"
                              className="text-blue-400 hover:bg-blue-500/10 font-mono text-xs gap-1"
                              onClick={() => window.open(`/chat/${report.conversationId}`, "_blank")}>
                              <MessageSquare className="w-3.5 h-3.5" /> عرض المحادثة
                            </Button>
                          )}
                        </div>
                      )}
                      {report.status !== "pending" && (
                        <Button size="sm" variant="ghost"
                          className="text-muted-foreground hover:text-foreground font-mono text-xs"
                          onClick={() => updateStatus(report.id, "pending")}>
                          إعادة فتح
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UserChip({ user, label, danger }: { user: Report["reporter"]; label: string; danger?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${danger ? "border-red-500/30 bg-red-500/5" : "border-primary/20 bg-primary/5"}`}>
      <Avatar className="w-6 h-6">
        <AvatarImage src={user.avatar ?? undefined} />
        <AvatarFallback className="text-[9px] font-bold">{user.name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-[10px] text-muted-foreground font-mono">{label}</p>
        <p className="text-xs font-bold text-foreground">{user.name}</p>
        {user.phone && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Phone className="w-2.5 h-2.5" />{user.phone}
          </p>
        )}
      </div>
    </div>
  );
}
