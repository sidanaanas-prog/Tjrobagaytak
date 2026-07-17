import { useGetAdminStats, useGetAdminActivity, useListProducts, useApproveProduct, getGetAdminStatsQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Box, MessageSquare, AlertCircle, CheckCircle2, XCircle, ShoppingBag, TrendingUp, DollarSign, Clock, Truck, Package, Car, MapPin, Navigation, CreditCard, Gift, Phone, Copy, Search, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import { Loader2 } from "lucide-react";

const BASE = getApiUrl("");

function BulkFreeButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = async () => {
    if (!confirm("هل أنت متأكد من تفعيل الوضع المجاني لجميع البائعين والسائقين؟")) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("glow_admin_token");
      const res = await fetch(`${BASE}/api/admin/bulk/free-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ free: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "فشل");
      toast({ title: "✅ تم التفعيل", description: data.message });
    } catch (e: any) {
      toast({ variant: "destructive", title: "خطأ", description: e.message });
    } finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
      تفعيل مجاني للجميع
    </button>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: activity, isLoading: activityLoading } = useGetAdminActivity();
  const { data: pendingProductsData, isLoading: pendingLoading } = useListProducts(
    { status: "pending", limit: 5 },
    { query: { queryKey: getListProductsQueryKey({ status: "pending", limit: 5 }) } }
  );

  const { toast } = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [commTab, setCommTab] = useState<"debtors" | "free">("debtors");
  const [showCommDetails, setShowCommDetails] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  const loadDrivers = useCallback(async () => {
    setDriversLoading(true);
    try {
      const token = localStorage.getItem("glow_admin_token");
      const res = await fetch(`${BASE}/api/admin/drivers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDrivers(await res.json());
      }
    } catch (e) {
      console.error("Error loading drivers:", e);
    } finally {
      setDriversLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const handleCopyPhone = (phone: string) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    toast({
      title: "تم نسخ الرقم! 📋",
      description: `تم نسخ رقم الهاتف ${phone} إلى الحافظة.`,
    });
  };

  const getDaysLeft = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const getWhatsAppLink = (phone: string | null) => {
    if (!phone) return "#";
    const cleanPhone = phone.replace(/[+\s-]/g, "");
    return `https://wa.me/${cleanPhone}`;
  };

  const queryClient = useQueryClient();
  const approveMutation = useApproveProduct();

  const handleApprove = async (id: string, status: "active" | "rejected") => {
    await approveMutation.mutateAsync({ id, data: { status } });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ status: "pending", limit: 5 }) });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
  };

  // حالة التحميل الأولى — سكيليتون لمعارض فورية
  const isInitialLoading = statsLoading && !stats;

  // Dummy chart data
  const chartData = [
    { name: "Mon", users: Math.max(0, (stats?.totalUsers || 0) - 20) },
    { name: "Tue", users: Math.max(0, (stats?.totalUsers || 0) - 15) },
    { name: "Wed", users: Math.max(0, (stats?.totalUsers || 0) - 10) },
    { name: "Thu", users: Math.max(0, (stats?.totalUsers || 0) - 5) },
    { name: "Fri", users: stats?.totalUsers || 0 },
    { name: "Today", users: (stats?.totalUsers || 0) + (stats?.newUsersToday || 0) },
  ];

  const StatSkeleton = () => (
    <div className="bg-card border border-white/5 rounded-lg p-4 space-y-2">
      <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
      <div className="h-8 w-16 bg-white/5 animate-pulse rounded" />
      <div className="h-2 w-12 bg-white/5 animate-pulse rounded" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">System Overview</h1>
          <p className="text-muted-foreground font-mono text-sm">PLATFORM METRICS AND PENDING ACTIONS</p>
        </div>
        <div className="flex items-center gap-3">
          <BulkFreeButton />
          <div className="text-right">
            <p className="font-mono text-xs text-primary/60">SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span></p>
            <p className="font-mono text-xs text-muted-foreground">{format(new Date(), "yyyy-MM-dd HH:mm:ss")}</p>
          </div>
        </div>
      </div>

      {/* ── قسم الطلبات الرئيسي (أولوية قصوى) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-mono font-bold text-white tracking-wider">إحصائيات الطلبات و المبيعات</h2>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* الطلبات الرئيسية */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <Card className="bg-card border-blue-500/30 shadow-[0_0_15px_rgba(0,150,255,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-mono font-medium text-blue-400">إجمالي الطلبات</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold text-white">{stats?.totalOrders || 0}</div>
                  <p className="text-xs text-blue-400/70 font-mono mt-1">+{stats?.ordersToday || 0} اليوم</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-green-500/30 shadow-[0_0_15px_rgba(0,255,0,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-mono font-medium text-green-400">إجمالي المبيعات</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold text-white">${(stats?.totalRevenue || 0).toFixed(0)}</div>
                  <p className="text-xs text-green-400/70 font-mono mt-1">+${(stats?.revenueToday || 0).toFixed(0)} اليوم</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-purple-500/30 shadow-[0_0_15px_rgba(150,0,255,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-mono font-medium text-purple-400">عدد البائعين</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold text-white">{stats?.totalSellers || 0}</div>
                  <p className="text-xs text-purple-400/70 font-mono mt-1">صنعو مبيعات</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-orange-500/30 shadow-[0_0_15px_rgba(255,150,0,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-mono font-medium text-orange-400">عدد المشترين</CardTitle>
                  <Users className="h-4 w-4 text-orange-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold text-white">{stats?.totalBuyers || 0}</div>
                  <p className="text-xs text-orange-400/70 font-mono mt-1">شارو في الشراء</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-yellow-500/30 shadow-[0_0_15px_rgba(255,200,0,0.05)]">
                <CardHeader className="flex flex-row items-center justify-between pb-1">
                  <CardTitle className="text-xs font-mono font-medium text-yellow-400">متوسط قيمة الطلب</CardTitle>
                  <DollarSign className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold text-white">
                    ${stats?.totalOrders ? (stats.totalRevenue / stats.totalOrders).toFixed(0) : 0}
                  </div>
                  <p className="text-xs text-yellow-400/70 font-mono mt-1">لكل طلب واحد</p>
                </CardContent>
              </Card>
            </div>

            {/* حالات الطلبات */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "قيد المراجعة", value: stats?.ordersPending || 0, color: "text-yellow-400", border: "border-yellow-500/30", icon: Clock },
                { label: "تم التأكيد", value: stats?.ordersConfirmed || 0, color: "text-blue-400", border: "border-blue-500/30", icon: CheckCircle2 },
                { label: "تم الشحن", value: stats?.ordersShipped || 0, color: "text-purple-400", border: "border-purple-500/30", icon: Truck },
                { label: "تم التسليم", value: stats?.ordersDelivered || 0, color: "text-green-400", border: "border-green-500/30", icon: Package },
                { label: "ملغي", value: stats?.ordersCancelled || 0, color: "text-red-400", border: "border-red-500/30", icon: XCircle },
              ].map((s) => (
                <Card key={s.label} className={`bg-card border ${s.border} shadow-[0_0_10px_rgba(0,0,0,0.1)]`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-1">
                    <CardTitle className="text-xs font-mono font-medium text-muted-foreground">{s.label}</CardTitle>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</div>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {stats?.totalOrders ? ((s.value / stats.totalOrders) * 100).toFixed(0) : 0}%
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── الإحصائيات العامة ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">TOTAL USERS</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-primary/70 font-mono mt-1">+{stats?.newUsersToday || 0} TODAY</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">ACTIVE PRODUCTS</CardTitle>
            <Box className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">{stats?.activeProducts || 0}</div>
            <p className="text-xs text-primary/70 font-mono mt-1">+{stats?.newProductsToday || 0} TODAY</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-destructive/30 shadow-[0_0_15px_rgba(255,0,0,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-destructive">PENDING APPROVALS</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-destructive">{stats?.pendingProducts || 0}</div>
            <p className="text-xs text-destructive/70 font-mono mt-1">REQUIRES ATTENTION</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">TOTAL MESSAGES</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">{stats?.totalMessages || 0}</div>
            <p className="text-xs text-primary/70 font-mono mt-1">ACROSS {stats?.totalConversations || 0} CHATS</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-amber-500/30 shadow-[0_0_15px_rgba(255,180,0,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-amber-400">FREE SELLERS</CardTitle>
            <Gift className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-amber-400">{(stats as any)?.freeSellers || 0}</div>
            <p className="text-xs text-amber-400/70 font-mono mt-1">FREE SELLER SUBSCRIPTIONS</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Users & Notifications */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.12)] relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-emerald-400">متصلون الآن</CardTitle>
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold text-emerald-400">{(stats as any)?.activeNow ?? 0}</div>
            <p className="text-xs text-emerald-400/70 font-mono mt-1">آخر 3 دقائق • مباشر</p>
          </CardContent>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
        </Card>

        <Card className="bg-card border-green-500/30 shadow-[0_0_15px_rgba(0,255,0,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-green-400">ناشطون اليوم</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-green-400">{(stats as any)?.activeToday || 0}</div>
            <p className="text-xs text-green-400/70 font-mono mt-1">آخر 24 ساعة</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-primary/20 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">ناشطون هذا الأسبوع</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-foreground">{(stats as any)?.activeWeek || 0}</div>
            <p className="text-xs text-primary/70 font-mono mt-1">آخر 7 أيام</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-yellow-500/30 shadow-[0_0_15px_rgba(255,200,0,0.05)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-mono font-medium text-yellow-400">مسجّلون للإشعارات</CardTitle>
            <div className="h-4 w-4 text-yellow-400">📲</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-yellow-400">{(stats as any)?.usersWithToken || 0}</div>
            <p className="text-xs text-yellow-400/70 font-mono mt-1">لديهم FCM Token</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Products */}
        <Card className="col-span-1 lg:col-span-2 border-destructive/30 bg-card">
          <CardHeader className="border-b border-border/50 bg-destructive/5">
            <CardTitle className="font-mono text-destructive flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              ACTION REQUIRED: PENDING PRODUCTS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendingLoading && !pendingProductsData ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-white/5 animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
                      <div className="h-2 w-20 bg-white/5 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingProductsData?.products && pendingProductsData.products.length > 0 ? (
              <div className="divide-y divide-border/50">
                {pendingProductsData.products.map(product => (
                  <div key={product.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {product.images && product.images[0] ? (
                        <div className="w-12 h-12 rounded bg-muted overflow-hidden border border-border">
                          <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted border border-border flex items-center justify-center">
                          <Box className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-foreground">{product.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase text-primary border-primary/30">
                            ${product.price}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            BY {product.seller?.name || "UNKNOWN"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleApprove(product.id, "rejected")}
                        disabled={approveMutation.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        REJECT
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-8 bg-primary text-black hover:bg-primary/90"
                        onClick={() => handleApprove(product.id, "active")}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        APPROVE
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                NO PENDING APPROVALS
              </div>
            )}
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card className="col-span-1 border-primary/20 bg-card">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="font-mono text-primary text-base">USER GROWTH</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--primary) / 0.3)" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2} 
                    dot={{ fill: "hsl(var(--background))", stroke: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── إحصائيات الكورسا والسائقين ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-mono font-bold text-white tracking-wider">إحصائيات الكورسا والسائقين</h2>
          </div>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* مربع كبير فيه أرباح عمولة تطبيق من تاكسي */}
            <Card className="col-span-2 md:col-span-4 lg:col-span-6 bg-gradient-to-br from-emerald-950/40 to-slate-900 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden p-6">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <DollarSign className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    أرباح عمولة التطبيق من التاكسي (Taxi Commissions)
                  </h3>
                  <p className="text-xs text-muted-foreground">مجموع المبالغ المقتطعة من السائقين كعمولة عن الرحلات المكتملة</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white font-mono tracking-tight">
                    {((stats as any)?.totalTaxiCommission || 0).toLocaleString()} ألف دورو
                  </span>
                  <span className="text-xs text-emerald-400 font-bold font-mono">
                    +{((stats as any)?.taxiCommissionToday || 0).toLocaleString()} ألف دورو اليوم
                  </span>
                </div>
              </div>
            </Card>

            {/* تفاصيل عمولات السائقين ومستحقاتهم */}
            <Card className="col-span-2 md:col-span-4 lg:col-span-6 bg-slate-950/40 border border-slate-800 p-5 rounded-2xl space-y-4" dir="rtl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/5">
                <div className="space-y-1 text-right">
                  <h3 className="text-base font-bold text-white flex items-center gap-2 justify-start">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    المتابعة الذكية لعمولات السائقين ومستحقاتهم
                  </h3>
                  <p className="text-xs text-muted-foreground">تتبع السائقين المطالبين بدفع العمولة، ومن لديهم رحلات مجانية أو اشتراكات نشطة للاتصال بهم بسهولة.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <button
                    onClick={() => setCommTab("debtors")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      commTab === "debtors"
                        ? "bg-red-500/20 border border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]"
                        : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    جاهزون للدفع / رصيد سالب ({drivers.filter(d => d.walletBalance < 0).length})
                  </button>
                  <button
                    onClick={() => setCommTab("free")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      commTab === "free"
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                        : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    السائقون في الوضع المجاني / تجريبي / نشط ({
                      drivers.filter(d => 
                        d.isFree || 
                        d.freeRidesLeft > 0 || 
                        (d.trialExpiresAt && new Date(d.trialExpiresAt) > new Date()) || 
                        (d.isSubscribed && d.subscriptionExpiresAt && new Date(d.subscriptionExpiresAt) > new Date())
                      ).length
                    })
                  </button>
                </div>
              </div>

              {/* البحث و التصفية */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full max-w-md mr-auto" dir="rtl">
                <Search className="w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="ابحث عن سائق باسمه أو رقم هاتفه..."
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  className="bg-transparent border-none text-xs text-white focus:outline-none w-full text-right"
                />
              </div>

              {driversLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-white/60 text-xs font-bold">
                        <th className="p-3">السائق</th>
                        <th className="p-3">الهاتف</th>
                        <th className="p-3 text-center">حالة الحساب / الرصيد</th>
                        <th className="p-3 text-center">الرحلات المكتملة</th>
                        <th className="p-3 text-center">التفاصيل الذكية</th>
                        <th className="p-3 text-center">تواصل سريع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commTab === "debtors" ? (
                        (() => {
                          const list = drivers.filter(d => d.walletBalance < 0).filter(d => 
                            d.name.toLowerCase().includes(driverSearch.toLowerCase()) || 
                            (d.phone && d.phone.includes(driverSearch))
                          );
                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                                  لا يوجد سائقون رصيدهم سالب ومطالبون بالدفع حالياً! 👍
                                </td>
                              </tr>
                            );
                          }
                          return list.map((d) => (
                            <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02] text-xs">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-white border border-white/10 overflow-hidden">
                                    {d.avatar ? <img src={d.avatar} className="w-full h-full object-cover" /> : d.name[0]}
                                  </div>
                                  <div>
                                    <p className="font-bold text-white">{d.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{d.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 font-mono text-white/80">{d.phone || "غير متوفر"}</td>
                              <td className="p-3 text-center font-bold text-red-400 font-mono" dir="ltr">
                                {d.walletBalance.toLocaleString()} ألف دورو ⚠️
                              </td>
                              <td className="p-3 text-center font-mono text-white/70">{d.totalRides || 0}</td>
                              <td className="p-3 text-center">
                                <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  رصيد مكشوف - مطالب بالسداد فوراً 💸
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-2">
                                  {d.phone && (
                                    <>
                                      <a
                                        href={`tel:${d.phone}`}
                                        className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors"
                                        title="اتصال هاتفي"
                                      >
                                        <Phone className="w-3.5 h-3.5" />
                                      </a>
                                      <a
                                        href={getWhatsAppLink(d.phone)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                        title="مراسلة واتساب"
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                      </a>
                                      <button
                                        onClick={() => handleCopyPhone(d.phone)}
                                        className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                                        title="نسخ رقم الهاتف"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ));
                        })()
                      ) : (
                        (() => {
                          const list = drivers.filter(d => 
                            d.isFree || 
                            d.freeRidesLeft > 0 || 
                            (d.trialExpiresAt && new Date(d.trialExpiresAt) > new Date()) || 
                            (d.isSubscribed && d.subscriptionExpiresAt && new Date(d.subscriptionExpiresAt) > new Date())
                          ).filter(d => 
                            d.name.toLowerCase().includes(driverSearch.toLowerCase()) || 
                            (d.phone && d.phone.includes(driverSearch))
                          );
                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                                  لا يوجد سائقون بميزات مجانية نشطة حالياً!
                                </td>
                              </tr>
                            );
                          }
                          return list.map((d) => {
                            let benefitText = "";
                            let badgeStyle = "";
                            if (d.isFree) {
                              benefitText = "معفي دائم من العمولات 🛡️";
                              badgeStyle = "bg-purple-500/10 border-purple-500/20 text-purple-400";
                            } else if (d.freeRidesLeft > 0) {
                              benefitText = `متبقي ${d.freeRidesLeft} رحلة مجانية 🎁`;
                              badgeStyle = "bg-amber-500/10 border-amber-500/20 text-amber-400";
                            } else if (d.trialExpiresAt && new Date(d.trialExpiresAt) > new Date()) {
                              benefitText = `تجربة نشطة (ينتهي في خلال ${getDaysLeft(d.trialExpiresAt)} يوم) ⏳`;
                              badgeStyle = "bg-blue-500/10 border-blue-500/20 text-blue-400";
                            } else if (d.isSubscribed && d.subscriptionExpiresAt && new Date(d.subscriptionExpiresAt) > new Date()) {
                              benefitText = `اشتراك شهري نشط (ينتهي في خلال ${getDaysLeft(d.subscriptionExpiresAt)} يوم) 📅`;
                              badgeStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
                            } else {
                              benefitText = "لا توجد ميزات نشطة";
                              badgeStyle = "bg-white/5 border border-white/10 text-white/50";
                            }

                            return (
                              <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02] text-xs">
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-bold text-white border border-white/10 overflow-hidden">
                                      {d.avatar ? <img src={d.avatar} className="w-full h-full object-cover" /> : d.name[0]}
                                    </div>
                                    <div>
                                      <p className="font-bold text-white">{d.name}</p>
                                      <p className="text-[10px] text-muted-foreground">{d.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 font-mono text-white/80">{d.phone || "غير متوفر"}</td>
                                <td className="p-3 text-center font-bold text-emerald-400 font-mono" dir="ltr">
                                  {d.walletBalance >= 0 ? `+${d.walletBalance.toLocaleString()}` : d.walletBalance.toLocaleString()} د.أ
                                </td>
                                <td className="p-3 text-center font-mono text-white/70">{d.totalRides || 0}</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeStyle}`}>
                                    {benefitText}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-2">
                                    {d.phone && (
                                      <>
                                        <a
                                          href={`tel:${d.phone}`}
                                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors"
                                          title="اتصال هاتفي"
                                        >
                                          <Phone className="w-3.5 h-3.5" />
                                        </a>
                                        <a
                                          href={getWhatsAppLink(d.phone)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                          title="مراسلة واتساب"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5" />
                                        </a>
                                        <button
                                          onClick={() => handleCopyPhone(d.phone)}
                                          className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors"
                                          title="نسخ رقم الهاتف"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* الرحلات */}
            <Card className="bg-card border-primary/30 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-primary">إجمالي الرحلات</CardTitle>
                <Car className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-white">{(stats as any)?.totalRides || 0}</div>
                <p className="text-xs text-primary/70 font-mono mt-1">+{(stats as any)?.ridesToday || 0} اليوم</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-yellow-500/30 shadow-[0_0_15px_rgba(255,200,0,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-yellow-400">رحلات قيد الانتظار</CardTitle>
                <Clock className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-yellow-400">{(stats as any)?.ridesPending || 0}</div>
                <p className="text-xs text-yellow-400/70 font-mono mt-1">بانتظار سائق</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-green-500/30 shadow-[0_0_15px_rgba(0,255,0,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-green-400">رحلات مكتملة</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-green-400">{(stats as any)?.ridesCompleted || 0}</div>
                <p className="text-xs text-green-400/70 font-mono mt-1">تمت بنجاح</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-emerald-400">إيرادات النقل</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-emerald-400">{((stats as any)?.totalRideRevenue || 0).toFixed(0)} ألف دورو</div>
                <p className="text-xs text-emerald-400/70 font-mono mt-1">+{((stats as any)?.rideRevenueToday || 0).toFixed(0)} ألف دورو اليوم</p>
              </CardContent>
            </Card>

            {/* السائقين */}
            <Card className="bg-card border-blue-500/30 shadow-[0_0_15px_rgba(0,150,255,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-blue-400">عدد السائقين</CardTitle>
                <Navigation className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-white">{(stats as any)?.totalDrivers || 0}</div>
                <p className="text-xs text-blue-400/70 font-mono mt-1">{(stats as any)?.activeDrivers || 0} متصل</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-purple-500/30 shadow-[0_0_15px_rgba(150,0,255,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-purple-400">مشتركين السائقين</CardTitle>
                <CreditCard className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-purple-400">{(stats as any)?.subscribedDrivers || 0}</div>
                <p className="text-xs text-purple-400/70 font-mono mt-1">من {(stats as any)?.totalDrivers || 0} سائق</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-amber-500/30 shadow-[0_0_15px_rgba(255,180,0,0.05)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-xs font-mono font-medium text-amber-400">سائقون مجانيون</CardTitle>
                <Gift className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-mono font-bold text-amber-400">{(stats as any)?.freeDrivers || 0}</div>
                <p className="text-xs text-amber-400/70 font-mono mt-1">من {(stats as any)?.totalDrivers || 0} سائق</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="font-mono text-primary text-base">RECENT SYSTEM ACTIVITY</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {activity?.slice(0, 5).map((item) => (
              <div key={item.id} className="p-4 flex flex-col gap-1 hover:bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-foreground">{item.description}</span>
                  <span className="font-mono text-xs text-muted-foreground">{format(new Date(item.createdAt), "MMM d, HH:mm")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/30 text-primary">
                    {item.type.replace('_', ' ')}
                  </Badge>
                  {item.userName && (
                    <span className="text-xs text-muted-foreground font-mono">
                      USER: {item.userName}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(!activity || activity.length === 0) && (
              <div className="p-4 text-center text-muted-foreground font-mono text-sm">
                NO RECENT ACTIVITY
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
