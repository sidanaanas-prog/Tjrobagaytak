import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

interface Props {
  visible: boolean;
  ride: any;
  onAccept: () => void;
  onDismiss: () => void;
  loading: boolean;
}

export function IncomingCallOverlay({ visible, ride, onAccept, onDismiss, loading }: Props) {
  const colors = useColors();
  const [countdown, setCountdown] = useState(30);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulse2Anim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  // ─── Ringtone ─────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function playRingtone() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          require("../assets/sounds/alert.mp3"),
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        if (active) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (e) {
        console.warn("[ringtone] error:", e);
      }
    }

    async function stopRingtone() {
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {}
        soundRef.current = null;
      }
    }

    if (visible) {
      playRingtone();
    } else {
      stopRingtone();
    }

    return () => {
      active = false;
      stopRingtone();
    };
  }, [visible]);

  // ─── Countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setCountdown(30);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(iv); onDismiss(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [visible]);

  // ─── Pulse animations (2 rings) ───────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const pulse1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    const pulse2 = Animated.loop(
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(pulse2Anim, { toValue: 1.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse2Anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse1.start();
    pulse2.start();
    return () => { pulse1.stop(); pulse2.stop(); };
  }, [visible]);

  // ─── Slide up ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8, tension: 65 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  // ─── Haptic ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1200);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return () => clearInterval(iv);
  }, [visible]);

  if (!visible || !ride) return null;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>

          {/* خلفية داكنة بتدرج */}
          <View style={styles.bgGradient} />

          {/* حلقات نبض */}
          <View style={styles.pulseCenter}>
            <Animated.View style={[styles.pulseRing2, { transform: [{ scale: pulse2Anim }] }]} />
            <Animated.View style={[styles.pulseRing1, { transform: [{ scale: pulseAnim }] }]} />

            {/* أيقونة السيارة */}
            <View style={styles.iconCircle}>
              <Feather name={"car" as any} size={54} color="#FFF" />
            </View>
          </View>

          {/* العنوان */}
          <Text style={styles.title}>طلب كورسا جديد! 🚖</Text>
          <Text style={styles.subtitle}>الأوّل يقبل يفوز</Text>

          {/* تفاصيل الرحلة */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color="#00E676" />
              <Text style={styles.detailText} numberOfLines={1}>{ride.fromAddress}</Text>
            </View>
            <View style={[styles.detailRow, { marginBottom: 0 }]}>
              <Feather name="map-pin" size={16} color="#FF5252" />
              <Text style={styles.detailText} numberOfLines={1}>{ride.toAddress}</Text>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailFooter}>
              <View style={styles.detailChip}>
                <Feather name="users" size={13} color="rgba(255,255,255,0.7)" />
                <Text style={styles.chipText}>{ride.passengerCount ?? 1} راكب · {vTypeLabel(ride.vehicleType)}</Text>
              </View>
              <Text style={styles.priceText}>{ride.price} دج</Text>
            </View>
          </View>

          {/* عداد تنازلي */}
          <View style={styles.countdownWrap}>
            <View style={styles.countdownCircle}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
            <Text style={styles.countdownLabel}>ثانية متبقية</Text>
          </View>

          {/* أزرار القبول / الرفض */}
          <View style={styles.buttonRow}>
            {/* رفض */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDismiss(); }}
              style={styles.rejectBtn}
            >
              <Feather name="phone-off" size={28} color="#FFF" />
              <Text style={styles.rejectText}>رفض</Text>
            </TouchableOpacity>

            {/* قبول */}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onAccept(); }}
              disabled={loading}
              style={styles.acceptBtn}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="large" />
              ) : (
                <>
                  <Feather name="phone" size={28} color="#FFF" />
                  <Text style={styles.acceptText}>قبول</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

function vTypeLabel(t: string | undefined): string {
  const map: Record<string, string> = {
    car: "🚗 عادي", ac: "❄️ مكيف", suv: "🚙 دفع رباعي", van: "🚐 حافلة", truck: "🚚 شحن",
  };
  return map[t ?? "car"] ?? "🚗 عادي";
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0A1A",
  },
  pulseCenter: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    width: 180,
    height: 180,
  },
  pulseRing1: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(170,51,255,0.2)",
    borderWidth: 2,
    borderColor: "rgba(170,51,255,0.35)",
  },
  pulseRing2: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(170,51,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(170,51,255,0.2)",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#AA33FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#AA33FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFF",
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  subtitle: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 28, textAlign: "center" },
  detailsCard: {
    width: "100%",
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  detailText: { color: "#FFF", fontSize: 14, flex: 1, fontWeight: "500" },
  detailDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 10 },
  detailFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipText: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  priceText: { color: "#AA33FF", fontSize: 22, fontWeight: "900" },
  countdownWrap: { alignItems: "center", marginBottom: 32, gap: 6 },
  countdownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FF5252",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,82,82,0.1)",
  },
  countdownText: { fontSize: 24, fontWeight: "900", color: "#FF5252" },
  countdownLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  buttonRow: {
    flexDirection: "row",
    gap: 24,
    width: "100%",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  rejectText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  acceptBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#34C759",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  acceptText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
});
