import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IncomingCallOverlay } from "@/components/IncomingCallOverlay";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const { width, height } = Dimensions.get("window");

function vTypeLabelMobile(t: string | undefined): string {
  const map: Record<string, string> = {
    car: "\ud83d\ude97 \u0639\u0627\u062f\u064a",
    ac: "\u2744\ufe0f \u0645\u0643\u064a\u0641",
    suv: "\ud83d\ude99 \u062f\u0641\u0639 \u0631\u0628\u0627\u0639\u064a",
    van: "\ud83d\ude90 \u062d\u0627\u0641\u0644\u0629",
    truck: "\ud83d\ude9a \u0634\u062d\u0646",
  };
  return map[t ?? "car"] ?? "\ud83d\ude97 \u0639\u0627\u062f\u064a";
}

export default function RideDriverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [pendingRides, setPendingRides] = useState<any[]>([]);
  const [acceptedRides, setAcceptedRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [incomingRide, setIncomingRide] = useState<any>(null);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const params = useLocalSearchParams();

  const topPad = insets.top;

  // فحص طلب نقل جديد ورد من الإشعار (من خارج التطبيق أو خلال النوم)
  useEffect(() => {
    const checkIncoming = async () => {
      // من params (FCM fullScreenIntent أو نقر على الإشعار)
      const rideIdFromParams = params?.incomingRideId as string | undefined;
      // من AsyncStorage (إشعار وارد في الخلفية)
      const rideIdFromStorage = await AsyncStorage.getItem("incoming_ride_id");
      const incomingRideId = rideIdFromParams || rideIdFromStorage;

      if (incomingRideId) {
        // نمسح التخزين ونخزّن الطلب
        await AsyncStorage.removeItem("incoming_ride_id");
        try {
          const res = await fetch(`https://${DOMAIN}/api/rides/${incomingRideId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const ride = await res.json();
          if (ride && ride.status === "pending") {
            setIncomingRide(ride);
            setShowCallOverlay(true);
          }
        } catch (e) {
          console.warn("[RideDriver] failed to fetch incoming ride:", e);
        }
      }
    };
    if (token) checkIncoming();
  }, [token, params]);

  // Check subscription status
  useEffect(() => {
    if (!token || !user) return;
    fetch(`https://${DOMAIN}/api/driver/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSubscription(data))
      .catch(() => {});
  }, [token, user]);

  // Poll for rides
  useEffect(() => {
    if (!isOnline || !token) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchRides();
    intervalRef.current = setInterval(fetchRides, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, token]);

  async function fetchRides() {
    if (!token) return;
    try {
      const [pendingRes, acceptedRes] = await Promise.all([
        fetch(`https://${DOMAIN}/api/rides/driver?status=pending`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`https://${DOMAIN}/api/rides/driver?status=accepted`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const pending = await pendingRes.json();
      const accepted = await acceptedRes.json();

      const p = Array.isArray(pending) ? pending : [];
      const a = Array.isArray(accepted) ? accepted : [];

      // Detect new rides
      const newRides = p.filter((r: any) => !pendingRides.find((pr) => pr.id === r.id));
      if (newRides.length > 0 && !showCallOverlay) {
        setIncomingRide(newRides[0]);
        setShowCallOverlay(true);
      }

      setPendingRides(p);
      setAcceptedRides(a);
    } catch {}
  }

  async function handleAccept(rideId: string) {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`https://${DOMAIN}/api/rides/${rideId}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.conversationId) {
        setShowCallOverlay(false);
        setIncomingRide(null);
        // Reset pending so the accepted ride moves to active list
        setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
        fetchRides();
      } else if (data.alreadyTaken) {
        Alert.alert("❌ تم القبول من سائق آخر", "لم تفوت هنالك");
        setShowCallOverlay(false);
        setIncomingRide(null);
        setPendingRides((prev) => prev.filter((r) => r.id !== rideId));
      } else {
        Alert.alert("خطأ", data.error || "تعذر قبول الرحلة");
      }
    } catch {
      Alert.alert("خطأ", "تعذر الاتصال بالخادم");
    }
    setLoading(false);
  }

  async function handleArrived(rideId: string) {
    if (!token) return;
    try {
      await fetch(`https://${DOMAIN}/api/rides/${rideId}/arrived`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRides();
    } catch {}
  }

  async function handlePickup(rideId: string) {
    if (!token) return;
    try {
      await fetch(`https://${DOMAIN}/api/rides/${rideId}/pickup`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRides();
    } catch {}
  }

  async function handleComplete(rideId: string) {
    if (!token) return;
    try {
      await fetch(`https://${DOMAIN}/api/rides/${rideId}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRides();
    } catch {}
  }

  function handleDismiss() {
    setShowCallOverlay(false);
    setIncomingRide(null);
  }

  const isSubscribed = subscription?.isSubscribed ?? false;
  const isFree = subscription?.isFree ?? false;
  const hasProfile = subscription?.hasProfile ?? false;
  const docsStatus = subscription?.documentsStatus ?? "not_submitted";
  const isDriverActive = (isSubscribed || isFree) && docsStatus === "verified";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          لوحة السائق
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Registration Status */}
      {!hasProfile && (
        <View style={[styles.banner, { backgroundColor: colors.destructive + "20" }]}>
          <Text style={[styles.bannerText, { color: colors.destructive }]}>
            يجب تسجيل كسائق أولاً
          </Text>
          <TouchableOpacity onPress={() => router.push("/driver-register")}>
            <Text style={[styles.bannerLink, { color: colors.primary }]}>
              تسجيل كسائق →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Documents Status */}
      {hasProfile && docsStatus === "pending" && (
        <View style={[styles.banner, { backgroundColor: "#FFAA0020" }]}>
          <Text style={[styles.bannerText, { color: "#FFAA00" }]}>
            الوثائق قيد المراجعة
          </Text>
          <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>
            سيتم تفعيل حسابك بعد تأكيد الوثائق
          </Text>
        </View>
      )}
      {hasProfile && docsStatus === "rejected" && (
        <View style={[styles.banner, { backgroundColor: colors.destructive + "20" }]}>
          <Text style={[styles.bannerText, { color: colors.destructive }]}>
            تم رفض الوثائق
          </Text>
          <TouchableOpacity onPress={() => router.push("/driver-register")}>
            <Text style={[styles.bannerLink, { color: colors.primary }]}>
              إعادة التقديم →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Subscription Status */}
      {hasProfile && docsStatus === "verified" && !isSubscribed && !isFree && (
        <View style={[styles.banner, { backgroundColor: "#FFAA0020" }]}>
          <Text style={[styles.bannerText, { color: "#FFAA00" }]}>
            الاشتراك غير مفعل
          </Text>
          <TouchableOpacity onPress={() => router.push("/driver-subscribe")}>
            <Text style={[styles.bannerLink, { color: colors.primary }]}>
              اشترك الآن →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Online Toggle */}
      {isDriverActive && (
        <View style={[styles.onlineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? "#00CC66" : colors.mutedForeground }]} />
            <Text style={[styles.onlineText, { color: colors.text }]}>
              {isOnline ? "متصل" : "غير متصل"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setIsOnline(!isOnline);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={[styles.onlineToggle, { backgroundColor: isOnline ? colors.destructive : colors.primary }]}
          >
            <Text style={styles.onlineToggleText}>
              {isOnline ? "إيقاف" : "تفعيل"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pending Rides */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>
        طلبات جديدة
      </Text>
      {pendingRides.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          لا توجد طلبات جديدة
        </Text>
      ) : (
        pendingRides.map((ride) => (
          <View key={ride.id} style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rideRow}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={[styles.rideText, { color: colors.text }]} numberOfLines={1}>
                {ride.fromAddress} → {ride.toAddress}
              </Text>
            </View>
            <View style={styles.rideRow}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.rideSubText, { color: colors.mutedForeground }]}>
                {ride.passengerCount ?? 1} راكب · {vTypeLabelMobile(ride.vehicleType)}
              </Text>
            </View>
            <View style={styles.rideFooter}>
              <Text style={[styles.ridePrice, { color: colors.primary }]}>{ride.price} دج</Text>
              <TouchableOpacity
                onPress={() => handleAccept(ride.id)}
                disabled={loading}
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.acceptText}>قبول</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Accepted / Active Rides */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
        رحلاتي الحالية
      </Text>
      {acceptedRides.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          لا توجد رحلات حالية
        </Text>
      ) : (
        acceptedRides.map((ride) => (
          <View key={ride.id} style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.rideRow}>
              <Feather name="navigation" size={14} color={colors.accent} />
              <Text style={[styles.rideText, { color: colors.text }]} numberOfLines={1}>
                {ride.fromAddress} → {ride.toAddress}
              </Text>
            </View>
            <View style={styles.rideRow}>
              <Feather name="user" size={12} color={colors.mutedForeground} />
              <Text style={[styles.rideSubText, { color: colors.mutedForeground }]}>
                {ride.passenger?.name ?? "راكب"} · {ride.price} دج
              </Text>
            </View>
            {/* Active ride action buttons */}
            {ride.status === "accepted" && (
              <TouchableOpacity
                onPress={() => handleArrived(ride.id)}
                style={[styles.actionBtn, { backgroundColor: "#00AAFF" }]}
              >
                <Feather name="map-pin" size={16} color="#FFF" />
                <Text style={styles.actionText}>📍 وصلت للموقع</Text>
              </TouchableOpacity>
            )}
            {ride.status === "arrived" && (
              <TouchableOpacity
                onPress={() => handlePickup(ride.id)}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="check-circle" size={16} color="#FFF" />
                <Text style={styles.actionText}>🚕 استلمت الراكب</Text>
              </TouchableOpacity>
            )}
            {ride.status === "picked_up" && (
              <TouchableOpacity
                onPress={() => handleComplete(ride.id)}
                style={[styles.actionBtn, { backgroundColor: "#00CC66" }]}
              >
                <Feather name="flag" size={16} color="#FFF" />
                <Text style={styles.actionText}>✅ وصلت للوجهة</Text>
              </TouchableOpacity>
            )}
            {ride.passenger?.phone && (
              <TouchableOpacity
                onPress={() => { /* call */ }}
                style={[styles.actionBtnOutline, { borderColor: colors.border }]}
              >
                <Feather name="phone" size={14} color={colors.primary} />
                <Text style={[styles.actionTextOutline, { color: colors.primary }]}>اتصل بالراكب</Text>
              </TouchableOpacity>
            )}
            {ride.conversationId && (
              <TouchableOpacity
                onPress={() => router.push(`/conversation/${ride.conversationId}`)}
                style={[styles.actionBtnOutline, { borderColor: colors.border }]}
              >
                <Feather name="message-circle" size={14} color={colors.accent} />
                <Text style={[styles.actionTextOutline, { color: colors.accent }]}>محادثة</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Incoming Call Overlay */}
      <IncomingCallOverlay
        visible={showCallOverlay}
        ride={incomingRide}
        onAccept={() => incomingRide && handleAccept(incomingRide.id)}
        onDismiss={handleDismiss}
        loading={loading}
      />
    </View>
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
  banner: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  bannerText: { fontSize: 14, fontWeight: "600" },
  bannerLink: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  bannerSub: { fontSize: 12, textAlign: "center", marginTop: 4 },
  onlineCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  onlineIndicator: { width: 12, height: 12, borderRadius: 6 },
  onlineText: { fontSize: 16, fontWeight: "700" },
  onlineToggle: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  onlineToggleText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginHorizontal: 20, marginBottom: 10 },
  emptyText: { textAlign: "center", marginTop: 20, fontSize: 14 },
  rideCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  rideRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rideText: { flex: 1, fontSize: 13 },
  rideSubText: { flex: 1, fontSize: 11 },
  rideFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  actionBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  actionText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  actionTextOutline: { fontSize: 13, fontWeight: "600" },
  ridePrice: { fontSize: 15, fontWeight: "700" },
  acceptBtn: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  acceptText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  statusBadge: { fontSize: 12, fontWeight: "700" },
});
