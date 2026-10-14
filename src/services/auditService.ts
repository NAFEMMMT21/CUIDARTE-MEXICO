import { AuditLog, AuditActionType, UserRole, AuditLocation, AuditDeviceInfo } from "../types";
import { collection, doc, setDoc, onSnapshot, query, limit, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { isFirestoreQuotaExhausted, handleFirestoreError } from "./firestoreSync";

const AUDIT_COLLECTION = "audit_logs";
const AUDIT_STORAGE_KEY = "cuidarte_audit_logs";
const LOCATION_STORAGE_KEY = "cuidarte_last_known_location";

// Memory cache for location
let lastKnownLocation: AuditLocation | null = null;
let isResolvingLocation = false;

/**
 * Fast reverse-geocode helper (Nominatim with timeout)
 */
async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ city?: string; state?: string; rawAddress?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { "Accept-Language": "es" },
      }
    );
    clearTimeout(timeoutId);
    if (!resp.ok) return {};
    const data = await resp.json();
    const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.county || "Pachuca de Soto";
    const state = data.address?.state || "Hidalgo";
    const rawAddress = data.display_name || `${city}, ${state}`;
    return { city, state, rawAddress };
  } catch {
    return { city: "Pachuca de Soto", state: "Hidalgo" };
  }
}

/**
 * IP-based geolocation fallback
 */
async function fetchIpGeolocation(): Promise<AuditLocation | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://ipwho.is/", { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success !== false && data.latitude && data.longitude) {
      const loc: AuditLocation = {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: 1500,
        city: data.city || "Pachuca",
        state: data.region || "Hidalgo",
        country: data.country || "México",
        ip: data.ip,
        mapsUrl: `https://www.google.com/maps?q=${data.latitude},${data.longitude}`,
        source: "ip",
        rawAddress: `${data.city || ""}, ${data.region || ""}, ${data.country || "México"}`.trim(),
        timestamp: new Date().toISOString(),
      };
      return loc;
    }
  } catch {}
  return null;
}

/**
 * Capture current user location via GPS / Browser Geolocation with IP fallback.
 */
export async function captureCurrentUserLocation(): Promise<AuditLocation | null> {
  if (lastKnownLocation) {
    const age = Date.now() - new Date(lastKnownLocation.timestamp || 0).getTime();
    if (age < 180000) { // 3 minutes cache
      return lastKnownLocation;
    }
  }

  // Check saved storage
  try {
    const saved = sessionStorage.getItem(LOCATION_STORAGE_KEY) || localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const age = Date.now() - new Date(parsed.timestamp || 0).getTime();
      if (age < 180000) {
        lastKnownLocation = parsed;
        return parsed;
      }
    }
  } catch {}

  if (isResolvingLocation && lastKnownLocation) {
    return lastKnownLocation;
  }
  isResolvingLocation = true;

  return new Promise<AuditLocation | null>((resolve) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      fetchIpGeolocation().then((ipLoc) => {
        isResolvingLocation = false;
        if (ipLoc) {
          lastKnownLocation = ipLoc;
          try {
            sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(ipLoc));
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(ipLoc));
          } catch {}
        }
        resolve(ipLoc || lastKnownLocation);
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy);

        // Fetch address details asynchronously
        const geoInfo = await reverseGeocodeCoords(lat, lng);

        const loc: AuditLocation = {
          latitude: lat,
          longitude: lng,
          accuracy,
          city: geoInfo.city || "Pachuca de Soto",
          state: geoInfo.state || "Hidalgo",
          country: "México",
          mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
          source: "gps",
          rawAddress: geoInfo.rawAddress || `${lat}, ${lng}`,
          timestamp: new Date().toISOString(),
        };

        lastKnownLocation = loc;
        isResolvingLocation = false;
        try {
          sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
        } catch {}
        resolve(loc);
      },
      async () => {
        // Fallback to IP geolocation
        const ipLoc = await fetchIpGeolocation();
        isResolvingLocation = false;
        const finalLoc = ipLoc || lastKnownLocation || {
          city: "Pachuca de Soto",
          state: "Hidalgo",
          country: "México",
          source: "manual",
          timestamp: new Date().toISOString(),
        };
        lastKnownLocation = finalLoc;
        try {
          sessionStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(finalLoc));
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(finalLoc));
        } catch {}
        resolve(finalLoc);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 180000, // 3 min cache
      }
    );
  });
}

// Auto-trigger location capture silently in the background
if (typeof window !== "undefined") {
  try {
    captureCurrentUserLocation().catch(() => {});
  } catch {}
}

export function getDeviceInfo(): AuditDeviceInfo {
  if (typeof window === "undefined") {
    return {};
  }
  const ua = navigator.userAgent || "";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return {
    userAgent: ua,
    platform: navigator.platform || "unknown",
    isMobile,
    language: navigator.language || "es-MX",
    screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
  };
}

export function loadLocalAuditLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalAuditLogs(logs: AuditLog[]): void {
  try {
    // Keep max 300 recent audit logs locally for fast audit inspections
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch {}
}

export function createAuditId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `AUDIT-${dateStr}-${rand}`;
}

export async function logAuditEvent(params: {
  tipoAccion: AuditActionType;
  descripcion: string;
  usuarioUx: string;
  usuarioNombre?: string;
  rol: UserRole;
  detalles?: Record<string, any>;
  folioReferencia?: string;
  clienteIdReferencia?: string;
  ubicacion?: AuditLocation;
  sucursalId?: string;
  sucursalNombre?: string;
}): Promise<AuditLog> {
  const now = new Date();
  
  // Resolve location (explicit or best known)
  let loc = params.ubicacion || lastKnownLocation;
  if (!loc) {
    try {
      const saved = sessionStorage.getItem(LOCATION_STORAGE_KEY) || localStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) loc = JSON.parse(saved);
    } catch {}
  }

  // If still not available, resolve quickly or set default
  if (!loc) {
    loc = {
      city: "Pachuca de Soto",
      state: "Hidalgo",
      country: "México",
      source: "browser",
      timestamp: now.toISOString(),
    };
  }

  const device = getDeviceInfo();

  const newLog: AuditLog = {
    id: createAuditId(),
    tipoAccion: params.tipoAccion,
    descripcion: params.descripcion,
    usuarioUx: params.usuarioUx,
    usuarioNombre: params.usuarioNombre || params.usuarioUx,
    rol: params.rol,
    fechaHoraIso: now.toISOString(),
    fechaHoraFormateada: now.toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "medium",
    }),
    detalles: params.detalles || {},
    folioReferencia: params.folioReferencia,
    clienteIdReferencia: params.clienteIdReferencia,
    ubicacion: loc,
    dispositivo: device,
    sucursalId: params.sucursalId,
    sucursalNombre: params.sucursalNombre,
    timestamp: now.toISOString(),
  };

  // 1. Immediately store in local audit cache
  try {
    const current = loadLocalAuditLogs();
    saveLocalAuditLogs([newLog, ...current]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("audit-log-updated", { detail: newLog }));
    }
  } catch {}

  // 2. Sync to Firestore if quota is available
  if (!isFirestoreQuotaExhausted()) {
    try {
      await setDoc(doc(db, AUDIT_COLLECTION, newLog.id), sanitizeForAudit(newLog));
    } catch (err) {
      handleFirestoreError(err, "logAuditEvent");
    }
  }

  // Refresh location asynchronously for future events
  if (typeof window !== "undefined") {
    captureCurrentUserLocation().catch(() => {});
  }

  return newLog;
}

/**
 * Optimized Firestore real-time listener with limit(100) to prevent excessive read charges.
 */
export function subscribeToAuditLogs(onUpdate: (logs: AuditLog[]) => void) {
  const cached = loadLocalAuditLogs();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }

  // Read with limit(100) to prevent scanning huge collection
  const auditQuery = query(
    collection(db, AUDIT_COLLECTION),
    limit(100)
  );

  return onSnapshot(
    auditQuery,
    (snapshot) => {
      const items: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as AuditLog);
      });
      // Sort newest first
      items.sort((a, b) => (b.timestamp || b.fechaHoraIso || "").localeCompare(a.timestamp || a.fechaHoraIso || ""));
      saveLocalAuditLogs(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToAuditLogs");
      const currentCached = loadLocalAuditLogs();
      if (currentCached && currentCached.length > 0) {
        onUpdate(currentCached);
      }
    }
  );
}

function sanitizeForAudit(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => (value === undefined ? null : value)));
}
