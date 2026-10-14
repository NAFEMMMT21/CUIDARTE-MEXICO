import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  query,
  where,
  limit,
  orderBy
} from "firebase/firestore";
import { db } from "./firebase";
import { generateSecureRandomPassword } from "../utils/passwordGenerator";
import {
  Caratula,
  Client,
  ServiceItem,
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
  initialCaratulas,
  initialClients,
  initialServices,
  initialExpenses,
  initialCategories,
  initialCalendarEvents,
  initialExpedienteEntries,
  initialSystemUsers,
  initialStaffMembers,
  initialSucursales,
} from "../data/seedData";
import { compareCaratulas, compareClients } from "../utils/formatters";
import { saveDocumentToIndexedDB, deleteDocumentFromIndexedDB, StoredDocument, getDocumentsByOwnerFromIndexedDB, getAllDocumentsFromIndexedDB, getDocumentFromIndexedDB } from "../utils/fileStore";
import {
  deduplicateSystemUsers,
  deduplicateStaffMembers,
  deduplicateCaratulas,
  deduplicateClients,
  deduplicateCalendarEvents,
  deduplicateExpedienteEntries,
  deduplicateGuardias,
  restoreMissingCaratulasFromEventsAndAbonos,
} from "../utils/dataIntegrity";
import { isSameGuardia } from "../utils/guardiaFolio";
import {
  isCaratulaFolioDeleted,
  markCaratulaFolioDeleted,
  unmarkCaratulaFolioDeleted,
  loadDeletedCaratulaFolios,
  saveDeletedCaratulaFolios,
} from "../utils/deletedFolios";

// Firestore collection names
const COLLECTIONS = {
  CARATULAS: "caratulas",
  CLIENTS: "clients",
  SERVICES: "services",
  EXPENSES: "expenses",
  ABONOS: "abonos",
  CATEGORIES: "categories",
  EVENTS: "calendar_events",
  EXPEDIENTE: "expediente_entries",
  KARDEX: "kardex_records",
  STAFF: "staff_members",
  USERS: "system_users",
  ONLINE_STATUS: "onlineStatus",
  CORTES: "cortes_caja",
  GUARDIAS: "guardias_control",
  INVENTORY: "inventory_items",
  INCIDENCIAS: "incidencias_soporte",
  SOLICITUDES_INCREMENTO: "solicitudes_incremento",
  DOCUMENTS: "clinical_documents",
  SUCURSALES: "sucursales",
};

/**
 * Deletes ALL data across all Firestore collections to start completely fresh.
 */
export async function resetAllFirestoreDatabase() {
  try {
    const collectionsToReset = [
      COLLECTIONS.CARATULAS,
      COLLECTIONS.CLIENTS,
      COLLECTIONS.SERVICES,
      COLLECTIONS.EXPENSES,
      COLLECTIONS.ABONOS,
      COLLECTIONS.CATEGORIES,
      COLLECTIONS.EVENTS,
      COLLECTIONS.EXPEDIENTE,
      COLLECTIONS.KARDEX,
      COLLECTIONS.STAFF
    ];

    for (const colName of collectionsToReset) {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }
    console.log("[Firestore] Database completely cleared/reset.");
  } catch (error) {
    console.error("[Firestore] Error resetting database:", error);
  }
}

/**
 * Ensures initial seed data exists in Firestore if collections are empty.
 */
export async function initializeFirestoreDatabase() {
  // Database initialized with no mock data as per user request to start clean.
}

// ==========================================
// REAL-TIME SUBSCRIBERS FOR MULTI-DEVICE SYNC WITH LOCAL CACHE BACKUP
// ==========================================

import {
  loadCaratulas, saveCaratulas,
  loadClients, saveClients,
  loadServices, saveServices,
  loadExpenses, saveExpenses,
  loadAbonos, saveAbonos,
  loadCategories, saveCategories,
  loadCalendarEvents, saveCalendarEvents,
  loadExpedienteEntries, saveExpedienteEntries,
  loadKardexRecords, saveKardexRecords,
  loadStaffMembers, saveStaffMembers,
  loadSystemUsers, saveSystemUsers,
  loadCortes, saveCortes,
  loadGuardias, saveGuardias,
  loadInventory, saveInventory,
  loadIncidencias, saveIncidencias,
  loadSolicitudesIncremento, saveSolicitudesIncremento,
  loadSucursales, saveSucursales,
} from "../utils/storage";

export const FIRESTORE_UPGRADE_URL =
  "https://console.firebase.google.com/project/triple-machine-vq6d2/firestore/databases/ai-studio-cuidartepachucag-dd087920-5861-4f50-b781-2f78809f7be6/data?openUpgradeDialog=true";

export function subscribeToCaratulas(onUpdate: (data: Caratula[]) => void) {
  const cached = loadCaratulas();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.CARATULAS));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Caratula[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as Caratula;
        const folio = item.folio || docSnap.id;
        if (!isCaratulaFolioDeleted(folio)) {
          item.sucursalId = item.sucursalId || "pachuca";
          item.sucursalNombre = item.sucursalNombre || "Cuidarte Pachuca";
          items.push(item);
        }
      });
      // Sort newest current formats first (CPSEA / CPCOTA), legacy at end
      items.sort(compareCaratulas);
      saveCaratulas(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToCaratulas");
      const currentCached = loadCaratulas();
      if (currentCached && currentCached.length > 0) {
        onUpdate(currentCached);
      }
    }
  );
}

export function subscribeToClients(onUpdate: (data: Client[]) => void) {
  const cached = loadClients();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.CLIENTS),
    async (snapshot) => {
      const items: Client[] = [];
      snapshot.forEach((docSnap) => {
        const client = docSnap.data() as Client;
        client.sucursalId = client.sucursalId || "pachuca";
        client.sucursalNombre = client.sucursalNombre || "Cuidarte Pachuca";
        items.push(client);
      });
      // Sort newest current formats first (CLI-A000), legacy at end
      items.sort(compareClients);

      // Hydrate documents from local IndexedDB cache safely without N+1 Firestore network calls
      try {
        for (const client of items) {
          if (!client || !client.id) continue;
          const storedDocs = await getDocumentsByOwnerFromIndexedDB(client.id);

          if (storedDocs && storedDocs.length > 0) {
            const storedMap = new Map<string, StoredDocument>();
            storedDocs.forEach((d) => {
              if (d.id) storedMap.set(d.id, d);
            });

            // Only update existing documents in client.documentos (never resurrect deleted ones)
            if (Array.isArray(client.documentos)) {
              client.documentos = client.documentos.map((doc) => {
                const stored = storedMap.get(doc.id);
                if (stored && (stored.url || stored.archivoUrl)) {
                  return {
                    ...doc,
                    url: stored.url || stored.archivoUrl || doc.url || "",
                    archivoUrl: stored.archivoUrl || stored.url || doc.archivoUrl || "",
                  };
                }
                return doc;
              });
            }

            const contractDoc = (client.documentos || []).find((d: any) => d.tipo === "Contrato" || d.nombre?.toLowerCase().includes("contrato"));
            const storedContract = storedMap.get(`CONTRATO-${client.id}`);
            if (contractDoc && (contractDoc.url || contractDoc.archivoUrl)) {
              client.contratoUrl = contractDoc.url || contractDoc.archivoUrl;
              client.contratoNombre = contractDoc.nombre;
            } else if (storedContract && (storedContract.url || storedContract.archivoUrl)) {
              client.contratoUrl = storedContract.url || storedContract.archivoUrl;
              client.contratoNombre = storedContract.nombre;
            }
          }
        }
      } catch (err) {
        console.warn("[Firestore] Error hydrating clients with local docs:", err);
      }

      const deduplicatedClients = deduplicateClients(items);
      saveClients(deduplicatedClients);
      onUpdate(deduplicatedClients);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToClients");
      const currentCached = loadClients();
      if (currentCached) {
        onUpdate(deduplicateClients(currentCached));
      }
    }
  );
}

export function subscribeToServices(onUpdate: (data: ServiceItem[]) => void) {
  const cached = loadServices();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.SERVICES),
    (snapshot) => {
      const items: ServiceItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ServiceItem);
      });
      items.sort((a, b) => a.nombreServicio.localeCompare(b.nombreServicio));
      saveServices(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToServices");
      const currentCached = loadServices();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export function subscribeToExpenses(onUpdate: (data: Expense[]) => void) {
  const cached = loadExpenses();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.EXPENSES), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Expense[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Expense);
      });
      // Sort by newest timestamp
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      saveExpenses(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToExpenses");
      const currentCached = loadExpenses();
      if (currentCached && currentCached.length > 0) {
        onUpdate(currentCached);
      }
    }
  );
}

export function subscribeToAbonos(onUpdate: (data: AbonoTicket[]) => void) {
  const cached = loadAbonos();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.ABONOS), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AbonoTicket[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as AbonoTicket);
      });
      items.sort((a, b) => b.fecha.localeCompare(a.fecha));
      saveAbonos(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToAbonos");
      const currentCached = loadAbonos();
      if (currentCached && currentCached.length > 0) {
        onUpdate(currentCached);
      }
    }
  );
}

export function subscribeToCategories(onUpdate: (data: ServiceCategory[]) => void) {
  const cached = loadCategories();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.CATEGORIES),
    (snapshot) => {
      const items: ServiceCategory[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ServiceCategory);
      });
      items.sort((a, b) => a.nombre.localeCompare(b.nombre));
      saveCategories(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToCategories");
      const currentCached = loadCategories();
      if (currentCached && currentCached.length > 0) {
        onUpdate(currentCached);
      }
    }
  );
}

export function subscribeToSucursales(onUpdate: (data: Sucursal[]) => void) {
  const cached = loadSucursales();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.SUCURSALES),
    (snapshot) => {
      const items: Sucursal[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Sucursal);
      });
      // Guarantee Pachuca exists
      if (!items.some((s) => s.id === "pachuca")) {
        items.unshift(...initialSucursales);
      }
      saveSucursales(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToSucursales");
      const currentCached = loadSucursales();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveSucursalToFirestore(sucursal: Sucursal) {
  try {
    const current = loadSucursales();
    const idx = current.findIndex((s) => s.id === sucursal.id);
    const updated = idx >= 0 ? current.map((s) => (s.id === sucursal.id ? sucursal : s)) : [...current, sucursal];
    saveSucursales(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.SUCURSALES, sucursal.id), sanitizeForFirestore(sucursal));
  } catch (error) {
    handleFirestoreError(error, "saveSucursal");
  }
}

export async function deleteSucursalFromFirestore(id: string) {
  try {
    if (id === "pachuca") {
      console.warn("No se puede eliminar la sucursal matriz regional de Pachuca.");
      return;
    }
    const current = loadSucursales();
    saveSucursales(current.filter((s) => s.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.SUCURSALES, id));
  } catch (error) {
    handleFirestoreError(error, "deleteSucursal");
  }
}

// ==========================================
// CIRCUIT BREAKER & QUOTA GUARD FOR FIRESTORE
// ==========================================

const QUOTA_STORAGE_KEY = "cuidarte_fs_quota_exhausted_until";

let quotaExhaustedUntil: number = (() => {
  try {
    const saved = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (saved) {
      const ts = parseInt(saved, 10);
      if (ts > Date.now()) return ts;
    }
  } catch {}
  return 0;
})();

export function isFirestoreQuotaExhausted(): boolean {
  if (quotaExhaustedUntil > Date.now()) return true;
  try {
    const saved = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (saved) {
      const ts = parseInt(saved, 10);
      if (ts > Date.now()) {
        quotaExhaustedUntil = ts;
        return true;
      }
    }
  } catch {}
  return false;
}

export function resetFirestoreQuotaCooldown(): void {
  quotaExhaustedUntil = 0;
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {}
}

export function handleFirestoreError(error: any, context: string): void {
  const errCode = error?.code || "";
  const errMsg = error?.message || String(error);
  if (
    errCode === "resource-exhausted" ||
    errMsg.toLowerCase().includes("free daily read units")
  ) {
    // Soft memory cooldown for 30 seconds, never persistently bricking page reloads
    quotaExhaustedUntil = Date.now() + 30 * 1000;
    console.warn(`[Firestore Quota Guard] Quota notice in ${context}. Continuing gracefully.`);
  } else {
    console.warn(`[Firestore] Notice in ${context}:`, errMsg);
  }
}

// Sanitizes object payloads before saving to Firestore to remove undefined properties recursively
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as any;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleanObj[key] = typeof value === "object" && value !== null ? sanitizeForFirestore(value) : value;
    }
  }
  return cleanObj as T;
}

// ==========================================
// WRITE OPERATIONS (PERSISTENT & MULTI-DEVICE)
// ==========================================

export async function saveCaratulaToFirestore(caratula: Caratula) {
  try {
    unmarkCaratulaFolioDeleted(caratula.folio);
    const current = loadCaratulas();
    const idx = current.findIndex((c) => (c.folio || "").trim().toLowerCase() === (caratula.folio || "").trim().toLowerCase());
    const updated = idx >= 0 ? current.map((c) => ((c.folio || "").trim().toLowerCase() === (caratula.folio || "").trim().toLowerCase() ? caratula : c)) : [caratula, ...current];
    saveCaratulas(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.CARATULAS, caratula.folio), sanitizeForFirestore(caratula));

    // Update cloud tombstones list so cloud reflects that this folio is active
    try {
      const deletedFolios = loadDeletedCaratulaFolios();
      await setDoc(doc(db, "system_metadata", "deleted_caratulas"), {
        folios: deletedFolios,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch {}
  } catch (error) {
    handleFirestoreError(error, "saveCaratula");
  }
}

export async function deleteCaratulaFromFirestore(folio: string) {
  if (!folio) return;
  try {
    const normFolio = (folio || "").trim().toLowerCase();
    markCaratulaFolioDeleted(folio);

    // 1. Immediately clean up local storage caratulas
    const currentCaratulas = loadCaratulas();
    saveCaratulas(currentCaratulas.filter((c) => (c.folio || "").trim().toLowerCase() !== normFolio));

    // 2. Immediately clean up local calendar events associated with this caratula
    const currentEvents = loadCalendarEvents();
    const cleanEvents = currentEvents.filter(
      (e) =>
        (e.caratulaFolio || "").trim().toLowerCase() !== normFolio &&
        !(e.id && e.id.toLowerCase().includes(normFolio))
    );
    saveCalendarEvents(cleanEvents);

    // 3. Clean up local abono receipts: remove auto-created upfront tickets, disassociate others
    const currentAbonos = loadAbonos();
    const cleanAbonos = currentAbonos
      .filter((a) => {
        const isTarget = (a.caratulaFolio || "").trim().toLowerCase() === normFolio;
        if (!isTarget) return true;
        const isAuto =
          (a.id && a.id.toLowerCase().startsWith(`tkt-${normFolio}`)) ||
          (a.referencia && a.referencia.toLowerCase().includes("pago inicial en carátula"));
        return !isAuto;
      })
      .map((a) => {
        if ((a.caratulaFolio || "").trim().toLowerCase() === normFolio) {
          return { ...a, caratulaFolio: "" };
        }
        return a;
      });
    saveAbonos(cleanAbonos);

    if (isFirestoreQuotaExhausted()) return;

    // 4. Firestore direct deletions by common folio key variations
    await deleteDoc(doc(db, COLLECTIONS.CARATULAS, folio)).catch(() => {});
    await deleteDoc(doc(db, COLLECTIONS.CARATULAS, folio.toUpperCase())).catch(() => {});
    await deleteDoc(doc(db, COLLECTIONS.CARATULAS, folio.toLowerCase())).catch(() => {});

    // 5. Query and delete ANY matching docs from COLLECTIONS.CARATULAS
    try {
      const caratulasSnap = await getDocs(collection(db, COLLECTIONS.CARATULAS));
      for (const d of caratulasSnap.docs) {
        const data = d.data();
        const dFolio = (data.folio || data.caratulaFolio || d.id || "").trim().toLowerCase();
        if (dFolio === normFolio || d.id.trim().toLowerCase() === normFolio) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch (cErr) {
      console.warn("[Firestore] Error purging caratula docs from cloud:", cErr);
    }

    // 6. Delete all matching calendar events from Firestore
    try {
      const eventsSnap = await getDocs(collection(db, COLLECTIONS.EVENTS));
      for (const d of eventsSnap.docs) {
        const data = d.data();
        const eFolio = (data.caratulaFolio || "").trim().toLowerCase();
        if (eFolio === normFolio || d.id.toLowerCase().includes(normFolio)) {
          await deleteDoc(d.ref).catch(() => {});
        }
      }
    } catch (eErr) {
      console.warn("[Firestore] Error purging calendar events for caratula from cloud:", eErr);
    }

    // 7. Delete auto-tickets or disassociate matching tickets in Firestore
    try {
      const abonosSnap = await getDocs(collection(db, COLLECTIONS.ABONOS));
      for (const d of abonosSnap.docs) {
        const data = d.data();
        const aFolio = (data.caratulaFolio || "").trim().toLowerCase();
        if (aFolio === normFolio) {
          const isAuto =
            (d.id && d.id.toLowerCase().startsWith(`tkt-${normFolio}`)) ||
            (data.referencia && data.referencia.toLowerCase().includes("pago inicial en carátula"));
          if (isAuto) {
            await deleteDoc(d.ref).catch(() => {});
          } else {
            await setDoc(d.ref, { ...data, caratulaFolio: "" }, { merge: true }).catch(() => {});
          }
        }
      }
    } catch (aErr) {
      console.warn("[Firestore] Error clearing/disassociating abonos for caratula:", aErr);
    }

    // 8. Persist deleted folios set in Firestore metadata so all devices and refreshes respect deletion
    try {
      const deletedFolios = loadDeletedCaratulaFolios();
      await setDoc(doc(db, "system_metadata", "deleted_caratulas"), {
        folios: deletedFolios,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch {}
  } catch (error) {
    handleFirestoreError(error, "deleteCaratula");
  }
}

export async function syncCaratulaCalendarEventsInFirestore(caratulaFolio: string, newEvents: CalendarEvent[]) {
  try {
    const current = loadCalendarEvents();
    const previousEventsForCaratula = current.filter(
      (e) => e.caratulaFolio === caratulaFolio || (e.id && e.id.includes(caratulaFolio))
    );
    const newEventIds = new Set(newEvents.map((e) => e.id));

    const unaffectedEvents = current.filter(
      (e) => e.caratulaFolio !== caratulaFolio && !(e.id && e.id.includes(caratulaFolio))
    );

    const updatedAll = [...unaffectedEvents, ...newEvents].sort((a, b) => (a.fechaInicio || "").localeCompare(b.fechaInicio || ""));
    saveCalendarEvents(updatedAll);

    if (isFirestoreQuotaExhausted()) return;

    for (const oldEv of previousEventsForCaratula) {
      if (!newEventIds.has(oldEv.id)) {
        await deleteDoc(doc(db, COLLECTIONS.EVENTS, oldEv.id)).catch(() => {});
      }
    }

    for (const ev of newEvents) {
      await setDoc(doc(db, COLLECTIONS.EVENTS, ev.id), sanitizeForFirestore(ev)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, "syncCaratulaCalendarEvents");
  }
}

// ==========================================
// CLINICAL & ADMINISTRATIVE DOCUMENTS REPOSITORY
// ==========================================

export async function saveClinicalDocumentToFirestore(docData: StoredDocument) {
  try {
    // 1. Always save to local IndexedDB for immediate, unlimited offline-ready access
    await saveDocumentToIndexedDB(docData);

    // 2. Persist to Firestore dedicated documents collection if under size limit
    if (isFirestoreQuotaExhausted()) return;
    const url = docData.url || docData.archivoUrl || "";
    if (url.length < 850000) {
      await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docData.id), sanitizeForFirestore(docData));
    }
  } catch (error) {
    handleFirestoreError(error, "saveClinicalDocument");
  }
}

export async function getDocumentFromFirestore(id: string): Promise<StoredDocument | null> {
  try {
    if (!id || isFirestoreQuotaExhausted()) return null;
    const snap = await getDoc(doc(db, COLLECTIONS.DOCUMENTS, id));
    if (snap.exists()) {
      const data = snap.data() as StoredDocument;
      if (data && (data.url || data.archivoUrl)) {
        // Cache to IndexedDB so next access is instantaneous and works offline
        await saveDocumentToIndexedDB(data).catch(() => {});
        return data;
      }
    }
  } catch (error) {
    console.warn("[Firestore] Error fetching document from cloud:", id, error);
  }
  return null;
}

export async function getDocumentsByOwnerFromFirestore(ownerId: string): Promise<StoredDocument[]> {
  try {
    if (!ownerId || isFirestoreQuotaExhausted()) return [];
    const q = query(collection(db, COLLECTIONS.DOCUMENTS), where("ownerId", "==", ownerId));
    const snapshot = await getDocs(q);
    const docs: StoredDocument[] = [];
    snapshot.forEach((snap) => {
      const data = snap.data() as StoredDocument;
      if (data) {
        docs.push(data);
        saveDocumentToIndexedDB(data).catch(() => {});
      }
    });
    return docs;
  } catch (error) {
    console.warn("[Firestore] Error fetching owner documents from cloud:", ownerId, error);
    return [];
  }
}

export async function syncAllLocalDocumentsToCloud(): Promise<void> {
  if (isFirestoreQuotaExhausted()) return;
  try {
    const allLocalDocs = await getAllDocumentsFromIndexedDB();
    for (const docItem of allLocalDocs) {
      if (docItem && docItem.id && (docItem.url || docItem.archivoUrl)) {
        const url = docItem.url || docItem.archivoUrl || "";
        if (url.length < 850000) {
          await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docItem.id), sanitizeForFirestore(docItem)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[Firestore] Error syncing local docs to cloud:", err);
  }
}

export async function deleteClinicalDocumentFromFirestore(id: string) {
  try {
    await deleteDocumentFromIndexedDB(id);
    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, id));
  } catch (error) {
    handleFirestoreError(error, "deleteClinicalDocument");
  }
}

export async function saveClientToFirestore(client: Client) {
  try {
    // 1. Store and persist all embedded documents safely into IndexedDB and Cloud Firestore
    if (Array.isArray(client.documentos) && client.documentos.length > 0) {
      for (const docItem of client.documentos) {
        if (docItem && docItem.id) {
          let docUrl = docItem.url || (docItem as any).archivoUrl || "";
          if (!docUrl || docUrl.length < 50) {
            const stored = await getDocumentFromIndexedDB(docItem.id);
            if (stored?.url || stored?.archivoUrl) {
              docUrl = stored.url || stored.archivoUrl || "";
            }
          }
          if (docUrl) {
            const storedDoc: StoredDocument = {
              id: docItem.id,
              ownerId: client.id,
              category: "client",
              nombre: docItem.nombre || "Documento Clínico",
              tipo: docItem.tipo || "Otro",
              url: docUrl,
              archivoUrl: docUrl,
              tamano: docItem.tamano,
              tamanoBytes: docItem.tamanoBytes,
              nombreArchivoOriginal: docItem.nombreArchivoOriginal,
              fechaSubida: docItem.fechaSubida || new Date().toISOString().split("T")[0],
              notas: docItem.notas,
            };
            await saveDocumentToIndexedDB(storedDoc);
            if (!isFirestoreQuotaExhausted() && docUrl.length < 850000) {
              await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docItem.id), sanitizeForFirestore(storedDoc)).catch(() => {});
            }
          }
        }
      }
    }

    // Persist digital contract into IndexedDB and Cloud Firestore if present
    let contratoUrl = client.contratoUrl || "";
    if (!contratoUrl || contratoUrl.length < 50) {
      const storedContract = await getDocumentFromIndexedDB(`CONTRATO-${client.id}`);
      if (storedContract?.url || storedContract?.archivoUrl) {
        contratoUrl = storedContract.url || storedContract.archivoUrl || "";
      }
    }
    if (contratoUrl && (contratoUrl.startsWith("data:") || contratoUrl.startsWith("http"))) {
      const contractDoc: StoredDocument = {
        id: `CONTRATO-${client.id}`,
        ownerId: client.id,
        category: "client",
        nombre: client.contratoNombre || "Contrato Oficial de Prestación de Servicios",
        tipo: "Contrato",
        url: contratoUrl,
        archivoUrl: contratoUrl,
        fechaSubida: client.contratoFecha || new Date().toISOString().split("T")[0],
        notas: client.contratoNotas || "Contrato digital de servicio",
      };
      await saveDocumentToIndexedDB(contractDoc);
      if (!isFirestoreQuotaExhausted() && contratoUrl.length < 850000) {
        await setDoc(doc(db, COLLECTIONS.DOCUMENTS, `CONTRATO-${client.id}`), sanitizeForFirestore(contractDoc)).catch(() => {});
      }
    }

    // Clean up any deleted documents or cleared contracts from local IndexedDB and cloud
    try {
      const storedDocs = await getDocumentsByOwnerFromIndexedDB(client.id);
      const currentDocIds = new Set((client.documentos || []).map((d) => d.id));
      for (const stored of storedDocs) {
        if (!currentDocIds.has(stored.id) && stored.id !== `CONTRATO-${client.id}`) {
          await deleteDocumentFromIndexedDB(stored.id);
          if (!isFirestoreQuotaExhausted()) {
            await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, stored.id)).catch(() => {});
          }
        }
      }
      if (!client.contratoUrl) {
        await deleteDocumentFromIndexedDB(`CONTRATO-${client.id}`).catch(() => {});
      }
    } catch (cleanErr) {
      console.warn("[Firestore] Error pruning removed documents from client:", cleanErr);
    }

    const current = loadClients();
    const idx = current.findIndex((c) => c.id === client.id);
    const updated = idx >= 0 ? current.map((c) => (c.id === client.id ? client : c)) : [...current, client];
    saveClients(updated);

    if (isFirestoreQuotaExhausted()) return;

    // Build size-safe Firestore payload: full metadata, with binary payloads kept safe in IndexedDB
    const firestoreClientPayload = {
      ...client,
      documentos: (client.documentos || []).map((d) => ({
        ...d,
        url: (d.url && d.url.length > 1000) ? "" : (d.url || ""),
        archivoUrl: (d.archivoUrl && d.archivoUrl.length > 1000) ? "" : (d.archivoUrl || ""),
      })),
      contratoUrl: (client.contratoUrl && client.contratoUrl.length > 1000) ? "" : (client.contratoUrl || ""),
    };

    await setDoc(doc(db, COLLECTIONS.CLIENTS, client.id), sanitizeForFirestore(firestoreClientPayload));
    await ensureUserForClient(client);
  } catch (error) {
    handleFirestoreError(error, "saveClient");
  }
}

export async function deleteClientFromFirestore(id: string) {
  try {
    const current = loadClients();
    saveClients(current.filter((c) => c.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id));
    await deleteDoc(doc(db, COLLECTIONS.USERS, `usr-cli-${id}`)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, "deleteClient");
  }
}

export async function saveServiceToFirestore(service: ServiceItem) {
  try {
    const current = loadServices();
    const idx = current.findIndex((s) => s.id === service.id);
    const updated = idx >= 0 ? current.map((s) => (s.id === service.id ? service : s)) : [...current, service];
    saveServices(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.SERVICES, service.id), sanitizeForFirestore(service));
  } catch (error) {
    handleFirestoreError(error, "saveService");
  }
}

export async function deleteServiceFromFirestore(id: string) {
  try {
    const current = loadServices();
    saveServices(current.filter((s) => s.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.SERVICES, id));
  } catch (error) {
    handleFirestoreError(error, "deleteService");
  }
}

export async function saveExpenseToFirestore(expense: Expense) {
  try {
    const current = loadExpenses();
    const idx = current.findIndex((e) => e.id === expense.id);
    const updated = idx >= 0 ? current.map((e) => (e.id === expense.id ? expense : e)) : [expense, ...current];
    saveExpenses(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.EXPENSES, expense.id), sanitizeForFirestore(expense));
  } catch (error) {
    handleFirestoreError(error, "saveExpense");
  }
}

export async function deleteExpenseFromFirestore(id: string) {
  try {
    const current = loadExpenses();
    saveExpenses(current.filter((e) => e.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.EXPENSES, id));
  } catch (error) {
    handleFirestoreError(error, "deleteExpense");
  }
}

export async function saveAbonoToFirestore(abono: AbonoTicket) {
  try {
    const current = loadAbonos();
    const idx = current.findIndex((a) => a.id === abono.id);
    const updated = idx >= 0 ? current.map((a) => (a.id === abono.id ? abono : a)) : [abono, ...current];
    saveAbonos(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.ABONOS, abono.id), sanitizeForFirestore(abono));
  } catch (error) {
    handleFirestoreError(error, "saveAbono");
  }
}

export async function deleteAbonoFromFirestore(id: string) {
  try {
    const current = loadAbonos();
    saveAbonos(current.filter((a) => a.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.ABONOS, id));
  } catch (error) {
    handleFirestoreError(error, "deleteAbono");
  }
}

export async function saveCategoryToFirestore(category: ServiceCategory) {
  try {
    const current = loadCategories();
    const idx = current.findIndex((c) => c.id === category.id);
    const updated = idx >= 0 ? current.map((c) => (c.id === category.id ? category : c)) : [...current, category];
    saveCategories(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.CATEGORIES, category.id), sanitizeForFirestore(category));
  } catch (error) {
    handleFirestoreError(error, "saveCategory");
  }
}

export async function deleteCategoryFromFirestore(id: string) {
  try {
    const current = loadCategories();
    saveCategories(current.filter((c) => c.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
  } catch (error) {
    handleFirestoreError(error, "deleteCategory");
  }
}

// ==========================================
// CALENDAR EVENTS & EXPEDIENTE DE SERVICIO
// ==========================================

export function subscribeToCalendarEvents(onUpdate: (data: CalendarEvent[]) => void) {
  const cached = loadCalendarEvents();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  const q = collection(db, COLLECTIONS.EVENTS);
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...(docSnap.data() as CalendarEvent) });
      });
      // Merge snapshot with current local cache to prevent losing local or caratula-derived shifts
      const currentCached = loadCalendarEvents();
      const merged = deduplicateCalendarEvents([...currentCached, ...items]);
      merged.sort((a, b) => (a.fechaInicio || "").localeCompare(b.fechaInicio || ""));
      saveCalendarEvents(merged);
      onUpdate(merged);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToCalendarEvents");
      const currentCached = loadCalendarEvents();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveCalendarEventToFirestore(event: CalendarEvent) {
  try {
    const current = loadCalendarEvents();
    const eventFolio = event.folioGuardia ? event.folioGuardia.trim().toUpperCase() : "";
    const idx = current.findIndex((e) => {
      if (e.id === event.id) return true;
      if (eventFolio && e.folioGuardia && e.folioGuardia.trim().toUpperCase() === eventFolio) return true;
      if (eventFolio && e.id && e.id.trim().toUpperCase() === eventFolio) return true;
      return isSameGuardia(e, event);
    });

    const updated = idx >= 0 ? current.map((e, i) => (i === idx ? event : e)) : [...current, event];
    saveCalendarEvents(updated);

    if (isFirestoreQuotaExhausted()) {
      console.warn("[Firestore] Guard active: Event saved to local cache only.", event.id, event.folioGuardia);
      return;
    }

    await setDoc(doc(db, COLLECTIONS.EVENTS, event.id), sanitizeForFirestore(event));

    // If the event previously had a different doc ID in Firestore, clean up previous doc ONLY IF it represents the exact same folio
    if (
      idx >= 0 &&
      current[idx].id &&
      current[idx].id !== event.id &&
      current[idx].folioGuardia &&
      (current[idx].folioGuardia === event.folioGuardia || current[idx].id === event.folioGuardia)
    ) {
      await deleteDoc(doc(db, COLLECTIONS.EVENTS, current[idx].id)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, "saveCalendarEvent");
  }
}

export async function deleteCalendarEventFromFirestore(id: string) {
  try {
    const current = loadCalendarEvents();
    const target = current.find((e) => e.id === id || e.folioGuardia === id);
    saveCalendarEvents(current.filter((e) => e.id !== id && e.folioGuardia !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.EVENTS, id)).catch(() => {});
    if (target?.folioGuardia && target.folioGuardia !== id) {
      await deleteDoc(doc(db, COLLECTIONS.EVENTS, target.folioGuardia)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, "deleteCalendarEvent");
  }
}

export function subscribeToExpedienteEntries(onUpdate: (data: ExpedienteEntry[]) => void) {
  const cached = loadExpedienteEntries();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.EXPEDIENTE), limit(250));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ExpedienteEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as ExpedienteEntry);
      });
      items.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
      saveExpedienteEntries(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToExpedienteEntries");
      const currentCached = loadExpedienteEntries();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveExpedienteEntryToFirestore(entry: ExpedienteEntry) {
  try {
    // If entry contains an attached file/photo, persist it to IndexedDB and document collection
    if (entry.adjuntoUrl) {
      await saveDocumentToIndexedDB({
        id: `DOC-EXP-${entry.id}`,
        ownerId: entry.clientId || entry.id,
        category: "expediente",
        nombre: entry.titulo || "Evidencia Clínica de Expediente",
        tipo: "Estudio_Laboratorio",
        url: entry.adjuntoUrl,
        archivoUrl: entry.adjuntoUrl,
        tamano: "Digital",
        fechaSubida: entry.fechaHora.split(" ")[0] || new Date().toISOString().split("T")[0],
        notas: `Adjunto de nota clínica registrada por ${entry.registradoPor || "Personal"}`,
      });
    }

    const current = loadExpedienteEntries();
    const idx = current.findIndex((e) => e.id === entry.id);
    const updated = idx >= 0 ? current.map((e) => (e.id === entry.id ? entry : e)) : [entry, ...current];
    saveExpedienteEntries(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.EXPEDIENTE, entry.id), sanitizeForFirestore(entry));
  } catch (error) {
    handleFirestoreError(error, "saveExpedienteEntry");
  }
}

export async function deleteExpedienteEntryFromFirestore(id: string) {
  try {
    const current = loadExpedienteEntries();
    saveExpedienteEntries(current.filter((e) => e.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.EXPEDIENTE, id));
  } catch (error) {
    handleFirestoreError(error, "deleteExpedienteEntry");
  }
}

export function subscribeToKardexRecords(onUpdate: (data: KardexRecord[]) => void) {
  const cached = loadKardexRecords();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.KARDEX), limit(250));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: KardexRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as KardexRecord);
      });
      items.sort((a, b) => (b.ultimaModificacion || "").localeCompare(a.ultimaModificacion || ""));
      saveKardexRecords(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToKardexRecords");
      const currentCached = loadKardexRecords();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveKardexRecordToFirestore(kardex: KardexRecord) {
  try {
    const current = loadKardexRecords();
    const idx = current.findIndex((k) => k.id === kardex.id);
    const updated = idx >= 0 ? current.map((k) => (k.id === kardex.id ? kardex : k)) : [kardex, ...current];
    saveKardexRecords(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.KARDEX, kardex.id), sanitizeForFirestore(kardex));
  } catch (error) {
    handleFirestoreError(error, "saveKardexRecord");
  }
}

export async function deleteKardexRecordFromFirestore(id: string) {
  try {
    const current = loadKardexRecords();
    saveKardexRecords(current.filter((k) => k.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.KARDEX, id));
  } catch (error) {
    handleFirestoreError(error, "deleteKardexRecord");
  }
}

// In-memory cache to prevent redundant Firestore writes and eliminate N+1 read exhaustion
const syncedUsersCache = new Set<string>();

export async function ensureUserForClient(client: Client) {
  if (!client?.id || isFirestoreQuotaExhausted()) return;
  const cacheKey = `cli_${client.id}_${client.nombreCompletoCliente}`;
  if (syncedUsersCache.has(cacheKey)) return;

  try {
    const userId = `usr-cli-${client.id}`;
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userData: Partial<SystemUser> = {
      id: userId,
      ux: client.id,
      cx: generateSecureRandomPassword(10),
      role: "client",
      nombre: client.nombreCompletoCliente,
      clientId: client.id,
      estatus: "Activo",
      timestamp: new Date().toISOString(),
    };
    await setDoc(userRef, sanitizeForFirestore(userData), { merge: true });
    syncedUsersCache.add(cacheKey);
  } catch (err: any) {
    handleFirestoreError(err, "ensureUserForClient");
  }
}

export async function ensureUserForStaff(staff: StaffMember) {
  if (!staff?.id || isFirestoreQuotaExhausted()) return;
  const socioUx = (staff.noSocio || staff.id || "25001").trim();
  const fullName = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim();
  const cacheKey = `staff_${staff.id}_${fullName}_${socioUx}`;
  if (syncedUsersCache.has(cacheKey)) return;

  try {
    const cleanId = socioUx.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const userId = `usr-staff-${cleanId}`;
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const isAtc = staff.isAdministrativo || staff.puestoTipoPersonal?.toLowerCase().includes("atención") || staff.puestoTipoPersonal?.toLowerCase().includes("atencion");
    const userData: Partial<SystemUser> = {
      id: userId,
      ux: socioUx,
      cx: generateSecureRandomPassword(10),
      role: isAtc ? "atencion_clientes" : "nurse",
      nombre: fullName,
      nurseId: socioUx,
      estatus: "Activo",
      timestamp: new Date().toISOString(),
    };
    await setDoc(userRef, sanitizeForFirestore(userData), { merge: true });
    syncedUsersCache.add(cacheKey);
  } catch (err: any) {
    handleFirestoreError(err, "ensureUserForStaff");
  }
}

// ==========================================
// STAFF MEMBERS (SOCIOS DE SERVICIO / CREDENCIALES)
// ==========================================

export function subscribeToStaffMembers(onUpdate: (data: StaffMember[]) => void) {
  const cached = loadStaffMembers();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.STAFF),
    async (snapshot) => {
      const items: StaffMember[] = [];
      snapshot.forEach((docSnap) => {
        const staff = docSnap.data() as StaffMember;
        items.push(staff);
      });
      items.sort((a, b) => (a.noSocio || "").localeCompare(b.noSocio || ""));

      // Hydrate staff documents from IndexedDB locally without extra Firestore queries
      try {
        for (const staff of items) {
          if (!staff || !staff.id) continue;
          const storedDocs = await getDocumentsByOwnerFromIndexedDB(staff.id);

          if (storedDocs && storedDocs.length > 0) {
            const storedMap = new Map<string, StoredDocument>();
            storedDocs.forEach((d) => {
              if (d.id) storedMap.set(d.id, d);
            });

            // Only update existing documents in staff.documentos (never resurrect deleted ones)
            if (Array.isArray(staff.documentos)) {
              staff.documentos = staff.documentos.map((doc) => {
                const stored = storedMap.get(doc.id);
                if (stored && (stored.url || stored.archivoUrl)) {
                  return {
                    ...doc,
                    url: stored.url || stored.archivoUrl || doc.url || "",
                    archivoUrl: stored.archivoUrl || stored.url || doc.archivoUrl || "",
                  };
                }
                return doc;
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Firestore] Error hydrating staff with local docs:", err);
      }

      const cleanStaff = deduplicateStaffMembers(items);
      saveStaffMembers(cleanStaff);
      onUpdate(cleanStaff);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToStaffMembers");
      const currentCached = loadStaffMembers();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveStaffMemberToFirestore(staff: StaffMember) {
  try {
    // Save staff documents into IndexedDB and Cloud Firestore
    if (Array.isArray(staff.documentos) && staff.documentos.length > 0) {
      for (const docItem of staff.documentos) {
        if (docItem && docItem.id) {
          let docUrl = docItem.url || (docItem as any).archivoUrl || "";
          if (!docUrl || docUrl.length < 50) {
            const stored = await getDocumentFromIndexedDB(docItem.id);
            if (stored?.url || stored?.archivoUrl) {
              docUrl = stored.url || stored.archivoUrl || "";
            }
          }
          if (docUrl) {
            const storedDoc: StoredDocument = {
              id: docItem.id,
              ownerId: staff.id,
              category: "staff",
              nombre: docItem.nombre || "Documento de Personal",
              tipo: docItem.tipo || "Otro",
              url: docUrl,
              archivoUrl: docUrl,
              tamano: docItem.tamano,
              tamanoBytes: docItem.tamanoBytes,
              nombreArchivoOriginal: docItem.nombreArchivoOriginal,
              fechaSubida: docItem.fechaSubida || new Date().toISOString().split("T")[0],
              notas: docItem.notas,
            };
            await saveDocumentToIndexedDB(storedDoc);
            if (!isFirestoreQuotaExhausted() && docUrl.length < 850000) {
              await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docItem.id), sanitizeForFirestore(storedDoc)).catch(() => {});
            }
          }
        }
      }
    }

    // Clean up any deleted staff documents from local IndexedDB and cloud
    try {
      const storedDocs = await getDocumentsByOwnerFromIndexedDB(staff.id);
      const currentDocIds = new Set((staff.documentos || []).map((d) => d.id));
      for (const stored of storedDocs) {
        if (!currentDocIds.has(stored.id)) {
          await deleteDocumentFromIndexedDB(stored.id);
          if (!isFirestoreQuotaExhausted()) {
            await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, stored.id)).catch(() => {});
          }
        }
      }
    } catch (cleanErr) {
      console.warn("[Firestore] Error pruning removed documents from staff:", cleanErr);
    }

    const current = loadStaffMembers();
    const idx = current.findIndex((s) => s.id === staff.id);
    const updated = idx >= 0 ? current.map((s) => (s.id === staff.id ? staff : s)) : [...current, staff];
    saveStaffMembers(updated);

    if (isFirestoreQuotaExhausted()) return;

    const firestoreStaffPayload = {
      ...staff,
      documentos: (staff.documentos || []).map((d) => ({
        ...d,
        url: (d.url && d.url.length > 1000) ? "" : (d.url || ""),
        archivoUrl: (d.archivoUrl && d.archivoUrl.length > 1000) ? "" : (d.archivoUrl || ""),
      })),
      fotoUrl: (staff.fotoUrl && staff.fotoUrl.length > 200000) ? "" : (staff.fotoUrl || ""),
    };

    await setDoc(doc(db, COLLECTIONS.STAFF, staff.id), sanitizeForFirestore(firestoreStaffPayload));
    await ensureUserForStaff(staff);
  } catch (error) {
    handleFirestoreError(error, "saveStaffMember");
  }
}

export async function deleteStaffMemberFromFirestore(id: string) {
  try {
    const current = loadStaffMembers();
    saveStaffMembers(current.filter((s) => s.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.STAFF, id));
    await deleteDoc(doc(db, COLLECTIONS.USERS, `usr-staff-${id}`)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, "deleteStaffMember");
  }
}

// ==========================================
// SYSTEM USERS (ADMINISTRACIÓN DE USUARIOS Y CONTRASEÑAS)
// ==========================================

const DEFAULT_SUPERADMIN: SystemUser = {
  id: "usr-superadmin-nestor",
  ux: "Nestor Moedano",
  cx: "Ue18195073",
  role: "admin",
  nombre: "Néstor Fernando Miranda Moedano",
  isSuperAdmin: true,
  estatus: "Activo",
  timestamp: new Date().toISOString(),
};

export function subscribeToSystemUsers(onUpdate: (data: SystemUser[]) => void) {
  const cached = loadSystemUsers();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  return onSnapshot(
    collection(db, COLLECTIONS.USERS),
    (snapshot) => {
      const items: SystemUser[] = [];
      let hasSuperAdmin = false;

      snapshot.forEach((docSnap) => {
        const u = docSnap.data() as SystemUser;
        items.push(u);
        if (u.isSuperAdmin || u.ux === "Nestor Moedano" || u.id === "usr-superadmin-nestor") {
          hasSuperAdmin = true;
        }
      });

      if (items.length === 0) {
        items.push(...initialSystemUsers);
      } else if (!hasSuperAdmin) {
        items.unshift(DEFAULT_SUPERADMIN);
      }

      const cleanUsers = deduplicateSystemUsers(items);
      saveSystemUsers(cleanUsers);
      onUpdate(cleanUsers);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToSystemUsers");
      const currentCached = loadSystemUsers();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveSystemUserToFirestore(user: SystemUser) {
  try {
    const current = loadSystemUsers();
    const idx = current.findIndex((u) => u.id === user.id);
    const updated = idx >= 0 ? current.map((u) => (u.id === user.id ? user : u)) : [...current, user];
    saveSystemUsers(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.USERS, user.id), sanitizeForFirestore(user));
  } catch (error) {
    handleFirestoreError(error, "saveSystemUser");
  }
}

/**
 * Helper to normalize string for diacritic and case-insensitive matching.
 */
function normalizeMatchText(str?: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Updates a user's active session / online presence in Firestore directly without full collection reads.
 */
export async function updateUserOnlineStatusInFirestore(
  ux: string,
  isOnline: boolean,
  extra?: { nombre?: string; role?: string; nurseId?: string; clientId?: string }
) {
  if (!ux || isFirestoreQuotaExhausted()) return;
  try {
    const cleanUx = ux.trim();
    const cleanId = cleanUx.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();

    // Direct single document targeted update without any collection scan
    const userDocRef = doc(db, COLLECTIONS.USERS, `usr-${cleanId}`);
    const statusPayloadRaw: Record<string, any> = {
      id: `usr-${cleanId}`,
      ux: cleanUx,
      nombre: extra?.nombre ? String(extra.nombre) : cleanUx,
      role: extra?.role ? String(extra.role) : "nurse",
      isOnline: Boolean(isOnline),
      sesionActiva: Boolean(isOnline),
      ultimaConexionIso: nowIso,
      ultimaConexionTimestamp: nowTs,
      status: isOnline ? "online" : "offline",
      updatedAt: nowIso,
    };

    if (extra?.nurseId) {
      statusPayloadRaw.nurseId = String(extra.nurseId);
    }
    if (extra?.clientId) {
      statusPayloadRaw.clientId = String(extra.clientId);
    }

    const statusPayload = sanitizeForFirestore(statusPayloadRaw);

    await setDoc(userDocRef, statusPayload, { merge: true });

    // Also update direct onlineStatus collection for fast real-time status observers
    try {
      const onlineStatusDocRef = doc(db, COLLECTIONS.ONLINE_STATUS, `status-${cleanId}`);
      await setDoc(onlineStatusDocRef, statusPayload, { merge: true });
    } catch {}
  } catch (err: any) {
    handleFirestoreError(err, "updateUserOnlineStatusInFirestore");
  }
}

/**
 * Revokes a user session remotely (Admin Logout Control).
 */
export async function revokeUserSessionInFirestore(
  targetUxOrId: string,
  nurseId?: string
): Promise<{ success: boolean; message: string }> {
  if (!targetUxOrId) return { success: false, message: "ID no válido" };
  try {
    const clean = targetUxOrId.trim().toLowerCase();
    const cleanNorm = normalizeMatchText(clean);
    const cleanNoSocio = clean.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "").replace(/^cli-/i, "");
    const digits = clean.replace(/\D/g, "");
    const nurseDigits = (nurseId || "").replace(/\D/g, "");
    const nowIso = new Date().toISOString();
    const nowFormatted = new Date().toLocaleString("es-MX");
    const nowTs = Date.now();

    let revokedUsersCount = 0;
    let revokedStaffCount = 0;
    let revokedClientsCount = 0;

    // 1. Update local users
    try {
      const localUsers = loadSystemUsers();
      const updated = localUsers.map((u) => {
        const uLower = (u.ux || "").trim().toLowerCase();
        const uId = (u.id || "").toLowerCase();
        const uNurse = (u.nurseId || "").toLowerCase();
        if (
          uLower === clean ||
          uId === clean ||
          (nurseId && uNurse === nurseId.toLowerCase()) ||
          (cleanNoSocio && uNurse.includes(cleanNoSocio))
        ) {
          revokedUsersCount++;
          return {
            ...u,
            sesionRevocadaAt: nowIso,
            isOnline: false,
            sesionActiva: false,
            ultimaConexionTimestamp: nowTs,
          };
        }
        return u;
      });
      saveSystemUsers(updated);
    } catch {}

    // 2. Update local staff
    try {
      const localStaff = loadStaffMembers();
      const updated = localStaff.map((s) => {
        const sId = (s.id || "").toLowerCase();
        const sNo = (s.noSocio || "").toLowerCase();
        if (sId === clean || sNo === clean || (nurseId && sId === nurseId.toLowerCase())) {
          revokedStaffCount++;
          return {
            ...s,
            sesionActiva: false,
            isOnline: false,
            sesionRevocadaAt: nowIso,
            ultimaConexionTimestamp: nowTs,
            ultimaConexion: `Sesión revocada por admin (${nowFormatted})`,
          };
        }
        return s;
      });
      saveStaffMembers(updated);
    } catch {}

    // 3. Update local clients
    try {
      const localClients = loadClients();
      const updated = localClients.map((c) => {
        const cId = (c.id || "").toLowerCase();
        if (cId === clean || cId.includes(cleanNoSocio)) {
          revokedClientsCount++;
          return {
            ...c,
            sesionActiva: false,
            isOnline: false,
            sesionRevocadaAt: nowIso,
            ultimaConexionTimestamp: nowTs,
            ultimaConexion: `Sesión revocada por admin (${nowFormatted})`,
          };
        }
        return c;
      });
      saveClients(updated);
    } catch {}

    // Sync to Firestore if quota available
    if (!isFirestoreQuotaExhausted()) {
      try {
        const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
        for (const docSnap of usersSnap.docs) {
          const uData = docSnap.data() as SystemUser;
          const uLower = (uData.ux || "").trim().toLowerCase();
          const uNorm = normalizeMatchText(uData.ux);
          const uNameNorm = normalizeMatchText(uData.nombre);
          const uId = (uData.id || "").toLowerCase();
          const uNurse = (uData.nurseId || "").toLowerCase();
          const uNurseDigits = (uData.nurseId || "").replace(/\D/g, "");
          const uClient = (uData.clientId || "").toLowerCase();
          const uDigits = `${uLower} ${uId} ${uNurse} ${uClient}`.replace(/\D/g, "");

          const isMatch =
            docSnap.id.toLowerCase() === clean ||
            uLower === clean ||
            uNorm === cleanNorm ||
            uId === clean ||
            Boolean(nurseId && (uNurse === nurseId.toLowerCase() || (nurseDigits.length >= 3 && uNurseDigits === nurseDigits))) ||
            Boolean(cleanNoSocio && cleanNoSocio.length >= 2 && (uNurse.includes(cleanNoSocio) || uLower.includes(cleanNoSocio))) ||
            Boolean(digits && digits.length >= 3 && (uDigits.includes(digits) || digits.includes(uNurseDigits))) ||
            Boolean(cleanNorm.length >= 4 && uNameNorm && (uNameNorm.includes(cleanNorm) || cleanNorm.includes(uNameNorm)));

          if (isMatch) {
            await setDoc(
              doc(db, COLLECTIONS.USERS, docSnap.id),
              sanitizeForFirestore({
                sesionRevocadaAt: nowIso,
                isOnline: false,
                sesionActiva: false,
                ultimaConexionTimestamp: nowTs,
              }),
              { merge: true }
            );
          }
        }
      } catch (uErr) {
        handleFirestoreError(uErr, "revokeUserSession (users)");
      }
    }

    return {
      success: true,
      message: `Sesión revocada y cerrada con éxito (${revokedUsersCount + revokedStaffCount + revokedClientsCount} registros actualizados).`,
    };
  } catch (err: any) {
    console.error("[Firestore] Error revoking user session:", err);
    return { success: false, message: err?.message || "Error al revocar sesión" };
  }
}

/**
 * Directly terminates a specific Guardia Shift record by its ID in Firestore.
 */
export async function terminateGuardiaShiftByIdInFirestore(
  guardiaId: string,
  adminName: string = "Administrador Cuidarte",
  notes?: string
): Promise<{ success: boolean; message: string }> {
  if (!guardiaId) return { success: false, message: "ID de guardia no válido" };
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs";
    const nowDateStr = now.toISOString().slice(0, 10);
    const nowFormatted = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let startIso = "";
    let durMinutes: number | undefined = undefined;

    // Update local cache immediately
    try {
      const localGuardias = loadGuardias();
      const targetG = localGuardias.find((g) => g.id === guardiaId);
      if (targetG?.fechaInicioIso) {
        startIso = targetG.fechaInicioIso;
        const startObj = new Date(startIso);
        durMinutes = Math.max(1, Math.round((now.getTime() - startObj.getTime()) / (1000 * 60)));
      }
      const updated = localGuardias.map((g) =>
        g.id === guardiaId
          ? {
              ...g,
              estatus: "Finalizada" as const,
              fechaFinIso: nowIso,
              fechaFinFormateada: nowFormatted,
              horaFin: nowTimeStr,
              fechaFin: nowDateStr,
              duracionMinutos: durMinutes,
              notasFin: notes ? `Turno terminado: ${notes}` : "Turno finalizado desde Panel de Administración Cuidarte",
              novedadesEntrega: notes
                ? `${g.novedadesEntrega ? g.novedadesEntrega + " | " : ""}Turno terminado por administración (${adminName}): ${notes}`
                : `${g.novedadesEntrega ? g.novedadesEntrega + " | " : ""}Turno finalizado remotamente por ${adminName}`,
            }
          : g
      );
      saveGuardias(updated);
    } catch {}

    // Update linked calendar events locally
    try {
      const localEvents = loadCalendarEvents();
      const updatedEvents = localEvents.map((e) =>
        e.guardiaShiftId === guardiaId
          ? {
              ...e,
              turnoAbierto: false,
              turnoFinalizado: true,
              estado: "Completado" as const,
              horaSalidaReal: nowTimeStr,
              notasFin: "Turno cerrado por administración",
            }
          : e
      );
      saveCalendarEvents(updatedEvents);
    } catch {}

    // Sync to Firestore if quota available
    if (!isFirestoreQuotaExhausted()) {
      try {
        const gRef = doc(db, COLLECTIONS.GUARDIAS, guardiaId);
        await setDoc(
          gRef,
          sanitizeForFirestore({
            estatus: "Finalizada",
            fechaFinIso: nowIso,
            fechaFinFormateada: nowFormatted,
            horaFin: nowTimeStr,
            fechaFin: nowDateStr,
            duracionMinutos: durMinutes ?? null,
            notasFin: notes ? `Turno terminado: ${notes}` : "Turno finalizado desde Panel de Administración Cuidarte",
            novedadesEntrega: notes
              ? `Turno terminado por administración (${adminName}): ${notes}`
              : `Turno finalizado remotamente por ${adminName}`,
          }),
          { merge: true }
        );
      } catch (fsErr) {
        handleFirestoreError(fsErr, "terminateGuardiaShiftById");
      }
    }

    return {
      success: true,
      message: "El turno ha sido finalizado con éxito.",
    };
  } catch (err: any) {
    console.error("[Firestore] Error terminating guardia by ID:", err);
    return { success: false, message: err?.message || "Error al terminar turno" };
  }
}

/**
 * Terminates all active shifts (GuardiaShiftRecord) and open calendar events for a staff member remotely (Admin Shift Termination).
 */
export async function terminateStaffActiveShiftInFirestore(
  staffOrId: StaffMember | string,
  adminName: string = "Administrador",
  notes?: string
): Promise<{ success: boolean; count: number; message: string }> {
  if (!staffOrId) return { success: false, count: 0, message: "ID o datos de personal no válidos" };

  try {
    let staffId = "";
    let noSocio = "";
    let fullName = "";
    let firstName = "";
    let lastName = "";

    if (typeof staffOrId === "object" && staffOrId !== null) {
      staffId = (staffOrId.id || "").trim().toLowerCase();
      noSocio = (staffOrId.noSocio || "").trim().toLowerCase();
      firstName = (staffOrId.nombre || "").trim().toLowerCase();
      lastName = (staffOrId.apellidos || "").trim().toLowerCase();
      fullName = `${firstName} ${lastName}`.trim();
    } else if (typeof staffOrId === "string") {
      staffId = staffOrId.trim().toLowerCase();
      noSocio = staffId.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
      fullName = staffId;
      firstName = staffId;
    }

    const digitsFromNoSocio = (noSocio || "").replace(/\D/g, "");
    const digitsFromStaffId = (staffId || "").replace(/\D/g, "");
    const cleanNoSocio = noSocio.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
    const fullNameNorm = normalizeMatchText(fullName);
    const firstNameNorm = normalizeMatchText(firstName);
    const lastNameNorm = normalizeMatchText(lastName);

    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeStr = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs";
    const nowDateStr = now.toISOString().slice(0, 10);
    const nowFormatted = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    let terminatedCount = 0;

    const isMatchingStaff = (recStaffId?: string, recNoSocio?: string, recNombre?: string, recUserId?: string) => {
      const rId = (recStaffId || "").trim().toLowerCase();
      const rNo = (recNoSocio || "").trim().toLowerCase().replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
      const rNom = (recNombre || "").trim().toLowerCase();
      const rNomNorm = normalizeMatchText(recNombre);
      const rUser = (recUserId || "").trim().toLowerCase();
      const rDigits = `${rId} ${rNo} ${rUser}`.replace(/\D/g, "");

      if (staffId && (rId === staffId || rUser === staffId || rId.includes(staffId) || staffId.includes(rId))) return true;
      if (cleanNoSocio && (rNo === cleanNoSocio || rId.includes(cleanNoSocio) || rUser.includes(cleanNoSocio))) return true;
      if (digitsFromNoSocio && digitsFromNoSocio.length >= 3 && (rDigits === digitsFromNoSocio || rDigits.includes(digitsFromNoSocio) || digitsFromNoSocio.includes(rDigits))) return true;
      if (digitsFromStaffId && digitsFromStaffId.length >= 3 && (rDigits === digitsFromStaffId || rDigits.includes(digitsFromStaffId) || digitsFromStaffId.includes(rDigits))) return true;
      if (fullNameNorm && rNomNorm && (rNomNorm.includes(fullNameNorm) || fullNameNorm.includes(rNomNorm))) return true;
      if (firstNameNorm && lastNameNorm && rNomNorm.includes(firstNameNorm) && rNomNorm.includes(lastNameNorm)) return true;
      if (firstNameNorm && firstNameNorm.length >= 3 && rNomNorm.includes(firstNameNorm)) return true;

      return false;
    };

    // Update local cache immediately
    try {
      const localGuardias = loadGuardias();
      if (localGuardias && localGuardias.length > 0) {
        let changed = false;
        const updated = localGuardias.map((g) => {
          if (g.estatus === "En Curso" && isMatchingStaff(g.staffId, g.staffNoSocio, g.staffNombre, (g as any).userId)) {
            changed = true;
            terminatedCount++;
            return {
              ...g,
              estatus: "Finalizada" as const,
              fechaFinIso: nowIso,
              fechaFinFormateada: nowFormatted,
              horaFin: nowTimeStr,
              fechaFin: nowDateStr,
              novedadesEntrega: `${g.novedadesEntrega ? g.novedadesEntrega + " | " : ""}Turno finalizado remotamente por ${adminName}`,
            };
          }
          return g;
        });
        if (changed) {
          saveGuardias(updated);
        }
      }
    } catch {}

    // Update local calendar events
    try {
      const localEvents = loadCalendarEvents();
      const updatedEvents = localEvents.map((evData) => {
        const isOpen = evData.turnoAbierto || evData.estado === "En Proceso";
        if (isOpen && isMatchingStaff(evData.staffId, (evData as any).staffNoSocio, evData.personalAsignado)) {
          return {
            ...evData,
            turnoAbierto: false,
            turnoFinalizado: true,
            estado: "Completado" as const,
            horaSalidaReal: nowTimeStr,
            notasFin: "Turno cerrado por administración",
          };
        }
        return evData;
      });
      saveCalendarEvents(updatedEvents);
    } catch {}

    // Sync to Firestore if quota available
    if (!isFirestoreQuotaExhausted()) {
      try {
        const activeShiftsQuery = query(collection(db, COLLECTIONS.GUARDIAS), where("estatus", "==", "En Curso"), limit(50));
        const guardiasSnap = await getDocs(activeShiftsQuery);
        for (const docSnap of guardiasSnap.docs) {
          const gData = docSnap.data() as GuardiaShiftRecord;
          if (gData.estatus === "En Curso" && isMatchingStaff(gData.staffId, gData.staffNoSocio, gData.staffNombre, (gData as any).userId)) {
            const startObj = gData.fechaInicioIso ? new Date(gData.fechaInicioIso) : null;
            const durMinutes = startObj ? Math.max(1, Math.round((now.getTime() - startObj.getTime()) / (1000 * 60))) : undefined;
            
            await setDoc(
              doc(db, COLLECTIONS.GUARDIAS, docSnap.id),
              sanitizeForFirestore({
                estatus: "Finalizada",
                fechaFinIso: nowIso,
                fechaFinFormateada: nowFormatted,
                horaFin: nowTimeStr,
                fechaFin: nowDateStr,
                duracionMinutos: durMinutes ?? null,
                notasFin: notes ? `Turno terminado: ${notes}` : "Turno finalizado desde Panel de Administración Cuidarte",
                novedadesEntrega: notes
                  ? `${gData.novedadesEntrega ? gData.novedadesEntrega + " | " : ""}Turno terminado por administración (${adminName}): ${notes}`
                  : `${gData.novedadesEntrega ? gData.novedadesEntrega + " | " : ""}Turno finalizado remotamente por ${adminName}`,
              }),
              { merge: true }
            );
          }
        }
      } catch (gErr) {
        handleFirestoreError(gErr, "terminateStaffActiveShift (guardias)");
      }
    }

    return {
      success: true,
      count: terminatedCount,
      message:
        terminatedCount > 0
          ? `Se finalizó el turno activo del colaborador (${terminatedCount} registro(s) actualizado(s)).`
          : "El turno ha sido cerrado y sincronizado con éxito.",
    };
  } catch (err: any) {
    console.error("[Firestore] Error terminating staff active shift:", err);
    return {
      success: false,
      count: 0,
      message: err?.message || "Error al finalizar turno",
    };
  }
}

export async function deleteSystemUserFromFirestore(id: string) {
  try {
    const current = loadSystemUsers();
    saveSystemUsers(current.filter((u) => u.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    const docRef = doc(db, COLLECTIONS.USERS, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const uData = snap.data() as SystemUser;
      if (uData.isSuperAdmin || uData.ux === "Nestor Moedano" || uData.id === "usr-superadmin-nestor") {
        throw new Error("El Super Administrador Nestor Moedano está protegido y no se puede eliminar.");
      }
      await deleteDoc(docRef);
    } else {
      // Query by user id in case the document ID is different
      const q = query(collection(db, COLLECTIONS.USERS), where("id", "==", id));
      const qSnap = await getDocs(q);
      for (const d of qSnap.docs) {
        const uData = d.data() as SystemUser;
        if (uData.isSuperAdmin || uData.ux === "Nestor Moedano" || uData.id === "usr-superadmin-nestor") continue;
        await deleteDoc(d.ref);
      }
    }
  } catch (error) {
    handleFirestoreError(error, "deleteSystemUser");
  }
}

// ==========================================
// CORTES DE CAJA (POS SHIFT CLOSURES)
// ==========================================

export function subscribeToCortes(onUpdate: (data: CorteDeCajaRecord[]) => void) {
  const cached = loadCortes();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.CORTES), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: CorteDeCajaRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as CorteDeCajaRecord);
      });
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      saveCortes(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToCortes");
      const currentCached = loadCortes();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveCorteToFirestore(corte: CorteDeCajaRecord) {
  try {
    const current = loadCortes();
    const idx = current.findIndex((c) => c.id === corte.id);
    const updated = idx >= 0 ? current.map((c) => (c.id === corte.id ? corte : c)) : [corte, ...current];
    saveCortes(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.CORTES, corte.id), sanitizeForFirestore(corte));
  } catch (error) {
    handleFirestoreError(error, "saveCorte");
  }
}

export async function deleteCorteFromFirestore(id: string) {
  try {
    const current = loadCortes();
    saveCortes(current.filter((c) => c.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.CORTES, id));
  } catch (error) {
    handleFirestoreError(error, "deleteCorte");
  }
}

// CONTROL DE GUARDIAS (INICIO Y FIN DE GUARDIA)
// ==========================================

export function subscribeToGuardias(onUpdate: (data: GuardiaShiftRecord[]) => void) {
  const cached = loadGuardias();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.GUARDIAS), limit(250));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: GuardiaShiftRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as GuardiaShiftRecord);
      });
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      saveGuardias(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToGuardias");
      const currentCached = loadGuardias();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveGuardiaToFirestore(guardia: GuardiaShiftRecord) {
  try {
    const current = loadGuardias();
    const idx = current.findIndex((g) => g.id === guardia.id);
    const updated = idx >= 0 ? current.map((g) => (g.id === guardia.id ? guardia : g)) : [guardia, ...current];
    saveGuardias(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.GUARDIAS, guardia.id), sanitizeForFirestore(guardia));
  } catch (error) {
    handleFirestoreError(error, "saveGuardia");
  }
}

export async function deleteGuardiaFromFirestore(id: string) {
  try {
    const current = loadGuardias();
    saveGuardias(current.filter((g) => g.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.GUARDIAS, id));
  } catch (error) {
    handleFirestoreError(error, "deleteGuardia");
  }
}

// CONTROL DE INVENTARIO Y MEDICAMENTOS
// ==========================================

export function subscribeToInventory(onUpdate: (data: InventoryItem[]) => void) {
  const cached = loadInventory();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.INVENTORY), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as InventoryItem);
      });
      items.sort((a, b) => (b.ultimaActualizacion || "").localeCompare(a.ultimaActualizacion || ""));
      saveInventory(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToInventory");
      const currentCached = loadInventory();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveInventoryItemToFirestore(item: InventoryItem) {
  try {
    const current = loadInventory();
    const idx = current.findIndex((i) => i.id === item.id);
    const updated = idx >= 0 ? current.map((i) => (i.id === item.id ? item : i)) : [item, ...current];
    saveInventory(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.INVENTORY, item.id), sanitizeForFirestore(item));
  } catch (error) {
    handleFirestoreError(error, "saveInventoryItem");
  }
}

export async function deleteInventoryItemFromFirestore(id: string) {
  try {
    const current = loadInventory();
    saveInventory(current.filter((i) => i.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.INVENTORY, id));
  } catch (error) {
    handleFirestoreError(error, "deleteInventoryItem");
  }
}

// ==========================================
// INCIDENCIAS Y TICKETS DE ATENCIÓN A CLIENTES
// ==========================================

export function subscribeToIncidencias(onUpdate: (data: IncidenciaTicket[]) => void) {
  const cached = loadIncidencias();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.INCIDENCIAS), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: IncidenciaTicket[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as IncidenciaTicket);
      });
      items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      saveIncidencias(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToIncidencias");
      const currentCached = loadIncidencias();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveIncidenciaToFirestore(incidencia: IncidenciaTicket) {
  try {
    const current = loadIncidencias();
    const idx = current.findIndex((i) => i.id === incidencia.id);
    const updated = idx >= 0 ? current.map((i) => (i.id === incidencia.id ? incidencia : i)) : [incidencia, ...current];
    saveIncidencias(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.INCIDENCIAS, incidencia.id), sanitizeForFirestore(incidencia));
  } catch (error) {
    handleFirestoreError(error, "saveIncidencia");
  }
}

export async function deleteIncidenciaFromFirestore(id: string) {
  try {
    const current = loadIncidencias();
    saveIncidencias(current.filter((i) => i.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.INCIDENCIAS, id));
  } catch (error) {
    handleFirestoreError(error, "deleteIncidencia");
  }
}

// ==========================================
// SOLICITUDES DE INCREMENTO DE SERVICIO
// ==========================================

export function subscribeToSolicitudesIncremento(onUpdate: (data: SolicitudIncrementoServicio[]) => void) {
  const cached = loadSolicitudesIncremento();
  if (cached && cached.length > 0) {
    onUpdate(cached);
  }
  if (isFirestoreQuotaExhausted()) {
    return () => {};
  }
  const q = query(collection(db, COLLECTIONS.SOLICITUDES_INCREMENTO), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SolicitudIncrementoServicio[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as SolicitudIncrementoServicio);
      });
      items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      saveSolicitudesIncremento(items);
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, "subscribeToSolicitudesIncremento");
      const currentCached = loadSolicitudesIncremento();
      if (currentCached) {
        onUpdate(currentCached);
      }
    }
  );
}

export async function saveSolicitudIncrementoToFirestore(solicitud: SolicitudIncrementoServicio) {
  try {
    const current = loadSolicitudesIncremento();
    const idx = current.findIndex((s) => s.id === solicitud.id);
    const updated = idx >= 0 ? current.map((s) => (s.id === solicitud.id ? solicitud : s)) : [solicitud, ...current];
    saveSolicitudesIncremento(updated);

    if (isFirestoreQuotaExhausted()) return;
    await setDoc(doc(db, COLLECTIONS.SOLICITUDES_INCREMENTO, solicitud.id), sanitizeForFirestore(solicitud));
  } catch (error) {
    handleFirestoreError(error, "saveSolicitudIncremento");
  }
}

export async function deleteSolicitudIncrementoFromFirestore(id: string) {
  try {
    const current = loadSolicitudesIncremento();
    saveSolicitudesIncremento(current.filter((s) => s.id !== id));

    if (isFirestoreQuotaExhausted()) return;
    await deleteDoc(doc(db, COLLECTIONS.SOLICITUDES_INCREMENTO, id));
  } catch (error) {
    handleFirestoreError(error, "deleteSolicitudIncremento");
  }
}

/**
 * Direct full parallel query to pull freshest cloud data when explicitly requested by user (Force sync)
 * Safely falls back to local cache if offline or Firestore free quota limit is reached.
 */
export async function fetchAllCollectionsFromFirestore() {
  try {
    const [
      caratulasSnap,
      clientsSnap,
      servicesSnap,
      expensesSnap,
      abonosSnap,
      categoriesSnap,
      eventsSnap,
      expedienteSnap,
      kardexSnap,
      staffSnap,
      usersSnap,
      cortesSnap,
      guardiasSnap,
      inventorySnap,
      incidenciasSnap,
      solicitudesSnap,
      sucursalesSnap,
    ] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.CARATULAS)),
      getDocs(collection(db, COLLECTIONS.CLIENTS)),
      getDocs(collection(db, COLLECTIONS.SERVICES)),
      getDocs(collection(db, COLLECTIONS.EXPENSES)),
      getDocs(collection(db, COLLECTIONS.ABONOS)),
      getDocs(collection(db, COLLECTIONS.CATEGORIES)),
      getDocs(collection(db, COLLECTIONS.EVENTS)),
      getDocs(collection(db, COLLECTIONS.EXPEDIENTE)),
      getDocs(collection(db, COLLECTIONS.KARDEX)),
      getDocs(collection(db, COLLECTIONS.STAFF)),
      getDocs(collection(db, COLLECTIONS.USERS)),
      getDocs(collection(db, COLLECTIONS.CORTES)),
      getDocs(collection(db, COLLECTIONS.GUARDIAS)),
      getDocs(collection(db, COLLECTIONS.INVENTORY)),
      getDocs(collection(db, COLLECTIONS.INCIDENCIAS)),
      getDocs(collection(db, COLLECTIONS.SOLICITUDES_INCREMENTO)),
      getDocs(collection(db, COLLECTIONS.SUCURSALES)),
    ]);

    // Hydrate deleted carátula tombstones from Firestore metadata if available
    try {
      const delSnap = await getDoc(doc(db, "system_metadata", "deleted_caratulas"));
      if (delSnap.exists()) {
        const cloudDeleted = delSnap.data()?.folios;
        if (Array.isArray(cloudDeleted)) {
          const currentDel = loadDeletedCaratulaFolios();
          const combined = Array.from(
            new Set([...currentDel, ...cloudDeleted.map((f: string) => String(f).trim().toLowerCase()).filter(Boolean)])
          );
          saveDeletedCaratulaFolios(combined);
        }
      }
    } catch {}

    const caratulas: Caratula[] = [];
    caratulasSnap.forEach((d) => {
      const item = d.data() as Caratula;
      const folio = item.folio || d.id;
      if (!isCaratulaFolioDeleted(folio)) {
        caratulas.push(item);
      }
    });
    caratulas.sort(compareCaratulas);
    saveCaratulas(caratulas);

    const clientsRaw: Client[] = [];
    clientsSnap.forEach((d) => clientsRaw.push(d.data() as Client));
    const clients = deduplicateClients(clientsRaw);
    clients.sort(compareClients);
    saveClients(clients);

    const services: ServiceItem[] = [];
    servicesSnap.forEach((d) => services.push(d.data() as ServiceItem));
    services.sort((a, b) => a.nombreServicio.localeCompare(b.nombreServicio));
    saveServices(services);

    const expenses: Expense[] = [];
    expensesSnap.forEach((d) => expenses.push(d.data() as Expense));
    expenses.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    saveExpenses(expenses);

    const abonos: AbonoTicket[] = [];
    abonosSnap.forEach((d) => abonos.push(d.data() as AbonoTicket));
    abonos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    saveAbonos(abonos);

    const categories: ServiceCategory[] = [];
    categoriesSnap.forEach((d) => categories.push(d.data() as ServiceCategory));
    categories.sort((a, b) => a.nombre.localeCompare(b.nombre));
    saveCategories(categories);

    const events: CalendarEvent[] = [];
    eventsSnap.forEach((d) => events.push({ id: d.id, ...(d.data() as CalendarEvent) }));
    
    // Merge with cached events to ensure no scheduled shifts are lost
    const cachedEvents = loadCalendarEvents();
    let mergedEvents = deduplicateCalendarEvents([...cachedEvents, ...events]);

    // Reconcile shifts from caratulas.guardiasProgramadas into calendar events
    for (const car of caratulas) {
      if (Array.isArray(car.guardiasProgramadas) && car.guardiasProgramadas.length > 0) {
        for (const shift of car.guardiasProgramadas) {
          const shiftFolio = shift.folioGuardia || shift.id;
          const alreadyExists = mergedEvents.some((e) => isSameGuardia(e, shift));
          if (!alreadyExists && shiftFolio) {
            const reconstructedEvent: CalendarEvent = {
              id: shiftFolio,
              folioGuardia: shiftFolio,
              clientId: car.id,
              clientNombre: car.nombreCompletoCliente,
              caratulaFolio: car.folio,
              titulo: `Guardia ${shift.tipoServicio || "Enfermería"} (${shiftFolio})`,
              fechaInicio: `${shift.fecha}T${shift.horaInicio}`,
              fechaFin: `${shift.fechaFinCalculada || shift.fecha}T${shift.horaFin}`,
              personalAsignado: shift.personalAsignado || "Por asignar",
              staffId: shift.staffId || "",
              staffNoSocio: shift.staffNoSocio || "",
              staffFoto: shift.staffFoto || "",
              tipoServicio: shift.tipoServicio || car.servicios?.[0]?.servicio || "Enfermería General",
              costoHonorarios: shift.costoHonorarios,
              honorarioPagado: Boolean(shift.honorarioPagado),
              pagoHonorarioId: shift.pagoHonorarioId,
              fechaPagoHonorario: shift.fechaPagoHonorario,
              montoPagadoHonorario: shift.montoPagadoHonorario,
              estado: "Programado",
              notas: `Guardia folio ${shiftFolio} agendada en Carátula ${car.folio}`,
              timestamp: new Date().toISOString(),
              registradoPor: "Sistema Carátulas",
            };
            mergedEvents.push(reconstructedEvent);
            // Persist to Firestore if not already present
            setDoc(doc(db, COLLECTIONS.EVENTS, shiftFolio), sanitizeForFirestore(reconstructedEvent)).catch(() => {});
          }
        }
      }
    }

    mergedEvents = deduplicateCalendarEvents(mergedEvents);
    mergedEvents.sort((a, b) => (a.fechaInicio || "").localeCompare(b.fechaInicio || ""));
    saveCalendarEvents(mergedEvents);

    // Restore and guarantee all caratulas (supporting multiple caratulas per client)
    const { restoredCaratulas } = restoreMissingCaratulasFromEventsAndAbonos(
      caratulas,
      mergedEvents,
      abonos,
      clients
    );
    const finalCaratulas = deduplicateCaratulas(
      restoredCaratulas.filter((c) => !isCaratulaFolioDeleted(c.folio))
    );
    finalCaratulas.sort(compareCaratulas);
    saveCaratulas(finalCaratulas);

    const expediente: ExpedienteEntry[] = [];
    expedienteSnap.forEach((d) => expediente.push(d.data() as ExpedienteEntry));
    expediente.sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
    saveExpedienteEntries(expediente);

    const kardex: KardexRecord[] = [];
    kardexSnap.forEach((d) => kardex.push(d.data() as KardexRecord));
    kardex.sort((a, b) => (b.ultimaModificacion || "").localeCompare(a.ultimaModificacion || ""));
    saveKardexRecords(kardex);

    const staff: StaffMember[] = [];
    staffSnap.forEach((d) => staff.push(d.data() as StaffMember));
    staff.sort((a, b) => (a.noSocio || "").localeCompare(b.noSocio || ""));
    saveStaffMembers(staff);

    const users: SystemUser[] = [];
    usersSnap.forEach((d) => users.push(d.data() as SystemUser));
    saveSystemUsers(users);

    const cortes: CorteDeCajaRecord[] = [];
    cortesSnap.forEach((d) => cortes.push(d.data() as CorteDeCajaRecord));
    cortes.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    saveCortes(cortes);

    const guardias: GuardiaShiftRecord[] = [];
    guardiasSnap.forEach((d) => guardias.push(d.data() as GuardiaShiftRecord));
    guardias.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    saveGuardias(guardias);

    const inventory: InventoryItem[] = [];
    inventorySnap.forEach((d) => inventory.push(d.data() as InventoryItem));
    inventory.sort((a, b) => (b.ultimaActualizacion || "").localeCompare(a.ultimaActualizacion || ""));
    saveInventory(inventory);

    const incidencias: IncidenciaTicket[] = [];
    incidenciasSnap.forEach((d) => incidencias.push(d.data() as IncidenciaTicket));
    incidencias.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    saveIncidencias(incidencias);

    const solicitudes: SolicitudIncrementoServicio[] = [];
    solicitudesSnap.forEach((d) => solicitudes.push(d.data() as SolicitudIncrementoServicio));
    solicitudes.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    saveSolicitudesIncremento(solicitudes);

    const sucursales: Sucursal[] = [];
    sucursalesSnap.forEach((d) => sucursales.push(d.data() as Sucursal));
    if (!sucursales.some((s) => s.id === "pachuca")) {
      sucursales.unshift(...initialSucursales);
    }
    saveSucursales(sucursales);

    return {
      caratulas: finalCaratulas,
      clients,
      services,
      expenses,
      abonos,
      categories,
      events: mergedEvents,
      expediente,
      kardex,
      staff,
      users,
      cortes,
      guardias,
      inventory,
      incidencias,
      solicitudes,
      sucursales,
    };
  } catch (error: any) {
    console.warn("[Firestore] Direct fetch warning (using local cache backup):", error?.message || error);
    // Return cached records so the UI remains completely intact and functional
    return {
      caratulas: loadCaratulas(),
      clients: loadClients(),
      services: loadServices(),
      expenses: loadExpenses(),
      abonos: loadAbonos(),
      categories: loadCategories(),
      events: loadCalendarEvents(),
      expediente: loadExpedienteEntries(),
      kardex: loadKardexRecords(),
      staff: loadStaffMembers(),
      users: loadSystemUsers(),
      cortes: loadCortes(),
      guardias: loadGuardias(),
      inventory: loadInventory(),
      incidencias: loadIncidencias(),
      solicitudes: loadSolicitudesIncremento(),
      sucursales: loadSucursales(),
    };
  }
}




