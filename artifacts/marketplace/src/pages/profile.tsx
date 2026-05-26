import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateUser, getGetMeQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, LogOut, Shield, User as UserIcon, Camera, ChevronLeft, Bell, Trash2, AlertTriangle, Package, Users, Play, Image } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { uploadAvatar } from "@/lib/upload-image";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateUser = useUpdateUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const [name, setName] = useState(user?.name || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // حالات (Stories)
  const [myStories, setMyStories] = useState<any[]>([]);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  // فيديوهاتي (Content Videos)
  const [myVideos, setMyVideos] = useState<any[]>([]);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);

  // حذف الحساب
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) return;
    const token = getMemToken();

    // fetch stories
    fetch("/api/stories", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((groups: any[]) => {
        const mine = groups.find((g: any) => g.userId === user.id);
        setMyStories(mine?.stories ?? []);
      })
      .catch(() => {});

    // fetch my content videos
    fetch(`/api/content?userId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: any) => setMyVideos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user]);

  async function handleDeleteStory(storyId: string) {
    setDeletingStoryId(storyId);
    try {
      const token = getMemToken();
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setMyStories((prev) => prev.filter((s) => s.id !== storyId));
      toast({ title: "تم حذف الحالة ✓" });
    } catch {
      toast({ variant: "destructive", title: "تعذر حذف الحالة" });
    } finally {
      setDeletingStoryId(null);
    }
  }

  async function handleDeleteVideo(videoId: string) {
    setDeletingVideoId(videoId);
    try {
      const token = getMemToken();
      const res = await fetch(`/api/content/${videoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setMyVideos((prev) => prev.filter((v) => v.id !== videoId));
      toast({ title: "تم حذف الفيديو ✓" });
    } catch {
      toast({ variant: "destructive", title: "تعذر حذف الفيديو" });
    } finally {
      setDeletingVideoId(null);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const token = getMemToken();
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      logout();
      setLocation("/login");
    } catch {
      toast({ variant: "destructive", title: "تعذر حذف الحساب" });
      setDeletingAccount(false);
      setConfirmDeleteAccount(false);
    }
  }

  async function handleTestNotification() {
    setTestingPush(true);
    try {
      const token = getMemToken();
      const res = await fetch("/api/test-notification", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json() as any;
      const recipients = data.oneSignalResponse?.recipients ?? 0;
      if (recipients > 0) {
        toast({ title: "✅ تم الإرسال!", description: `وصل الإشعار لـ ${recipients} جهاز` });
      } else {
        toast({ title: "⚠️ لم يصل لأي جهاز", description: "تأكد من منح إذن الإشعارات في المتصفح", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setTestingPush(false);
    }
  }

  if (!user) return null;

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const url = await uploadAvatar(file, user!.id);
      setAvatarPreview(url);
    } catch {
      toast({ variant: "destructive", title: "تعذر رفع الصورة على Firebase" });
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "الاسم مطلوب" });
      return;
    }
    setSaving(true);
    updateUser.mutate(
      { id: user!.id, data: { name: name.trim(), avatar: avatarPreview || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "تم الحفظ ✓", description: "تم تحديث ملفك الشخصي." });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "خطأ", description: err?.message });
        },
        onSettled: () => setSaving(false),
      }
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col">

        {/* ── Header ── */}
        <div className="relative px-5 pt-14 pb-8 bg-gradient-to-b from-primary/10 to-background">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.15),transparent_70%)]" />
          <div className="relative flex flex-col items-center gap-3">

            {/* Avatar with camera button */}
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-primary/30 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                <AvatarImage src={avatarPreview || user.avatar} />
                <AvatarFallback className="bg-primary/20 text-3xl font-black">{user.name[0]}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFile}
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-background shadow-[0_0_10px_rgba(168,85,247,0.5)]"
              >
                {compressing
                  ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  : <Camera className="w-3.5 h-3.5 text-white" />}
              </motion.button>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5">
                <h1 className="text-xl font-black text-white">{user.name}</h1>
                {user.role === "admin" && <VerifiedBadge size="md" />}
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <Shield className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent uppercase">{user.role}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div className="px-5 py-2 space-y-3">
          <Link href="/my-listings">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-accent" />
                </div>
                <span className="text-sm font-semibold text-white">منتجاتي</span>
              </div>
              <span className="text-muted-foreground text-xs">←</span>
            </div>
          </Link>
          <Link href="/orders">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-white">طلباتي</span>
              </div>
              <span className="text-muted-foreground text-xs">←</span>
            </div>
          </Link>
          <Link href="/following">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-white">المتابعون</span>
              </div>
              <span className="text-muted-foreground text-xs">←</span>
            </div>
          </Link>
          <Link href="/support">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-sm font-semibold text-white">الدعم</span>
              </div>
              <span className="text-muted-foreground text-xs">←</span>
            </div>
          </Link>
        </div>

        {/* ── Edit Form ── */}
        <div className="px-5 pb-6 space-y-4">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">تعديل الملف الشخصي</h2>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-white/60 uppercase tracking-wider">الاسم</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/10 focus-visible:border-primary/50 h-12 rounded-xl"
            />
          </div>

          {/* Avatar section */}
          <div className="space-y-2">
            <Label className="text-xs text-white/60 uppercase tracking-wider">الصورة الشخصية</Label>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-dashed border-white/20 hover:border-primary/40 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                {compressing
                  ? <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  : <Camera className="w-5 h-5 text-primary" />}
              </div>
              <div className="text-right flex-1">
                <p className="text-white font-bold text-sm">
                  {compressing ? "جاري التحميل..." : "اختر صورة من الهاتف"}
                </p>
                <p className="text-white/40 text-[11px]">أو أدخل رابط صورة أدناه</p>
              </div>
            </motion.button>

            <Input
              value={avatarPreview.startsWith("data:") ? "" : avatarPreview}
              onChange={(e) => setAvatarPreview(e.target.value)}
              placeholder="https://..."
              className="bg-white/5 border-white/10 focus-visible:border-primary/50 h-12 rounded-xl"
              dir="ltr"
            />
          </div>

          {/* Save */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving || compressing}
            className="w-full h-12 bg-primary text-white font-bold rounded-2xl shadow-[0_0_16px_rgba(168,85,247,0.3)] flex items-center justify-center disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "حفظ التغييرات"}
          </motion.button>
        </div>

        {/* ── اختبار الإشعارات ── */}
        <div className="px-5 pb-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleTestNotification}
            disabled={testingPush}
            className="w-full flex flex-row-reverse items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-primary/25 hover:border-primary/50 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              {testingPush ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> : <Bell className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-bold text-white">اختبار الإشعارات</p>
              <p className="text-[11px] text-white/40">اضغط لإرسال إشعار تجريبي لجهازك</p>
            </div>
          </motion.button>
        </div>

        {/* ── Privacy Policy Card ── */}
        <div className="px-5 pb-2">
          <Link href="/privacy-policy">
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex flex-row-reverse items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-primary/25 cursor-pointer hover:border-primary/50 transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold text-white">سياسة الخصوصية</p>
                <p className="text-[11px] text-white/40">اضغط لقراءة سياسة الخصوصية الخاصة بنا</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-white/30" />
            </motion.div>
          </Link>
        </div>

        {/* ── حالاتي (Stories) ── */}
        {myStories.length > 0 && (
          <div className="px-5 pb-4">
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">حالاتي</h2>
            <div className="space-y-2">
              {myStories.map((story) => (
                <div key={story.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  {story.mediaUrl && (
                    <img src={story.mediaUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" />
                  )}
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-white/70 text-xs truncate">{story.caption || "حالة بدون نص"}</p>
                    <p className="text-white/30 text-[10px] mt-0.5">
                      {new Date(story.createdAt).toLocaleDateString("ar")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteStory(story.id)}
                    disabled={deletingStoryId === story.id}
                    className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0"
                  >
                    {deletingStoryId === story.id
                      ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                      : <Trash2 className="w-4 h-4 text-red-400" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── فيديوهاتي ── */}
        {myVideos.length > 0 && (
          <div className="px-5 pb-4">
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">فيديوهاتي</h2>
            <div className="space-y-2">
              {myVideos.map((video) => (
                <div key={video.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {video.thumbnailUrl
                      ? <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      : <Play className="w-5 h-5 text-primary" />}
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <p className="text-white/70 text-xs truncate">{video.caption || "فيديو بدون وصف"}</p>
                    <p className="text-white/30 text-[10px] mt-0.5 flex items-center justify-end gap-2">
                      <span>❤️ {video.likesCount ?? 0}</span>
                      <span>{new Date(video.createdAt).toLocaleDateString("ar")}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteVideo(video.id)}
                    disabled={deletingVideoId === video.id}
                    className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0"
                  >
                    {deletingVideoId === video.id
                      ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                      : <Trash2 className="w-4 h-4 text-red-400" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Logout ── */}
        <div className="px-5 pb-3">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/30 text-red-400 font-bold text-sm"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>

        {/* ── حذف الحساب ── */}
        <div className="px-5 pb-10">
          {!confirmDeleteAccount ? (
            <button
              onClick={() => setConfirmDeleteAccount(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-red-500/60 text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              حذف الحساب نهائياً
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-3">
              <div className="flex items-center gap-2 justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 font-bold text-sm">هل أنت متأكد؟</p>
              </div>
              <p className="text-red-400/70 text-xs text-center">سيتم حذف حسابك ومنتجاتك نهائياً ولا يمكن التراجع</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteAccount(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold flex items-center justify-center"
                >
                  {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، احذف"}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
