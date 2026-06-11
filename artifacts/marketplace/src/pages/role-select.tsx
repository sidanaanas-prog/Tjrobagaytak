import { useState, useEffect } from "react";
import { useAuth, getMemToken } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-url";
import { motion } from "framer-motion";
import { Store, Car, ShoppingBag, UserCheck, ArrowLeft, Check, Loader2 } from "lucide-react";

const BASE = getApiUrl("");

const ROLES = [
  {
    id: "seller",
    label: "بائع",
    desc: "أبيع منتجاتي على المنصة",
    icon: Store,
    color: "from-violet-500/20 to-violet-500/5",
    border: "border-violet-500/30",
    text: "text-violet-400",
  },
  {
    id: "driver",
    label: "سائق",
    desc: "أوصل ركاب وأربح من كورسا",
    icon: Car,
    color: "from-orange-500/20 to-orange-500/5",
    border: "border-orange-500/30",
    text: "text-orange-400",
  },
  {
    id: "passenger",
    label: "راكب",
    desc: "أحجز كورسا بسرعة وأمان",
    icon: ShoppingBag,
    color: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  {
    id: "shopper",
    label: "متسوق",
    desc: "أشتري من متاجر موثقة",
    icon: UserCheck,
    color: "from-green-500/20 to-green-500/5",
    border: "border-green-500/30",
    text: "text-green-400",
  },
];

export default function RoleSelectPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<string[]>([]);
  const [myRoles, setMyRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getMemToken();
    if (!token) { navigate("/login"); return; }
    fetch(`${BASE}/api/user/roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((roles: string[]) => {
        setMyRoles(roles);
        setSelected(roles);
        setLoading(false);
      });
  }, [navigate]);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    const token = getMemToken();

    // Add new roles
    for (const role of selected) {
      if (!myRoles.includes(role)) {
        await fetch(`${BASE}/api/user/roles`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ role }),
        });
      }
    }

    // Remove deselected
    for (const role of myRoles) {
      if (!selected.includes(role)) {
        await fetch(`${BASE}/api/user/roles/${role}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    // Save first selected as active
    if (selected.length > 0) {
      localStorage.setItem("gaytak_active_role", selected[0]);
    }

    setSaving(false);
    toast({ title: "✅ تم!", description: "تم حفظ أدوارك" });

    // إذا تم إضافة دور السائق لأول مرة → انتقال لصفحة التسجيل
    const isNewDriver = selected.includes("driver") && !myRoles.includes("driver");
    if (isNewDriver) {
      navigate("/driver-register");
    } else {
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-5 flex flex-col" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate("/")} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black">اختر أدوارك</h1>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        ما هي الطريقة التي تريد استخدام Gaytak؟ يمكنك اختيار أكثر من واحد.
      </p>

      <div className="space-y-3 flex-1">
        {ROLES.map((role) => {
          const isSelected = selected.includes(role.id);
          const Icon = role.icon;
          return (
            <motion.button
              key={role.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => toggle(role.id)}
              className={`w-full p-4 rounded-2xl border text-right transition-all ${
                isSelected ? `${role.border} ${role.color} bg-gradient-to-br` : "border-white/10 bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                  <Icon className={`w-6 h-6 ${isSelected ? role.text : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`font-bold ${isSelected ? role.text : "text-foreground"}`}>{role.label}</p>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{role.desc}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || selected.length === 0}
        className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors mt-4 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {selected.length === 0 ? "اختر دوراً واحداً على الأقل" : "حفظ وابدأ"}
      </button>
    </div>
  );
}
