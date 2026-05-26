import { useGetAdminStats, useGetAdminActivity, useListProducts, useApproveProduct, getGetAdminStatsQueryKey, getListProductsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Box, MessageSquare, AlertCircle, CheckCircle2, XCircle, ShoppingBag, TrendingUp, DollarSign, Clock, Truck, Package } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: activity, isLoading: activityLoading } = useGetAdminActivity();
  const { data: pendingProductsData, isLoading: pendingLoading } = useListProducts(
    { status: "pending", limit: 5 },
    { query: { queryKey: getListProductsQueryKey({ status: "pending", limit: 5 }) } }
  );

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
        <div className="text-right">
          <p className="font-mono text-xs text-primary/60">SYSTEM STATUS: <span className="text-primary font-bold">ONLINE</span></p>
          <p className="font-mono text-xs text-muted-foreground">{format(new Date(), "yyyy-MM-dd HH:mm:ss")}</p>
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
