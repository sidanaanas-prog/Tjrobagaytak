import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

// ── أيقونات مخصصة ────────────────────────────────────────────────
function makeIcon(color: string, emoji: string, size = 40) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:${size * 0.45}px;
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// أيقونة الراكب المباشر — نبضة خضراء
function makeLivePassengerIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:44px;height:44px">
      <div style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(34,197,94,0.25);
        animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;
      "></div>
      <div style="
        position:absolute;inset:4px;border-radius:50%;
        background:#22c55e;border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:16px;
      ">🧍</div>
    </div>
    <style>
      @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
    </style>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  });
}

const PICKUP_ICON     = makeIcon("#16a34a", "📍", 36);
const DESTINATION_ICON = makeIcon("#ef4444", "🏁", 36);
const DRIVER_ICON     = makeIcon("#a855f7", "🚗", 40);
const LIVE_PASSENGER_ICON = makeLivePassengerIcon();

// ── تحريك الخريطة نحو نقطة ──────────────────────────────────────
function PanTo({ lat, lng, fly = false }: { lat: number; lng: number; fly?: boolean }) {
  const map = useMap();
  const prev = useRef<string>("");
  useEffect(() => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === prev.current) return;
    prev.current = key;
    if (fly) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    } else {
      map.panTo([lat, lng], { animate: true, duration: 0.6 });
    }
  }, [lat, lng, fly, map]);
  return null;
}

// ── ضبط حدود الخريطة لتشمل كل النقاط ───────────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length < 2) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
  }, [points, map]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────
type RideMapProps = {
  rideId: string;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  fromAddress?: string;
  toAddress?: string;
  initialDriverLat?: number | null;
  initialDriverLng?: number | null;
  isDriver?: boolean;
};

export default function RideMap({
  rideId,
  fromLat,
  fromLng,
  toLat,
  toLng,
  fromAddress,
  toAddress,
  initialDriverLat,
  initialDriverLng,
  isDriver = false,
}: RideMapProps) {
  // موقع السائق (يتحرك)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    initialDriverLat && initialDriverLng
      ? { lat: Number(initialDriverLat), lng: Number(initialDriverLng) }
      : null,
  );
  // موقع الراكب الحي (GPS المباشر)
  const [passengerPos, setPassengerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastDriverUpdate, setLastDriverUpdate] = useState<Date | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef  = useRef<number | null>(null);

  // ── للراكب: تتبع موقعه الحي + polling موقع السائق ────────────
  const pollDriverLocation = useCallback(async () => {
    const token = getMemToken();
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/rides/${rideId}/live`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.driverLat && data.driverLng) {
        setDriverPos({ lat: Number(data.driverLat), lng: Number(data.driverLng) });
        setLastDriverUpdate(new Date());
      }
    } catch {}
  }, [rideId]);

  useEffect(() => {
    if (isDriver) {
      // ── السائق: يُرسل موقعه بـ watchPosition ──────────────────
      if (!navigator.geolocation) return;
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setDriverPos({ lat, lng });
          setLastDriverUpdate(new Date());
          const token = getMemToken();
          await fetch(`${BASE}/api/rides/${rideId}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat, lng }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 4000 },
      );
      return () => {
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      };
    } else {
      // ── الراكب: يتتبع موقعه الحي + يسحب موقع السائق ──────────
      if (navigator.geolocation) {
        watchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setPassengerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsAccuracy(Math.round(pos.coords.accuracy));
            setGpsError(null);
          },
          (err) => {
            setGpsError(err.code === 1 ? "اسمح بالوصول للموقع" : "GPS غير متاح");
          },
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
        );
      }

      pollDriverLocation();
      pollRef.current = setInterval(pollDriverLocation, 5000);

      return () => {
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [isDriver, rideId, pollDriverLocation]);

  // ── مركز الخريطة الأولي ──────────────────────────────────────
  const center: [number, number] =
    passengerPos
      ? [passengerPos.lat, passengerPos.lng]
      : fromLat && fromLng
        ? [Number(fromLat), Number(fromLng)]
        : driverPos
          ? [driverPos.lat, driverPos.lng]
          : [36.737, 3.086];

  // كل النقاط لضبط الحدود
  const allPoints: [number, number][] = [];
  if (passengerPos) allPoints.push([passengerPos.lat, passengerPos.lng]);
  else if (fromLat && fromLng) allPoints.push([Number(fromLat), Number(fromLng)]);
  if (toLat && toLng) allPoints.push([Number(toLat), Number(toLng)]);
  if (driverPos) allPoints.push([driverPos.lat, driverPos.lng]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-primary/20" style={{ height: 260 }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* ضبط حدود الخريطة مرة واحدة */}
        {allPoints.length >= 2 && <FitBounds points={allPoints} />}

        {/* موقع الراكب الحي (يتحرك) — للراكب فقط */}
        {!isDriver && passengerPos && (
          <>
            <Marker position={[passengerPos.lat, passengerPos.lng]} icon={LIVE_PASSENGER_ICON}>
              <Popup>
                موقعك الحالي
                {gpsAccuracy !== null && (
                  <span className="block text-xs opacity-60">دقة: ±{gpsAccuracy}م</span>
                )}
              </Popup>
            </Marker>
            {/* الخريطة تتبع الراكب */}
            <PanTo lat={passengerPos.lat} lng={passengerPos.lng} />
          </>
        )}

        {/* نقطة الانطلاق الثابتة (تظهر فقط إذا لم يكن هناك GPS للراكب) */}
        {!isDriver && !passengerPos && fromLat && fromLng && (
          <Marker position={[Number(fromLat), Number(fromLng)]} icon={PICKUP_ICON}>
            <Popup>{fromAddress ?? "نقطة الانطلاق"}</Popup>
          </Marker>
        )}

        {/* نقطة الانطلاق للسائق */}
        {isDriver && fromLat && fromLng && (
          <Marker position={[Number(fromLat), Number(fromLng)]} icon={PICKUP_ICON}>
            <Popup>{fromAddress ?? "موقع الراكب"}</Popup>
          </Marker>
        )}

        {/* الوجهة */}
        {toLat && toLng && (
          <Marker position={[Number(toLat), Number(toLng)]} icon={DESTINATION_ICON}>
            <Popup>{toAddress ?? "الوجهة"}</Popup>
          </Marker>
        )}

        {/* موقع السائق (يتحرك) */}
        {driverPos && (
          <>
            <Marker position={[driverPos.lat, driverPos.lng]} icon={DRIVER_ICON}>
              <Popup>
                {isDriver ? "موقعك الحالي" : "السائق"}
                {lastDriverUpdate && (
                  <span className="block text-xs opacity-60">
                    {lastDriverUpdate.toLocaleTimeString("ar-DZ")}
                  </span>
                )}
              </Popup>
            </Marker>
            {/* الخريطة تتبع السائق عند الراكب (إذا لم يكن هناك GPS للراكب) */}
            {!isDriver && !passengerPos && (
              <PanTo lat={driverPos.lat} lng={driverPos.lng} fly />
            )}
          </>
        )}
      </MapContainer>

      {/* شارة "مباشر" */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] text-white font-bold">مباشر</span>
      </div>

      {/* دقة GPS الراكب */}
      {!isDriver && passengerPos && gpsAccuracy !== null && (
        <div className="absolute top-2 left-2 z-[1000] flex items-center gap-1 bg-green-600/80 backdrop-blur-sm rounded-full px-2.5 py-1">
          <span className="text-[10px] text-white font-bold">🧍 ±{gpsAccuracy}م</span>
        </div>
      )}

      {/* خطأ GPS */}
      {!isDriver && gpsError && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-red-500/90 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <span className="text-[11px] text-white font-bold">⚠️ {gpsError}</span>
        </div>
      )}

      {/* آخر تحديث للسائق */}
      {lastDriverUpdate && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-[10px] text-white">
            🚗 {lastDriverUpdate.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}
