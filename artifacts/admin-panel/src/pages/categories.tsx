import { useListCategories, useCreateCategory, useDeleteCategory, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Tags, Trash2, Plus, Box } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const categorySchema = z.object({
  name: z.string().min(2, "Category name is required"),
  icon: z.string().optional(),
});

export default function Categories() {
  const [search, setSearch] = useState("");
  const { data: categories, isLoading } = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  
  const queryClient = useQueryClient();
  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();

  const [categoryToDelete, setCategoryToDelete] = useState<{id: string, name: string} | null>(null);

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      icon: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof categorySchema>) => {
    await createMutation.mutateAsync({ data });
    form.reset();
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteMutation.mutateAsync({ id: categoryToDelete.id });
      queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    } finally {
      setCategoryToDelete(null);
    }
  };

  const filteredCategories = categories?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">Taxonomy Setup</h1>
          <p className="text-muted-foreground font-mono text-sm">MANAGE MARKETPLACE CATEGORIES</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category List */}
        <Card className="col-span-1 lg:col-span-2 border-primary/20 bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Filter categories..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-primary uppercase text-xs w-[60px]"></TableHead>
                  <TableHead className="font-mono text-primary uppercase text-xs">Name</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-xs text-right">Products</TableHead>
                  <TableHead className="font-mono text-primary uppercase text-xs text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-mono">
                      LOADING TAXONOMY...
                    </TableCell>
                  </TableRow>
                ) : !filteredCategories?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground font-mono">
                      NO CATEGORIES FOUND
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((category) => (
                    <TableRow key={category.id} className="border-border/50 hover:bg-muted/30">
                      <TableCell>
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center border border-primary/30">
                          {category.icon ? (
                            <span className="text-primary font-mono">{category.icon.substring(0,2)}</span>
                          ) : (
                            <Tags className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-foreground">{category.name}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono border-primary/30 text-primary bg-primary/5">
                          {category.productCount || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setCategoryToDelete({ id: category.id, name: category.name })}
                          disabled={category.productCount ? category.productCount > 0 : false}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Category Form */}
        <Card className="col-span-1 border-primary/20 bg-card h-fit sticky top-6">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="font-mono text-primary flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" />
              INITIALIZE CATEGORY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-primary/70 uppercase text-xs tracking-wider">Classification Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. Cyberware" 
                          className="font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-primary/70 uppercase text-xs tracking-wider">Symbol (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Icon identifier" 
                          className="font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="font-mono text-xs" />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full font-mono uppercase tracking-widest bg-primary text-black hover:bg-primary/90 mt-2"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "PROCESSING..." : "EXECUTE"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
        <AlertDialogContent className="bg-card border border-primary/20 font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive uppercase tracking-wider">
              PURGE CATEGORY?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete the classification "{categoryToDelete?.name}". This action cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/20 text-muted-foreground hover:text-foreground">ABORT</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "PURGING..." : "CONFIRM PURGE"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
