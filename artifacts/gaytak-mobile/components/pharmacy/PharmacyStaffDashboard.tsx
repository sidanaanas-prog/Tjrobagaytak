import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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

type StaffConsultation = {
  id: string;
  question: string;
  imageUrl: string | null;
  status: string;
  isPublic: boolean;
  createdAt: string;
  patientName: string;
  replies: {
    id: string;
    reply: string;
    createdAt: string;
    staffName: string;
  }[];
};

type Pharmacy = {
  id: string;
  name: string;
  phone: string | null;
  workHours: string | null;
  address: string | null;
};

type StaffInfo = {
  name: string;
  specialty: string;
  phone: string;
};

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    open:     { label: "في الانتظار", bg: "#78350f22", text: "#FCD34D" },
    answered: { label: "تم الرد",     bg: "#06402422", text: "#34D399" },
  };
  const s = map[status] ?? { label: status, bg: "#ffffff22", text: "#ffffff88" };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

export default function PharmacyStaffDashboard({
  pharmacy,
  staffInfo,
}: {
  pharmacy: Pharmacy;
  staffInfo: StaffInfo;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [consultations, setConsultations] = useState<StaffConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyModal, setReplyModal] = useState<StaffConsultation | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<StaffConsultation[]>("/api/pharmacy/staff/consultations");
      setConsultations(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const sendReply = async () => {
    if (!replyModal || !replyText.trim()) { Alert.alert("مطلوب", "اكتب ردك أولاً"); return; }
    setSending(true);
    try {
      await customFetch(`/api/pharmacy/consultations/${replyModal.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("✅ تم إرسال الرد");
      setReplyModal(null);
      setReplyText("");
      load();
    } catch (e: any) {
      Alert.alert("خطأ", e?.data?.error || "تعذر إرسال الرد");
    }
    setSending(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[s.icon, { backgroundColor: "#1e3a8a22", borderColor: "#60A5FA44" }]}>
            <Feather name="shield" size={22} color="#60A5FA" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{staffInfo.name}</Text>
            <Text style={{ color: "#60A5FA", fontSize: 11, fontWeight: "700" }}>
              {staffInfo.specialty} · {pharmacy.name}
            </Text>
          </View>
        </View>
      </View>

      {/* قسم الاستفسارات */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
          استفسارات المرضى
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={consultations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => {
              setRefreshing(true); await load(); setRefreshing(false);
            }} />
          }
          ListEmptyComponent={
            <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="message-circle" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>لا توجد استفسارات</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>
                  👤 {c.patientName}
                </Text>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {!c.isPublic && <Feather name="lock" size={11} color={colors.muted} />}
                  <StatusBadge status={c.status} colors={colors} />
                </View>
              </View>

              <TouchableOpacity onPress={() => setExpanded(expanded === c.id ? null : c.id)}>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}
                  numberOfLines={expanded === c.id ? undefined : 3}>
                  {c.question}
                </Text>
              </TouchableOpacity>

              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                {new Date(c.createdAt).toLocaleDateString("ar")}
              </Text>

              {/* الردود */}
              {expanded === c.id && c.replies.length > 0 && (
                <View style={{ marginTop: 10, gap: 8 }}>
                  {c.replies.map((r) => (
                    <View key={r.id} style={[s.replyBox, { backgroundColor: "#1e3a8a15", borderColor: "#60A5FA33" }]}>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <Feather name="shield" size={11} color="#60A5FA" />
                        <Text style={{ color: "#60A5FA", fontWeight: "700", fontSize: 11 }}>{r.staffName}</Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(r.createdAt).toLocaleDateString("ar")}</Text>
                      </View>
                      <Text style={{ color: colors.text, fontSize: 12 }}>{r.reply}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* زر الرد */}
              {c.status === "open" && (
                <TouchableOpacity
                  onPress={() => { setReplyModal(c); setReplyText(""); }}
                  style={[s.replyBtn, { backgroundColor: "#1e3a8a22", borderColor: "#60A5FA66" }]}>
                  <Feather name="send" size={13} color="#60A5FA" />
                  <Text style={{ color: "#60A5FA", fontWeight: "700", fontSize: 12 }}>رد على الاستفسار</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* نافذة الرد */}
      <Modal visible={!!replyModal} transparent animationType="slide" onRequestClose={() => setReplyModal(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>الرد على الاستفسار</Text>
              <TouchableOpacity onPress={() => setReplyModal(null)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {replyModal && (
              <View style={[s.questionPreview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={3}>{replyModal.question}</Text>
              </View>
            )}

            <TextInput
              value={replyText}
              onChangeText={setReplyText}
              placeholder="اكتب ردك الطبي هنا..."
              placeholderTextColor={colors.muted}
              multiline numberOfLines={4}
              style={[s.input, { color: colors.text, borderColor: colors.border, height: 100, marginBottom: 16, marginTop: 12 }]}
            />

            <View style={[{ backgroundColor: "#78350f22", borderColor: "#FCD34D44", borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16, flexDirection: "row", gap: 8 }]}>
              <Feather name="alert-triangle" size={13} color="#FCD34D" />
              <Text style={{ color: "#FCD34Dcc", fontSize: 11, flex: 1 }}>ردك سيظهر للمريض. تأكد من دقة المعلومات الطبية.</Text>
            </View>

            <TouchableOpacity onPress={sendReply} disabled={sending || !replyText.trim()}
              style={[s.btn, { backgroundColor: "#60A5FA", opacity: sending || !replyText.trim() ? 0.5 : 1 }]}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Feather name="send" size={14} color="#fff" />
                  <Text style={s.btnText}>إرسال الرد</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 14, paddingHorizontal: 16 },
  icon: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: "center", justifyContent: "center" },
  replyBox: { borderWidth: 1, borderRadius: 10, padding: 10 },
  replyBtn: { flexDirection: "row", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", justifyContent: "center", marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  questionPreview: { borderRadius: 10, borderWidth: 1, padding: 10 },
});
