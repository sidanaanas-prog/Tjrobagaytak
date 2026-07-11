import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

// ── أيقونات مخصصة ────────────────────────────────────────────────
function makeIcon(color: string, emoji: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      background:${color};
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
    ">${emoji}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });
}

const PASSENGER_ICON = makeIcon("#22c55e", "📍");
const DESTINATION_ICON = makeIcon("#ef4444", "🏁");
const DRIVER_ICON = makeIcon("#a855f7", "🚗");

// ── مكون يُحرك الخريطة لتكون السائق في المنتصف ──────────────────
function FlyToDriver({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const didFly = useRef(false);
  useEffect(() => {
    if (!didFly.current) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
      didFly.current = true;
    } else {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

// ── مكون يُكيّف حدود الخريطة لتشمل كل النقاط ────────────────────
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, []); // مرة واحدة عند الأول
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
  isDriver?: boolean; // السائق يتتبع موقعه بنفسه بدل polling
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
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(
    initialDriverLat && initialDriverLng
      ? { lat: Number(initialDriverLat), lng: Number(initialDriverLng) }
      : null,
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const trackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);

  // ── الراكب: polling موقع السائق كل 5 ثواني ───────────────────
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
        setLastUpdate(new Date());
      }
    } catch {}
  }, [rideId]);

  useEffect(() => {
    if (isDriver) {
      // السائق يُرسل موقعه ويُحدّث الخريطة محلياً
      if (!navigator.geolocation) return;
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setDriverPos({ lat, lng });
          setLastUpdate(new Date());
          const token = getMemToken();
          await fetch(`${BASE}/api/rides/${rideId}/location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat, lng }),
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
      return () => {
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      };
    } else {
      // الراكب: يسحب موقع السائق بانتظام
      pollDriverLocation();
      trackRef.current = setInterval(pollDriverLocation, 5000);
      return () => {
        if (trackRef.current) clearInterval(trackRef.current);
      };
    }
  }, [isDriver, rideId, pollDriverLocation]);

  // نقاط البداية للخريطة
  const center: [number, number] = fromLat && fromLng
    ? [Number(fromLat), Number(fromLng)]
    : driverPos
      ? [driverPos.lat, driverPos.lng]
      : [36.737, 3.086]; // الجزائر العاصمة افتراضياً

  const allPoints: [number, number][] = [];
  if (fromLat && fromLng) allPoints.push([Number(fromLat), Number(fromLng)]);
  if (toLat && toLng) allPoints.push([Number(toLat), Number(toLng)]);
  if (driverPos) allPoints.push([driverPos.lat, driverPos.lng]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-primary/20" style={{ height: 240 }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />

        {/* ضبط حدود الخريطة لتشمل كل النقاط */}
        {allPoints.length >= 2 && <FitBounds points={allPoints} />}

        {/* موقع الراكب (نقطة الانطلاق) */}
        {fromLat && fromLng && (
          <Marker position={[Number(fromLat), Number(fromLng)]} icon={PASSENGER_ICON}>
            <Popup>{fromAddress ?? "نقطة الانطلاق"}</Popup>
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
                {lastUpdate && (
                  <span className="block text-xs opacity-60">
                    {lastUpdate.toLocaleTimeString("ar-DZ")}
                  </span>
                )}
              </Popup>
            </Marker>
            {!isDriver && <FlyToDriver lat={driverPos.lat} lng={driverPos.lng} />}
          </>
        )}
      </MapContainer>

      {/* شارة "مباشر" */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] text-white font-bold">مباشر</span>
      </div>

      {/* وقت آخر تحديث */}
      {lastUpdate && !isDriver && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="text-[10px] text-white">
            آخر تحديث: {lastUpdate.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      )}
    </div>
  );
}
