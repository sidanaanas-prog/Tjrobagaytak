import { useState } from "react";
import { useListProducts, useApproveProduct, getListProductsQueryKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { ProductStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle2, XCircle, Box, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Products() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProductStatus | "all">("all");
  const [page, setPage] = useState(1);

  const queryParams = {
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as ProductStatus } : {})
  };

  const { data: response, isLoading } = useListProducts(
    queryParams,
    { query: { queryKey: getListProductsQueryKey(queryParams) } }
  );

  const queryClient = useQueryClient();
  const approveMutation = useApproveProduct();

  const handleApprove = async (id: string, status: "active" | "rejected") => {
    await approveMutation.mutateAsync({ id, data: { status } });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(queryParams) });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
    
    // Also invalidate the specific pending query if we're on the all view
    if (statusFilter === "all") {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ status: "pending", limit: 5 }) });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">Products Registry</h1>
          <p className="text-muted-foreground font-mono text-sm">MANAGE INVENTORY AND APPROVALS</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search products..." 
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30"
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select 
                value={statusFilter} 
                onValueChange={(val: any) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px] font-mono border-primary/30 bg-background/50">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL STATUSES</SelectItem>
                  <SelectItem value="active">ACTIVE</SelectItem>
                  <SelectItem value="pending">PENDING</SelectItem>
                  <SelectItem value="rejected">REJECTED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-mono text-primary uppercase text-xs">Product</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">Seller</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">Price</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">Status</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">Listed</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono">
                    FETCHING INVENTORY...
                  </TableCell>
                </TableRow>
              ) : !response?.products?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-mono">
                    NO PRODUCTS FOUND
                  </TableCell>
                </TableRow>
              ) : (
                response.products.map((product) => (
                  <TableRow key={product.id} className="border-border/50 hover:bg-muted/30 group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded border border-border overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Box className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground line-clamp-1 max-w-[200px]">{product.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.category || 'Uncategorized'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{product.seller?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-primary">${product.price.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`font-mono text-[10px] uppercase border ${
                          product.status === 'active' ? 'border-primary/50 text-primary' :
                          product.status === 'pending' ? 'border-yellow-500/50 text-yellow-500' :
                          'border-destructive/50 text-destructive'
                        }`}
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {format(new Date(product.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {product.status === 'pending' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-white"
                              onClick={() => handleApprove(product.id, "rejected")}
                              disabled={approveMutation.isPending}
                            >
                              REJECT
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 bg-primary text-black hover:bg-primary/90"
                              onClick={() => handleApprove(product.id, "active")}
                              disabled={approveMutation.isPending}
                            >
                              APPROVE
                            </Button>
                          </>
                        )}
                        {product.status === 'active' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-white"
                            onClick={() => handleApprove(product.id, "rejected")}
                            disabled={approveMutation.isPending}
                          >
                            DELIST
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination could go here */}
          {response && response.total > response.limit && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between">
              <span className="font-mono text-sm text-muted-foreground">
                SHOWING {((page - 1) * response.limit) + 1} TO {Math.min(page * response.limit, response.total)} OF {response.total}
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="font-mono"
                >
                  PREV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * response.limit >= response.total}
                  className="font-mono"
                >
                  NEXT
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
