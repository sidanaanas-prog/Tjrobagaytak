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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";

type Order = {
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
  patientPhone: string;
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

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: "جديد",          bg: "#78350f22", text: "#FCD34D" },
  priced:    { label: "تم التسعير",    bg: "#4c1d9522", text: "#C084FC" },
  confirmed: { label: "مؤكد",          bg: "#06402422", text: "#34D399" },
  preparing: { label: "قيد التحضير",   bg: "#1e3a8a22", text: "#60A5FA" },
  delivered: { label: "تم التسليم",    bg: "#16273322", text: "#22D3EE" },
  rejected:  { label: "مرفوض",         bg: "#7f1d1d22", text: "#F87171" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: "#ffffff22", text: "#ffffff88" };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "700" }}>{s.label}</Text>
    </View>
  );
}

export default function PharmacyWorkerDashboard({
  pharmacy,
  staffInfo,
}: {
  pharmacy: Pharmacy;
  staffInfo: StaffInfo;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await customFetch<Order[]>("/api/pharmacy/worker/orders");
      setOrders(data ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const statusCounts = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    active: orders.filter(o => ["confirmed", "preparing", "priced"].includes(o.status)).length,
    done: orders.filter(o => ["delivered", "rejected"].includes(o.status)).length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[s.icon, { backgroundColor: "#78350f22", borderColor: "#FCD34D44" }]}>
            <Feather name="package" size={22} color="#FCD34D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{staffInfo.name}</Text>
            <Text style={{ color: "#FCD34D", fontSize: 11, fontWeight: "700" }}>
              عامل استقبال · {pharmacy.name}
            </Text>
          </View>
        </View>

        {/* إحصائيات سريعة */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[
            { label: "الكل", value: statusCounts.total, color: colors.text },
            { label: "جديدة", value: statusCounts.pending, color: "#FCD34D" },
            { label: "جارية", value: statusCounts.active, color: "#60A5FA" },
            { label: "منتهية", value: statusCounts.done, color: colors.muted },
          ].map(stat => (
            <View key={stat.label} style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}>
              <Text style={{ color: stat.color, fontWeight: "900", fontSize: 18 }}>{stat.value}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* قائمة الطلبيات */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
          طلبيات الوصفات
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#FCD34D" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={async () => {
              setRefreshing(true); await load(); setRefreshing(false);
            }} />
          }
          ListEmptyComponent={
            <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="package" size={32} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>لا توجد طلبيات حالياً</Text>
            </View>
          }
          renderItem={({ item: o }) => (
            <TouchableOpacity
              onPress={() => { setPreviewOrder(o); Haptics.selectionAsync(); }}
              style={[s.card, { backgroundColor: colors.card, borderColor: o.status === "pending" ? "#FCD34D44" : colors.border }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <View>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>👤 {o.patientName}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{o.patientPhone}</Text>
                </View>
                <StatusBadge status={o.status} />
              </View>

              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                <View style={[s.tag, { backgroundColor: o.deliveryType === "delivery" ? "#1e3a8a22" : "#06402422" }]}>
                  <Feather name={o.deliveryType === "delivery" ? "truck" : "shopping-bag"} size={10}
                    color={o.deliveryType === "delivery" ? "#60A5FA" : "#34D399"} />
                  <Text style={{ color: o.deliveryType === "delivery" ? "#60A5FA" : "#34D399", fontSize: 10, fontWeight: "700" }}>
                    {o.deliveryType === "delivery" ? "توصيل" : "استلام"}
                  </Text>
                </View>
                {o.finalPrice && Number(o.finalPrice) > 0 && (
                  <View style={[s.tag, { backgroundColor: "#06402422" }]}>
                    <Text style={{ color: "#34D399", fontSize: 10, fontWeight: "700" }}>{o.finalPrice} دج</Text>
                  </View>
                )}
                {o.proposedPrice && !o.finalPrice && (
                  <View style={[s.tag, { backgroundColor: "#4c1d9522" }]}>
                    <Text style={{ color: "#C084FC", fontSize: 10, fontWeight: "700" }}>مقترح: {o.proposedPrice} دج</Text>
                  </View>
                )}
              </View>

              {o.notes && (
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }} numberOfLines={1}>
                  📝 {o.notes}
                </Text>
              )}

              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 6 }}>
                {new Date(o.createdAt).toLocaleDateString("ar")} — {new Date(o.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* نافذة تفاصيل الطلب */}
      <Modal visible={!!previewOrder} transparent animationType="slide" onRequestClose={() => setPreviewOrder(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>تفاصيل الطلب</Text>
              <TouchableOpacity onPress={() => setPreviewOrder(null)}>
                <Feather name="x" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {previewOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* صورة الوصفة */}
                <TouchableOpacity
                  onPress={() => Alert.alert("الوصفة", previewOrder.prescriptionUrl)}
                  style={{ borderRadius: 14, overflow: "hidden", marginBottom: 14, height: 200 }}>
                  <Image source={{ uri: previewOrder.prescriptionUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                </TouchableOpacity>

                {/* معلومات المريض */}
                <View style={[s.infoRow, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>المريض</Text>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{previewOrder.patientName}</Text>
                </View>
                <View style={[s.infoRow, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>الهاتف</Text>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{previewOrder.patientPhone}</Text>
                </View>
                <View style={[s.infoRow, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>طريقة الاستلام</Text>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {previewOrder.deliveryType === "delivery" ? "🚚 توصيل للمنزل" : "🏪 استلام من المؤسسة"}
                  </Text>
                </View>
                {previewOrder.address && (
                  <View style={[s.infoRow, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>العنوان</Text>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{previewOrder.address}</Text>
                  </View>
                )}
                {previewOrder.notes && (
                  <View style={[s.infoRow, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>ملاحظات</Text>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{previewOrder.notes}</Text>
                  </View>
                )}
                {previewOrder.proposedPrice && (
                  <View style={[s.infoRow, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>السعر المقترح</Text>
                    <Text style={{ color: "#C084FC", fontWeight: "800", fontSize: 14 }}>{previewOrder.proposedPrice} دج</Text>
                  </View>
                )}
                {previewOrder.finalPrice && (
                  <View style={[s.infoRow, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>السعر النهائي</Text>
                    <Text style={{ color: "#34D399", fontWeight: "800", fontSize: 14 }}>{previewOrder.finalPrice} دج</Text>
                  </View>
                )}
                {previewOrder.pharmacistNote && (
                  <View style={[{ backgroundColor: "#06402422", borderRadius: 12, padding: 12, marginTop: 8 }]}>
                    <Text style={{ color: "#34D399", fontSize: 12, fontWeight: "700", marginBottom: 4 }}>ملاحظة الصيدلاني</Text>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{previewOrder.pharmacistNote}</Text>
                  </View>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { borderBottomWidth: 1, paddingBottom: 14, paddingHorizontal: 16 },
  icon: { width: 46, height: 46, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statCard: { borderRadius: 12, borderWidth: 1, padding: 10, alignItems: "center" },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  tag: { flexDirection: "row", gap: 4, alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "90%" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
});
