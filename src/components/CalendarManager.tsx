import React, { useState, useEffect, useMemo } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { CalendarEvent, Client, Caratula, StaffMember, GuardiaShiftRecord, UserRole } from "../types";
import { getCurrentTimestamp, getTestCaratulaFolio, isTestCaratulaFolio } from "../utils/formatters";
import { logAuditEvent } from "../services/auditService";
import {
  formatGuardiaFolio,
  isValidGuardiaFolio,
  getNextGuardiaFolio,
  STARTING_GUARDIA_SERIAL_INDEX,
  breakdownGuardiaFolio
} from "../utils/guardiaFolio";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  UserCheck,
  FileText,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  CalendarDays,
  User,
  BadgeCheck,
  Phone,
  ShieldCheck,
  Search,
  Sparkles,
  Activity,
  Check,
  MapPin,
  Flame,
  LayoutGrid,
  List,
  AlertTriangle,
  UserPlus,
  CalendarRange,
  DollarSign,
  Coins
} from "lucide-react";

const formatCurrency = (val: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(val || 0);

interface CalendarManagerProps {
  events: CalendarEvent[];
  clients: Client[];
  caratulas: Caratula[];
  staffMembers?: StaffMember[];
  guardiaRecords?: GuardiaShiftRecord[];
  onSaveEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  readOnly?: boolean;
  filterClientId?: string; // Pre-filter for client portal
  userRole?: UserRole;
  currentUserName?: string;
}

export interface ShiftExecutionInfo {
  status: "Programada" | "En Curso" | "Finalizada" | "Cancelado" | "Expirada";
  isTurnoAbierto: boolean;
  isTurnoFinalizado: boolean;
  horaApertura?: string;
  horaCierre?: string;
  duracionMinutos?: number;
  notasInicio?: string;
  notasFin?: string;
  novedadesEntrega?: string;
  ubicacionEntrada?: string;
  enfermeroResponsable?: string;
  socioNo?: string;
  guardiaId?: string;
}

export const CalendarManager: React.FC<CalendarManagerProps> = ({
  events = [],
  clients = [],
  caratulas = [],
  staffMembers = [],
  guardiaRecords = [],
  onSaveEvent,
  onDeleteEvent,
  readOnly = false,
  filterClientId,
  userRole = "admin",
  currentUserName = "",
}) => {
  // Restricción estricta de permisos: Los socios (enfermeros/personal) y clientes NO pueden
  // modificar calendarios ni guardias (no pueden agregar, editar ni eliminar guardias).
  // Solo la administración de Cuidarte Pachuca cuenta con autorización para gestionar guardias.
  const isReadOnly = readOnly || userRole === "nurse" || userRole === "client";
  const canManageGuardias = userRole === "admin" && !readOnly;

  const [selectedClientId, setSelectedClientId] = useState<string>(filterClientId || "TODOS");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("TODOS");
  const [selectedShiftStatusFilter, setSelectedShiftStatusFilter] = useState<string>("TODOS");
  const [onlyUnassignedFilter, setOnlyUnassignedFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<CalendarEvent | null>(null);
  const [selectedDayAgendaDate, setSelectedDayAgendaDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list">("month");
  const [listFilterPeriod, setListFilterPeriod] = useState<"day" | "week" | "month" | "all">("month");

  // Reassignment and fee configuration inside details modal
  const [detailStaffAssignId, setDetailStaffAssignId] = useState<string>("");
  const [detailPagoHonorarios, setDetailPagoHonorarios] = useState<number | "">("");
  const [detailCaratulaFolio, setDetailCaratulaFolio] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenEventDetails = (ev: CalendarEvent) => {
    setSelectedEventDetails(ev);
    setDetailStaffAssignId(ev.staffId || "");
    setDetailPagoHonorarios(
      ev.costoHonorarios !== undefined && ev.costoHonorarios !== null ? ev.costoHonorarios : ""
    );
    const testFolio = getTestCaratulaFolio(ev.clientId);
    setDetailCaratulaFolio(ev.caratulaFolio || testFolio);
  };

  // Deletion confirmation state
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);

  const confirmDeleteEvent = () => {
    if (!canManageGuardias) {
      setToastMessage("Permiso denegado: Los socios no tienen autorización para eliminar guardias.");
      setEventToDelete(null);
      return;
    }
    if (!eventToDelete || !onDeleteEvent) return;
    const id = eventToDelete.id;
    const folio = eventToDelete.folioGuardia || id;
    const clientName = eventToDelete.clientNombre || eventToDelete.clientId;
    onDeleteEvent(id);
    setEventToDelete(null);
    if (selectedEventDetails?.id === id) {
      setSelectedEventDetails(null);
    }
    setToastMessage(`Guardia ${folio} eliminada correctamente de la agenda.`);

    // Registrar en auditoría de operaciones la eliminación del turno
    logAuditEvent({
      tipoAccion: "ELIMINAR_TURNO",
      descripcion: `Eliminación de guardia agendada: Folio ${folio} - Paciente: ${clientName}`,
      usuarioUx: currentUserName || "usuario",
      usuarioNombre: currentUserName,
      rol: (userRole as UserRole) || "admin",
      folioReferencia: folio,
      clienteIdReferencia: eventToDelete.clientId,
      detalles: {
        id,
        folio,
        titulo: eventToDelete.titulo,
        paciente: clientName,
        fechaInicio: eventToDelete.fechaInicio,
        personalAsignado: eventToDelete.personalAsignado,
      },
    }).catch((e) => console.warn("[Audit] Error al registrar eliminación de turno:", e));
  };

  // Lock body scroll when calendar form or event details modal or day agenda is open
  useLockBodyScroll(Boolean(isFormOpen || selectedEventDetails || selectedDayAgendaDate || eventToDelete));

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Filter active staff members
  const activeStaff = useMemo(() => staffMembers.filter((s) => s.estatus !== "Baja"), [staffMembers]);

  const [formState, setFormState] = useState<Partial<CalendarEvent>>({
    clientId: filterClientId || (clients[0]?.id || "CLI-001"),
    titulo: "",
    fechaInicio: new Date().toISOString().slice(0, 16),
    fechaFin: new Date(Date.now() + 12 * 3600 * 1000).toISOString().slice(0, 16),
    personalAsignado: "",
    staffId: "",
    staffNoSocio: "",
    staffFoto: "",
    tipoServicio: "Enfermería General",
    estado: "Programado",
    notas: "",
  });

  const [customPersonalInput, setCustomPersonalInput] = useState(false);

  // Helper to match a staff member for an event
  const getStaffForEvent = (ev: CalendarEvent): StaffMember | undefined => {
    if (!staffMembers || staffMembers.length === 0) return undefined;
    if (ev.staffId) {
      const found = staffMembers.find((s) => s.id === ev.staffId);
      if (found) return found;
    }
    if (ev.staffNoSocio) {
      const found = staffMembers.find((s) => s.noSocio === ev.staffNoSocio);
      if (found) return found;
    }
    if (ev.personalAsignado) {
      const pLower = (ev.personalAsignado || "").toLowerCase();
      return staffMembers.find((s) => {
        const sNombre = (s.nombre || "").toLowerCase();
        const sApellidos = (s.apellidos || "").toLowerCase();
        const fullName = `${sNombre} ${sApellidos}`.trim();
        return Boolean(
          (sNombre && pLower.includes(sNombre)) ||
          (fullName && fullName.includes(pLower)) ||
          (s.noSocio && pLower.includes(s.noSocio.toLowerCase()))
        );
      });
    }
    return undefined;
  };

  // Helper to determine if a shift date and/or schedule has already passed
  const isGuardiaPast = (ev: CalendarEvent): boolean => {
    const now = new Date();
    // 1. Check end date/time
    if (ev.fechaFin) {
      const finIso = ev.fechaFin.includes("T") ? ev.fechaFin : `${ev.fechaFin}T23:59:59`;
      const finDate = new Date(finIso);
      if (!isNaN(finDate.getTime())) {
        return finDate.getTime() < now.getTime();
      }
    }
    // 2. Check start date/time (default to 12 hours after start or end of the day)
    if (ev.fechaInicio) {
      if (ev.fechaInicio.includes("T")) {
        const startDate = new Date(ev.fechaInicio);
        if (!isNaN(startDate.getTime())) {
          return startDate.getTime() + 12 * 3600 * 1000 < now.getTime();
        }
      } else {
        const endOfDay = new Date(`${ev.fechaInicio}T23:59:59`);
        if (!isNaN(endOfDay.getTime())) {
          return endOfDay.getTime() < now.getTime();
        }
      }
    }
    return false;
  };

  // Helper to match shift execution from GuardiaShiftRecord & CalendarEvent
  const getShiftExecutionInfo = (ev: CalendarEvent): ShiftExecutionInfo => {
    let matchedGuardia: GuardiaShiftRecord | undefined = undefined;

    if (ev.guardiaShiftId && guardiaRecords) {
      matchedGuardia = guardiaRecords.find((g) => g.id === ev.guardiaShiftId);
    }

    if (!matchedGuardia && guardiaRecords && guardiaRecords.length > 0) {
      const evClientId = (ev.clientId || "").trim().toUpperCase();
      const evDate = (ev.fechaInicio || "").slice(0, 10);
      const staffMatched = getStaffForEvent(ev);
      const staffTokens = [
        ev.staffId?.toLowerCase(),
        ev.staffNoSocio?.toLowerCase(),
        staffMatched?.id?.toLowerCase(),
        staffMatched?.noSocio?.toLowerCase(),
        staffMatched?.nombre?.toLowerCase(),
        ev.personalAsignado?.toLowerCase(),
      ].filter(Boolean) as string[];

      matchedGuardia = guardiaRecords.find((g) => {
        const gClientId = (g.clientId || "").trim().toUpperCase();
        if (gClientId !== evClientId) return false;

        const gDate = (g.fechaInicioIso || "").slice(0, 10);
        const isDateMatch = !evDate || !gDate || gDate === evDate;

        const gStaffStr = `${g.staffId || ""} ${g.staffNoSocio || ""} ${g.staffNombre || ""}`.toLowerCase();
        const isStaffMatch = staffTokens.some((tok) => tok && gStaffStr.includes(tok));

        return isDateMatch && (isStaffMatch || !ev.staffId);
      });
    }

    const isPast = isGuardiaPast(ev);

    if (matchedGuardia) {
      const isOpen = matchedGuardia.estatus === "En Curso";
      const isDone = matchedGuardia.estatus === "Finalizada" || (!isOpen && isPast);
      return {
        status: isOpen ? "En Curso" : isDone ? "Finalizada" : "Programada",
        isTurnoAbierto: isOpen,
        isTurnoFinalizado: isDone,
        horaApertura: matchedGuardia.fechaInicioFormateada || (matchedGuardia.fechaInicioIso ? new Date(matchedGuardia.fechaInicioIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
        horaCierre: matchedGuardia.fechaFinFormateada || (matchedGuardia.fechaFinIso ? new Date(matchedGuardia.fechaFinIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
        duracionMinutos: matchedGuardia.duracionMinutos,
        notasInicio: matchedGuardia.notasInicio,
        notasFin: matchedGuardia.notasFin,
        novedadesEntrega: matchedGuardia.novedadesEntrega,
        ubicacionEntrada: matchedGuardia.ubicacionEntrada,
        enfermeroResponsable: matchedGuardia.staffNombre,
        socioNo: matchedGuardia.staffNoSocio,
        guardiaId: matchedGuardia.id,
      };
    }

    if (ev.turnoAbierto || ev.estado === "En Proceso") {
      return {
        status: "En Curso",
        isTurnoAbierto: true,
        isTurnoFinalizado: false,
        horaApertura: ev.horaApertura,
        horaCierre: ev.horaCierre,
        duracionMinutos: ev.duracionMinutos,
        notasInicio: ev.notasInicio,
        notasFin: ev.notasFin,
        novedadesEntrega: ev.novedadesEntrega,
        ubicacionEntrada: ev.ubicacionEntrada,
        enfermeroResponsable: ev.personalAsignado,
        socioNo: ev.staffNoSocio,
        guardiaId: ev.guardiaShiftId,
      };
    }

    if (ev.turnoFinalizado || ev.estado === "Completado") {
      return {
        status: "Finalizada",
        isTurnoAbierto: false,
        isTurnoFinalizado: true,
        horaApertura: ev.horaApertura,
        horaCierre: ev.horaCierre,
        duracionMinutos: ev.duracionMinutos,
        notasInicio: ev.notasInicio,
        notasFin: ev.notasFin,
        novedadesEntrega: ev.novedadesEntrega,
        ubicacionEntrada: ev.ubicacionEntrada,
        enfermeroResponsable: ev.personalAsignado,
        socioNo: ev.staffNoSocio,
        guardiaId: ev.guardiaShiftId,
      };
    }

    if (ev.estado === "Cancelado") {
      return {
        status: "Cancelado",
        isTurnoAbierto: false,
        isTurnoFinalizado: false,
      };
    }

    // Si ya pasó la fecha y/u horario, se marca automáticamente como concluida (Finalizada)
    if (isPast) {
      return {
        status: "Finalizada",
        isTurnoAbierto: false,
        isTurnoFinalizado: true,
        horaApertura: ev.horaApertura,
        horaCierre: ev.horaCierre,
        duracionMinutos: ev.duracionMinutos,
        notasInicio: ev.notasInicio,
        notasFin: ev.notasFin,
        novedadesEntrega: ev.novedadesEntrega,
        ubicacionEntrada: ev.ubicacionEntrada,
        enfermeroResponsable: ev.personalAsignado,
        socioNo: ev.staffNoSocio,
        guardiaId: ev.guardiaShiftId,
      };
    }

    return {
      status: "Programada",
      isTurnoAbierto: false,
      isTurnoFinalizado: false,
    };
  };

  // Guarantee 100% of calendar events have a sequential Guardia Folio (GACP26A2108...)
  const enrichedEvents: CalendarEvent[] = useMemo(() => {
    if (!events || events.length === 0) return [];
    const existingFolios = new Set<string>();

    // Pass 1: gather all explicit valid folios
    events.forEach((ev) => {
      if (ev.folioGuardia && isValidGuardiaFolio(ev.folioGuardia)) {
        existingFolios.add(ev.folioGuardia);
      } else if (ev.id && ev.id.startsWith("GACP") && isValidGuardiaFolio(ev.id)) {
        existingFolios.add(ev.id);
      }
    });

    let serialRunner = STARTING_GUARDIA_SERIAL_INDEX;

    return events.map((ev) => {
      let resolvedFolio = ev.folioGuardia;
      if (!resolvedFolio && ev.id && ev.id.startsWith("GACP") && isValidGuardiaFolio(ev.id)) {
        resolvedFolio = ev.id;
      }
      if (!resolvedFolio) {
        while (existingFolios.has(formatGuardiaFolio(serialRunner))) {
          serialRunner++;
        }
        resolvedFolio = formatGuardiaFolio(serialRunner);
        existingFolios.add(resolvedFolio);
        serialRunner++;
      }
      return {
        ...ev,
        folioGuardia: resolvedFolio,
      };
    });
  }, [events]);

  // Filter events
  const displayedEvents = useMemo(() => {
    return enrichedEvents.filter((ev) => {
      const evClientId = (ev.clientId || "").toUpperCase();
      if (filterClientId && evClientId !== (filterClientId || "").toUpperCase()) return false;
      if (selectedClientId !== "TODOS" && evClientId !== (selectedClientId || "").toUpperCase()) return false;

      const matchedS = getStaffForEvent(ev);
      const isUnassigned = !matchedS && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

      // El personal sólo ve información asignada a ellos, jamás turnos sin enfermero ni pendientes de asignar
      if (userRole === "nurse" && isUnassigned) {
        return false;
      }

      if (userRole === "admin" && onlyUnassignedFilter) {
        if (isGuardiaPast(ev)) return false;
        if (!isUnassigned) return false;
      }

      if (userRole === "admin" && selectedStaffFilter !== "TODOS") {
        if (selectedStaffFilter === "SIN_ASIGNAR") {
          if (isGuardiaPast(ev) || !isUnassigned) return false;
        } else {
          if (!matchedS || (matchedS.id !== selectedStaffFilter && matchedS.noSocio !== selectedStaffFilter)) {
            const staffObj = staffMembers.find((s) => s.id === selectedStaffFilter || s.noSocio === selectedStaffFilter);
            const staffNombreLower = (staffObj?.nombre || "").toLowerCase();
            if (!staffObj || !staffNombreLower || !ev.personalAsignado?.toLowerCase().includes(staffNombreLower)) {
              return false;
            }
          }
        }
      }

      if (selectedShiftStatusFilter !== "TODOS") {
        const shiftInfo = getShiftExecutionInfo(ev);
        if (selectedShiftStatusFilter === "EN_CURSO" && shiftInfo.status !== "En Curso") return false;
        if (selectedShiftStatusFilter === "PROGRAMADA" && (shiftInfo.status !== "Programada" || isGuardiaPast(ev))) return false;
        if (selectedShiftStatusFilter === "FINALIZADA" && shiftInfo.status !== "Finalizada") return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const str = `${ev.titulo} ${ev.clientNombre} ${ev.clientId} ${ev.caratulaFolio || ""} ${ev.folioGuardia || ""} ${ev.personalAsignado || ""} ${matchedS?.nombre || ""} ${matchedS?.noSocio || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [enrichedEvents, filterClientId, selectedClientId, selectedStaffFilter, selectedShiftStatusFilter, onlyUnassignedFilter, searchQuery, staffMembers, guardiaRecords]);

  // Live statistics - Las guardias vencidas dejan de contabilizarse en "Sin Enfermero" y "Programadas", y pasan a "Concluidas"
  const countEnCurso = enrichedEvents.filter((ev) => getShiftExecutionInfo(ev).status === "En Curso").length;
  const countProgramada = enrichedEvents.filter((ev) => !isGuardiaPast(ev) && getShiftExecutionInfo(ev).status === "Programada").length;
  const countFinalizada = enrichedEvents.filter((ev) => getShiftExecutionInfo(ev).status === "Finalizada").length;
  const countSinAsignar = enrichedEvents.filter((ev) => {
    if (isGuardiaPast(ev)) return false;
    const shiftInfo = getShiftExecutionInfo(ev);
    if (shiftInfo.status === "Finalizada" || shiftInfo.status === "Cancelado") return false;
    const matchedS = getStaffForEvent(ev);
    return !matchedS && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));
  }).length;
  const countTotal = enrichedEvents.length;

  // Handle open modal for new event
  const handleOpenNewEvent = (presetDate?: string) => {
    if (!canManageGuardias) {
      setToastMessage("Permiso denegado: Los socios no tienen autorización para agendar guardias.");
      return;
    }
    const defaultClient = clients.find((c) => c.id === selectedClientId) || clients[0];
    const clientCaratulas = caratulas.filter(
      (c) =>
        c.id === defaultClient?.id &&
        c.tipoDocumento !== "Cotización" &&
        !c.folio.startsWith("CPCOT") &&
        c.estado !== "Cancelado"
    );
    const assignedFolio = getNextGuardiaFolio(enrichedEvents);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localNowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T08:00`;
    const localNowFinStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T20:00`;

    let defaultStaffId = "";
    let defaultStaffNoSocio = "";
    let defaultPersonalAsignado = currentUserName || "Personal en Turno";
    let defaultStaffFoto = "";

    if (currentUserName && staffMembers.length > 0) {
      const currentUserNameLower = currentUserName.toLowerCase();
      const matchingStaff = staffMembers.find((s) => {
        const sNombre = (s.nombre || "").toLowerCase();
        const full = `${sNombre} ${(s.apellidos || "").toLowerCase()}`.trim();
        return (
          (full && full.includes(currentUserNameLower)) ||
          (sNombre && currentUserNameLower.includes(sNombre))
        );
      });
      if (matchingStaff) {
        defaultStaffId = matchingStaff.id;
        defaultStaffNoSocio = matchingStaff.noSocio;
        defaultStaffFoto = matchingStaff.fotoUrl || "";
        defaultPersonalAsignado = `${matchingStaff.gradoTitulo ? matchingStaff.gradoTitulo.split(" ")[0] + "." : "ENF."} ${matchingStaff.nombre} ${matchingStaff.apellidos} (SOC-${matchingStaff.noSocio})`;
      }
    }

    setFormState({
      id: assignedFolio,
      folioGuardia: assignedFolio,
      clientId: defaultClient?.id || "CLI-001",
      clientNombre: defaultClient?.nombreCompletoCliente || "",
      caratulaFolio: clientCaratulas[0]?.folio || getTestCaratulaFolio(defaultClient?.id || "CLI-001"),
      titulo: `Guardia de Enfermería (${assignedFolio})`,
      fechaInicio: presetDate ? `${presetDate}T08:00` : localNowStr,
      fechaFin: presetDate ? `${presetDate}T20:00` : localNowFinStr,
      personalAsignado: defaultPersonalAsignado,
      staffId: defaultStaffId,
      staffNoSocio: defaultStaffNoSocio,
      staffFoto: defaultStaffFoto,
      tipoServicio: "Enfermería General",
      estado: "Programado",
      notas: "",
      timestamp: getCurrentTimestamp(),
    });
    setCustomPersonalInput(false);
    setIsEditingEvent(false);
    setIsFormOpen(true);
  };

  const handleEditEvent = (evt: CalendarEvent) => {
    if (!canManageGuardias) {
      setToastMessage("Permiso denegado: Los socios no tienen autorización para modificar guardias.");
      return;
    }
    const testFolio = getTestCaratulaFolio(evt.clientId);
    setFormState({
      ...evt,
      caratulaFolio: evt.caratulaFolio || testFolio,
    });
    const hasMatchedStaff = activeStaff.some(
      (s) => s.id === evt.staffId || s.noSocio === evt.staffNoSocio
    );
    setCustomPersonalInput(!hasMatchedStaff && !!evt.personalAsignado && activeStaff.length > 0);
    setIsEditingEvent(true);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageGuardias) {
      setToastMessage("Permiso denegado: Los socios no tienen autorización para modificar ni crear guardias.");
      setIsFormOpen(false);
      return;
    }
    if (!formState.clientId || !formState.titulo || !formState.fechaInicio) {
      setToastMessage("Por favor complete los campos obligatorios (*)");
      return;
    }

    const matchedClient = clients.find((c) => c.id === formState.clientId);
    const resolvedFolio = formState.folioGuardia || (isEditingEvent ? (formState.id || getNextGuardiaFolio(enrichedEvents)) : getNextGuardiaFolio(enrichedEvents));
    const eventId = isEditingEvent ? (formState.id || resolvedFolio) : resolvedFolio;

    const parsedHonorarios =
      formState.costoHonorarios !== undefined &&
      formState.costoHonorarios !== null &&
      String(formState.costoHonorarios).trim() !== ""
        ? Number(formState.costoHonorarios)
        : undefined;

    const testFolio = getTestCaratulaFolio(formState.clientId);
    const resolvedCaratulaFolio =
      formState.caratulaFolio &&
      formState.caratulaFolio.trim() !== "" &&
      formState.caratulaFolio.toLowerCase() !== "sin asociar"
        ? formState.caratulaFolio.trim()
        : testFolio;

    const eventToSave: CalendarEvent = {
      ...formState,
      id: eventId,
      folioGuardia: resolvedFolio,
      clientId: formState.clientId,
      clientNombre: matchedClient?.nombreCompletoCliente || formState.clientNombre || "Cliente Cuidarte",
      caratulaFolio: resolvedCaratulaFolio,
      titulo: formState.titulo,
      fechaInicio: formState.fechaInicio,
      fechaFin: formState.fechaFin || formState.fechaInicio,
      personalAsignado: formState.personalAsignado || "Por asignar",
      staffId: formState.staffId || "",
      staffNoSocio: formState.staffNoSocio || "",
      staffFoto: formState.staffFoto || "",
      costoHonorarios: parsedHonorarios,
      tipoServicio: formState.tipoServicio || "Enfermería General",
      estado: formState.estado || "Programado",
      notas: formState.notas || "",
      registradoPor: userRole === "admin" ? "CP-ADMIN" : (currentUserName || "SOC-ENF"),
      timestamp: formState.timestamp || getCurrentTimestamp(),
    };

    if (onSaveEvent) {
      onSaveEvent(eventToSave);
      setToastMessage(`✅ Guardia guardada con Folio ${resolvedFolio}`);

      const isNew = !isEditingEvent;
      logAuditEvent({
        tipoAccion: isNew ? "AGENDAR_TURNO" : "MODIFICAR_TURNO",
        descripcion: `${isNew ? "Creación" : "Modificación"} de guardia en calendario: Folio ${resolvedFolio} - Paciente: ${eventToSave.clientNombre} - Honorarios: $${parsedHonorarios || 0} - Carátula: ${eventToSave.caratulaFolio || "N/A"}`,
        usuarioUx: currentUserName || "usuario",
        usuarioNombre: currentUserName,
        rol: (userRole as UserRole) || "admin",
        folioReferencia: resolvedFolio,
        clienteIdReferencia: eventToSave.clientId,
        detalles: {
          folio: resolvedFolio,
          paciente: eventToSave.clientNombre,
          personalAsignado: eventToSave.personalAsignado,
          costoHonorarios: parsedHonorarios,
          caratulaFolio: eventToSave.caratulaFolio,
          fechaInicio: eventToSave.fechaInicio,
          tipoServicio: eventToSave.tipoServicio,
        },
      }).catch((e) => console.warn("[Audit] Error al registrar evento de turno:", e));
    }

    setIsFormOpen(false);
  };

  // Quick staff reassignment & fee adjustment from event detail modal
  const handleSaveStaffReassignment = () => {
    if (!canManageGuardias) {
      setToastMessage("Permiso denegado: Los socios no tienen autorización para reasignar personal o modificar honorarios.");
      return;
    }
    if (!selectedEventDetails || !onSaveEvent) return;

    let updatedStaffId = selectedEventDetails.staffId;
    let updatedStaffNoSocio = selectedEventDetails.staffNoSocio;
    let updatedStaffFoto = selectedEventDetails.staffFoto;
    let updatedPersonalAsignado = selectedEventDetails.personalAsignado;

    const selectedStaff = activeStaff.find((s) => s.id === detailStaffAssignId);
    if (selectedStaff) {
      const formattedName = `${selectedStaff.gradoTitulo ? selectedStaff.gradoTitulo.split(" ")[0] + "." : "ENF."} ${selectedStaff.nombre} ${selectedStaff.apellidos} (SOC-${selectedStaff.noSocio})`;
      updatedStaffId = selectedStaff.id;
      updatedStaffNoSocio = selectedStaff.noSocio;
      updatedStaffFoto = selectedStaff.fotoUrl || "";
      updatedPersonalAsignado = formattedName;
    }

    const updatedCostoHonorarios =
      detailPagoHonorarios !== "" && !isNaN(Number(detailPagoHonorarios))
        ? Number(detailPagoHonorarios)
        : selectedEventDetails.costoHonorarios;

    const testFolioForReassign = getTestCaratulaFolio(selectedEventDetails.clientId);
    const updatedCaratulaFolio =
      detailCaratulaFolio &&
      detailCaratulaFolio.trim() !== "" &&
      detailCaratulaFolio.toLowerCase() !== "sin asociar"
        ? detailCaratulaFolio.trim()
        : selectedEventDetails.caratulaFolio || testFolioForReassign;

    const updatedEvent: CalendarEvent = {
      ...selectedEventDetails,
      staffId: updatedStaffId,
      staffNoSocio: updatedStaffNoSocio,
      staffFoto: updatedStaffFoto,
      personalAsignado: updatedPersonalAsignado,
      costoHonorarios: updatedCostoHonorarios,
      caratulaFolio: updatedCaratulaFolio,
    };

    onSaveEvent(updatedEvent);
    setSelectedEventDetails(updatedEvent);
    setToastMessage(`✅ Asignación y honorarios actualizados correctamente.`);

    logAuditEvent({
      tipoAccion: "MODIFICAR_TURNO",
      descripcion: `Actualización de asignación/honorarios en guardia ${updatedEvent.folioGuardia || updatedEvent.id}: Personal: ${updatedPersonalAsignado} - Honorarios: $${updatedCostoHonorarios || 0} - Carátula: ${updatedCaratulaFolio || "N/A"}`,
      usuarioUx: currentUserName || "usuario",
      usuarioNombre: currentUserName,
      rol: (userRole as UserRole) || "admin",
      folioReferencia: updatedEvent.folioGuardia || updatedEvent.id,
      clienteIdReferencia: updatedEvent.clientId,
      detalles: {
        folio: updatedEvent.folioGuardia || updatedEvent.id,
        paciente: updatedEvent.clientNombre,
        nuevoPersonal: updatedPersonalAsignado,
        costoHonorarios: updatedCostoHonorarios,
        caratulaFolio: updatedCaratulaFolio,
        staffId: updatedStaffId,
      },
    }).catch((e) => console.warn("[Audit] Error al registrar reasignación:", e));
  };

  // Calendar Grid calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const todayMonth = () => setCurrentDate(new Date());

  // Week View Calculations (Monday to Sunday)
  const currentWeekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    // In JS Sunday is 0. Shift so Monday is index 0.
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      const y = nextDay.getFullYear();
      const m = String(nextDay.getMonth() + 1).padStart(2, "0");
      const d = String(nextDay.getDate()).padStart(2, "0");
      days.push({
        dateObj: nextDay,
        dateKey: `${y}-${m}-${d}`,
        dayName: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i],
        dayNum: nextDay.getDate(),
        isToday: nextDay.toDateString() === new Date().toDateString(),
      });
    }
    return days;
  }, [currentDate]);

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const prevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const nextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const todayDay = () => {
    setCurrentDate(new Date());
  };

  const currentDayKey = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(currentDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [currentDate]);

  const currentDayFormatted = useMemo(() => {
    const dayNamesLong = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const dayName = dayNamesLong[currentDate.getDay()];
    const dayNum = currentDate.getDate();
    const monthName = monthNames[currentDate.getMonth()];
    const yearNum = currentDate.getFullYear();
    return `${dayName}, ${dayNum} de ${monthName} de ${yearNum}`;
  }, [currentDate, monthNames]);

  const currentMonthFormatted = useMemo(() => {
    return `${monthNames[month]} de ${year}`;
  }, [month, year, monthNames]);

  const currentMonthKey = useMemo(() => {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }, [year, month]);

  const currentWeekRangeFormatted = useMemo(() => {
    if (currentWeekDays.length === 0) return "";
    const first = currentWeekDays[0];
    const last = currentWeekDays[6];
    return `${first.dayNum} ${monthNames[first.dateObj.getMonth()]} - ${last.dayNum} ${monthNames[last.dateObj.getMonth()]} de ${last.dateObj.getFullYear()}`;
  }, [currentWeekDays, monthNames]);

  // List View specific filtered events by period (Day, Week, Month, or All)
  const displayedEventsInList = useMemo(() => {
    if (listFilterPeriod === "all") return displayedEvents;

    if (listFilterPeriod === "day") {
      return displayedEvents.filter((ev) => {
        const startDay = ev.fechaInicio.slice(0, 10);
        const endDay = (ev.fechaFin || ev.fechaInicio).slice(0, 10);
        return currentDayKey >= startDay && currentDayKey <= endDay;
      });
    }

    if (listFilterPeriod === "week") {
      const mondayStr = currentWeekDays[0]?.dateKey || "";
      const sundayStr = currentWeekDays[6]?.dateKey || "";
      return displayedEvents.filter((ev) => {
        const startDay = ev.fechaInicio.slice(0, 10);
        const endDay = (ev.fechaFin || ev.fechaInicio).slice(0, 10);
        return startDay <= sundayStr && endDay >= mondayStr;
      });
    }

    if (listFilterPeriod === "month") {
      return displayedEvents.filter((ev) => {
        const startMonth = ev.fechaInicio.slice(0, 7);
        const endMonth = (ev.fechaFin || ev.fechaInicio).slice(0, 7);
        return currentMonthKey >= startMonth && currentMonthKey <= endMonth;
      });
    }

    return displayedEvents;
  }, [displayedEvents, listFilterPeriod, currentDayKey, currentWeekDays, currentMonthKey]);

  // Helper to format date String e.g. "2026-08-08"
  const formatDateKey = (dayNum: number) => {
    const m = String(month + 1).padStart(2, "0");
    const d = String(dayNum).padStart(2, "0");
    return `${year}-${m}-${d}`;
  };

  const getEventsForDateStr = (dateKey: string) => {
    return displayedEvents.filter((ev) => ev.fechaInicio.startsWith(dateKey));
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "Finalizada":
      case "Completado":
      case "Caducado / Concluido":
        return "bg-slate-100 text-slate-700 border-slate-300";
      case "En Curso":
      case "En Proceso":
        return "bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-400/50";
      case "Cancelado":
        return "bg-rose-100 text-rose-800 border-rose-300";
      case "Expirada":
        return "bg-amber-100 text-amber-900 border-amber-300";
      default:
        return "bg-sky-100 text-sky-800 border-sky-300";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast message alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stats Ergonomic Bar */}
      {userRole !== "client" && (
        <div className={`grid gap-3.5 ${userRole === "admin" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
          {/* EN CURSO */}
          <div
            onClick={() => setSelectedShiftStatusFilter(selectedShiftStatusFilter === "EN_CURSO" ? "TODOS" : "EN_CURSO")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedShiftStatusFilter === "EN_CURSO"
                ? "bg-emerald-900 text-white border-emerald-700 ring-2 ring-emerald-400"
                : "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70 text-emerald-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>En Turno Activo</span>
              </span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-black">{countEnCurso}</div>
            <span className="text-[10px] opacity-70">
              {userRole === "nurse" ? "Sus guardias activas en domicilio" : "Guardias activas en domicilio"}
            </span>
          </div>

          {/* SIN ASIGNAR ALERTA (SOLO ADMINISTRACIÓN) */}
          {userRole === "admin" && (
            <div
              onClick={() => setOnlyUnassignedFilter(!onlyUnassignedFilter)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                onlyUnassignedFilter
                  ? "bg-amber-900 text-white border-amber-600 ring-2 ring-amber-400"
                  : "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 text-amber-950"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sin Enfermero</span>
                </span>
                <UserPlus className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black">{countSinAsignar}</div>
              <span className="text-[10px] opacity-70">Turnos que requieren socio</span>
            </div>
          )}

          {/* PROGRAMADOS */}
          <div
            onClick={() => setSelectedShiftStatusFilter(selectedShiftStatusFilter === "PROGRAMADA" ? "TODOS" : "PROGRAMADA")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedShiftStatusFilter === "PROGRAMADA"
                ? "bg-sky-900 text-white border-sky-700 ring-2 ring-sky-400"
                : "bg-sky-50/70 border-sky-200 hover:bg-sky-100/70 text-sky-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Programados</span>
              <CalendarDays className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-2 text-2xl font-black">{countProgramada}</div>
            <span className="text-[10px] opacity-70">
              {userRole === "nurse" ? "Sus turnos agendados futuros" : "Turnos agendados futuros"}
            </span>
          </div>

          {/* TOTAL / CONCLUIDOS */}
          <div
            onClick={() => setSelectedShiftStatusFilter(selectedShiftStatusFilter === "FINALIZADA" ? "TODOS" : "FINALIZADA")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              selectedShiftStatusFilter === "FINALIZADA"
                ? "bg-slate-800 text-white border-slate-600 ring-2 ring-slate-400"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Concluidos</span>
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-black">{countFinalizada} <span className="text-xs font-normal text-slate-400">/ {countTotal} tot</span></div>
            <span className="text-[10px] opacity-70">
              {userRole === "nurse" ? "Sus bitácoras cerradas" : "Bitácoras cerradas"}
            </span>
          </div>
        </div>
      )}

      {/* Main Header & Controls Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-sky-600" />
              <span>Agenda de Turnos & Guardias</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {userRole === "nurse"
                ? "Visualización en tiempo real de los turnos y guardias exclusivamente asignados a su perfil."
                : "Programación ergonómica y visualización en tiempo real de turnos asignados a clientes y pacientes."}
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "day"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vista Diaria"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Día</span>
              </button>

              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "week"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vista Semanal Detallada"
              >
                <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
                <span>Semana</span>
              </button>

              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "month" || (viewMode as any) === "calendar"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vista Mensual"
              >
                <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                <span>Mes</span>
              </button>

              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "list"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vista de Lista"
              >
                <List className="w-3.5 h-3.5 text-slate-600" />
                <span>Lista ({displayedEvents.length})</span>
              </button>
            </div>

            {canManageGuardias && (
              <button
                onClick={() => handleOpenNewEvent()}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-sky-900/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar Turno</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar with Search, Client and Staff Selectors */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
          {/* Quick Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                userRole === "nurse"
                  ? "Buscar en mis turnos por Folio de Guardia (ej. GACP26A2108), Paciente..."
                  : "Buscar por Folio de Guardia (ej. GACP26A2108), Paciente, Carátula o Enfermero/a..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Client Filter */}
          {!filterClientId && clients.length > 0 && userRole === "admin" && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 py-1.5 pr-2 outline-none max-w-[180px] truncate"
              >
                <option value="TODOS">Todos los Clientes ({clients.length})</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombreCompletoCliente} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Staff Filter (SOLO ADMINISTRACIÓN) */}
          {canManageGuardias && staffMembers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 ml-2" />
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 py-1.5 pr-2 outline-none max-w-[190px] truncate"
              >
                <option value="TODOS">Todos los Socios ({activeStaff.length})</option>
                {activeStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    [SOC-{s.noSocio}] {s.nombre} {s.apellidos}
                  </option>
                ))}
                <option value="SIN_ASIGNAR">⚠️ Sin personal asignado</option>
              </select>
            </div>
          )}

          {/* Quick Toggle: Solo sin asignar (SOLO ADMINISTRACIÓN) */}
          {canManageGuardias && (
            <button
              onClick={() => setOnlyUnassignedFilter(!onlyUnassignedFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                onlyUnassignedFilter
                  ? "bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Pendientes de Asignar ({countSinAsignar})</span>
            </button>
          )}
        </div>
      </div>

      {/* DAILY VIEW (VISTA POR DÍA) */}
      {viewMode === "day" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-4">
          {/* Day Navigation Banner */}
          <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Agenda del Día
                </span>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{currentDayFormatted}</span>
                  {currentDayKey === new Date().toISOString().slice(0, 10) && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                      Hoy
                    </span>
                  )}
                </h3>
              </div>
              <button
                onClick={todayDay}
                className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                Ir a Hoy
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevDay}
                className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-700/60 cursor-pointer"
                title="Día anterior"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Día Anterior</span>
              </button>

              <button
                onClick={nextDay}
                className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-700/60 cursor-pointer"
                title="Día siguiente"
              >
                <span className="hidden sm:inline">Día Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {canManageGuardias && (
                <button
                  onClick={() => handleOpenNewEvent(currentDayKey)}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer ml-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Agendar en este Día</span>
                </button>
              )}
            </div>
          </div>

          {/* Day Schedule Content */}
          <div className="p-4 sm:p-6">
            {(() => {
              const dayEvents = getEventsForDateStr(currentDayKey);
              if (dayEvents.length === 0) {
                return (
                  <div className="text-center py-16 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-base font-bold text-slate-700">Sin turnos programados para este día</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      No hay guardias ni servicios agendados para el {currentDayFormatted}.
                    </p>
                    {canManageGuardias && (
                      <button
                        onClick={() => handleOpenNewEvent(currentDayKey)}
                        className="mt-4 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 shadow-sm transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Agendar Turno para {currentDayKey}</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                    <span>{dayEvents.length} {dayEvents.length === 1 ? "turno programado" : "turnos programados"}</span>
                    <span>Orden cronológico</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dayEvents.map((ev) => {
                      const matchedStaff = getStaffForEvent(ev);
                      const shiftInfo = getShiftExecutionInfo(ev);
                      const isUnassigned = !matchedStaff && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            handleOpenEventDetails(ev);
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                            shiftInfo.status === "En Curso"
                              ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400/40"
                              : isUnassigned
                              ? "bg-amber-50/40 border-amber-300"
                              : "bg-white border-slate-200 hover:border-sky-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                  {ev.fechaInicio.slice(11, 16) || "00:00"} - {ev.fechaFin?.slice(11, 16) || "12:00"}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(shiftInfo.status)}`}>
                                  {shiftInfo.status === "En Curso" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1" />}
                                  {shiftInfo.status}
                                </span>
                              </div>
                              <h4 className="text-sm font-black text-slate-900 mt-1.5">{ev.titulo}</h4>
                              <p className="text-xs text-sky-700 font-bold">{ev.tipoServicio}</p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {ev.folioGuardia && (
                                <span className="text-[10.5px] font-mono font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-300 shadow-2xs whitespace-nowrap">
                                  🛡️ {ev.folioGuardia}
                                </span>
                              )}
                              {ev.caratulaFolio && (
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 font-bold whitespace-nowrap">
                                  Carátula: {ev.caratulaFolio}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Client / Paciente */}
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 space-y-1">
                            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                              <span>Paciente / Cliente:</span>
                              <span className="text-slate-900 font-black">{ev.clientNombre || ev.clientId}</span>
                            </div>
                            {ev.notas && (
                              <p className="text-[11px] text-slate-500 italic line-clamp-2">
                                "{ev.notas}"
                              </p>
                            )}
                          </div>

                          {/* Staff Assigned Card */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            {matchedStaff ? (
                              <div className="flex items-center gap-2">
                                {matchedStaff.fotoUrl ? (
                                  <img
                                    src={matchedStaff.fotoUrl}
                                    alt={matchedStaff.nombre}
                                    className="w-8 h-8 rounded-full object-cover border border-emerald-300"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                                    {matchedStaff.noSocio.slice(-2)}
                                  </div>
                                )}
                                <div>
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{matchedStaff.nombre} {matchedStaff.apellidos}</span>
                                    <span className="text-[9px] font-mono bg-emerald-100 text-emerald-900 px-1 py-0.2 rounded font-bold">
                                      SOC-{matchedStaff.noSocio}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400">{matchedStaff.telefono || matchedStaff.gradoTitulo}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>{ev.personalAsignado || "Sin personal asignado"}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              {canManageGuardias && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEventToDelete(ev);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="Eliminar guardia"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-500" />
                                </button>
                              )}
                              <span className="text-xs text-sky-600 font-bold flex items-center gap-1 hover:underline">
                                <span>Ver Detalle</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MONTHLY CALENDAR VIEW */}
      {(viewMode === "month" || (viewMode as any) === "calendar") && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Month Navigation Banner */}
          <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black tracking-tight">
                {monthNames[month]} {year}
              </h3>
              <button
                type="button"
                onClick={todayMonth}
                className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1 rounded-md border border-slate-700 transition-colors cursor-pointer"
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Responsive Scroll Wrapper to Guarantee No Squeezed Columns on Mobile */}
          <div className="overflow-x-auto w-full">
            <div className="min-w-[680px] md:min-w-0">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 text-center bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-600 py-2.5">
                <div>DOM</div>
                <div>LUN</div>
                <div>MAR</div>
                <div>MIÉ</div>
                <div>JUE</div>
                <div>VIE</div>
                <div>SÁB</div>
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200">
                {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="bg-slate-50/60 min-h-[110px] p-2" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = formatDateKey(dayNum);
                  const dayEvents = getEventsForDateStr(dateStr);
                  const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString();

                  return (
                    <div
                      key={dayNum}
                      onClick={() => setSelectedDayAgendaDate(dateStr)}
                      className={`bg-white min-h-[140px] md:min-h-[155px] p-2 flex flex-col justify-between group transition-colors hover:bg-sky-50/20 cursor-pointer ${
                        isToday ? "ring-2 ring-sky-500 ring-inset bg-sky-50/10" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
                            isToday
                              ? "bg-sky-600 text-white shadow-2xs"
                              : "text-slate-750 group-hover:text-sky-600 bg-slate-100/70"
                          }`}
                        >
                          {dayNum}
                        </span>

                        {canManageGuardias && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenNewEvent(dateStr);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-100 rounded-lg transition-all cursor-pointer"
                            title="Agendar turno este día"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* List of events on this day - Spacious & Un-crowded */}
                      <div className="space-y-1.5 overflow-y-auto max-h-[135px] scrollbar-none">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const matchedStaff = getStaffForEvent(ev);
                          const shiftInfo = getShiftExecutionInfo(ev);
                          const isUnassigned = !matchedStaff && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

                          return (
                            <div
                              key={ev.id}
                              className={`group/evt relative text-[11px] p-1.5 rounded-xl border cursor-pointer font-medium leading-snug transition-all hover:shadow-sm ${
                                isUnassigned
                                  ? "bg-amber-50/90 border-amber-300 text-amber-950 hover:border-amber-400"
                                  : shiftInfo.status === "En Curso"
                                  ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40"
                                  : shiftInfo.status === "Finalizada"
                                  ? "bg-slate-50 border-slate-200 text-slate-700"
                                  : "bg-sky-50/80 border-sky-200 text-sky-950 hover:border-sky-300"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEventDetails(ev);
                              }}
                            >
                              {/* Header: Status Dot + Time + Folio + Quick Action Buttons */}
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1 min-w-0 font-mono text-[9.5px]">
                                  {shiftInfo.status === "En Curso" ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block shrink-0" />
                                  ) : shiftInfo.status === "Finalizada" ? (
                                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shrink-0" />
                                  ) : isUnassigned ? (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block shrink-0" />
                                  )}
                                  <span className="font-semibold text-slate-700">{ev.fechaInicio.slice(11, 16)}</span>
                                  <span className="font-mono text-[9px] font-bold text-indigo-900 bg-indigo-100/80 px-1 py-0.2 rounded border border-indigo-200 truncate">
                                    {ev.folioGuardia}
                                  </span>
                                </div>

                                {canManageGuardias && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover/evt:opacity-100 transition-opacity shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditEvent(ev);
                                      }}
                                      className="p-0.5 text-slate-500 hover:text-sky-700 hover:bg-sky-100 rounded transition cursor-pointer"
                                      title="Editar turno"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEventToDelete(ev);
                                      }}
                                      className="p-0.5 text-slate-500 hover:text-rose-600 hover:bg-rose-100 rounded transition cursor-pointer"
                                      title="Eliminar guardia"
                                    >
                                      <Trash2 className="w-2.5 h-2.5 text-rose-500" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Patient / Event Title */}
                              <div className="font-bold text-[10.5px] text-slate-900 truncate leading-tight">
                                {ev.clientNombre || ev.titulo}
                              </div>

                              {/* Nurse / Assigned Staff & Status Footer */}
                              <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between gap-1 text-[9.5px]">
                                <span className={`truncate font-semibold flex items-center gap-1 min-w-0 ${
                                  isUnassigned ? "text-amber-800 font-bold" : "text-slate-700"
                                }`}>
                                  {isUnassigned ? (
                                    <>
                                      <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                      <span className="truncate">Sin enfermero</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                      <span className="truncate">
                                        {matchedStaff ? `[${matchedStaff.noSocio}] ${matchedStaff.nombre.split(" ")[0]}` : (ev.personalAsignado || "Asignado")}
                                      </span>
                                    </>
                                  )}
                                </span>

                                <span className={`px-1 py-0.2 rounded text-[8.5px] font-bold shrink-0 ${
                                  shiftInfo.status === "Finalizada"
                                    ? "bg-slate-200/90 text-slate-700"
                                    : shiftInfo.status === "En Curso"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-sky-100 text-sky-800"
                                }`}>
                                  {shiftInfo.status === "Finalizada" ? "Concluida" : shiftInfo.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-center font-bold text-sky-700 bg-sky-50 py-1 rounded-lg border border-sky-200 hover:bg-sky-100 transition shadow-2xs">
                            +{dayEvents.length - 3} más (Ver día)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEEKLY CALENDAR VIEW (SEMANA ERGONÓMICA) */}
      {viewMode === "week" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Week Navigation Header */}
          <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black tracking-tight">
                Semana del {currentWeekDays[0]?.dayNum} al {currentWeekDays[6]?.dayNum} de {monthNames[currentWeekDays[0]?.dateObj.getMonth()]} {currentWeekDays[0]?.dateObj.getFullYear()}
              </h3>
              <button
                onClick={todayMonth}
                className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1 rounded-md border border-slate-700 transition-colors"
              >
                Esta Semana
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={prevWeek}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Anterior</span>
              </button>
              <button
                onClick={nextWeek}
                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                title="Semana siguiente"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7 Columns for the week */}
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-100 min-h-[500px]">
            {currentWeekDays.map((day) => {
              const dayEvents = getEventsForDateStr(day.dateKey);
              return (
                <div
                  key={day.dateKey}
                  className={`bg-white p-3 flex flex-col justify-between ${
                    day.isToday ? "bg-sky-50/20 ring-2 ring-sky-500/50" : ""
                  }`}
                >
                  {/* Day Header */}
                  <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {day.dayName}
                      </div>
                      <div className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg font-mono ${
                          day.isToday ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-800"
                        }`}>
                          {day.dayNum}
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">
                          {dayEvents.length} {dayEvents.length === 1 ? "turno" : "turnos"}
                        </span>
                      </div>
                    </div>

                    {canManageGuardias && (
                      <button
                        onClick={() => handleOpenNewEvent(day.dateKey)}
                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                        title="Agendar en este día"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Day Shifts Stack */}
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px] scrollbar-thin">
                    {dayEvents.length === 0 ? (
                      <div className="py-8 text-center text-slate-300 text-xs italic">
                        Sin guardias
                      </div>
                    ) : (
                      dayEvents.map((ev) => {
                        const matchedStaff = getStaffForEvent(ev);
                        const shiftInfo = getShiftExecutionInfo(ev);
                        const isUnassigned = !matchedStaff && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              handleOpenEventDetails(ev);
                            }}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer shadow-xs transition hover:shadow-md ${
                              isUnassigned
                                ? "bg-amber-50/90 border-amber-300 hover:border-amber-400"
                                : getStatusBadgeClass(shiftInfo.status)
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-[9.5px] font-black bg-indigo-100 text-indigo-900 px-1.5 py-0.5 rounded border border-indigo-300 shadow-2xs whitespace-nowrap">
                                🛡️ {ev.folioGuardia}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${getStatusBadgeClass(shiftInfo.status)}`}>
                                {shiftInfo.status}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-600 font-mono mb-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {ev.fechaInicio.slice(11, 16)} - {ev.fechaFin.slice(11, 16)}
                              </span>
                              {ev.caratulaFolio && (
                                <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                                  Car: {ev.caratulaFolio}
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">
                              {ev.titulo}
                            </h4>

                            <p className="text-[11px] text-slate-600 truncate mt-0.5">
                              👤 {ev.clientNombre}
                            </p>

                            {/* Staff info */}
                            <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {matchedStaff?.fotoUrl ? (
                                  <img
                                    src={matchedStaff.fotoUrl}
                                    alt={matchedStaff.nombre}
                                    className="w-4 h-4 rounded-full object-cover shrink-0"
                                  />
                                ) : isUnassigned ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                <span className="font-bold text-[10px] truncate text-slate-800">
                                  {matchedStaff ? `[${matchedStaff.noSocio}] ${matchedStaff.nombre.split(" ")[0]}` : (ev.personalAsignado || "Sin asignar")}
                                </span>
                              </div>

                              {canManageGuardias && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditEvent(ev);
                                    }}
                                    className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded transition"
                                    title="Editar turno"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEventToDelete(ev);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                    title="Eliminar guardia"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-500" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden space-y-0">
          {/* List View Period Filter & Temporal Controls Bar */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  Filtro Temporal de Lista
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {displayedEventsInList.length} {displayedEventsInList.length === 1 ? "guardia" : "guardias"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white">
                  {listFilterPeriod === "day" && <span>📅 {currentDayFormatted}</span>}
                  {listFilterPeriod === "week" && <span>🗓️ Semana: {currentWeekRangeFormatted}</span>}
                  {listFilterPeriod === "month" && <span>📆 Mes: {currentMonthFormatted}</span>}
                  {listFilterPeriod === "all" && <span>🌐 Todo el Historial (Todas las Fechas)</span>}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Period Selector Tabs: Día, Semana, Mes, Todo */}
              <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setListFilterPeriod("day")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterPeriod === "day"
                      ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Filtrar lista por Día específico"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Día</span>
                </button>

                <button
                  type="button"
                  onClick={() => setListFilterPeriod("week")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterPeriod === "week"
                      ? "bg-emerald-500 text-slate-950 shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Filtrar lista por Semana"
                >
                  <CalendarRange className="w-3.5 h-3.5" />
                  <span>Semana</span>
                </button>

                <button
                  type="button"
                  onClick={() => setListFilterPeriod("month")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterPeriod === "month"
                      ? "bg-sky-500 text-slate-950 shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Filtrar lista por Mes"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Mes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setListFilterPeriod("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    listFilterPeriod === "all"
                      ? "bg-white text-slate-950 shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Mostrar todo el historial sin filtro de fecha"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Todo</span>
                </button>
              </div>

              {/* Navigation Controls for Día, Semana, Mes */}
              {listFilterPeriod !== "all" && (
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (listFilterPeriod === "day") prevDay();
                      else if (listFilterPeriod === "week") prevWeek();
                      else if (listFilterPeriod === "month") prevMonth();
                    }}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Período anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (listFilterPeriod === "day") todayDay();
                      else if (listFilterPeriod === "week" || listFilterPeriod === "month") todayMonth();
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:text-sky-200 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Ir a la fecha actual"
                  >
                    Hoy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (listFilterPeriod === "day") nextDay();
                      else if (listFilterPeriod === "week") nextWeek();
                      else if (listFilterPeriod === "month") nextMonth();
                    }}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Período siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <input
                    type="date"
                    value={currentDayKey}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parts = e.target.value.split("-").map(Number);
                        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                          setCurrentDate(new Date(parts[0], parts[1] - 1, parts[2]));
                        }
                      }
                    }}
                    className="bg-slate-900 text-slate-300 text-xs font-mono px-2 py-1 rounded-lg border border-slate-700 focus:outline-sky-400 cursor-pointer ml-1"
                    title="Seleccionar fecha de referencia"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Folio de Guardia</th>
                  <th className="py-3.5 px-4">Fecha / Horario</th>
                  <th className="py-3.5 px-4">Cliente / Receptor</th>
                  <th className="py-3.5 px-4">Servicio / Guardia</th>
                  <th className="py-3.5 px-4">Socio Asignado</th>
                  <th className="py-3.5 px-4">Estatus de Turno</th>
                  <th className="py-3.5 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedEventsInList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-14 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <CalendarDays className="w-10 h-10 text-slate-300" />
                        <p className="font-semibold text-slate-600">
                          No hay turnos o guardias agendadas para este {listFilterPeriod === "day" ? "día" : listFilterPeriod === "week" ? "período semanal" : listFilterPeriod === "month" ? "mes" : "criterio"}.
                        </p>
                        {listFilterPeriod !== "all" && (
                          <button
                            type="button"
                            onClick={() => setListFilterPeriod("all")}
                            className="text-xs text-sky-600 hover:text-sky-700 font-bold underline cursor-pointer"
                          >
                            Ver todo el historial de guardias ({displayedEvents.length})
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedEventsInList.map((ev) => {
                    const matchedStaff = getStaffForEvent(ev);
                    const shiftInfo = getShiftExecutionInfo(ev);
                    const isUnassigned = !matchedStaff && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

                    return (
                      <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-black bg-indigo-100 text-indigo-900 px-2.5 py-1 rounded-lg border border-indigo-300 shadow-2xs">
                              🛡️ {ev.folioGuardia}
                            </span>
                          </div>
                          {ev.caratulaFolio && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Carátula: {ev.caratulaFolio}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                          <div className="font-bold">{ev.fechaInicio.replace("T", " ")}</div>
                          <div className="text-slate-400 text-[10px]">hasta {ev.fechaFin.replace("T", " ")}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{ev.clientNombre || ev.clientId}</div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900">
                          <div>{ev.titulo}</div>
                          <span className="text-[10px] text-sky-700 font-semibold">{ev.tipoServicio}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                          {matchedStaff ? (
                            <div className="flex items-center gap-2">
                              {matchedStaff.fotoUrl ? (
                                <img
                                  src={matchedStaff.fotoUrl}
                                  alt={matchedStaff.nombre}
                                  className="w-7 h-7 rounded-full object-cover border border-emerald-300"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                                  {matchedStaff.noSocio.slice(-2)}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1">
                                  <span>{matchedStaff.nombre} {matchedStaff.apellidos}</span>
                                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                                    SOC-{matchedStaff.noSocio}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {matchedStaff.gradoTitulo || matchedStaff.puestoTipoPersonal}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>{ev.personalAsignado || "Sin asignar"}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(
                                shiftInfo.status
                              )}`}
                            >
                              {shiftInfo.status === "En Curso" && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                              )}
                              {shiftInfo.status === "Finalizada" && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>{shiftInfo.status}</span>
                            </span>

                            {shiftInfo.horaApertura && (
                              <span className="text-[10px] font-mono text-emerald-800 font-medium">
                                Inició: {shiftInfo.horaApertura}
                              </span>
                            )}
                            {shiftInfo.horaCierre && (
                              <span className="text-[10px] font-mono text-slate-500">
                                Cerró: {shiftInfo.horaCierre}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                handleOpenEventDetails(ev);
                              }}
                              className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                              title="Ver detalle"
                            >
                              <Info className="w-4 h-4" />
                            </button>

                            {canManageGuardias && (
                              <>
                                <button
                                  onClick={() => handleEditEvent(ev)}
                                  className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Editar turno"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (onDeleteEvent) {
                                      onDeleteEvent(ev.id);
                                      setToastMessage("Agenda eliminada.");
                                    }
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DAY AGENDA DRAWER / MODAL */}
      {selectedDayAgendaDate && (() => {
        const dayEvents = getEventsForDateStr(selectedDayAgendaDate);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Agenda del Día: {selectedDayAgendaDate}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {dayEvents.length} {dayEvents.length === 1 ? "guardia programada" : "guardias programadas"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDayAgendaDate(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {dayEvents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No hay turnos registrados para este día.
                  </div>
                ) : (
                  dayEvents.map((ev) => {
                    const matchedStaff = getStaffForEvent(ev);
                    const shiftInfo = getShiftExecutionInfo(ev);
                    const isUnassigned = !matchedStaff && (!ev.personalAsignado || ev.personalAsignado.toLowerCase().includes("por asignar") || ev.personalAsignado.toLowerCase().includes("sin asignar"));

                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedDayAgendaDate(null);
                          handleOpenEventDetails(ev);
                        }}
                        className="p-3.5 rounded-2xl border border-slate-200 hover:border-sky-300 bg-slate-50 hover:bg-white transition cursor-pointer space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-black text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-300">
                            🛡️ {ev.folioGuardia}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {canManageGuardias && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDayAgendaDate(null);
                                    handleEditEvent(ev);
                                  }}
                                  className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-100 rounded-lg transition"
                                  title="Editar turno"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDayAgendaDate(null);
                                    setEventToDelete(ev);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                  title="Eliminar guardia"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                </button>
                              </>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(shiftInfo.status)}`}>
                              {shiftInfo.status === "Finalizada" ? "Concluida" : shiftInfo.status}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-xs text-sky-800">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{ev.fechaInicio.slice(11, 16)} - {ev.fechaFin.slice(11, 16)} hrs</span>
                        </div>

                        <div className="font-bold text-slate-900 text-sm">
                          {ev.titulo}
                        </div>

                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span>👤 <strong>Paciente:</strong> {ev.clientNombre}</span>
                          {ev.caratulaFolio ? (
                            isTestCaratulaFolio(ev.caratulaFolio) ? (
                              <span className="font-mono text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded">
                                🧪 Carátula: {ev.caratulaFolio}
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                                📁 Folio: {ev.caratulaFolio}
                              </span>
                            )
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/70">
                          <span className="text-slate-500 font-medium">Personal:</span>
                          <div className="flex items-center gap-1.5">
                            {matchedStaff ? (
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                                👩‍⚕️ [SOC-{matchedStaff.noSocio}] {matchedStaff.nombre}
                              </span>
                            ) : (
                              <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                                ⚠️ Sin enfermero asignado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                {canManageGuardias && (
                  <button
                    onClick={() => {
                      const d = selectedDayAgendaDate;
                      setSelectedDayAgendaDate(null);
                      handleOpenNewEvent(d);
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Agendar en este día</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedDayAgendaDate(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl ml-auto"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EVENT DETAIL MODAL (WITH DIRECT NURSE REASSIGNMENT) */}
      {selectedEventDetails && (() => {
        const shiftInfo = getShiftExecutionInfo(selectedEventDetails);
        const staff = getStaffForEvent(selectedEventDetails);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(shiftInfo.status)}`}>
                      {shiftInfo.status === "En Curso" && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      )}
                      {shiftInfo.status === "Finalizada" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{shiftInfo.status}</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{selectedEventDetails.titulo}</h3>
                </div>
                <button
                  onClick={() => setSelectedEventDetails(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-sm text-slate-700">
                {/* Live Shift Status Banner */}
                {shiftInfo.status === "En Curso" && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-emerald-950 flex items-start gap-3 shadow-xs">
                    <Activity className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1">
                      <div className="font-black text-xs text-emerald-900 uppercase tracking-wide">
                        Turno Actualmente en Curso
                      </div>
                      <div className="text-xs text-emerald-800 mt-0.5">
                        El enfermero abrió turno a las <span className="font-bold font-mono">{shiftInfo.horaApertura || "Hora no registrada"}</span>. La atención se encuentra activa y documentándose en bitácora.
                      </div>
                      {shiftInfo.ubicacionEntrada && (
                        <div className="mt-1.5 text-[11px] text-emerald-900 font-mono bg-emerald-100/80 px-2 py-0.5 rounded flex items-center gap-1">
                          <span>📍 Check-in:</span> {shiftInfo.ubicacionEntrada}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {shiftInfo.status === "Finalizada" && (
                  <div className="bg-slate-100 border border-slate-300 rounded-xl p-3.5 text-slate-900 flex items-start gap-3 shadow-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-black text-xs text-slate-900 uppercase tracking-wide">
                        Turno Concluido y Cerrado
                      </div>
                      <div className="text-xs text-slate-700 mt-0.5">
                        Apertura: <span className="font-bold font-mono">{shiftInfo.horaApertura || "--"}</span> | Cierre: <span className="font-bold font-mono">{shiftInfo.horaCierre || "--"}</span>
                        {shiftInfo.duracionMinutos ? ` (${Math.floor(shiftInfo.duracionMinutos / 60)}h ${shiftInfo.duracionMinutos % 60}m)` : ""}
                      </div>
                      {shiftInfo.novedadesEntrega && (
                        <div className="mt-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200 text-slate-800">
                          <span className="font-bold text-[10px] text-slate-500 uppercase block mb-0.5">Novedades de Entrega de Guardia:</span>
                          {shiftInfo.novedadesEntrega}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">INICIO PROGRAMADO</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEventDetails.fechaInicio.replace("T", " ")}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">FIN ESTIMADO</span>
                    <span className="font-mono font-bold text-slate-900">{selectedEventDetails.fechaFin.replace("T", " ")}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">Cliente / Beneficiario:</span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-bold text-slate-900">{selectedEventDetails.clientNombre || selectedEventDetails.clientId}</span>
                    {selectedEventDetails.folioGuardia && (
                      <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded border border-indigo-300">
                        🛡️ Folio Guardia: {selectedEventDetails.folioGuardia}
                      </span>
                    )}
                    {selectedEventDetails.caratulaFolio && (
                      <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        Carátula: {selectedEventDetails.caratulaFolio}
                      </span>
                    )}
                  </div>
                </div>

                {/* Financial Assignment / Caratula Breakdown */}
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                  <span className="text-[11px] font-black text-emerald-950 uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Honorarios & Carátula de Servicio Asignada:</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Pago Acordado al Socio</span>
                      <span className="text-base font-black text-emerald-700 font-mono">
                        {selectedEventDetails.costoHonorarios !== undefined &&
                        selectedEventDetails.costoHonorarios !== null &&
                        selectedEventDetails.costoHonorarios > 0
                          ? formatCurrency(selectedEventDetails.costoHonorarios)
                          : "Por definir"}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Carátula Asociada</span>
                      <span className="text-xs font-bold text-slate-800 font-mono block truncate">
                        {selectedEventDetails.caratulaFolio ? (
                          isTestCaratulaFolio(selectedEventDetails.caratulaFolio) ? (
                            <span className="text-purple-700 font-bold flex items-center gap-1">
                              🧪 Folio {selectedEventDetails.caratulaFolio} (Prueba)
                            </span>
                          ) : (
                            <span>Folio {selectedEventDetails.caratulaFolio}</span>
                          )
                        ) : (
                          <span className="text-purple-700 font-bold flex items-center gap-1">
                            🧪 Folio {getTestCaratulaFolio(selectedEventDetails.clientId)} (Prueba)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linked Socio Credential Card Section */}
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                    Socio / Personal Operativo Asignado:
                  </span>
                  {staff ? (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3.5 shadow-2xs">
                      {staff.fotoUrl ? (
                        <img
                          src={staff.fotoUrl}
                          alt={staff.nombre}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-emerald-200 text-emerald-900 font-black flex items-center justify-center text-sm shrink-0">
                          {staff.noSocio}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm truncate">
                            {staff.nombre} {staff.apellidos}
                          </span>
                          <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                            SOC-{staff.noSocio}
                          </span>
                        </div>
                        <div className="text-xs text-emerald-900 font-semibold truncate">
                          {staff.gradoTitulo || staff.puestoTipoPersonal}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>{staff.areaAdscripcion || "Regional Hidalgo"}</span>
                          {staff.telefono && userRole !== "client" && (
                            <span className="flex items-center gap-1 font-mono text-slate-600">
                              <Phone className="w-3 h-3 text-emerald-600" /> {staff.telefono}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-amber-900">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <span className="font-bold text-xs">
                          {selectedEventDetails.personalAsignado || "Sin socio asignado todavía"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Staff Reassignment & Fee Configuration Box (For Admins) */}
                {userRole === "admin" && (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-sky-600" />
                      <span>Asignación de Personal, Pago de Honorarios & Carátula:</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Socio / Personal
                        </label>
                        <select
                          value={detailStaffAssignId}
                          onChange={(e) => setDetailStaffAssignId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                        >
                          <option value="">-- Sin socio asignado --</option>
                          {activeStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              [SOC-{s.noSocio}] {s.nombre} {s.apellidos}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Pago por Guardia ($ MXN)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            placeholder="Ej: 600"
                            value={detailPagoHonorarios !== "" ? detailPagoHonorarios : ""}
                            onChange={(e) =>
                              setDetailPagoHonorarios(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full bg-white border border-slate-300 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                          <span>Carátula Folio *</span>
                          <span className="text-[9px] text-indigo-700 font-bold bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                            Obligatoria
                          </span>
                        </label>
                        <select
                          value={
                            detailCaratulaFolio ||
                            selectedEventDetails.caratulaFolio ||
                            getTestCaratulaFolio(selectedEventDetails.clientId)
                          }
                          onChange={(e) => setDetailCaratulaFolio(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-sky-500"
                        >
                          {caratulas
                            .filter(
                              (c) =>
                                (!selectedEventDetails.clientId || c.id === selectedEventDetails.clientId) &&
                                c.estado !== "Cancelado" &&
                                c.tipoDocumento !== "Cotización"
                            )
                            .map((c) => (
                              <option key={c.folio} value={c.folio}>
                                Folio {c.folio} ({c.nombreCompletoRS || c.nombreCompletoCliente})
                              </option>
                            ))}
                          <option value={getTestCaratulaFolio(selectedEventDetails.clientId)}>
                            🧪 Carátula de Prueba {getTestCaratulaFolio(selectedEventDetails.clientId)} (Cliente + 01)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveStaffReassignment}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Guardar Asignación y Honorarios</span>
                      </button>
                    </div>
                  </div>
                )}

                {selectedEventDetails.notas && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Indicaciones / Notas:</span>
                    <p className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg text-xs mt-1">
                      {selectedEventDetails.notas}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {canManageGuardias && (
                  <button
                    type="button"
                    onClick={() => {
                      setEventToDelete(selectedEventDetails);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-rose-200 cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Eliminar Guardia</span>
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  {canManageGuardias && (
                    <button
                      onClick={() => {
                        const ev = selectedEventDetails;
                        setSelectedEventDetails(null);
                        handleEditEvent(ev);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Editar Turno Completo
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedEventDetails(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD / EDIT EVENT MODAL FORM */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-sky-600" />
                <span>{formState.id ? "Editar Turno / Guardia" : "Agendar Nuevo Turno"}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 pt-4">
              {/* Folio Único de Guardia Badge */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                    Folio Único de Control de Guardia
                  </div>
                  <div className="text-sm font-mono font-black text-indigo-950 flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{formState.folioGuardia || "GACP26A..."}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-2.5 py-1 rounded-md border border-indigo-300">
                  Serie Única GACP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cliente *
                  </label>
                  <select
                    value={formState.clientId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      const matchedC = clients.find((c) => c.id === cid);
                      const matchedCar = caratulas.find((cr) => cr.id === cid);
                      const testFol = getTestCaratulaFolio(cid);
                      setFormState({
                        ...formState,
                        clientId: cid,
                        clientNombre: matchedC?.nombreCompletoCliente || "",
                        caratulaFolio: matchedCar?.folio || testFol,
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.nombreCompletoCliente}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-900">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Carátula Asignada *</span>
                    </span>
                    <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Forzosa / Obligatoria
                    </span>
                  </label>
                  <select
                    required
                    value={formState.caratulaFolio || getTestCaratulaFolio(formState.clientId)}
                    onChange={(e) => setFormState({ ...formState, caratulaFolio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold focus:ring-2 focus:ring-sky-500"
                  >
                    {caratulas
                      .filter(
                        (c) =>
                          (!formState.clientId || c.id === formState.clientId) &&
                          c.tipoDocumento !== "Cotización" &&
                          !c.folio.startsWith("CPCOT") &&
                          c.estado !== "Cancelado"
                      )
                      .map((c) => (
                        <option key={c.folio} value={c.folio}>
                          Carátula Folio {c.folio} ({c.nombreCompletoRS || c.nombreCompletoCliente})
                        </option>
                      ))}
                    <option value={getTestCaratulaFolio(formState.clientId)}>
                      🧪 Carátula de Prueba Folio {getTestCaratulaFolio(formState.clientId)} (Cliente + 01)
                    </option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Control financiero estricto: toda guardia agendada debe vincularse a una carátula operativa.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Título del Servicio / Turno *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Guardia Diurna de Enfermería (12 hrs)"
                  value={formState.titulo}
                  onChange={(e) => setFormState({ ...formState, titulo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Fecha/Hora Inicio *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formState.fechaInicio}
                    onChange={(e) => setFormState({ ...formState, fechaInicio: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Fecha/Hora Término
                  </label>
                  <input
                    type="datetime-local"
                    value={formState.fechaFin}
                    onChange={(e) => setFormState({ ...formState, fechaFin: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* VINCULACIÓN DE SOCIOS REGISTRADOS */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Socio / Personal Asignado *</span>
                  </label>
                  {activeStaff.length > 0 && userRole === "admin" && (
                    <button
                      type="button"
                      onClick={() => setCustomPersonalInput(!customPersonalInput)}
                      className="text-[11px] text-sky-600 hover:text-sky-800 underline font-semibold"
                    >
                      {customPersonalInput ? "Seleccionar de socios registrados" : "Ingresar texto manual"}
                    </button>
                  )}
                </div>

                {userRole !== "admin" ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-slate-800 font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      <span>{formState.personalAsignado || currentUserName || "Personal en Turno"}</span>
                    </div>
                    <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                      Asignación Directa
                    </span>
                  </div>
                ) : !customPersonalInput && activeStaff.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={formState.staffId || (formState.staffNoSocio ? `SOC-${formState.staffNoSocio}` : "")}
                      onChange={(e) => {
                        const sId = e.target.value;
                        if (!sId) {
                          setFormState({
                            ...formState,
                            staffId: "",
                            staffNoSocio: "",
                            staffFoto: "",
                            personalAsignado: "Por asignar",
                          });
                          return;
                        }
                        const s = activeStaff.find((item) => item.id === sId || item.noSocio === sId);
                        if (s) {
                          const formattedName = `${s.gradoTitulo ? s.gradoTitulo.split(" ")[0] + "." : "ENF."} ${s.nombre} ${s.apellidos} (SOC-${s.noSocio})`;
                          setFormState({
                            ...formState,
                            staffId: s.id,
                            staffNoSocio: s.noSocio,
                            staffFoto: s.fotoUrl || "",
                            personalAsignado: formattedName,
                          });
                        }
                      }}
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">-- Seleccionar de los {activeStaff.length} Socios Registrados --</option>
                      {activeStaff.map((socio) => (
                        <option key={socio.id} value={socio.id}>
                          [No. Socio: {socio.noSocio}] {socio.nombre} {socio.apellidos} - {socio.gradoTitulo || socio.puestoTipoPersonal}
                        </option>
                      ))}
                    </select>

                    {formState.staffId && (() => {
                      const sel = activeStaff.find((s) => s.id === formState.staffId);
                      if (!sel) return null;
                      return (
                        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                          <div className="flex items-center gap-2.5">
                            {sel.fotoUrl ? (
                              <img src={sel.fotoUrl} alt={sel.nombre} className="w-8 h-8 rounded-lg object-cover border border-emerald-400" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                                {sel.noSocio}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900">
                                {sel.nombre} {sel.apellidos}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {sel.gradoTitulo || sel.puestoTipoPersonal} • {sel.areaAdscripcion}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                            Activo
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Ej: ENF. JUAN CARLOS PÉREZ LÓPEZ"
                      value={formState.personalAsignado}
                      onChange={(e) => setFormState({ ...formState, personalAsignado: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                    />
                  </div>
                )}
              </div>

              {/* PAGO DE HONORARIOS Y ASIGNACIÓN A CARÁTULA */}
              {userRole === "admin" && (
                <div className="bg-emerald-50/70 border border-emerald-300 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Pago de Honorarios por Guardia & Carátula de Servicio</span>
                    </label>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      Suma a Honorarios de Carátula
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Pago al Socio / Personal ($ MXN)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 font-bold text-sm">$</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          placeholder="Ej: 600"
                          value={formState.costoHonorarios !== undefined && formState.costoHonorarios !== null ? formState.costoHonorarios : ""}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              costoHonorarios: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          className="w-full bg-white border border-emerald-300 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Monto neto acordado a liquidar al socio por cubrir esta guardia.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Carátula de Servicio Asignada
                      </label>
                      <div className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900 flex items-center justify-between">
                        <span className="truncate">{formState.caratulaFolio || getTestCaratulaFolio(formState.clientId)}</span>
                        <span className="text-[10px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shrink-0 ml-2">
                          Vinculada
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        El costo de honorarios se sumará automáticamente a esta carátula operativa.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipo de Servicio
                  </label>
                  <input
                    type="text"
                    value={formState.tipoServicio}
                    onChange={(e) => setFormState({ ...formState, tipoServicio: e.target.value })}
                    placeholder="Ej: Enfermería General / Guardia 12h"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Estado
                  </label>
                  <select
                    value={formState.estado}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        estado: e.target.value as CalendarEvent["estado"],
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-bold"
                  >
                    <option value="Programado">Programado</option>
                    <option value="En Proceso">En Proceso</option>
                    <option value="Completado">Completado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Indicaciones / Notas adicionales
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre la atención, recomendaciones..."
                  value={formState.notas}
                  onChange={(e) => setFormState({ ...formState, notas: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                {formState.id && canManageGuardias ? (
                  <button
                    type="button"
                    onClick={() => {
                      const ev = events.find((e) => e.id === formState.id);
                      if (ev) {
                        setEventToDelete(ev);
                      } else {
                        setEventToDelete({
                          id: formState.id!,
                          titulo: formState.titulo || "Guardia",
                          folioGuardia: formState.folioGuardia,
                          clientId: formState.clientId || "",
                          clientNombre: clients.find((c) => c.id === formState.clientId)?.nombre || "",
                          fechaInicio: formState.fechaInicio || "",
                          fechaFin: formState.fechaFin || "",
                          personalAsignado: formState.personalAsignado,
                        });
                      }
                      setIsFormOpen(false);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-rose-200 cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Eliminar Guardia</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                  >
                    Guardar Agenda
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {eventToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">¿Eliminar esta guardia de la agenda?</h3>
              <p className="text-xs text-slate-500">
                Esta acción eliminará el turno calendarizado y su asignación del sistema.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-bold">Folio Guardia:</span>
                <span className="text-indigo-900 font-black bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                  🛡️ {eventToDelete.folioGuardia || eventToDelete.id}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-bold">Paciente:</span>
                <span className="truncate max-w-[200px] text-right font-sans font-medium text-slate-900">
                  {eventToDelete.clientNombre || eventToDelete.titulo}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-bold">Fecha / Horario:</span>
                <span>{eventToDelete.fechaInicio.replace("T", " ")}</span>
              </div>
              {eventToDelete.personalAsignado && (
                <div className="flex items-center justify-between text-slate-700">
                  <span className="font-bold">Personal:</span>
                  <span className="truncate max-w-[200px] text-right font-sans text-slate-900">
                    {eventToDelete.personalAsignado}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteEvent}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmar Eliminación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
