import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useListProducts, useListCategories, type ListProductsParams } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Loader2, Search, SlidersHorizontal, X, ChevronDown, Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductsPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const [params, setParams] = useState<ListProductsParams>({
    limit: 20,
    page: 1,
    search: searchParams.get("search") || undefined,
    category: searchParams.get("category") || undefined,
    status: undefined,
  });
  const [localSearch, setLocalSearch] = useState(params.search || "");
  const [showFilters, setShowFilters] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const { data: productsData, isLoading } = useListProducts(params);
  const { data: categories } = useListCategories();

  // Reset products when filters/search change
  useEffect(() => {
    setAllProducts([]);
    setHasMore(true);
  }, [params.search, params.category]);

  // Accumulate products as pages load
  useEffect(() => {
    if (productsData?.products) {
      if (params.page === 1) {
        setAllProducts(productsData.products);
      } else {
        setAllProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = productsData.products.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newOnes];
        });
      }
      setHasMore(allProducts.length + productsData.products.length < productsData.total);
    }
  }, [productsData]);

  useEffect(() => {
    const cat = searchParams.get("category");
    const search = searchParams.get("search");
    setParams((p) => ({ ...p, category: cat || undefined, search: search || undefined, page: 1 }));
  }, [searchString]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAllProducts([]);
    setParams((p) => ({ ...p, search: localSearch || undefined, page: 1 }));
  };

  const handleCategory = (id?: string) => {
    setAllProducts([]);
    setParams((p) => ({ ...p, category: id, page: 1 }));
    setShowFilters(false);
  };

  const clearFilters = () => {
    setLocalSearch("");
    setAllProducts([]);
    setParams({ limit: 20, page: 1, status: undefined });
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }));
    }
  };

  const hasFilters = params.search || params.category;
  const total = productsData?.total ?? 0;

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-30 px-4 pt-12 pb-3 bg-background/90 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <h1 className="text-xl font-black text-white flex-1">استكشف</h1>
            <button
              onClick={() => setLocation("/sellers")}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors text-xs font-bold"
            >
              <Store className="w-3.5 h-3.5" />
              المتاجر
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${showFilters ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/5 border-white/10 text-white/60"}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="ابحث عن أي شيء..."
              className="pr-10 bg-white/5 border-white/10 focus-visible:border-primary/50 h-10 rounded-xl text-sm"
            />
          </form>

          {/* Category Filter Pills */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 overflow-x-auto pb-1 pt-3 scrollbar-none -mx-4 px-4">
                  <button
                    onClick={() => handleCategory(undefined)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${!params.category ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "bg-white/5 border-white/10 text-white/60"}`}
                  >
                    الكل
                  </button>
                  {categories?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCategory(c.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1 ${params.category === c.id ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "bg-white/5 border-white/10 text-white/60"}`}
                    >
                      <span className="text-sm">{c.icon || "\ud83d\udce6"}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filters bar */}
          {hasFilters && (
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-muted-foreground">نتائج:</span>
              {params.category && categories && (
                <span className="flex items-center gap-1 bg-primary/20 text-primary text-xs px-2.5 py-1 rounded-full border border-primary/30">
                  {categories.find((c) => c.id === params.category)?.name}
                  <button onClick={() => handleCategory(undefined)}><X className="w-3 h-3" /></button>
                </span>
              )}
              {params.search && (
                <span className="flex items-center gap-1 bg-white/10 text-white/70 text-xs px-2.5 py-1 rounded-full border border-white/10">
                  "{params.search}"
                  <button onClick={() => { setLocalSearch(""); setParams(p => ({...p, search: undefined})); }}><X className="w-3 h-3" /></button>
                </span>
              )}
              <button onClick={clearFilters} className="text-xs text-destructive mr-auto">مسح الكل</button>
            </div>
          )}
        </div>

        {/* Products Grid */}
        <div className="px-4 pt-4 pb-6">
          {isLoading && allProducts.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} compact />
              ))}
            </div>
          ) : allProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-lg font-bold text-white mb-1">لا توجد نتائج</h3>
              <p className="text-muted-foreground text-sm">جرّب تغيير معايير البحث</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {allProducts.length} من {total} منتج
              </p>
              <div className="grid grid-cols-2 gap-3">
                {allProducts.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} compact />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={loadMore}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary/20 border border-primary/30 text-primary font-bold text-sm"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        تحميل المزيد
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
