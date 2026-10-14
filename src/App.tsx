import React, { useState, useEffect, useRef, useMemo } from "react";
import { Header, TabType, SyncStatus } from "./components/Header";
import { CaratulaForm } from "./components/CaratulaForm";
import { CaratulaHistory } from "./components/CaratulaHistory";
import { ServicesManager } from "./components/ServicesManager";
import { ClientsManager } from "./components/ClientsManager";
import { FinancialDashboard } from "./components/FinancialDashboard";
import { ExpensesManager } from "./components/ExpensesManager";
import { StaffFeesTracker } from "./components/StaffFeesTracker";
import { CalendarManager } from "./components/CalendarManager";
import { ExpedienteManager } from "./components/ExpedienteManager";
import { ClientPortal } from "./components/ClientPortal";
import { NursePortal } from "./components/NursePortal";
import { VentasPortal } from "./components/VentasPortal";
import { AtencionClientesPortal } from "./components/AtencionClientesPortal";
import { LoginScreen } from "./components/LoginScreen";
import { KardexManager } from "./components/KardexManager";
import { InventoryManager } from "./components/InventoryManager";
import { DatabaseBackupManager } from "./components/DatabaseBackupManager";
import { StaffCredentialManager } from "./components/StaffCredentialManager";
import { ClientBalancesManager } from "./components/ClientBalancesManager";
import { CaratulaVerificationPortal } from "./components/CaratulaVerificationPortal";
import { SystemAuditManager } from "./components/SystemAuditManager";
import { SucursalesManager } from "./components/SucursalesManager";
import { Footer } from "./components/Footer";
import { AlertCircle, WifiOff, CheckCircle, RefreshCw, Database, ExternalLink } from "lucide-react";

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
  UserRole,
  Sucursal,
} from "./types";
import {
  formatGuardiaFolio,
  isValidGuardiaFolio,
  getMaxGuardiaIndex,
  STARTING_GUARDIA_SERIAL_INDEX,
  isSameGuardia,
  deduplicateShiftsList,
} from "./utils/guardiaFolio";
import {
  allocateClientPoolToCaratulas,
  syncAllCaratulasWithClientPools,
  calculateClientBalance,
} from "./utils/clientBalance";
import {
  isCaratulaFolioDeleted,
  markCaratulaFolioDeleted,
  unmarkCaratulaFolioDeleted,
} from "./utils/deletedFolios";
import {
  initializeFirestoreDatabase,
  resetAllFirestoreDatabase,
  fetchAllCollectionsFromFirestore,
  subscribeToCaratulas,
  subscribeToClients,
  subscribeToServices,
  subscribeToExpenses,
  subscribeToAbonos,
  subscribeToCategories,
  subscribeToCalendarEvents,
  subscribeToExpedienteEntries,
  subscribeToKardexRecords,
  subscribeToStaffMembers,
  subscribeToSystemUsers,
  subscribeToCortes,
  subscribeToGuardias,
  subscribeToInventory,
  subscribeToIncidencias,
  subscribeToSolicitudesIncremento,
  saveCaratulaToFirestore,
  deleteCaratulaFromFirestore,
  syncCaratulaCalendarEventsInFirestore,
  saveClientToFirestore,
  deleteClientFromFirestore,
  saveServiceToFirestore,
  deleteServiceFromFirestore,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  saveAbonoToFirestore,
  deleteAbonoFromFirestore,
  saveCategoryToFirestore,
  deleteCategoryFromFirestore,
  saveCalendarEventToFirestore,
  deleteCalendarEventFromFirestore,
  saveExpedienteEntryToFirestore,
  deleteExpedienteEntryFromFirestore,
  saveKardexRecordToFirestore,
  deleteKardexRecordFromFirestore,
  saveStaffMemberToFirestore,
  deleteStaffMemberFromFirestore,
  saveSystemUserToFirestore,
  deleteSystemUserFromFirestore,
  saveCorteToFirestore,
  deleteCorteFromFirestore,
  saveGuardiaToFirestore,
  deleteGuardiaFromFirestore,
  saveInventoryItemToFirestore,
  deleteInventoryItemFromFirestore,
  saveIncidenciaToFirestore,
  deleteIncidenciaFromFirestore,
  saveSolicitudIncrementoToFirestore,
  deleteSolicitudIncrementoFromFirestore,
  subscribeToSucursales,
  saveSucursalToFirestore,
  deleteSucursalFromFirestore,
  updateUserOnlineStatusInFirestore,
  revokeUserSessionInFirestore,
  isFirestoreQuotaExhausted,
  resetFirestoreQuotaCooldown,
  FIRESTORE_UPGRADE_URL,
  syncAllLocalDocumentsToCloud,
} from "./services/firestoreSync";
import {
  loadCaratulas,
  saveCaratulas,
  loadClients,
  saveClients,
  loadServices,
  saveServices,
  loadExpenses,
  saveExpenses,
  loadAbonos,
  saveAbonos,
  loadCategories,
  saveCategories,
  loadCalendarEvents,
  saveCalendarEvents,
  loadExpedienteEntries,
  saveExpedienteEntries,
  loadKardexRecords,
  saveKardexRecords,
  loadStaffMembers,
  saveStaffMembers,
  loadSystemUsers,
  saveSystemUsers,
  loadCortes,
  saveCortes,
  loadGuardias,
  saveGuardias,
  loadInventory,
  saveInventory,
  loadIncidencias,
  saveIncidencias,
  loadSolicitudesIncremento,
  saveSolicitudesIncremento,
  loadSucursales,
  saveSucursales,
} from "./utils/storage";
import {
  parseFolioNumber,
  formatFolio,
  getTestCaratulaFolio,
  isTestCaratulaFolio,
  getNextCaratulaFolioNomenclature,
  generateVerificationToken,
} from "./utils/formatters";
import {
  reconcileUnassignedGuardias,
  createTestCaratulaForClient,
  deduplicateClients,
  restoreMissingCaratulasFromEventsAndAbonos,
} from "./utils/dataIntegrity";
import { getStoredUser, logoutUserSession, UserSession } from "./services/auth";
import { UsersManager } from "./components/UsersManager";
import { logAuditEvent } from "./services/auditService";
import { AuditActionType } from "./types";

export default function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("crear");

  // Real-time connection & sync status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  // Real-time Firestore synchronized state (with local cache initial values so data is never blank)
  const [caratulas, setCaratulas] = useState<Caratula[]>(() => loadCaratulas());
  const [clients, setClients] = useState<Client[]>(() => loadClients());
  const [services, setServices] = useState<ServiceItem[]>(() => loadServices());
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [abonos, setAbonos] = useState<AbonoTicket[]>(() => loadAbonos());
  const [categories, setCategories] = useState<ServiceCategory[]>(() => loadCategories());
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => loadCalendarEvents());
  const [expedienteEntries, setExpedienteEntries] = useState<ExpedienteEntry[]>(() => loadExpedienteEntries());
  const [kardexRecords, setKardexRecords] = useState<KardexRecord[]>(() => loadKardexRecords());
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => loadStaffMembers());
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>(() => loadSystemUsers());
  const [cortesHistory, setCortesHistory] = useState<CorteDeCajaRecord[]>(() => loadCortes());
  const [guardiaRecords, setGuardiaRecords] = useState<GuardiaShiftRecord[]>(() => loadGuardias());
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => loadInventory());
  const [incidencias, setIncidencias] = useState<IncidenciaTicket[]>(() => loadIncidencias());
  const [solicitudesIncremento, setSolicitudesIncremento] = useState<SolicitudIncrementoServicio[]>(() => loadSolicitudesIncremento());
  const [sucursales, setSucursales] = useState<Sucursal[]>(() => loadSucursales());
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>("all");

  // Global selected client state for unified navigation across tabs
  const [globalSelectedClientId, setGlobalSelectedClientId] = useState<string>("CLI-001");

  // Set default selected branch based on user session role
  useEffect(() => {
    if (userSession?.role === "admin" && !userSession?.isGeneralAdmin && !userSession?.isSuperAdmin && userSession?.sucursalId) {
      setSelectedSucursalId(userSession.sucursalId);
    }
  }, [userSession]);

  // Keep globalSelectedClientId in sync with available clients
  useEffect(() => {
    if (clients.length > 0) {
      const exists = clients.some(
        (c) => c.id && (c.id || "").toUpperCase() === (globalSelectedClientId || "").toUpperCase()
      );
      if (!exists && clients[0]?.id) {
        setGlobalSelectedClientId(clients[0].id);
      }
    }
  }, [clients]);

  // Guarantee that any caratulas referenced in scheduled shifts or payment receipts are restored
  // and that multiple caratulas for the same client are fully maintained and never discarded.
  useEffect(() => {
    if (calendarEvents.length > 0 || abonos.length > 0) {
      const { restoredCaratulas, restoredCount } = restoreMissingCaratulasFromEventsAndAbonos(
        caratulas,
        calendarEvents,
        abonos,
        clients
      );
      const filtered = restoredCaratulas.filter((c) => !isCaratulaFolioDeleted(c.folio));
      if (restoredCount > 0 && filtered.length > caratulas.length) {
        setCaratulas(filtered);
      }
    }
  }, [calendarEvents.length, abonos.length]);

  // Persist all state changes to local storage immediately to ensure offline persistence and reliable reloads
  useEffect(() => { saveCaratulas(caratulas); }, [caratulas]);
  useEffect(() => { saveClients(clients); }, [clients]);
  useEffect(() => { saveServices(services); }, [services]);
  useEffect(() => { saveExpenses(expenses); }, [expenses]);
  useEffect(() => { saveAbonos(abonos); }, [abonos]);
  useEffect(() => { saveCategories(categories); }, [categories]);
  useEffect(() => { saveCalendarEvents(calendarEvents); }, [calendarEvents]);
  useEffect(() => { saveExpedienteEntries(expedienteEntries); }, [expedienteEntries]);
  useEffect(() => { saveKardexRecords(kardexRecords); }, [kardexRecords]);
  useEffect(() => { saveStaffMembers(staffMembers); }, [staffMembers]);
  useEffect(() => { saveSystemUsers(systemUsers); }, [systemUsers]);
  useEffect(() => { saveCortes(cortesHistory); }, [cortesHistory]);
  useEffect(() => { saveGuardias(guardiaRecords); }, [guardiaRecords]);
  useEffect(() => { saveInventory(inventoryItems); }, [inventoryItems]);
  useEffect(() => { saveIncidencias(incidencias); }, [incidencias]);
  useEffect(() => { saveSolicitudesIncremento(solicitudesIncremento); }, [solicitudesIncremento]);
  useEffect(() => { saveSucursales(sucursales); }, [sucursales]);

  // State for editing a specific carátula
  const [caratulaToEdit, setCaratulaToEdit] = useState<Caratula | null>(null);
  const [urlVerifyFolio, setUrlVerifyFolio] = useState<string | null>(null);
  const [selectedClientForBalance, setSelectedClientForBalance] = useState<string | null>(null);
  const [isQuotaExhaustedState, setIsQuotaExhaustedState] = useState<boolean>(isFirestoreQuotaExhausted());
  const isReconcilingGuardiasRef = useRef<boolean>(false);

  // Compute allocated caratulas dynamically where client payments pool is globally distributed across their carátulas
  const effectiveCaratulas = useMemo(
    () => allocateClientPoolToCaratulas(caratulas, abonos),
    [caratulas, abonos]
  );

  // Branch access control logic:
  // - General admins of Cuidarte México can view all branches or filter by selected branch
  // - Branch admins are strictly restricted to their assigned branch (e.g. Cuidarte Pachuca)
  const isBranchRestrictedAdmin = Boolean(
    userSession?.role === "admin" &&
    !userSession?.isGeneralAdmin &&
    !userSession?.isSuperAdmin &&
    userSession?.sucursalId
  );

  const activeBranchFilter = isBranchRestrictedAdmin
    ? userSession?.sucursalId || "pachuca"
    : selectedSucursalId;

  // Filtered views for administrator tabs according to active branch filter
  const filteredClients = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return clients;
    return clients.filter((c) => (c.sucursalId || "pachuca") === activeBranchFilter);
  }, [clients, activeBranchFilter]);

  const filteredCaratulas = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return effectiveCaratulas;
    return effectiveCaratulas.filter((c) => (c.sucursalId || "pachuca") === activeBranchFilter);
  }, [effectiveCaratulas, activeBranchFilter]);

  const filteredAbonos = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return abonos;
    return abonos.filter((a) => (a.sucursalId || "pachuca") === activeBranchFilter);
  }, [abonos, activeBranchFilter]);

  const filteredExpenses = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return expenses;
    return expenses.filter((e) => (e.sucursalId || "pachuca") === activeBranchFilter);
  }, [expenses, activeBranchFilter]);

  const filteredCalendarEvents = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return calendarEvents;
    return calendarEvents.filter((ev) => {
      const matchCar = caratulas.find((c) => c.folio === ev.caratulaFolio);
      const matchCli = clients.find((c) => c.id === ev.clientId);
      const b = matchCar?.sucursalId || matchCli?.sucursalId || "pachuca";
      return b === activeBranchFilter;
    });
  }, [calendarEvents, caratulas, clients, activeBranchFilter]);

  const filteredExpedienteEntries = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return expedienteEntries;
    return expedienteEntries.filter((e) => {
      const matchCli = clients.find((c) => c.id === e.clientId);
      return (matchCli?.sucursalId || "pachuca") === activeBranchFilter;
    });
  }, [expedienteEntries, clients, activeBranchFilter]);

  const filteredInventoryItems = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return inventoryItems;
    return inventoryItems.filter((i) => {
      const matchCli = clients.find((c) => c.id === i.clientId);
      return (matchCli?.sucursalId || "pachuca") === activeBranchFilter;
    });
  }, [inventoryItems, clients, activeBranchFilter]);

  const filteredGuardiaRecords = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return guardiaRecords;
    return guardiaRecords.filter((g) => {
      const matchCli = clients.find((c) => c.id === g.clientId);
      return (matchCli?.sucursalId || "pachuca") === activeBranchFilter;
    });
  }, [guardiaRecords, clients, activeBranchFilter]);

  const filteredStaffMembers = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return staffMembers;
    return staffMembers.filter((s) => !s.sucursalId || s.sucursalId === activeBranchFilter);
  }, [staffMembers, activeBranchFilter]);

  const filteredSystemUsers = useMemo(() => {
    if (!activeBranchFilter || activeBranchFilter === "all") return systemUsers;
    return systemUsers.filter((u) => {
      if (u.isSuperAdmin || u.isGeneralAdmin) return true;
      return (u.sucursalId || "pachuca") === activeBranchFilter;
    });
  }, [systemUsers, activeBranchFilter]);

  // Listen to quota exhausted events
  useEffect(() => {
    const handleQuotaExhausted = () => {
      setIsQuotaExhaustedState(true);
      setSyncStatus("synced"); // Prevent scary red error since app runs reliably from cache
    };
    window.addEventListener("firestore-quota-exhausted", handleQuotaExhausted);
    return () => {
      window.removeEventListener("firestore-quota-exhausted", handleQuotaExhausted);
    };
  }, []);

  // Check URL query parameters for public verification link (?verify=CP-XXXX or ?v=CP-XXXX)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryFolio = params.get("verify") || params.get("v") || params.get("folio");
      if (queryFolio) {
        setUrlVerifyFolio(queryFolio);
      }
    }
  }, []);

  // Track Online / Offline browser events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
      setSyncErrorMessage(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Force sync from cloud helper
  const handleForceSyncAll = async () => {
    setSyncStatus("saving");
    setSyncErrorMessage(null);
    resetFirestoreQuotaCooldown();
    setIsQuotaExhaustedState(false);
    try {
      const data = await fetchAllCollectionsFromFirestore();
      if (data.caratulas) setCaratulas(data.caratulas);
      if (data.clients) setClients(deduplicateClients(data.clients));
      if (data.services) setServices(data.services);
      if (data.expenses) setExpenses(data.expenses);
      if (data.abonos) setAbonos(data.abonos);
      if (data.categories) setCategories(data.categories);
      if (data.events) setCalendarEvents(data.events);
      if (data.expediente) setExpedienteEntries(data.expediente);
      if (data.kardex) setKardexRecords(data.kardex);
      if (data.staff) setStaffMembers(data.staff);
      if (data.users) setSystemUsers(data.users);
      if (data.cortes) setCortesHistory(data.cortes);
      if (data.guardias) setGuardiaRecords(data.guardias);
      if (data.inventory) setInventoryItems(data.inventory);
      if (data.incidencias) setIncidencias(data.incidencias);
      if (data.solicitudes) setSolicitudesIncremento(data.solicitudes);
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
    } catch (err: any) {
      console.error("[Force Sync Error]", err);
      if (isFirestoreQuotaExhausted()) {
        setIsQuotaExhaustedState(true);
        setSyncStatus("synced");
      } else {
        setSyncStatus("error");
        setSyncErrorMessage(err.message || "Error al sincronizar con la nube.");
      }
    }
  };

  // Wrapper for executing Firestore mutations with reliable status feedback
  const runSyncAction = async (action: () => Promise<void>) => {
    setSyncStatus("saving");
    setSyncErrorMessage(null);
    try {
      await action();
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
    } catch (err: any) {
      console.error("[Sync Error]", err);
      setSyncStatus("error");
      setSyncErrorMessage(err.message || "Error al conectar con la base de datos.");
    }
  };

  // Audit Log Dispatcher
  const triggerAudit = (
    action: AuditActionType,
    descripcion: string,
    details?: Record<string, any>,
    folio?: string,
    clienteId?: string
  ) => {
    try {
      logAuditEvent({
        tipoAccion: action,
        descripcion,
        usuarioUx: userSession?.username || "sistema",
        usuarioNombre: userSession?.nombre || userSession?.username || "Usuario del Sistema",
        rol: userSession?.role || "admin",
        detalles: details || {},
        folioReferencia: folio,
        clienteIdReferencia: clienteId,
      }).catch((e) => console.warn("[AuditLog] Background error:", e));
    } catch {}
  };

  // Initialize session & Firestore real-time listeners across all devices
  useEffect(() => {
    // Initialize session & load user
    const stored = getStoredUser();
    if (stored) {
      setUserSession(stored);
    }

    const handleSnapshotReceived = () => {
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
      setSyncErrorMessage(null);
    };

    // Subscribe to real-time Firestore synchronization (Firestore onSnapshot uses persistent cache and handles real-time updates efficiently)
    const unsubCaratulas = subscribeToCaratulas((data) => {
      setCaratulas(data);
      handleSnapshotReceived();
    });

    const unsubClients = subscribeToClients((data) => {
      setClients(deduplicateClients(data));
      handleSnapshotReceived();
    });

    const unsubServices = subscribeToServices((data) => {
      setServices(data);
      handleSnapshotReceived();
    });

    const unsubExpenses = subscribeToExpenses((data) => {
      setExpenses(data);
      handleSnapshotReceived();
    });

    const unsubAbonos = subscribeToAbonos((data) => {
      setAbonos(data);
      handleSnapshotReceived();
    });

    const unsubCategories = subscribeToCategories((data) => {
      setCategories(data);
      handleSnapshotReceived();
    });

    const unsubEvents = subscribeToCalendarEvents((data) => {
      setCalendarEvents(data);
      handleSnapshotReceived();
    });

    const unsubExpedientes = subscribeToExpedienteEntries((data) => {
      setExpedienteEntries(data);
      handleSnapshotReceived();
    });

    const unsubKardex = subscribeToKardexRecords((data) => {
      setKardexRecords(data);
      handleSnapshotReceived();
    });

    const unsubStaff = subscribeToStaffMembers((data) => {
      setStaffMembers(data);
      handleSnapshotReceived();
    });

    const unsubUsers = subscribeToSystemUsers((data) => {
      setSystemUsers(data);
      handleSnapshotReceived();
    });

    const unsubCortes = subscribeToCortes((data) => {
      setCortesHistory(data);
      handleSnapshotReceived();
    });

    const unsubGuardias = subscribeToGuardias((data) => {
      setGuardiaRecords(data);
      handleSnapshotReceived();
    });

    const unsubInventory = subscribeToInventory((data) => {
      setInventoryItems(data);
      handleSnapshotReceived();
    });

    const unsubIncidencias = subscribeToIncidencias((data) => {
      setIncidencias(data);
      handleSnapshotReceived();
    });

    const unsubSolicitudesIncremento = subscribeToSolicitudesIncremento((data) => {
      setSolicitudesIncremento(data);
      handleSnapshotReceived();
    });

    const unsubSucursales = subscribeToSucursales((data) => {
      setSucursales(data);
      handleSnapshotReceived();
    });

    // Automatic initial cloud fetch to align all collections from Firestore without requiring manual sync
    fetchAllCollectionsFromFirestore()
      .then((data) => {
        if (data.caratulas && data.caratulas.length > 0) setCaratulas(data.caratulas);
        if (data.clients && data.clients.length > 0) setClients(deduplicateClients(data.clients));
        if (data.services && data.services.length > 0) setServices(data.services);
        if (data.expenses && data.expenses.length > 0) setExpenses(data.expenses);
        if (data.abonos && data.abonos.length > 0) setAbonos(data.abonos);
        if (data.categories && data.categories.length > 0) setCategories(data.categories);
        if (data.events && data.events.length > 0) setCalendarEvents(data.events);
        if (data.expediente && data.expediente.length > 0) setExpedienteEntries(data.expediente);
        if (data.kardex && data.kardex.length > 0) setKardexRecords(data.kardex);
        if (data.staff && data.staff.length > 0) setStaffMembers(data.staff);
        if (data.users && data.users.length > 0) setSystemUsers(data.users);
        if (data.cortes && data.cortes.length > 0) setCortesHistory(data.cortes);
        if (data.guardias && data.guardias.length > 0) setGuardiaRecords(data.guardias);
        if (data.inventory && data.inventory.length > 0) setInventoryItems(data.inventory);
        if (data.incidencias && data.incidencias.length > 0) setIncidencias(data.incidencias);
        if (data.solicitudes && data.solicitudes.length > 0) setSolicitudesIncremento(data.solicitudes);
        if ((data as any).sucursales && (data as any).sucursales.length > 0) setSucursales((data as any).sucursales);
        handleSnapshotReceived();
      })
      .catch((err) => {
        console.warn("[Initial Mount Fetch Notice]", err?.message || err);
      });

    // Auto-sync local documents cache to cloud if pending
    const syncDocsTimer = setTimeout(() => {
      syncAllLocalDocumentsToCloud().catch(() => {});
    }, 2500);

    return () => {
      clearTimeout(syncDocsTimer);
      unsubCaratulas();
      unsubClients();
      unsubServices();
      unsubExpenses();
      unsubAbonos();
      unsubCategories();
      unsubEvents();
      unsubExpedientes();
      unsubKardex();
      unsubStaff();
      unsubUsers();
      unsubCortes();
      unsubGuardias();
      unsubInventory();
      unsubIncidencias();
      unsubSolicitudesIncremento();
      unsubSucursales();
    };

  }, []);

  // Online Presence Tracking (Direct single ping on login / clean unload)
  useEffect(() => {
    if (!userSession || isFirestoreQuotaExhausted()) return;

    // Send single "online" ping on session start
    updateUserOnlineStatusInFirestore(userSession.username, true, {
      nombre: userSession.nombre,
      role: userSession.role,
      nurseId: userSession.nurseId,
      clientId: userSession.clientId,
    }).catch(() => {});

    const handleBeforeUnload = () => {
      if (isFirestoreQuotaExhausted()) return;
      updateUserOnlineStatusInFirestore(userSession.username, false, {
        nombre: userSession.nombre,
        role: userSession.role,
        nurseId: userSession.nurseId,
        clientId: userSession.clientId,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [userSession?.username]);

  // Real-time listener for remote session revocation by admin across system users, staff and clients
  useEffect(() => {
    if (!userSession) return;

    const un = (userSession.username || "").toLowerCase().trim();
    const nid = (userSession.nurseId || "").toLowerCase().trim();
    const cid = (userSession.clientId || "").toLowerCase().trim();
    const cleanNoSocio = nid.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
    const loggedInTime = userSession.loggedInAt ? new Date(userSession.loggedInAt).getTime() : 0;

    let revokedTime = 0;

    // 1. Check in systemUsers
    const myUserDoc = systemUsers.find((u) => {
      const uUx = (u.ux || "").toLowerCase().trim();
      const uId = (u.id || "").toLowerCase().trim();
      const uNurse = (u.nurseId || "").toLowerCase().trim();
      const uClient = (u.clientId || "").toLowerCase().trim();

      return (
        uUx === un ||
        uId === un ||
        (nid && uNurse === nid) ||
        (cid && uClient === cid) ||
        (cleanNoSocio && cleanNoSocio.length >= 2 && uNurse.includes(cleanNoSocio))
      );
    });

    if (myUserDoc?.sesionRevocadaAt) {
      revokedTime = Math.max(revokedTime, new Date(myUserDoc.sesionRevocadaAt).getTime());
    }

    // 2. Check in staffMembers
    const myStaffDoc = staffMembers.find((s) => {
      const sId = (s.id || "").toLowerCase().trim();
      const sNo = (s.noSocio || "").toLowerCase().trim();
      const sNoClean = sNo.replace(/^socp-/i, "").replace(/^soc-/i, "").replace(/^emp-/i, "");
      return (
        (nid && (sId === nid || sNo === nid || sNoClean === nid)) ||
        (un && (sId === un || sNo === un || sNoClean === un)) ||
        (cleanNoSocio && cleanNoSocio.length >= 2 && (sNoClean === cleanNoSocio || sId.includes(cleanNoSocio)))
      );
    });

    if (myStaffDoc?.sesionRevocadaAt) {
      revokedTime = Math.max(revokedTime, new Date(myStaffDoc.sesionRevocadaAt).getTime());
    }

    // 3. Check in clients
    const myClientDoc = clients.find((c) => {
      const cId = (c.id || "").toLowerCase().trim();
      const cIdClean = cId.replace(/^cli-/i, "").replace(/^c-/i, "");
      return (
        (cid && (cId === cid || cIdClean === cid)) ||
        (un && (cId === un || cIdClean === un))
      );
    });

    if (myClientDoc?.sesionRevocadaAt) {
      revokedTime = Math.max(revokedTime, new Date(myClientDoc.sesionRevocadaAt).getTime());
    }

    if (revokedTime > 0 && revokedTime >= loggedInTime - 10000) {
      alert("⚠️ Tu sesión ha sido cerrada remotamente por la Administración de Cuidarte.");
      logoutUserSession();
      setUserSession(null);
    }
  }, [systemUsers, staffMembers, clients, userSession]);

  // Registro en auditoría de operaciones al ingresar a cualquier portal
  const loggedPortalEntryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userSession) {
      loggedPortalEntryRef.current = null;
      return;
    }

    const sessionKey = `${userSession.username}_${userSession.role}`;
    if (loggedPortalEntryRef.current !== sessionKey) {
      loggedPortalEntryRef.current = sessionKey;

      const portalNames: Record<UserRole, string> = {
        admin: "Panel de Administración Central",
        nurse: "Portal de Enfermería y Personal Operativo",
        client: "Portal del Cliente y Familiares",
        ventas: "Portal Comercial y Cotizaciones",
        atencion_clientes: "Portal de Atención a Clientes e Incidencias",
      };
      const portalName = portalNames[userSession.role] || "Portal del Sistema";

      logAuditEvent({
        tipoAccion: "INGRESO_PORTAL",
        descripcion: `Ingreso al ${portalName}: @${userSession.username} (${userSession.nombre || userSession.username})`,
        usuarioUx: userSession.username,
        usuarioNombre: userSession.nombre || userSession.username,
        rol: userSession.role,
        detalles: {
          rol: userSession.role,
          portal: portalName,
          nurseId: userSession.nurseId,
          clientId: userSession.clientId,
          timestamp: new Date().toISOString(),
        },
      }).catch((e) => console.warn("[Audit] Error al registrar ingreso a portal:", e));
    }
  }, [userSession]);

  // ASIGNACIÓN FORZOSA DE GUARDIAS A CARÁTULA:
  // "La guardias deben estar asignadas forzosamente a una caratula, en caso que
  // las guardias anteriores no esten asignadas a una caratula asignalas a una
  // caratula de prueba que sea el numero de cliente + 01"
  useEffect(() => {
    if (!calendarEvents || calendarEvents.length === 0 || !clients || clients.length === 0) return;
    if (isReconcilingGuardiasRef.current) return;

    const hasUnassigned = calendarEvents.some((ev) => {
      if (!ev.caratulaFolio || ev.caratulaFolio.trim() === "") return true;
      const clean = ev.caratulaFolio.trim().toLowerCase();
      return clean === "sin asociar" || clean === "sin caratula" || clean === "sin carátula";
    });

    if (!hasUnassigned) return;

    const { updatedEvents, updatedCaratulas, unassignedFound, newTestCaratulasCreated } =
      reconcileUnassignedGuardias(calendarEvents, clients, caratulas);

    if (unassignedFound > 0) {
      isReconcilingGuardiasRef.current = true;
      console.log(
        `[Carátula Enforcement] Reconciliando ${unassignedFound} guardias anteriores sin carátula a carátulas de prueba...`
      );
      setCalendarEvents(updatedEvents);
      setCaratulas(updatedCaratulas);

      runSyncAction(async () => {
        try {
          // Persistir eventos actualizados a Firestore
          for (const ev of updatedEvents) {
            const original = calendarEvents.find((e) => e.id === ev.id);
            const wasUnassigned =
              !original?.caratulaFolio ||
              original.caratulaFolio.trim() === "" ||
              original.caratulaFolio.toLowerCase() === "sin asociar";
            if (wasUnassigned) {
              await saveCalendarEventToFirestore(ev);
            }
          }
          // Persistir carátulas de prueba creadas a Firestore
          for (const tf of newTestCaratulasCreated) {
            const car = updatedCaratulas.find((c) => c.folio === tf);
            if (car) {
              await saveCaratulaToFirestore(car);
            }
          }
          triggerAudit(
            "MODIFICAR_CARATULA",
            `Asignación forzosa de ${unassignedFound} guardias anteriores a carátula de prueba (${newTestCaratulasCreated.join(", ") || "Cliente+01"})`,
            {
              unassignedFound,
              caratulasCreadas: newTestCaratulasCreated,
            }
          );
        } finally {
          isReconcilingGuardiasRef.current = false;
        }
      });
    }
  }, [calendarEvents, clients, caratulas]);

  const handleLogout = () => {
    const currentSession = userSession;
    if (currentSession) {
      logAuditEvent({
        tipoAccion: "LOGOUT",
        descripcion: `Cierre de sesión de usuario: ${currentSession.username} (${currentSession.nombre || currentSession.role})`,
        usuarioUx: currentSession.username,
        usuarioNombre: currentSession.nombre || currentSession.username,
        rol: currentSession.role,
        detalles: { role: currentSession.role, ux: currentSession.username },
      }).catch((e) => console.warn("[Audit] Logout log error:", e));
    }

    // 1. Immediately reset session in state and storage so the view exits to LoginScreen with 0 delay
    logoutUserSession();
    setUserSession(null);

    // 2. Asynchronously update Firestore user offline status in background
    if (currentSession) {
      updateUserOnlineStatusInFirestore(currentSession.username, false, {
        nombre: currentSession.nombre,
        role: currentSession.role,
        nurseId: currentSession.nurseId,
        clientId: currentSession.clientId,
      }).catch((err) => {
        console.warn("[Firestore] Logout offline update notice:", err);
      });
    }
  };

  // If visiting a public verification URL (?verify=CP-XXXX or ?v=CP-XXXX)
  if (urlVerifyFolio) {
    return (
      <CaratulaVerificationPortal
        folio={urlVerifyFolio}
        caratulas={effectiveCaratulas}
        staffMembers={staffMembers}
        abonos={abonos}
        onBack={() => {
          if (typeof window !== "undefined") {
            window.history.pushState({}, "", window.location.pathname);
          }
          setUrlVerifyFolio(null);
        }}
      />
    );
  }

  if (!userSession) {
    return <LoginScreen onLoginSuccess={setUserSession} />;
  }

  // Save Handlers with Firestore persistence & immediate optimistic UI updates
  const handleSaveCaratula = async (caratula: Caratula) => {
    const isNew = !caratulas.some((c) => c.folio === caratula.folio);
    const isCot = caratula.tipoDocumento === 'Cotización' || caratula.folio?.startsWith("CPCOT");

    // Convert caratula guardias to CalendarEvent objects with guaranteed sequential folios
    let eventsForCaratula: CalendarEvent[] = [];
    let updatedGuardias = caratula.guardiasProgramadas;
    if (Array.isArray(caratula.guardiasProgramadas) && caratula.guardiasProgramadas.length > 0) {
      let maxIdx = getMaxGuardiaIndex(calendarEvents);
      const deduplicatedGuardias = deduplicateShiftsList(caratula.guardiasProgramadas);

      updatedGuardias = deduplicatedGuardias.map((shift) => {
        let finalFolio = shift.folioGuardia;
        if (!finalFolio || !isValidGuardiaFolio(finalFolio)) {
          maxIdx = Math.max(maxIdx + 1, STARTING_GUARDIA_SERIAL_INDEX);
          finalFolio = formatGuardiaFolio(maxIdx);
        }
        return {
          ...shift,
          id: shift.id || finalFolio,
          folioGuardia: finalFolio,
          caratulaFolio: caratula.folio,
        };
      });

      eventsForCaratula = updatedGuardias.map((shift) => {
        const finalFolio = shift.folioGuardia!;
        return {
          id: finalFolio,
          folioGuardia: finalFolio,
          clientId: caratula.id,
          clientNombre: caratula.nombreCompletoCliente,
          caratulaFolio: caratula.folio,
          titulo: `Guardia ${shift.tipoServicio || "Enfermería"} (${finalFolio})`,
          fechaInicio: `${shift.fecha}T${shift.horaInicio}`,
          fechaFin: `${shift.fechaFinCalculada || shift.fecha}T${shift.horaFin}`,
          personalAsignado: shift.personalAsignado || "Por asignar",
          staffId: shift.staffId || "",
          staffNoSocio: shift.staffNoSocio || "",
          staffFoto: shift.staffFoto || "",
          tipoServicio: shift.tipoServicio || caratula.servicios[0]?.servicio || "Enfermería General",
          costoHonorarios: shift.costoHonorarios,
          honorarioPagado: Boolean(shift.honorarioPagado),
          pagoHonorarioId: shift.pagoHonorarioId,
          fechaPagoHonorario: shift.fechaPagoHonorario,
          montoPagadoHonorario: shift.montoPagadoHonorario,
          estado: "Programado",
          notas: `Guardia folio ${finalFolio} agendada desde Carátula ${caratula.folio}. Paciente: ${caratula.nombreCompletoRS || caratula.nombreCompletoCliente}.`,
          timestamp: new Date().toISOString(),
          registradoPor: userSession?.nombre || userSession?.username || "Sistema Carátulas",
        };
      });
    } else {
      // Guard against wiping out existing calendar events if caratula was saved without guardiasProgramadas
      const existingEventsForCaratula = calendarEvents.filter(
        (e) => e.caratulaFolio === caratula.folio || (e.id && e.id.includes(caratula.folio))
      );
      if (existingEventsForCaratula.length > 0) {
        eventsForCaratula = existingEventsForCaratula;
        if (!updatedGuardias || updatedGuardias.length === 0) {
          updatedGuardias = existingEventsForCaratula.map((e) => ({
            id: e.id,
            folioGuardia: e.folioGuardia || e.id,
            caratulaFolio: caratula.folio,
            fecha: e.fechaInicio ? e.fechaInicio.split("T")[0] : "",
            horaInicio: e.fechaInicio ? e.fechaInicio.split("T")[1]?.slice(0, 5) : "",
            horaFin: e.fechaFin ? e.fechaFin.split("T")[1]?.slice(0, 5) : "",
            fechaFinCalculada: e.fechaFin ? e.fechaFin.split("T")[0] : "",
            tipoServicio: e.tipoServicio || "Enfermería General",
            personalAsignado: e.personalAsignado || "Por asignar",
            staffId: e.staffId || "",
            staffNoSocio: e.staffNoSocio || "",
            staffFoto: e.staffFoto || "",
            costoHonorarios: e.costoHonorarios,
            honorarioPagado: Boolean(e.honorarioPagado),
            pagoHonorarioId: e.pagoHonorarioId,
            fechaPagoHonorario: e.fechaPagoHonorario,
            montoPagadoHonorario: e.montoPagadoHonorario,
          }));
        }
      }
    }

    const isCancelled = caratula.estado === "Cancelado";

    // If caratula is cancelled, ensure all shifts and calendar events are marked Cancelado
    if (isCancelled) {
      if (updatedGuardias && updatedGuardias.length > 0) {
        updatedGuardias = updatedGuardias.map((g) => ({ ...g, estado: "Cancelado" as const }));
      }
      eventsForCaratula = eventsForCaratula.map((e) => ({ ...e, estado: "Cancelado" as const }));
    } else if (caratula.estado === "Activo") {
      // If reactivating or active, ensure non-completed shifts are Programado
      eventsForCaratula = eventsForCaratula.map((e) =>
        e.estado === "Cancelado" ? { ...e, estado: "Programado" as const } : e
      );
      if (updatedGuardias && updatedGuardias.length > 0) {
        updatedGuardias = updatedGuardias.map((g) =>
          g.estado === "Cancelado" ? { ...g, estado: "Programado" as const } : g
        );
      }
    }

    const assignedSucursalId =
      caratula.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const assignedSucursalNombre =
      caratula.sucursalNombre ||
      sucursales.find((s) => s.id === assignedSucursalId)?.nombre ||
      "Cuidarte Pachuca";

    const caratulaToPersist: Caratula = {
      ...caratula,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
      guardiasProgramadas: updatedGuardias,
    };

    unmarkCaratulaFolioDeleted(caratulaToPersist.folio);

    let currentAbonosList = abonos;
    // Only for BRAND NEW carátulas with an upfront payment entered at creation.
    // Existing carátulas already have their payments tracked and allocated via client balance pool.
    if (isNew && !isCot && (caratula.pagado || 0) > 0) {
      const clientBal = calculateClientBalance(caratula.nombreCompletoCliente, caratulas, abonos);
      const uncoveredAmount = Math.max(0, (caratula.pagado || 0) - (clientBal.saldoAFavorTotal || 0));
      if (uncoveredAmount > 0) {
        const now = new Date();
        const autoTicket: AbonoTicket = {
          id: `TKT-${caratula.folio}-${now.getTime().toString().slice(-4)}`,
          caratulaFolio: caratula.folio,
          clienteNombre: caratula.nombreCompletoCliente,
          receptorNombre: caratula.nombreCompletoRS || caratula.nombreCompletoCliente,
          montoAbonado: uncoveredAmount,
          totalCaratula: caratula.total || 0,
          pagadoAnterior: 0,
          pagadoNuevoTotal: uncoveredAmount,
          pendienteRestante: Math.max(0, (caratula.total || 0) - uncoveredAmount),
          metodoPago: "Transferencia",
          referencia: "Pago inicial en carátula",
          sucursalId: assignedSucursalId,
          sucursalNombre: assignedSucursalNombre,
          fecha: now.toLocaleDateString("es-MX", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          atendidoPor: userSession?.nombre || userSession?.username || "Administración",
        };
        currentAbonosList = [autoTicket, ...abonos.filter((a) => a.id !== autoTicket.id)];
        setAbonos(currentAbonosList);
        saveAbonoToFirestore(autoTicket).catch((err) => console.warn("[Abono] Error saving auto ticket:", err));
      }
    }

    // Immediately update in-memory state with complete reallocated list across all clients
    const updatedCaratulasBase = [
      ...caratulas.filter((c) => c.folio !== caratulaToPersist.folio),
      caratulaToPersist,
    ];
    const reallocatedCaratulas = allocateClientPoolToCaratulas(updatedCaratulasBase, currentAbonosList);
    setCaratulas(reallocatedCaratulas);
    setCaratulaToEdit(null);

    // Atomically synchronize calendarEvents state
    setCalendarEvents((prev) => {
      const unaffected = prev.filter(
        (e) => e.caratulaFolio !== caratulaToPersist.folio && !(e.id && e.id.includes(caratulaToPersist.folio))
      );
      return [...unaffected, ...eventsForCaratula].sort((a, b) => (a.fechaInicio || "").localeCompare(b.fechaInicio || ""));
    });

    await runSyncAction(async () => {
      await saveCaratulaToFirestore(caratulaToPersist);
      await syncCaratulaCalendarEventsInFirestore(caratulaToPersist.folio, eventsForCaratula);
      await syncAllCaratulasWithClientPools(reallocatedCaratulas, currentAbonosList, saveCaratulaToFirestore);
      triggerAudit(
        isCancelled
          ? (isCot ? "CANCELAR_COTIZACION" : "CANCELAR_CARATULA")
          : isCot
          ? (isNew ? "CREAR_COTIZACION" : "MODIFICAR_COTIZACION")
          : (isNew ? "CREAR_CARATULA" : "MODIFICAR_CARATULA"),
        `${isCancelled ? "Cancelación" : isCot ? "Cotización" : "Carátula"} ${caratulaToPersist.folio} guardada para ${caratulaToPersist.nombreCompletoCliente} (${eventsForCaratula.length} guardias sincronizadas)`,
        { folio: caratulaToPersist.folio, total: caratulaToPersist.total, cliente: caratulaToPersist.nombreCompletoCliente, guardias: eventsForCaratula.length, estado: caratulaToPersist.estado },
        caratulaToPersist.folio,
        caratulaToPersist.id
      );
    });
  };

  const handleDeleteCaratula = async (folio: string) => {
    if (!folio) return;
    const normFolio = (folio || "").trim().toLowerCase();
    const target = caratulas.find((c) => (c.folio || "").trim().toLowerCase() === normFolio);
    const isCot = target?.tipoDocumento === 'Cotización' || folio?.toUpperCase().startsWith("CPCOT");

    // Mark as deleted in tombstone storage immediately
    markCaratulaFolioDeleted(folio);

    // Filter remaining carátulas
    const remainingCaratulas = caratulas.filter(
      (c) =>
        (c.folio || "").trim().toLowerCase() !== normFolio &&
        !isCaratulaFolioDeleted(c.folio)
    );

    // Clean up abonos: remove auto tickets, disassociate others
    const remainingAbonos = abonos
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

    setAbonos(remainingAbonos);
    saveAbonos(remainingAbonos);

    // Clean up calendar events
    setCalendarEvents((prev) =>
      prev.filter(
        (e) =>
          (e.caratulaFolio || "").trim().toLowerCase() !== normFolio &&
          !(e.id && e.id.toLowerCase().includes(normFolio))
      )
    );

    // Reallocate funds across remaining carátulas
    const reallocatedRemaining = allocateClientPoolToCaratulas(remainingCaratulas, remainingAbonos);
    setCaratulas(reallocatedRemaining);
    saveCaratulas(reallocatedRemaining);

    await runSyncAction(async () => {
      await deleteCaratulaFromFirestore(folio);
      await syncAllCaratulasWithClientPools(reallocatedRemaining, remainingAbonos, saveCaratulaToFirestore);
      triggerAudit(
        isCot ? "CANCELAR_COTIZACION" : "CANCELAR_CARATULA",
        `${isCot ? "Cotización" : "Carátula"} ${folio} eliminada definitivamente de la base de datos y agenda liberada`,
        { folio, cliente: target?.nombreCompletoCliente },
        folio,
        target?.id
      );
    });
  };

  const handleUpdateCaratulaPayment = async (folio: string, nuevoPagado: number) => {
    const target = caratulas.find((c) => c.folio === folio);
    if (!target) return;

    const tot = target.total || 0;
    const pend = Math.max(0, tot - nuevoPagado);
    const updated: Caratula = {
      ...target,
      pagado: nuevoPagado,
      pendiente: pend,
    };

    const updatedList = caratulas.map((c) => (c.folio === folio ? updated : c));
    const reallocated = allocateClientPoolToCaratulas(updatedList, abonos);
    setCaratulas(reallocated);

    await runSyncAction(async () => {
      await saveCaratulaToFirestore(updated);
      await syncAllCaratulasWithClientPools(reallocated, abonos, saveCaratulaToFirestore);
      triggerAudit(
        "REGISTRAR_ABONO",
        `Actualización de pago de carátula ${folio}: Nuevo pagado $${nuevoPagado.toLocaleString()}, Pendiente: $${pend.toLocaleString()}`,
        { folio, nuevoPagado, pendiente: pend },
        folio,
        target.id
      );
    });
  };

  const handleDuplicateCaratula = (caratula: Caratula) => {
    const targetBranchId =
      caratula.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const targetBranchObj = sucursales.find((s) => s.id === targetBranchId);
    const targetBranchNombre = caratula.sucursalNombre || targetBranchObj?.nombre || "Cuidarte Pachuca";
    const newFolio = getNextCaratulaFolioNomenclature({
      sucursal: targetBranchObj,
      sucursalNombre: targetBranchNombre,
      caratulas,
      tipoDocumento: caratula.tipoDocumento,
    });

    const duplicated: Caratula = {
      ...caratula,
      folio: newFolio,
      timestamp: new Date().toLocaleString(),
      pagado: 0,
      pendiente: caratula.total,
      sucursalId: targetBranchId,
      sucursalNombre: targetBranchNombre,
      verificationToken: generateVerificationToken(),
    };

    setCaratulaToEdit(duplicated);
    setActiveTab("crear");
  };

  const handleSaveClient = async (client: Client) => {
    const isNew = !clients.some((c) => c.id === client.id);
    const assignedSucursalId = isBranchRestrictedAdmin
      ? userSession?.sucursalId || "pachuca"
      : client.sucursalId || (selectedSucursalId !== "all" ? selectedSucursalId : "pachuca");
    const assignedSucursalNombre = isBranchRestrictedAdmin
      ? userSession?.sucursalNombre || "Cuidarte Pachuca"
      : client.sucursalNombre || sucursales.find((s) => s.id === assignedSucursalId)?.nombre || "Cuidarte Pachuca";

    const normalizedClient: Client = {
      ...client,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
    };

    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === normalizedClient.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedClient;
        return deduplicateClients(next);
      }
      return deduplicateClients([normalizedClient, ...prev]).sort((a, b) => a.nombreCompletoCliente.localeCompare(b.nombreCompletoCliente));
    });
    await runSyncAction(async () => {
      await saveClientToFirestore(normalizedClient);
      triggerAudit(
        isNew ? "CREAR_CLIENTE" : "MODIFICAR_CLIENTE",
        `Cliente ${normalizedClient.id} (${normalizedClient.nombreCompletoCliente} - ${assignedSucursalNombre}) ${isNew ? "creado" : "actualizado"}`,
        { id: normalizedClient.id, nombre: normalizedClient.nombreCompletoCliente, telefono: normalizedClient.numeroContacto, sucursal: assignedSucursalNombre },
        undefined,
        normalizedClient.id
      );
    });
  };

  const handleSaveSucursal = async (sucursal: Sucursal) => {
    setSucursales((prev) => {
      const idx = prev.findIndex((s) => s.id === sucursal.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = sucursal;
        return next;
      }
      return [...prev, sucursal];
    });
    await runSyncAction(async () => {
      await saveSucursalToFirestore(sucursal);
      triggerAudit(
        "MODIFICAR_SUCURSAL",
        `Sucursal ${sucursal.nombre} (${sucursal.ciudad}) guardada/actualizada`,
        { id: sucursal.id, admin: sucursal.administradorNombre, ciudad: sucursal.ciudad }
      );
    });
  };

  const handleDeleteSucursal = async (id: string) => {
    if (id === "pachuca") {
      alert("No se puede eliminar la sucursal matriz regional de Pachuca.");
      return;
    }
    setSucursales((prev) => prev.filter((s) => s.id !== id));
    await runSyncAction(async () => {
      await deleteSucursalFromFirestore(id);
      triggerAudit(
        "ELIMINAR_SUCURSAL",
        `Sucursal ${id} eliminada del sistema`,
        { id }
      );
    });
  };

  const handleBatchSaveClients = async (newClients: Client[]) => {
    setClients((prev) => {
      const copy = [...prev];
      for (const client of newClients) {
        const idx = copy.findIndex((c) => c.id === client.id);
        if (idx >= 0) copy[idx] = client;
        else copy.push(client);
      }
      return deduplicateClients(copy).sort((a, b) => a.nombreCompletoCliente.localeCompare(b.nombreCompletoCliente));
    });
    await runSyncAction(async () => {
      for (const client of newClients) {
        await saveClientToFirestore(client);
      }
      triggerAudit(
        "CREAR_CLIENTE",
        `Carga masiva de ${newClients.length} clientes realizada`,
        { count: newClients.length }
      );
    });
  };

  const handleDeleteClient = async (id: string) => {
    const target = clients.find((c) => c.id === id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    await runSyncAction(async () => {
      await deleteClientFromFirestore(id);
      triggerAudit(
        "ELIMINAR_CLIENTE",
        `Cliente ${id} (${target?.nombreCompletoCliente || ""}) eliminado`,
        { id, nombre: target?.nombreCompletoCliente },
        undefined,
        id
      );
    });
  };

  const handleSaveService = async (service: ServiceItem) => {
    setServices((prev) => {
      const idx = prev.findIndex((s) => s.id === service.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = service;
        return next;
      }
      return [...prev, service].sort((a, b) => a.nombreServicio.localeCompare(b.nombreServicio));
    });
    await runSyncAction(async () => {
      await saveServiceToFirestore(service);
      triggerAudit(
        "MODIFICAR_CARATULA",
        `Catálogo de Servicio ${service.nombreServicio} ($${service.precio}) actualizado`,
        { id: service.id, nombre: service.nombreServicio, precio: service.precio, costo: service.costo }
      );
    });
  };

  const handleBatchSaveServices = async (newServices: ServiceItem[]) => {
    setServices((prev) => {
      const copy = [...prev];
      for (const service of newServices) {
        const idx = copy.findIndex((s) => s.id === service.id);
        if (idx >= 0) copy[idx] = service;
        else copy.push(service);
      }
      return copy.sort((a, b) => a.nombreServicio.localeCompare(b.nombreServicio));
    });
    await runSyncAction(async () => {
      for (const service of newServices) {
        await saveServiceToFirestore(service);
      }
      triggerAudit(
        "IMPORTACION_MASIVA",
        `Carga/actualización masiva de ${newServices.length} servicios en catálogo`,
        { count: newServices.length }
      );
    });
  };

  const handleDeleteService = async (id: string) => {
    const target = services.find((s) => s.id === id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    await runSyncAction(async () => {
      await deleteServiceFromFirestore(id);
      triggerAudit(
        "MODIFICAR_CARATULA",
        `Servicio ${target?.nombreServicio || id} eliminado del catálogo`,
        { id, nombre: target?.nombreServicio }
      );
    });
  };

  const handleSaveExpense = async (expense: Expense) => {
    const isHonorario = expense.categoria === "Honorarios Enfermería";
    const matchingCar = expense.caratulaFolio ? caratulas.find((c) => c.folio === expense.caratulaFolio) : null;
    const assignedSucursalId =
      expense.sucursalId ||
      matchingCar?.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const assignedSucursalNombre =
      expense.sucursalNombre ||
      matchingCar?.sucursalNombre ||
      sucursales.find((s) => s.id === assignedSucursalId)?.nombre ||
      "Cuidarte Pachuca";

    const normalizedExpense: Expense = {
      ...expense,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
    };

    setExpenses((prev) => {
      const idx = prev.findIndex((e) => e.id === normalizedExpense.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedExpense;
        return next;
      }
      return [normalizedExpense, ...prev];
    });
    await runSyncAction(async () => {
      await saveExpenseToFirestore(normalizedExpense);
      triggerAudit(
        isHonorario ? "PAGO_HONORARIOS_PERSONAL" : "REGISTRAR_GASTO",
        `${isHonorario ? "Pago de honorarios" : "Gasto registrado"}: ${normalizedExpense.concepto} ($${normalizedExpense.monto?.toLocaleString()})`,
        { id: normalizedExpense.id, monto: normalizedExpense.monto, categoria: normalizedExpense.categoria, caratulaFolio: normalizedExpense.caratulaFolio },
        normalizedExpense.caratulaFolio
      );
    });
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await runSyncAction(async () => {
      await deleteExpenseFromFirestore(id);
      triggerAudit(
        "CANCELAR_GASTO",
        `Gasto cancelado/eliminado: ${target?.descripcion || id} ($${target?.monto || 0})`,
        { id, monto: target?.monto }
      );
    });
  };

  const handleSaveAbono = async (abono: AbonoTicket) => {
    const matchingCar = abono.caratulaFolio ? caratulas.find((c) => c.folio === abono.caratulaFolio) : null;
    const matchingCli = abono.clienteNombre ? clients.find((c) => c.nombreCompletoCliente?.toLowerCase() === abono.clienteNombre?.toLowerCase()) : null;
    const assignedSucursalId =
      abono.sucursalId ||
      matchingCar?.sucursalId ||
      matchingCli?.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const assignedSucursalNombre =
      abono.sucursalNombre ||
      matchingCar?.sucursalNombre ||
      matchingCli?.sucursalNombre ||
      sucursales.find((s) => s.id === assignedSucursalId)?.nombre ||
      "Cuidarte Pachuca";

    const normalizedAbono: AbonoTicket = {
      ...abono,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
    };

    setAbonos((prev) => {
      const idx = prev.findIndex((a) => a.id === normalizedAbono.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedAbono;
        return next;
      }
      return [normalizedAbono, ...prev];
    });
    await runSyncAction(async () => {
      await saveAbonoToFirestore(normalizedAbono);
      const updatedAbonos = [...abonos.filter((a) => a.id !== normalizedAbono.id), normalizedAbono];
      await syncAllCaratulasWithClientPools(caratulas, updatedAbonos, saveCaratulaToFirestore);
      triggerAudit(
        "REGISTRAR_ABONO",
        `Abono de $${normalizedAbono.montoAbonado?.toLocaleString()} registrado a ${normalizedAbono.caratulaFolio} (${normalizedAbono.clienteNombre}) via ${normalizedAbono.metodoPago}`,
        { id: normalizedAbono.id, monto: normalizedAbono.montoAbonado, metodo: normalizedAbono.metodoPago, folio: normalizedAbono.caratulaFolio },
        normalizedAbono.caratulaFolio
      );
    });
  };

  const handleCancelAbono = async (abono: AbonoTicket, motivo: string) => {
    const updatedAbono: AbonoTicket = {
      ...abono,
      estado: "Cancelado",
      motivoCancelacion: motivo,
      fechaCancelacion: new Date().toLocaleString(),
      canceladoPor: userSession?.username || "Administración",
    };
    setAbonos((prev) => prev.map((a) => (a.id === abono.id ? updatedAbono : a)));
    await runSyncAction(async () => {
      await saveAbonoToFirestore(updatedAbono);
      const updatedAbonos = abonos.map((a) => (a.id === abono.id ? updatedAbono : a));
      await syncAllCaratulasWithClientPools(caratulas, updatedAbonos, saveCaratulaToFirestore);
      triggerAudit(
        "CANCELAR_ABONO",
        `Ticket de abono ${abono.id} cancelado (${abono.caratulaFolio}). Motivo: ${motivo}`,
        { id: abono.id, motivo, folio: abono.caratulaFolio },
        abono.caratulaFolio
      );
    });
  };

  const handleReactivateAbono = async (abono: AbonoTicket) => {
    const updatedAbono: AbonoTicket = {
      ...abono,
      estado: "Activo",
      motivoCancelacion: undefined,
      fechaCancelacion: undefined,
      canceladoPor: undefined,
    };
    setAbonos((prev) => prev.map((a) => (a.id === abono.id ? updatedAbono : a)));
    await runSyncAction(async () => {
      await saveAbonoToFirestore(updatedAbono);
      const updatedAbonos = abonos.map((a) => (a.id === abono.id ? updatedAbono : a));
      await syncAllCaratulasWithClientPools(caratulas, updatedAbonos, saveCaratulaToFirestore);
      triggerAudit(
        "REGISTRAR_ABONO",
        `Ticket de abono ${abono.id} reactivado para ${abono.caratulaFolio}`,
        { id: abono.id, folio: abono.caratulaFolio },
        abono.caratulaFolio
      );
    });
  };

  const handleDeleteAbono = async (id: string, caratulaFolio: string) => {
    const target = abonos.find((a) => a.id === id);
    setAbonos((prev) => prev.filter((a) => a.id !== id));
    await runSyncAction(async () => {
      await deleteAbonoFromFirestore(id);
      const updatedAbonos = abonos.filter((a) => a.id !== id);
      await syncAllCaratulasWithClientPools(caratulas, updatedAbonos, saveCaratulaToFirestore);
      triggerAudit(
        "CANCELAR_ABONO",
        `Abono/Ticket ${id} (${caratulaFolio || target?.caratulaFolio}) eliminado definitivamente`,
        { id, folio: caratulaFolio, monto: target?.montoAbonado },
        caratulaFolio
      );
    });
  };


  const handleSaveCategory = async (category: ServiceCategory) => {
    const isNew = !categories.some((c) => c.id === category.id);
    setCategories((prev) => {
      const idx = prev.findIndex((c) => c.id === category.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = category;
        return next;
      }
      return [...prev, category];
    });
    await runSyncAction(async () => {
      await saveCategoryToFirestore(category);
      triggerAudit(
        "MODIFICAR_CARATULA",
        `Categoría de servicio "${category.nombre}" ${isNew ? "creada" : "actualizada"}`,
        { id: category.id, nombre: category.nombre }
      );
    });
  };

  const handleDeleteCategory = async (id: string) => {
    const target = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await runSyncAction(async () => {
      await deleteCategoryFromFirestore(id);
      triggerAudit(
        "MODIFICAR_CARATULA",
        `Categoría de servicio "${target?.nombre || id}" eliminada`,
        { id, nombre: target?.nombre }
      );
    });
  };

  const handleSaveCalendarEvent = async (event: CalendarEvent) => {
    // Asignación forzosa a carátula: si falta o está vacía, vincular a carátula de prueba (número de cliente + 01)
    if (!event.caratulaFolio || event.caratulaFolio.trim() === "" || event.caratulaFolio.toLowerCase() === "sin asociar") {
      event.caratulaFolio = getTestCaratulaFolio(event.clientId);
    }

    const matchingCar = event.caratulaFolio ? caratulas.find((c) => c.folio.trim().toLowerCase() === event.caratulaFolio?.trim().toLowerCase()) : null;
    const matchingCli = event.clientId ? clients.find((c) => c.id === event.clientId) : null;
    const assignedSucursalId =
      event.sucursalId ||
      matchingCar?.sucursalId ||
      matchingCli?.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const assignedSucursalNombre =
      event.sucursalNombre ||
      matchingCar?.sucursalNombre ||
      matchingCli?.sucursalNombre ||
      sucursales.find((s) => s.id === assignedSucursalId)?.nombre ||
      "Cuidarte Pachuca";

    const normalizedEvent: CalendarEvent = {
      ...event,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
    };

    const isNew = !calendarEvents.some((e) => isSameGuardia(e, normalizedEvent));
    setCalendarEvents((prev) => {
      const idx = prev.findIndex((e) => isSameGuardia(e, normalizedEvent));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedEvent;
        return next;
      }
      return [...prev, normalizedEvent];
    });

    let updatedCaratulaToSave: Caratula | null = null;
    let previousCaratulaToUpdate: Caratula | null = null;

    if (event.caratulaFolio) {
      const targetFolioClean = event.caratulaFolio.trim().toLowerCase();
      const targetCaratula = caratulas.find(
        (c) => c.folio.trim().toLowerCase() === targetFolioClean
      );

      // Si la guardia fue movida de otra carátula, removerla de la carátula anterior
      for (const c of caratulas) {
        if (c.folio.trim().toLowerCase() !== targetFolioClean) {
          const hasShift = (c.guardiasProgramadas || []).some((s) => isSameGuardia(s, event));
          if (hasShift) {
            const remainingShifts = (c.guardiasProgramadas || []).filter((s) => !isSameGuardia(s, event));
            previousCaratulaToUpdate = { ...c, guardiasProgramadas: remainingShifts };
            break;
          }
        }
      }

      if (previousCaratulaToUpdate) {
        setCaratulas((prev) =>
          prev.map((c) =>
            c.folio.trim().toLowerCase() === previousCaratulaToUpdate!.folio.trim().toLowerCase()
              ? previousCaratulaToUpdate!
              : c
          )
        );
      }

      if (targetCaratula) {
        const existingShifts = targetCaratula.guardiasProgramadas || [];
        const shiftIdx = existingShifts.findIndex((s) => isSameGuardia(s, event));

        const newShifts = [...existingShifts];
        if (shiftIdx >= 0) {
          newShifts[shiftIdx] = {
            ...newShifts[shiftIdx],
            id: event.folioGuardia || event.id || newShifts[shiftIdx].id,
            folioGuardia: event.folioGuardia || newShifts[shiftIdx].folioGuardia,
            caratulaFolio: event.caratulaFolio,
            fecha: event.fechaInicio ? event.fechaInicio.split("T")[0] : newShifts[shiftIdx].fecha,
            horaInicio: event.fechaInicio?.split("T")[1]?.slice(0, 5) || newShifts[shiftIdx].horaInicio,
            horaFin: event.fechaFin?.split("T")[1]?.slice(0, 5) || newShifts[shiftIdx].horaFin,
            fechaFinCalculada: event.fechaFin
              ? event.fechaFin.split("T")[0]
              : (event.fechaInicio ? event.fechaInicio.split("T")[0] : newShifts[shiftIdx].fechaFinCalculada),
            personalAsignado: event.personalAsignado || newShifts[shiftIdx].personalAsignado,
            staffId: event.staffId || newShifts[shiftIdx].staffId,
            staffNoSocio: event.staffNoSocio || newShifts[shiftIdx].staffNoSocio,
            staffFoto: event.staffFoto || newShifts[shiftIdx].staffFoto,
            costoHonorarios: event.costoHonorarios !== undefined ? event.costoHonorarios : newShifts[shiftIdx].costoHonorarios,
            tipoServicio: event.tipoServicio || newShifts[shiftIdx].tipoServicio,
            notasTurno: event.notas || newShifts[shiftIdx].notasTurno,
            honorarioPagado: event.honorarioPagado !== undefined ? event.honorarioPagado : newShifts[shiftIdx].honorarioPagado,
            pagoHonorarioId: event.pagoHonorarioId !== undefined ? event.pagoHonorarioId : newShifts[shiftIdx].pagoHonorarioId,
            fechaPagoHonorario: event.fechaPagoHonorario !== undefined ? event.fechaPagoHonorario : newShifts[shiftIdx].fechaPagoHonorario,
            montoPagadoHonorario: event.montoPagadoHonorario !== undefined ? event.montoPagadoHonorario : newShifts[shiftIdx].montoPagadoHonorario,
          };
        } else {
          newShifts.push({
            id: event.folioGuardia || event.id,
            folioGuardia: event.folioGuardia || event.id,
            caratulaFolio: event.caratulaFolio,
            fecha: event.fechaInicio ? event.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10),
            horaInicio: event.fechaInicio?.split("T")[1]?.slice(0, 5) || "08:00",
            horaFin: event.fechaFin?.split("T")[1]?.slice(0, 5) || "20:00",
            fechaFinCalculada: event.fechaFin ? event.fechaFin.split("T")[0] : event.fechaInicio.split("T")[0],
            preset: "12h_dia",
            tipoServicio: event.tipoServicio || targetCaratula.servicios?.[0]?.servicio || "Enfermería General",
            personalAsignado: event.personalAsignado || "Por asignar",
            staffId: event.staffId,
            staffNoSocio: event.staffNoSocio,
            staffFoto: event.staffFoto,
            costoHonorarios: event.costoHonorarios,
            honorarioPagado: event.honorarioPagado,
            pagoHonorarioId: event.pagoHonorarioId,
            fechaPagoHonorario: event.fechaPagoHonorario,
            montoPagadoHonorario: event.montoPagadoHonorario,
            notasTurno: event.notas || "",
          });
        }

        const sanitizedShifts = deduplicateShiftsList(newShifts);

        updatedCaratulaToSave = {
          ...targetCaratula,
          guardiasProgramadas: sanitizedShifts,
        };

        setCaratulas((prev) =>
          prev.map((c) =>
            c.folio.trim().toLowerCase() === updatedCaratulaToSave!.folio.trim().toLowerCase()
              ? updatedCaratulaToSave!
              : c
          )
        );
      } else {
        // La carátula no existe aún en memoria: se genera como Carátula de Prueba (o ad-hoc) para el cliente
        const matchedClient = clients.find((c) => c.id === event.clientId) || clients[0] || {
          id: event.clientId || "CLI-001",
          nombreCompletoCliente: event.clientNombre || "Cliente Cuidarte",
        };
        updatedCaratulaToSave = createTestCaratulaForClient(
          matchedClient as Client,
          event.caratulaFolio,
          [event]
        );
        setCaratulas((prev) => [updatedCaratulaToSave!, ...prev]);
      }
    }

    await runSyncAction(async () => {
      await saveCalendarEventToFirestore(event);
      if (previousCaratulaToUpdate) {
        await saveCaratulaToFirestore(previousCaratulaToUpdate);
      }
      if (updatedCaratulaToSave) {
        await saveCaratulaToFirestore(updatedCaratulaToSave);
      }
      triggerAudit(
        isNew ? "AGENDAR_TURNO" : "MODIFICAR_TURNO",
        `Turno agendado/actualizado: ${event.titulo} (${event.fechaInicio}) - Personal: ${event.personalAsignado || "Sin asignar"}${event.costoHonorarios !== undefined ? ` - Honorarios: $${event.costoHonorarios}` : ""} - Carátula: ${event.caratulaFolio || "N/A"}`,
        { id: event.id, titulo: event.titulo, fecha: event.fechaInicio, personal: event.personalAsignado, costoHonorarios: event.costoHonorarios, caratulaFolio: event.caratulaFolio },
        event.caratulaFolio,
        event.clientId
      );
    });
  };

  const handleSaveCalendarEventsBatch = async (events: CalendarEvent[]) => {
    if (!events || events.length === 0) return;
    const resolvedEvents = events.map((ev) => {
      if (!ev.caratulaFolio || ev.caratulaFolio.trim() === "" || ev.caratulaFolio.toLowerCase() === "sin asociar") {
        return {
          ...ev,
          caratulaFolio: getTestCaratulaFolio(ev.clientId),
        };
      }
      return ev;
    });

    setCalendarEvents((prev) => {
      let next = [...prev];
      for (const ev of resolvedEvents) {
        const idx = next.findIndex((e) => isSameGuardia(e, ev));
        if (idx >= 0) {
          next[idx] = ev;
        } else {
          next.push(ev);
        }
      }
      return next;
    });
    await runSyncAction(async () => {
      for (const ev of resolvedEvents) {
        await saveCalendarEventToFirestore(ev);
      }
      triggerAudit(
        "AGENDAR_TURNO",
        `Programación en lote de ${resolvedEvents.length} turnos en agenda`,
        { count: resolvedEvents.length }
      );
    });
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    const target = calendarEvents.find((e) => e.id === id || e.folioGuardia === id);
    setCalendarEvents((prev) => prev.filter((e) => e.id !== id && e.folioGuardia !== id));

    let affectedCaratula: Caratula | null = null;
    if (target?.caratulaFolio) {
      const car = caratulas.find((c) => c.folio.trim().toLowerCase() === target.caratulaFolio!.trim().toLowerCase());
      if (car && car.guardiasProgramadas) {
        const filtered = car.guardiasProgramadas.filter((s) => !isSameGuardia(s, target));
        affectedCaratula = { ...car, guardiasProgramadas: filtered };
        setCaratulas((prev) => prev.map((c) => c.folio === affectedCaratula!.folio ? affectedCaratula! : c));
      }
    }

    await runSyncAction(async () => {
      await deleteCalendarEventFromFirestore(id);
      if (affectedCaratula) {
        await saveCaratulaToFirestore(affectedCaratula);
      }
      triggerAudit(
        "ELIMINAR_TURNO",
        `Turno eliminado de agenda: ${target?.titulo || id} (${target?.fechaInicio || ""})`,
        { id, titulo: target?.titulo },
        target?.caratulaFolio,
        target?.clientId
      );
    });
  };

  const handleSaveExpedienteEntry = async (entry: ExpedienteEntry) => {
    setExpedienteEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [entry, ...prev];
    });
    await runSyncAction(async () => {
      await saveExpedienteEntryToFirestore(entry);
      triggerAudit(
        "REGISTRAR_EXPEDIENTE",
        `Nota médica/expediente registrada para paciente ${entry.clientNombre || entry.clientId} (${entry.tipo || entry.titulo})`,
        { id: entry.id, tipo: entry.tipo, titulo: entry.titulo, registradoPor: entry.registradoPor },
        undefined,
        entry.clientId
      );
    });
  };

  const handleDeleteExpedienteEntry = async (id: string) => {
    const target = expedienteEntries.find((e) => e.id === id);
    await runSyncAction(async () => {
      await deleteExpedienteEntryFromFirestore(id);
      triggerAudit(
        "CANCELAR_EXPEDIENTE",
        `Entrada de expediente eliminada/cancelada: ${target?.titulo || target?.tipo || id}`,
        { id },
        undefined,
        target?.clientId
      );
    });
  };

  const handleSaveKardexRecord = async (record: KardexRecord) => {
    setKardexRecords((prev) => {
      const idx = prev.findIndex((k) => k.id === record.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [record, ...prev];
    });
    await runSyncAction(async () => {
      await saveKardexRecordToFirestore(record);
      triggerAudit(
        "ACTUALIZAR_KARDEX",
        `Kardex de medicamentos actualizado para paciente ${record.clientNombre} (${record.medicamentos?.length || 0} medicamentos)`,
        { id: record.id, medicamentosCount: record.medicamentos?.length },
        undefined,
        record.clientId
      );
      // Auto-sync inventory item names and presentations for this patient if changed
      if (record.clientId && record.medicamentos) {
        const clientInvs = inventoryItems.filter(
          (inv) => inv.clientId && (inv.clientId || "").toUpperCase() === (record.clientId || "").toUpperCase()
        );
        for (const med of record.medicamentos) {
          const normMed = (med.nombreMedicamento || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, " ")
            .trim();
          const matchInvs = clientInvs.filter((inv) => {
            if (inv.kardexMedicationId === med.id) return true;
            const normInv = (inv.nombre || "")
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]/g, " ")
              .trim();
            return normInv === normMed || normInv.includes(normMed) || normMed.includes(inv.kardexMedicationId || "");
          });
          for (const matchInv of matchInvs) {
            const needsUpdate =
              matchInv.nombre !== med.nombreMedicamento ||
              matchInv.kardexMedicationId !== med.id ||
              matchInv.presentacion !== med.presentacion ||
              matchInv.unidadMedida !== med.unidadMedida ||
              matchInv.tipoFrecuencia !== med.tipoFrecuencia ||
              matchInv.tipoTratamiento !== med.tipoTratamiento;

            if (needsUpdate) {
              await saveInventoryItemToFirestore({
                ...matchInv,
                nombre: med.nombreMedicamento,
                kardexMedicationId: med.id,
                presentacion: med.presentacion || matchInv.presentacion,
                unidadMedida: med.unidadMedida || matchInv.unidadMedida,
                tipoFrecuencia: med.tipoFrecuencia || matchInv.tipoFrecuencia,
                indicacionesUsoADemanda: med.indicacionesUsoADemanda || matchInv.indicacionesUsoADemanda,
                tipoTratamiento: med.tipoTratamiento || matchInv.tipoTratamiento,
                dosisPorToma: med.dosisPorToma ?? matchInv.dosisPorToma,
                vecesAlDia: med.vecesAlDia ?? matchInv.vecesAlDia,
                frecuenciaKardex: `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}`,
                duracionDiasTratamiento: med.duracionDias ?? matchInv.duracionDiasTratamiento,
                totalMedicamentoRequerido: med.totalMedicamentoRequerido ?? matchInv.totalMedicamentoRequerido,
                ultimaActualizacion: new Date().toISOString(),
              });
            }
          }
        }
      }
    });
  };

  const handleDeleteKardexRecord = async (id: string) => {
    const target = kardexRecords.find((k) => k.id === id);
    setKardexRecords((prev) => prev.filter((k) => k.id !== id));
    await runSyncAction(async () => {
      await deleteKardexRecordFromFirestore(id);
      triggerAudit(
        "ACTUALIZAR_KARDEX",
        `Kardex de medicamentos de paciente ${target?.clientNombre || id} eliminado`,
        { id, client: target?.clientNombre },
        undefined,
        target?.clientId
      );
    });
  };

  const handleSaveStaffMember = async (staff: StaffMember) => {
    const isNew = !staffMembers.some((s) => s.id === staff.id);
    const staffFullName = `${staff.nombre || ""} ${staff.apellidos || ""}`.trim();
    const assignedSucursalId = isBranchRestrictedAdmin
      ? userSession?.sucursalId || "pachuca"
      : staff.sucursalId || (selectedSucursalId !== "all" ? selectedSucursalId : "pachuca");
    const assignedSucursalNombre = isBranchRestrictedAdmin
      ? userSession?.sucursalNombre || "Cuidarte Pachuca"
      : staff.sucursalNombre || sucursales.find((s) => s.id === assignedSucursalId)?.nombre || "Cuidarte Pachuca";

    const normalizedStaff: StaffMember = {
      ...staff,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
      creadoPor: staff.creadoPor || userSession?.username || "Administración",
      modificadoPor: userSession?.username || "Administración",
    };

    setStaffMembers((prev) => {
      const idx = prev.findIndex((s) => s.id === normalizedStaff.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedStaff;
        return next;
      }
      return [...prev, normalizedStaff].sort((a, b) => (a.noSocio || "").localeCompare(b.noSocio || ""));
    });
    await runSyncAction(async () => {
      await saveStaffMemberToFirestore(normalizedStaff);
      triggerAudit(
        isNew ? "CREAR_PERSONAL" : "MODIFICAR_PERSONAL",
        `Personal ${normalizedStaff.noSocio ? `[${normalizedStaff.noSocio}] ` : ""}${staffFullName} (${assignedSucursalNombre}) ${isNew ? "registrado" : "actualizado"} por @${userSession?.username || "admin"}${normalizedStaff.banco ? ` (Banco: ${normalizedStaff.banco})` : ""}`,
        { id: normalizedStaff.id, noSocio: normalizedStaff.noSocio, nombre: staffFullName, sucursal: assignedSucursalNombre, sucursalId: assignedSucursalId, modificadoPor: userSession?.username }
      );
    });
  };

  const handleDeleteStaffMember = async (id: string) => {
    const target = staffMembers.find((s) => s.id === id);
    const targetFullName = target ? `${target.nombre || ""} ${target.apellidos || ""}`.trim() : id;
    setStaffMembers((prev) => prev.filter((s) => s.id !== id));
    await runSyncAction(async () => {
      await deleteStaffMemberFromFirestore(id);
      triggerAudit(
        "ELIMINAR_PERSONAL",
        `Personal ${targetFullName} [${target?.noSocio || ""}] eliminado`,
        { id, nombre: targetFullName }
      );
    });
  };

  const handleSaveSystemUser = async (user: SystemUser) => {
    const isNew = !systemUsers.some((u) => u.id === user.id);
    setSystemUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = user;
        return next;
      }
      return [user, ...prev];
    });
    await runSyncAction(async () => {
      await saveSystemUserToFirestore(user);
      triggerAudit(
        isNew ? "CREAR_USUARIO" : "MODIFICAR_USUARIO",
        `Usuario de sistema ${user.ux} (${user.role} - ${user.nombre || ""}) ${isNew ? "creado" : "actualizado"}`,
        { id: user.id, ux: user.ux, role: user.role }
      );
    });
  };

  const handleDeleteSystemUser = async (id: string) => {
    const target = systemUsers.find((u) => u.id === id);
    setSystemUsers((prev) => prev.filter((u) => u.id !== id));
    await runSyncAction(async () => {
      await deleteSystemUserFromFirestore(id);
      triggerAudit(
        "ELIMINAR_USUARIO",
        `Usuario ${target?.ux || id} (${target?.role || ""}) eliminado`,
        { id, ux: target?.ux }
      );
    });
  };

  const handleSaveGuardia = async (guardia: GuardiaShiftRecord) => {
    setGuardiaRecords((prev) => {
      const idx = prev.findIndex((g) => g.id === guardia.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = guardia;
        return next;
      }
      return [guardia, ...prev];
    });
    await runSyncAction(async () => {
      await saveGuardiaToFirestore(guardia);
      triggerAudit(
        guardia.estatus === "Finalizada" ? "FIN_TURNO_ENFERMERIA" : "INICIO_TURNO_ENFERMERIA",
        `Turno de guardia ${guardia.estatus === "Finalizada" ? "cerrado/finalizado" : "iniciado"} para ${guardia.staffNombre} en servicio de ${guardia.clientNombre || "paciente"}`,
        { id: guardia.id, staff: guardia.staffNombre, client: guardia.clientNombre, estatus: guardia.estatus },
        guardia.caratulaFolio,
        guardia.clientId
      );

      // Auto-update calendar event status from Programada -> En Curso -> Finalizado
      if (guardia.clientId) {
        const normClientId = (guardia.clientId || "").trim().toUpperCase();
        const gDate = (guardia.fechaInicioIso || "").slice(0, 10);
        const staffTokens = [
          guardia.staffId?.toLowerCase(),
          guardia.staffNoSocio?.toLowerCase(),
          guardia.staffNombre?.toLowerCase(),
        ].filter(Boolean) as string[];

        const matchedEv = calendarEvents.find((ev) => {
          const evClientId = (ev.clientId || "").trim().toUpperCase();
          if (evClientId !== normClientId) return false;
          if (ev.guardiaShiftId === guardia.id) return true;
          const evDate = (ev.fechaInicio || "").slice(0, 10);
          const isDateMatch = !evDate || !gDate || evDate === gDate;
          const evStaffStr = `${ev.staffId || ""} ${ev.staffNoSocio || ""} ${ev.personalAsignado || ""}`.toLowerCase();
          const isStaffMatch = staffTokens.some((tok) => tok && evStaffStr.includes(tok));
          return isDateMatch && (isStaffMatch || !ev.staffId);
        });

        if (matchedEv) {
          const isOpen = guardia.estatus === "En Curso";
          const isDone = guardia.estatus === "Finalizada";
          const updatedEvent: CalendarEvent = {
            ...matchedEv,
            guardiaShiftId: guardia.id,
            estado: isOpen ? "En Proceso" : isDone ? "Completado" : matchedEv.estado,
            turnoAbierto: isOpen,
            turnoFinalizado: isDone,
            horaApertura: guardia.horaInicio || guardia.fechaInicioFormateada || matchedEv.horaApertura,
            horaCierre: guardia.horaFin || guardia.fechaFinFormateada || matchedEv.horaCierre,
            duracionMinutos: guardia.duracionMinutos ?? matchedEv.duracionMinutos,
            notasInicio: guardia.notasInicio ?? matchedEv.notasInicio,
            notasFin: guardia.notasFin ?? matchedEv.notasFin,
            novedadesEntrega: guardia.novedadesEntrega ?? matchedEv.novedadesEntrega,
            ubicacionEntrada: guardia.ubicacionEntrada ?? matchedEv.ubicacionEntrada,
          };
          await saveCalendarEventToFirestore(updatedEvent);
        }
      }
    });
  };

  const handleDeleteGuardia = async (id: string) => {
    const target = guardiaRecords.find((g) => g.id === id);
    setGuardiaRecords((prev) => prev.filter((g) => g.id !== id));
    await runSyncAction(async () => {
      await deleteGuardiaFromFirestore(id);
      triggerAudit(
        "ELIMINAR_TURNO",
        `Registro de guardia ${id} (${target?.staffNombre || ""}) eliminado`,
        { id, staff: target?.staffNombre, client: target?.clientNombre },
        target?.caratulaFolio,
        target?.clientId
      );
    });
  };

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const isNew = !inventoryItems.some((i) => i.id === item.id);
    setInventoryItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [item, ...prev];
    });
    await runSyncAction(async () => {
      await saveInventoryItemToFirestore(item);
      triggerAudit(
        isNew ? "CREAR_ITEM_INVENTARIO" : "MODIFICAR_ITEM_INVENTARIO",
        `Insumo/Medicamento ${item.nombre} ${isNew ? "creado" : "actualizado"} en inventario (${item.stockActual} ${item.unidadMedida || "unidades"})`,
        { id: item.id, nombre: item.nombre, stock: item.stockActual, client: item.clientNombre },
        undefined,
        item.clientId
      );
    });
  };

  const handleDeleteInventoryItem = async (id: string) => {
    const target = inventoryItems.find((i) => i.id === id);
    setInventoryItems((prev) => prev.filter((i) => i.id !== id));
    await runSyncAction(async () => {
      await deleteInventoryItemFromFirestore(id);
      triggerAudit(
        "ELIMINAR_ITEM_INVENTARIO",
        `Insumo/Medicamento ${target?.nombre || id} eliminado de inventario`,
        { id, nombre: target?.nombre },
        undefined,
        target?.clientId
      );
    });
  };

  const handleSaveIncidencia = async (incidencia: IncidenciaTicket) => {
    const isNew = !incidencias.some((i) => i.id === incidencia.id);
    setIncidencias((prev) => {
      const idx = prev.findIndex((i) => i.id === incidencia.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = incidencia;
        return next;
      }
      return [incidencia, ...prev];
    });
    await runSyncAction(async () => {
      await saveIncidenciaToFirestore(incidencia);
      triggerAudit(
        incidencia.estado === "Resuelta" ? "RESOLVER_INCIDENCIA" : "CREAR_INCIDENCIA",
        `Ticket de incidencia ${incidencia.id} (${incidencia.titulo}) ${incidencia.estado === "Resuelta" ? "resuelto" : isNew ? "registrado" : "actualizado"}`,
        { id: incidencia.id, titulo: incidencia.titulo, estado: incidencia.estado, prioridad: incidencia.prioridad },
        incidencia.caratulaFolio,
        incidencia.clientId
      );
    });
  };

  const handleDeleteIncidencia = async (id: string) => {
    const target = incidencias.find((i) => i.id === id);
    setIncidencias((prev) => prev.filter((i) => i.id !== id));
    await runSyncAction(async () => {
      await deleteIncidenciaFromFirestore(id);
      triggerAudit(
        "CANCELAR_CARATULA",
        `Ticket de incidencia ${id} (${target?.titulo || ""}) eliminado`,
        { id, titulo: target?.titulo },
        target?.caratulaFolio,
        target?.clientId
      );
    });
  };

  const handleSaveSolicitudIncremento = async (solicitud: SolicitudIncrementoServicio) => {
    const isNew = !solicitudesIncremento.some((s) => s.id === solicitud.id);
    setSolicitudesIncremento((prev) => {
      const idx = prev.findIndex((s) => s.id === solicitud.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = solicitud;
        return next;
      }
      return [solicitud, ...prev];
    });
    await runSyncAction(async () => {
      await saveSolicitudIncrementoToFirestore(solicitud);
      triggerAudit(
        "SOLICITUD_INCREMENTO_SERVICIO",
        `Solicitud de incremento de servicio ${solicitud.id} (${solicitud.titulo} - $${solicitud.total?.toLocaleString()}) ${isNew ? "registrada" : "actualizada"}`,
        { id: solicitud.id, titulo: solicitud.titulo, total: solicitud.total, estado: solicitud.estado },
        solicitud.caratulaFolioReferencia,
        solicitud.clientId
      );
    });
  };

  const handleDeleteSolicitudIncremento = async (id: string) => {
    const target = solicitudesIncremento.find((s) => s.id === id);
    setSolicitudesIncremento((prev) => prev.filter((s) => s.id !== id));
    await runSyncAction(async () => {
      await deleteSolicitudIncrementoFromFirestore(id);
      triggerAudit(
        "CANCELAR_CARATULA",
        `Solicitud de incremento de servicio ${id} (${target?.titulo || ""}) eliminada`,
        { id, titulo: target?.titulo },
        target?.caratulaFolioReferencia,
        target?.clientId
      );
    });
  };

  // CLIENT ROLE: Render Client Portal for users whose username/ID starts with "CLI-"
  if (userSession.role === "client") {
    return (
      <ClientPortal
        userSession={userSession}
        clients={clients}
        caratulas={effectiveCaratulas}
        abonos={abonos}
        calendarEvents={calendarEvents}
        expedienteEntries={expedienteEntries}
        kardexRecords={kardexRecords}
        inventoryItems={inventoryItems}
        staffMembers={staffMembers}
        onSaveKardex={handleSaveKardexRecord}
        onLogout={handleLogout}
        isOnline={isOnline}
        isSyncing={syncStatus === "saving"}
      />
    );
  }

  // NURSE ROLE: Render Nurse Portal for users whose username/ID starts with "SOCP-"
  if (userSession.role === "nurse") {
    return (
      <NursePortal
        userSession={userSession}
        clients={clients}
        caratulas={effectiveCaratulas}
        calendarEvents={calendarEvents}
        expedienteEntries={expedienteEntries}
        kardexRecords={kardexRecords}
        inventoryItems={inventoryItems}
        staffMembers={staffMembers}
        guardiaRecords={guardiaRecords}
        expenses={expenses}
        onSaveCalendarEvent={handleSaveCalendarEvent}
        onDeleteCalendarEvent={handleDeleteCalendarEvent}
        onSaveExpedienteEntry={handleSaveExpedienteEntry}
        onDeleteExpedienteEntry={handleDeleteExpedienteEntry}
        onSaveKardex={handleSaveKardexRecord}
        onSaveInventoryItem={handleSaveInventoryItem}
        onDeleteInventoryItem={handleDeleteInventoryItem}
        onSaveGuardia={handleSaveGuardia}
        onDeleteGuardia={handleDeleteGuardia}
        onSaveClient={handleSaveClient}
        onLogout={handleLogout}
        isOnline={isOnline}
        isSyncing={syncStatus === "saving"}
      />
    );
  }

  // VENTAS ROLE: Dedicated Sales Portal (Quotation & Carátula creation)
  if (userSession.role === "ventas") {
    return (
      <VentasPortal
        userSession={userSession}
        allCaratulas={effectiveCaratulas}
        allClients={clients}
        services={services}
        staffMembers={staffMembers}
        sucursales={sucursales}
        onSaveCaratula={handleSaveCaratula}
        onSaveClient={handleSaveClient}
        onLogout={handleLogout}
        isOnline={isOnline}
        isSyncing={syncStatus === "saving"}
      />
    );
  }

  // ATENCION A CLIENTES ROLE: Dedicated Support, Incidents & Service Increment Portal
  if (userSession.role === "atencion_clientes") {
    return (
      <AtencionClientesPortal
        userSession={userSession}
        allClients={clients}
        allCaratulas={effectiveCaratulas}
        services={services}
        incidencias={incidencias}
        solicitudesIncremento={solicitudesIncremento}
        expedienteEntries={expedienteEntries}
        staffMembers={staffMembers}
        onSaveIncidencia={handleSaveIncidencia}
        onDeleteIncidencia={handleDeleteIncidencia}
        onSaveSolicitudIncremento={handleSaveSolicitudIncremento}
        onSaveCaratula={handleSaveCaratula}
        onLogout={handleLogout}
        isOnline={isOnline}
        isSyncing={syncStatus === "saving"}
      />
    );
  }

  const handleSelectClientForCaratula = (client: Client) => {
    const targetBranchId =
      client.sucursalId ||
      (selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const targetBranchObj = sucursales.find((s) => s.id === targetBranchId);
    const targetBranchNombre = client.sucursalNombre || targetBranchObj?.nombre || "Cuidarte Pachuca";
    const newFolio = getNextCaratulaFolioNomenclature({
      sucursal: targetBranchObj,
      sucursalNombre: targetBranchNombre,
      caratulas,
      tipoDocumento: "Caratula",
    });

    const newCaratula: Caratula = {
      folio: newFolio,
      id: client.id,
      timestamp: new Date().toLocaleString(),
      tipoDocumento: "Caratula",
      sucursalId: targetBranchId,
      sucursalNombre: targetBranchNombre,
      verificationToken: generateVerificationToken(),
      nombreCompletoCliente: client.nombreCompletoCliente,
      numeroContacto: client.numeroContacto,
      numeroContacto2: client.numeroContacto2 || "",
      numeroContacto3: client.numeroContacto3 || "",
      correo: client.correo || "",
      direccionServicio: client.direccionServicio || "",
      nombreCompletoRS: client.nombreCompletoRS || "",
      edad: client.edad || "",
      diagnostico: client.diagnostico || "",
      especificaciones: client.especificaciones || "",
      servicios: [
        { servicio: "", cantidad: 1, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
      ],
      subtotal: 0,
      descuento: 0,
      total: 0,
      pagado: 0,
      pendiente: 0,
      inicio: "",
      fin: "",
      contratoLink: "www.cuidartemexico.com/contrato",
      tycLink: "www.cuidartemexico.com/terminos-y-condiciones",
      estado: "Activo",
    };

    setCaratulaToEdit(newCaratula);
    setActiveTab("crear");
  };

  const handleSaveCorte = async (corte: CorteDeCajaRecord) => {
    setSyncStatus("saving");
    await saveCorteToFirestore(corte);
    setSyncStatus("synced");
    setLastSyncedAt(new Date());
  };

  const handleDeleteCorte = async (id: string) => {
    setSyncStatus("saving");
    await deleteCorteFromFirestore(id);
    setSyncStatus("synced");
    setLastSyncedAt(new Date());
  };

  const handleResetDatabase = async () => {
    if (
      confirm(
        "¿Está seguro de reiniciar y eliminar TODOS los datos actuales de la base de datos? La plataforma quedará completamente en blanco para un inicio limpio."
      )
    ) {
      setSyncStatus("saving");
      await resetAllFirestoreDatabase();
      setSyncStatus("synced");
      setLastSyncedAt(new Date());
      alert("La base de datos ha sido reiniciada con éxito. Todos los datos de prueba han sido eliminados.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Header navigation bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === "crear" && activeTab !== "crear") {
            setCaratulaToEdit(null);
          }
          setActiveTab(tab);
        }}
        caratulasCount={filteredCaratulas.length}
        userSession={userSession}
        onLogout={handleLogout}
        onResetDatabase={handleResetDatabase}
        onForceSync={handleForceSyncAll}
        isOnline={isOnline}
        isQuotaExhausted={isQuotaExhaustedState}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        clients={filteredClients}
        caratulas={filteredCaratulas}
        globalSelectedClientId={globalSelectedClientId}
        onSelectGlobalClient={setGlobalSelectedClientId}
        sucursales={sucursales}
        selectedSucursalId={selectedSucursalId}
        onSelectSucursal={setSelectedSucursalId}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-6 space-y-4 pb-36 md:pb-8">
        {/* Quota Exhausted / Persistent Cache Banner */}
        {isQuotaExhaustedState && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-600/15 border-2 border-amber-500/40 text-amber-950 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-700 shrink-0 mt-0.5">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="font-bold text-amber-950 text-sm">Persistencia Local Activa (Límite Diario de Consultas Firestore Alcanzado)</strong>
                  <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-md font-bold text-[10px]">100% Funcional</span>
                </div>
                <p className="mt-1 text-amber-900 leading-relaxed">
                  Tu cuenta gratuita de Firestore alcanzó el límite de lecturas del día de hoy. 
                  <strong> La aplicación sigue operando y guardando todos tus datos localmente en tu dispositivo con total seguridad y rapidez.</strong>
                  {" "}La cuota en la nube se renueva automáticamente cada medianoche (00:00 UTC).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end mt-2 sm:mt-0 flex-wrap">
              <button
                onClick={() => {
                  resetFirestoreQuotaCooldown();
                  setIsQuotaExhaustedState(false);
                  handleForceSyncAll();
                }}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar Nube</span>
              </button>
              <a
                href={FIRESTORE_UPGRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Habilitar Facturación</span>
              </a>
            </div>
          </div>
        )}

        {/* Offline Alert Banner */}
        {!isOnline && (
          <div className="bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-medium shadow-sm">
            <div className="flex items-center gap-2.5">
              <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="font-bold block text-amber-950">Modo Sin Conexión Activado</strong>
                <span>Estás trabajando sin conexión a Internet. Los cambios se sincronizarán en la nube automáticamente al reconectarse.</span>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOnline(navigator.onLine);
                if (navigator.onLine) handleForceSyncAll();
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 transition-colors"
            >
              Verificar Conexión
            </button>
          </div>
        )}

        {/* Sync Error Alert Banner */}
        {syncStatus === "error" && syncErrorMessage && (
          <div className="bg-rose-500/10 border-2 border-rose-500/40 text-rose-900 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-medium shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <strong className="font-bold block text-rose-950">Error de Sincronización</strong>
                <span>{syncErrorMessage}</span>
              </div>
            </div>
            <button
              onClick={handleForceSyncAll}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shrink-0 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {activeTab === "crear" && (
          <CaratulaForm
            caratulas={filteredCaratulas}
            clients={filteredClients}
            services={services}
            abonos={filteredAbonos}
            staffMembers={filteredStaffMembers}
            calendarEvents={filteredCalendarEvents}
            sucursales={sucursales}
            userSession={userSession}
            selectedSucursalId={selectedSucursalId}
            onSaveCaratula={handleSaveCaratula}
            onSaveCalendarEventsBatch={handleSaveCalendarEventsBatch}
            onSaveCalendarEvent={handleSaveCalendarEvent}
            initialCaratulaToEdit={caratulaToEdit}
            currentUserName={userSession?.username}
            onFinishedEditing={() => {
              setCaratulaToEdit(null);
              setActiveTab("historial");
            }}
          />
        )}

        {activeTab === "historial" && (
          <CaratulaHistory
            caratulas={filteredCaratulas}
            abonos={filteredAbonos}
            calendarEvents={filteredCalendarEvents}
            sucursales={sucursales}
            userSession={userSession}
            selectedSucursalId={selectedSucursalId}
            onEditCaratula={(c) => {
              setCaratulaToEdit(c);
              setActiveTab("crear");
            }}
            onSaveCaratula={handleSaveCaratula}
            onDeleteCaratula={handleDeleteCaratula}
            onUpdatePayment={handleUpdateCaratulaPayment}
            onSaveAbono={handleSaveAbono}
            onCancelAbono={handleCancelAbono}
            onReactivateAbono={handleReactivateAbono}
            onDeleteAbono={handleDeleteAbono}
            onDuplicateCaratula={handleDuplicateCaratula}
            currentUserName={userSession?.username}
          />
        )}

        {activeTab === "servicios" && (
          <ServicesManager
            services={services}
            categories={categories}
            onSaveService={handleSaveService}
            onBatchSaveServices={handleBatchSaveServices}
            onDeleteService={handleDeleteService}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        )}

        {activeTab === "clientes" && (
          <ClientsManager
            clients={filteredClients}
            caratulas={filteredCaratulas}
            abonos={filteredAbonos}
            sucursales={sucursales}
            userSession={userSession}
            onSaveClient={handleSaveClient}
            onBatchSaveClients={handleBatchSaveClients}
            onDeleteClient={handleDeleteClient}
            onSelectForCaratula={handleSelectClientForCaratula}
            onViewBalances={(client) => {
              setSelectedClientForBalance(client?.id || null);
              setActiveTab("saldos");
            }}
          />
        )}

        {activeTab === "saldos" && (
          <ClientBalancesManager
            clients={filteredClients}
            caratulas={filteredCaratulas}
            abonos={filteredAbonos}
            initialSelectedClientId={selectedClientForBalance}
            onSaveAbono={handleSaveAbono}
            onCancelAbono={handleCancelAbono}
            onReactivateAbono={handleReactivateAbono}
            onDeleteAbono={handleDeleteAbono}
            onSaveClient={handleSaveClient}
            onSaveCaratula={handleSaveCaratula}
            onSelectCaratulaForView={(c) => {
              setCaratulaToEdit(c);
              setActiveTab("crear");
            }}
            currentUserName={userSession?.nombre || userSession?.username || "Administración"}
          />
        )}

        {activeTab === "personal" && (
          <StaffCredentialManager
            staffMembers={filteredStaffMembers}
            systemUsers={filteredSystemUsers}
            guardiaRecords={filteredGuardiaRecords}
            clients={filteredClients}
            caratulas={filteredCaratulas}
            calendarEvents={filteredCalendarEvents}
            sucursales={sucursales}
            userSession={userSession}
            onSaveStaffMember={handleSaveStaffMember}
            onDeleteStaffMember={handleDeleteStaffMember}
            onSaveClient={handleSaveClient}
            onBatchSaveClients={handleBatchSaveClients}
            onSaveGuardia={handleSaveGuardia}
            onSaveCalendarEvent={handleSaveCalendarEvent}
          />
        )}

        {activeTab === "usuarios" && (
          <UsersManager
            systemUsers={filteredSystemUsers}
            clients={filteredClients}
            staffMembers={filteredStaffMembers}
            sucursales={sucursales}
            guardiaRecords={filteredGuardiaRecords}
            currentUserSession={userSession}
            onSaveUser={handleSaveSystemUser}
            onDeleteUser={handleDeleteSystemUser}
            onRevokeSession={async (ux, nurseId) => {
              return await revokeUserSessionInFirestore(ux, nurseId);
            }}
            onRefresh={handleForceSyncAll}
          />
        )}

        {activeTab === "gastos" && (
          <ExpensesManager
            caratulas={filteredCaratulas}
            services={services}
            expenses={filteredExpenses}
            sucursales={sucursales}
            userSession={userSession}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            currentUserName={userSession?.username}
            onNavigateToHonorarios={() => setActiveTab("honorarios")}
          />
        )}

        {activeTab === "honorarios" && (
          <StaffFeesTracker
            caratulas={filteredCaratulas}
            services={services}
            expenses={filteredExpenses}
            staffMembers={filteredStaffMembers}
            calendarEvents={filteredCalendarEvents}
            guardiaRecords={filteredGuardiaRecords}
            onAddExpense={handleSaveExpense}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onSaveCaratula={handleSaveCaratula}
            onSaveCalendarEvent={handleSaveCalendarEvent}
            onDeleteCalendarEvent={handleDeleteCalendarEvent}
            currentUserName={userSession?.username}
          />
        )}

        {activeTab === "agenda" && (
          <CalendarManager
            events={filteredCalendarEvents}
            clients={filteredClients}
            caratulas={filteredCaratulas}
            staffMembers={filteredStaffMembers}
            guardiaRecords={filteredGuardiaRecords}
            onSaveEvent={handleSaveCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            readOnly={false}
            userRole="admin"
            currentUserName={userSession?.nombre || userSession?.username}
          />
        )}

        {activeTab === "expedientes" && (
          <ExpedienteManager
            entries={filteredExpedienteEntries}
            clients={filteredClients}
            caratulas={filteredCaratulas}
            calendarEvents={filteredCalendarEvents}
            guardiaRecords={filteredGuardiaRecords}
            kardexRecords={kardexRecords}
            inventoryItems={filteredInventoryItems}
            onSaveEntry={handleSaveExpedienteEntry}
            onDeleteEntry={handleDeleteExpedienteEntry}
            onSaveKardex={handleSaveKardexRecord}
            onDeleteKardex={handleDeleteKardexRecord}
            onSaveInventoryItem={handleSaveInventoryItem}
            onSaveClient={handleSaveClient}
            readOnly={false}
            userRole="admin"
            currentUserName={userSession?.nombre || userSession?.username || "Administrador"}
            filterClientId={globalSelectedClientId}
            onSelectClient={setGlobalSelectedClientId}
          />
        )}

        {activeTab === "inventario" && (
          <InventoryManager
            inventoryItems={filteredInventoryItems}
            clients={filteredClients}
            caratulas={filteredCaratulas}
            kardexRecords={kardexRecords}
            onSaveItem={handleSaveInventoryItem}
            onDeleteItem={handleDeleteInventoryItem}
            userRole="admin"
            currentUserName={userSession?.nombre || userSession?.username || "Administrador"}
            filterClientId={globalSelectedClientId}
            onSelectClient={setGlobalSelectedClientId}
          />
        )}

        {activeTab === "financiero" && (
          <FinancialDashboard
            caratulas={filteredCaratulas}
            services={services}
            expenses={filteredExpenses}
            abonos={filteredAbonos}
            onNavigateToHonorarios={() => setActiveTab("honorarios")}
            onNavigateToExpenses={() => setActiveTab("gastos")}
          />
        )}

        {activeTab === "respaldo" && (
          <DatabaseBackupManager
            caratulas={effectiveCaratulas}
            clients={clients}
            services={services}
            expenses={expenses}
            abonos={abonos}
            categories={categories}
            calendarEvents={calendarEvents}
            expedienteEntries={expedienteEntries}
            kardexRecords={kardexRecords}
            inventoryItems={inventoryItems}
            staffMembers={staffMembers}
            systemUsers={systemUsers}
            cortesHistory={cortesHistory}
            guardiaRecords={guardiaRecords}
            incidencias={incidencias}
            solicitudesIncremento={solicitudesIncremento}
            currentUserName={userSession?.nombre || userSession?.username}
            userRole={userSession?.role || "admin"}
          />
        )}

        {activeTab === "auditoria" && (
          <SystemAuditManager
            caratulas={effectiveCaratulas}
            clients={clients}
            services={services}
            expenses={expenses}
            abonos={abonos}
            calendarEvents={calendarEvents}
            guardiaRecords={guardiaRecords}
            staffMembers={staffMembers}
            systemUsers={systemUsers}
            inventoryItems={inventoryItems}
            expedienteEntries={expedienteEntries}
            kardexRecords={kardexRecords}
            isOnline={isOnline}
            isQuotaExhausted={isQuotaExhaustedState}
          />
        )}

        {activeTab === "sucursales" && (
          <SucursalesManager
            sucursales={sucursales}
            clients={clients}
            caratulas={effectiveCaratulas}
            abonos={abonos}
            systemUsers={systemUsers}
            currentUserSession={userSession}
            onSaveSucursal={handleSaveSucursal}
            onDeleteSucursal={handleDeleteSucursal}
            onSaveSystemUser={handleSaveSystemUser}
            onSelectBranchContext={(branchId) => {
              setSelectedSucursalId(branchId);
              setActiveTab("historial");
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

      </main>

      {/* Footer */}
      <Footer
        className="mb-14 md:mb-0"
        userType={userSession?.role === "client" ? "cliente" : "personal"}
      />
    </div>
  );
}
