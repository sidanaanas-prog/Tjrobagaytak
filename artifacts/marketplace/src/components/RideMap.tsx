import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

// ── أيقونات ─────────────────────────────────────────────────────
function makeIcon(color: string, emoji: string, size = 40) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.44)}px">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

function makeLivePassengerIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:44px;height:44px">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.25);animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite"></div>
      <div style="position:absolute;inset:4px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:16px">🧍</div>
    </div><style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  });
}

const PICKUP_ICON      = makeIcon("#16a34a", "📍", 36);
const DESTINATION_ICON = makeIcon("#ef4444", "🏁", 36);
const DRIVER_ICON      = makeIcon("#a855f7", "🚗", 42);
const LIVE_PASSENGER   = makeLivePassengerIcon();

// ── تحريك الخريطة ────────────────────────────────────────────────
function PanTo({ lat, lng, fly = false }: { lat: number; lng: number; fly?: boolean }) {
  const map = useMap();
  const prev = useRef("");
  useEffect(() => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (key === prev.current) return;
    prev.current = key;
    fly ? map.flyTo([lat, lng], 15, { duration: 1.5 }) : map.panTo([lat, lng], { animate: true, duration: 0.6 });
  }, [lat, lng, fly, map]);
  return null;
}

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

// ── Props ────────────────────────────────────────────────────────
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

// ── جلب مسار OSRM (مجاني، بدون مفتاح) ──────────────────────────
async function fetchOSRMRoute(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?geometries=geojson&overview=full`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]?.geometry?.coordinates) {
      return (data.routes[0].geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);
    }
  } catch {}
  return [];
}

export default function RideMap({
  rideId,
  fromLat, fromLng, toLat, toLng,
  fromAddress, toAddress,
  initialDriverLat, initialDriverLng,
  isDriver = false,
}: RideMapProps) {
  const [driverPos, setDriverPos]       = useState<{ lat: number; lng: number } | null>(
    initialDriverLat && initialDriverLng
      ? { lat: Number(initialDriverLat), lng: Number(initialDriverLng) }
      : null,
  );
  const [passengerPos, setPassengerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy]   = useState<number | null>(null);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);
  const [gpsError, setGpsError]         = useState<string | null>(null);
  // مسار الرحلة على الخريطة
  const [routeCoords, setRouteCoords]   = useState<[number, number][]>([]);
  const routeFetchedRef = useRef(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);

  // ── جلب مسار OSRM عند توفر الإحداثيات ─────────────────────────
  useEffect(() => {
    if (routeFetchedRef.current) return;
    const fLat = fromLat ? Number(fromLat) : null;
    const fLng = fromLng ? Number(fromLng) : null;
    const tLat = toLat   ? Number(toLat)   : null;
    const tLng = toLng   ? Number(toLng)   : null;

    if (isDriver && fLat && fLng && driverPos) {
      // للسائق: مسار من موقعه الحالي → نقطة انطلاق الراكب
      routeFetchedRef.current = true;
      fetchOSRMRoute([driverPos.lat, driverPos.lng], [fLat, fLng]).then(setRouteCoords);
    } else if (!isDriver && fLat && fLng && tLat && tLng) {
      // للراكب: مسار من الانطلاق → الوجهة
      routeFetchedRef.current = true;
      fetchOSRMRoute([fLat, fLng], [tLat, tLng]).then(setRouteCoords);
    }
  }, [fromLat, fromLng, toLat, toLng, driverPos, isDriver]);

  // ── تتبع GPS ─────────────────────────────────────────────────
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
          }).catch(() => {});
          // تحديث المسار عند تغيّر موقع السائق (كل دقيقة فقط)
          const fLat = fromLat ? Number(fromLat) : null;
          const fLng = fromLng ? Number(fromLng) : null;
          if (fLat && fLng) {
            fetchOSRMRoute([lat, lng], [fLat, fLng]).then(setRouteCoords);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 4000 },
      );
      return () => {
        if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      };
    } else {
      if (navigator.geolocation) {
        watchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setPassengerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setGpsAccuracy(Math.round(pos.coords.accuracy));
            setGpsError(null);
          },
          (err) => { setGpsError(err.code === 1 ? "اسمح بالوصول للموقع" : "GPS غير متاح"); },
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
  }, [isDriver, rideId, fromLat, fromLng, pollDriverLocation]);

  const center: [number, number] =
    passengerPos ? [passengerPos.lat, passengerPos.lng]
    : fromLat && fromLng ? [Number(fromLat), Number(fromLng)]
    : driverPos ? [driverPos.lat, driverPos.lng]
    : [36.737, 3.086];

  const allPoints: [number, number][] = [];
  if (passengerPos) allPoints.push([passengerPos.lat, passengerPos.lng]);
  else if (fromLat && fromLng) allPoints.push([Number(fromLat), Number(fromLng)]);
  if (toLat && toLng) allPoints.push([Number(toLat), Number(toLng)]);
  if (driverPos) allPoints.push([driverPos.lat, driverPos.lng]);

  // رابط Google Maps للملاحة
  const googleMapsUrl = isDriver && fromLat && fromLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${Number(fromLat)},${Number(fromLng)}&travelmode=driving`
    : !isDriver && toLat && toLng
      ? `https://www.google.com/maps/dir/?api=1&destination=${Number(toLat)},${Number(toLng)}&travelmode=driving`
      : null;

  return (
    <div className="space-y-2">
      {/* زر ابدأ المسار */}
      {googleMapsUrl && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          <Navigation className="w-4 h-4" />
          {isDriver ? "ابدأ المسار نحو الراكب" : "فتح المسار في خرائط Google"}
        </a>
      )}

      <div className="relative rounded-xl overflow-hidden border border-primary/20" style={{ height: 260 }}>
        <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }} zoomControl={false} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {allPoints.length >= 2 && <FitBounds points={allPoints} />}

          {/* مسار الرحلة */}
          {routeCoords.length > 1 && (
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: "#a855f7", weight: 4, opacity: 0.75, dashArray: isDriver ? "8,4" : undefined }}
            />
          )}

          {/* موقع الراكب الحي */}
          {!isDriver && passengerPos && (
            <>
              <Marker position={[passengerPos.lat, passengerPos.lng]} icon={LIVE_PASSENGER}>
                <Popup>موقعك الحالي{gpsAccuracy !== null && <span className="block text-xs opacity-60">±{gpsAccuracy}م</span>}</Popup>
              </Marker>
              <PanTo lat={passengerPos.lat} lng={passengerPos.lng} />
            </>
          )}

          {/* نقطة الانطلاق الثابتة — راكب بلا GPS أو سائق */}
          {(!isDriver && !passengerPos && fromLat && fromLng) && (
            <Marker position={[Number(fromLat), Number(fromLng)]} icon={PICKUP_ICON}>
              <Popup>{fromAddress ?? "نقطة الانطلاق"}</Popup>
            </Marker>
          )}
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

          {/* موقع السائق */}
          {driverPos && (
            <>
              <Marker position={[driverPos.lat, driverPos.lng]} icon={DRIVER_ICON}>
                <Popup>
                  {isDriver ? "موقعك الحالي" : "السائق في طريقه"}
                  {lastUpdate && <span className="block text-xs opacity-60">{lastUpdate.toLocaleTimeString("ar-DZ")}</span>}
                </Popup>
              </Marker>
              {!isDriver && !passengerPos && <PanTo lat={driverPos.lat} lng={driverPos.lng} fly />}
            </>
          )}
        </MapContainer>

        {/* شارة مباشر */}
        <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-white font-bold">مباشر</span>
        </div>

        {!isDriver && passengerPos && gpsAccuracy !== null && (
          <div className="absolute top-2 left-2 z-[1000] bg-green-600/80 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="text-[10px] text-white font-bold">🧍 ±{gpsAccuracy}م</span>
          </div>
        )}
        {!isDriver && gpsError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-red-500/90 rounded-lg px-3 py-1.5">
            <span className="text-[11px] text-white font-bold">⚠️ {gpsError}</span>
          </div>
        )}
        {lastUpdate && (
          <div className="absolute bottom-2 left-2 z-[1000] bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="text-[10px] text-white">🚗 {lastUpdate.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
