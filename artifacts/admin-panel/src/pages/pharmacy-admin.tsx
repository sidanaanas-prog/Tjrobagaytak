import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pill, Users, Percent, Trash2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Edit2, Save, UserPlus, Package } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");
const token = () => localStorage.getItem("glow_admin_token") || "";
const auth = () => ({ Authorization: `Bearer ${token()}` });
const authJson = () => ({ ...auth(), "Content-Type": "application/json" });

type Pharmacy = { id: string; name: string; ownerPhone: string; commissionRate: string; isActive: boolean; phone: string; address: string; workHours: string };
type Staff = { id: string; name: string; phone: string; specialty: string; status: string };
type Worker = { id: string; name: string; phone: string; specialty: string; status: string };
type Revenue = { totalSales: string; totalCommission: string; prescriptionsCount: number; appointmentsCount: number };

function Badge({ active }: { active: boolean }) {
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>{active ? "نشط" : "معطّل"}</span>;
}

export default function PharmacyAdminPage() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [staff, setStaff] = useState<Record<string, Staff[]>>({});
  const [revenue, setRevenue] = useState<Record<string, Revenue>>({});

  // نموذج إضافة صيدلية
  const [name, setName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [commissionRate, setCommissionRate] = useState("10");
  const [workHours, setWorkHours] = useState("8:00 - 22:00");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // نموذج إضافة طاقم
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffSpecialty, setStaffSpecialty] = useState("طبيب");
  const [addingStaff, setAddingStaff] = useState(false);

  // تعديل عمولة
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [newCommission, setNewCommission] = useState("");

  // تعديل رقم المالك
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");

  // تعديل رقم العرض (phone)
  const [editingDisplayPhone, setEditingDisplayPhone] = useState<string | null>(null);
  const [newDisplayPhone, setNewDisplayPhone] = useState("");

  // تعديل ساعات العمل
  const [editingWorkHours, setEditingWorkHours] = useState<string | null>(null);
  const [newWorkHours, setNewWorkHours] = useState("");

  // إدارة العمال
  const [workers, setWorkers] = useState<Record<string, Worker[]>>({});
  const [workerName, setWorkerName] = useState("");
  const [workerPhone, setWorkerPhone] = useState("");
  const [addingWorker, setAddingWorker] = useState<string | null>(null);
  const [workerError, setWorkerError] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await fetch(`${BASE}/api/admin/pharmacies`, { headers: auth() });
    if (res.ok) setPharmacies(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const expand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    const [r1, r2] = await Promise.all([
      fetch(`${BASE}/api/admin/pharmacies/${id}/staff`, { headers: auth() }),
      fetch(`${BASE}/api/admin/pharmacies/${id}/revenue`, { headers: auth() }),
    ]);
    if (r1.ok) {
      const staffData: Worker[] = await r1.json();
      setWorkers(prev => ({ ...prev, [id]: staffData }));
    }
    if (r2.ok) { const data = await r2.json(); setRevenue(prev => ({ ...prev, [id]: data })); }
  };

  const addWorker = async (pharmacyId: string) => {
    if (!workerName.trim() || !workerPhone.trim()) { setWorkerError("الاسم والهاتف مطلوبان"); return; }
    setWorkerError(""); setAddingWorker(pharmacyId);
    const res = await fetch(`${BASE}/api/admin/pharmacies/${pharmacyId}/staff`, {
      method: "POST", headers: authJson(),
      body: JSON.stringify({ name: workerName.trim(), phone: workerPhone.trim(), specialty: "عامل استقبال" }),
    });
    setAddingWorker(null);
    if (!res.ok) { const d = await res.json(); setWorkerError(d.error || "حدث خطأ"); return; }
    setWorkerName(""); setWorkerPhone("");
    const r = await fetch(`${BASE}/api/admin/pharmacies/${pharmacyId}/staff`, { headers: auth() });
    if (r.ok) { const data: Worker[] = await r.json(); setWorkers(prev => ({ ...prev, [pharmacyId]: data })); }
  };

  const deleteWorker = async (pharmacyId: string, staffId: string) => {
    await fetch(`${BASE}/api/admin/pharmacies/${pharmacyId}/staff/${staffId}`, { method: "DELETE", headers: auth() });
    const r = await fetch(`${BASE}/api/admin/pharmacies/${pharmacyId}/staff`, { headers: auth() });
    if (r.ok) { const data: Worker[] = await r.json(); setWorkers(prev => ({ ...prev, [pharmacyId]: data })); }
  };

  const handleAdd = async () => {
    if (!name || !ownerPhone) { setAddError("الاسم ورقم المالك مطلوبان"); return; }
    setAdding(true); setAddError("");
    const res = await fetch(`${BASE}/api/admin/pharmacies`, {
      method: "POST", headers: authJson(),
      body: JSON.stringify({ name, ownerPhone, phone, address, commissionRate, workHours }),
    });
    if (!res.ok) { const d = await res.json(); setAddError(d.error || "حدث خطأ"); setAdding(false); return; }
    setName(""); setOwnerPhone(""); setPhone(""); setAddress(""); setCommissionRate("10");
    setShowAdd(false); setAdding(false);
    load();
  };

  const toggleActive = async (p: Pharmacy) => {
    await fetch(`${BASE}/api/admin/pharmacies/${p.id}`, {
      method: "PATCH", headers: authJson(), body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  };

  const saveCommission = async (id: string) => {
    await fetch(`${BASE}/api/admin/pharmacies/${id}`, {
      method: "PATCH", headers: authJson(), body: JSON.stringify({ commissionRate: newCommission }),
    });
    setEditingCommission(null);
    load();
  };

  const savePhone = async (id: string) => {
    await fetch(`${BASE}/api/admin/pharmacies/${id}`, {
      method: "PATCH", headers: authJson(), body: JSON.stringify({ ownerPhone: newPhone, phone: newPhone }),
    });
    setEditingPhone(null);
    load();
  };

  const saveDisplayPhone = async (id: string) => {
    await fetch(`${BASE}/api/admin/pharmacies/${id}`, {
      method: "PATCH", headers: authJson(), body: JSON.stringify({ phone: newDisplayPhone }),
    });
    setEditingDisplayPhone(null);
    load();
  };

  const saveWorkHours = async (id: string) => {
    await fetch(`${BASE}/api/admin/pharmacies/${id}`, {
      method: "PATCH", headers: authJson(), body: JSON.stringify({ workHours: newWorkHours }),
    });
    setEditingWorkHours(null);
    load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Pill className="w-6 h-6 text-emerald-400" /> إدارة الصيدليات
          </h1>
          <p className="text-sm text-white/40 mt-0.5">أضف الصيدليات وتحكم في العمولات</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition-all">
          <Plus className="w-4 h-4" /> إضافة صيدلية
        </button>
      </div>

      {/* نموذج الإضافة */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">صيدلية جديدة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 block mb-1">اسم الصيدلية *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="مؤسسة الشفاء"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">رقم المالك *</label>
                <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="0700000000" type="tel"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">رقم الصيدلية</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="للعرض للمستخدمين" type="tel"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">العمولة %</label>
                <input value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="10" type="number" min="0" max="100"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">العنوان</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="الحي، المدينة"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1">ساعات العمل</label>
                <input value={workHours} onChange={e => setWorkHours(e.target.value)} placeholder="8:00 - 22:00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50" />
              </div>
            </div>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAdd} disabled={adding}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/30 transition-all disabled:opacity-40">
                {adding ? "جاري الإضافة..." : "إضافة الصيدلية"}
              </button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 font-bold text-sm">إلغاء</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* قائمة الصيدليات */}
      {loading ? (
        <div className="text-center py-12 text-white/30">جاري التحميل...</div>
      ) : pharmacies.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <Pill className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">لا توجد صيدليات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pharmacies.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              {/* الصف الرئيسي */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{p.name}</span>
                    <Badge active={p.isActive} />
                  </div>
                  <div className="flex items-center gap-1">
                    {editingPhone === p.id ? (
                      <div className="flex items-center gap-1">
                        <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                          type="tel" placeholder="0700000000"
                          className="w-32 bg-white/5 border border-primary/40 rounded-lg px-2 py-0.5 text-xs text-white outline-none" />
                        <button onClick={() => savePhone(p.id)} className="text-emerald-400 hover:text-emerald-300"><Save className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditingPhone(null)} className="text-white/30 hover:text-white/50"><XCircle className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingPhone(p.id); setNewPhone(p.ownerPhone); }}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-all group">
                        <span>{p.ownerPhone}</span>
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                    {p.address && <span className="text-xs text-white/30">· {p.address}</span>}
                  </div>
                </div>

                {/* العمولة */}
                <div className="flex items-center gap-2">
                  {editingCommission === p.id ? (
                    <div className="flex items-center gap-1">
                      <input value={newCommission} onChange={e => setNewCommission(e.target.value)}
                        className="w-16 bg-white/5 border border-primary/40 rounded-lg px-2 py-1 text-sm text-white text-center outline-none" />
                      <span className="text-white/40 text-xs">%</span>
                      <button onClick={() => saveCommission(p.id)} className="text-emerald-400 hover:text-emerald-300"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setEditingCommission(null)} className="text-white/30 hover:text-white/50"><XCircle className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingCommission(p.id); setNewCommission(p.commissionRate); }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all">
                      <Percent className="w-3 h-3" />{p.commissionRate}%
                      <Edit2 className="w-3 h-3 opacity-60" />
                    </button>
                  )}
                </div>

                <button onClick={() => toggleActive(p)}
                  className={`p-2 rounded-lg border transition-all ${p.isActive ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"}`}>
                  {p.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>

                <button onClick={() => expand(p.id)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
                  {expanded === p.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* تفاصيل موسعة */}
              <AnimatePresence>
                {expanded === p.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 px-4 py-4 space-y-4 overflow-hidden">

                    {/* تقرير الإيرادات */}
                    {revenue[p.id] && (
                      <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">📊 تقرير الإيرادات</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "إجمالي المبيعات", value: `${revenue[p.id].totalSales} دورو`, color: "text-white" },
                            { label: "عمولتك", value: `${revenue[p.id].totalCommission} دورو`, color: "text-primary" },
                            { label: "طلبات وصفات", value: revenue[p.id].prescriptionsCount, color: "text-emerald-400" },
                            { label: "حجوزات", value: revenue[p.id].appointmentsCount, color: "text-blue-400" },
                          ].map((s) => (
                            <div key={s.label} className="rounded-xl bg-white/5 border border-white/5 p-3 text-center">
                              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* عمال الاستقبال */}
                    <div>
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-amber-400" /> عمال استقبال الطلبيات
                      </h4>

                      {/* قائمة العمال الحاليين */}
                      <div className="space-y-2 mb-3">
                        {(workers[p.id] ?? []).filter(w => w.specialty === "عامل استقبال" && w.status !== "removed").map(w => (
                          <div key={w.id} className="flex items-center justify-between rounded-xl bg-white/5 border border-amber-500/10 px-3 py-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <Package className="w-3.5 h-3.5 text-amber-400" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white">{w.name}</p>
                                <p className="text-xs text-white/40">{w.phone}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${w.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                                {w.status === "active" ? "نشط" : "في الانتظار"}
                              </span>
                              <button onClick={() => deleteWorker(p.id, w.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {(workers[p.id] ?? []).filter(w => w.specialty === "عامل استقبال" && w.status !== "removed").length === 0 && (
                          <p className="text-xs text-white/30 text-center py-2">لا يوجد عمال مضافون</p>
                        )}
                      </div>

                      {/* نموذج إضافة عامل */}
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                        <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5" /> إضافة عامل جديد
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={workerName} onChange={e => setWorkerName(e.target.value)}
                            placeholder="اسم العامل" className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
                          <input value={workerPhone} onChange={e => setWorkerPhone(e.target.value)}
                            placeholder="رقم الهاتف" type="tel" className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
                        </div>
                        {workerError && <p className="text-red-400 text-xs">{workerError}</p>}
                        <button onClick={() => addWorker(p.id)} disabled={addingWorker === p.id}
                          className="w-full py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs hover:bg-amber-500/30 transition-all disabled:opacity-40">
                          {addingWorker === p.id ? "جاري الإضافة..." : "إضافة العامل"}
                        </button>
                      </div>
                    </div>

                    {/* معلومات الصيدلية — قابلة للتعديل */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* هاتف العرض */}
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <p className="text-[10px] text-white/40 mb-1">📞 هاتف العرض للعملاء</p>
                        {editingDisplayPhone === p.id ? (
                          <div className="flex items-center gap-1">
                            <input value={newDisplayPhone} onChange={e => setNewDisplayPhone(e.target.value)}
                              type="tel" className="flex-1 bg-white/5 border border-primary/40 rounded-lg px-2 py-0.5 text-xs text-white outline-none" />
                            <button onClick={() => saveDisplayPhone(p.id)} className="text-emerald-400 hover:text-emerald-300"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingDisplayPhone(null)} className="text-white/30 hover:text-white/50"><XCircle className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingDisplayPhone(p.id); setNewDisplayPhone(p.phone || ""); }}
                            className="flex items-center gap-1 text-xs text-white/70 hover:text-white group w-full">
                            <span className="flex-1 text-right">{p.phone || "-"}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </button>
                        )}
                      </div>

                      {/* ساعات العمل */}
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <p className="text-[10px] text-white/40 mb-1">🕐 ساعات العمل</p>
                        {editingWorkHours === p.id ? (
                          <div className="flex items-center gap-1">
                            <input value={newWorkHours} onChange={e => setNewWorkHours(e.target.value)}
                              placeholder="8:00 - 22:00" className="flex-1 bg-white/5 border border-primary/40 rounded-lg px-2 py-0.5 text-xs text-white outline-none" />
                            <button onClick={() => saveWorkHours(p.id)} className="text-emerald-400 hover:text-emerald-300"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingWorkHours(null)} className="text-white/30 hover:text-white/50"><XCircle className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingWorkHours(p.id); setNewWorkHours(p.workHours || "8:00 - 22:00"); }}
                            className="flex items-center gap-1 text-xs text-white/70 hover:text-white group w-full">
                            <span className="flex-1 text-right">{p.workHours || "-"}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
