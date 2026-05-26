import { useState, useEffect } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ShoppingBag, Eye, ArrowLeft, Package, Truck, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SellerOrders {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
}

interface OrderDetail {
  id: string;
  status: string;
  price: number;
  quantity: number;
  createdAt: string;
  buyerName: string;
  buyerAvatar: string | null;
}

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "تم التأكيد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  delivered: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  confirmed: <CheckCircle className="w-3.5 h-3.5" />,
  shipped: <Truck className="w-3.5 h-3.5" />,
  delivered: <CheckCircle className="w-3.5 h-3.5" />,
  cancelled: <XCircle className="w-3.5 h-3.5" />,
};

async function fetchSellerOrders(token: string): Promise<SellerOrders[]> {
  const res = await fetch(`/api/admin/seller-orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("فشل في جلب البيانات");
  return res.json();
}

async function fetchSellerOrderDetails(sellerId: string, token: string): Promise<OrderDetail[]> {
  const res = await fetch(`/api/admin/seller-orders/${sellerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("فشل في جلب التفاصيل");
  return res.json();
}

export default function SellerOrdersPage() {
  const { user } = useAdminAuth();
  const token = localStorage.getItem("glow_admin_token") || "";
  const [search, setSearch] = useState("");
  const [data, setData] = useState<SellerOrders[]>([]);
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [selectedSeller, setSelectedSeller] = useState<SellerOrders | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchSellerOrders(token);
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (seller: SellerOrders) => {
    setDetailsLoading(true);
    setSelectedSeller(seller);
    try {
      const result = await fetchSellerOrderDetails(seller.sellerId, token);
      setDetails(result);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = data.filter(
    (s) =>
      s.sellerName.toLowerCase().includes(search.toLowerCase()) ||
      s.sellerId.includes(search)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">
            Seller Orders
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            ORDERS PER STORE — DETAILED BREAKDOWN
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <span className="text-2xl font-bold font-mono text-white">
            {data.reduce((acc, s) => acc + s.totalOrders, 0)}
          </span>
          <span className="text-xs text-muted-foreground font-mono">TOTAL</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedSeller ? (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <button
              onClick={() => { setSelectedSeller(null); setDetails([]); }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-mono"
            >
              <ArrowLeft className="w-4 h-4" />
              العودة للقائمة
            </button>

            <Card className="border-primary/20 bg-card">
              <CardHeader>
                <CardTitle className="font-mono text-lg text-primary flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {selectedSeller.sellerName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                  {[
                    { label: "الكل", value: selectedSeller.totalOrders, color: "text-white" },
                    { label: "قيد الانتظار", value: selectedSeller.pending, color: "text-yellow-400" },
                    { label: "تم التأكيد", value: selectedSeller.confirmed, color: "text-blue-400" },
                    { label: "تم الشحن", value: selectedSeller.shipped, color: "text-purple-400" },
                    { label: "تم التسليم", value: selectedSeller.delivered, color: "text-green-400" },
                    { label: "ملغي", value: selectedSeller.cancelled, color: "text-red-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-black/30 border border-white/5 rounded-lg p-3 text-center">
                      <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-4 p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-muted-foreground font-mono">إجمالي الإيرادات:</span>
                  <span className="text-lg font-bold font-mono text-green-400">
                    {selectedSeller.totalRevenue.toFixed(2)} د.ج
                  </span>
                </div>

                {detailsLoading ? (
                  <div className="text-center py-8 text-muted-foreground font-mono">جاري التحميل...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5">
                        <TableHead className="text-primary font-mono text-xs">المشتري</TableHead>
                        <TableHead className="text-primary font-mono text-xs">الحالة</TableHead>
                        <TableHead className="text-primary font-mono text-xs">السعر</TableHead>
                        <TableHead className="text-primary font-mono text-xs">الكمية</TableHead>
                        <TableHead className="text-primary font-mono text-xs">التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.map((order) => (
                        <TableRow key={order.id} className="border-white/5">
                          <TableCell className="text-white font-mono text-sm">
                            <div className="flex items-center gap-2">
                              {order.buyerAvatar ? (
                                <img src={order.buyerAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary">
                                  {order.buyerName?.charAt(0)}
                                </div>
                              )}
                              {order.buyerName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${statusColors[order.status]} font-mono text-[10px] flex items-center gap-1 w-fit`}>
                              {statusIcons[order.status]}
                              {statusLabels[order.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white font-mono text-sm">{Number(order.price).toFixed(2)} د.ج</TableCell>
                          <TableCell className="text-white font-mono text-sm">{order.quantity}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {new Date(order.createdAt).toLocaleDateString("ar-DZ")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <Card className="border-primary/20 bg-card">
              <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث باسم البائع..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {loading && filtered.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 py-3">
                        <div className="h-8 w-32 bg-white/5 animate-pulse rounded" />
                        <div className="flex-1 grid grid-cols-7 gap-2">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <div key={j} className="h-6 bg-white/5 animate-pulse rounded" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground font-mono">لا توجد طلبات مسجلة</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5">
                        <TableHead className="text-primary font-mono text-xs">البائع</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">الطلبات</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">قيد الانتظار</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">تم التأكيد</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">تم الشحن</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">تم التسليم</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">ملغي</TableHead>
                        <TableHead className="text-primary font-mono text-xs text-center">الإيرادات</TableHead>
                        <TableHead className="text-primary font-mono text-xs">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((seller) => (
                        <TableRow key={seller.sellerId} className="border-white/5">
                          <TableCell className="text-white font-mono text-sm font-medium">
                            {seller.sellerName}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-white/5 text-white font-mono text-xs">
                              {seller.totalOrders}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-yellow-400 font-mono text-sm">{seller.pending}</TableCell>
                          <TableCell className="text-center text-blue-400 font-mono text-sm">{seller.confirmed}</TableCell>
                          <TableCell className="text-center text-purple-400 font-mono text-sm">{seller.shipped}</TableCell>
                          <TableCell className="text-center text-green-400 font-mono text-sm">{seller.delivered}</TableCell>
                          <TableCell className="text-center text-red-400 font-mono text-sm">{seller.cancelled}</TableCell>
                          <TableCell className="text-center text-green-400 font-mono text-sm">
                            {seller.totalRevenue.toFixed(0)} د.ج
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => loadDetails(seller)}
                              className="flex items-center gap-1 text-xs text-primary hover:text-white transition-colors font-mono"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              عرض
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
