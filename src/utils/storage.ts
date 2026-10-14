import {
  Client,
  ServiceItem,
  Caratula,
  Expense,
  AbonoTicket,
  ServiceCategory,
  CalendarEvent,
  ExpedienteEntry,
  KardexRecord,
  StaffMember,
  SystemUser,
  CorteDeCajaRecord,
  GuardiaShiftRecord,
  InventoryItem,
  IncidenciaTicket,
  SolicitudIncrementoServicio,
  Sucursal,
} from "../types";
import {
  initialClients,
  initialServices,
  initialCaratulas,
  initialCategories,
  initialExpenses,
  initialCalendarEvents,
  initialExpedienteEntries,
  initialSystemUsers,
  initialStaffMembers,
  initialSucursales,
} from "../data/seedData";
import {
  deduplicateSystemUsers,
  deduplicateStaffMembers,
  deduplicateCaratulas,
  deduplicateClients,
  deduplicateCalendarEvents,
  deduplicateExpedienteEntries,
  deduplicateGuardias,
} from "./dataIntegrity";
import { isCaratulaFolioDeleted } from "./deletedFolios";

export const STORAGE_KEYS = {
  CLIENTS: "cuidarte_pachuca_clients_v1",
  SERVICES: "cuidarte_pachuca_services_v1",
  CARATULAS: "cuidarte_pachuca_caratulas_v1",
  EXPENSES: "cuidarte_pachuca_expenses_v1",
  ABONOS: "cuidarte_pachuca_abonos_v1",
  CATEGORIES: "cuidarte_pachuca_categories_v1",
  EVENTS: "cuidarte_pachuca_calendar_events_v1",
  EXPEDIENTE: "cuidarte_pachuca_expediente_v1",
  KARDEX: "cuidarte_pachuca_kardex_v1",
  STAFF: "cuidarte_pachuca_staff_v1",
  USERS: "cuidarte_pachuca_users_v1",
  CORTES: "cuidarte_pachuca_cortes_v1",
  GUARDIAS: "cuidarte_pachuca_guardias_v1",
  INVENTORY: "cuidarte_pachuca_inventory_v1",
  INCIDENCIAS: "cuidarte_pachuca_incidencias_v1",
  SOLICITUDES_INCREMENTO: "cuidarte_pachuca_solicitudes_incremento_v1",
  SUCURSALES: "cuidarte_mexico_sucursales_v1",
};

export function getLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return (Array.isArray(parsed) ? parsed : fallback) as T;
    }
    return (parsed ?? fallback) as T;
  } catch (err) {
    console.warn(`[LocalStorage] Error reading ${key}:`, err);
    return fallback;
  }
}

export function setLocalCache<T>(key: string, value: T): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    console.warn(`[LocalStorage] Quota warning saving ${key}:`, err?.message || err);
    // If quota exceeded due to large documents or base64 files, strip heavy base64 strings for localStorage
    // while keeping metadata, since files are safely stored in IndexedDB and Firestore.
    try {
      if (Array.isArray(value)) {
        const lightweight = value.map((item: any) => {
          if (!item || typeof item !== "object") return item;
          const copy = { ...item };
          if (Array.isArray(copy.documentos)) {
            copy.documentos = copy.documentos.map((d: any) => ({
              ...d,
              url: (d.url && d.url.length > 500) ? "" : d.url,
              archivoUrl: (d.archivoUrl && d.archivoUrl.length > 500) ? "" : d.archivoUrl,
            }));
          }
          return copy;
        });
        localStorage.setItem(key, JSON.stringify(lightweight));
      }
    } catch (innerErr) {
      console.warn(`[LocalStorage] Failed secondary lightweight cache write for ${key}:`, innerErr);
    }
  }
}

export const loadClients = (): Client[] => {
  const list = deduplicateClients(getLocalCache(STORAGE_KEYS.CLIENTS, initialClients));
  return list.map((c) => ({
    ...c,
    sucursalId: c.sucursalId || "pachuca",
    sucursalNombre: c.sucursalNombre || "Cuidarte Pachuca",
  }));
};

export const saveClients = (clients: Client[]) => {
  const normalized = (clients || []).map((c) => ({
    ...c,
    sucursalId: c.sucursalId || "pachuca",
    sucursalNombre: c.sucursalNombre || "Cuidarte Pachuca",
  }));
  setLocalCache(STORAGE_KEYS.CLIENTS, deduplicateClients(normalized));
};

export const loadServices = (): ServiceItem[] => getLocalCache(STORAGE_KEYS.SERVICES, initialServices);
export const saveServices = (services: ServiceItem[]) => setLocalCache(STORAGE_KEYS.SERVICES, services);

export const loadCaratulas = (): Caratula[] => {
  const raw = getLocalCache(STORAGE_KEYS.CARATULAS, initialCaratulas);
  const filtered = Array.isArray(raw) ? raw.filter((c) => c && !isCaratulaFolioDeleted(c.folio || (c as any).caratulaFolio)) : [];
  return deduplicateCaratulas(filtered).map((c) => ({
    ...c,
    sucursalId: c.sucursalId || "pachuca",
    sucursalNombre: c.sucursalNombre || "Cuidarte Pachuca",
  }));
};

export const saveCaratulas = (caratulas: Caratula[]) => {
  const clean = (caratulas || [])
    .filter((c) => c && !isCaratulaFolioDeleted(c.folio || (c as any).caratulaFolio))
    .map((c) => ({
      ...c,
      sucursalId: c.sucursalId || "pachuca",
      sucursalNombre: c.sucursalNombre || "Cuidarte Pachuca",
    }));
  setLocalCache(STORAGE_KEYS.CARATULAS, deduplicateCaratulas(clean));
};

export const loadExpenses = (): Expense[] => getLocalCache(STORAGE_KEYS.EXPENSES, initialExpenses);
export const saveExpenses = (expenses: Expense[]) => setLocalCache(STORAGE_KEYS.EXPENSES, expenses);

export const loadAbonos = (): AbonoTicket[] => getLocalCache(STORAGE_KEYS.ABONOS, []);
export const saveAbonos = (abonos: AbonoTicket[]) => setLocalCache(STORAGE_KEYS.ABONOS, abonos);

export const loadCategories = (): ServiceCategory[] => getLocalCache(STORAGE_KEYS.CATEGORIES, initialCategories);
export const saveCategories = (categories: ServiceCategory[]) => setLocalCache(STORAGE_KEYS.CATEGORIES, categories);

export const loadCalendarEvents = (): CalendarEvent[] => deduplicateCalendarEvents(getLocalCache(STORAGE_KEYS.EVENTS, initialCalendarEvents));
export const saveCalendarEvents = (events: CalendarEvent[]) => setLocalCache(STORAGE_KEYS.EVENTS, deduplicateCalendarEvents(events));

export const loadExpedienteEntries = (): ExpedienteEntry[] => deduplicateExpedienteEntries(getLocalCache(STORAGE_KEYS.EXPEDIENTE, initialExpedienteEntries));
export const saveExpedienteEntries = (entries: ExpedienteEntry[]) => setLocalCache(STORAGE_KEYS.EXPEDIENTE, deduplicateExpedienteEntries(entries));

export const loadKardexRecords = (): KardexRecord[] => getLocalCache(STORAGE_KEYS.KARDEX, []);
export const saveKardexRecords = (records: KardexRecord[]) => setLocalCache(STORAGE_KEYS.KARDEX, records);

export const loadStaffMembers = (): StaffMember[] => deduplicateStaffMembers(getLocalCache(STORAGE_KEYS.STAFF, initialStaffMembers));
export const saveStaffMembers = (staff: StaffMember[]) => setLocalCache(STORAGE_KEYS.STAFF, deduplicateStaffMembers(staff));

export const loadSystemUsers = (): SystemUser[] => deduplicateSystemUsers(getLocalCache(STORAGE_KEYS.USERS, initialSystemUsers));
export const saveSystemUsers = (users: SystemUser[]) => setLocalCache(STORAGE_KEYS.USERS, deduplicateSystemUsers(users));

export const loadCortes = (): CorteDeCajaRecord[] => getLocalCache(STORAGE_KEYS.CORTES, []);
export const saveCortes = (cortes: CorteDeCajaRecord[]) => setLocalCache(STORAGE_KEYS.CORTES, cortes);

export const loadGuardias = (): GuardiaShiftRecord[] => deduplicateGuardias(getLocalCache(STORAGE_KEYS.GUARDIAS, []));
export const saveGuardias = (guardias: GuardiaShiftRecord[]) => setLocalCache(STORAGE_KEYS.GUARDIAS, deduplicateGuardias(guardias));

export const loadInventory = (): InventoryItem[] => getLocalCache(STORAGE_KEYS.INVENTORY, []);
export const saveInventory = (items: InventoryItem[]) => setLocalCache(STORAGE_KEYS.INVENTORY, items);

export const loadIncidencias = (): IncidenciaTicket[] => getLocalCache(STORAGE_KEYS.INCIDENCIAS, []);
export const saveIncidencias = (incidencias: IncidenciaTicket[]) => setLocalCache(STORAGE_KEYS.INCIDENCIAS, incidencias);

export const loadSolicitudesIncremento = (): SolicitudIncrementoServicio[] => getLocalCache(STORAGE_KEYS.SOLICITUDES_INCREMENTO, []);
export const saveSolicitudesIncremento = (solicitudes: SolicitudIncrementoServicio[]) => setLocalCache(STORAGE_KEYS.SOLICITUDES_INCREMENTO, solicitudes);

export const loadSucursales = (): Sucursal[] => {
  const list = getLocalCache<Sucursal[]>(STORAGE_KEYS.SUCURSALES, initialSucursales);
  if (!list || list.length === 0) return initialSucursales;
  const hasPachuca = list.some((s) => s.id === "pachuca");
  if (!hasPachuca) {
    return [...initialSucursales, ...list];
  }
  return list;
};
export const saveSucursales = (sucursales: Sucursal[]) => setLocalCache(STORAGE_KEYS.SUCURSALES, sucursales);
