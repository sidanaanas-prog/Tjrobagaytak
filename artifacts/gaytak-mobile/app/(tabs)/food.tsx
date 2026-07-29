import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
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

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Tab = "prescriptions" | "appointments" | "consultations";
type Exam = { id: string; name: string; description: string | null; price: string; durationMinutes: number };
type Consultation = {
  id: string; question: string; userName: string; status: string;
  createdAt: string; replies: { reply: string; staffName: string; createdAt: string }[];
};
type Pharmacy = { id: string; name: string; phone: string | null; workHours: string | null; address: string | null };

// ─── الشارة الملونة ─────────────────────────────────────────────────────────
function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    pending:   { label: "قيد المراجعة", bg: "#78350f22", text: "#FCD34D" },
    reviewing: { label: "جاري المراجعة", bg: "#1e3a8a22", text: "#60A5FA" },
    priced:    { label: "تم تحديد السعر", bg: "#4c1d9522", text: "#C084FC" },
    confirmed: { label: "مؤكد",           bg: "#06402422", text: "#34D399" },
    ready:     { label: "جاهز للاستلام", bg: "#0d946422", text: "#2DD4BF" },
    delivered: { label: "تم التسليم",    bg: "#06402422", text: "#4ADE80" },
    cancelled: { label: "ملغى",          bg: "#7f1d1d22", text: "#F87171" },
    open:      { label: "في الانتظار",   bg: "#78350f22", text: "#FCD34D" },
    answered:  { label: "تم الرد",       bg: "#06402422", text: "#34D399" },
  };
  const s = map[status] ?? { label: status, bg: "#ffffff22", text: "#ffffff88" };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

// ─── قسم الوصفة الطبية ─────────────────────────────────────────────────────
function PrescriptionTab({ colors }: { colors: any }) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!token) return;
    try {
      const data = await customFetch<any[]>("/api/pharmacy/my-prescriptions");
      setMyOrders(data ?? []);
    } catch {}
  }, [token]);

  useEffect(() => { loadOrders(); }, [done]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleSubmit = async () => {
    if (!imageBase64) { Alert.alert("مطلوب", "يرجى اختيار صورة الوصفة"); return; }
    setLoading(true);
    try {
      const uploadRes = await customFetch<{ url: string }>("/api/upload", {
        method: "POST",
        body: JSON.stringify({ base64: imageBase64, path: `prescriptions/${Date.now()}.jpg`, contentType: "image/jpeg" }),
      });
      await customFetch("/api/pharmacy/prescriptions", {
        method: "POST",
        body: JSON.stringify({ prescriptionUrl: uploadRes.url, notes, deliveryType, address: deliveryType === "delivery" ? address : null }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true); setImageUri(null); setImageBase64(null); setNotes(""); setAddress("");
      Alert.alert("✅ تم الإرسال", "سيتواصل معك الصيدلاني قريباً");
      setTimeout(() => setDone(false), 3000);
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر إرسال الطلب");
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadOrders(); setRefreshing(false); }} />}>

      {/* بطاقة الرفع */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>📋 رفع الوصفة الطبية</Text>

        <TouchableOpacity onPress={pickImage} style={[styles.imageBox, { borderColor: colors.border }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.prescriptionImage} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="camera" size={28} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>اضغط لاختيار الوصفة</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* نوع الاستلام */}
        <View style={styles.row}>
          {(["pickup", "delivery"] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setDeliveryType(t)} style={[
              styles.typeBtn,
              { borderColor: deliveryType === t ? colors.primary : colors.border, backgroundColor: deliveryType === t ? colors.primary + "22" : "transparent" }
            ]}>
              <Text style={{ color: deliveryType === t ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>
                {t === "pickup" ? "🏪 استلام" : "🚚 توصيل"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {deliveryType === "delivery" && (
          <TextInput value={address} onChangeText={setAddress} placeholder="أدخل عنوان التوصيل"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        )}

        <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات إضافية (اختياري)"
          placeholderTextColor={colors.muted} multiline numberOfLines={2}
          style={[styles.input, { color: colors.text, borderColor: colors.border, height: 60 }]} />

        <TouchableOpacity onPress={handleSubmit} disabled={loading || !imageUri}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading || !imageUri ? 0.5 : 1 }]}>
          {loading ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>إرسال الطلب</Text>}
        </TouchableOpacity>
      </View>

      {/* طلباتي */}
      {myOrders.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>طلباتي</Text>
          {myOrders.map((o) => (
            <View key={o.id} style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Image source={{ uri: o.prescriptionUrl }} style={styles.orderThumb} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <View style={[styles.row, { marginBottom: 4 }]}>
                  <StatusBadge status={o.status} colors={colors} />
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(o.createdAt).toLocaleDateString("ar")}</Text>
                </View>
                {o.proposedPrice && <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>السعر: {o.proposedPrice} دورو</Text>}
                {o.pharmacistNote && <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{o.pharmacistNote}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── قسم الحجوزات ──────────────────────────────────────────────────────────
function AppointmentsTab({ colors }: { colors: any }) {
  const { token, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [patientName, setPatientName] = useState(user?.name ?? "");
  const [patientPhone, setPatientPhone] = useState(user?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<Exam[]>("/api/pharmacy/exams");
      setExams(data ?? []);
    } catch {}
    if (token) {
      try {
        const apps = await customFetch<any[]>("/api/pharmacy/my-appointments");
        setMyApps(apps ?? []);
      } catch {}
    }
  }, [token]);

  useEffect(() => { load(); }, []);

  const handleBook = async () => {
    if (!selected || !date || !time || !patientName || !patientPhone) {
      Alert.alert("مطلوب", "يرجى تعبئة جميع الحقول"); return;
    }
    setLoading(true);
    try {
      await customFetch("/api/pharmacy/appointments", {
        method: "POST",
        body: JSON.stringify({ examId: selected.id, appointmentDate: date, appointmentTime: time, patientName, patientPhone, notes }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ تم الحجز", "سيتم تأكيد موعدك قريباً");
      setSelected(null); setDate(""); setTime(""); setNotes("");
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر الحجز");
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>اختر نوع الفحص</Text>

      {exams.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center", paddingVertical: 32 }]}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>لا توجد فحوصات متاحة حالياً</Text>
        </View>
      ) : (
        <View style={styles.examsGrid}>
          {exams.map((exam) => (
            <TouchableOpacity key={exam.id} onPress={() => setSelected(exam)} style={[
              styles.examCard, { borderColor: selected?.id === exam.id ? colors.primary : colors.border,
                backgroundColor: selected?.id === exam.id ? colors.primary + "22" : colors.card }
            ]}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>{exam.name}</Text>
              {exam.description && <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 6 }} numberOfLines={2}>{exam.description}</Text>}
              <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 14 }}>{exam.price} دورو</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selected && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + "66" }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>حجز: {selected.name}</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="التاريخ (YYYY-MM-DD)"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TextInput value={time} onChangeText={setTime} placeholder="الوقت (HH:MM)"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TextInput value={patientName} onChangeText={setPatientName} placeholder="اسم المريض"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TextInput value={patientPhone} onChangeText={setPatientPhone} placeholder="رقم الهاتف" keyboardType="phone-pad"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات (اختياري)"
            placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
          <TouchableOpacity onPress={handleBook} disabled={loading}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.5 : 1 }]}>
            {loading ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitBtnText}>تأكيد الحجز — {selected.price} دورو</Text>}
          </TouchableOpacity>
        </View>
      )}

      {myApps.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>حجوزاتي</Text>
          {myApps.map((a) => (
            <View key={a.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{a.examName}</Text>
                <StatusBadge status={a.status} colors={colors} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{a.appointmentDate} — {a.appointmentTime}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── قسم الاستفسارات ────────────────────────────────────────────────────────
function ConsultationsTab({ colors }: { colors: any }) {
  const { token } = useAuth();
  const [question, setQuestion] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<Consultation[]>("/api/pharmacy/consultations");
      setConsultations(data ?? []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  const handleAsk = async () => {
    if (!question.trim()) { Alert.alert("مطلوب", "اكتب سؤالك أولاً"); return; }
    if (!token) { router.push("/login" as any); return; }
    setLoading(true);
    try {
      await customFetch("/api/pharmacy/consultations", {
        method: "POST",
        body: JSON.stringify({ question, isPublic }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ تم الإرسال", "سيرد عليك الطبيب قريباً");
      setQuestion(""); load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر الإرسال");
    }
    setLoading(false);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* تحذير */}
      <View style={[styles.warningBox, { backgroundColor: "#78350f22", borderColor: "#FCD34D44" }]}>
        <Feather name="alert-triangle" size={14} color="#FCD34D" />
        <Text style={{ color: "#FCD34Dcc", fontSize: 12, flex: 1 }}>
          هذه استشارة عامة وليست تشخيصاً طبياً. للحالات الطارئة راجع الطبيب مباشرة.
        </Text>
      </View>

      {/* نموذج السؤال */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>💬 اطرح سؤالك</Text>
        <TextInput value={question} onChangeText={setQuestion} placeholder="اكتب سؤالك الطبي هنا..."
          placeholderTextColor={colors.muted} multiline numberOfLines={3}
          style={[styles.input, { color: colors.text, borderColor: colors.border, height: 80 }]} />
        <TouchableOpacity onPress={() => setIsPublic(!isPublic)} style={[
          styles.toggleBtn, { borderColor: isPublic ? "#34D399" : colors.border, backgroundColor: isPublic ? "#06402422" : "transparent" }
        ]}>
          <Feather name={isPublic ? "globe" : "lock"} size={14} color={isPublic ? "#34D399" : colors.muted} />
          <Text style={{ color: isPublic ? "#34D399" : colors.muted, fontSize: 12, fontWeight: "700" }}>
            {isPublic ? "سؤال عام — يراه الجميع" : "سؤال خاص — بينك وبين الطبيب"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAsk} disabled={loading || !question.trim()}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading || !question.trim() ? 0.5 : 1 }]}>
          {loading ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>إرسال السؤال</Text>}
        </TouchableOpacity>
      </View>

      {/* الأسئلة العامة */}
      {consultations.length > 0 && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>أسئلة المجتمع</Text>
          {consultations.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => setExpanded(expanded === c.id ? null : c.id)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.row, { justifyContent: "space-between", marginBottom: 6 }]}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>{c.userName}</Text>
                <StatusBadge status={c.status} colors={colors} />
              </View>
              <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={expanded === c.id ? undefined : 2}>{c.question}</Text>
              {expanded === c.id && c.replies.map((r, i) => (
                <View key={i} style={[styles.replyBox, { backgroundColor: "#06402415", borderColor: "#34D39933" }]}>
                  <View style={styles.row}>
                    <Feather name="shield" size={12} color="#34D399" />
                    <Text style={{ color: "#34D399", fontWeight: "700", fontSize: 11 }}>{r.staffName}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>{r.reply}</Text>
                </View>
              ))}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── الشاشة الرئيسية ─────────────────────────────────────────────────────
export default function PharmacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("prescriptions");
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);

  useEffect(() => {
    customFetch<Pharmacy>("/api/pharmacy").then(setPharmacy).catch(() => {});
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "prescriptions", label: "وصفة", icon: "file-text" },
    { id: "appointments", label: "فحص", icon: "calendar" },
    { id: "consultations", label: "استفسار", icon: "message-circle" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={[styles.pharmacyIcon, { backgroundColor: "#06402422", borderColor: "#34D39933" }]}>
            <Feather name="plus-circle" size={24} color="#34D399" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{pharmacy?.name ?? "صيدلية شفاء"}</Text>
            {(pharmacy?.phone || pharmacy?.workHours) && (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {pharmacy?.phone ? `📞 ${pharmacy.phone}` : ""}
                {pharmacy?.workHours ? `  ⏰ ${pharmacy.workHours}` : ""}
              </Text>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {tabs.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => { setTab(t.id); Haptics.selectionAsync(); }}
              style={[styles.tabBtn, tab === t.id && { backgroundColor: colors.primary + "22" }]}>
              <Feather name={t.icon as any} size={14} color={tab === t.id ? colors.primary : colors.muted} />
              <Text style={{ color: tab === t.id ? colors.primary : colors.muted, fontSize: 11, fontWeight: "700" }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* المحتوى */}
      {tab === "prescriptions" && <PrescriptionTab colors={colors} />}
      {tab === "appointments" && <AppointmentsTab colors={colors} />}
      {tab === "consultations" && <ConsultationsTab colors={colors} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingBottom: 8, paddingHorizontal: 16 },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pharmacyIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "900" },
  tabBar: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, gap: 3 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 11 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 10, gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  imageBox: { height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", overflow: "hidden" },
  prescriptionImage: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  submitBtn: { borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  orderCard: { flexDirection: "row", gap: 12, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8, alignItems: "center" },
  orderThumb: { width: 52, height: 52, borderRadius: 10 },
  examsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  examCard: { width: "48%", borderRadius: 14, borderWidth: 1, padding: 12 },
  warningBox: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: "flex-start" },
  toggleBtn: { flexDirection: "row", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  replyBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8, gap: 2 },
});
