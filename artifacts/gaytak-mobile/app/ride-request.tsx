import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

export default function RideRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [myRides, setMyRides] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    fetchMyRides();
  }, []);

  async function fetchMyRides() {
    if (!token) return;
    setFetching(true);
    try {
      const res = await fetch(`https://${DOMAIN}/api/rides/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setMyRides(data);
    } catch {}
    setFetching(false);
  }

  async function handleSubmit() {
    if (!fromAddress || !toAddress || !price) {
      Alert.alert("معلومات ناقصة", "أكمل جميع الحقول المطلوبة");
      return;
    }
    if (!token) {
      Alert.alert("تسجيل الدخول مطلوب", "يجب تسجيل الدخول أولاً");
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(`https://${DOMAIN}/api/rides`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          price: String(price),
          notes: notes || undefined,
          passengerCount: Number(passengerCount) || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("✅ تم الطلب!", "سيتم إخطارك عندما يقبل سائق رحلتك");
        setFromAddress("");
        setToAddress("");
        setPrice("");
        setNotes("");
        fetchMyRides();
      } else {
        Alert.alert("خطأ", data.error || "فشل الطلب");
      }
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          طلب نقل
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Form */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>من</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            placeholder="مثال: شارع البريد، وهران"
            placeholderTextColor={colors.mutedForeground}
            value={fromAddress}
            onChangeText={setFromAddress}
          />

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>إلى</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            placeholder="مثال: المطار، وهران"
            placeholderTextColor={colors.mutedForeground}
            value={toAddress}
            onChangeText={setToAddress}
          />

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>السعر (دج)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
            placeholder="مثال: 500"
            placeholderTextColor={colors.mutedForeground}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>عدد الركاب</Text>
          <View style={styles.passengerRow}>
            {["1", "2", "3", "4"].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => {
                  setPassengerCount(n);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.passengerBtn,
                  {
                    backgroundColor: passengerCount === n ? colors.primary : colors.input,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ color: passengerCount === n ? "#FFF" : colors.text, fontWeight: "700" }}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>ملاحظات (اختياري)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border, height: 80, textAlignVertical: "top" }]}
            placeholder="أي ملاحظات خاصة..."
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>طلب نقل</Text>
          )}
        </TouchableOpacity>

        {/* My rides */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 32 }]}>
          رحلاتي
        </Text>
        {fetching ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
        ) : myRides.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            لا توجد رحلات
          </Text>
        ) : (
          myRides.map((ride) => (
            <View key={ride.id} style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rideRow}>
                <Feather name="map-pin" size={14} color={colors.primary} />
                <Text style={[styles.rideText, { color: colors.text }]} numberOfLines={1}>
                  {ride.fromAddress} → {ride.toAddress}
                </Text>
              </View>
              <View style={styles.rideFooter}>
                <Text style={[styles.ridePrice, { color: colors.primary }]}>{ride.price} دج</Text>
                <View style={[styles.statusBadge, { backgroundColor: ride.status === "pending" ? "#FFAA00" : ride.status === "accepted" ? "#00CCFF" : "#00CC66" }]}>
                  <Text style={styles.statusText}>
                    {ride.status === "pending" ? "قيد الانتظار" : ride.status === "accepted" ? "تم القبول" : "مكتمل"}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  passengerRow: { flexDirection: "row", gap: 8 },
  passengerBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    marginTop: 20,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  emptyText: { textAlign: "center", marginTop: 20, fontSize: 14 },
  rideCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  rideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rideText: { flex: 1, fontSize: 13 },
  rideFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  ridePrice: { fontSize: 15, fontWeight: "700" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
});
