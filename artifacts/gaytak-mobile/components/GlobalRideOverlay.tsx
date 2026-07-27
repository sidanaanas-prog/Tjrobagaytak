/**
 * GlobalRideOverlay
 * يظهر نافذة طلب الكورسا من أي شاشة — لا يحتاج السائق أن يكون في ride-driver
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { IncomingCallOverlay } from "./IncomingCallOverlay";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const POLL_MS = 3000; // كل 3 ثواني نتحقق من AsyncStorage

interface Props {
  token: string | null;
  isDriver: boolean;
}

export function GlobalRideOverlay({ token, isDriver }: Props) {
  const [incomingRide, setIncomingRide] = useState<any>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const checkedIds = useRef<Set<string>>(new Set());

  const checkForIncomingRide = useCallback(async () => {
    if (!token || !isDriver) return;
    try {
      const rideId = await AsyncStorage.getItem("incoming_ride_id");
      if (!rideId) return;
      if (checkedIds.current.has(rideId)) return; // سبق فحصه

      checkedIds.current.add(rideId);

      const res = await fetch(`https://${DOMAIN}/api/rides/${rideId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await AsyncStorage.removeItem("incoming_ride_id");
        return;
      }
      const ride = await res.json();
      if (ride && ride.status === "pending") {
        setIncomingRide(ride);
        setShowOverlay(true);
      } else {
        await AsyncStorage.removeItem("incoming_ride_id");
      }
    } catch {}
  }, [token, isDriver]);

  // ─── تحقق عند تغيير حالة التطبيق (خلفية → مقدمة) ───────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        checkForIncomingRide();
      }
    });

    return () => sub.remove();
  }, [checkForIncomingRide]);

  // ─── polling خفيف كل 3 ثواني ─────────────────────────────────────────────
  useEffect(() => {
    if (!token || !isDriver || Platform.OS === "web") return;

    checkForIncomingRide(); // فوري عند mount

    const iv = setInterval(checkForIncomingRide, POLL_MS);
    return () => clearInterval(iv);
  }, [token, isDriver, checkForIncomingRide]);

  // ─── إخفاء الـ overlay لو انتهى الطلب ──────────────────────────────────
  useEffect(() => {
    if (!showOverlay) return;
    const iv = setInterval(async () => {
      if (!incomingRide) return;
      try {
        const res = await fetch(`https://${DOMAIN}/api/rides/${incomingRide.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const ride = await res.json();
        if (!ride || ride.status !== "pending") {
          handleDismiss();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [showOverlay, incomingRide, token]);

  async function handleAccept() {
    if (!token || !incomingRide) return;
    setAccepting(true);
    try {
      const res = await fetch(
        `https://${DOMAIN}/api/rides/${incomingRide.id}/accept`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        await AsyncStorage.removeItem("incoming_ride_id");
        setShowOverlay(false);
        setIncomingRide(null);
        router.push("/ride-driver" as any);
      } else if (data.alreadyTaken) {
        handleDismiss();
      }
    } catch {}
    setAccepting(false);
  }

  function handleDismiss() {
    AsyncStorage.removeItem("incoming_ride_id").catch(() => {});
    setShowOverlay(false);
    setIncomingRide(null);
  }

  if (Platform.OS === "web") return null;

  return (
    <IncomingCallOverlay
      visible={showOverlay}
      ride={incomingRide}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
      loading={accepting}
    />
  );
}
