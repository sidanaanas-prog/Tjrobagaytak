import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";

type OwnerTab = "prescriptions" | "appointments" | "exams" | "staff";

type PrescriptionOrder = {
  id: string;
  prescriptionUrl: string;
  notes: string | null;
  deliveryType: string;
  address: string | null;
  status: string;
  proposedPrice: string | null;
  finalPrice: string | null;
  pharmacistNote: string | null;
  createdAt: string;
  patientName: string;
  patientPhone: string | null;
};

type Appointment = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  patientName: string;
  patientPhone: string | null;
  notes: string | null;
  status: string;
  price: string;
  createdAt: string;
  examName: string;
};

type Exam = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMinutes: number;
};

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  status: string;
  addedAt: string;
};

type Pharmacy = {
  id: string;
  name: string;
  phone: string | null;
  workHours: string | null;
  address: string | null;
};

// ─── شارة الحالة ────────────────────────────────────────────────────────────
function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    pending:   { label: "قيد المراجعة", bg: "#78350f22", text: "#FCD34D" },
    reviewing: { label: "جاري المراجعة", bg: "#1e3a8a22", text: "#60A5FA" },
    priced:    { label: "تم التسعير",   bg: "#4c1d9522", text: "#C084FC" },
    confirmed: { label: "مؤكد",          bg: "#06402422", text: "#34D399" },
    ready:     { label: "جاهز للاستلام", bg: "#0d946422", text: "#2DD4BF" },
    delivered: { label: "تم التسليم",   bg: "#06402422", text: "#4ADE80" },
    cancelled: { label: "ملغى",         bg: "#7f1d1d22", text: "#F87171" },
    active:    { label: "نشط",          bg: "#06402422", text: "#34D399" },
    pending_user: { label: "ينتظر التسجيل", bg: "#78350f22", text: "#FCD34D" },
    removed:   { label: "محذوف",        bg: "#7f1d1d22", text: "#F87171" },
  };
  const s = map[status] ?? { label: status, bg: "#ffffff22", text: "#ffffff88" };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

// ─── تبويب الوصفات ───────────────────────────────────────────────────────────
function PrescriptionsOwnerTab({ colors }: { colors: any }) {
  const [orders, setOrders] = useState<PrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<PrescriptionOrder | null>(null);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<PrescriptionOrder[]>("/api/pharmacy/owner/prescriptions");
      setOrders(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const openOrder = (o: PrescriptionOrder) => {
    setSelected(o);
    setPrice(o.proposedPrice ?? "");
    setNote(o.pharmacistNote ?? "");
    setStatus(o.status);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await customFetch(`/api/pharmacy/owner/prescriptions/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(status ? { status } : {}),
          ...(price ? { proposedPrice: price } : {}),
          ...(note !== undefined ? { pharmacistNote: note } : {}),
        }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ تم الحفظ");
      setSelected(null);
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر الحفظ");
    }
    setSaving(false);
  };

  const statusOptions = [
    { value: "pending",   label: "قيد المراجعة" },
    { value: "reviewing", label: "جاري المراجعة" },
    { value: "priced",    label: "تم التسعير" },
    { value: "ready",     label: "جاهز للاستلام" },
    { value: "delivered", label: "تم التسليم" },
    { value: "cancelled", label: "إلغاء" },
  ];

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>;
  }

  return (
    <>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={32} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 8 }}>لا توجد طلبات</Text>
          </View>
        }
        renderItem={({ item: o }) => (
          <TouchableOpacity onPress={() => openOrder(o)} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <TouchableOpacity onPress={() => setImageModal(o.prescriptionUrl)}>
                <Image source={{ uri: o.prescriptionUrl }} style={s.thumb} contentFit="cover" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{o.patientName}</Text>
                  <StatusBadge status={o.status} colors={colors} />
                </View>
                {o.patientPhone && <Text style={{ color: colors.muted, fontSize: 11 }}>📞 {o.patientPhone}</Text>}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  {o.deliveryType === "delivery" ? "🚚 توصيل" : "🏪 استلام"}
                  {o.address ? ` — ${o.address}` : ""}
                </Text>
                {o.proposedPrice && <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 4 }}>السعر: {o.proposedPrice} دورو</Text>}
                {o.notes && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{o.notes}</Text>}
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>{new Date(o.createdAt).toLocaleDateString("ar")}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* نافذة صورة الوصفة */}
      <Modal visible={!!imageModal} transparent animationType="fade" onRequestClose={() => setImageModal(null)}>
        <Pressable style={s.imageModalBg} onPress={() => setImageModal(null)}>
          <Image source={{ uri: imageModal! }} style={s.fullImage} contentFit="contain" />
        </Pressable>
      </Modal>

      {/* نافذة تحديث الطلب */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>تحديث الطلب</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
                المريض: {selected.patientName}  {selected.patientPhone ? `· ${selected.patientPhone}` : ""}
              </Text>
            )}

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>الحالة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {statusOptions.map((opt) => (
                  <TouchableOpacity key={opt.value} onPress={() => setStatus(opt.value)}
                    style={[s.statusChip, { borderColor: status === opt.value ? colors.primary : colors.border,
                      backgroundColor: status === opt.value ? colors.primary + "22" : "transparent" }]}>
                    <Text style={{ color: status === opt.value ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>السعر (دورو)</Text>
            <TextInput value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
              style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]} />

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>ملاحظة للمريض</Text>
            <TextInput value={note} onChangeText={setNote} placeholder="ملاحظات الصيدلاني..." multiline numberOfLines={3}
              placeholderTextColor={colors.muted}
              style={[s.input, { color: colors.text, borderColor: colors.border, height: 70, marginBottom: 16 }]} />

            <TouchableOpacity onPress={save} disabled={saving}
              style={[s.btn, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>حفظ التغييرات</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── تبويب الحجوزات ──────────────────────────────────────────────────────────
function AppointmentsOwnerTab({ colors }: { colors: any }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<Appointment[]>("/api/pharmacy/owner/appointments");
      setAppointments(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setSaving(id);
    try {
      await customFetch(`/api/pharmacy/owner/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر التحديث");
    }
    setSaving(null);
  };

  if (loading) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <FlatList
      data={appointments}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={
        <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={32} color={colors.muted} />
          <Text style={{ color: colors.muted, marginTop: 8 }}>لا توجد حجوزات</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{a.examName}</Text>
            <StatusBadge status={a.status} colors={colors} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>👤 {a.patientName}</Text>
          {a.patientPhone && <Text style={{ color: colors.muted, fontSize: 12 }}>📞 {a.patientPhone}</Text>}
          <Text style={{ color: colors.muted, fontSize: 12 }}>📅 {a.appointmentDate}  ⏰ {a.appointmentTime}</Text>
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 4 }}>{a.price} دورو</Text>
          {a.notes && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{a.notes}</Text>}

          {(a.status === "pending" || a.status === "reviewing") && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => updateStatus(a.id, "confirmed")}
                disabled={saving === a.id}
                style={[s.actionBtn, { backgroundColor: "#06402422", borderColor: "#34D39966" }]}>
                {saving === a.id ? <ActivityIndicator size="small" color="#34D399" /> : (
                  <><Feather name="check-circle" size={14} color="#34D399" />
                  <Text style={{ color: "#34D399", fontWeight: "700", fontSize: 12 }}>تأكيد</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert("إلغاء الحجز", "هل أنت متأكد؟", [
                  { text: "تراجع", style: "cancel" },
                  { text: "إلغاء", style: "destructive", onPress: () => updateStatus(a.id, "cancelled") },
                ])}
                disabled={saving === a.id}
                style={[s.actionBtn, { backgroundColor: "#7f1d1d22", borderColor: "#F8717166" }]}>
                <Feather name="x-circle" size={14} color="#F87171" />
                <Text style={{ color: "#F87171", fontWeight: "700", fontSize: 12 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    />
  );
}

// ─── تبويب الفحوصات ───────────────────────────────────────────────────────────
function ExamsOwnerTab({ colors }: { colors: any }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("15");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<Exam[]>("/api/pharmacy/owner/exams");
      setExams(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || !price.trim()) { Alert.alert("مطلوب", "الاسم والسعر إجباريان"); return; }
    setSaving(true);
    try {
      await customFetch("/api/pharmacy/owner/exams", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined, price, durationMinutes: parseInt(duration) || 15 }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdd(false);
      setName(""); setDesc(""); setPrice(""); setDuration("15");
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذرت الإضافة");
    }
    setSaving(false);
  };

  const del = (id: string) => {
    Alert.alert("حذف الفحص", "هل أنت متأكد؟", [
      { text: "تراجع", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        setDeleting(id);
        try {
          await customFetch(`/api/pharmacy/owner/exams/${id}`, { method: "DELETE" });
          load();
        } catch {}
        setDeleting(null);
      }},
    ]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        <TouchableOpacity onPress={() => setShowAdd(true)}
          style={[s.addBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "66" }]}>
          <Feather name="plus-circle" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>إضافة فحص جديد</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : (
          exams.length === 0 ? (
            <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="activity" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>لا توجد فحوصات</Text>
            </View>
          ) : (
            exams.map((exam) => (
              <View key={exam.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{exam.name}</Text>
                    {exam.description && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{exam.description}</Text>}
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                      <Text style={{ color: colors.primary, fontWeight: "700" }}>{exam.price} دورو</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>⏱ {exam.durationMinutes} دقيقة</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => del(exam.id)} disabled={deleting === exam.id}
                    style={{ padding: 8 }}>
                    {deleting === exam.id ? <ActivityIndicator size="small" color="#F87171" /> : (
                      <Feather name="trash-2" size={18} color="#F87171" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* نافذة الإضافة */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>إضافة فحص</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>اسم الفحص *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="مثال: تحليل دم شامل"
              placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]} />

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>الوصف</Text>
            <TextInput value={desc} onChangeText={setDesc} placeholder="وصف اختياري..."
              placeholderTextColor={colors.muted} multiline numberOfLines={2}
              style={[s.input, { color: colors.text, borderColor: colors.border, height: 60, marginBottom: 12 }]} />

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>السعر (دورو) *</Text>
                <TextInput value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>المدة (دقيقة)</Text>
                <TextInput value={duration} onChangeText={setDuration} placeholder="15" keyboardType="number-pad"
                  placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border }]} />
              </View>
            </View>

            <TouchableOpacity onPress={add} disabled={saving}
              style={[s.btn, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>إضافة الفحص</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── تبويب الأطباء ────────────────────────────────────────────────────────────
function StaffOwnerTab({ colors }: { colors: any }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<StaffMember[]>("/api/pharmacy/owner/staff");
      setStaff(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!phone.trim() || !name.trim()) { Alert.alert("مطلوب", "الاسم ورقم الهاتف إجباريان"); return; }
    setSaving(true);
    try {
      const res = await customFetch<{ message: string }>("/api/pharmacy/owner/staff", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), name: name.trim(), specialty: specialty.trim() || "طبيب" }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ تمت الإضافة", res?.message);
      setShowAdd(false);
      setPhone(""); setName(""); setSpecialty("");
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذرت الإضافة");
    }
    setSaving(false);
  };

  const remove = (id: string, memberName: string) => {
    Alert.alert("إزالة الطبيب", `هل تريد إزالة ${memberName}؟`, [
      { text: "تراجع", style: "cancel" },
      { text: "إزالة", style: "destructive", onPress: async () => {
        setRemoving(id);
        try {
          await customFetch(`/api/pharmacy/owner/staff/${id}`, { method: "DELETE" });
          load();
        } catch {}
        setRemoving(null);
      }},
    ]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}>
        <TouchableOpacity onPress={() => setShowAdd(true)}
          style={[s.addBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "66" }]}>
          <Feather name="user-plus" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>إضافة طبيب</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : (
          staff.length === 0 ? (
            <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="users" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>لا يوجد أطباء مضافون</Text>
            </View>
          ) : (
            staff.filter((m) => m.status !== "removed").map((member) => (
              <View key={member.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center", flex: 1 }}>
                    <View style={[s.avatar, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 16 }}>
                        {member.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{member.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>{member.specialty}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>📞 {member.phone}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 8, alignItems: "flex-end" }}>
                    <StatusBadge status={member.status === "pending" ? "pending_user" : member.status} colors={colors} />
                    <TouchableOpacity onPress={() => remove(member.id, member.name)} disabled={removing === member.id}>
                      {removing === member.id ? <ActivityIndicator size="small" color="#F87171" /> : (
                        <Feather name="user-x" size={16} color="#F87171" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* نافذة الإضافة */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>إضافة طبيب</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>الاسم *</Text>
            <TextInput value={name} onChangeText={setName} placeholder="اسم الطبيب"
              placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]} />

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>رقم الهاتف *</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+213XXXXXXXXX" keyboardType="phone-pad"
              placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]} />

            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }}>التخصص</Text>
            <TextInput value={specialty} onChangeText={setSpecialty} placeholder="مثال: طبيب عام، صيدلاني..."
              placeholderTextColor={colors.muted} style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]} />

            <View style={[{ backgroundColor: "#78350f22", borderColor: "#FCD34D44", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16, flexDirection: "row", gap: 8, alignItems: "flex-start" }]}>
              <Feather name="info" size={14} color="#FCD34D" />
              <Text style={{ color: "#FCD34Dcc", fontSize: 12, flex: 1 }}>
                إذا كان الطبيب مسجلاً بهذا الرقم سيتم ربطه تلقائياً، وإلا سيُضاف في انتظار تسجيله.
              </Text>
            </View>

            <TouchableOpacity onPress={add} disabled={saving}
              style={[s.btn, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>إضافة الطبيب</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── لوحة الصاحب الرئيسية ────────────────────────────────────────────────────
export default function PharmacyOwnerDashboard({ pharmacy }: { pharmacy: Pharmacy }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<OwnerTab>("prescriptions");

  const tabs: { id: OwnerTab; label: string; icon: string }[] = [
    { id: "prescriptions", label: "وصفات", icon: "file-text" },
    { id: "appointments",  label: "حجوزات", icon: "calendar" },
    { id: "exams",         label: "فحوصات", icon: "activity" },
    { id: "staff",         label: "الأطباء", icon: "users" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <View style={[s.icon, { backgroundColor: "#4c1d9522", borderColor: "#C084FC44" }]}>
            <Feather name="shield" size={22} color="#C084FC" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{pharmacy.name}</Text>
            <Text style={{ color: "#C084FC", fontSize: 11, fontWeight: "700" }}>لوحة صاحب الصيدلية</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {tabs.map((t) => (
              <TouchableOpacity key={t.id}
                onPress={() => { setTab(t.id); Haptics.selectionAsync(); }}
                style={[s.tabChip, {
                  borderColor: tab === t.id ? colors.primary : colors.border,
                  backgroundColor: tab === t.id ? colors.primary + "22" : colors.card,
                }]}>
                <Feather name={t.icon as any} size={13} color={tab === t.id ? colors.primary : colors.muted} />
                <Text style={{ color: tab === t.id ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* المحتوى */}
      <View style={{ flex: 1 }}>
        {tab === "prescriptions" && <PrescriptionsOwnerTab colors={colors} />}
        {tab === "appointments"  && <AppointmentsOwnerTab colors={colors} />}
        {tab === "exams"         && <ExamsOwnerTab colors={colors} />}
        {tab === "staff"         && <StaffOwnerTab colors={colors} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 10, paddingHorizontal: 16 },
  icon: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 2 },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  actionBtn: { flex: 1, flexDirection: "row", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  statusChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  imageModalBg: { flex: 1, backgroundColor: "#000000cc", alignItems: "center", justifyContent: "center" },
  fullImage: { width: "90%", height: "80%" },
});
