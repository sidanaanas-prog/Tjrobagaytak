import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Countdown
  useEffect(() => {
    if (!visible) return;
    setCountdown(30);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          onDismiss();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [visible]);

  // Pulse animation
  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

  // Slide up
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Haptic + sound when shown
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Vibrate pattern
      if (typeof globalThis.navigator?.vibrate === "function") {
        // @ts-ignore
        navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
      }
    }
  }, [visible]);

  if (!visible || !ride) return null;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: colors.primary + "30",
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
            <Feather name={"car" as any} size={48} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            طلب كورسا جديد!
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            الأوّل يقبل يفوز
          </Text>

          {/* Ride details */}
          <View style={[styles.detailsCard, { backgroundColor: colors.card + "80", borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color="#00CC66" />
              <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
                {ride.fromAddress}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color="#FF3333" />
              <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
                {ride.toAddress}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="dollar-sign" size={16} color={colors.primary} />
              <Text style={[styles.priceText, { color: colors.text }]}>
                {ride.price} دج
              </Text>
            </View>
          </View>

          {/* Countdown */}
          <View style={[styles.countdownCircle, { borderColor: "#FF3333" }]}>
            <Text style={[styles.countdownText, { color: "#FF3333" }]}>
              {countdown}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.dismissBtn, { borderColor: colors.border }]}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
              <Text style={[styles.dismissText, { color: colors.mutedForeground }]}>
                رفض
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onAccept();
              }}
              disabled={loading}
              style={[styles.acceptBtn, { backgroundColor: colors.primary }]}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Feather name="check" size={24} color="#FFF" />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: width,
    height: height,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: height / 2 - 200,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: "center",
  },
  detailsCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  priceText: {
    fontSize: 18,
    fontWeight: "800",
  },
  countdownCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  countdownText: {
    fontSize: 22,
    fontWeight: "900",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  dismissBtn: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
  acceptBtn: {
    flex: 2,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  acceptText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
