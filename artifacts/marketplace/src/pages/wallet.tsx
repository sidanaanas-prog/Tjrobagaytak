import { useState, useEffect, useCallback } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { motion } from "framer-motion";
import {
  Wallet, ArrowLeft, Plus, Minus, ArrowUpRight, ArrowDownRight,
  Car, Gift, AlertTriangle, Loader2, CreditCard,
} from "lucide-react";

const BASE = getApiUrl("");

type Transaction = {
  id: string;
  type: string;
  amount: string;
  description: string;
  createdAt: string;
  status: string;
};

type WalletData = {
  id: string;
  balance: string;
  currency: string;
  transactions: Transaction[];
};

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  const fetchWallet = useCallback(async () => {
    const token = getMemToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/wallet`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWallet(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  async function handleDeposit() {
    if (!depositAmount || Number(depositAmount) <= 0) {
      toast({ variant: "destructive", title: "مبلغ غير صالح" });
      return;
    }
    setActionLoading(true);
    const token = getMemToken();
    try {
      const res = await fetch(`${BASE}/api/wallet/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(depositAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "✅ تم الإيداع!", description: `الرصيد الجديد: ${data.balance} دج` });
        setDepositAmount("");
        setShowDeposit(false);
        fetchWallet();
      } else {
        toast({ variant: "destructive", title: "خطأ", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر الاتصال" });
    }
    setActionLoading(false);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="text-center space-y-4">
          <Wallet className="w-16 h-16 text-muted mx-auto" />
          <p className="text-lg font-bold">سجل الدخول للمحفظة</p>
          <button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold">
            تسجيل الدخول</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">المحفظة</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-5">
          {/* بطاقة الرصيد */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-white shadow-[0_0_40px_rgba(168,85,247,0.3)]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/70 text-sm font-medium">الرصيد المتوفر</p>
              <p className="text-3xl font-black mt-1">
                {wallet ? Number(wallet.balance).toLocaleString("ar-DZ") : "0"} <span className="text-lg font-bold">دج</span>
              </p>
              <div className="flex items-center gap-2 mt-4">
                <CreditCard className="w-5 h-5 text-white/70" />
                <p className="text-xs text-white/60">محفظة Gaytak</p>
              </div>
            </div>
          </motion.div>

          {/* أزرار سريعة */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowDeposit(!showDeposit)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 font-bold text-sm hover:bg-green-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" /> إيداع
            </button>
            <button
              onClick={() => navigate("/rides")}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/15 border border-primary/25 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            >
              <Car className="w-4 h-4" /> كورسا
            </button>
          </div>

          {/* نموذج الإيداع */}
          {showDeposit && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="space-y-3">
              <div className="bg-card border rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold">إيداع رصيد (تجريبي)</p>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="المبلغ بالدينار"
                  className="w-full bg-background border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleDeposit}
                  disabled={actionLoading}
                  className="w-full bg-green-500 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> إيداع الرصيد</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* العمليات */}
          <div>
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-primary" /> عمليات المحفظة
            </h3>
            {!wallet || wallet.transactions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد عمليات بعد</p>
            ) : (
              <div className="space-y-2">
                {wallet.transactions.map((t) => {
                  const isIn = ["deposit", "ride_earning", "refund"].includes(t.type);
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-card border rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIn ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {isIn ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{t.description}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("ar-DZ")}</p>
                      </div>
                      <span className={`text-sm font-black ${isIn ? "text-green-400" : "text-red-400"}`}>
                        {isIn ? "+" : ""}{Number(t.amount).toLocaleString("ar-DZ")} دج
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
