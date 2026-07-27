import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
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
const BASE = `https://${DOMAIN}`;
const SEARCH_DURATION = 30;

type RideStatus = "pending" | "accepted" | "arrived" | "picked_up" | "completed" | "cancelled";

type Ride = {
  id: string;
  status: RideStatus;
  fromAddress: string;
  toAddress: string;
  price: string;
  createdAt: string;
  vehicleType?: string;
  passengerCount?: number;
  paymentMethod?: string;
  driver?: { id: string; name: string; phone: string | null; avatar: string | null };
  rating?: number;
  driverRating?: number;
  commission?: number;
  netProfit?: number;
};

const STATUS_CONFIG: Record<RideStatus, { label: string; color: string; icon: string }> = {
  pending:   { label: "قيد البحث",  color: "#FACC15", icon: "clock"        },
  accepted:  { label: "تم القبول",  color: "#60A5FA", icon: "check-circle" },
  arrived:   { label: "وصل",        color: "#60A5FA", icon: "navigation"   },
  picked_up: { label: "في الرحلة",  color: "#A855F7", icon: "navigation"   },
  completed: { label: "منتهية",     color: "#4ADE80", icon: "check-circle" },
  cancelled: { label: "ملغاة",      color: "#F87171", icon: "x-circle"     },
};

const VEHICLE_TYPES = [
  { key: "car",   emoji: "🚗", label: "عادي"      },
  { key: "ac",    emoji: "❄️", label: "مكيف"      },
  { key: "suv",   emoji: "🚙", label: "دفع رباعي" },
  { key: "van",   emoji: "🚐", label: "حافلة"     },
  { key: "truck", emoji: "🚚", label: "شحن"       },
] as const;

type VehicleKey = (typeof VEHICLE_TYPES)[number]["key"];

export default function RideRequestScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { token, user } = useAuth();

  // ─── Form state ───────────────────────────────────────────────────────────
  const [fromAddress, setFromAddress]   = useState("");
  const [toAddress,   setToAddress]     = useState("");
  const [fromLat, setFromLat]           = useState<number | null>(null);
  const [fromLng, setFromLng]           = useState<number | null>(null);
  const [toLat,   setToLat]             = useState<number | null>(null);
  const [toLng,   setToLng]             = useState<number | null>(null);
  const [price,         setPrice]       = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [vehicleType,   setVehicleType] = useState<VehicleKey>("car");
  const [notes,         setNotes]       = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");

  // ─── Estimate ─────────────────────────────────────────────────────────────
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate]         = useState<{ distance: number; estimatedPrice: number; estimatedMinutes: number } | null>(null);

  // ─── GPS ──────────────────────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);

  // ─── Quick destinations ───────────────────────────────────────────────────
  const [destinations, setDestinations] = useState<{ id: string; name: string; price: string }[]>([]);

  // ─── Rides ────────────────────────────────────────────────────────────────
  const [myRides,         setMyRides]         = useState<Ride[]>([]);
  const [ridesLoading,    setRidesLoading]    = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null);
  const [ridesLoadedOnce, setRidesLoadedOnce] = useState(false);
  const prevRidesRef = useRef<Ride[]>([]);

  // ─── Search countdown ─────────────────────────────────────────────────────
  const [pendingCountdown, setPendingCountdown] = useState<number | null>(null);
  const [showPriceTip,     setShowPriceTip]     = useState(false);
  const [countdownTrigger, setCountdownTrigger] = useState(0);

  // ─── Editing price ────────────────────────────────────────────────────────
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [newPrice,       setNewPrice]       = useState("");

  // ─── Accept popup ─────────────────────────────────────────────────────────
  const [acceptedRide, setAcceptedRide] = useState<Ride | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  // ─── Price tip progress bar ───────────────────────────────────────────────
  const progressAnim = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // ── Derived ──────────────────────────────────────────────────────────────
  const pendingRide    = myRides.find((r) => r.status === "pending");
  const submittedRide  = justSubmittedId ? myRides.find((r) => r.id === justSubmittedId) : null;
  const isStillSearching = !!justSubmittedId && (
    !ridesLoadedOnce || submittedRide?.status === "pending"
  );
  const activeSearchId = pendingRide?.id ?? (isStillSearching ? justSubmittedId : null);

  // ─── Fetch rides ─────────────────────────────────────────────────────────
  const fetchMyRides = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/my?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store" as any,
      });
      if (!res.ok) return;
      const data = await res.json();
      const fresh: Ride[] = Array.isArray(data) ? data : [];
      const justAccepted = fresh.find(
        (r) => r.status === "accepted" &&
          prevRidesRef.current.some((p) => p.id === r.id && p.status === "pending")
      );
      if (justAccepted) {
        setAcceptedRide(justAccepted);
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      prevRidesRef.current = fresh;
      setMyRides(fresh);
      setRidesLoadedOnce(true);
    } catch {}
    setRidesLoading(false);
  }, [token]);

  // ─── Fetch destinations ───────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/api/rides/destinations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDestinations(d); })
      .catch(() => {});
  }, [token]);

  // ─── Polling ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMyRides();
    const iv = setInterval(fetchMyRides, activeSearchId ? 2000 : 5000);
    return () => clearInterval(iv);
  }, [fetchMyRides, activeSearchId]);

  // ─── Cleanup justSubmittedId ──────────────────────────────────────────────
  useEffect(() => {
    if (!justSubmittedId) return;
    const found = myRides.find((r) => r.id === justSubmittedId);
    if (found && found.status !== "pending") setJustSubmittedId(null);
  }, [myRides, justSubmittedId]);

  // ─── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSearchId) { setPendingCountdown(null); setShowPriceTip(false); progressAnim.setValue(1); return; }
    setPendingCountdown(SEARCH_DURATION); setShowPriceTip(false);
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0, duration: SEARCH_DURATION * 1000, useNativeDriver: false,
    }).start();
    const iv = setInterval(() => {
      setPendingCountdown((c) => {
        if (c === null || c <= 1) { setShowPriceTip(true); return null; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [activeSearchId, countdownTrigger]);

  // ─── GPS ─────────────────────────────────────────────────────────────────
  function useGps(target: "from" | "to") {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        const label = `الموقع الحالي (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        if (target === "from") { setFromLat(lat); setFromLng(lng); setFromAddress(label); }
        else                   { setToLat(lat);   setToLng(lng);   setToAddress(label);   }
        setGpsLoading(false);
      },
      () => { Alert.alert("GPS غير متاح", "تأكد من تفعيل الموقع"); setGpsLoading(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }

  // ─── Estimate price ───────────────────────────────────────────────────────
  async function estimatePrice() {
    if (!fromLat || !fromLng || !toLat || !toLng) {
      Alert.alert("تنبيه", "استخدم GPS لتحديد نقطتَي الانطلاق والوجهة أولاً");
      return;
    }
    setIsEstimating(true);
    try {
      const res = await fetch(`${BASE}/api/rides/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromLat, fromLng, toLat, toLng, vehicleType }),
      });
      const data = await res.json();
      if (res.ok) { setEstimate(data); setPrice(String(data.estimatedPrice)); }
      else Alert.alert("خطأ", data.error || "تعذر حساب السعر");
    } catch { Alert.alert("خطأ", "تعذر الاتصال"); }
    setIsEstimating(false);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!fromAddress || !toAddress || !price) {
      Alert.alert("معلومات ناقصة", "أدخل نقطة الانطلاق والوجهة والسعر");
      return;
    }
    if (!token) { Alert.alert("تنبيه", "سجّل دخولك أولاً"); return; }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${BASE}/api/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fromAddress, toAddress,
          price: Number(price),
          passengerCount: Number(passengerCount) || 1,
          vehicleType, notes, paymentMethod,
          estimatedPrice: estimate?.estimatedPrice,
          fromLat, fromLng, toLat, toLng,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setJustSubmittedId(data.id);
        setCountdownTrigger(Date.now());
        fetchMyRides();
        setFromAddress(""); setToAddress(""); setPrice(""); setNotes("");
        setEstimate(null); setFromLat(null); setFromLng(null); setToLat(null); setToLng(null);
      } else {
        Alert.alert("خطأ", data.error || "فشل الطلب");
      }
    } catch { Alert.alert("خطأ", "تعذر الاتصال بالخادم"); }
    setSubmitting(false);
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────
  async function handleCancel(id: string) {
    await fetch(`${BASE}/api/rides/${id}/cancel`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}` },
    });
    fetchMyRides();
  }

  // ─── Complete (passenger arrived) ─────────────────────────────────────────
  async function handleComplete(id: string) {
    const res = await fetch(`${BASE}/api/rides/${id}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Alert.alert("🎉 الحمد لله على السلامة!", "تم تأكيد وصولك وإغلاق الرحلة");
      fetchMyRides();
    } else { Alert.alert("خطأ", data.error || "تعذر التأكيد"); }
  }

  // ─── Rate ────────────────────────────────────────────────────────────────
  async function handleRate(id: string, stars: number) {
    await fetch(`${BASE}/api/rides/${id}/rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: stars }),
    });
    fetchMyRides();
  }

  // ─── Change price ─────────────────────────────────────────────────────────
  async function handleChangePrice(id: string) {
    if (!newPrice || Number(newPrice) <= 0) { Alert.alert("سعر غير صالح"); return; }
    const res = await fetch(`${BASE}/api/rides/${id}/price`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ price: Number(newPrice) }),
    });
    if (res.ok) {
      setEditingPriceId(null); setNewPrice(""); setCountdownTrigger(Date.now());
      Alert.alert("✅ تم تحديث السعر");
    }
    fetchMyRides();
  }

  const walletBalance = (user as any)?.walletBalance ?? 0;
  const points        = (user as any)?.points        ?? 0;
  const noShowCount   = (user as any)?.noShowCount   ?? 0;
  const rideBannedUntil = (user as any)?.rideBannedUntil;

  // ─── Render ride card ─────────────────────────────────────────────────────
  function renderRideCard(r: Ride) {
    const s = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
    const isActive = ["accepted", "arrived", "picked_up"].includes(r.status);
    return (
      <View key={r.id} style={[styles.rideCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.rideHeader}>
          <View style={[styles.statusIcon, { backgroundColor: s.color + "20" }]}>
            <Feather name={s.icon as any} size={16} color={s.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rideTopRow}>
              <Text style={[styles.statusLabel, { color: s.color }]}>{s.label}</Text>
              <View style={styles.rideBadges}>
                <Text style={[styles.badge, { backgroundColor: "#EAB30820", color: "#EAB308" }]}>
                  {r.price} ألف دورو
                </Text>
                {r.passengerCount && r.passengerCount > 1 && (
                  <Text style={[styles.badge, { backgroundColor: "#3B82F620", color: "#60A5FA" }]}>
                    {r.passengerCount} ركاب
                  </Text>
                )}
                {r.paymentMethod === "wallet" && (
                  <Text style={[styles.badge, { backgroundColor: colors.primary + "20", color: colors.primary }]}>
                    💳 محفظة
                  </Text>
                )}
              </View>
            </View>
            {/* Route */}
            <Text style={styles.rideRoute}>
              <Text style={{ color: "#4ADE80" }}>{r.fromAddress}</Text>
              <Text style={{ color: colors.mutedForeground }}> → </Text>
              <Text style={{ color: "#F87171" }}>{r.toAddress}</Text>
            </Text>

            {/* Driver info */}
            {r.driver && (
              <View style={styles.driverRow}>
                <Feather name="user" size={12} color={colors.mutedForeground} />
                <Text style={[styles.driverName, { color: colors.mutedForeground }]}>{r.driver.name}</Text>
                {r.driver.phone && (
                  <TouchableOpacity
                    style={[styles.callBtn, { backgroundColor: "#22C55E20", borderColor: "#22C55E40" }]}
                    onPress={() => Linking.openURL(`tel:${r.driver!.phone}`)}
                  >
                    <Feather name="phone" size={11} color="#4ADE80" />
                    <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "700" }}>اتصل</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Pending: countdown + price tip + cancel */}
        {r.status === "pending" && (
          <View style={{ marginTop: 10, gap: 8 }}>
            {pendingCountdown !== null && r.id === activeSearchId && (
              <View style={[styles.countdownBox, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                <View style={styles.countdownRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.countdownLabel, { color: colors.primary }]}>جاري البحث عن سائق...</Text>
                </View>
                <Text style={[styles.countdownNum, { color: colors.primary }]}>
                  {String(pendingCountdown).padStart(2, "0")} ث
                </Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.primary + "20" }]}>
                  <Animated.View style={[styles.progressBar, {
                    backgroundColor: colors.primary,
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  }]} />
                </View>
              </View>
            )}

            {showPriceTip && r.id === activeSearchId && (
              <View style={[styles.priceTipBox, { backgroundColor: "#EAB30810", borderColor: "#EAB30830" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="trending-up" size={14} color="#EAB308" />
                  <Text style={{ color: "#EAB308", fontSize: 12, fontWeight: "700" }}>
                    لم يتم إيجاد سائق — أعد المحاولة أو زِد السعر
                  </Text>
                </View>
                {editingPriceId === r.id ? (
                  <View style={styles.editPriceRow}>
                    <TextInput
                      style={[styles.editPriceInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                      value={newPrice}
                      onChangeText={setNewPrice}
                      keyboardType="numeric"
                      placeholder="السعر الجديد"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TouchableOpacity
                      style={[styles.editPriceBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleChangePrice(r.id)}
                    >
                      <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>تحديث</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editPriceBtn, { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => { setEditingPriceId(null); setNewPrice(""); }}
                    >
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>إلغاء</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.editPriceRow}>
                    <TouchableOpacity
                      style={[styles.tipActionBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}
                      onPress={() => setCountdownTrigger(Date.now())}
                    >
                      <Feather name="refresh-cw" size={12} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>أعد البحث</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tipActionBtn, { backgroundColor: "#EAB30820", borderColor: "#EAB30840" }]}
                      onPress={() => { setEditingPriceId(r.id); setNewPrice(r.price); }}
                    >
                      <Feather name="trending-up" size={12} color="#EAB308" />
                      <Text style={{ color: "#EAB308", fontSize: 11, fontWeight: "700" }}>زِد السعر</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: "#F8717140" }]}
              onPress={() => handleCancel(r.id)}
            >
              <Feather name="x-circle" size={13} color="#F87171" />
              <Text style={{ color: "#F87171", fontSize: 12, fontWeight: "700" }}>إلغاء الطلب</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active ride: "وصلت" + cancel */}
        {isActive && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <View style={[styles.arrivedBox, { backgroundColor: "#22C55E10", borderColor: "#22C55E30" }]}>
              <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "700", textAlign: "center" }}>
                ✅ عند وصولك إلى وجهتك اضغط على "وصلت"
              </Text>
              <TouchableOpacity
                style={[styles.arrivedBtn, { backgroundColor: "#22C55E" }]}
                onPress={() => handleComplete(r.id)}
              >
                <Feather name="check-circle" size={14} color="#FFF" />
                <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>وصلت (تأكيد الوصول)</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: "#F8717140" }]}
              onPress={() => handleCancel(r.id)}
            >
              <Feather name="x-circle" size={13} color="#F87171" />
              <Text style={{ color: "#F87171", fontSize: 12, fontWeight: "700" }}>إلغاء الرحلة</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SOS for picked_up */}
        {r.status === "picked_up" && (
          <TouchableOpacity style={[styles.sosBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}>
            <Feather name="alert-triangle" size={14} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "700" }}>زر SOS — إبلاغ طارئ</Text>
          </TouchableOpacity>
        )}

        {/* Rating for completed */}
        {r.status === "completed" && !r.driverRating && (
          <View style={styles.ratingRow}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>قيّم السائق: </Text>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleRate(r.id, star)}>
                <Feather
                  name="star"
                  size={18}
                  color={star <= (r.rating ?? 0) ? "#FACC15" : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>طلب كورسا</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 14 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Wallet card ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.primary + "30", colors.primary + "15", "transparent"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[styles.walletCard, { borderColor: colors.primary + "30" }]}
        >
          <View style={styles.walletStats}>
            <View>
              <Text style={[styles.walletLabel, { color: colors.primary + "BB" }]}>المحفظة</Text>
              <Text style={[styles.walletValue, { color: colors.primary }]}>
                {Number(walletBalance).toLocaleString("ar-DZ")}{" "}
                <Text style={styles.walletUnit}>ألف دورو</Text>
              </Text>
            </View>
            <View style={[styles.walletDivider, { backgroundColor: colors.primary + "30" }]} />
            <View>
              <Text style={[styles.walletLabel, { color: "#EAB308BB" }]}>نقاط المكافآت 🎁</Text>
              <Text style={[styles.walletValue, { color: "#EAB308" }]}>
                {Number(points).toLocaleString("ar-DZ")}{" "}
                <Text style={styles.walletUnit}>نقطة</Text>
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.walletBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/wallet" as any)}
          >
            <Feather name="credit-card" size={14} color="#FFF" />
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>المحفظة</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Form card ───────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary + "30" }]}>
          {/* Title */}
          <View style={styles.formTitle}>
            <View style={[styles.formIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="navigation" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.formTitleText, { color: colors.text }]}>احجز كورسا</Text>
            <View style={[styles.fastTag, { backgroundColor: colors.primary + "20" }]}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "700" }}>حجوزات سريعة</Text>
            </View>
          </View>

          {/* Quick destinations */}
          {destinations.length > 0 && (
            <View style={[styles.destBox, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "20" }]}>
              <Text style={[styles.destLabel, { color: colors.mutedForeground }]}>📍 وجهات سريعة بأسعار ثابتة:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {destinations.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.destBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => { setFromAddress("موقعي الحالي"); setToAddress(d.name); setPrice(String(d.price)); }}
                  >
                    <Text style={[{ color: colors.primary, fontSize: 12, fontWeight: "700" }]}>{d.name}</Text>
                    <View style={[styles.destPrice, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "900" }}>{d.price} ألف دورو</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* From */}
          <View style={styles.routeRow}>
            <TouchableOpacity
              style={[styles.gpsBtn, { backgroundColor: "#22C55E20" }]}
              onPress={() => useGps("from")} disabled={gpsLoading}
            >
              {gpsLoading
                ? <ActivityIndicator size="small" color="#4ADE80" />
                : <Feather name="crosshair" size={14} color="#4ADE80" />
              }
            </TouchableOpacity>
            <TextInput
              style={[styles.routeInput, { backgroundColor: colors.background, color: colors.text, borderColor: "#22C55E50" }]}
              placeholder="الانطلاق من..."
              placeholderTextColor={colors.mutedForeground}
              value={fromAddress}
              onChangeText={setFromAddress}
            />
          </View>

          {/* Route visual divider */}
          <View style={styles.routeDivider}>
            <View style={{ width: 2, height: 22, backgroundColor: undefined, marginRight: 14 }}>
              <LinearGradient colors={["#22C55E80", "#EF444480"]} style={{ flex: 1, borderRadius: 2 }} />
            </View>
            <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>المسار</Text>
          </View>

          {/* To */}
          <View style={styles.routeRow}>
            <TouchableOpacity
              style={[styles.gpsBtn, { backgroundColor: "#EF444420" }]}
              onPress={() => useGps("to")} disabled={gpsLoading}
            >
              {gpsLoading
                ? <ActivityIndicator size="small" color="#F87171" />
                : <Feather name="map-pin" size={14} color="#F87171" />
              }
            </TouchableOpacity>
            <TextInput
              style={[styles.routeInput, { backgroundColor: colors.background, color: colors.text, borderColor: "#EF444450" }]}
              placeholder="الوصول إلى..."
              placeholderTextColor={colors.mutedForeground}
              value={toAddress}
              onChangeText={setToAddress}
            />
          </View>

          {/* Auto estimate button */}
          <TouchableOpacity
            style={[styles.estimateBtn, { backgroundColor: "#3B82F618", borderColor: "#3B82F630", opacity: (!fromLat || !fromLng) ? 0.45 : 1 }]}
            onPress={estimatePrice}
            disabled={isEstimating || !fromLat || !fromLng}
          >
            {isEstimating
              ? <ActivityIndicator size="small" color="#60A5FA" />
              : <><Feather name="refresh-cw" size={14} color="#60A5FA" /><Text style={{ color: "#60A5FA", fontSize: 12, fontWeight: "700" }}>حساب السعر التلقائي</Text></>
            }
          </TouchableOpacity>

          {/* Estimate result */}
          {estimate && (
            <View style={[styles.estimateResult, { backgroundColor: "#3B82F608", borderColor: "#3B82F620" }]}>
              {[
                { label: "المسافة", value: `${estimate.distance} كم` },
                { label: "الوقت التقريبي", value: `${estimate.estimatedMinutes} دقيقة` },
                { label: "السعر التقديري", value: `${estimate.estimatedPrice.toLocaleString("ar-DZ")} ألف دورو`, highlight: true },
              ].map((row) => (
                <View key={row.label} style={styles.estimateRow}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{row.label}</Text>
                  <Text style={[styles.estimateValue, row.highlight && { color: colors.primary, fontWeight: "900" }, { color: row.highlight ? colors.primary : colors.text }]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Price */}
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>تسعير الكورسة (ألف دورو)</Text>
            <TextInput
              style={[styles.priceInput, { backgroundColor: colors.background, borderColor: "#EAB30850", color: "#EAB308" }]}
              placeholder="أدخل السعر المقترح"
              placeholderTextColor={colors.mutedForeground}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>

          {/* Payment method */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>طريقة الدفع</Text>
            <View style={styles.payRow}>
              {([
                { key: "cash",   label: "💵 نقدي",   activeColor: "#EAB308", activeBg: "#EAB30818" },
                { key: "wallet", label: "💳 محفظة",  activeColor: colors.primary, activeBg: colors.primary + "18" },
              ] as const).map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.payBtn, {
                    backgroundColor: paymentMethod === m.key ? m.activeBg : colors.background,
                    borderColor:     paymentMethod === m.key ? m.activeColor + "50" : colors.border,
                  }]}
                  onPress={() => setPaymentMethod(m.key)}
                >
                  <Text style={[styles.payBtnText, { color: paymentMethod === m.key ? m.activeColor : colors.mutedForeground }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* No-show warning */}
          {noShowCount > 0 && (
            <View style={[styles.noShowBox, { backgroundColor: "#EF444410", borderColor: "#EF444430" }]}>
              <Feather name="alert-triangle" size={14} color="#F87171" />
              <Text style={{ color: "#F87171", fontSize: 11, fontWeight: "700" }}>
                تبليغات الغياب: {noShowCount}/3
              </Text>
              {rideBannedUntil && new Date(rideBannedUntil) > new Date() && (
                <Text style={{ color: "#F87171BB", fontSize: 10 }}>
                  محظور حتى {new Date(rideBannedUntil).toLocaleDateString("ar-DZ")}
                </Text>
              )}
            </View>
          )}

          {/* Vehicle type */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>نوع السيارة</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.key}
                  style={[styles.vehicleBtn, {
                    backgroundColor: vehicleType === v.key ? colors.primary + "25" : colors.background,
                    borderColor:     vehicleType === v.key ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setVehicleType(v.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                >
                  <Text style={{ fontSize: 20 }}>{v.emoji}</Text>
                  <Text style={[styles.vehicleLabel, { color: vehicleType === v.key ? colors.primary : colors.mutedForeground }]}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Passengers + Notes */}
          <View style={styles.passengerNotesRow}>
            <TextInput
              style={[styles.passengerInput, { backgroundColor: colors.background, color: "#60A5FA", borderColor: "#3B82F640" }]}
              placeholder="الركاب"
              placeholderTextColor={colors.mutedForeground}
              value={passengerCount}
              onChangeText={setPassengerCount}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="ملاحظات (اختياري)"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <><Feather name="send" size={18} color="#FFF" /><Text style={styles.submitText}>اطلب الآن — السائق يرد عليك!</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* ── Global search banner ─────────────────────────────────────────── */}
        {activeSearchId && pendingCountdown !== null && (
          <View style={[styles.searchBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "25" }]}>
            <View style={styles.searchBannerRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.searchBannerText, { color: colors.primary }]}>جاري البحث عن سائق قريب...</Text>
            </View>
            <Text style={[styles.countdownBig, { color: colors.primary }]}>
              {String(pendingCountdown).padStart(2, "0")} ث
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.primary + "20" }]}>
              <Animated.View style={[styles.progressBar, {
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              }]} />
            </View>
          </View>
        )}

        {/* ── My rides ────────────────────────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>رحلاتي</Text>
          </View>
          {ridesLoading
            ? <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
            : myRides.length === 0
              ? <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>ليس لديك رحلات بعد</Text>
              : myRides.map(renderRideCard)
          }
        </View>
      </ScrollView>

      {/* ── Accept popup ────────────────────────────────────────────────────── */}
      <Modal visible={!!acceptedRide} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.acceptCard,
            { backgroundColor: colors.card, borderColor: "#22C55E40", transform: [{ scale: scaleAnim }] }
          ]}>
            <View style={[styles.acceptIcon, { backgroundColor: "#22C55E20" }]}>
              <Feather name="check-circle" size={32} color="#4ADE80" />
            </View>
            <Text style={[styles.acceptTitle, { color: "#4ADE80" }]}>✅ قُبلت كورستك!</Text>
            <Text style={[styles.acceptSub, { color: colors.mutedForeground }]}>السائق في طريقه إليك</Text>
            {acceptedRide?.driver && (
              <View style={[styles.driverCard, { backgroundColor: colors.muted + "50" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="user" size={14} color={colors.primary} />
                  <Text style={[styles.driverCardName, { color: colors.text }]}>{acceptedRide.driver.name}</Text>
                </View>
                {acceptedRide.driver.phone && (
                  <TouchableOpacity
                    style={[styles.driverCallBtn, { backgroundColor: "#22C55E20", borderColor: "#22C55E40" }]}
                    onPress={() => Linking.openURL(`tel:${acceptedRide!.driver!.phone}`)}
                  >
                    <Feather name="phone" size={14} color="#4ADE80" />
                    <Text style={{ color: "#4ADE80", fontWeight: "700" }}>{acceptedRide.driver.phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity
              style={[styles.acceptDismiss, { backgroundColor: "#22C55E" }]}
              onPress={() => setAcceptedRide(null)}
            >
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>حسناً، شكراً!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  backBtn:          { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle:      { fontSize: 18, fontWeight: "700" },
  scroll:           { flex: 1 },

  // Wallet
  walletCard:       { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  walletStats:      { flexDirection: "row", alignItems: "center", gap: 16 },
  walletLabel:      { fontSize: 10, fontWeight: "600", marginBottom: 2 },
  walletValue:      { fontSize: 17, fontWeight: "900" },
  walletUnit:       { fontSize: 9, fontWeight: "700" },
  walletDivider:    { width: 1, height: 36 },
  walletBtn:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },

  // Form card
  card:             { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12 },
  formTitle:        { flexDirection: "row", alignItems: "center", gap: 10 },
  formIconWrap:     { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  formTitleText:    { fontSize: 16, fontWeight: "700", flex: 1 },
  fastTag:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },

  // Destinations
  destBox:          { borderRadius: 12, borderWidth: 1, padding: 10, gap: 8 },
  destLabel:        { fontSize: 10, fontWeight: "700" },
  destBtn:          { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  destPrice:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Route
  routeRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsBtn:           { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  routeInput:       { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13 },
  routeDivider:     { flexDirection: "row", alignItems: "center", paddingLeft: 4 },
  estimateBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  estimateResult:   { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  estimateRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  estimateValue:    { fontSize: 13, fontWeight: "700" },

  // Price
  fieldLabel:       { fontSize: 10, fontWeight: "700", marginBottom: 6 },
  priceInput:       { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "700" },

  // Payment
  payRow:           { flexDirection: "row", gap: 10 },
  payBtn:           { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  payBtnText:       { fontSize: 12, fontWeight: "700" },

  // No-show
  noShowBox:        { borderRadius: 12, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },

  // Vehicle
  vehicleRow:       { flexDirection: "row", gap: 6 },
  vehicleBtn:       { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 2 },
  vehicleLabel:     { fontSize: 9, fontWeight: "700" },

  // Passengers + notes
  passengerNotesRow: { flexDirection: "row", gap: 10 },
  passengerInput:    { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontWeight: "700" },
  notesInput:        { flex: 2, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13 },

  // Submit
  submitBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14, shadowColor: "#A855F7", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  submitText:       { color: "#FFF", fontSize: 14, fontWeight: "700" },

  // Search banner
  searchBanner:     { borderRadius: 16, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  searchBannerRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBannerText: { fontWeight: "700", fontSize: 14 },
  countdownBig:     { fontSize: 40, fontWeight: "900", fontVariant: ["tabular-nums"] },
  progressTrack:    { width: "100%", height: 6, borderRadius: 3, overflow: "hidden" },
  progressBar:      { height: "100%", borderRadius: 3 },

  // Ride cards
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle:     { fontSize: 14, fontWeight: "700" },
  emptyText:        { textAlign: "center", marginVertical: 28, fontSize: 14 },
  rideCard:         { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  rideHeader:       { flexDirection: "row", gap: 10 },
  statusIcon:       { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rideTopRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  statusLabel:      { fontSize: 12, fontWeight: "700" },
  rideBadges:       { flexDirection: "row", gap: 4 },
  badge:            { fontSize: 10, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  rideRoute:        { fontSize: 12, lineHeight: 18, marginTop: 2 },
  driverRow:        { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  driverName:       { fontSize: 12, flex: 1 },
  callBtn:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },

  // Countdown in card
  countdownBox:     { borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 6 },
  countdownRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  countdownLabel:   { fontSize: 13, fontWeight: "700" },
  countdownNum:     { fontSize: 28, fontWeight: "900" },

  // Price tip
  priceTipBox:      { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  editPriceRow:     { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 4 },
  editPriceInput:   { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  editPriceBtn:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  tipActionBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },

  cancelBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 8 },

  // Active
  arrivedBox:       { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  arrivedBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10 },
  sosBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 8, borderWidth: 1, marginTop: 8 },
  ratingRow:        { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },

  // Accept modal
  modalOverlay:     { flex: 1, backgroundColor: "#00000099", alignItems: "center", justifyContent: "center", padding: 24 },
  acceptCard:       { width: "100%", maxWidth: 360, borderRadius: 20, borderWidth: 2, padding: 24, alignItems: "center", gap: 12 },
  acceptIcon:       { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  acceptTitle:      { fontSize: 22, fontWeight: "900" },
  acceptSub:        { fontSize: 13 },
  driverCard:       { width: "100%", borderRadius: 14, padding: 12, gap: 10 },
  driverCardName:   { fontSize: 14, fontWeight: "700" },
  driverCallBtn:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  acceptDismiss:    { width: "100%", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
});
