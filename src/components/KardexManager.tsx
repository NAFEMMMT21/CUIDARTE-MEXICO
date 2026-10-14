import React, { useState, useEffect } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { KardexRecord, KardexMedication, KardexAdministrationLog, Client, Caratula, UserRole, InventoryItem, InventoryMovement, CalendarEvent, GuardiaShiftRecord } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import {
  calculateStockAndTreatmentStatus,
  getTakeScheduleUrgency,
  getMedicationOverallUrgency,
  calculateDosesPerDay,
  parseUnitsPerDose,
  FREQUENCY_PRESETS,
  isSlotAdministeredToday,
  isSlotSinAplicacionToday,
  isSlotLoggedToday,
  getSlotAdminLogToday,
  getMedicationDosesProgressToday,
  extractTimeSlots,
  isDateMatching,
  isDateToday,
  getSlotAdminLogForDate,
  isSlotLoggedForDate,
  isSlotAdministeredForDate,
  isSlotSinAplicacionForDate,
} from "../utils/medicationStockUtils";
import { CuidarteLogo } from "./CuidarteLogo";
import { ReceptorServicioSearchSelector } from "./ReceptorServicioSearchSelector";
import { KardexDocument } from "./KardexDocument";
import { downloadKardexPDF } from "../utils/pdfExport";
import {
  Pill,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Shield,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Calendar,
  Syringe,
  Check,
  Ban,
  RotateCcw,
  Sparkles,
  Search,
  Eye,
  Printer,
  Download,
  ShieldAlert,
  Package,
  Bell,
  Activity,
  Flame,
  Zap,
  Calculator,
} from "lucide-react";

interface KardexManagerProps {
  kardexRecords: KardexRecord[];
  clients: Client[];
  caratulas: Caratula[];
  inventoryItems?: InventoryItem[];
  calendarEvents?: CalendarEvent[];
  guardiaRecords?: GuardiaShiftRecord[];
  activeGuardia?: GuardiaShiftRecord | null;
  onSaveKardex: (record: KardexRecord) => void;
  onDeleteKardex?: (id: string) => void;
  onSaveInventoryItem?: (item: InventoryItem) => void;
  userRole?: UserRole;
  currentUserName?: string;
  filterClientId?: string; // Pre-filtered for Client Portal or Nurse Portal
  onSelectClient?: (clientId: string) => void;
}

export const PRESENTACIONES_MEDICAMENTOS = [
  "Tableta",
  "Cápsula",
  "Crema / Gel",
  "Pieza",
  "ml",
  "mg",
  "Gotas",
  "Parche",
  "Ampolleta / Inyectable",
  "Frasco / Jarabe",
  "Tubo / Pomada",
  "Supositorio",
  "Solución",
  "Sobre",
  "Óvulo",
  "Inhalador",
];

export const KardexManager: React.FC<KardexManagerProps> = ({
  kardexRecords = [],
  clients = [],
  caratulas = [],
  inventoryItems = [],
  calendarEvents = [],
  guardiaRecords = [],
  activeGuardia = null,
  onSaveKardex,
  onDeleteKardex,
  onSaveInventoryItem,
  userRole = "admin",
  currentUserName = "Personal Cuidarte",
  filterClientId,
  onSelectClient,
}) => {
  const canEdit = userRole === "admin" || userRole === "nurse";
  const isAdmin = userRole === "admin";

  // Select initial client ID
  const [selectedClientId, setSelectedClientId] = useState<string>(
    filterClientId || clients[0]?.id || "CLI-001"
  );

  useEffect(() => {
    if (filterClientId) {
      setSelectedClientId(filterClientId);
    }
  }, [filterClientId]);

  const effectiveClientId = filterClientId || selectedClientId;

  // Find associated client & caratula info
  const effIdUpper = (effectiveClientId || "").toUpperCase();

  const currentClient = clients.find(
    (c) => c.id && (c.id || "").toUpperCase() === effIdUpper
  );

  const currentCaratula = caratulas.find(
    (c) => c.id && (c.id || "").toUpperCase() === effIdUpper
  );

  const patientName =
    currentClient?.nombreCompletoRS ||
    currentCaratula?.nombreCompletoRS ||
    currentClient?.nombreCompletoCliente ||
    currentCaratula?.nombreCompletoCliente ||
    `Receptor ${effectiveClientId}`;

  // Find or create existing Kardex record for this receptor
  const existingKardex = kardexRecords.find(
    (k) => k.clientId && (k.clientId || "").toUpperCase() === effIdUpper
  );

  // Active filter state inside Kardex: "activos" | "suspendidos" | "todos"
  const [activeFilter, setActiveFilter] = useState<"activos" | "suspendidos" | "todos">("activos");
  const [searchTerm, setSearchTerm] = useState("");

  // Kárdex View Mode: "horarios" (Organizado por Horarios) vs "medicamentos" (Tarjetas)
  const [kardexViewMode, setKardexViewMode] = useState<"horarios" | "medicamentos">("horarios");

  // Real-time time ticker for dynamic chromatic traffic-light urgency updates
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000); // refresh every 15 seconds
    return () => clearInterval(timer);
  }, []);

  // Schedule generator state for new/edited medication
  const [intervalValue, setIntervalValue] = useState<number>(8);
  const [intervalUnit, setIntervalUnit] = useState<"horas" | "minutos">("horas");
  const [firstDoseTime, setFirstDoseTime] = useState<string>("08:00");

  // Modals state
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<KardexMedication | null>(null);

  const [isAlergiasModalOpen, setIsAlergiasModalOpen] = useState(false);

  // Administration Modal State
  const [isAdministerModalOpen, setIsAdministerModalOpen] = useState(false);
  const [administeringMed, setAdministeringMed] = useState<KardexMedication | null>(null);
  const [administeringSlotTime, setAdministeringSlotTime] = useState<string>("");
  const [adminForm, setAdminForm] = useState({
    modo: "aplicado" as "aplicado" | "sin_aplicacion",
    fechaHora: new Date().toISOString().slice(0, 16),
    administradoPor: currentUserName,
    administradoPorTipo: "enfermeria" as "enfermeria" | "familiar" | "medico" | "otro",
    dosisAplicada: "",
    notas: "",
    fueraDeMiGuardia: false,
    motivoSinAplicacion: "No ministrado por familiar durante periodo sin cobertura",
  });

  // Double Dose Warning Modal State
  const [isDoubleDoseWarningOpen, setIsDoubleDoseWarningOpen] = useState(false);
  const [doubleDoseWarningMed, setDoubleDoseWarningMed] = useState<KardexMedication | null>(null);

  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyMed, setHistoryMed] = useState<KardexMedication | null>(null);

  // PDF Document Print / Export Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  // Lock background scroll when any Kardex modal is open
  useLockBodyScroll(Boolean(isMedModalOpen || isAlergiasModalOpen || isAdministerModalOpen || isDoubleDoseWarningOpen || isHistoryModalOpen || isPrintModalOpen));

  const handleDownloadKardexPDF = async () => {
    try {
      setIsDownloadingPDF(true);
      await downloadKardexPDF(patientName);
    } catch (err) {
      console.error("Error al descargar PDF del Kárdex:", err);
      alert("No se pudo generar el archivo PDF. Intente con el botón Imprimir.");
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Form State for Medication
  const [medForm, setMedForm] = useState<Partial<KardexMedication>>({
    nombreMedicamento: "",
    presentacion: "Tableta",
    tipoFrecuencia: "HorarioFijo",
    dosis: "1 tableta",
    dosisPorToma: 1,
    vecesAlDia: 3,
    via: "Oral",
    horario: "08:00 - 16:00 - 00:00",
    frecuencia: "Cada 8 horas",
    indicaciones: "",
    indicacionesUsoADemanda: "",
    tipoTratamiento: "FinDefinido",
    estado: "Activo",
  });

  // Calculate schedule string automatically from interval (hours or minutes) and start time
  const computeSchedule = (intervalVal: number, unit: "horas" | "minutos", startTime: string) => {
    if (isNaN(Number(intervalVal)) || Number(intervalVal) <= 0) {
      return;
    }
    const val = Number(intervalVal);
    const [hStr, mStr] = (startTime || "08:00").split(":");
    let startH = parseInt(hStr || "8", 10);
    const startM = parseInt(mStr || "0", 10);
    if (isNaN(startH)) startH = 8;

    const intervalInMinutes = unit === "minutos" ? val : val * 60;
    if (intervalInMinutes <= 0) return;

    const times: string[] = [];
    const totalDoses = Math.max(1, Math.min(48, Math.floor((24 * 60) / intervalInMinutes)));

    for (let i = 0; i < totalDoses; i++) {
      const totalMinutes = (startH * 60 + startM + i * intervalInMinutes) % (24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const formattedH = String(h).padStart(2, "0");
      const formattedM = String(m).padStart(2, "0");
      times.push(`${formattedH}:${formattedM}`);
    }

    const horarioCalculated = times.join(" - ");
    const frecuenciaCalculated = unit === "horas"
      ? (val === 24 ? "Cada 24 horas (1 toma al día)" : val === 1 ? "Cada 1 hora" : `Cada ${val} horas`)
      : (val === 1 ? "Cada 1 minuto" : `Cada ${val} minutos`);

    setMedForm((prev) => ({
      ...prev,
      horario: horarioCalculated,
      frecuencia: frecuenciaCalculated,
      vecesAlDia: totalDoses,
    }));
  };

  // Form State for Patient Metadata (Alergias / Diagnóstico / Notas)
  const [alergiasText, setAlergiasText] = useState(existingKardex?.alergias || "Sin alergias declaradas");
  const [notasText, setNotasText] = useState(existingKardex?.notasGenerales || "");

  // Medications list for current patient
  const medicationsList = existingKardex?.medicamentos || [];

  // Helper to calculate effective medication status (Auto-complete if treatment end date passed)
  const getEffectiveMedStatus = (med: KardexMedication): 'Activo' | 'Suspendido' | 'Completado' => {
    if (med.estado === "Completado" || med.estado === "Suspendido") return med.estado;
    if (med.fechaFinTratamiento) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (todayStr > med.fechaFinTratamiento) {
        return "Completado"; // Auto-completed when treatment end date has passed
      }
    }
    return med.estado;
  };

  // Helper to calculate daily doses from schedule string
  const calculateDosesPerDayFromHorario = (horarioStr?: string): number => {
    if (!horarioStr) return 1;
    const slots = horarioStr.split(/[-–,/]+/).map((s) => s.trim()).filter(Boolean);
    return slots.length > 0 ? slots.length : 1;
  };

  // Helper to check if a date string corresponds to TODAY
  const isDateToday = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // Check DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      return year === todayY && month === todayM && day === todayD;
    }

    // Check YYYY-MM-DD
    const yyyymmddMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1], 10);
      const month = parseInt(yyyymmddMatch[2], 10) - 1;
      const day = parseInt(yyyymmddMatch[3], 10);
      return year === todayY && month === todayM && day === todayD;
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.getFullYear() === todayY && parsed.getMonth() === todayM && parsed.getDate() === todayD;
    }

    return false;
  };

  // Helper to check if a medication dose was administered TODAY
  const isDoseAdministeredToday = (med: KardexMedication): boolean => {
    if (med.historialAdministracion && med.historialAdministracion.length > 0) {
      return med.historialAdministracion.some((log) => isDateToday(log.fechaHora));
    }
    if (med.ultimaAdministracion) {
      return isDateToday(med.ultimaAdministracion);
    }
    return false;
  };

  // Helper to get formatted details of today's dose
  const getTodayAdminDetails = (med: KardexMedication): string | null => {
    if (med.historialAdministracion && med.historialAdministracion.length > 0) {
      const todayLog = med.historialAdministracion.find((log) => isDateToday(log.fechaHora));
      if (todayLog) {
        return `${todayLog.fechaHora}${todayLog.administradoPor ? ` (por ${todayLog.administradoPor})` : ''}`;
      }
    }
    if (med.ultimaAdministracion && isDateToday(med.ultimaAdministracion)) {
      return `${med.ultimaAdministracion}${med.administradoPor ? ` (por ${med.administradoPor})` : ''}`;
    }
    return null;
  };

  const filteredMeds = medicationsList.filter((med) => {
    const effectiveStatus = getEffectiveMedStatus(med);
    const matchesSearch = med.nombreMedicamento.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === "activos") return effectiveStatus === "Activo";
    if (activeFilter === "suspendidos") return effectiveStatus === "Suspendido" || effectiveStatus === "Completado";
    return true;
  });

  // Group active medications by scheduled intake time for the chronological schedule view
  const getChronologicalScheduledTakes = () => {
    const activeMeds = medicationsList.filter((m) => {
      if (getEffectiveMedStatus(m) !== "Activo") return false;
      const isADemanda = m.tipoFrecuencia === "ADemanda" || (m.horario && (m.horario.toLowerCase().includes("demanda") || m.horario.toLowerCase().includes("prn")));
      return !isADemanda;
    });
    const mapByTime: Record<string, { timeMinutes: number; meds: KardexMedication[] }> = {};

    activeMeds.forEach((med) => {
      if (!med.horario) return;
      const rawSlots = med.horario.split(/[-–,/]+/).map((s) => s.trim()).filter(Boolean);

      rawSlots.forEach((slot) => {
        const match = slot.match(/(\d{1,2}):(\d{2})/);
        let timeKey = slot;
        let minutes = 9999;
        if (match) {
          const h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const formattedH = String(h).padStart(2, "0");
          const formattedM = String(m).padStart(2, "0");
          timeKey = `${formattedH}:${formattedM}`;
          minutes = h * 60 + m;
        }

        if (!mapByTime[timeKey]) {
          mapByTime[timeKey] = { timeMinutes: minutes, meds: [] };
        }
        if (!mapByTime[timeKey].meds.some((m) => m.id === med.id)) {
          mapByTime[timeKey].meds.push(med);
        }
      });
    });

    const sortedKeys = Object.keys(mapByTime).sort((a, b) => mapByTime[a].timeMinutes - mapByTime[b].timeMinutes);

    return sortedKeys.map((key) => ({
      timeStr: key,
      takes: mapByTime[key].meds,
    }));
  };

  const chronologicalTakes = getChronologicalScheduledTakes();

  // Determine the effective start datetime of the current nurse's shift / active duty
  const effectiveShiftStart = React.useMemo(() => {
    // 1. Direct active guardia prop or active shift in guardiaRecords for this patient / session
    const activeG = activeGuardia || (guardiaRecords || []).find((g) =>
      g.estatus === "En Curso" &&
      (!effectiveClientId || !g.clientId || g.clientId.toUpperCase() === effectiveClientId.toUpperCase())
    ) || (guardiaRecords || []).find((g) => g.estatus === "En Curso");

    if (activeG?.fechaInicioIso) {
      const d = new Date(activeG.fechaInicioIso);
      if (!isNaN(d.getTime())) {
        // If clocked in within first 30 mins of the scheduled hour (e.g. 08:05 for an 08:00 shift),
        // normalize to the start of that hour so 08:00 is considered part of this shift
        const rounded = new Date(d);
        if (rounded.getMinutes() <= 30) {
          rounded.setMinutes(0, 0, 0);
        }
        return rounded;
      }
    }

    // 2. Scheduled calendar event for today
    const todayIsoDate = new Date(currentTime).toISOString().slice(0, 10);
    const matchedEvent = (calendarEvents || []).find((ev) => {
      const isToday = ev.fechaInicio && ev.fechaInicio.startsWith(todayIsoDate);
      const matchesClient = !effectiveClientId || !ev.clientId || ev.clientId.toUpperCase() === effectiveClientId.toUpperCase();
      return isToday && matchesClient;
    });

    if (matchedEvent?.fechaInicio) {
      const d = new Date(matchedEvent.fechaInicio);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 3. Fallback: Standard medical shift start for current block (08:00 or 20:00)
    const now = new Date(currentTime);
    const currentH = now.getHours();
    const shiftStartFallback = new Date(now);
    if (currentH >= 8 && currentH < 20) {
      shiftStartFallback.setHours(8, 0, 0, 0);
    } else if (currentH >= 20) {
      shiftStartFallback.setHours(20, 0, 0, 0);
    } else {
      // 00:00 to 07:59 -> Night shift began yesterday at 20:00
      shiftStartFallback.setDate(shiftStartFallback.getDate() - 1);
      shiftStartFallback.setHours(20, 0, 0, 0);
    }
    return shiftStartFallback;
  }, [activeGuardia, guardiaRecords, calendarEvents, effectiveClientId, currentTime]);

  // Takes that are past due/expired BEFORE the start of the current shift (handover / fuera de guardia verification)
  // Takes scheduled during or within the current shift are handled in the normal shift timeline and do NOT appear here.
  const pendingVerificationTakes = React.useMemo(() => {
    const list: Array<{
      med: KardexMedication;
      slotTime: string;
      isPastDue: boolean;
      scheduledDate: string; // "YYYY-MM-DD"
      formattedDate: string; // "DD/MM/YYYY"
      dateLabel: string;
      isYesterday: boolean;
      slotMinsTotal: number;
    }> = [];

    // Today
    const today = new Date(currentTime);
    const todayY = today.getFullYear();
    const todayM = String(today.getMonth() + 1).padStart(2, '0');
    const todayD = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;
    const todayFormatted = `${todayD}/${todayM}/${todayY}`;

    // Yesterday
    const yesterday = new Date(currentTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yestY = yesterday.getFullYear();
    const yestM = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yestD = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yestY}-${yestM}-${yestD}`;
    const yesterdayFormatted = `${yestD}/${yestM}/${yestY}`;

    const shiftStartTimeMs = effectiveShiftStart.getTime();

    medicationsList.forEach((med) => {
      if (getEffectiveMedStatus(med) !== "Activo") return;
      const slots = extractTimeSlots(med.horario);
      if (slots.length === 0) return;

      const medStartDate = med.fechaInicioTratamiento;
      const medEndDate = med.fechaFinTratamiento;

      // 1. Check yesterday's unlogged takes (if medication was active yesterday)
      const wasActiveYesterday = (!medStartDate || medStartDate <= yesterdayStr) && (!medEndDate || medEndDate >= yesterdayStr);
      if (wasActiveYesterday) {
        slots.forEach((slot) => {
          const isLogged = isSlotLoggedForDate(med, slot, yesterday);
          if (!isLogged) {
            const match = slot.match(/(\d{1,2}):(\d{2})/);
            const h = match ? parseInt(match[1], 10) : 0;
            const m = match ? parseInt(match[2], 10) : 0;
            const slotDateTime = new Date(`${yesterdayStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

            // MUST have expired BEFORE the start of the current shift
            if (slotDateTime.getTime() < shiftStartTimeMs) {
              list.push({
                med,
                slotTime: slot,
                isPastDue: true,
                scheduledDate: yesterdayStr,
                formattedDate: yesterdayFormatted,
                dateLabel: `Ayer (${yesterdayFormatted})`,
                isYesterday: true,
                slotMinsTotal: (h * 60 + m) - 1440,
              });
            }
          }
        });
      }

      // 2. Check today's unlogged takes that expired BEFORE starting the current shift
      const isActiveToday = (!medStartDate || medStartDate <= todayStr) && (!medEndDate || medEndDate >= todayStr);
      if (isActiveToday) {
        slots.forEach((slot) => {
          const isLogged = isSlotLoggedForDate(med, slot, today);
          if (!isLogged) {
            const match = slot.match(/(\d{1,2}):(\d{2})/);
            const h = match ? parseInt(match[1], 10) : 0;
            const m = match ? parseInt(match[2], 10) : 0;
            const slotDateTime = new Date(`${todayStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
            const slotMins = h * 60 + m;

            // ONLY include takes that expired BEFORE initiating the current shift.
            // Takes scheduled during or inside the shift duties will be administered directly by the on-duty staff.
            if (slotDateTime.getTime() < shiftStartTimeMs) {
              list.push({
                med,
                slotTime: slot,
                isPastDue: true,
                scheduledDate: todayStr,
                formattedDate: todayFormatted,
                dateLabel: `Hoy (${todayFormatted})`,
                isYesterday: false,
                slotMinsTotal: slotMins,
              });
            }
          }
        });
      }
    });

    // Sort by past due first, then chronological slot total
    list.sort((a, b) => {
      if (a.isPastDue && !b.isPastDue) return -1;
      if (!a.isPastDue && b.isPastDue) return 1;
      return a.slotMinsTotal - b.slotMinsTotal;
    });

    return list;
  }, [medicationsList, currentTime, effectiveShiftStart]);

  const aDemandaActiveMeds = medicationsList.filter((m) =>
    getEffectiveMedStatus(m) === "Activo" &&
    (m.tipoFrecuencia === "ADemanda" || (m.horario && (m.horario.toLowerCase().includes("demanda") || m.horario.toLowerCase().includes("prn"))))
  );

  const activeCount = medicationsList.filter((m) => getEffectiveMedStatus(m) === "Activo").length;
  const inactiveCount = medicationsList.filter((m) => getEffectiveMedStatus(m) !== "Activo").length;

  // Helper to save updated Kardex record
  const persistKardexRecord = (updatedMeds: KardexMedication[], updatedAlergias?: string, updatedNotas?: string) => {
    const timestampNow = getCurrentTimestamp();
    const recordToSave: KardexRecord = {
      id: existingKardex?.id || `KARDEX-${effectiveClientId}`,
      clientId: effectiveClientId,
      clientNombre: currentClient?.nombreCompletoCliente || currentCaratula?.nombreCompletoCliente || "Cliente",
      receptorNombre: patientName,
      diagnostico: currentClient?.diagnostico || currentCaratula?.diagnostico || "Sin diagnóstico registrado",
      alergias: updatedAlergias !== undefined ? updatedAlergias : (existingKardex?.alergias || "Sin alergias declaradas"),
      medicamentos: updatedMeds,
      ultimaModificacion: timestampNow,
      modificadoPor: currentUserName,
      notasGenerales: updatedNotas !== undefined ? updatedNotas : (existingKardex?.notasGenerales || ""),
    };

    onSaveKardex(recordToSave);
  };

  // Open modal to create new medication
  const handleOpenAddMed = () => {
    if (!canEdit) {
      alert("No tiene permisos para registrar nuevos medicamentos en el Kárdex.");
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    setEditingMed(null);
    setIntervalValue(8);
    setIntervalUnit("horas");
    setFirstDoseTime("08:00");
    setMedForm({
      nombreMedicamento: "",
      presentacion: "Tableta",
      tipoFrecuencia: "HorarioFijo",
      dosis: "1 tableta",
      dosisPorToma: 1,
      vecesAlDia: 3,
      via: "Oral",
      horario: "08:00 - 16:00 - 00:00",
      frecuencia: "Cada 8 horas",
      indicaciones: "",
      indicacionesUsoADemanda: "",
      tipoTratamiento: "FinDefinido",
      diasAlertaResurtido: 5,
      fechaInicioTratamiento: todayStr,
      duracionDias: 7,
      fechaFinTratamiento: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        return d.toISOString().slice(0, 10);
      })(),
      dosisTotalesRequeridas: 21,
      totalMedicamentoRequerido: 21,
      estado: "Activo",
    });
    setIsMedModalOpen(true);
  };

  // Open modal to edit existing medication
  const handleOpenEditMed = (med: KardexMedication) => {
    if (!canEdit) {
      alert("No tiene permisos para editar las especificaciones de un medicamento.");
      return;
    }
    const isADemanda = med.tipoFrecuencia === "ADemanda" || (med.horario && (med.horario.toLowerCase().includes("demanda") || med.horario.toLowerCase().includes("prn")));
    const derivedDosisPorToma = med.dosisPorToma !== undefined && med.dosisPorToma > 0
      ? med.dosisPorToma
      : parseUnitsPerDose(med.dosis, med.frecuencia || med.horario);
    const derivedVecesAlDia = isADemanda ? undefined : (med.vecesAlDia !== undefined && med.vecesAlDia > 0
      ? med.vecesAlDia
      : calculateDosesPerDay(med.horario || med.frecuencia));
    const isFinite = !isADemanda && (med.tipoTratamiento === "FinDefinido" || Boolean(med.fechaFinTratamiento));
    const derivedDuracion = isADemanda ? undefined : (med.duracionDias || (isFinite ? 7 : undefined));

    const freqStr = (med.frecuencia || "").toLowerCase();
    const minMatch = freqStr.match(/(\d+)\s*(?:min|minuto|minutos|m)\b/i);
    const hourMatch = freqStr.match(/(\d+)\s*(?:hora|horas|hrs?|h)\b/i);

    let parsedUnit: "horas" | "minutos" = "horas";
    let parsedVal = 8;
    if (minMatch) {
      parsedUnit = "minutos";
      parsedVal = parseInt(minMatch[1], 10) || 30;
    } else if (hourMatch) {
      parsedUnit = "horas";
      parsedVal = parseInt(hourMatch[1], 10) || 8;
    } else if (derivedVecesAlDia && derivedVecesAlDia > 0) {
      parsedUnit = "horas";
      parsedVal = Math.round(24 / derivedVecesAlDia) || 8;
    }

    const firstSlot = med.horario ? med.horario.split(/[-–,/]+/)[0]?.trim() : "08:00";

    setEditingMed(med);
    setIntervalUnit(parsedUnit);
    setIntervalValue(parsedVal > 0 ? parsedVal : 8);
    setFirstDoseTime(firstSlot || "08:00");
    setMedForm({
      ...med,
      presentacion: med.presentacion || "Tableta",
      tipoFrecuencia: isADemanda ? "ADemanda" : (med.tipoFrecuencia || "HorarioFijo"),
      indicacionesUsoADemanda: med.indicacionesUsoADemanda || "",
      dosisPorToma: derivedDosisPorToma,
      vecesAlDia: derivedVecesAlDia,
      duracionDias: derivedDuracion,
      tipoTratamiento: isADemanda ? "ADemanda" : (isFinite ? "FinDefinido" : "Indefinido"),
      diasAlertaResurtido: med.diasAlertaResurtido || 5,
    });
    setIsMedModalOpen(true);
  };

  // Save Medication (Create or Edit)
  const handleSaveMedicationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.nombreMedicamento?.trim()) return;

    const isADemanda = medForm.tipoFrecuencia === "ADemanda";

    // 1. Dosis por toma (unidades tomadas por evento)
    const dosisPorToma = medForm.dosisPorToma !== undefined && Number(medForm.dosisPorToma) > 0
      ? Number(medForm.dosisPorToma)
      : parseUnitsPerDose(medForm.dosis, medForm.frecuencia || medForm.horario);

    // 2. Veces al día (frecuencia diaria)
    const vecesAlDia = isADemanda
      ? undefined
      : (medForm.vecesAlDia !== undefined && Number(medForm.vecesAlDia) > 0
          ? Number(medForm.vecesAlDia)
          : calculateDosesPerDay(medForm.horario || medForm.frecuencia));

    const isFinite = !isADemanda && medForm.tipoTratamiento === "FinDefinido";

    // 3. Duración del tratamiento en días
    let duracionDias = isFinite && medForm.duracionDias ? Number(medForm.duracionDias) : undefined;
    if (isFinite && !duracionDias && medForm.fechaInicioTratamiento && medForm.fechaFinTratamiento) {
      const dStart = new Date(medForm.fechaInicioTratamiento).getTime();
      const dEnd = new Date(medForm.fechaFinTratamiento).getTime();
      duracionDias = Math.max(1, Math.ceil((dEnd - dStart) / (1000 * 60 * 60 * 24))) + 1;
    }

    // Total medicamento requerido
    let totalMedicamentoRequerido: number | undefined;
    let calculatedTotalDoses: number | undefined;

    if (isADemanda) {
      totalMedicamentoRequerido = undefined;
      calculatedTotalDoses = undefined;
    } else {
      const effectiveDaysForTotal = isFinite && duracionDias ? duracionDias : 30;
      totalMedicamentoRequerido = Math.ceil(dosisPorToma * (vecesAlDia || 1) * effectiveDaysForTotal);
      calculatedTotalDoses = isFinite && duracionDias ? Math.ceil((vecesAlDia || 1) * duracionDias) : undefined;
    }

    const presentacionFinal = medForm.presentacion?.trim() || "Tableta";
    const horarioFinal = isADemanda ? "A Demanda (PRN - Según Necesidad)" : (medForm.horario || "Según indicación");
    const frecuenciaFinal = isADemanda ? "A Demanda / Según Criterio Clínico" : (medForm.frecuencia || `Cada ${Math.round(24 / (vecesAlDia || 3))} horas`);

    let updatedList: KardexMedication[] = [];

    if (editingMed) {
      // Update existing
      updatedList = medicationsList.map((m) =>
        m.id === editingMed.id
          ? {
              ...m,
              nombreMedicamento: medForm.nombreMedicamento || m.nombreMedicamento,
              presentacion: presentacionFinal,
              tipoFrecuencia: isADemanda ? "ADemanda" : "HorarioFijo",
              indicacionesUsoADemanda: medForm.indicacionesUsoADemanda || "",
              dosis: medForm.dosis || m.dosis,
              dosisPorToma,
              vecesAlDia,
              via: medForm.via || m.via,
              horario: horarioFinal,
              frecuencia: frecuenciaFinal,
              indicaciones: medForm.indicaciones || "",
              tipoTratamiento: isADemanda ? "ADemanda" : (isFinite ? "FinDefinido" : "Indefinido"),
              diasAlertaResurtido: medForm.diasAlertaResurtido || 5,
              fechaInicioTratamiento: isFinite ? (medForm.fechaInicioTratamiento || "") : "",
              fechaFinTratamiento: isFinite ? (medForm.fechaFinTratamiento || "") : "",
              duracionDias: isFinite ? duracionDias : undefined,
              dosisTotalesRequeridas: calculatedTotalDoses,
              totalMedicamentoRequerido,
              estado: medForm.estado || m.estado,
            }
          : m
      );
    } else {
      // Create new
      const newMed: KardexMedication = {
        id: `MED-${Date.now()}`,
        nombreMedicamento: medForm.nombreMedicamento.trim(),
        presentacion: presentacionFinal,
        tipoFrecuencia: isADemanda ? "ADemanda" : "HorarioFijo",
        indicacionesUsoADemanda: medForm.indicacionesUsoADemanda || "",
        dosis: medForm.dosis || `${dosisPorToma} ${presentacionFinal.toLowerCase()}`,
        dosisPorToma,
        vecesAlDia,
        via: medForm.via || "Oral",
        horario: horarioFinal,
        frecuencia: frecuenciaFinal,
        indicaciones: medForm.indicaciones || "",
        tipoTratamiento: isADemanda ? "ADemanda" : (isFinite ? "FinDefinido" : "Indefinido"),
        diasAlertaResurtido: medForm.diasAlertaResurtido || 5,
        fechaInicioTratamiento: isFinite ? (medForm.fechaInicioTratamiento || "") : "",
        fechaFinTratamiento: isFinite ? (medForm.fechaFinTratamiento || "") : "",
        duracionDias: isFinite ? duracionDias : undefined,
        dosisTotalesRequeridas: calculatedTotalDoses,
        totalMedicamentoRequerido,
        estado: (medForm.estado as any) || "Activo",
      };
      updatedList = [newMed, ...medicationsList];
    }

    persistKardexRecord(updatedList);

    // Sync inventory item for this medication
    if (onSaveInventoryItem && effectiveClientId) {
      const savedMed = editingMed
        ? updatedList.find((m) => m.id === editingMed.id)
        : updatedList[0];

      if (savedMed) {
        const normalizeStr = (s: string = "") =>
          s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").trim();

        const normMedName = normalizeStr(savedMed.nombreMedicamento);
        const originalMedName = editingMed ? normalizeStr(editingMed.nombreMedicamento) : normMedName;

        const matchingInvItems = (inventoryItems || []).filter(
          (inv) =>
            inv.clientId &&
            (inv.clientId || "").toUpperCase() === (effectiveClientId || "").toUpperCase() &&
            (inv.kardexMedicationId === savedMed.id ||
              (editingMed && inv.kardexMedicationId === editingMed.id) ||
              (inv.nombre && (
                normalizeStr(inv.nombre) === normMedName ||
                normalizeStr(inv.nombre) === originalMedName ||
                normalizeStr(inv.nombre).includes(normMedName) ||
                normMedName.includes(normalizeStr(inv.nombre)) ||
                normalizeStr(inv.nombre).includes(originalMedName) ||
                originalMedName.includes(normalizeStr(inv.nombre))
              )))
        );

        const timestamp = getCurrentTimestamp();

        if (matchingInvItems.length > 0) {
          matchingInvItems.forEach((matchInvItem) => {
            const updatedInvItem: InventoryItem = {
              ...matchInvItem,
              nombre: savedMed.nombreMedicamento,
              kardexMedicationId: savedMed.id,
              presentacion: savedMed.presentacion || matchInvItem.presentacion || "Tableta",
              unidadMedida: savedMed.presentacion || matchInvItem.unidadMedida || "Tabletas",
              tipoFrecuencia: savedMed.tipoFrecuencia || "HorarioFijo",
              indicacionesUsoADemanda: savedMed.indicacionesUsoADemanda || "",
              controlTipo: matchInvItem.controlTipo || "Con Control Kardex/Conteo",
              dosisPorToma: savedMed.dosisPorToma,
              vecesAlDia: savedMed.vecesAlDia,
              dosesPerDay: savedMed.vecesAlDia,
              frecuenciaKardex: isADemanda ? "A Demanda (PRN)" : `${savedMed.dosis || ''} - ${savedMed.horario || savedMed.frecuencia || ''}`,
              duracionDiasTratamiento: savedMed.duracionDias,
              tipoTratamiento: savedMed.tipoTratamiento,
              fechaInicioTratamiento: savedMed.fechaInicioTratamiento,
              fechaFinTratamiento: savedMed.fechaFinTratamiento,
              totalMedicamentoRequerido: savedMed.totalMedicamentoRequerido,
              daysThresholdAlert: savedMed.diasAlertaResurtido || matchInvItem.daysThresholdAlert || 5,
              ultimaActualizacion: timestamp,
            };
            onSaveInventoryItem(updatedInvItem);
          });
        } else {
          // If no inventory item exists yet, create one automatically for this patient
          const newInvItem: InventoryItem = {
            id: `INV-${Date.now()}`,
            clientId: effectiveClientId,
            clientNombre: currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente || effectiveClientId,
            nombre: savedMed.nombreMedicamento,
            categoria: "Medicamento",
            presentacion: savedMed.presentacion || "Tableta",
            unidadMedida: savedMed.presentacion || "Tabletas",
            tipoFrecuencia: savedMed.tipoFrecuencia || "HorarioFijo",
            indicacionesUsoADemanda: savedMed.indicacionesUsoADemanda || "",
            controlTipo: "Con Control Kardex/Conteo",
            stockActual: 0,
            kardexMedicationId: savedMed.id,
            dosisPorToma: savedMed.dosisPorToma,
            vecesAlDia: savedMed.vecesAlDia,
            dosesPerDay: savedMed.vecesAlDia,
            frecuenciaKardex: isADemanda ? "A Demanda (PRN)" : `${savedMed.dosis || ''} - ${savedMed.horario || savedMed.frecuencia || ''}`,
            duracionDiasTratamiento: savedMed.duracionDias,
            tipoTratamiento: savedMed.tipoTratamiento,
            fechaInicioTratamiento: savedMed.fechaInicioTratamiento,
            fechaFinTratamiento: savedMed.fechaFinTratamiento,
            totalMedicamentoRequerido: savedMed.totalMedicamentoRequerido,
            daysThresholdAlert: savedMed.diasAlertaResurtido || 5,
            registradoPor: currentUserName,
            fechaCreacion: timestamp,
            ultimaActualizacion: timestamp,
            historialMovimientos: [],
          };
          onSaveInventoryItem(newInvItem);
        }
      }
    }

    setIsMedModalOpen(false);
  };

  // Delete medication
  const handleDeleteMedication = (medId: string) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede eliminar medicamentos del Kárdex.");
      return;
    }
    if (!window.confirm("¿Está seguro de eliminar este medicamento del Kárdex?")) return;
    const updatedList = medicationsList.filter((m) => m.id !== medId);
    persistKardexRecord(updatedList);

    // Unlink or update linked inventory item
    if (onSaveInventoryItem && effectiveClientId) {
      const matchInvItem = (inventoryItems || []).find(
        (inv) =>
          inv.clientId &&
          (inv.clientId || "").toUpperCase() === (effectiveClientId || "").toUpperCase() &&
          inv.kardexMedicationId === medId
      );
      if (matchInvItem) {
        const updatedInvItem: InventoryItem = {
          ...matchInvItem,
          kardexMedicationId: undefined,
          frecuenciaKardex: undefined,
          ultimaActualizacion: getCurrentTimestamp(),
        };
        onSaveInventoryItem(updatedInvItem);
      }
    }
  };

  // Toggle Medication Status (Activo <-> Suspendido)
  const handleToggleStatus = (medId: string) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede suspender o reactivar medicamentos.");
      return;
    }
    const updatedList = medicationsList.map((m) => {
      if (m.id === medId) {
        const nextState: 'Activo' | 'Suspendido' = m.estado === "Activo" ? "Suspendido" : "Activo";
        return { ...m, estado: nextState };
      }
      return m;
    });
    persistKardexRecord(updatedList);
  };

  // Edit History Log Entry (Admin Only)
  const handleEditHistoryLog = (log: { id: string; fechaHora: string; administradoPor: string; dosisAplicada?: string; notas?: string }) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede editar registros de dosis del historial.");
      return;
    }
    if (!historyMed) return;

    const newTime = window.prompt("Editar Fecha y Hora de Aplicación:", log.fechaHora);
    if (newTime === null) return;
    const newDosis = window.prompt("Editar Dosis Aplicada:", log.dosisAplicada || historyMed.dosis);
    if (newDosis === null) return;
    const newBy = window.prompt("Editar Nombre de Enfermero(a) que aplicó:", log.administradoPor);
    if (newBy === null) return;
    const newNotes = window.prompt("Editar Observaciones / Notas:", log.notas || "");
    if (newNotes === null) return;

    const updatedLogs = (historyMed.historialAdministracion || []).map((l) => {
      if (l.id === log.id) {
        return {
          ...l,
          fechaHora: newTime || l.fechaHora,
          dosisAplicada: newDosis || l.dosisAplicada,
          administradoPor: newBy || l.administradoPor,
          notas: newNotes,
        };
      }
      return l;
    });

    const updatedList = medicationsList.map((m) => {
      if (m.id === historyMed.id) {
        return {
          ...m,
          historialAdministracion: updatedLogs,
          ultimaAdministracion: updatedLogs[0]?.fechaHora || m.ultimaAdministracion,
          administradoPor: updatedLogs[0]?.administradoPor || m.administradoPor,
        };
      }
      return m;
    });

    persistKardexRecord(updatedList);
    setHistoryMed({
      ...historyMed,
      historialAdministracion: updatedLogs,
      ultimaAdministracion: updatedLogs[0]?.fechaHora || historyMed.ultimaAdministracion,
      administradoPor: updatedLogs[0]?.administradoPor || historyMed.administradoPor,
    });
  };

  // Delete History Log Entry (Admin Only)
  const handleDeleteHistoryLog = (logId: string) => {
    if (!isAdmin) {
      alert("Solo el Administrador puede eliminar registros de dosis del historial.");
      return;
    }
    if (!historyMed) return;
    if (!window.confirm("¿Está seguro de eliminar este registro de dosis del historial?")) return;

    const updatedLogs = (historyMed.historialAdministracion || []).filter((l) => l.id !== logId);
    const updatedList = medicationsList.map((m) => {
      if (m.id === historyMed.id) {
        return {
          ...m,
          historialAdministracion: updatedLogs,
          ultimaAdministracion: updatedLogs[0]?.fechaHora || undefined,
          administradoPor: updatedLogs[0]?.administradoPor || undefined,
        };
      }
      return m;
    });

    persistKardexRecord(updatedList);
    setHistoryMed({
      ...historyMed,
      historialAdministracion: updatedLogs,
      ultimaAdministracion: updatedLogs[0]?.fechaHora || undefined,
      administradoPor: updatedLogs[0]?.administradoPor || undefined,
    });
  };

  // Open Administration Modal to log dose or mark "sin aplicación" (allowing manual timestamp, defaulting to scheduled date and time)
  const proceedOpenAdministerModal = (
    med: KardexMedication,
    slotTime?: string,
    initialMode: "aplicado" | "sin_aplicacion" = "aplicado",
    defaultOutsideShift: boolean = false,
    targetDateStr?: string
  ) => {
    setAdministeringMed(med);
    const slots = extractTimeSlots(med.horario);
    const targetSlot = slotTime || slots[0] || "08:00";
    setAdministeringSlotTime(targetSlot);

    const nowLocal = new Date();
    const year = nowLocal.getFullYear();
    const month = String(nowLocal.getMonth() + 1).padStart(2, '0');
    const day = String(nowLocal.getDate()).padStart(2, '0');
    const hours = String(nowLocal.getHours()).padStart(2, '0');
    const mins = String(nowLocal.getMinutes()).padStart(2, '0');

    // Use specific scheduled date if provided, otherwise default to today
    const effectiveDate = targetDateStr || `${year}-${month}-${day}`;

    // Extract programmed hour and minute from targetSlot
    const slotMatch = targetSlot ? targetSlot.match(/(\d{1,2}):(\d{2})/) : null;
    const defaultHour = slotMatch ? String(parseInt(slotMatch[1], 10)).padStart(2, '0') : hours;
    const defaultMin = slotMatch ? String(parseInt(slotMatch[2], 10)).padStart(2, '0') : mins;

    // Formatted date string for notes and logs e.g. "22/08/2026"
    const [dY, dM, dD] = effectiveDate.split('-');
    const formattedDisplayDate = (dD && dM && dY) ? `${dD}/${dM}/${dY}` : `${day}/${month}/${year}`;

    setAdminForm({
      modo: initialMode,
      fechaHora: `${effectiveDate}T${defaultHour}:${defaultMin}`,
      administradoPor: currentUserName,
      administradoPorTipo: "enfermeria",
      dosisAplicada: med.dosis || "1 dosis",
      notas: `[Toma programada del ${formattedDisplayDate} a las ${targetSlot} hrs]`,
      fueraDeMiGuardia: defaultOutsideShift,
      motivoSinAplicacion: "No ministrado por familiar durante periodo sin cobertura",
    });
    setIsAdministerModalOpen(true);
  };

  const handleOpenAdministerModal = (
    med: KardexMedication,
    slotTime?: string,
    initialMode: "aplicado" | "sin_aplicacion" = "aplicado",
    targetDateStr?: string
  ) => {
    const slots = extractTimeSlots(med.horario);
    const targetSlot = slotTime || slots[0] || "08:00";
    const targetDateObj = targetDateStr ? new Date(`${targetDateStr}T12:00:00`) : new Date();

    // Check if this SPECIFIC slot was already administered on targetDate
    if (initialMode === "aplicado" && isSlotAdministeredForDate(med, targetSlot, targetDateObj)) {
      setDoubleDoseWarningMed(med);
      setAdministeringSlotTime(targetSlot);
      setIsDoubleDoseWarningOpen(true);
    } else {
      const match = targetSlot.match(/(\d{1,2}):(\d{2})/);
      let isPastSlot = false;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (targetDateStr && targetDateStr < todayStr) {
        isPastSlot = true;
      } else if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const slotMins = h * 60 + m;
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (nowMins - slotMins > 60) {
          isPastSlot = true;
        }
      }
      proceedOpenAdministerModal(med, targetSlot, initialMode, isPastSlot, targetDateStr);
    }
  };

  // Revert / Undo a specific slot administration in case of mistake
  const handleRevertSlotAdministration = (med: KardexMedication, slotTime: string) => {
    const log = getSlotAdminLogToday(med, slotTime);
    if (!log) return;
    if (!window.confirm(`¿Desea desmarcar la toma de las ${slotTime} hrs de ${med.nombreMedicamento}?`)) {
      return;
    }

    const updatedLogs = (med.historialAdministracion || []).filter((l) => l.id !== log.id);
    const updatedList = medicationsList.map((m) => {
      if (m.id === med.id) {
        return {
          ...m,
          ultimaAdministracion: updatedLogs[0]?.fechaHora || undefined,
          administradoPor: updatedLogs[0]?.administradoPor || undefined,
          historialAdministracion: updatedLogs,
        };
      }
      return m;
    });

    persistKardexRecord(updatedList);
  };

  // Adjust administration time by subtracting X minutes from current input
  const handleAdjustTime = (minutesToSubtract: number) => {
    let baseDate = adminForm.fechaHora ? new Date(adminForm.fechaHora) : new Date();
    if (isNaN(baseDate.getTime())) baseDate = new Date();
    
    baseDate.setMinutes(baseDate.getMinutes() - minutesToSubtract);
    
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hours = String(baseDate.getHours()).padStart(2, '0');
    const mins = String(baseDate.getMinutes()).padStart(2, '0');
    setAdminForm(prev => ({
      ...prev,
      fechaHora: `${year}-${month}-${day}T${hours}:${mins}`
    }));
  };

  // Save Administration Record or "Sin Aplicación" record
  const handleSaveAdministerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!administeringMed) return;

    let formattedAdminTime = adminForm.fechaHora;
    let targetAdminDate = new Date();
    try {
      const parts = adminForm.fechaHora.split("T");
      if (parts.length === 2) {
        const [y, m, d] = parts[0].split("-");
        formattedAdminTime = `${d}/${m}/${y}, ${parts[1]} hrs`;
        targetAdminDate = new Date(`${parts[0]}T${parts[1]}:00`);
      }
    } catch {
      formattedAdminTime = adminForm.fechaHora;
    }

    if (isNaN(targetAdminDate.getTime())) {
      targetAdminDate = new Date();
    }

    const targetSlot = administeringSlotTime || extractTimeSlots(administeringMed.horario)[0] || "08:00";
    const isSinAplicacion = adminForm.modo === "sin_aplicacion";
    const targetDatePart = adminForm.fechaHora.split("T")[0] || "";

    const newLogEntry: KardexAdministrationLog = {
      id: `LOG-${Date.now()}`,
      fechaHora: formattedAdminTime,
      administradoPor: isSinAplicacion
        ? `${currentUserName} (Verificación: No ministrado)`
        : (adminForm.administradoPor || currentUserName),
      administradoPorTipo: isSinAplicacion ? "enfermeria" : adminForm.administradoPorTipo,
      dosisAplicada: isSinAplicacion
        ? `Sin aplicación (${adminForm.motivoSinAplicacion})`
        : (adminForm.dosisAplicada || administeringMed.dosis),
      notas: isSinAplicacion
        ? `[Sin Aplicación: ${adminForm.motivoSinAplicacion}] ${adminForm.notas || ""}`.trim()
        : [
            adminForm.fueraDeMiGuardia ? "[Fuera de Guardia]" : "",
            adminForm.administradoPorTipo === "familiar" ? `[Administrado por Familiar: ${adminForm.administradoPor}]` : "",
            adminForm.administradoPorTipo === "medico" ? `[Administrado por Médico: ${adminForm.administradoPor}]` : "",
            adminForm.notas || ""
          ].filter(Boolean).join(" "),
      horarioProgramado: targetSlot,
      tomaSlotId: `${administeringMed.id}-${targetSlot}`,
      fueraDeMiGuardia: Boolean(adminForm.fueraDeMiGuardia),
      estadoAplicacion: isSinAplicacion ? "sin_aplicacion" : "aplicado",
      motivoSinAplicacion: isSinAplicacion ? adminForm.motivoSinAplicacion : undefined,
      verificadoEnGuardia: true,
    };

    const updatedList = medicationsList.map((m) => {
      if (m.id === administeringMed.id) {
        // Replace previous log for the same slot on the same target date
        const prevLogs = (m.historialAdministracion || []).filter((l) => {
          const sameSlot = l.horarioProgramado === targetSlot || l.tomaSlotId === `${m.id}-${targetSlot}`;
          const sameDate = isDateMatching(l.fechaHora, targetAdminDate);
          return !(sameSlot && sameDate);
        });

        return {
          ...m,
          ultimaAdministracion: isSinAplicacion ? m.ultimaAdministracion : formattedAdminTime,
          administradoPor: isSinAplicacion ? m.administradoPor : (adminForm.administradoPor || currentUserName),
          historialAdministracion: [newLogEntry, ...prevLogs],
        };
      }
      return m;
    });

    persistKardexRecord(updatedList);

    // Automatically deduct the exact dosage units from inventory ONLY IF estadoAplicacion is 'aplicado'
    if (!isSinAplicacion && onSaveInventoryItem) {
      const normalizeStr = (s: string = "") =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      const normAdminMed = normalizeStr(administeringMed.nombreMedicamento || "");
      const unitsToDeduct = administeringMed.dosisPorToma && administeringMed.dosisPorToma > 0
        ? Number(administeringMed.dosisPorToma)
        : (parseUnitsPerDose(adminForm.dosisAplicada || administeringMed.dosis, administeringMed.frecuencia) || 1);

      const timestamp = getCurrentTimestamp();
      const [dY, dM, dD] = targetDatePart.split('-');
      const dateDisplayForNote = (dD && dM && dY) ? `${dD}/${dM}/${dY}` : formattedAdminTime;

      const matchInvItem = (inventoryItems || []).find(
        (inv) =>
          inv.clientId && (inv.clientId || "").toUpperCase() === (effectiveClientId || "").toUpperCase() &&
          (inv.kardexMedicationId === administeringMed.id ||
            (inv.nombre && (
              normalizeStr(inv.nombre) === normAdminMed ||
              normalizeStr(inv.nombre).includes(normAdminMed) ||
              normAdminMed.includes(normalizeStr(inv.nombre))
            )))
      );

      if (matchInvItem) {
        const prevStock = matchInvItem.stockActual ?? 0;
        const newStock = Math.max(0, prevStock - unitsToDeduct);

        const movement: InventoryMovement = {
          id: `MOV-${Date.now()}`,
          tipo: "Descuento_Kardex",
          cantidad: -unitsToDeduct,
          stockAnterior: prevStock,
          stockNuevo: newStock,
          fechaHora: timestamp,
          registradoPor: adminForm.administradoPor || currentUserName,
          notas: adminForm.fueraDeMiGuardia
            ? `Dosis Kárdex fuera de guardia/relevo (Toma ${targetSlot} hrs del ${dateDisplayForNote}): -${unitsToDeduct} ${matchInvItem.unidadMedida || 'dosis'} (${administeringMed.nombreMedicamento}) - Administrado por ${adminForm.administradoPor || currentUserName}`
            : `Dosis administrada en Kárdex (Toma ${targetSlot} hrs del ${dateDisplayForNote}): -${unitsToDeduct} ${matchInvItem.unidadMedida || 'dosis'} (${administeringMed.nombreMedicamento})`,
          referenciaKardexId: administeringMed.id,
        };

        const updatedInvItem: InventoryItem = {
          ...matchInvItem,
          kardexMedicationId: administeringMed.id,
          controlTipo: "Con Control Kardex/Conteo",
          stockActual: newStock,
          dosesPerDay: administeringMed.vecesAlDia || matchInvItem.dosesPerDay || 1,
          frecuenciaKardex: administeringMed.frecuencia || matchInvItem.frecuenciaKardex,
          ultimaActualizacion: timestamp,
          historialMovimientos: [movement, ...(matchInvItem.historialMovimientos || [])],
        };

        onSaveInventoryItem(updatedInvItem);
      } else {
        // Auto-create inventory item for this patient so stock is seamlessly tracked
        const initialStock = 20;
        const newStock = Math.max(0, initialStock - unitsToDeduct);

        const movement: InventoryMovement = {
          id: `MOV-${Date.now()}`,
          tipo: "Descuento_Kardex",
          cantidad: -unitsToDeduct,
          stockAnterior: initialStock,
          stockNuevo: newStock,
          fechaHora: timestamp,
          registradoPor: adminForm.administradoPor || currentUserName,
          notas: `Registro inicial de Kárdex (Toma ${targetSlot} hrs del ${dateDisplayForNote}): -${unitsToDeduct} dosis administradas (${administeringMed.nombreMedicamento})`,
          referenciaKardexId: administeringMed.id,
        };

        const newInvItem: InventoryItem = {
          id: `INV-${Date.now()}`,
          clientId: effectiveClientId,
          nombre: administeringMed.nombreMedicamento,
          categoria: "Medicamento",
          controlTipo: "Con Control Kardex/Conteo",
          kardexMedicationId: administeringMed.id,
          stockActual: newStock,
          unidadMedida: "Tabletas / Dosis",
          frecuenciaKardex: administeringMed.frecuencia || "Según horario",
          dosesPerDay: administeringMed.vecesAlDia || 1,
          daysThresholdAlert: administeringMed.diasAlertaResurtido || 7,
          tipoTratamiento: administeringMed.tipoTratamiento || "Indefinido",
          fechaInicioTratamiento: administeringMed.fechaInicioTratamiento,
          fechaFinTratamiento: administeringMed.fechaFinTratamiento,
          duracionDiasTratamiento: administeringMed.duracionDias,
          notas: `Vinculado automáticamente desde Kárdex de Medicación (${administeringMed.dosis} - ${administeringMed.horario})`,
          registradoPor: adminForm.administradoPor || currentUserName || "Personal de Enfermería",
          fechaCreacion: timestamp,
          ultimaActualizacion: timestamp,
          historialMovimientos: [movement],
        };

        onSaveInventoryItem(newInvItem);
      }
    }

    setIsAdministerModalOpen(false);
  };

  // Open History Modal
  const handleOpenHistoryModal = (med: KardexMedication) => {
    setHistoryMed(med);
    setIsHistoryModalOpen(true);
  };

  // Save Alergias & Patient Notes
  const handleSaveAlergiasSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    persistKardexRecord(medicationsList, alergiasText, notasText);
    setIsAlergiasModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Pill className="w-3 h-3 text-emerald-400" />
                Kárdex de Medicación y Cuidados
              </span>
              {!canEdit && (
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Modo Lectura (Cliente)
                </span>
              )}
            </div>

            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>{patientName}</span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md font-normal">
                {effectiveClientId}
              </span>
            </h2>

            <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
              <span>
                <strong>Diagnóstico:</strong>{" "}
                {currentClient?.diagnostico || currentCaratula?.diagnostico || "Atención Domiciliaria Integrativa"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* PDF Export & Print Buttons strictly for Admin or Client */}
            {(userRole === "admin" || userRole === "client") && (
              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleDownloadKardexPDF}
                  disabled={isDownloadingPDF}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  title="Generar y Descargar Archivo PDF del Kárdex Oficial"
                >
                  <Download className={`w-4 h-4 text-emerald-100 ${isDownloadingPDF ? "animate-bounce" : ""}`} />
                  <span>{isDownloadingPDF ? "Generando PDF..." : "Descargar PDF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 shrink-0"
                  title="Abrir Vista Previa e Imprimir Kárdex Oficial"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>Imprimir / Vista Previa</span>
                </button>
              </div>
            )}

            {/* Receptor de Servicio Selector (If not pre-filtered in Client Portal) */}
            {!filterClientId && clients.length > 0 && (
              <div className="min-w-[280px] sm:min-w-[340px]">
                <ReceptorServicioSearchSelector
                  clients={clients}
                  caratulas={caratulas}
                  selectedClientId={selectedClientId}
                  onSelectClient={(newId) => {
                    setSelectedClientId(newId);
                    if (onSelectClient) onSelectClient(newId);
                  }}
                  variant="card"
                  label="Receptor de Servicio Seleccionado"
                  placeholder="Buscar Receptor, Orden o Responsable..."
                />
              </div>
            )}
          </div>
        </div>

        {/* ALWAYS VISIBLE CONFIDENTIALITY NOTICE FOR PERSONAL / ENFERMERÍA */}
        {userRole === "nurse" && (
          <div className="mt-4 pt-3 border-t border-slate-800 bg-amber-950/80 border-amber-500/70 p-3.5 rounded-xl text-amber-200 space-y-1 print:hidden">
            <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
              <span>Aviso de Confidencialidad Obligatorio para el Personal</span>
            </div>
            <p className="text-xs text-amber-100/90 font-medium leading-relaxed">
              El personal no tiene autorizado imprimir, fotografiar, realizar capturas o extraer información de la plataforma o expedientes sin autorización expresa por escrito de Cuidarte Pachuca.
            </p>
          </div>
        )}

        {/* LATEST MEDICATION / MODIFICATION BANNER */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Última Actualización / Registro en Kárdex
              </span>
              <div className="text-sm font-semibold text-emerald-300 font-mono mt-0.5">
                {existingKardex?.ultimaModificacion ? (
                  <>
                    <span>{existingKardex.ultimaModificacion}</span>
                    <span className="text-slate-300 text-xs font-sans ml-2">
                      por <strong>{existingKardex.modificadoPor || "Enfermería"}</strong>
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 text-xs italic font-sans">
                    Sin registros previos de medicación en el sistema
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-4 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider block flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" /> Alergias Registradas
              </span>
              <span className="text-xs text-white font-medium block truncate max-w-[180px]">
                {existingKardex?.alergias || "Sin alergias declaradas"}
              </span>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  setAlergiasText(existingKardex?.alergias || "Sin alergias declaradas");
                  setNotasText(existingKardex?.notasGenerales || "");
                  setIsAlergiasModalOpen(true);
                }}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-600 transition"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BANNER DE RELEVO DE GUARDIA Y CONTROL DE MEDICACIÓN (Exclusivo personal clínico: Enfermería y Administración) */}
      {userRole !== "client" && canEdit && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-50 to-orange-50/50 border border-amber-300 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                    Control Clínico de Relevo de Guardia
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-extrabold text-amber-950 mt-0.5">
                  “Verifica si se ministraron los medicamentos fuera de turno. Registra quién los administró.”
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              {pendingVerificationTakes.length > 0 ? (
                <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{pendingVerificationTakes.length} toma(s) previas al turno pendientes</span>
                </span>
              ) : (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Al corriente: sin tomas vencidas previas al turno</span>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-amber-900/90 leading-relaxed">
            Si antes del inicio de su turno o durante el periodo sin cobertura de enfermería el medicamento fue suministrado por un familiar, cuidador o médico, es obligatorio registrar la aplicación para mantener el <strong>expediente clínico al día y descontar las unidades del inventario</strong>. Si no fue ministrado, márquelo formalmente como <strong>“Sin aplicación”</strong> para no afectar el stock. Las tomas programadas dentro de su turno activo se gestionan en el cronograma regular.
          </p>

          {/* Quick action bar for pending takes requiring verification */}
          {pendingVerificationTakes.length > 0 && canEdit && (
            <div className="pt-2 border-t border-amber-200/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Tomas vencidas previas al inicio de turno que requieren registro:
                </span>
                <span className="text-[10px] text-amber-800 font-semibold hidden sm:inline">
                  Verifique con familiar / receptor si se administraron antes de su llegada
                </span>
              </div>
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5">
                {pendingVerificationTakes.slice(0, 10).map(({ med, slotTime, isPastDue, scheduledDate, formattedDate, isYesterday }) => (
                  <div
                    key={`${med.id}-${slotTime}-${scheduledDate}`}
                    className={`bg-white border rounded-2xl p-3 shrink-0 min-w-[250px] max-w-[280px] shadow-2xs space-y-2 ${
                      isYesterday ? "border-rose-300 bg-rose-50/20" : "border-amber-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                          {slotTime} hrs
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border ${
                          isYesterday ? "bg-rose-100 text-rose-900 border-rose-200" : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}>
                          <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>
                      {isPastDue && (
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isYesterday ? "bg-rose-100 text-rose-900 border border-rose-300" : "bg-amber-100 text-amber-900 border border-amber-300"
                        }`}>
                          {isYesterday ? "Día previo" : "Fuera de turno"}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black text-slate-900 truncate" title={med.nombreMedicamento}>
                        {med.nombreMedicamento}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                        <span className="truncate font-semibold">{med.dosis}</span>
                        <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          {med.via || "Vía general"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 text-[10.5px] text-amber-950 leading-tight">
                      Preguntar por toma del <strong>{formattedDate} ({slotTime} hrs)</strong>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAdministerModal(med, slotTime, "aplicado", scheduledDate)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1.5 px-2 rounded-xl transition text-center flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                        title={`Registrar toma aplicada del ${formattedDate} a las ${slotTime} hrs`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>✓ Registrar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAdministerModal(med, slotTime, "sin_aplicacion", scheduledDate)}
                        className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold py-1.5 px-2 rounded-xl transition text-center flex items-center justify-center gap-1 cursor-pointer"
                        title={`Registrar como no aplicada del ${formattedDate} a las ${slotTime} hrs`}
                      >
                        <Ban className="w-3 h-3 text-amber-700" />
                        <span>Sin Aplicar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Controls & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        {/* View Mode Toggle: Horarios Acomodados vs Tarjetas */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setKardexViewMode("horarios")}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              kardexViewMode === "horarios"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cronograma por Horario</span>
          </button>

          <button
            onClick={() => setKardexViewMode("medicamentos")}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              kardexViewMode === "medicamentos"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            <Pill className="w-3.5 h-3.5 text-sky-400" />
            <span>Vista por Medicamento</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveFilter("activos")}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeFilter === "activos"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Activos</span>
            <span className="bg-emerald-800/30 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("suspendidos")}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeFilter === "suspendidos"
                ? "bg-slate-800 text-white shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Suspendidos / Concluidos</span>
            <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {inactiveCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter("todos")}
            className={`flex-1 sm:flex-none text-xs font-bold px-3 py-1.5 rounded-lg transition ${
              activeFilter === "todos"
                ? "bg-slate-800 text-white shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Todos ({medicationsList.length})
          </button>
        </div>

        {/* Search & Add Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar medicamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {canEdit && (
            <button
              onClick={handleOpenAddMed}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Medicamento</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: CRONOGRAMA DE TOMAS (ACOMODADO POR HORARIOS) */}
      {kardexViewMode === "horarios" ? (
        <div className="space-y-4">
          {chronologicalTakes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Sin tomas programadas en el Kárdex
              </h4>
              <p className="text-slate-600 text-xs max-w-md mx-auto">
                Registre medicamentos activos con sus respectivos horarios para ver la lista acomodada por horas de aplicación.
              </p>
              {canEdit && (
                <button
                  onClick={handleOpenAddMed}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Medicamento al Kárdex</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chronological Header with Visual Chromatic Legend */}
              <div className="bg-slate-900 text-white p-4 rounded-3xl border border-slate-800 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white tracking-wide">
                        Cronograma Diario y Semáforo de Horarios en Tiempo Real
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Hora del sistema: <strong className="text-emerald-400 font-mono">{currentTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="bg-slate-800 text-emerald-300 border border-slate-700 font-mono text-[11px] px-3 py-1 rounded-full font-bold self-start sm:self-auto">
                    {chronologicalTakes.length} horario(s) programado(s)
                  </span>
                </div>

                {/* Chromatic Legend / Semáforo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[10.5px]">
                  <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded-xl font-bold">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                    <span>🚨 Dosis Atrasada / Vencida</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-blue-950/60 border border-blue-500/30 text-blue-300 px-2.5 py-1 rounded-xl font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>⚡ Toma Inmediata (Hora Actual)</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-xl font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>⏳ Próxima Toma Programada</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-xl font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>✓ Dosis Aplicada Hoy</span>
                  </div>
                </div>
              </div>

              {chronologicalTakes.map(({ timeStr, takes }) => {
                // Determine slot-level highest urgency
                const slotUrgencies = takes.map((m) =>
                  getTakeScheduleUrgency(timeStr, isSlotAdministeredToday(m, timeStr), currentTime)
                );
                const hasOverdue = slotUrgencies.some((u) => u.urgencyLevel === "vencida");
                const hasImmediate = slotUrgencies.some((u) => u.urgencyLevel === "inmediata");
                const allAdministered = slotUrgencies.every((u) => u.urgencyLevel === "administrado");

                return (
                  <div
                    key={timeStr}
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all duration-300 ${
                      hasOverdue
                        ? "border-rose-400 ring-2 ring-rose-500/20 shadow-rose-100"
                        : hasImmediate
                        ? "border-blue-400 ring-2 ring-blue-500/20 shadow-blue-100"
                        : allAdministered
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Time Slot Header */}
                    <div className={`px-4 py-3 flex items-center justify-between transition-colors ${
                      hasOverdue
                        ? "bg-rose-900 text-white"
                        : hasImmediate
                        ? "bg-blue-900 text-white"
                        : allAdministered
                        ? "bg-emerald-900 text-white"
                        : "bg-slate-900 text-white"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 font-black rounded-xl flex items-center justify-center text-xs font-mono shadow-xs ${
                          hasOverdue
                            ? "bg-rose-500 text-white animate-pulse"
                            : hasImmediate
                            ? "bg-blue-400 text-slate-950 animate-pulse"
                            : allAdministered
                            ? "bg-emerald-400 text-slate-950"
                            : "bg-emerald-500 text-slate-950"
                        }`}>
                          {timeStr}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-white tracking-wide flex items-center gap-2">
                            <span>Toma de las {timeStr} hrs</span>
                            {hasOverdue && (
                              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-bounce">
                                🚨 ATENCIÓN REQUERIDA
                              </span>
                            )}
                            {hasImmediate && (
                              <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse">
                                ⚡ HORA ACTUAL DE APLICACIÓN
                              </span>
                            )}
                          </h4>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-slate-200 bg-black/30 px-3 py-1 rounded-full font-mono">
                        {takes.length} medicamento(s) a esta hora
                      </span>
                    </div>

                    {/* Medications list for this time slot */}
                    <div className="divide-y divide-slate-100">
                      {takes.map((med) => {
                        const isSlotDone = isSlotAdministeredToday(med, timeStr);
                        const isSlotSinApp = isSlotSinAplicacionToday(med, timeStr);
                        const slotLog = getSlotAdminLogToday(med, timeStr);
                        const urgency = getTakeScheduleUrgency(timeStr, isSlotDone, currentTime, isSlotSinApp);

                        return (
                          <div
                            key={med.id}
                            className={`p-4.5 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-3 ${urgency.containerClass} ${urgency.glowClass}`}
                          >
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`w-3 h-3 rounded-full shrink-0 ${
                                  urgency.urgencyLevel === 'vencida'
                                    ? 'bg-rose-600 animate-ping'
                                    : urgency.urgencyLevel === 'inmediata'
                                    ? 'bg-blue-600 animate-pulse'
                                    : urgency.urgencyLevel === 'proxima_inminente'
                                    ? 'bg-sky-500'
                                    : urgency.urgencyLevel === 'proxima_cercana'
                                    ? 'bg-amber-500'
                                    : isSlotDone
                                    ? 'bg-emerald-600'
                                    : isSlotSinApp
                                    ? 'bg-amber-600'
                                    : 'bg-slate-400'
                                }`}></div>

                                <h5 className="font-extrabold text-slate-900 text-base leading-tight">
                                  {med.nombreMedicamento}
                                </h5>

                                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                                  {med.via}
                                </span>

                                {/* Urgency Status Badge */}
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs ${urgency.badgeClass}`}>
                                  {urgency.urgencyLevel === "vencida" && <AlertTriangle className="w-3 h-3 shrink-0" />}
                                  {urgency.urgencyLevel === "inmediata" && <Zap className="w-3 h-3 shrink-0" />}
                                  {urgency.urgencyLevel === "proxima_inminente" && <Clock className="w-3 h-3 shrink-0" />}
                                  {urgency.urgencyLevel === "proxima_cercana" && <Flame className="w-3 h-3 shrink-0" />}
                                  {urgency.urgencyLevel === "administrado" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                                  {urgency.urgencyLevel === "sin_aplicacion" && <Ban className="w-3 h-3 shrink-0" />}
                                  <span>{urgency.badgeLabel}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-600 pl-5 flex-wrap">
                                <span>Dosis: <strong className="text-slate-900 font-semibold">{med.dosis}</strong></span>
                                <span>•</span>
                                <span>Frecuencia: <strong className="text-slate-800">{med.frecuencia}</strong></span>
                                <span>•</span>
                                <span className="font-mono text-emerald-800 font-bold">Horario de esta toma: {timeStr} hrs</span>
                              </div>

                              {med.indicaciones && (
                                <p className="text-xs text-amber-950 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl ml-5 font-medium">
                                  <strong>Indicación:</strong> {med.indicaciones}
                                </p>
                              )}

                              {isSlotDone ? (
                                <div className="text-xs text-emerald-900 font-mono font-bold pl-5 pt-0.5 flex items-center gap-2 flex-wrap">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>Toma de las {timeStr} hrs aplicada hoy: <strong>{slotLog?.fechaHora || 'Hoy'}</strong> {slotLog?.administradoPor ? `(por ${slotLog.administradoPor})` : ''}</span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevertSlotAdministration(med, timeStr)}
                                      className="text-[10px] text-rose-600 hover:text-rose-800 underline font-sans font-semibold cursor-pointer ml-1"
                                      title="Desmarcar esta aplicación específica"
                                    >
                                      Desmarcar
                                    </button>
                                  )}
                                </div>
                              ) : isSlotSinApp ? (
                                <div className="text-xs text-amber-950 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl ml-5 font-mono font-semibold flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <Ban className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <span>Registrada como <strong>Sin Aplicación</strong>: {slotLog?.motivoSinAplicacion || 'No ministrada'} {slotLog?.administradoPor ? `(Verificó: ${slotLog.administradoPor})` : ''}</span>
                                  </div>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevertSlotAdministration(med, timeStr)}
                                      className="text-[10px] text-rose-600 hover:text-rose-800 underline font-sans font-semibold cursor-pointer"
                                      title="Revertir y permitir nuevo registro"
                                    >
                                      Modificar
                                    </button>
                                  )}
                                </div>
                              ) : med.ultimaAdministracion ? (
                                <div className="text-[11px] text-slate-500 font-mono pl-5 pt-0.5">
                                  Última dosis previa registrada: <span className="font-bold text-slate-800">{med.ultimaAdministracion}</span> {med.administradoPor ? `(por ${med.administradoPor})` : ''}
                                </div>
                              ) : null}
                            </div>

                            {/* Action buttons with dynamic chromatic colors */}
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center pl-5 md:pl-0">
                              {canEdit && (
                                <button
                                  onClick={() => handleOpenAdministerModal(med, timeStr)}
                                  className={`font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all duration-200 flex items-center gap-1.5 ${urgency.buttonClass}`}
                                >
                                  <Syringe className="w-3.5 h-3.5" />
                                  <span>{isSlotDone ? "✓ Aplicada" : isSlotSinApp ? "Modificar Registro" : `Registrar Toma (${timeStr} hrs)`}</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenHistoryModal(med)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition flex items-center gap-1"
                                title="Ver historial de dosis aplicadas"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Histórico</span>
                              </button>

                              {canEdit && (
                                <button
                                  onClick={() => handleOpenEditMed(med)}
                                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                                  title="Editar medicamento"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: TARJETAS POR MEDICAMENTO (VISTA GRID REORGANIZADA) */
        filteredMeds.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Pill className="w-6 h-6" />
            </div>
            <p className="text-slate-600 font-medium text-sm">
              {searchTerm
                ? "No se encontraron medicamentos con ese término de búsqueda."
                : activeFilter === "activos"
                ? "No hay medicamentos activos registrados en el Kárdex de este receptor de servicio."
                : "No hay medicamentos suspendidos registrados."}
            </p>
            {canEdit && !searchTerm && (
              <button
                onClick={handleOpenAddMed}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar Primer Medicamento</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMeds.map((med) => {
              const effectiveStatus = getEffectiveMedStatus(med);
              const isActive = effectiveStatus === "Activo";
              const isCompleted = effectiveStatus === "Completado";
              const isGivenToday = isDoseAdministeredToday(med);
              const todayInfo = getTodayAdminDetails(med);
              const progressToday = getMedicationDosesProgressToday(med);

              // Calculate real-time overall urgency based on scheduled hours and current time
              const overallUrgency = getMedicationOverallUrgency(med, isGivenToday, currentTime);

              // Find matching inventory item stock
              const matchInv = inventoryItems.find(
                (inv) =>
                  inv.clientId && (inv.clientId || "").toUpperCase() === (effectiveClientId || "").toUpperCase() &&
                  (inv.kardexMedicationId === med.id ||
                    inv.nombre.toLowerCase().includes(med.nombreMedicamento.toLowerCase()) ||
                    med.nombreMedicamento.toLowerCase().includes(inv.nombre.toLowerCase()))
              );

              // Calculate stock & treatment status
              const stockStatus = matchInv
                ? calculateStockAndTreatmentStatus({
                    ...matchInv,
                    dosis: med.dosis || matchInv.dosis,
                    horario: med.horario || matchInv.horario,
                    frecuencia: med.frecuencia || matchInv.frecuencia,
                    frecuenciaKardex: matchInv.frecuenciaKardex || `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}`,
                    fechaFinTratamiento: med.fechaFinTratamiento || matchInv.fechaFinTratamiento,
                    duracionDias: med.duracionDias || matchInv.duracionDiasTratamiento,
                    tipoTratamiento: med.tipoTratamiento || matchInv.tipoTratamiento,
                    diasAlertaResurtido: med.diasAlertaResurtido || matchInv.daysThresholdAlert,
                    estado: effectiveStatus,
                  })
                : null;

              const reqTotalDoses = med.dosisTotalesRequeridas || (calculateDosesPerDay(med.horario) * (med.duracionDias || 1));

              return (
                <div
                  key={med.id}
                  className={`bg-white rounded-3xl border transition-all duration-300 shadow-sm hover:shadow-md overflow-hidden flex flex-col justify-between ${
                    isCompleted
                      ? "border-indigo-200 bg-indigo-50/20"
                      : overallUrgency.glowClass || (isGivenToday ? "border-emerald-300" : "border-slate-200")
                  }`}
                >
                  <div className="p-4.5 space-y-3">
                    {/* Urgency Chromatic Alert Ribbon */}
                    {isActive && overallUrgency.urgencyLevel !== "futura" && (
                      <div className={`px-3.5 py-2 rounded-2xl text-xs font-black flex items-center justify-between shadow-2xs ${
                        overallUrgency.urgencyLevel === "vencida"
                          ? "bg-rose-600 text-white animate-pulse"
                          : overallUrgency.urgencyLevel === "inmediata"
                          ? "bg-blue-600 text-white animate-pulse"
                          : overallUrgency.urgencyLevel === "proxima_inminente"
                          ? "bg-sky-600 text-white"
                          : overallUrgency.urgencyLevel === "proxima_cercana"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "bg-emerald-600 text-white"
                      }`}>
                        <div className="flex items-center gap-2">
                          {overallUrgency.urgencyLevel === "vencida" && <AlertTriangle className="w-4 h-4 text-rose-200 animate-bounce" />}
                          {overallUrgency.urgencyLevel === "inmediata" && <Zap className="w-4 h-4 text-blue-200 animate-pulse" />}
                          {overallUrgency.urgencyLevel === "proxima_inminente" && <Clock className="w-4 h-4 text-sky-200" />}
                          {overallUrgency.urgencyLevel === "proxima_cercana" && <Flame className="w-4 h-4 text-amber-900" />}
                          {overallUrgency.urgencyLevel === "administrado" && <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
                          <span className="uppercase tracking-wide">{overallUrgency.badgeLabel}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-90">
                          {overallUrgency.urgencyLevel === "administrado" ? "Se desmarca a las 11:59 PM" : `Toma: ${overallUrgency.closestTakeTime || med.horario}`}
                        </span>
                      </div>
                    )}

                    {/* Card Header: Name + Status Badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                            overallUrgency.urgencyLevel === "vencida"
                              ? "bg-rose-600 animate-pulse"
                              : overallUrgency.urgencyLevel === "inmediata"
                              ? "bg-blue-600"
                              : isActive
                              ? "bg-emerald-600"
                              : isCompleted
                              ? "bg-indigo-600"
                              : "bg-slate-500"
                          }`}
                        >
                          <Pill className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base leading-snug">
                            {med.nombreMedicamento}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-semibold text-slate-600">
                              Dosis: <strong className="text-slate-900">{med.dosis}</strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-semibold text-slate-600">
                              Vía: <strong className="text-emerald-700">{med.via}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${
                            isCompleted
                              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                              : isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-300"
                          }`}
                        >
                          {isCompleted ? "Tratamiento Concluido" : effectiveStatus}
                        </span>

                        {matchInv && stockStatus && (
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                            stockStatus.isTreatmentFinished
                              ? "bg-indigo-50 text-indigo-900 border border-indigo-200"
                              : stockStatus.isLowStock
                              ? "bg-amber-100 text-amber-950 border border-amber-300"
                              : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          }`}>
                            <Package className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {stockStatus.isTreatmentFinished
                                ? "Stock Suficiente (Fin)"
                                : `Stock: ${matchInv.stockActual} ${matchInv.unidadMedida} (~${stockStatus.daysOfStock}d)`}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Schedule & Frequency Details */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Horario de Aplicación
                        </span>
                        <span className="font-mono font-black text-slate-900 flex items-center gap-1 mt-0.5 text-sm">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {med.horario}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Frecuencia
                        </span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {med.frecuencia}
                        </span>
                      </div>
                    </div>

                    {/* Daily Dose Slots Status & Quick Administering */}
                    {isActive && progressToday.totalSlots > 0 && (
                      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            Tomas de Hoy ({progressToday.administeredCount}/{progressToday.totalSlots}):
                          </span>
                          <span className={`font-black font-mono text-[10px] px-2 py-0.5 rounded-full ${
                            progressToday.administeredCount === progressToday.totalSlots
                              ? "bg-emerald-100 text-emerald-800"
                              : progressToday.administeredCount > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200 text-slate-700"
                          }`}>
                            {progressToday.administeredCount === progressToday.totalSlots
                              ? "✓ Todas aplicadas"
                              : `${progressToday.totalSlots - progressToday.administeredCount} pendiente(s)`}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {progressToday.slotsStatus.map(({ slot, administered, sinAplicacion, log }) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => {
                                if (canEdit) {
                                  handleOpenAdministerModal(med, slot);
                                }
                              }}
                              disabled={!canEdit}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-xl transition flex items-center gap-1.5 border shadow-2xs ${
                                administered
                                  ? "bg-emerald-100 text-emerald-950 border-emerald-300 hover:bg-emerald-200"
                                  : sinAplicacion
                                  ? "bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200"
                                  : "bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50"
                              }`}
                              title={
                                administered
                                  ? `Toma ${slot} hrs aplicada hoy por ${log?.administradoPor || 'personal'}`
                                  : sinAplicacion
                                  ? `Toma ${slot} hrs registrada Sin Aplicación: ${log?.motivoSinAplicacion || 'No ministrada'}`
                                  : `Registrar toma de las ${slot} hrs`
                              }
                            >
                              {administered ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              ) : sinAplicacion ? (
                                <Ban className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                              <span className="font-mono">{slot} hrs</span>
                              {administered ? (
                                <span className="text-[10px] text-emerald-700 font-extrabold">✓</span>
                              ) : sinAplicacion ? (
                                <span className="text-[10px] text-amber-800 font-extrabold">Sin Aplicar</span>
                              ) : canEdit ? (
                                <span className="text-[9px] text-emerald-600 font-bold underline ml-0.5">Aplicar</span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Treatment Duration & Purchase Requirements Section */}
                    <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                      isCompleted || (stockStatus && stockStatus.isTreatmentFinished)
                        ? "bg-indigo-50/80 border-indigo-200 text-indigo-950"
                        : stockStatus && stockStatus.isLowStock
                        ? "bg-amber-50/90 border-amber-300 text-amber-950"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-black uppercase flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                          {med.tipoTratamiento === "FinDefinido" || med.fechaFinTratamiento ? "Tratamiento con Fin Programado" : "Tratamiento Indefinido / Continuo"}
                        </span>
                        {med.fechaFinTratamiento && (
                          <span className="text-[11px] font-black font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            Fin: {med.fechaFinTratamiento}
                          </span>
                        )}
                      </div>

                      {/* Daily Consumption and Stock Autonomy Details */}
                      {stockStatus && matchInv && !isCompleted && !stockStatus.isTreatmentFinished && (
                        <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200/80 text-[11px] space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-bold text-slate-500">Consumo diario:</span>
                            <span className="font-extrabold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                              {stockStatus.dailyConsumptionUnits} {matchInv.unidadMedida}/día ({stockStatus.dosesPerDay} tomas de {stockStatus.unitsPerDose > 1 ? `${stockStatus.unitsPerDose} ${matchInv.unidadMedida}` : `1 ${matchInv.unidadMedida}`}/día)
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-bold text-slate-500">Autonomía de stock:</span>
                            <span className={`font-extrabold font-mono px-2 py-0.5 rounded-md ${stockStatus.isLowStock ? "bg-amber-100 text-amber-950 border border-amber-300" : "bg-emerald-100 text-emerald-950 border border-emerald-300"}`}>
                              Rinde para {stockStatus.autonomyFormattedText} (Se agota: {stockStatus.stockExhaustionDateStr})
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Explicit Stock & Resupply Guidance */}
                      {isCompleted || (stockStatus && stockStatus.isTreatmentFinished) ? (
                        <p className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          Tratamiento terminado. Ya no se requiere comprar este medicamento.
                        </p>
                      ) : stockStatus?.hasEndDate ? (
                        <div className="space-y-1 text-[11px]">
                          <p className="text-slate-800 font-medium">
                            • Faltan <strong>{stockStatus.remainingDaysTreatment} días</strong> para terminar el tratamiento ({stockStatus.totalDosesNeededToFinish} {matchInv?.unidadMedida || 'tabletas'} totales requeridas).
                          </p>
                          {stockStatus.rawDaysOfStock < stockStatus.remainingDaysTreatment ? (
                            <p className="text-bold text-amber-950 bg-amber-200/70 p-2 rounded-xl border border-amber-300">
                              ⚠️ <strong>Stock insuficiente para finalizar:</strong> El stock actual ({matchInv?.stockActual || 0} {matchInv?.unidadMedida || 'tabletas'}) solo alcanza para <u>{stockStatus.autonomyFormattedText} de los {stockStatus.remainingDaysTreatment} días</u> restantes. Se deben comprar <strong>{stockStatus.suggestedPurchaseQty} {matchInv?.unidadMedida || 'tabletas'}</strong> para completar el tratamiento.
                            </p>
                          ) : (
                            <p className="text-emerald-800 font-bold bg-emerald-100/60 p-1.5 rounded-xl border border-emerald-200">
                              ✓ Stock suficiente en domicilio para cubrir los {stockStatus.remainingDaysTreatment} días restantes de tratamiento.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1 text-[11px]">
                          <p className="text-slate-800 font-medium">
                            • Tratamiento continuo ({stockStatus?.dosesPerDay || calculateDosesPerDay(med.horario)} tomas/día). El stock disponible ({matchInv?.stockActual || 0} {matchInv?.unidadMedida || 'tabletas'}) rinde para <strong>{stockStatus ? stockStatus.autonomyFormattedText : '?'}</strong> antes de agotarse ({stockStatus?.stockExhaustionDateStr}).
                          </p>
                          {stockStatus?.isLowStock ? (
                            <p className="font-bold text-amber-950 bg-amber-200/70 p-2 rounded-xl border border-amber-300">
                              🛒 <strong>Alerta de resurtido:</strong> Pedir <strong>{stockStatus.suggestedPurchaseQty} {matchInv?.unidadMedida || 'tabletas'}</strong> (Surtido estimado para 1 mes / 30 días).
                            </p>
                          ) : (
                            <p className="text-emerald-800 font-medium">
                              ✓ Stock disponible dentro del margen seguro de autonomía.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Nurse Configurable Resupply Days Threshold */}
                      {canEdit && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 text-[10.5px]">
                          <span className="text-slate-500 font-bold flex items-center gap-1">
                            <Bell className="w-3 h-3 text-slate-400" /> Alertar si rinde menos de:
                          </span>
                          <select
                            value={med.diasAlertaResurtido || 5}
                            onChange={(e) => {
                              const newDays = Number(e.target.value);
                              const updatedMeds = medicationsList.map((m) =>
                                m.id === med.id ? { ...m, diasAlertaResurtido: newDays } : m
                              );
                              persistKardexRecord(updatedMeds);

                              // Sync with inventory item if exists
                              if (matchInv && onSaveInventoryItem) {
                                onSaveInventoryItem({
                                  ...matchInv,
                                  daysThresholdAlert: newDays,
                                  duracionDiasTratamiento: med.duracionDias,
                                  fechaFinTratamiento: med.fechaFinTratamiento,
                                  tipoTratamiento: med.tipoTratamiento,
                                });
                              }
                            }}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 font-bold text-slate-800 text-[10.5px] focus:ring-1 focus:ring-emerald-500 outline-none"
                            title="Configurar con cuántos días de anticipación alertar al personal"
                          >
                            <option value={3}>3 días</option>
                            <option value={5}>5 días</option>
                            <option value={7}>7 días (1 sem)</option>
                            <option value={10}>10 días</option>
                            <option value={14}>14 días (2 sem)</option>
                            <option value={30}>30 días (1 mes)</option>
                          </select>
                        </div>
                      )}
                    </div>

                  {/* Special Instructions */}
                  {med.indicaciones && (
                    <div className="text-xs text-slate-700 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-900 block text-[10px] uppercase">
                          Indicaciones Especiales:
                        </span>
                        <p className="text-slate-800 mt-0.5 leading-relaxed">
                          {med.indicaciones}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Last Administered Banner & History Trigger */}
                  <div className={`p-3 rounded-xl text-xs space-y-2 ${isGivenToday ? 'bg-emerald-100/90 border border-emerald-300' : 'bg-emerald-50/70 border border-emerald-100'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-900 block flex items-center gap-1">
                          {isGivenToday && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                          {isGivenToday ? "Dosis Aplicada Hoy:" : "Última Dosis Aplicada:"}
                        </span>
                        <span className="font-mono font-bold text-emerald-950 block mt-0.5 text-xs">
                          {isGivenToday ? todayInfo : (med.ultimaAdministracion || "Sin registro de aplicación previa")}
                        </span>
                        {!isGivenToday && med.administradoPor && (
                          <span className="text-[10px] text-emerald-800 block">
                            por {med.administradoPor}
                          </span>
                        )}
                      </div>

                      {canEdit && isActive && (
                        <button
                          onClick={() => handleOpenAdministerModal(med)}
                          className={`text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 shrink-0 ${
                            isGivenToday
                              ? "bg-emerald-700 hover:bg-emerald-800 text-white ring-2 ring-emerald-300"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          }`}
                          title="Registrar aplicación indicando la hora exacta"
                        >
                          <Syringe className="w-3.5 h-3.5" />
                          <span>{isGivenToday ? "✓ Aplicada (2ª Dosis)" : "Registrar Dosis"}</span>
                        </button>
                      )}
                    </div>

                    {/* History Link */}
                    <div className="pt-1.5 border-t border-emerald-200/60 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-900">
                        Historial de Dosis Dadas:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenHistoryModal(med)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Ver Histórico ({med.historialAdministracion?.length || (med.ultimaAdministracion ? 1 : 0)})</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions (Only Staff / Admin) */}
                {canEdit && (
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => handleToggleStatus(med.id)}
                      className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 transition"
                    >
                      {isActive ? (
                        <>
                          <Ban className="w-3.5 h-3.5 text-slate-500" />
                          <span>Suspender</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Reactivar</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditMed(med)}
                        className="text-slate-700 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        onClick={() => handleDeleteMedication(med.id)}
                        className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar medicamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* General Notes Footer */}
      {existingKardex?.notasGenerales && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-600" />
            Observaciones Generales del Kárdex
          </h4>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pl-5">
            {existingKardex.notasGenerales}
          </p>
        </div>
      )}

      {/* MODAL: ADD / EDIT MEDICATION (VENTANA FLOTANTE ERGONÓMICA Y SOBREPUESTA) */}
      {isMedModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 md:p-6 animate-fadeIn">
          <div className="my-auto bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[calc(100dvh-9.5rem)] overflow-hidden">
            {/* Header Fijo */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg leading-tight">
                    {editingMed ? "Editar Medicamento" : "Agregar Medicamento al Kárdex"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Receptor de Servicio: <strong className="text-slate-800">{patientName}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMedModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario con cuerpo scrolleable y pie fijo */}
            <form onSubmit={handleSaveMedicationSubmit} className="flex flex-col overflow-hidden flex-1">
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                {/* TIPO DE FRECUENCIA: HORARIO FIJO VS A DEMANDA */}
                <div className="bg-slate-100/80 p-1.5 rounded-2xl flex gap-1.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setMedForm({
                        ...medForm,
                        tipoFrecuencia: "HorarioFijo",
                        horario: medForm.horario?.toLowerCase().includes("demanda") ? "08:00 - 16:00 - 00:00" : (medForm.horario || "08:00 - 16:00 - 00:00"),
                        frecuencia: medForm.frecuencia?.toLowerCase().includes("demanda") ? "Cada 8 horas" : (medForm.frecuencia || "Cada 8 horas"),
                        tipoTratamiento: medForm.tipoTratamiento === "ADemanda" ? "FinDefinido" : (medForm.tipoTratamiento || "FinDefinido"),
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
                      medForm.tipoFrecuencia !== "ADemanda"
                        ? "bg-white text-emerald-900 shadow-sm border border-slate-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>⏰ Horario Fijo Programado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMedForm({
                        ...medForm,
                        tipoFrecuencia: "ADemanda",
                        horario: "A Demanda (PRN - Según Necesidad)",
                        frecuencia: "A Demanda / Según Criterio Clínico",
                        tipoTratamiento: "ADemanda",
                      });
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
                      medForm.tipoFrecuencia === "ADemanda"
                        ? "bg-purple-600 text-white shadow-sm border border-purple-700"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                    <span>⚡ A Demanda / PRN (Sin Horario Fijo)</span>
                  </button>
                </div>

                {/* NOMBRE DEL MEDICAMENTO */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Nombre del Medicamento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Acetilcisteína, Paracetamol, Losartán, Ketorolaco, etc."
                    value={medForm.nombreMedicamento || ""}
                    onChange={(e) => setMedForm({ ...medForm, nombreMedicamento: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* PRESENTACIÓN (TABLETA, CREMA, PIEZA, ML, MG, CÁPSULA, ETC.) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase text-slate-700">
                      Presentación del Medicamento *
                    </label>
                    <span className="text-[10px] font-bold text-slate-500">
                      Seleccione o escriba la presentación
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ej: Tableta, Crema / Gel, Pieza, ml, mg, Cápsula..."
                      value={medForm.presentacion || ""}
                      onChange={(e) => {
                        const pres = e.target.value;
                        setMedForm({
                          ...medForm,
                          presentacion: pres,
                          dosis: `${medForm.dosisPorToma || 1} ${pres.toLowerCase()}`,
                        });
                      }}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                    <select
                      value={PRESENTACIONES_MEDICAMENTOS.includes(medForm.presentacion || "") ? medForm.presentacion : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          const pres = e.target.value;
                          setMedForm({
                            ...medForm,
                            presentacion: pres,
                            dosis: `${medForm.dosisPorToma || 1} ${pres.toLowerCase()}`,
                          });
                        }
                      }}
                      className="bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Opciones rápidas...</option>
                      {PRESENTACIONES_MEDICAMENTOS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick presentation chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {["Tableta", "Cápsula", "Crema / Gel", "Pieza", "ml", "mg", "Gotas", "Ampolleta / Inyectable", "Frasco / Jarabe"].map((pres) => (
                      <button
                        key={pres}
                        type="button"
                        onClick={() =>
                          setMedForm({
                            ...medForm,
                            presentacion: pres,
                            dosis: `${medForm.dosisPorToma || 1} ${pres.toLowerCase()}`,
                          })
                        }
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition ${
                          medForm.presentacion?.toLowerCase() === pres.toLowerCase()
                            ? "bg-emerald-600 text-white border-emerald-700"
                            : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                        }`}
                      >
                        {pres}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DOSIS Y VÍA DE ADMINISTRACIÓN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Dosis por Toma / Aplicación *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        required
                        value={medForm.dosisPorToma ?? 1}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setMedForm({
                            ...medForm,
                            dosisPorToma: val,
                            dosis: `${val} ${(medForm.presentacion || 'unidad').toLowerCase()}`,
                          });
                        }}
                        className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[0.5, 1, 2, 3, 4].map((qty) => (
                          <button
                            key={qty}
                            type="button"
                            onClick={() =>
                              setMedForm({
                                ...medForm,
                                dosisPorToma: qty,
                                dosis: `${qty} ${(medForm.presentacion || 'unidad').toLowerCase()}`,
                              })
                            }
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                              medForm.dosisPorToma === qty
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                            }`}
                          >
                            {qty}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Vía de Administración *
                    </label>
                    <select
                      value={medForm.via || "Oral"}
                      onChange={(e) => setMedForm({ ...medForm, via: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="Oral">Oral</option>
                      <option value="Intravenosa (IV)">Intravenosa (IV)</option>
                      <option value="Subcutánea (SC)">Subcutánea (SC)</option>
                      <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                      <option value="Tópica">Tópica</option>
                      <option value="Oftálmica">Oftálmica</option>
                      <option value="Inhalatoria">Inhalatoria</option>
                      <option value="Nasal">Nasal</option>
                      <option value="Rectal">Rectal</option>
                      <option value="Sublingual">Sublingual</option>
                      <option value="Ótica">Ótica</option>
                    </select>
                  </div>
                </div>

                {/* SECCIÓN CONDICIONAL: A DEMANDA (PRN) */}
                {medForm.tipoFrecuencia === "ADemanda" ? (
                  <div className="bg-purple-50/90 border border-purple-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-purple-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-700" />
                        Especificaciones de Uso A Demanda (PRN)
                      </span>
                      <span className="text-[10px] font-black bg-purple-200/80 text-purple-900 px-2.5 py-0.5 rounded-full">
                        Sin Horario Fijo
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-purple-950 mb-1">
                        Criterio Clínico o Indicación para la Toma *
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Ej: Tomar 1 tableta únicamente en caso de dolor moderado/intenso (EVA > 4) o temperatura > 38.0°C. Dejar mínimo 6 a 8 horas entre tomas. No exceder 3 tomas al día."
                        value={medForm.indicacionesUsoADemanda || ""}
                        onChange={(e) => setMedForm({ ...medForm, indicacionesUsoADemanda: e.target.value })}
                        className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-xs text-purple-950 font-medium focus:ring-2 focus:ring-purple-500 placeholder-purple-400"
                      />
                    </div>

                    <p className="text-[11px] text-purple-800 leading-relaxed bg-white/80 p-2.5 rounded-xl border border-purple-200">
                      💡 <strong>Uso A Demanda:</strong> Este medicamento no se programará en horarios fijos del cronograma diario. El personal de enfermería registrará cada toma conforme sea solicitada o requerida por el receptor de servicio.
                    </p>
                  </div>
                ) : (
                  /* SECCIÓN CONDICIONAL: HORARIO FIJO Y PROGRAMACIÓN */
                  <>
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-emerald-950 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-emerald-700" />
                          Frecuencia de Toma y Horarios
                        </span>
                        <span className="text-[11px] text-emerald-800 font-black bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {medForm.vecesAlDia || calculateDosesPerDay(medForm.horario || medForm.frecuencia)} {Number(medForm.vecesAlDia) === 1 ? 'toma al día' : 'tomas al día'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Frecuencia Numérica con Switch de Horas o Minutos */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                            Frecuencia de Toma (Número) *
                          </label>
                          <div className="flex items-stretch gap-1.5">
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder={intervalUnit === "horas" ? "Ej: 8" : "Ej: 30"}
                              value={intervalValue || ""}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setIntervalValue(val);
                                if (val > 0) {
                                  computeSchedule(val, intervalUnit, firstDoseTime);
                                }
                              }}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                            />
                            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setIntervalUnit("horas");
                                  if (intervalValue > 0) {
                                    computeSchedule(intervalValue, "horas", firstDoseTime);
                                  }
                                }}
                                className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${
                                  intervalUnit === "horas"
                                    ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Horas
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIntervalUnit("minutos");
                                  if (intervalValue > 0) {
                                    computeSchedule(intervalValue, "minutos", firstDoseTime);
                                  }
                                }}
                                className={`px-2.5 py-1 text-[11px] font-black rounded-lg transition ${
                                  intervalUnit === "minutos"
                                    ? "bg-white text-emerald-800 shadow-2xs border border-slate-200"
                                    : "text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                Minutos
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {intervalUnit === "horas"
                              ? "Ej: 8 (c/8 horas = 3 tomas/día), 12 (c/12 horas = 2 tomas), 6 (c/6 horas = 4 tomas), 24 (1 toma/día)."
                              : "Ej: 30 (c/30 min = 48 tomas/día), 45 (c/45 min), 90 (c/90 min)."}
                          </p>
                        </div>

                        {/* Hora de Primera Toma */}
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                            Hora de Primera Toma *
                          </label>
                          <input
                            type="time"
                            value={firstDoseTime}
                            onChange={(e) => {
                              const newTime = e.target.value;
                              setFirstDoseTime(newTime);
                              if (intervalValue > 0) {
                                computeSchedule(intervalValue, intervalUnit, newTime);
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Los horarios sucesivos se calculan de manera automática.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                            Horarios Programados (Generados) *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: 08:00 - 16:00 - 00:00"
                            value={medForm.horario || ""}
                            onChange={(e) => {
                              const h = e.target.value;
                              const derived = calculateDosesPerDay(h);
                              setMedForm({ ...medForm, horario: h, vecesAlDia: derived });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                            Descripción de Frecuencia
                          </label>
                          <input
                            type="text"
                            placeholder={intervalUnit === "horas" ? "Ej: Cada 8 horas" : "Ej: Cada 30 minutos"}
                            value={medForm.frecuencia || ""}
                            onChange={(e) => setMedForm({ ...medForm, frecuencia: e.target.value })}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Resumen en Vivo del Consumo Diario según Horarios */}
                      <div className="bg-white/90 rounded-xl p-2.5 border border-emerald-300/80 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold text-slate-600">Cálculo de Consumo Diario:</span>
                          <span className="font-mono font-black text-emerald-950">
                            {(Number(medForm.dosisPorToma) || 1) * (Number(medForm.vecesAlDia) || calculateDosesPerDay(medForm.horario || medForm.frecuencia))} unidades/día
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-800">
                          ({Number(medForm.dosisPorToma) || 1} {medForm.presentacion || 'dosis'} por toma × {Number(medForm.vecesAlDia) || calculateDosesPerDay(medForm.horario || medForm.frecuencia)} tomas al día)
                        </p>
                      </div>
                    </div>

                    {/* Tipo y Duración del Tratamiento */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-amber-950 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-700" />
                          Tipo y Duración del Tratamiento
                        </span>
                        <span className="text-[11px] text-amber-800 font-medium">
                          Programación médica
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                            Modalidad del Tratamiento *
                          </label>
                          <select
                            value={medForm.tipoTratamiento || (medForm.fechaFinTratamiento ? "FinDefinido" : "Indefinido")}
                            onChange={(e) => {
                              const val = e.target.value as "Indefinido" | "FinDefinido";
                              setMedForm({
                                ...medForm,
                                tipoTratamiento: val,
                                duracionDias: val === "Indefinido" ? undefined : (medForm.duracionDias || 7),
                                fechaFinTratamiento: val === "Indefinido" ? undefined : medForm.fechaFinTratamiento,
                              });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 shadow-2xs"
                          >
                            <option value="Indefinido">Tratamiento Continuo / Crónico</option>
                            <option value="FinDefinido">Con Fin Definido (Días programados)</option>
                          </select>
                        </div>

                        {medForm.tipoTratamiento === "FinDefinido" ? (
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                              Duración del Tratamiento (Días) *
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                required
                                placeholder="Ej: 7"
                                value={medForm.duracionDias || ""}
                                onChange={(e) => {
                                  const days = Number(e.target.value) || 1;
                                  const startDate = medForm.fechaInicioTratamiento || new Date().toISOString().slice(0, 10);
                                  const d = new Date(startDate);
                                  d.setDate(d.getDate() + days - 1);
                                  setMedForm({
                                    ...medForm,
                                    duracionDias: days,
                                    fechaInicioTratamiento: startDate,
                                    fechaFinTratamiento: d.toISOString().slice(0, 10),
                                  });
                                }}
                                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-black text-amber-950 focus:ring-2 focus:ring-amber-500 shadow-2xs pr-14"
                              />
                              <span className="absolute right-3 top-2 text-[11px] font-bold text-amber-700 pointer-events-none">
                                días
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                              Detalles / Indicación
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: Continuo según indicación médica"
                              value={medForm.dosis || ""}
                              onChange={(e) => setMedForm({ ...medForm, dosis: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 shadow-2xs"
                            />
                          </div>
                        )}
                      </div>

                      {medForm.tipoTratamiento === "FinDefinido" && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                              Fecha Inicio
                            </label>
                            <input
                              type="date"
                              value={medForm.fechaInicioTratamiento || ""}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                const days = medForm.duracionDias || 7;
                                let newEnd = medForm.fechaFinTratamiento;
                                if (newStart && days) {
                                  const d = new Date(newStart);
                                  d.setDate(d.getDate() + days - 1);
                                  newEnd = d.toISOString().slice(0, 10);
                                }
                                setMedForm({ ...medForm, fechaInicioTratamiento: newStart, fechaFinTratamiento: newEnd });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 shadow-2xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                              Fecha Fin Programada
                            </label>
                            <input
                              type="date"
                              value={medForm.fechaFinTratamiento || ""}
                              onChange={(e) => {
                                const newEnd = e.target.value;
                                const startDate = medForm.fechaInicioTratamiento || new Date().toISOString().slice(0, 10);
                                let computedDays = medForm.duracionDias;
                                if (startDate && newEnd) {
                                  const dStart = new Date(startDate).getTime();
                                  const dEnd = new Date(newEnd).getTime();
                                  computedDays = Math.max(1, Math.ceil((dEnd - dStart) / (1000 * 60 * 60 * 24))) + 1;
                                }
                                setMedForm({ ...medForm, fechaFinTratamiento: newEnd, duracionDias: computedDays, fechaInicioTratamiento: startDate });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 shadow-2xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Indicaciones Especiales / Recomendaciones
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Tomar con alimentos. Medir presión arterial previo a la administración."
                    value={medForm.indicaciones || ""}
                    onChange={(e) => setMedForm({ ...medForm, indicaciones: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Estado del Medicamento
                  </label>
                  <select
                    value={medForm.estado || "Activo"}
                    onChange={(e) => setMedForm({ ...medForm, estado: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Suspendido">Suspendido</option>
                    <option value="Completado">Completado</option>
                  </select>
                </div>
              </div>

              {/* Pie de Formulario Fijo */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/90 shrink-0 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMedModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition"
                >
                  {editingMed ? "Guardar Cambios" : "Agregar Medicamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ALERGIAS & NOTAS GENERALES */}
      {isAlergiasModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-4 animate-fadeIn">
          <div className="my-auto bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Editar Alergias y Notas del Receptor de Servicio
              </h3>
              <button
                onClick={() => setIsAlergiasModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAlergiasSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Alergias Conocidas
                </label>
                <input
                  type="text"
                  placeholder="Ej: Penicilina, AINEs, Mariscos (o 'Sin alergias declaradas')"
                  value={alergiasText}
                  onChange={(e) => setAlergiasText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Observaciones Generales del Kárdex
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Receptor de servicio requiere triturado de tabletas. No administrar medicamentos con jugo de toronja."
                  value={notasText}
                  onChange={(e) => setNotasText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAlergiasModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR ADMINISTRACIÓN / APLICACIÓN O SIN APLICACIÓN DE MEDICAMENTO */}
      {isAdministerModalOpen && administeringMed && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[calc(100dvh-9.5rem)] flex flex-col my-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                  adminForm.modo === "sin_aplicacion"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {adminForm.modo === "sin_aplicacion" ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <Syringe className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {adminForm.modo === "sin_aplicacion" ? "Registrar Medicamento Sin Aplicación" : "Registrar Aplicación de Medicamento"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">{administeringMed.nombreMedicamento}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdministerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shift Handover Official Legend */}
            <div className="bg-amber-500/15 border-l-4 border-amber-500 p-3 rounded-r-xl my-2 shrink-0">
              <p className="text-xs font-black text-amber-950 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>“Verifica si se ministraron los medicamentos fuera de turno. Registra quién los administró.”</span>
              </p>
              <p className="text-[11px] text-amber-900 mt-1 leading-tight">
                Garantiza el control clínico estricto y la conciliación exacta del inventario.
              </p>
            </div>

            {/* Action Mode Toggle (Aplicado vs Sin Aplicación) */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setAdminForm({ ...adminForm, modo: "aplicado" })}
                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  adminForm.modo === "aplicado"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Medicamento Aplicado</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminForm({ ...adminForm, modo: "sin_aplicacion" })}
                className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  adminForm.modo === "sin_aplicacion"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Sin Aplicación (No ministrado)</span>
              </button>
            </div>

            <form onSubmit={handleSaveAdministerSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
              {/* Info Box */}
              {(() => {
                const modalDateParts = (adminForm.fechaHora || "").split("T");
                const [mY, mM, mD] = (modalDateParts[0] || "").split("-");
                const modalFormattedDate = (mD && mM && mY) ? `${mD}/${mM}/${mY}` : "";
                const targetSlotDisplay = administeringSlotTime || extractTimeSlots(administeringMed.horario)[0] || administeringMed.horario;

                return (
                  <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Dosis Prescrita:</span>
                      <span className="font-bold text-slate-900">{administeringMed.dosis}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Toma programada (Fecha y Hora):</span>
                      <span className="font-mono font-bold text-emerald-950 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>{modalFormattedDate} • {targetSlotDisplay} hrs</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Vía de administración:</span>
                      <span className="font-bold text-slate-900">{administeringMed.via}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Conditional Fields based on Mode */}
              {adminForm.modo === "aplicado" ? (
                <>
                  {/* Who Administered Category Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      ¿Quién ministró / administró la dosis? *
                    </label>
                    <select
                      value={adminForm.administradoPorTipo}
                      onChange={(e) => {
                        const val = e.target.value as "enfermeria" | "familiar" | "medico" | "otro";
                        const isOutside = val === "familiar" || val === "otro";
                        let defaultName = adminForm.administradoPor;
                        if (val === "familiar" && adminForm.administradoPor === currentUserName) {
                          defaultName = "Familiar / Cuidador Primario";
                        } else if (val === "enfermeria" && adminForm.administradoPor === "Familiar / Cuidador Primario") {
                          defaultName = currentUserName;
                        }
                        setAdminForm({
                          ...adminForm,
                          administradoPorTipo: val,
                          fueraDeMiGuardia: isOutside || adminForm.fueraDeMiGuardia,
                          administradoPor: defaultName,
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="enfermeria">Personal de Enfermería (Turno activo o relevo)</option>
                      <option value="familiar">Familiar / Cuidador (Sin cobertura de enfermería)</option>
                      <option value="medico">Médico Tratante / Especialista</option>
                      <option value="otro">Otro personal / Cuidador externo</option>
                    </select>
                  </div>

                  {/* Fuera de Guardia Option */}
                  <div className={`p-3.5 rounded-2xl border transition-all ${
                    adminForm.fueraDeMiGuardia
                      ? "bg-amber-50 border-amber-400 shadow-xs"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  }`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="fueraDeMiGuardia"
                        checked={adminForm.fueraDeMiGuardia}
                        onChange={(e) => setAdminForm({ ...adminForm, fueraDeMiGuardia: e.target.checked })}
                        className="mt-0.5 w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <span className={`text-xs font-black block ${
                          adminForm.fueraDeMiGuardia ? "text-amber-950" : "text-slate-800"
                        }`}>
                          ⚠️ Administrado fuera de mi guardia (Turno anterior / Familiar / Periodo sin cobertura)
                        </span>
                        <span className="text-[11px] text-slate-600 block mt-0.5 leading-snug">
                          Registra la dosis en el Kárdex y descuenta el inventario, dejando constancia explícita de quién ministró el fármaco fuera de tu turno.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Nurse / Personal Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Nombre de la Persona que Administró *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminForm.administradoPor}
                      onChange={(e) => setAdminForm({ ...adminForm, administradoPor: e.target.value })}
                      placeholder={adminForm.administradoPorTipo === "familiar" ? "Nombre del familiar o cuidador" : "Nombre de la enfermera/socio"}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Dose applied */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Dosis Aplicada *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminForm.dosisAplicada}
                      onChange={(e) => setAdminForm({ ...adminForm, dosisAplicada: e.target.value })}
                      placeholder="Ej: 1 tableta (500mg)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Timestamp Picker with Quick Shortcuts */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase text-slate-700">
                        Fecha y Hora Real de Aplicación *
                      </label>
                      <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Por defecto: fecha y hora programada
                      </span>
                    </div>
                    <input
                      type="datetime-local"
                      required
                      value={adminForm.fechaHora}
                      onChange={(e) => setAdminForm({ ...adminForm, fechaHora: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    />

                    {/* Quick Time Adjustment Buttons */}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Atajos:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const targetSlot = administeringSlotTime || extractTimeSlots(administeringMed.horario)[0] || "08:00";
                          const slotMatch = targetSlot.match(/(\d{1,2}):(\d{2})/);
                          const defaultHour = slotMatch ? String(parseInt(slotMatch[1], 10)).padStart(2, '0') : "08";
                          const defaultMin = slotMatch ? String(parseInt(slotMatch[2], 10)).padStart(2, '0') : "00";
                          const baseDatePart = adminForm.fechaHora ? adminForm.fechaHora.split("T")[0] : new Date().toISOString().slice(0, 10);
                          setAdminForm({ ...adminForm, fechaHora: `${baseDatePart}T${defaultHour}:${defaultMin}` });
                        }}
                        className="text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-lg transition flex items-center gap-1"
                        title="Restablecer a la hora programada de la toma"
                      >
                        <Clock className="w-3 h-3" />
                        <span>Hora Programada</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date();
                          const year = now.getFullYear();
                          const month = String(now.getMonth() + 1).padStart(2, '0');
                          const day = String(now.getDate()).padStart(2, '0');
                          const hours = String(now.getHours()).padStart(2, '0');
                          const mins = String(now.getMinutes()).padStart(2, '0');
                          setAdminForm({ ...adminForm, fechaHora: `${year}-${month}-${day}T${hours}:${mins}` });
                        }}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition"
                      >
                        Ahora
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(15)}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition"
                      >
                        -15 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(30)}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition"
                      >
                        -30 min
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(60)}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition"
                      >
                        -1 Hora
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustTime(120)}
                        className="text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-1 rounded-lg border border-slate-200 transition"
                      >
                        -2 Horas
                      </button>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Observaciones / Tolerancia del Receptor de Servicio
                    </label>
                    <textarea
                      rows={2}
                      value={adminForm.notas}
                      onChange={(e) => setAdminForm({ ...adminForm, notas: e.target.value })}
                      placeholder="Ej: Administrado sin complicaciones. Receptor de servicio aceptó oralmente con agua."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Se registrará la dosis en el Kárdex y se descontará la cantidad correspondiente del inventario de medicamentos.</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Sin Aplicación Form */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-900 mb-1">
                      Motivo de la No Aplicación *
                    </label>
                    <select
                      value={adminForm.motivoSinAplicacion}
                      onChange={(e) => setAdminForm({ ...adminForm, motivoSinAplicacion: e.target.value })}
                      className="w-full bg-amber-50/60 border border-amber-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="No ministrado por familiar durante periodo sin cobertura">
                        No ministrado por familiar durante periodo sin cobertura
                      </option>
                      <option value="Rechazo del receptor de servicio / No aceptó la toma">
                        Rechazo del receptor de servicio / No aceptó la toma
                      </option>
                      <option value="Ayuno médico / Procedimiento clínico programado">
                        Ayuno médico / Procedimiento clínico programado
                      </option>
                      <option value="Receptor de servicio dormido / En reposo no interrumpible">
                        Receptor de servicio dormido / En reposo no interrumpible
                      </option>
                      <option value="Falta de insumo / Medicamento no disponible en domicilio">
                        Falta de insumo / Medicamento no disponible en domicilio
                      </option>
                      <option value="Suspensión o ajuste temporal por indicación médica">
                        Suspensión o ajuste temporal por indicación médica
                      </option>
                      <option value="Efecto adverso previo / Reacción adversa observada">
                        Efecto adverso previo / Reacción adversa observada
                      </option>
                      <option value="Otro motivo clínico (detallar en observaciones)">
                        Otro motivo clínico (detallar en observaciones)
                      </option>
                    </select>
                  </div>

                  {/* Guard Personal Verifier */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Personal de Guardia que Asienta la Verificación *
                    </label>
                    <input
                      type="text"
                      required
                      value={currentUserName}
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-700 font-bold"
                    />
                  </div>

                  {/* Verification timestamp */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Fecha y Hora de Verificación *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={adminForm.fechaHora}
                      onChange={(e) => setAdminForm({ ...adminForm, fechaHora: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono font-bold focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Explanatory notes */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                      Justificación / Observaciones Clínicas
                    </label>
                    <textarea
                      rows={2}
                      value={adminForm.notas}
                      onChange={(e) => setAdminForm({ ...adminForm, notas: e.target.value })}
                      placeholder="Describa el motivo por el cual no se administró el medicamento o las acciones preventivas realizadas..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-950 font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-amber-700 shrink-0" />
                    <span><strong>Importante:</strong> Al marcar como "Sin Aplicación", <strong>NO se descontará inventario</strong> y quedará formalmente justificada la omisión en el Kárdex clínico.</span>
                  </div>
                </>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAdministerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5 ${
                    adminForm.modo === "sin_aplicacion"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {adminForm.modo === "sin_aplicacion" ? (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Guardar como "Sin Aplicación"</span>
                    </>
                  ) : (
                    <>
                      <Syringe className="w-4 h-4" />
                      <span>Guardar Registro de Aplicación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIAL COMPLETO DE ADMINISTRACIÓN DE UN MEDICAMENTO */}
      {isHistoryModalOpen && historyMed && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-3.5 border border-slate-200 animate-fadeIn max-h-[calc(100dvh-9.5rem)] flex flex-col my-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Historial de Aplicaciones
                  </h3>
                </div>
                <p className="text-xs text-slate-600 font-bold mt-0.5">
                  {historyMed.nombreMedicamento} ({historyMed.dosis})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 py-1">
              {(!historyMed.historialAdministracion || historyMed.historialAdministracion.length === 0) ? (
                historyMed.ultimaAdministracion ? (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-slate-900">
                        {historyMed.ultimaAdministracion}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                        Último Registro
                      </span>
                    </div>
                    <div className="text-slate-600">
                      Administrado por: <strong>{historyMed.administradoPor || "Personal de Enfermería"}</strong>
                    </div>
                    <div className="text-slate-600">
                      Dosis: <strong>{historyMed.dosis}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    No existen registros previos de administración para este medicamento.
                  </div>
                )
              ) : (
                historyMed.historialAdministracion.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className={`p-3.5 rounded-2xl border text-xs space-y-1 transition ${
                      log.fueraDeMiGuardia
                        ? "bg-amber-50/70 border-amber-200 hover:border-amber-300"
                        : "bg-slate-50 border-slate-200 hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        {log.fechaHora}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.fueraDeMiGuardia && (
                          <span className="bg-amber-100 border border-amber-300 text-amber-900 font-black px-2 py-0.5 rounded text-[10px]">
                            Fuera de Guardia
                          </span>
                        )}
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          Dosis: {log.dosisAplicada || historyMed.dosis}
                        </span>

                        {isAdmin && (
                          <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200">
                            <button
                              onClick={() => handleEditHistoryLog(log)}
                              className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Editar registro de dosis (Solo Admin)"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteHistoryLog(log.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Eliminar registro de dosis (Solo Admin)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-slate-700">
                      Administrado por: <strong className="text-slate-900">{log.administradoPor}</strong>
                    </div>
                    {log.notas && (
                      <p className="text-slate-600 bg-white p-2 rounded-xl border border-slate-100 mt-1 italic text-[11px]">
                        "{log.notas}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE DOSE OVERDOSE WARNING MODAL */}
      {isDoubleDoseWarningOpen && doubleDoseWarningMed && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 animate-fadeIn">
          <div className="my-auto bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border-2 border-rose-500 space-y-3.5 max-h-[calc(100dvh-9.5rem)] overflow-y-auto">
            <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl shrink-0 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-black text-rose-900 text-lg uppercase tracking-tight leading-snug">
                  ⚠️ DOSIS YA REGISTRADA HOY
                </h3>
                <p className="text-xs text-rose-700 font-bold">
                  Medicamento: <strong className="text-slate-900">{doubleDoseWarningMed.nombreMedicamento}</strong> ({doubleDoseWarningMed.dosis})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-rose-950 space-y-3 font-semibold text-xs leading-relaxed">
              <p className="font-black text-sm text-rose-800 uppercase tracking-wide">
                DOSIS YA REGISTRADA, ¿SEGURO QUE QUIERE MARCAR UNA 2ª DOSIS?
              </p>
              <p className="text-rose-900 text-xs font-bold leading-relaxed">
                SI DISTE UNA 2ª SEGUNDA DOSIS COMUNÍCATE CON EL RESPONSABLE SANITARIO DE CUIDARTE PACHUCA AL <strong className="text-rose-950 underline font-black">7714540072 EXT 911</strong> O POR WHATSAPP AL <strong className="text-rose-950 underline font-black">7714540072</strong> Y COMUNICA UNA SOBREDOSIS DEL MEDICAMENTO PARA RECIBIR INDICACIONES.
              </p>
              {getTodayAdminDetails(doubleDoseWarningMed) && (
                <div className="bg-white border border-rose-300 p-2.5 rounded-xl text-[11px] text-slate-800 font-mono">
                  <strong>Registro previo de hoy:</strong> {getTodayAdminDetails(doubleDoseWarningMed)}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <a
                href="https://wa.me/527714540072?text=REPORTE%20DE%20SOBREDOSIS%20-%20KARDEX%20CUIDARTE"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>WhatsApp Responsable Sanitario</span>
              </a>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDoubleDoseWarningOpen(false);
                    setDoubleDoseWarningMed(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetMed = doubleDoseWarningMed;
                    const targetSlot = administeringSlotTime;
                    setIsDoubleDoseWarningOpen(false);
                    setDoubleDoseWarningMed(null);
                    if (targetMed) {
                      proceedOpenAdministerModal(targetMed, targetSlot);
                    }
                  }}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition"
                >
                  Sí, Registrar 2ª Dosis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFSCREEN KÁRDEX DOCUMENT FOR DOM PDF EXTRACTION */}
      <div
        id="kardex-offscreen-render-wrapper"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0px",
          width: "850px",
          zIndex: -9999,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <KardexDocument
          kardexRecord={existingKardex}
          client={currentClient}
          caratula={currentCaratula}
        />
      </div>

      {/* OFFICIAL KÁRDEX DOCUMENT PREVIEW & EXPORT MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 print:p-0 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[calc(100dvh-9.5rem)] print:max-h-none print:border-none print:bg-white print:rounded-none print:shadow-none">
            {/* Modal Top Header (Hidden on Print) */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600/30 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Vista Previa del Kárdex Oficial
                  </h3>
                  <p className="text-xs text-slate-400">
                    {patientName} • ID: {effectiveClientId}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadKardexPDF}
                  disabled={isDownloadingPDF}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Descargar archivo PDF"
                >
                  <Download className={`w-4 h-4 ${isDownloadingPDF ? "animate-bounce" : ""}`} />
                  <span>{isDownloadingPDF ? "Generando..." : "Descargar PDF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
                  title="Abrir diálogo de impresión"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body with KardexDocument */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/60 print:p-0 print:bg-white print:overflow-visible">
              <div className="max-w-[850px] mx-auto bg-white rounded-2xl shadow-xl overflow-hidden print:shadow-none print:rounded-none">
                <KardexDocument
                  kardexRecord={existingKardex}
                  client={currentClient}
                  caratula={currentCaratula}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
