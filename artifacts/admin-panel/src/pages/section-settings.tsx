import { useEffect, useState } from "react";
import { Eye, EyeOff, Layers, Loader2, Pill, Save, ShoppingCart } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");
const token = () => localStorage.getItem("glow_admin_token") || "";
const auth = () => ({ Authorization: `Bearer ${token()}` });
const authJson = () => ({ ...auth(), "Content-Type": "application/json" });

type SectionKey = "section_pharmacy_enabled" | "section_wholesale_enabled";
type VisibilityState = Record<SectionKey, boolean>;

const DEFAULTS: VisibilityState = {
  section_pharmacy_enabled: true,
  section_wholesale_enabled: false,
};

const sections: Array<{
  key: SectionKey;
  title: string;
  description: string;
  note: string;
  icon: typeof Pill;
  color: string;
}> = [
  {
    key: "section_pharmacy_enabled",
    title: "مؤسسة الشفاء",
    description: "الوصفات الطبية، حجوزات الفحوصات، والاستفسارات الطبية.",
    note: "يشمل كل روابط مؤسسة الشفاء في التطبيق والموقع.",
    icon: Pill,
    color: "emerald",
  },
  {
    key: "section_wholesale_enabled",
    title: "سوق الجملة",
    description: "قسم بيع الملابس والإلكترونيات وقطع الغيار بالجملة.",
    note: "يبقى مخفياً حتى تجهزه وتبدأ نشر المنتجات.",
    icon: ShoppingCart,
    color: "amber",
  },
];

export default function SectionSettingsPage() {
  const [visibility, setVisibility] = useState<VisibilityState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${BASE}/api/admin/settings`, { headers: auth() });
        if (!response.ok) return;
        const settings = await response.json();
        const next = { ...DEFAULTS };
        for (const setting of settings) {
          if (setting.key in next) {
            next[setting.key as SectionKey] = setting.value === "true";
          }
        }
        setVisibility(next);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleSection = async (key: SectionKey) => {
    const value = !visibility[key];
    setSaving(key);
    setMessage("");
    try {
      const response = await fetch(`${BASE}/api/admin/settings/${key}`, {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ value: String(value) }),
      });
      if (!response.ok) throw new Error("save_failed");
      setVisibility((current) => ({ ...current, [key]: value }));
      setMessage("تم حفظ إعدادات الظهور");
    } catch {
      setMessage("تعذر حفظ الإعداد، حاول مرة أخرى");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">إدارة ظهور الأقسام</h1>
            <p className="text-sm text-white/40 mt-1">تحكم بما يظهر للعملاء من التطبيق والموقع</p>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/50">
          <Loader2 className="w-5 h-5 animate-spin ml-2" /> جاري تحميل الإعدادات...
        </div>
      ) : (
        <div className="grid gap-4 max-w-3xl">
          {sections.map((section) => {
            const enabled = visibility[section.key];
            const Icon = section.icon;
            const colorClasses = section.color === "emerald"
              ? { icon: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", button: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" }
              : { icon: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10", button: "bg-amber-500/20 text-amber-300 border-amber-500/30" };

            return (
              <div key={section.key} className={`rounded-2xl border ${enabled ? colorClasses.border : "border-white/10"} bg-card/70 p-5`}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${colorClasses.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-6 h-6 ${colorClasses.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black text-white">{section.title}</h2>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${enabled ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/5 text-white/40 border-white/10"}`}>
                        {enabled ? "ظاهر للعملاء" : "مخفي"}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 mt-2">{section.description}</p>
                    <p className="text-xs text-white/35 mt-1">{section.note}</p>
                  </div>
                  <button
                    onClick={() => toggleSection(section.key)}
                    disabled={saving === section.key}
                    className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${enabled ? "bg-red-500/10 text-red-300 border-red-500/20 hover:bg-red-500/20" : colorClasses.button}`}
                  >
                    {saving === section.key ? <Loader2 className="w-4 h-4 animate-spin" /> : enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {enabled ? "إخفاء القسم" : "إظهار القسم"}
                  </button>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-white/35">
                  <Save className="w-3.5 h-3.5" />
                  التغيير يُحفظ مباشرة ويظهر بعد تحديث التطبيق أو الموقع.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}