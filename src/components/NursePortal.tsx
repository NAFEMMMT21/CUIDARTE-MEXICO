import React, { useState } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { UserSession, CalendarEvent, ExpedienteEntry, Client, Caratula, VitalsData, ExpedienteType, KardexRecord, StaffMember, GuardiaShiftRecord, InventoryItem, Expense } from "../types";
import { logAuditEvent } from "../services/auditService";
import { CuidarteLogo } from "./CuidarteLogo";
import { LiveClock } from "./LiveClock";
import { CalendarManager } from "./CalendarManager";
import { ExpedienteManager } from "./ExpedienteManager";
import { KardexManager } from "./KardexManager";
import { StaffCredentialCard } from "./StaffCredentialCard";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { InventoryManager } from "./InventoryManager";
import { TermsAndPrivacyModal } from "./TermsAndPrivacyModal";
import { PartnerFeesPanel } from "./PartnerFeesPanel";
import { NotificationToastContainer } from "./NotificationToastContainer";
import { NotificationCenterModal } from "./NotificationCenterModal";
import { useNurseNotificationEngine } from "../hooks/useNurseNotificationEngine";
import { pushNotificationService, AppNotification } from "../services/pushNotificationService";
import { audioNotificationService } from "../services/audioNotificationService";
import { Footer } from "./Footer";
import {
  Stethoscope,
  Calendar,
  Activity,
  LogOut,
  User,
  ShieldCheck,
  PhoneCall,
  Siren,
  Mail,
  Heart,
  Clock,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wifi,
  WifiOff,
  CloudCheck,
  Filter,
  Users,
  MapPin,
  FileSpreadsheet,
  Pill,
  X,
  CreditCard,
  Menu,
  FileSignature,
  FolderCheck,
  Lock,
  Unlock,
  Download,
  Eye,
  FileCheck,
  HardDrive,
  FolderOpen,
  ShieldAlert,
  Bell,
  Volume2,
  DollarSign,
  Coins,
  Wallet
} from "lucide-react";

interface NursePortalProps {
  userSession: UserSession;
  clients: Client[];
  caratulas: Caratula[];
  calendarEvents: CalendarEvent[];
  expedienteEntries: ExpedienteEntry[];
  kardexRecords?: KardexRecord[];
  inventoryItems?: InventoryItem[];
  staffMembers?: StaffMember[];
  guardiaRecords?: GuardiaShiftRecord[];
  expenses?: Expense[];
  onSaveCalendarEvent: (event: CalendarEvent) => void;
  onDeleteCalendarEvent: (id: string) => void;
  onSaveExpedienteEntry: (entry: ExpedienteEntry) => void;
  onDeleteExpedienteEntry: (id: string) => void;
  onSaveKardex?: (record: KardexRecord) => void;
  onSaveInventoryItem?: (item: InventoryItem) => void;
  onDeleteInventoryItem?: (id: string) => void;
  onSaveGuardia?: (guardia: GuardiaShiftRecord) => void;
  onDeleteGuardia?: (id: string) => void;
  onSaveClient?: (client: Client) => void;
  onLogout: () => void;
  isOnline: boolean;
  isSyncing: boolean;
}

export const NursePortal: React.FC<NursePortalProps> = ({
  userSession,
  clients = [],
  caratulas = [],
  calendarEvents = [],
  expedienteEntries = [],
  kardexRecords = [],
  inventoryItems = [],
  staffMembers = [],
  guardiaRecords = [],
  expenses = [],
  onSaveCalendarEvent,
  onDeleteCalendarEvent,
  onSaveExpedienteEntry,
  onDeleteExpedienteEntry,
  onSaveKardex,
  onSaveInventoryItem,
  onDeleteInventoryItem,
  onSaveGuardia,
  onDeleteGuardia,
  onSaveClient,
  onLogout,
  isOnline,
  isSyncing,
}) => {
  const [activeTab, setActiveTab] = useState<
    "agenda" | "expedientes" | "inventario" | "receptores" | "guardias" | "mi-expediente" | "pagos"
  >("agenda");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedReceptorId, setSelectedReceptorId] = useState<string>("all");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<"all" | "today" | "upcoming">("all");
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [previewStaffDoc, setPreviewStaffDoc] = useState<any | null>(null);
  const [previewClinicalDocForNurse, setPreviewClinicalDocForNurse] = useState<any | null>(null);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [initialLegalTab, setInitialLegalTab] = useState<"terminos" | "privacidad">("terminos");

  // Shift Start/End (Iniciar / Finalizar Guardia) Modal States
  const [showStartGuardiaModal, setShowStartGuardiaModal] = useState(false);
  const [showEndGuardiaModal, setShowEndGuardiaModal] = useState(false);

  // Subscribe to Push Notification Service for unread badges and updates
  React.useEffect(() => {
    const unsubscribe = pushNotificationService.subscribe((list) => {
      setUnreadNotificationsCount(list.filter((n) => !n.read).length);
    });
    return () => unsubscribe();
  }, []);

  // Lock body scroll when any modal or drawer in NursePortal is active
  useLockBodyScroll(Boolean(
    showCredentialModal ||
    showNotificationModal ||
    previewStaffDoc ||
    previewClinicalDocForNurse ||
    legalModalOpen ||
    showStartGuardiaModal ||
    showEndGuardiaModal ||
    isMobileMenuOpen
  ));

  const openLegalModal = (tab: "terminos" | "privacidad") => {
    setInitialLegalTab(tab);
    setLegalModalOpen(true);
  };

  // Start Shift Form State
  const [guardiaClientId, setGuardiaClientId] = useState<string>("");
  const [guardiaFolio, setGuardiaFolio] = useState<string>("");
  const [guardiaUbicacion, setGuardiaUbicacion] = useState<string>("");
  const [guardiaNotasInicio, setGuardiaNotasInicio] = useState<string>("Entrega de turno recibida sin novedades. Constantes vitales dentro de parámetros normales.");

  // End Shift Form State
  const [guardiaNotasFin, setGuardiaNotasFin] = useState<string>("Turno finalizado. Receptor de servicio descansando y estable.");
  const [guardiaNovedades, setGuardiaNovedades] = useState<string>("");

  // Nurse assigned shift count and stats
  const nurseId = userSession.nurseId || userSession.username;
  const nurseNombre = userSession.nombre || "";

  // String helpers for robust lookup
  const normalizeStr = (str?: string) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  const extractDigits = (str?: string) => (str || "").replace(/\D/g, "");

  const userNid = userSession.nurseId || "";
  const userUn = userSession.username || "";
  const userNm = userSession.nombre || "";
  const userStaffId = (userSession as any).staffId || (userSession as any).id || "";

  // Staff Member profile lookup for Credential & Access Rules
  const myStaffMember: StaffMember = (staffMembers || []).find((s) => {
    const sId = s.id || "";
    const sNo = s.noSocio || "";
    const sFolio = s.folioUrgencias || "";
    const sFullName = `${s.nombre || ""} ${s.apellidos || ""}`;

    // 1. Direct ID match
    if (
      sId &&
      (sId.toLowerCase() === userNid.toLowerCase() ||
        sId.toLowerCase() === userUn.toLowerCase() ||
        sId.toLowerCase() === userStaffId.toLowerCase())
    ) {
      return true;
    }
    // 2. Socio Number exact or digit match
    if (
      sNo &&
      (extractDigits(sNo) === extractDigits(userNid) ||
        extractDigits(sNo) === extractDigits(userUn) ||
        extractDigits(sNo) === extractDigits(userStaffId))
    ) {
      return true;
    }
    if (
      sNo &&
      (userNid.toLowerCase().includes(sNo.toLowerCase()) ||
        userUn.toLowerCase().includes(sNo.toLowerCase()))
    ) {
      return true;
    }
    // 3. Folio urgencias match
    if (
      sFolio &&
      ((userNid && sFolio.toLowerCase().includes(userNid.toLowerCase())) ||
        (userUn && sFolio.toLowerCase().includes(userUn.toLowerCase())))
    ) {
      return true;
    }
    // 4. Name match (normalized)
    const normSName = normalizeStr(sFullName);
    const normUserNm = normalizeStr(userNm);
    if (normSName && normUserNm && (normSName.includes(normUserNm) || normUserNm.includes(normSName))) {
      return true;
    }
    // 5. First name & last name match
    if (s.nombre && userNm) {
      const normFirst = normalizeStr(s.nombre);
      if (
        normFirst &&
        normUserNm.includes(normFirst) &&
        s.apellidos &&
        normUserNm.includes(normalizeStr(s.apellidos.split(" ")[0]))
      ) {
        return true;
      }
    }
    return false;
  }) || {
    id: `SOC-${nurseId}`,
    noSocio: extractDigits(nurseId) || "25001",
    nombre: (nurseNombre.split(" ")[0] || "Socio").toUpperCase(),
    apellidos: (nurseNombre.split(" ").slice(1).join(" ") || "Cuidarte").toUpperCase(),
    gradoTitulo: "LICENCIADO EN ENFERMERÍA",
    puestoTipoPersonal: "Lic. en Enfermería",
    areaAdscripcion: "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO",
    fotoUrl: "",
    folioUrgencias: `01${extractDigits(nurseId) || "25001"}`,
    fechaExpiracion: "21/08/2030",
    badgePrincipal: "PERSONAL DE ATENCIÓN A URGENCIAS",
    badgesSecundarios: ["DIR GRAL NAL", "R HGO PS"],
    tipoContrato: "Contrato por Prestación de Servicios (Socio Operativo Independiente - Sin Vinculación Laboral)",
    estatus: "Activo",
    bloquearAccesoReceptores: false,
    receptoresRevocadosIds: [],
    timestamp: new Date().toISOString(),
  };

  // ACCESS RESTRICTION EVALUATION
  const isGlobalBlocked = Boolean(myStaffMember.bloquearAccesoReceptores);
  const revokedClientIds = (myStaffMember.receptoresRevocadosIds || []).map((id) => (id || "").trim().toUpperCase());

  // Function to check if a specific client access is blocked or revoked for this staff member
  const isClientAccessDenied = (clientId?: string): boolean => {
    if (isGlobalBlocked) return true;
    if (!clientId) return false;
    return revokedClientIds.includes(clientId.trim().toUpperCase());
  };

  // Staff identification tokens for shift and assignment matching
  const nurseTokens = [
    myStaffMember.id?.toLowerCase().trim(),
    myStaffMember.noSocio?.toLowerCase().trim(),
    extractDigits(myStaffMember.noSocio),
    userSession.nurseId?.toLowerCase().trim(),
    extractDigits(userSession.nurseId),
    userSession.username?.toLowerCase().trim(),
    extractDigits(userSession.username),
    normalizeStr(myStaffMember.nombre),
    normalizeStr(myStaffMember.apellidos),
    normalizeStr(`${myStaffMember.nombre} ${myStaffMember.apellidos}`),
    normalizeStr(userSession.nombre),
  ].filter((t): t is string => Boolean(t && t.length >= 2));

  const isEventAssignedToThisNurse = (ev: CalendarEvent) => {
    const pa = (ev.personalAsignado || "").toLowerCase();
    const sId = (ev.staffId || "").toLowerCase();
    const sNo = (ev.staffNoSocio || "").toLowerCase();
    const sNom = ((ev as any).staffNombre || "").toLowerCase();
    const allEvStaffText = `${pa} ${sId} ${sNo} ${sNom}`.toLowerCase();

    return nurseTokens.some((token) => allEvStaffText.includes(token));
  };

  // Filter calendar events strictly assigned to this nurse ID / nurse name, EXCLUDING any revoked clients
  const allNurseEvents = calendarEvents.filter((ev) => {
    if (!isEventAssignedToThisNurse(ev)) return false;
    if (isClientAccessDenied(ev.clientId)) return false;
    return true;
  });

  // Client assignments detection
  const directlyAssignedClientIds = Array.from(
    new Set([
      ...allNurseEvents.map((ev) => (ev.clientId || "").trim().toUpperCase()).filter(Boolean),
      ...(guardiaRecords || [])
        .filter((g) => {
          const gStaff = `${g.staffId || ""} ${g.staffNoSocio || ""} ${g.staffNombre || ""} ${g.registradoPor || ""}`.toLowerCase();
          return nurseTokens.some((tok) => gStaff.includes(tok));
        })
        .map((g) => (g.clientId || "").trim().toUpperCase())
        .filter(Boolean),
      ...caratulas
        .filter((c) => {
          const cStaff = `${c.personalAsignado || ""} ${c.staffNombre || ""} ${c.staffId || ""}`.toLowerCase();
          return nurseTokens.some((tok) => cStaff.includes(tok));
        })
        .map((c) => (c.id || "").trim().toUpperCase())
        .filter(Boolean),
      ...((myStaffMember as any).receptoresAutorizadosIds || []).map((id: string) => (id || "").trim().toUpperCase()),
    ])
  );

  // Permitted clients: If directly assigned in shifts/guardias/caratulas, show those.
  // If active without direct shifts yet, show active agency clients EXCEPT those revoked.
  const availableAssignedClients = isGlobalBlocked
    ? []
    : clients.filter((c) => {
        if (!c.id) return false;
        const normId = c.id.trim().toUpperCase();
        if (isClientAccessDenied(normId)) return false;
        if (directlyAssignedClientIds.length > 0) {
          return directlyAssignedClientIds.includes(normId);
        }
        return true;
      });

  // Guardias strictly belonging to this nurse / staff member
  const myNurseGuardiaRecords = (guardiaRecords || []).filter((g) => {
    const gStaff = `${g.staffId || ""} ${g.staffNoSocio || ""} ${g.staffNombre || ""} ${g.registradoPor || ""}`.toLowerCase();
    const nid = (nurseId || "").toLowerCase();
    const un = (userSession.username || "").toLowerCase();
    const nm = (nurseNombre || "").toLowerCase();
    const myStaffId = (myStaffMember?.id || "").toLowerCase();
    const myStaffNo = (myStaffMember?.noSocio || "").toLowerCase();
    return (
      (nid && gStaff.includes(nid)) ||
      (un && gStaff.includes(un)) ||
      (nm && gStaff.includes(nm)) ||
      (myStaffId && gStaff.includes(myStaffId)) ||
      (myStaffNo && gStaff.includes(myStaffNo)) ||
      (nid && nid.includes(gStaff))
    );
  });

  // Active shift in course for this staff member
  const activeGuardia = myNurseGuardiaRecords.find((g) => g.estatus === "En Curso");
  const activeClientId = (activeGuardia?.clientId || "").trim();
  const activeClient = activeClientId ? clients.find((c) => (c.id || "").trim().toUpperCase() === activeClientId.toUpperCase()) : null;

  // Background proactive notification engine evaluating shifts & medications with sound alerts
  useNurseNotificationEngine({
    userSession,
    calendarEvents,
    kardexRecords,
    guardiaRecords,
    clients,
    activeGuardia,
  });

  // Action dispatcher from notification toasts or notification center
  const handleNavigateFromNotification = (
    actionType?: AppNotification["actionType"],
    actionPayload?: AppNotification["actionPayload"]
  ) => {
    if (actionType === "open_kardex") {
      if (activeGuardia) {
        setActiveTab("expedientes");
      } else {
        setActiveTab("agenda");
      }
    } else if (actionType === "open_calendar") {
      setActiveTab("agenda");
    } else if (actionType === "start_guardia") {
      setActiveTab("guardias");
      if (actionPayload?.clientId) {
        setGuardiaClientId(actionPayload.clientId);
      }
      setShowStartGuardiaModal(true);
    } else if (actionType === "end_guardia") {
      setActiveTab("guardias");
      setShowEndGuardiaModal(true);
    } else if (actionType === "open_expediente") {
      setActiveTab("expedientes");
    }
  };

  // Auto-sync activeTab when off-duty (clinical records require active shift, agenda is always accessible)
  React.useEffect(() => {
    if (!activeGuardia) {
      if (activeTab === "expedientes" || activeTab === "inventario" || activeTab === "receptores") {
        setActiveTab("guardias");
      }
    }
  }, [activeGuardia]);

  // STRICT SHIFT-BASED PATIENT ISOLATION:
  // When off-duty (!activeGuardia), NO patient records or details are exposed.
  // When on-duty (activeGuardia), all views are strictly locked to the single active patient of this shift.
  const assignedClients = !activeGuardia
    ? []
    : activeClient
    ? [activeClient]
    : activeClientId
    ? clients.filter((c) => (c.id || "").trim().toUpperCase() === activeClientId.toUpperCase())
    : availableAssignedClients;

  const assignedCaratulas = !activeGuardia
    ? []
    : activeClientId
    ? caratulas.filter((c) => (c.id || "").trim().toUpperCase() === activeClientId.toUpperCase())
    : [];

  const allNurseExpedienteEntries = !activeGuardia
    ? []
    : activeClientId
    ? expedienteEntries.filter((exp) => (exp.clientId || "").trim().toUpperCase() === activeClientId.toUpperCase())
    : [];

  const allNurseKardexRecords = !activeGuardia
    ? []
    : activeClientId
    ? (kardexRecords || []).filter((k) => (k.clientId || "").trim().toUpperCase() === activeClientId.toUpperCase())
    : [];

  const allNurseInventoryItems = !activeGuardia
    ? []
    : activeClientId
    ? (inventoryItems || []).filter(
        (item) => !item.clientId || (item.clientId || "").trim().toUpperCase() === activeClientId.toUpperCase()
      )
    : [];

  const filteredClients = assignedClients;
  const filteredCaratulas = assignedCaratulas;
  const filteredNurseExpedientes = allNurseExpedienteEntries;
  const filteredKardexRecords = allNurseKardexRecords;
  const filteredInventoryItems = allNurseInventoryItems;

  const todayStr = new Date().toISOString().split("T")[0];
  const nowStr = new Date().toISOString().slice(0, 16);

  // Helper to test if a calendar event is scheduled for today (or spans across today)
  const isEventScheduledToday = (ev: CalendarEvent) => {
    if (!ev || !ev.fechaInicio) return false;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayIso = `${year}-${month}-${day}`; // "YYYY-MM-DD"
    const todayDdmmyyyy = `${day}/${month}/${year}`; // "DD/MM/YYYY"

    const fInicio = (ev.fechaInicio || "").trim();
    const fFin = (ev.fechaFin || "").trim();

    if (fInicio.startsWith(todayIso) || fInicio.includes(todayDdmmyyyy)) {
      return true;
    }
    const startDay = fInicio.slice(0, 10);
    const endDay = fFin ? fFin.slice(0, 10) : startDay;
    if (startDay <= todayIso && endDay >= todayIso) {
      return true;
    }
    return false;
  };

  // Events scheduled for TODAY for this nurse
  const todayNurseEvents = allNurseEvents.filter((ev) => isEventScheduledToday(ev));

  // Client IDs scheduled for TODAY in the agenda for this nurse
  const scheduledTodayClientIds = Array.from(
    new Set(todayNurseEvents.map((ev) => (ev.clientId || "").trim().toUpperCase()).filter(Boolean))
  );

  // Clients permitted to start shift TODAY (strictly scheduled in agenda for today)
  const clientsScheduledToday = isGlobalBlocked
    ? []
    : clients.filter((c) => {
        if (!c.id) return false;
        const normId = c.id.trim().toUpperCase();
        if (isClientAccessDenied(normId)) return false;
        return scheduledTodayClientIds.includes(normId);
      });

  const filteredNurseEvents = allNurseEvents.filter((ev) => {
    if (activeGuardia && activeClientId && (ev.clientId || "").toUpperCase() !== activeClientId.toUpperCase()) {
      return false;
    }
    const isExpired = (ev.fechaFin && ev.fechaFin < nowStr) || (!ev.fechaFin && ev.fechaInicio < todayStr);
    if (selectedShiftFilter === "today") {
      return isEventScheduledToday(ev);
    } else if (selectedShiftFilter === "upcoming") {
      return !isExpired && (ev.fechaFin ? ev.fechaFin >= nowStr : ev.fechaInicio >= todayStr);
    }
    return true;
  });

  // Pre-select the scheduled client for today if available
  React.useEffect(() => {
    if (!guardiaClientId && clientsScheduledToday.length > 0) {
      setGuardiaClientId(clientsScheduledToday[0].id);
      if (clientsScheduledToday[0].direccionServicio) {
        setGuardiaUbicacion(clientsScheduledToday[0].direccionServicio);
      }
    } else if (guardiaClientId && !clientsScheduledToday.some((c) => c.id === guardiaClientId)) {
      if (clientsScheduledToday.length > 0) {
        setGuardiaClientId(clientsScheduledToday[0].id);
        if (clientsScheduledToday[0].direccionServicio) {
          setGuardiaUbicacion(clientsScheduledToday[0].direccionServicio);
        }
      } else {
        setGuardiaClientId("");
      }
    }
  }, [clientsScheduledToday, guardiaClientId]);

  const handleStartGuardiaSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!guardiaClientId) {
      alert("Debe seleccionar un receptor de servicio.");
      return;
    }

    // Strict validation: Must have this patient scheduled TODAY in the agenda
    const isScheduledToday = clientsScheduledToday.some(
      (c) => (c.id || "").trim().toUpperCase() === guardiaClientId.trim().toUpperCase()
    );

    if (!isScheduledToday) {
      alert(
        "No es posible iniciar turno: Solo puede abrir guardia con pacientes que tenga asignados y programados en la agenda para el día de hoy."
      );
      return;
    }

    const selectedClient = clients.find((c) => c.id === guardiaClientId);
    const now = new Date();
    const formattedDate = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const horaInicioStr = now.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " hrs";

    const newGuardia: GuardiaShiftRecord = {
      id: `GUA-${Date.now()}`,
      staffId: myStaffMember.id || nurseId,
      staffNoSocio: myStaffMember.noSocio || nurseId,
      staffNombre: `${myStaffMember.nombre} ${myStaffMember.apellidos}`.trim() || nurseNombre || userSession.username,
      clientId: guardiaClientId || undefined,
      clientNombre: selectedClient?.nombreCompletoCliente || selectedClient?.nombreCompletoRS || undefined,
      caratulaFolio: guardiaFolio || undefined,
      fechaInicioIso: now.toISOString(),
      fechaInicioFormateada: formattedDate,
      horaInicio: horaInicioStr,
      notasInicio: guardiaNotasInicio,
      ubicacionEntrada: guardiaUbicacion || selectedClient?.direccionServicio || undefined,
      estatus: "En Curso",
      registradoPor: userSession.nombre || userSession.username,
      timestamp: now.toISOString(),
    };

    if (onSaveGuardia) {
      onSaveGuardia(newGuardia);
      logAuditEvent({
        tipoAccion: "INICIO_TURNO_ENFERMERIA",
        descripcion: `Inicio de guardia por ${newGuardia.staffNombre} (Folio: ${newGuardia.folioGuardia || newGuardia.id}) - Paciente: ${newGuardia.clientNombre || "No especificado"}`,
        usuarioUx: userSession.username || `SOCP-${nurseId}`,
        usuarioNombre: userSession.nombre || userSession.username,
        rol: "nurse",
        folioReferencia: newGuardia.folioGuardia || newGuardia.id,
        clienteIdReferencia: newGuardia.clientId,
        detalles: {
          guardiaId: newGuardia.id,
          folio: newGuardia.folioGuardia,
          paciente: newGuardia.clientNombre,
          horaInicio: newGuardia.horaInicio,
        },
      }).catch((e) => console.warn("[Audit] Error al registrar inicio de guardia:", e));
    }
    setShowStartGuardiaModal(false);
    setActiveTab("expedientes");
  };

  const handleEndGuardiaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGuardia) return;

    const now = new Date();
    const startObj = new Date(activeGuardia.fechaInicioIso);
    const durMinutes = Math.round((now.getTime() - startObj.getTime()) / (1000 * 60));

    const formattedDate = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const horaFinStr = now.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " hrs";

    const updatedGuardia: GuardiaShiftRecord = {
      ...activeGuardia,
      fechaFinIso: now.toISOString(),
      fechaFinFormateada: formattedDate,
      horaFin: horaFinStr,
      notasFin: guardiaNotasFin,
      novedadesEntrega: guardiaNovedades,
      duracionMinutos: Math.max(1, durMinutes),
      estatus: "Finalizada",
    };

    if (onSaveGuardia) {
      onSaveGuardia(updatedGuardia);
      logAuditEvent({
        tipoAccion: "FIN_TURNO_ENFERMERIA",
        descripcion: `Conclusión de guardia por ${updatedGuardia.staffNombre} (Folio: ${updatedGuardia.folioGuardia || updatedGuardia.id}) - Paciente: ${updatedGuardia.clientNombre || "No especificado"} (${durMinutes} min)`,
        usuarioUx: userSession.username || `SOCP-${nurseId}`,
        usuarioNombre: userSession.nombre || userSession.username,
        rol: "nurse",
        folioReferencia: updatedGuardia.folioGuardia || updatedGuardia.id,
        clienteIdReferencia: updatedGuardia.clientId,
        detalles: {
          guardiaId: updatedGuardia.id,
          folio: updatedGuardia.folioGuardia,
          duracionMinutos: durMinutes,
          novedades: updatedGuardia.novedadesEntrega,
        },
      }).catch((e) => console.warn("[Audit] Error al registrar fin de guardia:", e));
    }
    setShowEndGuardiaModal(false);
    setActiveTab("guardias");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-24">
      {/* NURSE PORTAL HEADER */}
      <header className="bg-slate-900 text-white shadow-xl border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Logo & Portal Identity */}
            <div className="flex items-center gap-3">
              <div
                className="bg-white px-3 py-1.5 flex items-center justify-center border border-slate-200"
                style={{ borderRadius: "12px" }}
              >
                <CuidarteLogo
                  size="sm"
                  showTagline={true}
                  variant="header"
                  sucursalId={userSession.sucursalId}
                  sucursalNombre={userSession.sucursalNombre || "Cuidarte Pachuca"}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                    <Stethoscope className="w-3 h-3 text-emerald-400" />
                    PORTAL ATENCIÓN / PERSONAL
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                  CUIDADO INTEGRAL, CONFIANZA TOTAL
                </p>
              </div>
            </div>

            {/* Nurse Badges, Online Indicators & Session Info */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              {/* Live Clock Display (Hidden on mobile for better visualization) */}
              <div className="hidden lg:block">
                <LiveClock variant="compact" />
              </div>

              {/* Online & Sync Badge (Hidden on mobile/tablet header) */}
              <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs shrink-0">
                {isOnline ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>En Línea</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Sin Red</span>
                  </span>
                )}

                <span className="text-slate-600">|</span>

                {isSyncing ? (
                  <span className="text-amber-300 animate-pulse text-[11px]">Guardando...</span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-300 text-[11px]">
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sincronizado</span>
                  </span>
                )}
              </div>

              {/* Notification Bell & Sound Settings Button */}
              <button
                onClick={() => setShowNotificationModal(true)}
                className={`relative px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0 ${
                  unreadNotificationsCount > 0
                    ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 ring-1 ring-amber-500/30"
                    : "bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
                title="Centro de Notificaciones y Avisos con Sonido"
              >
                <div className="relative">
                  <Bell className={`w-3.5 h-3.5 ${unreadNotificationsCount > 0 ? "text-amber-400 animate-bounce" : "text-slate-400"}`} />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white font-extrabold text-[9px] min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline">Avisos</span>
              </button>

              {/* Credential Modal Button */}
              <button
                onClick={() => setShowCredentialModal(true)}
                className="bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 border border-sky-500/40 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                title="Ver Mi Credencial Digital Oficial"
              >
                <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Mi Credencial</span>
              </button>

              {/* 2-LINE INFORMATION CONTAINER (Estructura organizada, holgada y sin encimarse) */}
              <div className="bg-slate-800/90 border border-slate-700/80 px-3 py-1.5 rounded-xl flex-1 sm:flex-initial min-w-0">
                {/* Línea 1: Nombre de personal y badge de número de personal activo */}
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-x-2 gap-y-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-black text-emerald-300 truncate" title={userSession.nombre || nurseId}>
                      {userSession.nombre || nurseId}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-200 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 shrink-0 whitespace-nowrap">
                    No. {myStaffMember.noSocio || nurseId} • Activo
                  </span>
                </div>

                {/* Línea 2: Puesto / Función y estado de conexión */}
                <div className="flex items-center justify-between sm:justify-end gap-2 mt-1 pt-1 border-t border-slate-700/50 text-[10px] text-slate-400">
                  <span className="truncate text-slate-300 font-medium" title={myStaffMember.puestoTipoPersonal || "Lic. en Enfermería"}>
                    {myStaffMember.puestoTipoPersonal || "Lic. en Enfermería"}
                  </span>
                  
                  {/* Status indicators for mobile / compact view */}
                  <div className="flex items-center gap-1.5 md:hidden shrink-0 whitespace-nowrap">
                    {isOnline ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wifi className="w-3 h-3" /> En línea
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <WifiOff className="w-3 h-3" /> Sin red
                      </span>
                    )}
                    <span className="text-slate-600">•</span>
                    {isSyncing ? (
                      <span className="text-amber-300 animate-pulse text-[9px]">Guardando...</span>
                    ) : (
                      <span className="text-slate-300 flex items-center gap-0.5 text-[9px]">
                        <CloudCheck className="w-3 h-3 text-emerald-400" /> Sinc
                      </span>
                    )}
                  </div>

                  <span className="hidden md:inline text-[10px] text-slate-500 font-medium shrink-0">
                    Personal de Guardia Autorizado
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>

              {/* Mobile Menu Hamburger Toggle (Visible only on mobile) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-xl border border-slate-700 transition shrink-0"
                aria-label="Menú del Portal"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5 text-emerald-400" />}
              </button>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <div className="hidden md:flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto">
            {activeGuardia ? (
              <>
                <button
                  onClick={() => setActiveTab("expedientes")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "expedientes"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Expediente Digital & Kárdex</span>
                  <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                    {filteredNurseExpedientes.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("inventario")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "inventario"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Pill className="w-4 h-4 text-emerald-400" />
                  <span>Control Insumos / Kardex</span>
                  <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                    {inventoryItems.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("receptores")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "receptores"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Receptor Asignado</span>
                  <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                    {assignedClients.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("agenda")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "agenda"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Mi Agenda de Turnos</span>
                  <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                    {filteredNurseEvents.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("guardias")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "guardias"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Mi Guardia en Curso</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab("guardias")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "guardias"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Iniciar Turno / Control de Guardias</span>
                </button>

                <button
                  onClick={() => setActiveTab("agenda")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    activeTab === "agenda"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span>Mi Agenda de Turnos</span>
                  <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                    {filteredNurseEvents.length}
                  </span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab("mi-expediente")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "mi-expediente"
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-900/40"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <FileSignature className="w-4 h-4 text-sky-300" />
              <span>Mi Contrato & Expediente</span>
              <span className="bg-sky-950 text-sky-200 px-2 py-0.5 rounded-full text-[10px]">
                {myStaffMember.documentos?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pagos")}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "pagos"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-300" />
              <span>Mis Honorarios & Pagos</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Slide-Over Drawer */}
        {isMobileMenuOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
            }}
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm md:hidden flex justify-end animate-fadeIn overscroll-none"
          >
            <div className="bg-slate-900 w-[85vw] max-w-sm min-h-full h-auto border-l border-slate-800 p-5 flex flex-col justify-start space-y-4 shadow-2xl overflow-y-auto overscroll-contain pb-36">
              <div className="space-y-4 min-h-0">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                      N
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">Portal Enfermería</h3>
                      <p className="text-[11px] text-slate-400">Operaciones Clínicas Cuidarte</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                    aria-label="Cerrar menú"
                  >
                    <X className="w-5 h-5 text-rose-400" />
                  </button>
                </div>

                {/* Nurse Profile Snapshot */}
                <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                      {myStaffMember.nombre?.[0] || "E"}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white truncate max-w-[150px]">
                        {myStaffMember.nombre} {myStaffMember.apellidos}
                      </p>
                      <p className="text-[10px] text-emerald-400 font-mono">ID: {myStaffMember.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setShowNotificationModal(true);
                      }}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 relative"
                    >
                      <Bell className="w-3 h-3 text-amber-400" />
                      <span>Avisos</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-ping" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setShowCredentialModal(true);
                      }}
                      className="px-2 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>Credencial</span>
                    </button>
                  </div>
                </div>

                {/* Navigation Items List */}
                <div className="space-y-1.5 pt-1">
                  {activeGuardia ? (
                    <>
                      <button
                        onClick={() => {
                          setActiveTab("expedientes");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "expedientes" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Activity className="w-4 h-4 text-emerald-300" />
                          <span>Expediente Digital & Kárdex</span>
                        </div>
                        <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {filteredNurseExpedientes.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("inventario");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "inventario" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Pill className="w-4 h-4 text-emerald-300" />
                          <span>Control Insumos / Kardex</span>
                        </div>
                        <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {inventoryItems.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("receptores");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "receptores" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-emerald-300" />
                          <span>Receptor Asignado</span>
                        </div>
                        <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {assignedClients.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("agenda");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "agenda" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-emerald-300" />
                          <span>Agenda del Turno</span>
                        </div>
                        <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {filteredNurseEvents.length}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("guardias");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "guardias" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-emerald-300" />
                          <span>Guardia Activa / Historial</span>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setActiveTab("guardias");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "guardias" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-emerald-300" />
                          <span>Iniciar Turno / Control de Guardias</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab("agenda");
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                          activeTab === "agenda" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-emerald-300" />
                          <span>Mi Agenda de Turnos</span>
                        </div>
                        <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          {filteredNurseEvents.length}
                        </span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setActiveTab("mi-expediente");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "mi-expediente" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileSignature className="w-4 h-4 text-sky-300" />
                      <span>Mi Contrato & Expediente</span>
                    </div>
                    <span className="bg-sky-950 text-sky-200 px-2 py-0.5 rounded-full text-[10px]">
                      {myStaffMember.documentos?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("pagos");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "pagos" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-emerald-300" />
                      <span>Mis Honorarios & Pagos</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openLegalModal("terminos");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] text-sky-300 hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <FileSignature className="w-4 h-4 text-sky-400" />
                      <span>Términos y Reglamento de Socio</span>
                    </div>
                  </button>

                  {/* Logout & Footer */}
                  <div className="pt-6 border-t border-slate-800 mt-6 shrink-0 pb-16">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold p-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition min-h-[44px]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-36 md:pb-12">
        {/* CONTROL DE GUARDIA Y ESTADO DEL PORTAL */}
        {activeGuardia ? (
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 p-6 rounded-3xl border-2 border-emerald-500/80 shadow-2xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-400/40 shrink-0">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-emerald-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-emerald-400">
                    🟢 GUARDIA EN CURSO • TURNO ACTIVO
                  </span>
                  <span className="bg-emerald-950/80 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600/40">
                    Socio: {myStaffMember.noSocio || nurseId}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {activeClient?.nombreCompletoRS || activeClient?.nombreCompletoCliente || activeGuardia.clientNombre || activeClientId}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                  <span>
                    <strong>Iniciado:</strong> {activeGuardia.fechaInicioFormateada}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Ubicación:</strong> {activeGuardia.ubicacionEntrada || activeClient?.direccionServicio || "Pachuca, Hgo."}
                  </span>
                  {activeGuardia.caratulaFolio && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Folio:</strong> {activeGuardia.caratulaFolio}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto flex items-center justify-end">
              <button
                onClick={() => setShowEndGuardiaModal(true)}
                className="w-full md:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-2xl shadow-xl shadow-rose-950/50 flex items-center justify-center gap-2 transition-all border border-rose-400/40"
              >
                <Clock className="w-4 h-4" />
                <span>🔴 FINALIZAR GUARDIA ACTIVA</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-slate-800 text-slate-400 rounded-2xl border border-slate-700 shrink-0">
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-slate-800 text-slate-300 font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full border border-slate-700">
                    ⚪ FUERA DE GUARDIA • MODO PROTEGIDO
                  </span>
                  <span className="bg-sky-500/20 text-sky-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-400/30">
                    No. Socio: {myStaffMember.noSocio || nurseId}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Bienvenido(a), <span className="text-emerald-400">{myStaffMember.nombre} {myStaffMember.apellidos}</span>
                </h2>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  {clientsScheduledToday.length > 0
                    ? `Tiene ${clientsScheduledToday.length} paciente(s) programado(s) en su agenda para el día de hoy (${new Date().toLocaleDateString("es-MX")}). Inicie guardia para acceder a su expediente clínico y kárdex.`
                    : `No tiene pacientes programados en la agenda para el día de hoy (${new Date().toLocaleDateString("es-MX")}). Para acceder a un expediente, la administración debe asignarle un turno previo en la agenda.`}
                </p>
              </div>
            </div>

            <div className="shrink-0 w-full md:w-auto flex flex-wrap items-center justify-end gap-2.5">
              <button
                onClick={() => setActiveTab("agenda")}
                className="w-full sm:w-auto px-5 py-3 bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>📅 Ver Mi Agenda ({allNurseEvents.length})</span>
              </button>

              {clientsScheduledToday.length > 0 && (
                <button
                  onClick={() => setShowStartGuardiaModal(true)}
                  className="w-full sm:w-auto px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all border border-emerald-300"
                >
                  <Clock className="w-4 h-4" />
                  <span>🟢 INICIAR GUARDIA DE HOY</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TARJETA OFICIAL DE MEMBRESÍA CUIDARTE PACHUCA ACTIVA (INICIO / DEBAJO DE LA BIENVENIDA) */}
        {!myStaffMember.tipoContrato?.toLowerCase().includes("empleado") && myStaffMember.tipoPersonalClasificacion !== "empleado" && (
          <div className="bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 p-5 sm:p-6 rounded-3xl border-2 border-amber-500/60 shadow-2xl text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/30 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/40 shrink-0 shadow-inner">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-400/40 tracking-wider">
                    <span>Socio Cuidarte Pachuca</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                    <span>Membresía Cuidarte Pachuca Activa</span>
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    La membresía institucional Cuidarte Pachuca da acceso a asignaciones de guardias y turnos según su perfil profesional ({myStaffMember.puestoTipoPersonal || "Lic. en Enfermería"}).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {myStaffMember.membresiaActiva !== false && (myStaffMember.membresiaEstatus === "Activa" || !myStaffMember.membresiaEstatus) ? (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/70 text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Membresía Activa</span>
                  </span>
                ) : (
                  <span className="bg-rose-950 text-rose-300 border border-rose-500/70 text-xs font-black px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Membresía: {myStaffMember.membresiaEstatus || "Pausada"}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              {/* Cuota por servicio asignado */}
              <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-800 space-y-1.5 shadow-sm">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  Cuota por Servicio Asignado
                </span>
                <div className="text-2xl font-black font-mono text-amber-300">
                  ${myStaffMember.membresiaCostoPorServicio ?? 50} <span className="text-xs text-slate-400 font-sans font-bold">MXN</span>
                </div>
                <span className="text-[11px] text-slate-400 block leading-tight">
                  Se cubre después de cada servicio asignado.
                </span>
              </div>

              {/* Folio de Socio asignado en su credencial */}
              <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-800 space-y-1.5 shadow-sm">
                <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block">
                  Folio de Socio (Credencial)
                </span>
                <div className="text-lg font-black font-mono text-slate-100 tracking-wider">
                  No. {myStaffMember.noSocio || nurseId}
                </div>
                <span className="text-[11px] text-slate-400 block leading-tight">
                  Folio institucional asignado en su credencial oficial.
                </span>
              </div>

              {/* Confirmación de recepción de ofertas de guardias */}
              <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-800 space-y-1.5 shadow-sm">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">
                  Recepción de Ofertas de Guardias
                </span>
                <div className="flex items-center gap-2">
                  {myStaffMember.ofertasGuardiasHabilitadas !== false ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-base font-black text-emerald-300">Habilitada • Activa</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-400"></span>
                      <span className="text-base font-black text-rose-300">Pausada</span>
                    </>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 block leading-tight">
                  {myStaffMember.ofertasGuardiasHabilitadas !== false
                    ? "Acceso a asignaciones de guardias habilitado según perfil."
                    : "Recepción de convocatorias en pausa administrativa."}
                </span>
              </div>
            </div>

            {myStaffMember.membresiaNotas && (
              <div className="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                <strong className="text-amber-300 shrink-0">Observaciones:</strong>
                <span>{myStaffMember.membresiaNotas}</span>
              </div>
            )}
          </div>
        )}

        {/* PERMANENT CONFIDENTIALITY NOTICE FOR STAFF */}
        <div className="bg-amber-950/90 border border-amber-500/70 p-4 rounded-3xl text-amber-200 space-y-1.5 shadow-md print:hidden">
          <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>Aviso de Confidencialidad e Integridad de Información Obligatorio</span>
          </div>
          <p className="text-xs text-amber-100/95 font-medium leading-relaxed">
            Queda estrictamente prohibido extraer, copiar, fotografiar, respaldar, capturar pantalla o divulgar datos personales, fotografías, información de servicios o registros de expedientes de este portal sin autorización previa por escrito emitida por Cuidarte Pachuca.
          </p>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === "agenda" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Agenda de Guardias y Turnos Asignados
                </h3>
                <p className="text-xs text-slate-500">
                  Muestra la programación oficial de guardias y servicios autorizados por la administración para su número de personal ({nurseId || myStaffMember.noSocio}). Modo solo consulta: los socios no tienen autorización para agregar, modificar ni eliminar guardias o calendarios.
                </p>
              </div>
            </div>

            {filteredNurseEvents.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <Calendar className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-800 text-base">Sin turnos asignados en esta selección</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No hay guardias registradas para el filtro seleccionado. Si la administración asigna un servicio indicando su código ({nurseId || myStaffMember.noSocio}), aparecerá automáticamente.
                </p>
              </div>
            ) : (
              <CalendarManager
                events={filteredNurseEvents}
                clients={clients}
                caratulas={caratulas}
                staffMembers={staffMembers}
                guardiaRecords={guardiaRecords}
                readOnly={true}
                userRole="nurse"
                currentUserName={userSession.nombre || userSession.username}
              />
            )}
          </div>
        )}

        {activeTab === "expedientes" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Expediente Digital de Receptores de Servicio Asignados
                </h3>
                <p className="text-xs text-slate-500">
                  Registre toma de signos vitales, bitácora de guardia y notas de atención durante su turno.
                </p>
              </div>
            </div>

            {myStaffMember.bloquearAccesoReceptores ? (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center border border-rose-300 shadow-sm">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-black text-rose-950">Acceso a Expedientes Restringido</h4>
                <p className="text-xs text-rose-800 max-w-lg mx-auto leading-relaxed">
                  Por disposición de la Administración de Cuidarte Pachuca, el acceso a la consulta y captura de notas clínicas, signos vitales y kárdex de pacientes se encuentra deshabilitado para su usuario.
                </p>
                {myStaffMember.motivoBloqueoAcceso && (
                  <div className="inline-block bg-white text-rose-900 border border-rose-300 px-4 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm">
                    Motivo: {myStaffMember.motivoBloqueoAcceso}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 pt-2">
                  Si considera que esto es un error o requiere restablecer su acceso para una guardia activa, comuníquese con Dirección al 771 454 0072.
                </p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <Activity className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-800 text-base">Sin receptores de servicio asignados</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No cuenta con receptores de servicio asignados por la administración para este filtro.
                </p>
              </div>
            ) : (
              <ExpedienteManager
                entries={filteredNurseExpedientes}
                clients={filteredClients}
                caratulas={filteredCaratulas}
                calendarEvents={allNurseEvents.length > 0 ? allNurseEvents : calendarEvents}
                guardiaRecords={guardiaRecords}
                activeGuardia={activeGuardia}
                kardexRecords={kardexRecords}
                inventoryItems={inventoryItems}
                onSaveEntry={onSaveExpedienteEntry}
                onDeleteEntry={onDeleteExpedienteEntry}
                onSaveKardex={onSaveKardex}
                onSaveInventoryItem={onSaveInventoryItem}
                onSaveClient={onSaveClient}
                readOnly={false}
                userRole="nurse"
                currentUserName={userSession.nombre || userSession.username}
                filterClientId={activeClientId || undefined}
              />
            )}
          </div>
        )}

        {activeTab === "inventario" && (
          <div>
            {myStaffMember.bloquearAccesoReceptores ? (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center border border-rose-300 shadow-sm">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-black text-rose-950">Acceso a Inventarios Restringido</h4>
                <p className="text-xs text-rose-800 max-w-lg mx-auto leading-relaxed">
                  El acceso al control de inventario de medicamentos e insumos se encuentra temporalmente restringido por la Administración.
                </p>
              </div>
            ) : assignedClients.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-800 text-base">Sin receptores de servicio asignados</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  La administración aún no le ha asignado receptores de servicio para visualizar o gestionar inventario de insumos.
                </p>
              </div>
            ) : (
              <InventoryManager
                inventoryItems={inventoryItems}
                clients={assignedClients}
                caratulas={assignedCaratulas}
                kardexRecords={kardexRecords}
                onSaveItem={onSaveInventoryItem || (() => {})}
                onDeleteItem={onDeleteInventoryItem}
                userRole="nurse"
                currentUserName={userSession.nombre || userSession.username}
                filterClientId={activeClientId || (selectedReceptorId !== "all" ? selectedReceptorId : undefined)}
              />
            )}
          </div>
        )}

        {activeTab === "receptores" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Información Autorizada de Receptores de Servicio Asignados
                </h3>
                <p className="text-xs text-slate-500">
                  Consulta diagnóstico, especificaciones de cuidado e indicaciones autorizadas para sus receptores de servicio de guardia.
                </p>
              </div>
            </div>

            {myStaffMember.bloquearAccesoReceptores ? (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-3xl p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center border border-rose-300 shadow-sm">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-black text-rose-950">Acceso a Datos de Clientes Restringido</h4>
                <p className="text-xs text-rose-800 max-w-lg mx-auto leading-relaxed">
                  Por disposición administrativa, se ha revocado la visualización de datos de contacto, domicilios y diagnósticos de clientes y receptores de servicio para este usuario.
                </p>
                {myStaffMember.motivoBloqueoAcceso && (
                  <div className="inline-block bg-white text-rose-900 border border-rose-300 px-4 py-1.5 rounded-full text-xs font-bold font-mono shadow-sm">
                    Motivo: {myStaffMember.motivoBloqueoAcceso}
                  </div>
                )}
              </div>
            ) : assignedClients.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500 space-y-3">
                <Users className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-800 text-base">Sin receptores de servicio asignados</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  La administración aún no le ha asignado receptores de servicio.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignedClients.map((client) => {
                  const clientCaratula = assignedCaratulas.find(
                    (c) => (c.id || "").toUpperCase() === (client.id || "").toUpperCase()
                  );
                  const clientEvents = allNurseEvents.filter(
                    (e) => (e.clientId || "").toUpperCase() === (client.id || "").toUpperCase()
                  );

                  return (
                    <div
                      key={client.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4"
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono">
                            {client.id}
                          </span>
                          <h4 className="font-black text-slate-900 text-lg mt-1">
                            {client.nombreCompletoRS || client.nombreCompletoCliente}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Familiar / Titular: {client.nombreCompletoCliente}
                          </p>
                        </div>
                        <div className="bg-slate-100 p-2 rounded-xl text-center">
                          <span className="text-[10px] text-slate-500 block font-bold">Edad</span>
                          <span className="text-sm font-black text-slate-800">{client.edad || "N/D"}</span>
                        </div>
                      </div>

                      {/* Clinical Info */}
                      <div className="space-y-2 text-xs">
                        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80">
                          <span className="font-bold text-amber-900 block mb-0.5">Diagnóstico Autorizado:</span>
                          <p className="text-amber-800 font-medium">
                            {client.diagnostico || "Sin diagnóstico registrado"}
                          </p>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-0.5">Especificaciones de Cuidado:</span>
                          <p className="text-slate-700">
                            {client.especificaciones || "Cuidado integral, confianza total."}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600 bg-sky-50 p-2.5 rounded-xl border border-sky-100">
                          <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-bold text-slate-700">Dirección de Servicio:</span>
                          <span className="text-slate-800 truncate">{client.direccionServicio || "Pachuca, Hgo."}</span>
                        </div>
                      </div>

                      {/* Shifts Summary */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Próximos Turnos Programados ({clientEvents.length}):
                        </span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {clientEvents.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No hay guardias activas registradas</span>
                          ) : (
                            clientEvents.map((ev) => (
                              <div
                                key={ev.id}
                                className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                              >
                                <div className="font-bold text-slate-800">{ev.titulo}</div>
                                <div className="text-[11px] font-mono text-slate-600">
                                  {ev.fechaInicio?.replace("T", " ")}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: MI CONTRATO Y EXPEDIENTE DIGITAL PERSONAL */}
        {activeTab === "mi-expediente" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white p-6 rounded-3xl border border-sky-800/60 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 text-[11px] font-bold px-3 py-1 rounded-full border border-sky-400/30">
                    <FileSignature className="w-3.5 h-3.5 text-sky-400" />
                    <span>EXPEDIENTE DIGITAL & CONTRATO OFICIAL</span>
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    Mi Contrato & Documentos Personales
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl">
                    Consulte y descargue su contrato oficial de prestación de servicios y documentación cargada por la Dirección Administrativa de Cuidarte Pachuca.
                  </p>
                </div>

                <div className="bg-sky-950/80 border border-sky-700/60 rounded-2xl p-3.5 text-right shrink-0">
                  <span className="text-[10px] text-sky-300 font-bold uppercase tracking-wider block">Documentos Registrados</span>
                  <span className="text-2xl font-black text-white font-mono">{myStaffMember.documentos?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Privacy notice banner */}
            <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl flex items-start gap-3 text-sky-900 text-xs">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Privacidad Estricta de Expediente de Personal</span>
                <p className="text-sky-800 text-[11px] mt-0.5">
                  Estos documentos y contratos son confidenciales y son visibles únicamente por usted y por la Administración General de Cuidarte Pachuca. Ningún otro usuario, cliente o personal tiene acceso a esta información.
                </p>
              </div>
            </div>

            {/* SECCIÓN MEMBRESÍA CUIDARTE PACHUCA (PARA SOCIOS) */}
            {!myStaffMember.tipoContrato?.toLowerCase().includes("empleado") && myStaffMember.tipoPersonalClasificacion !== "empleado" && (
              <div className="bg-gradient-to-br from-amber-950/80 via-slate-900 to-slate-950 p-6 rounded-3xl border-2 border-amber-500/50 shadow-xl text-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-400/40 shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-400/40">
                        <span>Socio Cuidarte Pachuca</span>
                      </div>
                      <h4 className="text-lg sm:text-xl font-black text-white mt-1">
                        Membresía Cuidarte Pachuca Activa
                      </h4>
                      <p className="text-xs text-slate-300">
                        La membresía institucional Cuidarte Pachuca da acceso a asignaciones de guardias y turnos según su perfil profesional ({myStaffMember.puestoTipoPersonal || "Lic. en Enfermería"}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {myStaffMember.membresiaActiva !== false && (myStaffMember.membresiaEstatus === "Activa" || !myStaffMember.membresiaEstatus) ? (
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-xs font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Membresía Activa</span>
                      </span>
                    ) : (
                      <span className="bg-rose-950 text-rose-300 border border-rose-500/60 text-xs font-black px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>Membresía: {myStaffMember.membresiaEstatus || "Pausada"}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                  <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cuota por Servicio Asignado</span>
                    <div className="text-xl font-black font-mono text-amber-300">
                      ${myStaffMember.membresiaCostoPorServicio ?? 50} <span className="text-xs text-slate-400 font-sans font-bold">MXN</span>
                    </div>
                    <span className="text-[10.5px] text-slate-400 block leading-tight">
                      Se cubre después de cada servicio asignado.
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Folio de Socio (Credencial)</span>
                    <div className="text-sm font-black font-mono text-slate-100 uppercase tracking-wider">
                      No. {myStaffMember.noSocio || nurseId}
                    </div>
                    <span className="text-[10.5px] text-slate-400 block leading-tight">
                      Folio asignado en su credencial oficial.
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recepción de Ofertas de Guardias</span>
                    <div className="flex items-center gap-1.5">
                      {myStaffMember.ofertasGuardiasHabilitadas !== false ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-sm font-black text-emerald-300">Habilitada • Activa</span>
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                          <span className="text-sm font-black text-rose-300">Pausada</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10.5px] text-slate-400 block leading-tight">
                      {myStaffMember.ofertasGuardiasHabilitadas !== false
                        ? "Acceso a asignaciones de guardias según perfil."
                        : "Recepción de ofertas pausada temporalmente."}
                    </span>
                  </div>
                </div>

                {myStaffMember.membresiaNotas && (
                  <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300">
                    <strong className="text-amber-300">Notas de membresía:</strong> {myStaffMember.membresiaNotas}
                  </div>
                )}
              </div>
            )}

            {/* CONTRATO OFICIAL SECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-sky-600" />
                  Contrato Oficial de Prestación de Servicios / Laboral
                </h4>
                {myStaffMember.documentos?.some((d) => d.tipo === "Contrato") && (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Contrato Vigente
                  </span>
                )}
              </div>

              {myStaffMember.documentos?.filter((d) => d.tipo === "Contrato").length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-200 text-center space-y-3">
                  <FileSignature className="w-12 h-12 mx-auto text-slate-300" />
                  <h5 className="font-bold text-slate-800 text-sm">Contrato en Proceso de Carga Administrativa</h5>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Su contrato oficial está siendo digitalizado por la Dirección Administrativa de Cuidarte Pachuca. Una vez cargado, podrá visualizarlo y descargarlo en formato PDF en esta sección.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myStaffMember.documentos
                    ?.filter((d) => d.tipo === "Contrato")
                    .map((contrato) => (
                      <div
                        key={contrato.id}
                        className="bg-white rounded-2xl p-5 border-2 border-sky-300 shadow-md space-y-4 hover:shadow-lg transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-sky-100 text-sky-700 rounded-xl border border-sky-200">
                              <FileSignature className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="bg-sky-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                Contrato Oficial
                              </span>
                              <h5 className="font-black text-slate-900 text-sm mt-1">{contrato.nombre}</h5>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Subido el {contrato.fechaSubida} • {contrato.tamano}
                              </p>
                            </div>
                          </div>
                        </div>

                        {contrato.notas && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 italic">
                            "{contrato.notas}"
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewStaffDoc(contrato)}
                            className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Visualizar Contrato</span>
                          </button>

                          <a
                            href={contrato.archivoUrl}
                            download={contrato.nombre || "Contrato_Cuidarte.pdf"}
                            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-300"
                          >
                            <Download className="w-4 h-4 text-slate-600" />
                            <span>Descargar</span>
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* OTROS DOCUMENTOS PERSONALES (Cédula, INE, Comprobante, etc.) */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <FolderCheck className="w-5 h-5 text-emerald-600" />
                  Documentos Personales y Certificaciones en Expediente
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  {myStaffMember.documentos?.filter((d) => d.tipo !== "Contrato").length || 0} archivo(s)
                </span>
              </div>

              {myStaffMember.documentos?.filter((d) => d.tipo !== "Contrato").length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2 text-slate-400">
                  <FolderOpen className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs text-slate-500 font-medium">
                    No hay otros documentos adicionales registrados actualmente en su expediente digital.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myStaffMember.documentos
                    ?.filter((d) => d.tipo !== "Contrato")
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                              {doc.tipo}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{doc.tamano}</span>
                          </div>

                          <h5 className="font-bold text-slate-900 text-xs line-clamp-2">{doc.nombre}</h5>

                          <p className="text-[10px] text-slate-500 font-mono">
                            Cargado: {doc.fechaSubida}
                          </p>

                          {doc.notas && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              {doc.notas}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewStaffDoc(doc)}
                            className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>

                          <a
                            href={doc.archivoUrl}
                            download={doc.nombre}
                            className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all border border-slate-300"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar</span>
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MIS HONORARIOS & DESGLOSE DE PAGOS (CLUB DE SOCIOS CUIDARTE PACHUCA) */}
        {activeTab === "pagos" && (
          <PartnerFeesPanel
            myStaffMember={myStaffMember}
            userSession={userSession}
            caratulas={caratulas}
            allNurseEvents={allNurseEvents}
            expenses={expenses}
            guardiaRecords={guardiaRecords}
            onOpenTermsModal={() => openLegalModal("terminos")}
          />
        )}

        {/* TAB 5: CONTROL DE GUARDIAS (HISTORIAL E INICIO/FIN) */}
        {activeTab === "guardias" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Si no hay guardia activa, mostrar tarjeta interactiva para iniciar turno */}
            {!activeGuardia && (
              <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl border-2 border-emerald-500/60 shadow-2xl text-white space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/60 pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-400/40 shrink-0">
                      <Clock className="w-7 h-7 animate-pulse" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                        <span>Recepción de Turno Clínico</span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                        Iniciar Turno de Guardia
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Seleccione el receptor de servicio que atenderá durante su jornada para habilitar su expediente clínico y kárdex.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCredentialModal(true)}
                    className="self-start sm:self-auto px-3.5 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 rounded-xl text-xs font-bold flex items-center gap-2 transition"
                  >
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                    <span>Mi Credencial Digital</span>
                  </button>
                </div>

                {/* Formulario directo para iniciar guardia */}
                <form onSubmit={handleStartGuardiaSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-emerald-300 font-bold mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Receptor de Servicio Programado en Agenda (Hoy): *</span>
                      </label>
                      <select
                        required
                        disabled={clientsScheduledToday.length === 0}
                        value={guardiaClientId}
                        onChange={(e) => {
                          setGuardiaClientId(e.target.value);
                          const found = clientsScheduledToday.find((c) => c.id === e.target.value);
                          if (found?.direccionServicio) setGuardiaUbicacion(found.direccionServicio);
                        }}
                        className="w-full p-3 rounded-2xl bg-slate-900 border border-emerald-500/60 text-white font-bold text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none disabled:opacity-50"
                      >
                        {clientsScheduledToday.length === 0 ? (
                          <option value="">-- Sin pacientes programados en agenda hoy --</option>
                        ) : (
                          <>
                            <option value="">-- Seleccionar Paciente Programado Hoy --</option>
                            {clientsScheduledToday.map((c) => {
                              const ev = todayNurseEvents.find((e) => (e.clientId || "").toUpperCase() === c.id.toUpperCase());
                              return (
                                <option key={c.id} value={c.id}>
                                  {c.nombreCompletoRS || c.nombreCompletoCliente} ({c.id}) {ev?.titulo ? `• ${ev.titulo}` : ""}
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                      {clientsScheduledToday.length === 0 ? (
                        <div className="p-3 bg-rose-950/80 border border-rose-600/60 rounded-xl text-rose-200 mt-2 text-[11px] leading-relaxed">
                          ⚠️ <strong>Sin asignación hoy:</strong> No tiene turnos programados en su agenda para el día de hoy ({new Date().toLocaleDateString("es-MX")}). Comuníquese con la administración para que le programen su guardia antes de iniciar.
                        </div>
                      ) : (
                        <p className="text-[11px] text-emerald-400 mt-1">
                          ✓ {clientsScheduledToday.length} paciente(s) autorizado(s) y programado(s) en su agenda para hoy.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Ubicación / Domicilio del Servicio:</span>
                      </label>
                      <input
                        type="text"
                        value={guardiaUbicacion}
                        onChange={(e) => setGuardiaUbicacion(e.target.value)}
                        placeholder="Ej: Domicilio del cliente Pachuca / Centro Cuidarte"
                        className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 flex flex-col justify-between">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Notas de Entrega / Recepción de Turno:</span>
                      </label>
                      <textarea
                        rows={3}
                        value={guardiaNotasInicio}
                        onChange={(e) => setGuardiaNotasInicio(e.target.value)}
                        placeholder="Condiciones del receptor de servicio al recibir la guardia..."
                        className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-700 text-white font-medium text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={clientsScheduledToday.length === 0 || !guardiaClientId}
                        className={`w-full py-3.5 px-6 rounded-2xl font-black text-xs shadow-xl flex items-center justify-center gap-2 transition-all ${
                          clientsScheduledToday.length === 0 || !guardiaClientId
                            ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                            : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-300 shadow-emerald-950/60"
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>
                          {clientsScheduledToday.length === 0
                            ? "⛔ NO PUEDE INICIAR (SIN ASIGNACIÓN EN AGENDA HOY)"
                            : "🟢 INICIAR TURNO Y ACCEDER A EXPEDIENTE CLÍNICO"}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>

                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-2 text-slate-400 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Aislamiento Clínico Activo: Toda la información de expedientes médicos, signos vitales y kárdex permanece confidencial y se mostrará únicamente para el receptor de servicio del cual inicies turno.
                  </span>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">MÓDULO OFICIAL</span>
                <h3 className="text-xl font-black text-slate-900">Historial y Control de Guardias</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bitácora de asistencia y reportes de recepción y entrega de turno del personal.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                {activeGuardia ? (
                  <button
                    onClick={() => setShowEndGuardiaModal(true)}
                    className="w-full md:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Finalizar Guardia Activa</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowStartGuardiaModal(true)}
                    className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Iniciar Nueva Guardia</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of Guard Shifts */}
            {myNurseGuardiaRecords.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-400 space-y-2">
                <Clock className="w-12 h-12 mx-auto text-slate-300" />
                <h4 className="font-bold text-slate-700 text-base">Sin registro de guardias</h4>
                <p className="text-xs text-slate-500">
                  Aún no se han registrado turnos de guardia para su número de personal. Presione "Iniciar Guardia" para comenzar su registro.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myNurseGuardiaRecords.map((guardia) => (
                  <div
                    key={guardia.id}
                    className={`p-5 rounded-2xl border shadow-sm space-y-3 ${
                      guardia.estatus === "En Curso"
                        ? "bg-emerald-50/80 border-emerald-300"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          guardia.estatus === "En Curso"
                            ? "bg-emerald-600 text-white animate-pulse"
                            : "bg-slate-200 text-slate-700"
                        }`}>
                          {guardia.estatus}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">{guardia.id}</span>
                        <span className="text-xs font-black text-slate-900">{guardia.staffNombre}</span>
                      </div>

                      <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                        <span>Inició: <strong>{guardia.fechaInicioFormateada}</strong></span>
                        {guardia.fechaFinFormateada && (
                          <span>| Finalizó: <strong>{guardia.fechaFinFormateada}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-slate-700">
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold uppercase block">Paciente / Cliente</span>
                        <span className="font-bold text-slate-900">{guardia.clientNombre || "Atención General / Sede"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold uppercase block">Ubicación</span>
                        <span>{guardia.ubicacionEntrada || "Pachuca, Hgo."}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] font-bold uppercase block">Duración</span>
                        <span className="font-mono font-bold text-slate-900">
                          {guardia.duracionMinutos ? `${Math.floor(guardia.duracionMinutos / 60)}h ${guardia.duracionMinutos % 60}m` : "En transcurso..."}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1">
                      <p><strong>Nota de Inicio:</strong> {guardia.notasInicio || "Sin observaciones"}</p>
                      {guardia.notasFin && <p><strong>Nota de Cierre:</strong> {guardia.notasFin}</p>}
                      {guardia.novedadesEntrega && <p className="text-amber-800"><strong>Novedades de Entrega:</strong> {guardia.novedadesEntrega}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL INICIAR GUARDIA */}
      {showStartGuardiaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-lg">Iniciar Guardia de Personal</h3>
              </div>
              <button onClick={() => setShowStartGuardiaModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartGuardiaSubmit} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-emerald-900">
                <p className="font-bold">Socio / Personal: {myStaffMember.nombre} {myStaffMember.apellidos}</p>
                <p className="text-[11px] font-mono mt-0.5">No. Socio: {myStaffMember.noSocio || nurseId} • Fecha: {new Date().toLocaleDateString("es-MX")}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  <span className="text-rose-600">*</span> Seleccionar Receptor de Servicio Programado en Agenda (Hoy):
                </label>
                <select
                  required
                  disabled={clientsScheduledToday.length === 0}
                  value={guardiaClientId}
                  onChange={(e) => {
                    setGuardiaClientId(e.target.value);
                    const found = clientsScheduledToday.find((c) => c.id === e.target.value);
                    if (found?.direccionServicio) setGuardiaUbicacion(found.direccionServicio);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 disabled:opacity-50"
                >
                  {clientsScheduledToday.length === 0 ? (
                    <option value="">-- Sin pacientes programados en agenda para hoy --</option>
                  ) : (
                    <>
                      <option value="">-- Seleccione el paciente para su turno --</option>
                      {clientsScheduledToday.map((c) => {
                        const ev = todayNurseEvents.find((e) => (e.clientId || "").toUpperCase() === c.id.toUpperCase());
                        return (
                          <option key={c.id} value={c.id}>
                            {c.nombreCompletoRS || c.nombreCompletoCliente} ({c.id}) {ev?.titulo ? `• ${ev.titulo}` : ""}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
                {clientsScheduledToday.length === 0 ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 mt-2 text-[11px] leading-relaxed">
                    ⚠️ <strong>Sin paciente programado:</strong> No tiene citas o turnos asignados en la agenda para la fecha de hoy ({new Date().toLocaleDateString("es-MX")}). Solo puede iniciar turno con pacientes previamente programados en agenda.
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Al iniciar su turno, se habilitará de forma exclusiva el expediente y kárdex del paciente seleccionado.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Ubicación / Dirección del Servicio:</label>
                <input
                  type="text"
                  value={guardiaUbicacion}
                  onChange={(e) => setGuardiaUbicacion(e.target.value)}
                  placeholder="Ej: Domicilio particular cliente Pachuca / Centro Cuidarte"
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Observaciones / Recepción de Turno:</label>
                <textarea
                  rows={3}
                  value={guardiaNotasInicio}
                  onChange={(e) => setGuardiaNotasInicio(e.target.value)}
                  placeholder="Detalles al recibir el turno..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStartGuardiaModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={clientsScheduledToday.length === 0 || !guardiaClientId}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md disabled:opacity-50"
                >
                  Confirmar e Iniciar Guardia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FINALIZAR GUARDIA */}
      {showEndGuardiaModal && activeGuardia && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-900 text-lg">Finalizar Guardia de Personal</h3>
              </div>
              <button onClick={() => setShowEndGuardiaModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEndGuardiaSubmit} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-rose-900">
                <p className="font-bold">Personal: {activeGuardia.staffNombre}</p>
                <p className="text-[11px] font-mono mt-0.5">Iniciado: {activeGuardia.fechaInicioFormateada} • Receptor de Servicio: {activeGuardia.clientNombre || "General"}</p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Resumen / Cierre de Turno:</label>
                <textarea
                  rows={3}
                  value={guardiaNotasFin}
                  onChange={(e) => setGuardiaNotasFin(e.target.value)}
                  placeholder="Condiciones finales del servicio y turno..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Novedades y Pendientes para el Siguiente Turno:</label>
                <textarea
                  rows={2}
                  value={guardiaNovedades}
                  onChange={(e) => setGuardiaNovedades(e.target.value)}
                  placeholder="Medicamentos pendientes, indicaciones especiales..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 text-slate-800 font-medium"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEndGuardiaModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-md"
                >
                  🔴 Confirmar y Cerrar Guardia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING PERSISTENT CONTACT FOOTER (DESKTOP ONLY) */}
      <div className="hidden md:block fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2.5 px-4 z-30 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-bold text-slate-200">Cuidarte Pachuca - Cuidado integral, confianza total.</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:7714540072"
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-900/40 text-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>771 454 0072</span>
            </a>

            <a
              href="tel:911"
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40 text-xs"
            >
              <Siren className="w-3.5 h-3.5 text-rose-200 animate-bounce" />
              <span>Urgencias 911</span>
            </a>

            <a
              href="mailto:direccion@cuidartemexico.com"
              className="hidden md:flex bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-medium items-center gap-1.5 transition-all border border-slate-700 text-xs"
            >
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span>direccion@cuidartemexico.com</span>
            </a>
          </div>
        </div>
      </div>

      {/* Footer del Panel de Administración con Medios de Contacto */}
      <Footer className="mt-12 mb-14 md:mb-0" userType="personal" />

      {/* Staff Document & Contract Preview Modal */}
      <DocumentViewerModal
        isOpen={Boolean(previewStaffDoc)}
        doc={previewStaffDoc}
        onClose={() => setPreviewStaffDoc(null)}
      />

      {/* Nurse Digital Credential Modal */}
      {showCredentialModal && (
        <div
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCredentialModal(false);
            }
          }}
        >
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl p-5 relative space-y-4">
            {/* Header with prominent close button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <h3 className="font-extrabold text-base text-white">
                  Mi Credencial Digital Oficial: {myStaffMember.nombre} {myStaffMember.apellidos}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCredentialModal(false)}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                title="Cerrar ventana de credencial"
              >
                <X className="w-4 h-4" />
                <span>Cerrar</span>
              </button>
            </div>

            <StaffCredentialCard
              staff={myStaffMember}
              showActions={true}
              canPrint={false}
              onClose={() => setShowCredentialModal(false)}
            />

            {/* Bottom Footer Close Button */}
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCredentialModal(false)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Cerrar Ventana</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Términos y Privacidad */}
      <TermsAndPrivacyModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={initialLegalTab}
        userType="personal"
        verifiedUser={userSession ? { username: userSession.username, nombre: userSession.nombre, role: userSession.role } : null}
      />

      {/* Floating Push & In-App Notification Toast Container with Sound */}
      <NotificationToastContainer onNavigateAction={handleNavigateFromNotification} />

      {/* Modal / Drawer del Centro de Notificaciones y Ajustes de Audio */}
      <NotificationCenterModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onNavigateAction={handleNavigateFromNotification}
      />

      {/* FIXED MOBILE BOTTOM ERGONOMIC TOUCH BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1 flex items-center justify-around shadow-2xl safe-bottom print:hidden">
        <button
          onClick={() => setActiveTab("agenda")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "agenda" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Agenda</span>
        </button>

        <button
          onClick={() => setActiveTab("expedientes")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "expedientes" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Expediente</span>
        </button>

        <button
          onClick={() => setActiveTab("inventario")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "inventario" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Pill className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Insumos</span>
        </button>

        <button
          onClick={() => setActiveTab("guardias")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "guardias" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <div className="relative">
            <Clock className="w-5 h-5 mb-0.5 text-emerald-400" />
            {activeGuardia && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-900" />
            )}
          </div>
          <span className="text-[10px]">Guardia</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            isMobileMenuOpen ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5 text-amber-400" />
          <span className="text-[10px]">Más</span>
        </button>
      </nav>
    </div>
  );
};

