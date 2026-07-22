import { useState, useEffect, useMemo } from "react";
import { getApiUrl } from "@/lib/api-url";
import { 
  FileText, 
  Printer, 
  Plus, 
  RefreshCw, 
  Save, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  User, 
  Trash2, 
  Edit3, 
  Search,
  Calendar,
  AlertTriangle,
  Car,
  Phone,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const BASE = getApiUrl("");

export interface MemoDriverRow {
  id: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  vehicleInfo: string;
  confirmedRides: number;
  cancelledRides: number;
  totalRideAmount: number; // د.ج / دورو
  debtAmount: number; // العمولة أو الدين المستحق
  paymentStatus: "paid" | "unpaid" | "partial";
  paidAmount: number;
  notes: string;
  isAutoFetched?: boolean;
}

export default function DriverMemoPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  
  const [memoRows, setMemoRows] = useState<MemoDriverRow[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [allRides, setAllRides] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal / Add Driver state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [customDriverName, setCustomDriverName] = useState<string>("");
  const [customPhone, setCustomPhone] = useState<string>("");
  const [customVehicle, setCustomVehicle] = useState<string>("");
  const [confirmedInput, setConfirmedInput] = useState<number>(0);
  const [cancelledInput, setCancelledInput] = useState<number>(0);
  const [totalFareInput, setTotalFareInput] = useState<number>(0);
  const [debtInput, setDebtInput] = useState<number>(0);
  const [paymentStatusInput, setPaymentStatusInput] = useState<"paid" | "unpaid" | "partial">("unpaid");
  const [notesInput, setNotesInput] = useState<string>("");

  // Editing Row state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Load Drivers and Rides
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("glow_admin_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [driversRes, ridesRes] = await Promise.all([
        fetch(`${BASE}/api/admin/drivers?t=${Date.now()}`, { headers }),
        fetch(`${BASE}/api/admin/rides?t=${Date.now()}`, { headers }),
      ]);

      if (driversRes.ok) {
        const drivers = await driversRes.json();
        setAvailableDrivers(drivers);
      }

      if (ridesRes.ok) {
        const rides = await ridesRes.json();
        setAllRides(rides);
      }
    } catch (err) {
      console.error("Error fetching admin data for memo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Load memo rows from localStorage or auto-generate on date change
  useEffect(() => {
    const storageKey = `gaytak_driver_memo_${selectedDate}`;
    const savedMemo = localStorage.getItem(storageKey);
    if (savedMemo) {
      try {
        setMemoRows(JSON.parse(savedMemo));
        return;
      } catch (e) {
        console.error("Failed to parse saved memo:", e);
      }
    }
    // If no saved memo for this date, reset rows
    setMemoRows([]);
  }, [selectedDate]);

  // Auto-sync stats from system rides for selectedDate
  const handleAutoFetchFromSystem = () => {
    if (!allRides.length || !availableDrivers.length) {
      toast({
        title: "⚠️ تنبيه",
        description: "لا توجد بيانات كافية للرحلات والسائقين للجلب التلقائي.",
      });
      return;
    }

    // Filter rides matching selectedDate
    const targetDateStr = selectedDate;
    const dateRides = allRides.filter((r) => {
      const rDate = r.createdAt ? new Date(r.createdAt).toISOString().split("T")[0] : "";
      return rDate === targetDateStr;
    });

    if (dateRides.length === 0) {
      toast({
        title: "ℹ️ معلومة",
        description: `لا توجد رحلات مسجلة بالنظام لليوم المحدد (${selectedDate}).`,
      });
    }

    // Map by driver
    const driverMap: Record<string, MemoDriverRow> = {};

    dateRides.forEach((ride) => {
      if (!ride.driverId) return;
      const driver = availableDrivers.find((d) => d.userId === ride.driverId || d.id === ride.driverId);
      const dId = ride.driverId;

      if (!driverMap[dId]) {
        driverMap[dId] = {
          id: `auto_${dId}_${selectedDate}`,
          driverId: dId,
          driverName: driver?.name || ride.driverName || "سائق غير معروف",
          driverPhone: driver?.phone || ride.driverPhone || "—",
          vehicleInfo: driver ? `${driver.vehicleType || ""} ${driver.vehiclePlate || ""}` : "—",
          confirmedRides: 0,
          cancelledRides: 0,
          totalRideAmount: 0,
          debtAmount: 0,
          paymentStatus: "unpaid",
          paidAmount: 0,
          notes: "جلب تلقائي من النظام",
          isAutoFetched: true,
        };
      }

      const row = driverMap[dId];
      if (ride.status === "completed") {
        row.confirmedRides += 1;
        row.totalRideAmount += Number(ride.price || 0);
        row.debtAmount += Number(ride.commissionDeducted || ride.expectedCommission || 0);
      } else if (ride.status === "cancelled") {
        row.cancelledRides += 1;
      }
    });

    const newRows = Object.values(driverMap);

    // Merge with existing rows (preserve manual edits)
    const existingIds = new Set(memoRows.map((r) => r.driverId));
    const merged = [...memoRows];

    newRows.forEach((row) => {
      if (!existingIds.has(row.driverId)) {
        merged.push(row);
      }
    });

    setMemoRows(merged);
    saveMemoToStorage(merged);

    toast({
      title: "✅ تم الجلب التلقائي بنجاح",
      description: `تم إدراج ${newRows.length} سائق مع إحصائياتهم لليوم (${selectedDate}).`,
    });
  };

  const saveMemoToStorage = (rows: MemoDriverRow[]) => {
    const storageKey = `gaytak_driver_memo_${selectedDate}`;
    localStorage.setItem(storageKey, JSON.stringify(rows));
  };

  const handleSaveMemo = () => {
    saveMemoToStorage(memoRows);
    toast({
      title: "💾 تم حفظ المذكرة",
      description: `تم حفظ مذكرة يوم ${selectedDate} بنجاح.`,
    });
  };

  // Add Row
  const handleAddDriver = () => {
    let name = customDriverName;
    let phone = customPhone;
    let vehicle = customVehicle;
    let driverId = selectedDriverId || `manual_${Date.now()}`;

    if (selectedDriverId) {
      const d = availableDrivers.find((drv) => drv.id === selectedDriverId || drv.userId === selectedDriverId);
      if (d) {
        name = d.name;
        phone = d.phone || "—";
        vehicle = `${d.vehicleType || ""} ${d.vehiclePlate || ""}`;
        driverId = d.userId || d.id;
      }
    }

    if (!name) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار سائق من القائمة أو كتابة اسم السائق.",
      });
      return;
    }

    const newRow: MemoDriverRow = {
      id: `memo_row_${Date.now()}`,
      driverId,
      driverName: name,
      driverPhone: phone || "—",
      vehicleInfo: vehicle || "—",
      confirmedRides: Number(confirmedInput) || 0,
      cancelledRides: Number(cancelledInput) || 0,
      totalRideAmount: Number(totalFareInput) || 0,
      debtAmount: Number(debtInput) || 0,
      paymentStatus: paymentStatusInput,
      paidAmount: paymentStatusInput === "paid" ? Number(debtInput) : 0,
      notes: notesInput || "إدخال يدوي",
    };

    const updated = [newRow, ...memoRows];
    setMemoRows(updated);
    saveMemoToStorage(updated);

    // Reset form
    setShowAddModal(false);
    setSelectedDriverId("");
    setCustomDriverName("");
    setCustomPhone("");
    setCustomVehicle("");
    setConfirmedInput(0);
    setCancelledInput(0);
    setTotalFareInput(0);
    setDebtInput(0);
    setPaymentStatusInput("unpaid");
    setNotesInput("");

    toast({
      title: "✅ تم إضافة السائق للمذكرة",
      description: `تمت إضافة السائق ${name} بنجاح.`,
    });
  };

  // Update Field
  const handleUpdateRowField = (id: string, field: keyof MemoDriverRow, value: any) => {
    const updated = memoRows.map((r) => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setMemoRows(updated);
    saveMemoToStorage(updated);
  };

  // Delete Row
  const handleDeleteRow = (id: string) => {
    const updated = memoRows.filter((r) => r.id !== id);
    setMemoRows(updated);
    saveMemoToStorage(updated);
    toast({
      title: "🗑️ تم الحذف",
      description: "تم حذف السائق من المذكرة.",
    });
  };

  // Toggle Payment Status
  const handleTogglePayment = (id: string) => {
    const updated = memoRows.map((r) => {
      if (r.id === id) {
        const nextStatus = r.paymentStatus === "paid" ? "unpaid" : "paid";
        return {
          ...r,
          paymentStatus: nextStatus,
          paidAmount: nextStatus === "paid" ? r.debtAmount : 0,
        };
      }
      return r;
    });
    setMemoRows(updated);
    saveMemoToStorage(updated);
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Filtered rows for UI search
  const filteredRows = useMemo(() => {
    if (!searchQuery) return memoRows;
    const q = searchQuery.toLowerCase();
    return memoRows.filter(
      (r) =>
        r.driverName.toLowerCase().includes(q) ||
        r.driverPhone.toLowerCase().includes(q) ||
        r.vehicleInfo.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
    );
  }, [memoRows, searchQuery]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalConfirmed = 0;
    let totalCancelled = 0;
    let totalFare = 0;
    let totalDebt = 0;
    let totalPaid = 0;

    memoRows.forEach((r) => {
      totalConfirmed += Number(r.confirmedRides || 0);
      totalCancelled += Number(r.cancelledRides || 0);
      totalFare += Number(r.totalRideAmount || 0);
      totalDebt += Number(r.debtAmount || 0);
      if (r.paymentStatus === "paid") {
        totalPaid += Number(r.debtAmount || 0);
      } else if (r.paymentStatus === "partial") {
        totalPaid += Number(r.paidAmount || 0);
      }
    });

    return {
      driversCount: memoRows.length,
      totalConfirmed,
      totalCancelled,
      totalFare,
      totalDebt,
      totalPaid,
      remainingDebt: totalDebt - totalPaid,
    };
  }, [memoRows]);

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Printable CSS style overlay */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            direction: rtl !important;
            font-size: 11pt !important;
          }
          aside, nav, header, button, .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .print-header {
            display: block !important;
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 15px;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #333 !important;
            padding: 6px 8px !important;
            color: #000 !important;
            font-size: 10pt !important;
            text-align: center !important;
          }
          .print-table th {
            background-color: #f0f0f0 !important;
            font-weight: bold !important;
          }
          .print-footer {
            display: flex !important;
            justify-content: space-between;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px dashed #666;
            font-size: 10pt !important;
          }
        }
        @media screen {
          .print-header, .print-footer {
            display: none;
          }
        }
      `}</style>

      {/* Screen Header & Navigation */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" />
            <span>مذكرة وسجل الكورسات اليومية للسائقين</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            جدول متابعة اليومية للسائقين، الطلبات المؤكدة/الملغاة، والديون للطباعة والتحصيل
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-muted-foreground">التاريخ:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-mono focus:outline-none"
            />
          </div>

          <Button
            onClick={handleAutoFetchFromSystem}
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <RefreshCw className="w-4 h-4" />
            <span>جلب تلقائي من النظام</span>
          </Button>

          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سائق يداوياً</span>
          </Button>

          <Button
            onClick={handleSaveMemo}
            variant="secondary"
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            <span>حفظ المذكرة</span>
          </Button>

          <Button
            onClick={handlePrint}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ طباعة المذكرة</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards (Screen View) */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold">السائقون بالمذكرة</span>
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-mono font-bold">{totals.driversCount}</div>
          <p className="text-[11px] text-muted-foreground mt-1">سائق مسجل بالجدول</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold">طلبات مؤكدة</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">{totals.totalConfirmed}</div>
          <p className="text-[11px] text-muted-foreground mt-1">كورس مكتمل اليوم</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold">طلبات ملغاة</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-rose-400">{totals.totalCancelled}</div>
          <p className="text-[11px] text-muted-foreground mt-1">كورس ملغى اليوم</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold">إجمالي العمولات / الديون</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-400">{totals.totalDebt} <span className="text-xs">د.ج</span></div>
          <p className="text-[11px] text-muted-foreground mt-1">مستحقات التطبيق للأن</p>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold">المبلغ المسدد والـمُحصّل</span>
            <Check className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-blue-400">{totals.totalPaid} <span className="text-xs">د.ج</span></div>
          <p className="text-[11px] text-muted-foreground mt-1">
            المتبقي للتحصيل: <span className="text-rose-400 font-bold">{totals.remainingDebt} د.ج</span>
          </p>
        </div>
      </div>

      {/* Printable Header Section (Appears only during Print) */}
      <div className="print-header">
        <h2 className="text-xl font-bold">تطبيق جيتك (GAYTAK) - مذكرة وسجل الكورسات اليومية</h2>
        <p className="text-sm mt-1">
          <strong>تاريخ المذكرة:</strong> {selectedDate} | <strong>عدد السائقين:</strong> {totals.driversCount} |{" "}
          <strong>الكورسات المؤكدة:</strong> {totals.totalConfirmed} | <strong>إجمالي العمولات المستحقة:</strong> {totals.totalDebt} د.ج
        </p>
      </div>

      {/* Main Ledger Table Area */}
      <div className="print-container bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="no-print flex items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="بحث باسم السائق، الهاتف، أو السيارة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            تنبيه: يمكنك تعديل القيم مباشرة في الجدول أو الضغط على زر السداد للتغيير السريع.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse print-table">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3 text-right">اسم السائق</th>
                <th className="p-3 text-right">الهاتف / السيارة</th>
                <th className="p-3 text-center">طلبات مؤكدة ✅</th>
                <th className="p-3 text-center">طلبات ملغاة ❌</th>
                <th className="p-3 text-center">إجمالي الكورسات (د.ج)</th>
                <th className="p-3 text-center">عمولة التطبيق / الدين (د.ج)</th>
                <th className="p-3 text-center">حالة السداد</th>
                <th className="p-3 text-right">ملاحظات</th>
                <th className="p-3 text-center no-print w-24">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="font-bold">المذكرة فارغة لهذا اليوم ({selectedDate})</p>
                    <p className="text-xs mt-1">اضغط على "جلب تلقائي من النظام" أو "إضافة سائق يداوياً" للبدء.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3 text-center font-mono font-bold text-muted-foreground">
                      {idx + 1}
                    </td>

                    {/* Driver Name */}
                    <td className="p-3 font-bold">
                      <div className="flex items-center gap-2">
                        <span>{row.driverName}</span>
                        {row.isAutoFetched && (
                          <span className="no-print bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded border border-primary/20">
                            تلقائي
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Phone & Vehicle */}
                    <td className="p-3 text-xs text-muted-foreground font-mono">
                      <div>{row.driverPhone}</div>
                      <div className="text-[11px] text-muted-foreground">{row.vehicleInfo}</div>
                    </td>

                    {/* Confirmed Rides */}
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={row.confirmedRides}
                        onChange={(e) =>
                          handleUpdateRowField(row.id, "confirmedRides", Number(e.target.value))
                        }
                        className="w-16 text-center font-mono font-bold bg-background border border-border rounded px-1.5 py-1 text-emerald-400 no-print"
                      />
                      <span className="hidden print:inline font-mono font-bold">{row.confirmedRides}</span>
                    </td>

                    {/* Cancelled Rides */}
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={row.cancelledRides}
                        onChange={(e) =>
                          handleUpdateRowField(row.id, "cancelledRides", Number(e.target.value))
                        }
                        className="w-16 text-center font-mono font-bold bg-background border border-border rounded px-1.5 py-1 text-rose-400 no-print"
                      />
                      <span className="hidden print:inline font-mono font-bold">{row.cancelledRides}</span>
                    </td>

                    {/* Total Rides Amount */}
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={row.totalRideAmount}
                        onChange={(e) =>
                          handleUpdateRowField(row.id, "totalRideAmount", Number(e.target.value))
                        }
                        className="w-24 text-center font-mono font-bold bg-background border border-border rounded px-1.5 py-1 no-print"
                      />
                      <span className="hidden print:inline font-mono font-bold">{row.totalRideAmount} د.ج</span>
                    </td>

                    {/* Commission / Debt Amount */}
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        value={row.debtAmount}
                        onChange={(e) =>
                          handleUpdateRowField(row.id, "debtAmount", Number(e.target.value))
                        }
                        className="w-24 text-center font-mono font-bold bg-background border border-border rounded px-1.5 py-1 text-amber-400 no-print"
                      />
                      <span className="hidden print:inline font-mono font-bold text-amber-600">{row.debtAmount} د.ج</span>
                    </td>

                    {/* Settlement Status */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleTogglePayment(row.id)}
                        className={`no-print px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                          row.paymentStatus === "paid"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {row.paymentStatus === "paid" ? "✅ تم السداد" : "🔴 غير مسدد"}
                      </button>
                      <span className="hidden print:inline font-bold">
                        {row.paymentStatus === "paid" ? "تم السداد" : "غير مسدد"}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="p-3">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleUpdateRowField(row.id, "notes", e.target.value)}
                        placeholder="أضف ملاحظة..."
                        className="w-full text-xs bg-background border border-border rounded px-2 py-1 no-print"
                      />
                      <span className="hidden print:inline text-xs">{row.notes || "—"}</span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center no-print">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteRow(row.id)}
                        className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        title="حذف من المذكرة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-primary/10 border-t-2 border-primary/30 font-bold">
                  <td colSpan={3} className="p-3 text-right">
                    الإجمالي اليومي المجمع ({memoRows.length} سائق):
                  </td>
                  <td className="p-3 text-center font-mono text-emerald-400 text-base">
                    {totals.totalConfirmed}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-400 text-base">
                    {totals.totalCancelled}
                  </td>
                  <td className="p-3 text-center font-mono text-base">
                    {totals.totalFare} د.ج
                  </td>
                  <td className="p-3 text-center font-mono text-amber-400 text-base">
                    {totals.totalDebt} د.ج
                  </td>
                  <td className="p-3 text-center text-xs">
                    المسدد: <span className="text-emerald-400 font-mono font-bold">{totals.totalPaid}</span> د.ج
                  </td>
                  <td colSpan={2} className="p-3 text-xs text-muted-foreground">
                    المتبقي: <span className="text-rose-400 font-mono font-bold">{totals.remainingDebt}</span> د.ج
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Printable Footer Section (Appears only during Print) */}
      <div className="print-footer">
        <div>
          <p><strong>اسم المسؤول المفوض:</strong> ........................................</p>
          <p className="mt-2"><strong>التوقيع والختم:</strong> ........................................</p>
        </div>
        <div>
          <p><strong>تاريخ طباعة المذكرة:</strong> {new Date().toLocaleDateString("ar-DZ")} - {new Date().toLocaleTimeString("ar-DZ")}</p>
          <p className="mt-2">تطبيق جيتك GAYTAK © - لوحة إدارة الكورسات والرحلات</p>
        </div>
      </div>

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="no-print fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl dir-rtl text-right">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <span>إضافة سائق جديد إلى المذكرة</span>
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Select Registered Driver */}
              <div>
                <label className="block font-bold mb-1 text-muted-foreground">
                  اختر سائق مسجل بالتطبيق (اختياري):
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                    setSelectedDriverId(e.target.value);
                    if (e.target.value) {
                      const d = availableDrivers.find(
                        (drv) => drv.id === e.target.value || drv.userId === e.target.value
                      );
                      if (d) {
                        setCustomDriverName(d.name);
                        setCustomPhone(d.phone || "");
                        setCustomVehicle(`${d.vehicleType || ""} ${d.vehiclePlate || ""}`);
                      }
                    }
                  }}
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono text-sm"
                >
                  <option value="">-- اختر سائق من النظام --</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phone || "بدون هاتف"}) - {d.vehicleType || "سيارة"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Or Custom Driver Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="block font-bold mb-1 text-muted-foreground">اسم السائق:</label>
                  <Input
                    type="text"
                    placeholder="مثال: أحمد بلقاسم"
                    value={customDriverName}
                    onChange={(e) => setCustomDriverName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-muted-foreground">رقم الهاتف:</label>
                  <Input
                    type="text"
                    placeholder="0661xxxxxx"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-muted-foreground">معلومات السيارة / الترقيم:</label>
                <Input
                  type="text"
                  placeholder="مثال: تويوتا كورولا - 05441-116-16"
                  value={customVehicle}
                  onChange={(e) => setCustomVehicle(e.target.value)}
                />
              </div>

              {/* Ride Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-emerald-400">طلبات مؤكدة ✅:</label>
                  <Input
                    type="number"
                    min="0"
                    value={confirmedInput}
                    onChange={(e) => setConfirmedInput(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-rose-400">طلبات ملغاة ❌:</label>
                  <Input
                    type="number"
                    min="0"
                    value={cancelledInput}
                    onChange={(e) => setCancelledInput(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-muted-foreground">إجمالي قيمة الكورسات (د.ج):</label>
                  <Input
                    type="number"
                    min="0"
                    value={totalFareInput}
                    onChange={(e) => setTotalFareInput(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-amber-400">مبلغ العمولة / الدين (د.ج):</label>
                  <Input
                    type="number"
                    min="0"
                    value={debtInput}
                    onChange={(e) => setDebtInput(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Payment Status & Notes */}
              <div>
                <label className="block font-bold mb-1 text-muted-foreground">حالة السداد الأولية:</label>
                <select
                  value={paymentStatusInput}
                  onChange={(e) => setPaymentStatusInput(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-lg p-2 font-mono text-sm"
                >
                  <option value="unpaid">🔴 غير مسدد (دين مستحق)</option>
                  <option value="paid">✅ تم السداد بالكامل</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-muted-foreground">ملاحظات إضافية:</label>
                <Input
                  type="text"
                  placeholder="مثال: دفع المبلغ كاش بالمكتب"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddDriver} className="bg-primary hover:bg-primary/90 font-bold">
                إضافة للمذكرة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
