import { useState, useEffect, useCallback } from "react";
import { Zap, Plus, Trash2, Clock, CheckCircle, XCircle, Search, Loader2, Store, ChevronRight, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function apiReq(path: string, options?: RequestInit) {
  const token = localStorage.getItem("glow_admin_token");
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  }).then((r) => r.json());
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [r, setR] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setR("انتهى"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setR(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endsAt]);
  return <span className="font-mono text-sm">{r}</span>;
}

type Product = {
  id: string; title: string; price: number; images: string[];
  seller?: { id: string; name: string; avatar?: string };
  category?: string;
};

type Seller = { id: string; name: string; avatar?: string; productCount?: number };

export default function FlashSalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Drawer ─────────────────────────────────────────────────────────
  const [showDrawer, setShowDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"products" | "stores">("products");

  // ── Products browser ───────────────────────────────────────────────
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Stores browser ─────────────────────────────────────────────────
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [storeSearch, setStoreSearch] = useState("");

  // ── Flash sale form ────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [salePrice, setSalePrice] = useState("");
  const [durationHours, setDurationHours] = useState("3");
  const [creating, setCreating] = useState(false);

  const loadSales = useCallback(async () => {
    const data = await apiReq("/api/admin/flash-sales");
    if (Array.isArray(data)) setSales(data);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ limit: "60", status: "active" });
      if (search.trim()) params.set("search", search.trim());
      if (selectedSellerId) params.set("sellerId", selectedSellerId);
      if (selectedCategory) params.set("category", selectedCategory);
      const data = await apiReq(`/api/products?${params}`);
      const list: Product[] = (data?.products || data || []);
      setAllProducts(list);
      // استخلاص المتاجر الفريدة من المنتجات
      const sellerMap = new Map<string, Seller>();
      for (const p of list) {
        if (p.seller && !sellerMap.has(p.seller.id)) {
          sellerMap.set(p.seller.id, { ...p.seller, productCount: 0 });
        }
        if (p.seller) {
          const s = sellerMap.get(p.seller.id)!;
          s.productCount = (s.productCount || 0) + 1;
        }
      }
      setSellers([...sellerMap.values()].sort((a, b) => (b.productCount || 0) - (a.productCount || 0)));
    } finally {
      setLoadingProducts(false);
    }
  }, [search, selectedSellerId, selectedCategory]);

  useEffect(() => { loadSales(); }, [loadSales]);
  useEffect(() => {
    apiReq("/api/categories").then((d) => setCategories(Array.isArray(d) ? d : []));
  }, []);
  useEffect(() => {
    if (!showDrawer) return;
    const t = setTimeout(loadProducts, 300);
    return () => clearTimeout(t);
  }, [showDrawer, search, selectedSellerId, selectedCategory, loadProducts]);

  const openDrawer = () => {
    setShowDrawer(true);
    setDrawerTab("products");
    setSearch("");
    setSelectedSellerId(null);
    setSelectedCategory(null);
  };

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setSalePrice("");
    setShowDrawer(false);
  };

  const selectStore = (seller: Seller) => {
    setSelectedSellerId(seller.id);
    setDrawerTab("products");
    setSearch("");
  };

  const create = async () => {
    if (!selectedProduct || !salePrice) return;
    setCreating(true);
    try {
      await apiReq("/api/admin/flash-sales", {
        method: "POST",
        body: JSON.stringify({ productId: selectedProduct.id, salePrice: Number(salePrice), durationHours: Number(durationHours) }),
      });
      setSelectedProduct(null); setSalePrice("");
      loadSales();
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(id);
    await apiReq(`/api/admin/flash-sales/${id}`, { method: "DELETE" });
    setDeleting(null);
    loadSales();
  };

  const now = new Date();
  const activeSales = sales.filter((s) => new Date(s.endsAt) > now);
  const expiredSales = sales.filter((s) => new Date(s.endsAt) <= now);

  const filteredStoreSellers = storeSearch
    ? sellers.filter((s) => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    : sellers;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            <Zap className="w-6 h-6 text-orange-400" />
            Flash Sales
          </h1>
          <p className="text-muted-foreground text-sm mt-1">عروض محدودة الوقت مع إشعار لمستخدمي المفضلة</p>
        </div>
        <button
          onClick={openDrawer}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors font-mono text-sm"
        >
          <Plus className="w-4 h-4" /> عرض جديد
        </button>
      </div>

      {/* ── بطاقة المنتج المختار + نموذج العرض ── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/5 space-y-4"
          >
            <div className="flex items-center gap-3">
              {selectedProduct.images?.[0]
                ? <img src={selectedProduct.images[0]} className="w-14 h-14 rounded-xl object-cover shrink-0 border border-orange-500/20" />
                : <div className="w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">📦</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm line-clamp-1">{selectedProduct.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedProduct.seller?.name && <><Store className="inline w-3 h-3 ml-1" />{selectedProduct.seller.name} · </>}
                  <span className="font-mono">{selectedProduct.price} د.ج</span>
                </p>
              </div>
              <button
                onClick={() => { setSelectedProduct(null); openDrawer(); }}
                className="text-xs text-orange-400 hover:underline flex items-center gap-1"
              >
                <ArrowRight className="w-3 h-3" /> تغيير
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">سعر العرض (DZ)</label>
                <input
                  type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                  placeholder={`أقل من ${selectedProduct.price}`}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">المدة (ساعات)</label>
                <select
                  value={durationHours} onChange={(e) => setDurationHours(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-card border border-border text-sm"
                >
                  {[1, 2, 3, 6, 12, 24].map((h) => (
                    <option key={h} value={h}>{h} ساعة</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={!salePrice || creating || Number(salePrice) >= selectedProduct.price}
                className="flex-1 h-10 rounded-lg bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                إطلاق العرض
              </button>
              <button onClick={() => setSelectedProduct(null)} className="px-4 h-10 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground">
                إلغاء
              </button>
            </div>
            {salePrice && Number(salePrice) >= selectedProduct.price && (
              <p className="text-xs text-red-400 text-center">⚠️ سعر العرض يجب أن يكون أقل من السعر الأصلي ({selectedProduct.price} د.ج)</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── العروض الفاعلة ── */}
      <div>
        <h2 className="text-sm font-bold font-mono text-orange-400 mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> فاعلة الآن ({activeSales.length})
        </h2>
        {activeSales.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8 border border-dashed border-border rounded-xl">لا توجد عروض فاعلة</p>
        ) : (
          <div className="space-y-3">
            {activeSales.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 flex items-center gap-4">
                {s.product?.images?.[0]
                  ? <img src={s.product.images[0]} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  : <div className="w-14 h-14 rounded-lg bg-orange-500/10 flex items-center justify-center text-2xl shrink-0">📦</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm line-clamp-1">{s.product?.title}</p>
                  {s.seller && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      {s.seller.avatar
                        ? <img src={s.seller.avatar} className="w-3.5 h-3.5 rounded-full object-cover" />
                        : <Store className="w-3 h-3" />
                      }
                      {s.seller.name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono font-bold text-orange-400">{s.salePrice} د.ج</span>
                    <span className="font-mono text-xs text-muted-foreground line-through">{s.product?.price} د.ج</span>
                    <span className="text-xs text-green-400 font-mono">
                      -{Math.round((1 - s.salePrice / s.product?.price) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-orange-400/80">
                    <Clock className="w-3 h-3" />
                    <Countdown endsAt={s.endsAt} />
                  </div>
                </div>
                <button
                  onClick={() => remove(s.id)} disabled={deleting === s.id}
                  className="w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center hover:bg-destructive/20 disabled:opacity-50"
                >
                  {deleting === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── العروض المنتهية ── */}
      {expiredSales.length > 0 && (
        <div>
          <h2 className="text-sm font-bold font-mono text-muted-foreground mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> منتهية ({expiredSales.length})
          </h2>
          <div className="space-y-2">
            {expiredSales.slice(0, 5).map((s) => (
              <div key={s.id} className="p-3 rounded-xl border border-border bg-card/50 flex items-center gap-3 opacity-50">
                {s.product?.images?.[0]
                  ? <img src={s.product.images[0]} className="w-10 h-10 rounded object-cover shrink-0" />
                  : <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-lg shrink-0">📦</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-1">{s.product?.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.salePrice} د.ج · انتهى</p>
                </div>
                <button onClick={() => remove(s.id)} className="text-xs text-destructive hover:underline">حذف</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Drawer — متصفح المنتجات والمتاجر
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showDrawer && (
          <>
            {/* overlay */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
              onClick={() => setShowDrawer(false)}
            />

            {/* panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 right-0 w-full max-w-lg bg-background border-l border-border z-50 flex flex-col"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div>
                  <h2 className="font-bold text-base font-mono">اختر منتجاً للعرض</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">تصفح المنتجات أو ابدأ من متجر</p>
                </div>
                <button onClick={() => setShowDrawer(false)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border shrink-0">
                {(["products", "stores"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDrawerTab(t)}
                    className={`flex-1 py-2.5 text-sm font-semibold font-mono transition-colors border-b-2 ${
                      drawerTab === t ? "border-orange-400 text-orange-400" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "products" ? "📦 المنتجات" : "🏪 المتاجر"}
                  </button>
                ))}
              </div>

              {/* Tab: Products */}
              {drawerTab === "products" && (
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Filters */}
                  <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ابحث عن منتج..."
                        className="w-full h-9 pr-9 pl-3 rounded-lg bg-muted border border-border text-sm text-right"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                      {/* فلتر المتجر المختار */}
                      {selectedSellerId && (
                        <button
                          onClick={() => setSelectedSellerId(null)}
                          className="flex-shrink-0 flex items-center gap-1 px-3 h-7 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-mono"
                        >
                          <Store className="w-3 h-3" />
                          {sellers.find((s) => s.id === selectedSellerId)?.name ?? "متجر"}
                          <X className="w-3 h-3 mr-1" />
                        </button>
                      )}
                      {/* فلتر التصنيف */}
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex-shrink-0 px-3 h-7 rounded-full text-xs font-mono border transition-colors ${
                          !selectedCategory ? "bg-orange-500/20 border-orange-500/30 text-orange-400" : "bg-muted border-border text-muted-foreground"
                        }`}
                      >الكل</button>
                      {categories.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCategory(selectedCategory === c.id ? null : c.id)}
                          className={`flex-shrink-0 px-3 h-7 rounded-full text-xs font-mono border transition-colors ${
                            selectedCategory === c.id ? "bg-orange-500/20 border-orange-500/30 text-orange-400" : "bg-muted border-border text-muted-foreground"
                          }`}
                        >{c.name}</button>
                      ))}
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                      </div>
                    ) : allProducts.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-12">لا توجد منتجات</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {allProducts.map((p) => (
                          <motion.button
                            key={p.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => selectProduct(p)}
                            className="text-right rounded-xl border border-border bg-card hover:border-orange-400/50 hover:bg-orange-500/5 transition-all overflow-hidden group"
                          >
                            <div className="aspect-square bg-muted relative overflow-hidden">
                              {p.images?.[0]
                                ? <img src={p.images[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                              }
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-semibold line-clamp-2 leading-tight">{p.title}</p>
                              <p className="text-xs font-mono font-bold text-orange-400 mt-1">{p.price} د.ج</p>
                              {p.seller && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                                  {p.seller.avatar
                                    ? <img src={p.seller.avatar} className="w-3 h-3 rounded-full object-cover shrink-0" />
                                    : <Store className="w-2.5 h-2.5 shrink-0" />
                                  }
                                  <span className="truncate">{p.seller.name}</span>
                                </p>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Stores */}
              {drawerTab === "stores" && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="px-4 pt-3 pb-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={storeSearch}
                        onChange={(e) => setStoreSearch(e.target.value)}
                        placeholder="ابحث عن متجر..."
                        className="w-full h-9 pr-9 pl-3 rounded-lg bg-muted border border-border text-sm text-right"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
                      </div>
                    ) : filteredStoreSellers.length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm py-12">لا توجد متاجر</p>
                    ) : (
                      filteredStoreSellers.map((s) => (
                        <motion.button
                          key={s.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectStore(s)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-orange-400/40 hover:bg-orange-500/5 transition-all text-right"
                        >
                          {s.avatar
                            ? <img src={s.avatar} className="w-11 h-11 rounded-xl object-cover shrink-0 border border-border" />
                            : <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                <Store className="w-5 h-5 text-muted-foreground" />
                              </div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{s.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {s.productCount} منتج منشور
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
