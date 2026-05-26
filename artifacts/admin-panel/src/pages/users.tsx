import { useState } from "react";
import { useListUsers, useBanUser, useDeleteUser, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { ListUsersRole } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, ShieldAlert, Shield, ShieldOff, UserX, UserCheck,
  Trash2, Edit2, LogOut, MessageSquare, Phone, Copy, Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";

const updateUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  role: z.enum(["admin", "user"]),
});

export default function Users() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<ListUsersRole | "all">("all");
  const [page, setPage] = useState(1);
  const { user: currentUser } = useAdminAuth();
  const { toast } = useToast();

  const [userToBan, setUserToBan] = useState<{ id: string; name: string; isCurrentlyBanned: boolean } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [userToEdit, setUserToEdit] = useState<{ id: string; name: string; role: string } | null>(null);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  // ── رسالة مباشرة ──
  const [userToMessage, setUserToMessage] = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const queryParams = {
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter as ListUsersRole } : {}),
  };

  const { data: response, isLoading } = useListUsers(
    queryParams,
    { query: { queryKey: getListUsersQueryKey(queryParams) } }
  );

  const queryClient = useQueryClient();
  const banMutation = useBanUser();
  const deleteMutation = useDeleteUser();
  const updateMutation = useUpdateUser();

  const editForm = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: "", role: "user" },
  });

  const handleBanToggle = async () => {
    if (!userToBan) return;
    try {
      await banMutation.mutateAsync({ id: userToBan.id, data: { banned: !userToBan.isCurrentlyBanned } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } finally { setUserToBan(null); }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteMutation.mutateAsync({ id: userToDelete.id });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
    } finally { setUserToDelete(null); }
  };

  const handleEditSubmit = async (data: z.infer<typeof updateUserSchema>) => {
    if (!userToEdit) return;
    try {
      await updateMutation.mutateAsync({ id: userToEdit.id, data });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(queryParams) });
      setUserToEdit(null);
    } catch (e) { console.error(e); }
  };

  const openEditModal = (user: any) => {
    setUserToEdit(user);
    editForm.reset({ name: user.name, role: user.role as "admin" | "user" });
  };

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    try {
      const token = localStorage.getItem("glow_admin_token");
      await fetch("/api/admin/logout-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } finally { setLogoutAllLoading(false); setShowLogoutAll(false); }
  };

  const handleSendMessage = async () => {
    if (!userToMessage || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      const token = localStorage.getItem("glow_admin_token");
      const res = await fetch(`/api/admin/users/${userToMessage.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: messageText.trim() }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "✅ تم الإرسال", description: `وصلت الرسالة لـ ${userToMessage.name}` });
      setMessageText("");
      setUserToMessage(null);
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "تعذر إرسال الرسالة" });
    } finally { setSendingMessage(false); }
  };

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">User Directory</h1>
          <p className="text-muted-foreground font-mono text-sm">MANAGE OPERATORS AND USERS</p>
        </div>
        <Button variant="destructive" size="sm" className="gap-2 font-mono" onClick={() => setShowLogoutAll(true)}>
          <LogOut className="w-4 h-4" />
          تسجيل خروج الجميع
        </Button>
      </div>

      <Card className="border-primary/20 bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الإيميل أو الهاتف..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9 font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30"
              />
            </div>
            <Select value={roleFilter} onValueChange={(val: any) => { setRoleFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] font-mono border-primary/30 bg-background/50">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL ROLES</SelectItem>
                <SelectItem value="admin">ADMINS</SelectItem>
                <SelectItem value="user">USERS</SelectItem>
                <SelectItem value="banned">BANNED</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-mono text-primary uppercase text-xs">المستخدم</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> الهاتف</span>
                </TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">الدور / الحالة</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs">تاريخ التسجيل</TableHead>
                <TableHead className="font-mono text-primary uppercase text-xs text-right">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-mono">FETCHING RECORDS...</TableCell>
                </TableRow>
              ) : !response?.users?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-mono">NO USERS FOUND</TableCell>
                </TableRow>
              ) : (
                response.users.map((user: any) => (
                  <TableRow key={user.id} className={`border-border/50 group ${user.banned ? "bg-destructive/5" : "hover:bg-muted/30"}`}>
                    {/* ── المستخدم ── */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full border overflow-hidden flex items-center justify-center flex-shrink-0 font-mono font-bold text-xs uppercase
                          ${user.banned ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"}`}>
                          {user.avatar
                            ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                            : user.name.substring(0, 2)}
                        </div>
                        <div>
                          <p className={`font-medium ${user.banned ? "text-destructive/80 line-through decoration-destructive/50" : "text-foreground"}`}>
                            {user.name}
                            {user.id === currentUser?.id && (
                              <span className="ml-2 text-[10px] text-primary border border-primary/30 px-1 rounded">YOU</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* ── رقم الهاتف ── */}
                    <TableCell>
                      {user.phone ? (
                        <div className="flex items-center gap-1.5 group/phone">
                          <span className="font-mono text-sm text-foreground/80 dir-ltr">{user.phone}</span>
                          <button
                            onClick={() => copyPhone(user.phone)}
                            className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                            title="نسخ الرقم"
                          >
                            {copiedPhone === user.phone
                              ? <Check className="w-3.5 h-3.5 text-green-400" />
                              : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 font-mono text-xs">—</span>
                      )}
                    </TableCell>

                    {/* ── الدور ── */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.banned ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase border-destructive/50 text-destructive bg-destructive/10">
                            <ShieldAlert className="w-3 h-3 mr-1" /> BANNED
                          </Badge>
                        ) : user.role === "admin" ? (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/50 text-primary bg-primary/10">
                            <Shield className="w-3 h-3 mr-1" /> ADMIN
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-[10px] uppercase border-muted-foreground/30 text-muted-foreground">
                            <ShieldOff className="w-3 h-3 mr-1" /> USER
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* ── تاريخ التسجيل ── */}
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </TableCell>

                    {/* ── الإجراءات ── */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* زر إرسال رسالة — لكل المستخدمين عدا نفسك */}
                        {user.id !== currentUser?.id && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10"
                            onClick={() => { setUserToMessage({ id: user.id, name: user.name, phone: user.phone ?? null }); setMessageText(""); }}
                            title="إرسال رسالة"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        )}

                        {user.id !== currentUser?.id && user.role !== "admin" && (
                          <>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => openEditModal(user)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className={`h-8 w-8 ${user.banned ? "text-primary hover:text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}`}
                              onClick={() => setUserToBan({ id: user.id, name: user.name, isCurrentlyBanned: user.banned })}
                            >
                              {user.banned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setUserToDelete({ id: user.id, name: user.name })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {response && response.total > response.limit && (
            <div className="p-4 border-t border-border/50 flex items-center justify-between">
              <span className="font-mono text-sm text-muted-foreground">
                SHOWING {((page - 1) * response.limit) + 1} TO {Math.min(page * response.limit, response.total)} OF {response.total}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="font-mono">PREV</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * response.limit >= response.total} className="font-mono">NEXT</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── ديالوج إرسال رسالة مباشرة ── */}
      <Dialog open={!!userToMessage} onOpenChange={(open) => !open && setUserToMessage(null)}>
        <DialogContent className="bg-card border border-blue-500/30 font-mono max-w-md">
          <DialogHeader>
            <DialogTitle className="text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              إرسال رسالة مباشرة
            </DialogTitle>
            <DialogDescription className="text-muted-foreground space-y-1">
              <span className="block">إلى: <span className="text-foreground font-bold">{userToMessage?.name}</span></span>
              {userToMessage?.phone && (
                <span className="block text-xs flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {userToMessage.phone}
                </span>
              )}
              <span className="block text-xs text-yellow-400/70 mt-1">
                ⚡ الرسالة ستصل للمستخدم في تطبيق الدردشة مباشرةً
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="bg-background/50 border-blue-500/30 text-foreground min-h-[120px] resize-none focus-visible:ring-blue-500/50 text-right"
              dir="rtl"
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-left">{messageText.length} حرف</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToMessage(null)} className="border-primary/20 text-muted-foreground">
              إلغاء
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
              className="bg-blue-500 text-white hover:bg-blue-600 gap-2"
            >
              {sendingMessage ? (
                <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> جارٍ الإرسال...</span>
              ) : (
                <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> إرسال</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ديالوج حظر/رفع الحظر ── */}
      <AlertDialog open={!!userToBan} onOpenChange={(open) => !open && setUserToBan(null)}>
        <AlertDialogContent className="bg-card border border-primary/20 font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary uppercase tracking-wider">
              {userToBan?.isCurrentlyBanned ? "RESTORE ACCESS?" : "REVOKE ACCESS?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {userToBan?.isCurrentlyBanned
                ? `This will restore platform access for ${userToBan.name}.`
                : `This will immediately disconnect ${userToBan?.name} and revoke all access privileges.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/20 text-muted-foreground hover:text-foreground">CANCEL</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanToggle}
              className={userToBan?.isCurrentlyBanned ? "bg-primary text-black hover:bg-primary/90" : "bg-destructive text-white hover:bg-destructive/90"}
            >
              {banMutation.isPending ? "PROCESSING..." : "CONFIRM"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── ديالوج الحذف ── */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent className="bg-card border border-destructive/50 font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> PERMANENT DELETION
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete user {userToDelete?.name} and all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/20 text-muted-foreground hover:text-foreground">CANCEL</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              {deleteMutation.isPending ? "PROCESSING..." : "DELETE"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── ديالوج التعديل ── */}
      <Dialog open={!!userToEdit} onOpenChange={(open) => !open && setUserToEdit(null)}>
        <DialogContent className="bg-card border border-primary/20 font-mono">
          <DialogHeader>
            <DialogTitle className="text-primary uppercase tracking-wider">EDIT OPERATOR</DialogTitle>
            <DialogDescription className="text-muted-foreground">Modify operator details and clearance levels.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-primary/70 uppercase text-xs">Name</FormLabel>
                    <FormControl>
                      <Input {...field} className="bg-background/50 border-primary/30 text-primary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-primary/70 uppercase text-xs">Clearance Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-primary/30 text-primary">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUserToEdit(null)} className="border-primary/20 text-muted-foreground">CANCEL</Button>
                <Button type="submit" className="bg-primary text-black hover:bg-primary/90" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "SAVING..." : "SAVE CHANGES"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── ديالوج تسجيل خروج الجميع ── */}
      <AlertDialog open={showLogoutAll} onOpenChange={setShowLogoutAll}>
        <AlertDialogContent className="border-destructive/50 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-mono uppercase flex items-center gap-2">
              <LogOut className="w-5 h-5" /> تسجيل خروج جميع الحسابات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم إبطال جلسات جميع المستخدمين فوراً وسيضطرون لتسجيل الدخول مجدداً.
              <br />
              <span className="text-primary/70 text-xs">ملاحظة: حسابك أنت لن يتأثر.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-primary/20 text-muted-foreground font-mono">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogoutAll} disabled={logoutAllLoading} className="bg-destructive text-white hover:bg-destructive/90 font-mono">
              {logoutAllLoading ? "جارٍ التنفيذ..." : "تأكيد — تسجيل الخروج"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
