import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";
import {
  Loader2, Home, CheckCircle, XCircle, Star, Clock, MapPin,
  Flame, RefreshCw, ShoppingBag, User, Phone, Mail, UtensilsCrossed,
  CreditCard, Crown, CalendarDays, X, Plus, Trash2, Edit, PlusCircle, DollarSign, Upload,
} from "lucide-react";
import { uploadToFirebaseWithProgress } from "@/lib/firebase-upload";

const BASE = getApiUrl("");

type MenuItem = {
  id: string;
  restaurantId: string;
  category: string;
  name: string;
  description: string | null;
  price: string;
  image: string | null;
  isAvailable: boolean;
  sortOrder: number;
};

type Restaurant = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  category: string;
  address: string;
  phone: string | null;
  isOpen: boolean;
  status: "pending" | "approved" | "rejected";
  deliveryFee: string;
  minOrder: string;
  estimatedDeliveryMinutes: number;
  rating: string;
  ratingCount: number;
  isFeatured: boolean;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  orderCount: number;
  menuCount: number;
};

const STATUS_MAP = {
  pending:  { label: "انتظار", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
  approved: { label: "معتمد",  color: "text-green-400 bg-green-400/10 border-green-400/25" },
  rejected: { label: "مرفوض", color: "text-red-400 bg-red-400/10 border-red-400/25" },
};

const PLAN_MAP: Record<string, { label: string; color: string }> = {
  free:    { label: "مجاني",   color: "text-white/40 bg-white/5 border-white/10" },
  basic:   { label: "أساسي",   color: "text-blue-400 bg-blue-400/10 border-blue-400/25" },
  premium: { label: "بريميوم", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/25" },
};

const FILTER_TABS = ["الكل", "انتظار", "معتمد", "مرفوض"];

type SubModal = { restaurantId: string; name: string; current: boolean; plan: string; expires: string | null };

export default function RestaurantsAdminPage() {
  const { token: authContextToken, logout } = useAdminAuth();
  const token = authContextToken || localStorage.getItem("glow_admin_token") || "";
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("الكل");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subModal, setSubModal] = useState<SubModal | null>(null);
  const [subForm, setSubForm] = useState({ isSubscribed: false, plan: "basic", months: 1 });
  const [subLoading, setSubLoading] = useState(false);

  // New states for creating event houses (restaurants)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "عام",
    address: "",
    phone: "",
    deliveryFee: "0",
    minOrder: "0",
    estimatedDeliveryMinutes: 30,
    logo: "",
    coverImage: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  // New states for editing event houses
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "عام",
    address: "",
    phone: "",
    deliveryFee: "0",
    minOrder: "0",
    estimatedDeliveryMinutes: 30,
    isOpen: true,
    logo: "",
    coverImage: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const [logoProgress, setLogoProgress] = useState<number | null>(null);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);

  // New states for managing service packages (menu items)
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuRestaurant, setMenuRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

  const [isMenuItemFormOpen, setIsMenuItemFormOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuItemForm, setMenuItemForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "الرئيسية",
  });
  const [menuItemLoading, setMenuItemLoading] = useState(false);

  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      const data = await res.json();
      setRestaurants(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, [token, logout, toast]);

  useEffect(() => { fetchRestaurants(); }, [fetchRestaurants]);

  const handleCreateRestaurant = async () => {
    if (!createForm.name || !createForm.address) {
      toast({ title: "الاسم والعنوان مطلوبان", variant: "destructive" });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          deliveryFee: createForm.deliveryFee || "0",
          minOrder: createForm.minOrder || "0",
          estimatedDeliveryMinutes: Number(createForm.estimatedDeliveryMinutes) || 30,
        }),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل إضافة منزل المناسبات");
      }
      toast({ title: "✅ تم إضافة منزل المناسبات بنجاح" });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: "",
        description: "",
        category: "عام",
        address: "",
        phone: "",
        deliveryFee: "0",
        minOrder: "0",
        estimatedDeliveryMinutes: 30,
        logo: "",
        coverImage: "",
      });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setCreateLoading(false);
  };

  const handleUploadImage = async (file: File, type: "logo" | "cover", isEdit: boolean) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "اختر صورة فقط", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "الصورة أكبر من 10 ميغابايت", variant: "destructive" });
      return;
    }
    const path = `restaurants/${Date.now()}-${file.name}`;
    const setProgress = type === "logo" ? setLogoProgress : setCoverProgress;
    setProgress(0);
    try {
      const url = await uploadToFirebaseWithProgress(file, path, (p) => setProgress(p));
      if (isEdit) {
        setEditForm((prev) => ({ ...prev, [type === "logo" ? "logo" : "coverImage"]: url }));
      } else {
        setCreateForm((prev) => ({ ...prev, [type === "logo" ? "logo" : "coverImage"]: url }));
      }
      toast({ title: "تم رفع الصورة بنجاح ✓" });
    } catch (err: any) {
      toast({ title: err.message ?? "فشل الرفع", variant: "destructive" });
    } finally {
      setProgress(null);
    }
  };

  const handleOpenEdit = (r: Restaurant) => {
    setEditingRestaurant(r);
    setEditForm({
      name: r.name,
      description: r.description ?? "",
      category: r.category,
      address: r.address,
      phone: r.phone ?? "",
      deliveryFee: r.deliveryFee,
      minOrder: r.minOrder,
      estimatedDeliveryMinutes: r.estimatedDeliveryMinutes,
      isOpen: r.isOpen,
      logo: r.logo ?? "",
      coverImage: r.coverImage ?? "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditRestaurant = async () => {
    if (!editingRestaurant) return;
    if (!editForm.name || !editForm.address) {
      toast({ title: "الاسم والعنوان مطلوبان", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${editingRestaurant.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editForm,
          deliveryFee: editForm.deliveryFee || "0",
          minOrder: editForm.minOrder || "0",
          estimatedDeliveryMinutes: Number(editForm.estimatedDeliveryMinutes) || 30,
        }),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل تحديث منزل المناسبات");
      }
      toast({ title: "✅ تم التحديث بنجاح" });
      setIsEditModalOpen(false);
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setEditLoading(false);
  };

  const handleDeleteRestaurant = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنزل نهائياً؟")) return;
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل حذف منزل المناسبات");
      toast({ title: "✅ تم الحذف بنجاح" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const fetchMenuItems = async (rId: string) => {
    setMenuLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${rId}/menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
    } catch {
      setMenuItems([]);
    }
    setMenuLoading(false);
  };

  const handleOpenMenu = (r: Restaurant) => {
    setMenuRestaurant(r);
    setMenuItems([]);
    setIsMenuModalOpen(true);
    fetchMenuItems(r.id);
  };

  const handleOpenMenuItemForm = (item?: MenuItem) => {
    if (item) {
      setEditingMenuItem(item);
      setMenuItemForm({
        name: item.name,
        description: item.description ?? "",
        price: item.price,
        category: item.category,
      });
    } else {
      setEditingMenuItem(null);
      setMenuItemForm({
        name: "",
        description: "",
        price: "",
        category: "الرئيسية",
      });
    }
    setIsMenuItemFormOpen(true);
  };

  const handleSaveMenuItem = async () => {
    if (!menuRestaurant) return;
    if (!menuItemForm.name || !menuItemForm.price) {
      toast({ title: "الاسم والسعر مطلوبان", variant: "destructive" });
      return;
    }
    setMenuItemLoading(true);
    try {
      const url = editingMenuItem
        ? `${BASE}/api/admin/restaurants/${menuRestaurant.id}/menu/${editingMenuItem.id}`
        : `${BASE}/api/admin/restaurants/${menuRestaurant.id}/menu`;
      const method = editingMenuItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(menuItemForm),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل حفظ الصنف");
      toast({ title: "✅ تم الحفظ بنجاح" });
      setIsMenuItemFormOpen(false);
      fetchMenuItems(menuRestaurant.id);
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setMenuItemLoading(false);
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!menuRestaurant) return;
    if (!confirm("هل أنت متأكد من حذف هذا الصنف؟")) return;
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${menuRestaurant.id}/menu/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل الحذف");
      toast({ title: "✅ تم الحذف بنجاح" });
      fetchMenuItems(menuRestaurant.id);
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: status === "approved" ? "✅ تم الاعتماد" : status === "rejected" ? "❌ تم الرفض" : "⏸ تم الإيقاف" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    setActionLoading(id + "feat");
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isFeatured: !current }),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل");
      toast({ title: !current ? "⭐ تم التمييز" : "تم إلغاء التمييز" });
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const openSubModal = (r: Restaurant) => {
    setSubForm({
      isSubscribed: r.isSubscribed,
      plan: r.subscriptionPlan ?? "basic",
      months: 1,
    });
    setSubModal({
      restaurantId: r.id,
      name: r.name,
      current: r.isSubscribed,
      plan: r.subscriptionPlan ?? "free",
      expires: r.subscriptionExpiresAt,
    });
  };

  const saveSubscription = async () => {
    if (!subModal) return;
    setSubLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/restaurants/${subModal.restaurantId}/subscription`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          isSubscribed: subForm.isSubscribed,
          subscriptionPlan: subForm.plan,
          months: subForm.isSubscribed ? subForm.months : 0,
        }),
      });
      if (res.status === 401) {
        toast({ title: "انتهت الجلسة", description: "يرجى تسجيل الدخول مجدداً", variant: "destructive" });
        logout();
        return;
      }
      if (!res.ok) throw new Error("فشل التحديث");
      toast({ title: subForm.isSubscribed ? "✅ تم تفعيل الاشتراك" : "⏹ تم إلغاء الاشتراك" });
      setSubModal(null);
      fetchRestaurants();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setSubLoading(false);
  };

  const filtered = restaurants.filter((r) => {
    if (filter === "الكل") return true;
    if (filter === "انتظار") return r.status === "pending";
    if (filter === "معتمد") return r.status === "approved";
    if (filter === "مرفوض") return r.status === "rejected";
    return true;
  });

  const totalOrders    = restaurants.reduce((s, r) => s + Number(r.orderCount ?? 0), 0);
  const subscribedCount = restaurants.filter((r) => r.isSubscribed).length;
  const pendingCount   = restaurants.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Home className="w-7 h-7 text-primary" /> إدارة منازل المناسبات
          </h1>
          {pendingCount > 0 && (
            <p className="text-yellow-400 text-sm mt-1">⚠️ {pendingCount} منزل مناسبات بانتظار المراجعة</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all"
          >
            <Plus className="w-4 h-4" /> إضافة منزل مناسبات جديد
          </button>
          <button
            onClick={fetchRestaurants}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> تحديث
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "إجمالي",    count: restaurants.length,                        color: "text-white" },
          { label: "معتمد",    count: restaurants.filter((r) => r.status === "approved").length, color: "text-green-400" },
          { label: "مشتركون", count: subscribedCount,                             color: "text-yellow-400" },
          { label: "طلبات",    count: totalOrders,                                color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.count}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              filter === tab
                ? "bg-primary text-white"
                : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Home className="w-14 h-14 text-white/10" />
          <p className="text-white/40">لا توجد منازل مناسبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const status = STATUS_MAP[r.status];
            const plan   = PLAN_MAP[r.subscriptionPlan ?? "free"] ?? PLAN_MAP.free;
            const expDate = r.subscriptionExpiresAt
              ? new Date(r.subscriptionExpiresAt).toLocaleDateString("ar-DZ")
              : null;
            const expired = r.subscriptionExpiresAt
              ? new Date(r.subscriptionExpiresAt) < new Date()
              : false;

            return (
              <div key={r.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                {/* Row 1: Logo + name + badges */}
                <div className="flex items-start gap-3">
                  {r.logo ? (
                    <img src={r.logo} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-lg">{r.name[0]}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white">{r.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${status.color}`}>
                        {status.label}
                      </span>
                      {r.isFeatured && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">
                          <Flame className="w-3 h-3" /> مميز
                        </span>
                      )}
                      {r.isSubscribed && !expired && (
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${plan.color}`}>
                          <Crown className="w-3 h-3" /> {plan.label}
                        </span>
                      )}
                      {r.isSubscribed && expired && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border text-red-400 bg-red-400/10 border-red-400/25">
                          منتهي
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/40 mt-0.5">{r.category}</p>

                    {/* Location + time + rating */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.address}</span>
                      {r.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.estimatedDeliveryMinutes} دقيقة</span>
                      {Number(r.rating) > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Star className="w-3 h-3 fill-yellow-400" />{Number(r.rating).toFixed(1)} ({r.ratingCount})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 2: Owner + stats + subscription info */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {/* Owner info */}
                  <div className="rounded-xl bg-white/3 border border-white/8 p-3">
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wide">المالك</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <User className="w-3 h-3 text-white/30 shrink-0" />
                        <span className="truncate">{r.ownerName ?? "—"}</span>
                      </div>
                      {r.ownerPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-white/70">
                          <Phone className="w-3 h-3 text-white/30 shrink-0" />
                          <span dir="ltr">{r.ownerPhone}</span>
                        </div>
                      )}
                      {r.ownerEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Mail className="w-3 h-3 text-white/30 shrink-0" />
                          <span className="truncate">{r.ownerEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats + subscription */}
                  <div className="rounded-xl bg-white/3 border border-white/8 p-3">
                    <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wide">الإحصائيات</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <ShoppingBag className="w-3 h-3 text-primary/60 shrink-0" />
                        <span>{Number(r.orderCount)} طلب</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-white/70">
                        <UtensilsCrossed className="w-3 h-3 text-white/30 shrink-0" />
                        <span>{Number(r.menuCount)} عنصر في القائمة</span>
                      </div>
                      {r.isSubscribed && expDate && (
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <CalendarDays className="w-3 h-3 text-white/30 shrink-0" />
                          <span className={expired ? "text-red-400" : ""}>
                            {expired ? "انتهى " : "ينتهي "}{expDate}
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] text-white/30 mt-0.5">
                        رسوم: {r.deliveryFee} دج | حد أدنى: {r.minOrder} دج
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {r.status !== "approved" && (
                    <button
                      onClick={() => updateStatus(r.id, "approved")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id + "approved" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      اعتماد
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(r.id, "rejected")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === r.id + "rejected" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      رفض
                    </button>
                  )}
                  <button
                    onClick={() => toggleFeatured(r.id, r.isFeatured)}
                    disabled={!!actionLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
                      r.isFeatured
                        ? "bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25"
                        : "bg-white/5 border-white/15 text-white/50 hover:text-white hover:border-white/30"
                    }`}
                  >
                    {actionLoading === r.id + "feat" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flame className="w-3.5 h-3.5" />}
                    {r.isFeatured ? "إلغاء التمييز" : "تمييز"}
                  </button>
                  {r.status === "approved" && (
                    <button
                      onClick={() => updateStatus(r.id, "pending")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:text-white transition-colors disabled:opacity-50"
                    >
                      إيقاف
                    </button>
                  )}
                  <button
                    onClick={() => openSubModal(r)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      r.isSubscribed && !expired
                        ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25"
                        : "bg-white/5 border-white/15 text-white/50 hover:text-white hover:border-white/30"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    الاشتراك
                  </button>
                  <button
                    onClick={() => handleOpenEdit(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white text-xs font-semibold transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-400" />
                    تعديل التفاصيل
                  </button>
                  <button
                    onClick={() => handleOpenMenu(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    إدارة الخدمات والأسعار ({r.menuCount})
                  </button>
                  <button
                    onClick={() => handleDeleteRestaurant(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-colors mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription Modal */}
      {subModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setSubModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#1a1a2e] border border-white/10 p-5"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-400" /> إدارة اشتراك
              </h3>
              <button onClick={() => setSubModal(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-white/60 mb-4">{subModal.name}</p>

            {/* Current status */}
            {subModal.current && (
              <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300">
                <p>الخطة الحالية: <strong>{PLAN_MAP[subModal.plan]?.label ?? subModal.plan}</strong></p>
                {subModal.expires && (
                  <p className="mt-0.5">تنتهي: {new Date(subModal.expires).toLocaleDateString("ar-DZ")}</p>
                )}
              </div>
            )}

            {/* Toggle */}
            <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-sm text-white/80">تفعيل الاشتراك</span>
              <button
                onClick={() => setSubForm((f) => ({ ...f, isSubscribed: !f.isSubscribed }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${subForm.isSubscribed ? "bg-primary" : "bg-white/20"}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${subForm.isSubscribed ? "right-1" : "right-6"}`}
                />
              </button>
            </div>

            {subForm.isSubscribed && (
              <>
                {/* Plan */}
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-2">الخطة</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["basic", "premium", "free"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSubForm((f) => ({ ...f, plan: p }))}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          subForm.plan === p
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {PLAN_MAP[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-2">المدة (أشهر)</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        onClick={() => setSubForm((f) => ({ ...f, months: m }))}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                          subForm.months === m
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              onClick={saveSubscription}
              disabled={subLoading}
              className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {subForm.isSubscribed ? "تفعيل الاشتراك" : "إلغاء الاشتراك"}
            </button>
          </div>
        </div>
      )}

      {/* Create Event House Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Home className="w-5 h-5 text-primary" /> إضافة منزل مناسبات جديد
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">اسم منزل المناسبات *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="مثال: فيلا الياسمين للمناسبات"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">وصف مختصر</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary h-20 resize-none"
                  placeholder="وصف تفصيلي للخدمات والمزايا المتوفرة..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">العنوان / الموقع *</label>
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    placeholder="مثال: الجزائر العاصمة"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    placeholder="مثال: 0555123456"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">التأمين (دج)</label>
                  <input
                    type="text"
                    value={createForm.deliveryFee}
                    onChange={(e) => setCreateForm({ ...createForm, deliveryFee: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    placeholder="مثال: 5000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">الحد الأدنى للحجز (دج)</label>
                  <input
                    type="text"
                    value={createForm.minOrder}
                    onChange={(e) => setCreateForm({ ...createForm, minOrder: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                    placeholder="مثال: 15000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">الفئة</label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#131324] border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="عام">عام</option>
                    <option value="قاعات حفلات">قاعات حفلات</option>
                    <option value="شاليهات وفيلات">شاليهات وفيلات</option>
                    <option value="خيم تقليدية">خيم تقليدية</option>
                    <option value="فنادق ومطاعم">فنادق ومطاعم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">مدة تأكيد الطلب (بالدقائق)</label>
                  <input
                    type="number"
                    value={createForm.estimatedDeliveryMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, estimatedDeliveryMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs text-white/50 mb-2">شعار منزل المناسبات (Logo)</label>
                  {createForm.logo ? (
                    <div className="relative w-24 h-24 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                      <img src={createForm.logo} alt="Logo" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setCreateForm({ ...createForm, logo: "" })}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border border-dashed border-white/20 hover:border-primary/50 cursor-pointer bg-white/5 transition-colors">
                      {logoProgress !== null ? (
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-1" />
                          <span className="text-[10px] text-white/70">{logoProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-white/40 mb-1" />
                          <span className="text-[10px] text-white/50">اختر شعار</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, "logo", false);
                        }}
                        disabled={logoProgress !== null}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-white/50 mb-2">صورة الغلاف (Cover)</label>
                  {createForm.coverImage ? (
                    <div className="relative w-full h-24 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                      <img src={createForm.coverImage} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setCreateForm({ ...createForm, coverImage: "" })}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border border-dashed border-white/20 hover:border-primary/50 cursor-pointer bg-white/5 transition-colors">
                      {coverProgress !== null ? (
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-1" />
                          <span className="text-[10px] text-white/70">{coverProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-white/40 mb-1" />
                          <span className="text-[10px] text-white/50">اختر غلاف</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, "cover", false);
                        }}
                        disabled={coverProgress !== null}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-sm transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleCreateRestaurant}
                disabled={createLoading}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                إضافة وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event House Modal */}
      {isEditModalOpen && editingRestaurant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#1a1a2e] border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" /> تعديل تفاصيل منزل المناسبات
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">اسم منزل المناسبات *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="اسم منزل المناسبات"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">وصف مختصر</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary h-20 resize-none"
                  placeholder="الوصف..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">العنوان *</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">التأمين (دج)</label>
                  <input
                    type="text"
                    value={editForm.deliveryFee}
                    onChange={(e) => setEditForm({ ...editForm, deliveryFee: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">الحد الأدنى للحجز (دج)</label>
                  <input
                    type="text"
                    value={editForm.minOrder}
                    onChange={(e) => setEditForm({ ...editForm, minOrder: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">الفئة</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#131324] border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="عام">عام</option>
                    <option value="قاعات حفلات">قاعات حفلات</option>
                    <option value="شاليهات وفيلات">شاليهات وفيلات</option>
                    <option value="خيم تقليدية">خيم تقليدية</option>
                    <option value="فنادق ومطاعم">فنادق ومطاعم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">مدة تأكيد الطلب (بالدقائق)</label>
                  <input
                    type="number"
                    value={editForm.estimatedDeliveryMinutes}
                    onChange={(e) => setEditForm({ ...editForm, estimatedDeliveryMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs text-white/50 mb-2">شعار منزل المناسبات (Logo)</label>
                  {editForm.logo ? (
                    <div className="relative w-24 h-24 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                      <img src={editForm.logo} alt="Logo" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditForm({ ...editForm, logo: "" })}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border border-dashed border-white/20 hover:border-primary/50 cursor-pointer bg-white/5 transition-colors">
                      {logoProgress !== null ? (
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-1" />
                          <span className="text-[10px] text-white/70">{logoProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-white/40 mb-1" />
                          <span className="text-[10px] text-white/50">اختر شعار</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, "logo", true);
                        }}
                        disabled={logoProgress !== null}
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-white/50 mb-2">صورة الغلاف (Cover)</label>
                  {editForm.coverImage ? (
                    <div className="relative w-full h-24 rounded-xl border border-white/10 overflow-hidden bg-white/5">
                      <img src={editForm.coverImage} alt="Cover" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setEditForm({ ...editForm, coverImage: "" })}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 rounded-xl border border-dashed border-white/20 hover:border-primary/50 cursor-pointer bg-white/5 transition-colors">
                      {coverProgress !== null ? (
                        <div className="text-center">
                          <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto mb-1" />
                          <span className="text-[10px] text-white/70">{coverProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-white/40 mb-1" />
                          <span className="text-[10px] text-white/50">اختر غلاف</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadImage(file, "cover", true);
                        }}
                        disabled={coverProgress !== null}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm text-white/80">حالة المنزل (نشط / مفتوح للحجز)</span>
                <button
                  onClick={() => setEditForm({ ...editForm, isOpen: !editForm.isOpen })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isOpen ? "bg-green-500" : "bg-white/20"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editForm.isOpen ? "right-1" : "right-6"}`}
                  />
                </button>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-sm transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleEditRestaurant}
                disabled={editLoading}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu / Pricing Packages Modal */}
      {isMenuModalOpen && menuRestaurant && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setIsMenuModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#121222] border border-white/10 p-6 max-h-[85vh] flex flex-col"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" /> إدارة خدمات وأسعار: {menuRestaurant.name}
                </h3>
                <p className="text-xs text-white/40 mt-1">أضف باقات الحجز أو الخدمات الإضافية المتاحة وحدد أسعارها</p>
              </div>
              <button onClick={() => setIsMenuModalOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu items list */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {menuLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : menuItems.length === 0 ? (
                <div className="text-center py-12 bg-white/3 rounded-xl border border-dashed border-white/10">
                  <DollarSign className="w-10 h-10 text-white/10 mx-auto mb-2" />
                  <p className="text-sm text-white/40">لا توجد خدمات أو أسعار مضافة لهذا المنزل بعد</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {menuItems.map((item) => (
                    <div key={item.id} className="rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-sm text-white">{item.name}</h4>
                          <span className="text-xs font-black text-primary shrink-0 bg-primary/10 px-2 py-0.5 rounded-lg">
                            {item.price} دج
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-white/40 mt-1 line-clamp-2">{item.description}</p>
                        )}
                        <span className="text-[10px] text-white/30 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md mt-2 inline-block">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-white/5 shrink-0">
                        <button
                          onClick={() => handleOpenMenuItemForm(item)}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3" /> تعديل
                        </button>
                        <span className="text-white/10 text-xs">|</span>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 shrink-0 flex justify-between items-center">
              <button
                onClick={() => handleOpenMenuItemForm()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-colors shadow-[0_0_10px_rgba(168,85,247,0.3)]"
              >
                <Plus className="w-4 h-4" /> إضافة خدمة / باقة جديدة
              </button>
              <button
                onClick={() => setIsMenuModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-sm transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MenuItem Form SubModal */}
      {isMenuItemFormOpen && menuRestaurant && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsMenuItemFormOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#18182a] border border-white/10 p-5 shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="font-bold text-white text-md flex items-center gap-1.5">
                {editingMenuItem ? <Edit className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />}
                {editingMenuItem ? "تعديل الخدمة/الباقة" : "إضافة خدمة/باقة جديدة"}
              </h3>
              <button onClick={() => setIsMenuItemFormOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">اسم الخدمة أو باقة الحجز *</label>
                <input
                  type="text"
                  value={menuItemForm.name}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="مثال: حجز كامل لمدة 24 ساعة"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">السعر (دج) *</label>
                <input
                  type="text"
                  value={menuItemForm.price}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, price: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="مثال: 35000"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">تصنيف الخدمة</label>
                <input
                  type="text"
                  value={menuItemForm.category}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="مثال: باقات الحجز أو خدمات إضافية"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1">وصف تفصيلي للخدمة</label>
                <textarea
                  value={menuItemForm.description}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-primary h-16 resize-none"
                  placeholder="تفاصيل العرض، كالمرافق المتاحة، شروط الحجز..."
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setIsMenuItemFormOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveMenuItem}
                disabled={menuItemLoading}
                className="px-4.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {menuItemLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                حفظ الخدمة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
