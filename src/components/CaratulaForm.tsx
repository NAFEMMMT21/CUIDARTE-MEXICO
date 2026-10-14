import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Caratula,
  Client,
  ServiceItem,
  CaratulaServiceLine,
  StaffMember,
  CalendarEvent,
  AbonoTicket,
  ScheduledShiftItem,
  ShiftPresetType,
  Sucursal,
  UserSession,
} from "../types";
import {
  getCurrentTimestamp,
  formatFolio,
  parseFolioNumber,
  formatCurrency,
  generateVerificationToken,
  getNextClientId,
  getNextCaratulaFolioNomenclature,
  resolveSucursalAbbreviation,
} from "../utils/formatters";
import {
  formatGuardiaFolio,
  getMaxGuardiaIndex,
  isValidGuardiaFolio,
  breakdownGuardiaFolio,
  STARTING_GUARDIA_SERIAL_INDEX,
} from "../utils/guardiaFolio";
import { deduplicateClients } from "../utils/dataIntegrity";
import { loadSucursales } from "../utils/storage";
import { CaratulaDocument } from "./CaratulaDocument";
import { CaratulaVerificationPortal } from "./CaratulaVerificationPortal";
import {
  downloadCaratulaPDF,
  downloadCaratulaImage,
  printCaratulaDocument,
} from "../utils/pdfExport";
import {
  Save,
  Download,
  Image as ImageIcon,
  Printer,
  UserCheck,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Info,
  User,
  CheckCircle2,
  CalendarDays,
  Hash,
  Copy,
  Zap,
  Building2,
  RotateCcw,
} from "lucide-react";

interface CaratulaFormProps {
  caratulas: Caratula[];
  clients: Client[];
  services: ServiceItem[];
  abonos?: AbonoTicket[];
  staffMembers?: StaffMember[];
  calendarEvents?: CalendarEvent[];
  sucursales?: Sucursal[];
  userSession?: UserSession | null;
  selectedSucursalId?: string;
  onSaveCaratula: (caratula: Caratula) => void;
  onSaveCalendarEventsBatch?: (events: CalendarEvent[]) => Promise<void> | void;
  onSaveCalendarEvent?: (event: CalendarEvent) => void;
  initialCaratulaToEdit?: Caratula | null;
  onFinishedEditing?: () => void;
  currentUserName?: string;
}

const addDaysToDateString = (dateStr: string, days: number): string => {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const computeShiftTimes = (
  dateStr: string,
  startTime: string,
  durationHours: number
) => {
  const [hStr, mStr] = (startTime || "08:00").split(":");
  const startH = parseInt(hStr, 10) || 0;
  const startM = parseInt(mStr, 10) || 0;
  const totalMinutes = startH * 60 + startM + Math.round(durationHours * 60);
  const endMinutes = totalMinutes % (24 * 60);
  const daysAdded = Math.floor(totalMinutes / (24 * 60));

  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const horaFin = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  const fechaFinCalculada = daysAdded > 0 ? addDaysToDateString(dateStr, daysAdded) : dateStr;

  return {
    horaInicio: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    horaFin,
    fechaFinCalculada,
  };
};

const getShiftPresetDetails = (preset: ShiftPresetType, fecha: string, customStartTime?: string) => {
  switch (preset) {
    case "12h_dia": {
      const times = computeShiftTimes(fecha, customStartTime || "08:00", 12);
      return {
        ...times,
        label: `☀️ 12h Diurna (${times.horaInicio} - ${times.horaFin})`,
        tag: "Diurno 12h",
      };
    }
    case "12h_noche": {
      const times = computeShiftTimes(fecha, customStartTime || "20:00", 12);
      return {
        ...times,
        label: `🌙 12h Nocturna (${times.horaInicio} - ${times.horaFin})`,
        tag: "Nocturno 12h",
      };
    }
    case "24h": {
      const times = computeShiftTimes(fecha, customStartTime || "08:00", 24);
      return {
        ...times,
        label: `⏱️ 24h Continuas (${times.horaInicio} - ${times.horaFin})`,
        tag: "24h Continua",
      };
    }
    case "8h_mat": {
      const times = computeShiftTimes(fecha, customStartTime || "07:00", 8);
      return {
        ...times,
        label: `🌅 8h Matutino (${times.horaInicio} - ${times.horaFin})`,
        tag: "Matutino 8h",
      };
    }
    case "8h_vesp": {
      const times = computeShiftTimes(fecha, customStartTime || "14:00", 8);
      return {
        ...times,
        label: `🌆 8h Vespertino (${times.horaInicio} - ${times.horaFin})`,
        tag: "Vespertino 8h",
      };
    }
    case "8h_noc": {
      const times = computeShiftTimes(fecha, customStartTime || "22:00", 8);
      return {
        ...times,
        label: `🌃 8h Nocturno (${times.horaInicio} - ${times.horaFin})`,
        tag: "Nocturno 8h",
      };
    }
    case "custom":
    default: {
      const times = computeShiftTimes(fecha, customStartTime || "08:00", 12);
      return {
        ...times,
        label: `⚙️ Personalizado (${times.horaInicio} - ${times.horaFin})`,
        tag: "Personalizado",
      };
    }
  }
};

export const CaratulaForm: React.FC<CaratulaFormProps> = ({
  caratulas,
  clients,
  services,
  staffMembers = [],
  calendarEvents = [],
  sucursales = [],
  userSession,
  selectedSucursalId,
  onSaveCaratula,
  onSaveCalendarEventsBatch,
  onSaveCalendarEvent,
  initialCaratulaToEdit,
  onFinishedEditing,
  currentUserName = "Administración",
}) => {
  const documentRef = useRef<HTMLDivElement>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Active staff filter
  const activeStaff = staffMembers.filter((s) => s.estatus !== "Baja");
  const uniqueClients = useMemo(() => deduplicateClients(clients), [clients]);

  // Guaranteed fallback for sucursales list
  const effectiveSucursales = useMemo(() => {
    if (sucursales && sucursales.length > 0) return sucursales;
    const loaded = loadSucursales();
    return loaded && loaded.length > 0 ? loaded : [];
  }, [sucursales]);

  // Determine next folio with official nomenclature: CXXXX0000A00
  const getNextFolio = (
    tipo: "Caratula" | "Cotización" = "Caratula",
    branchIdOverride?: string
  ): string => {
    const targetBranchId =
      branchIdOverride ||
      formData?.sucursalId ||
      (selectedSucursalId && selectedSucursalId !== "all" ? selectedSucursalId : undefined) ||
      userSession?.sucursalId ||
      effectiveSucursales[0]?.id ||
      "pachuca";
    const targetBranchObj = effectiveSucursales.find((s) => s.id === targetBranchId) || effectiveSucursales[0];
    const targetBranchName =
      targetBranchObj?.nombre || userSession?.sucursalNombre || "Cuidarte México";

    return getNextCaratulaFolioNomenclature({
      sucursal: targetBranchObj,
      sucursalNombre: targetBranchName,
      caratulas,
      tipoDocumento: tipo,
    });
  };

  const createEmptyCaratula = (tipo: "Caratula" | "Cotización" = "Caratula"): Caratula => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const defaultBranchId =
      (selectedSucursalId && selectedSucursalId !== "all" ? selectedSucursalId : undefined) ||
      userSession?.sucursalId ||
      effectiveSucursales[0]?.id ||
      "pachuca";
    const defaultBranchObj = effectiveSucursales.find((s) => s.id === defaultBranchId) || effectiveSucursales[0];
    const defaultBranchName =
      defaultBranchObj?.nombre || userSession?.sucursalNombre || "Cuidarte México";

    return {
      folio: getNextCaratulaFolioNomenclature({
        sucursal: defaultBranchObj,
        sucursalNombre: defaultBranchName,
        caratulas,
        tipoDocumento: tipo,
      }),
      id: getNextClientId(uniqueClients),
      timestamp: getCurrentTimestamp(),
      tipoDocumento: tipo,
      validezCotizacion: in7Days,
      nombreCompletoCliente: "",
      numeroContacto: "",
      numeroContacto2: "",
      numeroContacto3: "",
      correo: "",
      direccionServicio: "",
      nombreCompletoRS: "",
      edad: "",
      diagnostico: "",
      especificaciones: "",
      detallesCotizacionText: "",
      detallesServicio: "",
      servicios: [
        { servicio: "", cantidad: 1, precioU: 0, precioTot: 0, costoU: 0 },
      ],
      subtotal: 0,
      descuento: 0,
      total: 0,
      pagado: 0,
      pendiente: 0,
      inicio: `${todayStr} 08:00`,
      fin: `${todayStr} 20:00`,
      contratoLink: "www.cuidartemexico.com/contrato",
      tycLink: "www.cuidartemexico.com/terminos-y-condiciones",
      verificationToken: generateVerificationToken(),
      estado: tipo === "Cotización" ? "Cotización" : "Activo",
      sucursalId: defaultBranchId,
      sucursalNombre: defaultBranchName,
      creadoPor: currentUserName || userSession?.username || "Administración",
    };
  };

  const [formData, setFormData] = useState<Caratula>(() => {
    return initialCaratulaToEdit ? { ...initialCaratulaToEdit } : createEmptyCaratula();
  });

  // --- VIGENCIA DE USO DE GUARDIAS STATE ---
  const [vigenciaEnabled, setVigenciaEnabled] = useState<boolean>(() => {
    if (initialCaratulaToEdit) {
      return initialCaratulaToEdit.modalidadVigencia !== undefined
        ? initialCaratulaToEdit.modalidadVigencia
        : true;
    }
    return true; // Default enabled for flexible usage
  });

  const [diasVigencia, setDiasVigencia] = useState<number>(() => {
    return initialCaratulaToEdit?.diasVigencia || 30;
  });

  const [fechaVigenciaInicio, setFechaVigenciaInicio] = useState<string>(() => {
    return initialCaratulaToEdit?.fechaVigenciaInicio || new Date().toISOString().slice(0, 10);
  });

  const [fechaVigenciaFin, setFechaVigenciaFin] = useState<string>(() => {
    if (initialCaratulaToEdit?.fechaVigenciaFin) {
      return initialCaratulaToEdit.fechaVigenciaFin;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    return addDaysToDateString(todayStr, 30);
  });

  const [notasVigencia, setNotasVigencia] = useState<string>(() => {
    return (
      initialCaratulaToEdit?.notasVigencia ||
      "Vigencia de 30 días naturales para consumir o solicitar las guardias contratadas según disponibilidad y requerimiento del cliente."
    );
  });

  // --- CALENDAR & SHIFT SCHEDULER STATE ---
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    return new Date();
  });
  const [autoScheduleStartDate, setAutoScheduleStartDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [autoScheduleStartTime, setAutoScheduleStartTime] = useState<string>("08:00");
  const [baseHoraInicio, setBaseHoraInicio] = useState<string>("08:00");
  const [defaultShiftPreset, setDefaultShiftPreset] = useState<ShiftPresetType>("12h_dia");
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShiftItem[]>(() => {
    if (
      initialCaratulaToEdit?.guardiasProgramadas &&
      Array.isArray(initialCaratulaToEdit.guardiasProgramadas) &&
      initialCaratulaToEdit.guardiasProgramadas.length > 0
    ) {
      return initialCaratulaToEdit.guardiasProgramadas;
    }
    if (initialCaratulaToEdit && calendarEvents && calendarEvents.length > 0) {
      const matchingEvents = calendarEvents.filter(
        (ev) => ev.caratulaFolio === initialCaratulaToEdit.folio || (ev.clientId && ev.clientId === initialCaratulaToEdit.id)
      );
      if (matchingEvents.length > 0) {
        return matchingEvents.map((ev, i) => {
          const fecha = ev.fechaInicio ? ev.fechaInicio.slice(0, 10) : new Date().toISOString().slice(0, 10);
          const horaInicio = ev.fechaInicio ? ev.fechaInicio.slice(11, 16) : "08:00";
          const horaFin = ev.fechaFin ? ev.fechaFin.slice(11, 16) : "20:00";
          const fechaFinCalculada = ev.fechaFin ? ev.fechaFin.slice(0, 10) : fecha;

          let preset: ShiftPresetType = "custom";
          if (horaInicio === "08:00" && horaFin === "20:00" && fechaFinCalculada === fecha) preset = "12h_dia";
          else if (horaInicio === "20:00" && horaFin === "08:00") preset = "12h_noche";
          else if (horaInicio === "08:00" && horaFin === "08:00") preset = "24h";
          else if (horaInicio === "07:00" && horaFin === "15:00") preset = "8h_mat";
          else if (horaInicio === "14:00" && horaFin === "22:00") preset = "8h_vesp";

          return {
            id: ev.id || `shift-${i}-${Date.now()}`,
            fecha,
            horaInicio,
            horaFin,
            fechaFinCalculada,
            preset,
            tipoServicio: ev.tipoServicio || initialCaratulaToEdit.servicios[0]?.servicio || "Enfermería General",
            personalAsignado: ev.personalAsignado || "Por asignar",
            staffId: ev.staffId,
            staffNoSocio: ev.staffNoSocio,
            staffFoto: ev.staffFoto,
            costoHonorarios: ev.costoHonorarios,
          };
        });
      }
    }
    return [];
  });
  const [targetTotalShifts, setTargetTotalShifts] = useState<number>(() => {
    if (initialCaratulaToEdit?.guardiasTotalContratadas) {
      return initialCaratulaToEdit.guardiasTotalContratadas;
    }
    if (
      initialCaratulaToEdit?.guardiasProgramadas &&
      Array.isArray(initialCaratulaToEdit.guardiasProgramadas) &&
      initialCaratulaToEdit.guardiasProgramadas.length > 0
    ) {
      return initialCaratulaToEdit.guardiasProgramadas.length;
    }
    const sum = formData.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0);
    return sum > 0 ? sum : 1;
  });

  // Function to set predefined validity period (e.g. 15, 30, 45, 60, 90 days)
  const handleSetVigenciaPresetDays = (days: number) => {
    setDiasVigencia(days);
    const newFin = addDaysToDateString(fechaVigenciaInicio, days);
    setFechaVigenciaFin(newFin);
    setNotasVigencia(`Vigencia de ${days} días naturales para consumir o solicitar las guardias contratadas.`);
  };

  // Function to update start date of validity
  const handleUpdateVigenciaInicio = (newInicio: string) => {
    setFechaVigenciaInicio(newInicio);
    const newFin = addDaysToDateString(newInicio, diasVigencia);
    setFechaVigenciaFin(newFin);
  };

  // Load existing calendar events if editing a caratula
  useEffect(() => {
    if (initialCaratulaToEdit) {
      setFormData({ ...initialCaratulaToEdit });
      if (initialCaratulaToEdit.modalidadVigencia !== undefined) {
        setVigenciaEnabled(initialCaratulaToEdit.modalidadVigencia);
      }
      if (initialCaratulaToEdit.diasVigencia) {
        setDiasVigencia(initialCaratulaToEdit.diasVigencia);
      }
      if (initialCaratulaToEdit.fechaVigenciaInicio) {
        setFechaVigenciaInicio(initialCaratulaToEdit.fechaVigenciaInicio);
      }
      if (initialCaratulaToEdit.fechaVigenciaFin) {
        setFechaVigenciaFin(initialCaratulaToEdit.fechaVigenciaFin);
      }
      if (initialCaratulaToEdit.notasVigencia) {
        setNotasVigencia(initialCaratulaToEdit.notasVigencia);
      }

      if (
        initialCaratulaToEdit.guardiasProgramadas &&
        Array.isArray(initialCaratulaToEdit.guardiasProgramadas) &&
        initialCaratulaToEdit.guardiasProgramadas.length > 0
      ) {
        setScheduledShifts(initialCaratulaToEdit.guardiasProgramadas);
        setTargetTotalShifts(
          initialCaratulaToEdit.guardiasTotalContratadas ||
            initialCaratulaToEdit.guardiasProgramadas.length
        );
      } else {
        const matchingEvents = (calendarEvents || []).filter(
          (ev) => ev.caratulaFolio && ev.caratulaFolio === initialCaratulaToEdit.folio
        );
        if (matchingEvents.length > 0) {
          const loaded: ScheduledShiftItem[] = matchingEvents.map((ev, i) => {
            const fecha = ev.fechaInicio
              ? ev.fechaInicio.slice(0, 10)
              : new Date().toISOString().slice(0, 10);
            const horaInicio = ev.fechaInicio ? ev.fechaInicio.slice(11, 16) : "08:00";
            const horaFin = ev.fechaFin ? ev.fechaFin.slice(11, 16) : "20:00";
            const fechaFinCalculada = ev.fechaFin ? ev.fechaFin.slice(0, 10) : fecha;

            let preset: ShiftPresetType = "custom";
            if (horaInicio === "08:00" && horaFin === "20:00" && fechaFinCalculada === fecha)
              preset = "12h_dia";
            else if (horaInicio === "20:00" && horaFin === "08:00") preset = "12h_noche";
            else if (horaInicio === "08:00" && horaFin === "08:00") preset = "24h";
            else if (horaInicio === "07:00" && horaFin === "15:00") preset = "8h_mat";
            else if (horaInicio === "14:00" && horaFin === "22:00") preset = "8h_vesp";

            const shiftFolio = ev.folioGuardia || (ev.id?.startsWith("GACP") ? ev.id : undefined);

            return {
              id: shiftFolio || ev.id || `shift-${initialCaratulaToEdit.folio}-${i + 1}`,
              folioGuardia: shiftFolio,
              fecha,
              horaInicio,
              horaFin,
              fechaFinCalculada,
              preset,
              tipoServicio:
                ev.tipoServicio ||
                initialCaratulaToEdit.servicios[0]?.servicio ||
                "Enfermería General",
              personalAsignado: ev.personalAsignado || "Por asignar",
              staffId: ev.staffId,
              staffNoSocio: ev.staffNoSocio,
              staffFoto: ev.staffFoto,
              costoHonorarios: ev.costoHonorarios,
            };
          });
          setScheduledShifts(loaded);
          setTargetTotalShifts(loaded.length);
        }
      }
    }
  }, [initialCaratulaToEdit, calendarEvents]);

  const [bulkHonorarioAmount, setBulkHonorarioAmount] = useState<number>(0);

  // Synchronize target total shifts when services count changes
  useEffect(() => {
    const servicesTotalQty = formData.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0);
    if (servicesTotalQty > 0 && scheduledShifts.length === 0) {
      setTargetTotalShifts(servicesTotalQty);
    }
  }, [formData.servicios, scheduledShifts.length]);

  // Keep formData vigencia fields synchronized
  useEffect(() => {
    const totalContratadas = targetTotalShifts > 0 ? targetTotalShifts : formData.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0);
    const agendadas = scheduledShifts.length;
    const pendientesPorAgendar = vigenciaEnabled ? Math.max(0, totalContratadas - agendadas) : 0;

    let tipoProg: "fechas_fijas" | "abiertas_vigencia" | "mixto" = "fechas_fijas";
    if (vigenciaEnabled) {
      if (agendadas === 0 && totalContratadas > 0) {
        tipoProg = "abiertas_vigencia";
      } else if (agendadas < totalContratadas) {
        tipoProg = "mixto";
      } else {
        tipoProg = "fechas_fijas";
      }
    } else {
      tipoProg = "fechas_fijas";
    }

    setFormData((prev) => ({
      ...prev,
      modalidadVigencia: vigenciaEnabled,
      tipoProgramacion: tipoProg,
      fechaVigenciaInicio: vigenciaEnabled ? fechaVigenciaInicio : undefined,
      fechaVigenciaFin: vigenciaEnabled ? fechaVigenciaFin : undefined,
      diasVigencia: vigenciaEnabled ? diasVigencia : undefined,
      guardiasTotalContratadas: totalContratadas,
      guardiasAgendadas: agendadas,
      guardiasPendientesPorAgendar: pendientesPorAgendar,
      guardiasProgramadas: scheduledShifts,
      notasVigencia: vigenciaEnabled ? notasVigencia : undefined,
    }));
  }, [
    vigenciaEnabled,
    fechaVigenciaInicio,
    fechaVigenciaFin,
    diasVigencia,
    notasVigencia,
    targetTotalShifts,
    scheduledShifts,
  ]);

  // Update Caratula inicio and fin when scheduled shifts or vigencia changes
  useEffect(() => {
    if (scheduledShifts.length > 0) {
      const sorted = [...scheduledShifts].sort((a, b) => {
        const timeA = `${a.fecha}T${a.horaInicio}`;
        const timeB = `${b.fecha}T${b.horaInicio}`;
        return timeA.localeCompare(timeB);
      });
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const newInicio = `${first.fecha} ${first.horaInicio}`;
      const newFin = vigenciaEnabled
        ? `${fechaVigenciaFin} 20:00 (Vigencia)`
        : `${last.fechaFinCalculada} ${last.horaFin}`;

      setFormData((prev) => {
        if (prev.inicio !== newInicio || prev.fin !== newFin) {
          return {
            ...prev,
            inicio: newInicio,
            fin: newFin,
          };
        }
        return prev;
      });
    } else if (vigenciaEnabled) {
      const newInicio = `${fechaVigenciaInicio} 08:00 (Inicio Vigencia)`;
      const newFin = `${fechaVigenciaFin} 20:00 (Límite Vigencia)`;
      setFormData((prev) => {
        if (prev.inicio !== newInicio || prev.fin !== newFin) {
          return {
            ...prev,
            inicio: newInicio,
            fin: newFin,
          };
        }
        return prev;
      });
    }
  }, [scheduledShifts, vigenciaEnabled, fechaVigenciaInicio, fechaVigenciaFin]);

  // Auto clear notification toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Recalculate totals whenever services or discounts or payments change
  const recalculateTotals = (updatedLines: CaratulaServiceLine[], desc: number, pag: number) => {
    const sub = updatedLines.reduce((acc, line) => acc + (line.precioTot || 0), 0);
    const tot = Math.max(0, sub - desc);
    const pend = Math.max(0, tot - pag);

    setFormData((prev) => ({
      ...prev,
      servicios: updatedLines,
      subtotal: sub,
      descuento: desc,
      total: tot,
      pagado: pag,
      pendiente: pend,
    }));
  };

  // Populate form from selected Client
  const handleSelectClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    setFormData((prev) => {
      const newBranchId = client.sucursalId || prev.sucursalId;
      const newBranchObj = effectiveSucursales.find((s) => s.id === newBranchId);
      const newBranchName = client.sucursalNombre || newBranchObj?.nombre || prev.sucursalNombre;
      const shouldRegenFolio = !initialCaratulaToEdit && Boolean(client.sucursalId && client.sucursalId !== prev.sucursalId);
      const newFolio = shouldRegenFolio ? getNextFolio(prev.tipoDocumento, newBranchId) : prev.folio;

      return {
        ...prev,
        id: client.id,
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
        sucursalId: newBranchId,
        sucursalNombre: newBranchName,
        folio: newFolio,
      };
    });
  };

  // Select service from Catalog for row index
  const handleSelectServiceLine = (index: number, serviceName: string) => {
    const srv = services.find((s) => s.nombreServicio === serviceName);
    const updatedLines = [...formData.servicios];

    if (srv) {
      const qty = updatedLines[index].cantidad > 0 ? updatedLines[index].cantidad : 1;
      updatedLines[index] = {
        servicio: srv.nombreServicio,
        cantidad: qty,
        precioU: srv.precio,
        precioTot: qty * srv.precio,
        costoU: srv.costo,
      };
    } else {
      updatedLines[index] = {
        servicio: serviceName,
        cantidad: updatedLines[index].cantidad || 1,
        precioU: updatedLines[index].precioU || 0,
        precioTot: (updatedLines[index].cantidad || 1) * (updatedLines[index].precioU || 0),
        costoU: updatedLines[index].costoU || 0,
      };
    }

    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  const handleUpdateQuantity = (index: number, qty: number) => {
    const updatedLines = [...formData.servicios];
    const unitPrice = updatedLines[index].precioU || 0;
    updatedLines[index].cantidad = qty;
    updatedLines[index].precioTot = qty * unitPrice;

    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  const handleUpdateUnitPrice = (index: number, price: number) => {
    const updatedLines = [...formData.servicios];
    const qty = updatedLines[index].cantidad || 0;
    updatedLines[index].precioU = price;
    updatedLines[index].precioTot = qty * price;

    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  const handleUpdateUnitCost = (index: number, cost: number) => {
    const updatedLines = [...formData.servicios];
    updatedLines[index] = {
      ...updatedLines[index],
      costoU: Math.max(0, cost),
    };
    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  const getDefaultHonorarioForService = (serviceName?: string) => {
    const line =
      formData.servicios.find((s) => s.servicio === serviceName) ||
      formData.servicios.find((s) => s.costoU && Number(s.costoU) > 0) ||
      formData.servicios[0];
    if (line?.costoU !== undefined && line.costoU !== null && Number(line.costoU) > 0) {
      return Number(line.costoU);
    }
    const cat = services.find((s) => s.nombreServicio === serviceName);
    if (cat?.costo !== undefined && cat.costo !== null && Number(cat.costo) > 0) {
      return Number(cat.costo);
    }
    return 0;
  };

  const handleUpdateShiftCost = (shiftId: string, cost: number) => {
    setScheduledShifts((prev) =>
      prev.map((s) => (s.id === shiftId ? { ...s, costoHonorarios: Math.max(0, cost) } : s))
    );
  };

  const handleBulkSetShiftCost = (amount: number, filterType: "all" | "dia" | "noche" = "all") => {
    if (amount < 0) return;
    setScheduledShifts((prev) =>
      prev.map((s) => {
        const isNocturno = s.preset.includes("noc") || s.horaInicio >= "19:00" || s.horaFin <= "08:00";
        if (filterType === "all") return { ...s, costoHonorarios: amount };
        if (filterType === "dia" && !isNocturno) return { ...s, costoHonorarios: amount };
        if (filterType === "noche" && isNocturno) return { ...s, costoHonorarios: amount };
        return s;
      })
    );
    setNotification({
      text: `¡Honorarios actualizados a ${formatCurrency(amount)} (${filterType === "all" ? "Todas las guardias" : filterType === "dia" ? "Solo turnos diurnos" : "Solo turnos nocturnos"})!`,
      type: "info",
    });
  };

  const handleAddServiceRow = () => {
    const updatedLines = [
      ...formData.servicios,
      { servicio: "", cantidad: 1, precioU: 0, precioTot: 0, costoU: 0 },
    ];
    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  const handleRemoveServiceRow = (index: number) => {
    if (formData.servicios.length <= 1) {
      const resetLines = [{ servicio: "", cantidad: 1, precioU: 0, precioTot: 0, costoU: 0 }];
      recalculateTotals(resetLines, formData.descuento, formData.pagado);
      return;
    }
    const updatedLines = formData.servicios.filter((_, i) => i !== index);
    recalculateTotals(updatedLines, formData.descuento, formData.pagado);
  };

  // --- SEQUENTIAL GUARDIA FOLIO ALLOCATION ---
  const assignSequentialGuardiaFolios = (
    shiftsToProcess: ScheduledShiftItem[]
  ): ScheduledShiftItem[] => {
    let maxIdx = getMaxGuardiaIndex([
      ...(calendarEvents || []),
      ...(caratulas || []),
      ...shiftsToProcess,
    ]);

    const seenFolios = new Set<string>();
    // Collect pre-existing valid folios from calendarEvents and caratulas
    (calendarEvents || []).forEach((ev) => {
      const f = ev.folioGuardia || (ev.id?.startsWith("GACP") ? ev.id : null);
      if (f && isValidGuardiaFolio(f)) {
        seenFolios.add(f.trim().toUpperCase());
      }
    });

    return shiftsToProcess.map((shift) => {
      const currentFolio = shift.folioGuardia || (shift.id && isValidGuardiaFolio(shift.id) ? shift.id : null);
      if (currentFolio && isValidGuardiaFolio(currentFolio) && !seenFolios.has(currentFolio.trim().toUpperCase())) {
        seenFolios.add(currentFolio.trim().toUpperCase());
        return {
          ...shift,
          id: currentFolio,
          folioGuardia: currentFolio,
        };
      }
      do {
        maxIdx += 1;
      } while (seenFolios.has(formatGuardiaFolio(maxIdx).trim().toUpperCase()));

      const newFolio = formatGuardiaFolio(maxIdx);
      seenFolios.add(newFolio.trim().toUpperCase());
      return {
        ...shift,
        id: newFolio,
        folioGuardia: newFolio,
      };
    });
  };

  // --- CALENDAR SHIFT HELPERS ---
  const handleAddShiftToDate = (
    dateStr: string,
    preset?: ShiftPresetType,
    customStart?: string,
    customEnd?: string
  ) => {
    const activeService =
      formData.servicios.find((s) => s.servicio && s.cantidad > 0)?.servicio ||
      "Enfermería General";

    // If preset not explicitly passed, infer smartest next preset for that day
    let shiftPreset: ShiftPresetType = preset || defaultShiftPreset;
    let initialStart = customStart || baseHoraInicio;

    if (!preset) {
      const existingInDay = scheduledShifts.filter((s) => s.fecha === dateStr);
      if (existingInDay.length === 1) {
        if (existingInDay[0].preset === "12h_dia") {
          shiftPreset = "12h_noche";
          initialStart = existingInDay[0].horaFin || "20:00";
        } else if (existingInDay[0].preset === "8h_mat") {
          shiftPreset = "8h_vesp";
          initialStart = existingInDay[0].horaFin || "15:00";
        } else if (existingInDay[0].preset === "8h_vesp") {
          shiftPreset = "8h_noc";
          initialStart = existingInDay[0].horaFin || "23:00";
        } else {
          shiftPreset = "12h_noche";
          initialStart = existingInDay[0].horaFin || "20:00";
        }
      } else if (existingInDay.length === 2) {
        if (existingInDay.some((s) => s.preset === "8h_mat") && existingInDay.some((s) => s.preset === "8h_vesp")) {
          shiftPreset = "8h_noc";
          initialStart = "23:00";
        }
      }
    }

    const details = getShiftPresetDetails(shiftPreset, dateStr, initialStart);
    const horaInicio = initialStart || details.horaInicio;
    const horaFin = customEnd || details.horaFin;
    const fechaFinCalculada = details.fechaFinCalculada;

    const newShift: ScheduledShiftItem = {
      id: `shift-temp-${Date.now()}`,
      fecha: dateStr,
      horaInicio,
      horaFin,
      fechaFinCalculada,
      preset: shiftPreset,
      tipoServicio: activeService,
      personalAsignado: "Por asignar",
      costoHonorarios: getDefaultHonorarioForService(activeService),
    };

    const combined = [...scheduledShifts, newShift].sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(combined));
  };

  const handleToggleOrAddShift = (dateStr: string) => {
    const existingInDay = scheduledShifts.filter((s) => s.fecha === dateStr);
    if (existingInDay.length === 0) {
      // Add first shift using baseHoraInicio
      handleAddShiftToDate(dateStr, defaultShiftPreset, baseHoraInicio);
    } else if (existingInDay.length === 1) {
      // Add complementary shift for continuous coverage
      const prevShift = existingInDay[0];
      if (prevShift.preset === "12h_dia") {
        handleAddShiftToDate(dateStr, "12h_noche", prevShift.horaFin);
      } else if (prevShift.preset === "8h_mat") {
        handleAddShiftToDate(dateStr, "8h_vesp", prevShift.horaFin);
      } else {
        handleAddShiftToDate(dateStr, defaultShiftPreset === "12h_dia" ? "12h_noche" : "12h_dia", prevShift.horaFin);
      }
    } else {
      // If 2 already exist, add another
      handleAddShiftToDate(dateStr, defaultShiftPreset, baseHoraInicio);
    }
  };

  const handleDuplicateShift = (shift: ScheduledShiftItem) => {
    let nextPreset: ShiftPresetType = shift.preset;
    let nextStart = shift.horaFin || "20:00";
    if (shift.preset === "12h_dia") {
      nextPreset = "12h_noche";
      nextStart = shift.horaFin || "20:00";
    } else if (shift.preset === "8h_mat") {
      nextPreset = "8h_vesp";
      nextStart = shift.horaFin || "15:00";
    } else if (shift.preset === "8h_vesp") {
      nextPreset = "8h_noc";
      nextStart = shift.horaFin || "23:00";
    }

    const details = getShiftPresetDetails(nextPreset, shift.fechaFinCalculada || shift.fecha, nextStart);
    const newShift: ScheduledShiftItem = {
      id: `shift-temp-${Date.now()}`,
      fecha: shift.fechaFinCalculada || shift.fecha,
      horaInicio: details.horaInicio,
      horaFin: details.horaFin,
      fechaFinCalculada: details.fechaFinCalculada,
      preset: nextPreset,
      tipoServicio: shift.tipoServicio,
      personalAsignado: "Por asignar",
      costoHonorarios: shift.costoHonorarios ?? getDefaultHonorarioForService(shift.tipoServicio),
    };

    const combined = [...scheduledShifts, newShift].sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(combined));
  };

  const handleClearDayShifts = (dateStr: string) => {
    setScheduledShifts((prev) => prev.filter((s) => s.fecha !== dateStr));
  };

  // 1. "Una tras otra (Continuo 24/7 sin descanso: termina una e inicia la otra inmediatamente a partir de la hora de inicio configurada)"
  const handleGenerateContinuousConsecutive = (count: number, startDateParam?: string) => {
    const startDateStr =
      startDateParam ||
      autoScheduleStartDate ||
      scheduledShifts[0]?.fecha ||
      fechaVigenciaInicio ||
      new Date().toISOString().slice(0, 10);
    const startHourStr = autoScheduleStartTime || "08:00";
    const newShifts: ScheduledShiftItem[] = [];
    const activeService =
      formData.servicios.find((s) => s.servicio && s.cantidad > 0)?.servicio ||
      "Enfermería General";

    const durationHours =
      defaultShiftPreset === "24h"
        ? 24
        : defaultShiftPreset.startsWith("8h")
        ? 8
        : 12;

    let curDate = startDateStr;
    let curTime = startHourStr;

    for (let i = 0; i < count; i++) {
      const times = computeShiftTimes(curDate, curTime, durationHours);
      let presetType: ShiftPresetType = defaultShiftPreset;
      if (durationHours === 12) {
        const h = parseInt(curTime.split(":")[0], 10);
        presetType = h >= 18 || h < 6 ? "12h_noche" : "12h_dia";
      } else if (durationHours === 8) {
        const h = parseInt(curTime.split(":")[0], 10);
        presetType = h >= 6 && h < 13 ? "8h_mat" : h >= 13 && h < 21 ? "8h_vesp" : "8h_noc";
      }

      newShifts.push({
        id: `shift-cont-${i}`,
        fecha: curDate,
        horaInicio: times.horaInicio,
        horaFin: times.horaFin,
        fechaFinCalculada: times.fechaFinCalculada,
        preset: presetType,
        tipoServicio: activeService,
        personalAsignado: "Por asignar",
        costoHonorarios: getDefaultHonorarioForService(activeService),
      });

      // Next shift begins exactly when current shift ends
      curDate = times.fechaFinCalculada;
      curTime = times.horaFin;
    }

    const sorted = newShifts.sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(sorted));
  };

  // 2. "Por día / Una diario (1 guardia fija cada día consecutivo iniciando a la hora configurada)"
  const handleGenerateOnePerDay = (count: number, startDateParam?: string) => {
    const startDateStr =
      startDateParam ||
      autoScheduleStartDate ||
      scheduledShifts[0]?.fecha ||
      fechaVigenciaInicio ||
      new Date().toISOString().slice(0, 10);
    const startHourStr = autoScheduleStartTime || "08:00";
    const newShifts: ScheduledShiftItem[] = [];
    const activeService =
      formData.servicios.find((s) => s.servicio && s.cantidad > 0)?.servicio ||
      "Enfermería General";

    const durationHours =
      defaultShiftPreset === "24h"
        ? 24
        : defaultShiftPreset.startsWith("8h")
        ? 8
        : 12;

    for (let d = 0; d < count; d++) {
      const dateStr = addDaysToDateString(startDateStr, d);
      const times = computeShiftTimes(dateStr, startHourStr, durationHours);
      newShifts.push({
        id: `shift-1perday-${d}`,
        fecha: dateStr,
        horaInicio: times.horaInicio,
        horaFin: times.horaFin,
        fechaFinCalculada: times.fechaFinCalculada,
        preset: defaultShiftPreset,
        tipoServicio: activeService,
        personalAsignado: "Por asignar",
        costoHonorarios: getDefaultHonorarioForService(activeService),
      });
    }

    const sorted = newShifts.sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(sorted));
  };

  const handleGenerateConsecutiveDays = (count: number, shiftsPerDay: 1 | 2 | 3 = 1) => {
    if (shiftsPerDay === 1) {
      handleGenerateOnePerDay(count);
      return;
    }
    const startDateStr =
      autoScheduleStartDate ||
      scheduledShifts[0]?.fecha ||
      fechaVigenciaInicio ||
      new Date().toISOString().slice(0, 10);
    const startHourStr = autoScheduleStartTime || "08:00";
    const newShifts: ScheduledShiftItem[] = [];
    const activeService =
      formData.servicios.find((s) => s.servicio && s.cantidad > 0)?.servicio ||
      "Enfermería General";

    const daysToGenerate = Math.ceil(count / shiftsPerDay);

    for (let d = 0; d < daysToGenerate; d++) {
      const dateStr = addDaysToDateString(startDateStr, d);

      if (shiftsPerDay === 2) {
        // 2 shifts per day: Shift 1 at startHour, Shift 2 immediately follows
        const shift1 = computeShiftTimes(dateStr, startHourStr, 12);
        newShifts.push({
          id: `shift-${dateStr}-dia-${d}`,
          fecha: dateStr,
          horaInicio: shift1.horaInicio,
          horaFin: shift1.horaFin,
          fechaFinCalculada: shift1.fechaFinCalculada,
          preset: "12h_dia",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });

        const shift2 = computeShiftTimes(shift1.fechaFinCalculada, shift1.horaFin, 12);
        newShifts.push({
          id: `shift-${shift1.fechaFinCalculada}-noc-${d}`,
          fecha: shift1.fechaFinCalculada,
          horaInicio: shift2.horaInicio,
          horaFin: shift2.horaFin,
          fechaFinCalculada: shift2.fechaFinCalculada,
          preset: "12h_noche",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });
      } else if (shiftsPerDay === 3) {
        // 3 shifts per day (8h each)
        const shift1 = computeShiftTimes(dateStr, startHourStr, 8);
        newShifts.push({
          id: `shift-${dateStr}-mat-${d}`,
          fecha: dateStr,
          horaInicio: shift1.horaInicio,
          horaFin: shift1.horaFin,
          fechaFinCalculada: shift1.fechaFinCalculada,
          preset: "8h_mat",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });

        const shift2 = computeShiftTimes(shift1.fechaFinCalculada, shift1.horaFin, 8);
        newShifts.push({
          id: `shift-${shift1.fechaFinCalculada}-vesp-${d}`,
          fecha: shift1.fechaFinCalculada,
          horaInicio: shift2.horaInicio,
          horaFin: shift2.horaFin,
          fechaFinCalculada: shift2.fechaFinCalculada,
          preset: "8h_vesp",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });

        const shift3 = computeShiftTimes(shift2.fechaFinCalculada, shift2.horaFin, 8);
        newShifts.push({
          id: `shift-${shift2.fechaFinCalculada}-noc-${d}`,
          fecha: shift2.fechaFinCalculada,
          horaInicio: shift3.horaInicio,
          horaFin: shift3.horaFin,
          fechaFinCalculada: shift3.fechaFinCalculada,
          preset: "8h_noc",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });
      }
    }

    const sorted = newShifts.slice(0, count).sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(sorted));
  };

  const handleGenerateAlternateDays = (count: number, shiftsPerDay: 1 | 2 = 1) => {
    const startDateStr =
      autoScheduleStartDate ||
      scheduledShifts[0]?.fecha ||
      fechaVigenciaInicio ||
      new Date().toISOString().slice(0, 10);
    const startHourStr = autoScheduleStartTime || "08:00";
    const newShifts: ScheduledShiftItem[] = [];
    const activeService =
      formData.servicios.find((s) => s.servicio && s.cantidad > 0)?.servicio ||
      "Enfermería General";

    const durationHours =
      defaultShiftPreset === "24h"
        ? 24
        : defaultShiftPreset.startsWith("8h")
        ? 8
        : 12;

    const daysToGenerate = shiftsPerDay === 1 ? count : Math.ceil(count / shiftsPerDay);

    for (let d = 0; d < daysToGenerate; d++) {
      const dateStr = addDaysToDateString(startDateStr, d * 2);

      if (shiftsPerDay === 1) {
        const times = computeShiftTimes(dateStr, startHourStr, durationHours);
        newShifts.push({
          id: `shift-${dateStr}-alt-1-${d}`,
          fecha: dateStr,
          horaInicio: times.horaInicio,
          horaFin: times.horaFin,
          fechaFinCalculada: times.fechaFinCalculada,
          preset: defaultShiftPreset,
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });
      } else {
        const shift1 = computeShiftTimes(dateStr, startHourStr, 12);
        newShifts.push({
          id: `shift-${dateStr}-alt-dia-${d}`,
          fecha: dateStr,
          horaInicio: shift1.horaInicio,
          horaFin: shift1.horaFin,
          fechaFinCalculada: shift1.fechaFinCalculada,
          preset: "12h_dia",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });

        const shift2 = computeShiftTimes(shift1.fechaFinCalculada, shift1.horaFin, 12);
        newShifts.push({
          id: `shift-${shift1.fechaFinCalculada}-alt-noc-${d}`,
          fecha: shift1.fechaFinCalculada,
          horaInicio: shift2.horaInicio,
          horaFin: shift2.horaFin,
          fechaFinCalculada: shift2.fechaFinCalculada,
          preset: "12h_noche",
          tipoServicio: activeService,
          personalAsignado: "Por asignar",
          costoHonorarios: getDefaultHonorarioForService(activeService),
        });
      }
    }

    const sorted = newShifts.slice(0, count).sort((a, b) => {
      const timeA = `${a.fecha}T${a.horaInicio}`;
      const timeB = `${b.fecha}T${b.horaInicio}`;
      return timeA.localeCompare(timeB);
    });

    setScheduledShifts(assignSequentialGuardiaFolios(sorted));
  };

  const handleClearShifts = () => {
    setScheduledShifts([]);
  };

  const handleUpdateShiftPreset = (shiftId: string, preset: ShiftPresetType) => {
    setScheduledShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s;
        const details = getShiftPresetDetails(preset, s.fecha);
        return {
          ...s,
          preset,
          horaInicio: details.horaInicio,
          horaFin: details.horaFin,
          fechaFinCalculada: details.fechaFinCalculada,
        };
      })
    );
  };

  const handleUpdateShiftCustomTime = (
    shiftId: string,
    horaInicio: string,
    horaFin: string,
    fechaFin?: string
  ) => {
    setScheduledShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s;
        return {
          ...s,
          horaInicio,
          horaFin,
          fechaFinCalculada: fechaFin || s.fechaFinCalculada,
          preset: "custom",
        };
      })
    );
  };

  const handleUpdateShiftStaff = (shiftId: string, staffName: string) => {
    const staff = activeStaff.find(
      (s) =>
        s.nombre + " " + s.apellidos === staffName ||
        `[SOC-${s.noSocio}] ${s.nombre} ${s.apellidos}` === staffName ||
        s.id === staffName
    );

    setScheduledShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s;
        if (staff) {
          return {
            ...s,
            personalAsignado: `${staff.nombre} ${staff.apellidos}`,
            staffId: staff.id,
            staffNoSocio: staff.noSocio,
            staffFoto: staff.fotoUrl,
          };
        }
        return {
          ...s,
          personalAsignado: staffName || "Por asignar",
          staffId: undefined,
          staffNoSocio: undefined,
          staffFoto: undefined,
        };
      })
    );
  };

  const handleBulkAssignStaff = (
    staffName: string,
    targetType: "all" | "dia" | "noche" | "unassigned"
  ) => {
    if (!staffName) return;
    const staff = activeStaff.find(
      (s) =>
        s.nombre + " " + s.apellidos === staffName ||
        `[SOC-${s.noSocio}] ${s.nombre} ${s.apellidos}` === staffName ||
        s.id === staffName
    );

    setScheduledShifts((prev) =>
      prev.map((s) => {
        let shouldAssign = false;
        if (targetType === "all") shouldAssign = true;
        else if (targetType === "unassigned") shouldAssign = s.personalAsignado === "Por asignar" || !s.personalAsignado;
        else if (targetType === "dia") shouldAssign = s.preset === "12h_dia" || s.preset === "8h_mat" || s.preset === "8h_vesp";
        else if (targetType === "noche") shouldAssign = s.preset === "12h_noche" || s.preset === "8h_noc";

        if (!shouldAssign) return s;

        if (staff) {
          return {
            ...s,
            personalAsignado: `${staff.nombre} ${staff.apellidos}`,
            staffId: staff.id,
            staffNoSocio: staff.noSocio,
            staffFoto: staff.fotoUrl,
          };
        }
        return {
          ...s,
          personalAsignado: staffName || "Por asignar",
          staffId: undefined,
          staffNoSocio: undefined,
          staffFoto: undefined,
        };
      })
    );
  };

  const handleRemoveShift = (shiftId: string) => {
    setScheduledShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  // --- SAVE OPERATION ---
  const handleSave = async () => {
    if (!formData.nombreCompletoCliente) {
      setNotification({
        text: "Por favor seleccione o ingrese el nombre del cliente.",
        type: "error",
      });
      return;
    }

    // Validación estricta de no duplicación de folios
    const cleanFolio = (formData.folio || "").trim().toUpperCase();
    const isDuplicate = caratulas.some(
      (c) =>
        c.folio &&
        c.folio.trim().toUpperCase() === cleanFolio &&
        (!initialCaratulaToEdit || c.id !== initialCaratulaToEdit.id)
    );
    if (isDuplicate) {
      const nextFolio = getNextFolio(formData.tipoDocumento);
      setFormData((prev) => ({ ...prev, folio: nextFolio }));
      setNotification({
        text: `El folio "${cleanFolio}" ya se encuentra registrado. Se asignó automáticamente el folio único consecutivo "${nextFolio}". Por favor presione Guardar nuevamente para confirmar.`,
        type: "error",
      });
      return;
    }

    const totalContratadas =
      targetTotalShifts > 0
        ? targetTotalShifts
        : formData.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0);
    const agendadas = scheduledShifts.length;
    const pendientesPorAgendar = vigenciaEnabled ? Math.max(0, totalContratadas - agendadas) : 0;

    let tipoProg: "fechas_fijas" | "abiertas_vigencia" | "mixto" = "fechas_fijas";
    if (vigenciaEnabled) {
      if (agendadas === 0 && totalContratadas > 0) {
        tipoProg = "abiertas_vigencia";
      } else if (agendadas < totalContratadas) {
        tipoProg = "mixto";
      } else {
        tipoProg = "fechas_fijas";
      }
    } else {
      tipoProg = "fechas_fijas";
    }

    const calculatedInicio =
      scheduledShifts.length > 0
        ? formData.inicio
        : vigenciaEnabled
        ? `${fechaVigenciaInicio} 08:00 (Inicio Vigencia)`
        : formData.inicio;

    const calculatedFin = vigenciaEnabled
      ? `${fechaVigenciaFin} 20:00 (Límite Vigencia)`
      : scheduledShifts.length > 0
      ? formData.fin
      : formData.fin;

    // Ensure all scheduled shifts have official sequential folios (e.g. GACP26A2108...)
    const shiftsWithFolios = assignSequentialGuardiaFolios(scheduledShifts);

    // Ensure client ID accurately matches client name to prevent ID collisions
    let safeClientId = formData.id;
    const clientNameTrimmed = (formData.nombreCompletoCliente || "").trim();
    if (clientNameTrimmed) {
      const matchByName = uniqueClients.find(
        (c) => c.nombreCompletoCliente.trim().toLowerCase() === clientNameTrimmed.toLowerCase()
      );
      if (matchByName) {
        safeClientId = matchByName.id;
      } else {
        // If current formData.id belongs to another client with a DIFFERENT name, generate a unique ID
        const matchById = uniqueClients.find((c) => c.id === safeClientId);
        if (matchById && matchById.nombreCompletoCliente.trim().toLowerCase() !== clientNameTrimmed.toLowerCase()) {
          safeClientId = getNextClientId(uniqueClients);
        }
      }
    }

    const caratulaToSave: Caratula = {
      ...formData,
      id: safeClientId,
      verificationToken: formData.verificationToken || generateVerificationToken(),
      modalidadVigencia: vigenciaEnabled,
      tipoProgramacion: tipoProg,
      fechaVigenciaInicio: vigenciaEnabled ? fechaVigenciaInicio : undefined,
      fechaVigenciaFin: vigenciaEnabled ? fechaVigenciaFin : undefined,
      diasVigencia: vigenciaEnabled ? diasVigencia : undefined,
      guardiasTotalContratadas: totalContratadas,
      guardiasAgendadas: agendadas,
      guardiasPendientesPorAgendar: pendientesPorAgendar,
      guardiasProgramadas: shiftsWithFolios,
      notasVigencia: vigenciaEnabled ? notasVigencia : undefined,
      inicio: calculatedInicio,
      fin: calculatedFin,
    };

    onSaveCaratula(caratulaToSave);

    // If there are scheduled shifts, create/update synchronized CalendarEvents
    if (shiftsWithFolios.length > 0) {
      const eventsToCreate: CalendarEvent[] = shiftsWithFolios.map((shift, idx) => {
        const evId = shift.folioGuardia || shift.id || `EVT-${caratulaToSave.folio}-${idx + 1}`;
        return {
          id: evId,
          folioGuardia: shift.folioGuardia,
          clientId: caratulaToSave.id,
          clientNombre: caratulaToSave.nombreCompletoCliente,
          caratulaFolio: caratulaToSave.folio,
          titulo: `Guardia ${shift.tipoServicio || "Enfermería"} (${shift.folioGuardia || caratulaToSave.folio})`,
          fechaInicio: `${shift.fecha}T${shift.horaInicio}`,
          fechaFin: `${shift.fechaFinCalculada || shift.fecha}T${shift.horaFin}`,
          personalAsignado: shift.personalAsignado || "Por asignar",
          staffId: shift.staffId || "",
          staffNoSocio: shift.staffNoSocio || "",
          staffFoto: shift.staffFoto || "",
          tipoServicio: shift.tipoServicio || caratulaToSave.servicios[0]?.servicio || "Enfermería General",
          costoHonorarios: shift.costoHonorarios,
          estado: "Programado",
          notas: `Guardia folio ${shift.folioGuardia || evId} agendada desde Carátula ${caratulaToSave.folio}. Paciente: ${caratulaToSave.nombreCompletoRS || caratulaToSave.nombreCompletoCliente}.`,
          timestamp: getCurrentTimestamp(),
          registradoPor: currentUserName || "Sistema Carátulas",
          sucursalId: caratulaToSave.sucursalId,
          sucursalNombre: caratulaToSave.sucursalNombre,
        };
      });

      if (onSaveCalendarEventsBatch) {
        await onSaveCalendarEventsBatch(eventsToCreate);
      } else if (onSaveCalendarEvent) {
        for (const ev of eventsToCreate) {
          onSaveCalendarEvent(ev);
        }
      }
    }

    if (scheduledShifts.length === 0) {
      setNotification({
        text: `¡Carátula ${caratulaToSave.folio} guardada con modalidad de Vigencia para ${totalContratadas} guardias hasta el ${fechaVigenciaFin}!`,
        type: "success",
      });
    } else if (pendientesPorAgendar > 0) {
      setNotification({
        text: `¡Carátula ${caratulaToSave.folio} guardada con ${agendadas} guardias agendadas y ${pendientesPorAgendar} pendientes con vigencia hasta el ${fechaVigenciaFin}!`,
        type: "success",
      });
    } else {
      setNotification({
        text: `¡Carátula ${caratulaToSave.folio} y ${scheduledShifts.length} turnos agendados exitosamente en el calendario!`,
        type: "success",
      });
    }

    if (onFinishedEditing) {
      setTimeout(() => {
        onFinishedEditing();
      }, 1200);
    } else {
      setTimeout(() => {
        setFormData(createEmptyCaratula());
        setScheduledShifts([]);
      }, 1500);
    }
  };

  // Memoized Caratula object for live preview and export, guaranteeing full scheduled shifts synchronization
  const previewCaratula: Caratula = useMemo(() => {
    const totalContratadas =
      targetTotalShifts > 0
        ? targetTotalShifts
        : formData.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0);
    const agendadas = scheduledShifts.length;
    const pendientesPorAgendar = vigenciaEnabled ? Math.max(0, totalContratadas - agendadas) : 0;

    let tipoProg: "fechas_fijas" | "abiertas_vigencia" | "mixto" = "fechas_fijas";
    if (vigenciaEnabled) {
      if (agendadas === 0 && totalContratadas > 0) {
        tipoProg = "abiertas_vigencia";
      } else if (agendadas < totalContratadas) {
        tipoProg = "mixto";
      } else {
        tipoProg = "fechas_fijas";
      }
    } else {
      tipoProg = "fechas_fijas";
    }

    let calculatedInicio = formData.inicio;
    let calculatedFin = formData.fin;
    if (scheduledShifts.length > 0) {
      const sorted = [...scheduledShifts].sort((a, b) => {
        const timeA = `${a.fecha}T${a.horaInicio}`;
        const timeB = `${b.fecha}T${b.horaInicio}`;
        return timeA.localeCompare(timeB);
      });
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      calculatedInicio = `${first.fecha} ${first.horaInicio}`;
      calculatedFin = vigenciaEnabled
        ? `${fechaVigenciaFin} 20:00 (Vigencia)`
        : `${last.fechaFinCalculada} ${last.horaFin}`;
    } else if (vigenciaEnabled) {
      calculatedInicio = `${fechaVigenciaInicio} 08:00 (Inicio Vigencia)`;
      calculatedFin = `${fechaVigenciaFin} 20:00 (Límite Vigencia)`;
    }

    return {
      ...formData,
      verificationToken: formData.verificationToken || generateVerificationToken(),
      modalidadVigencia: vigenciaEnabled,
      tipoProgramacion: tipoProg,
      fechaVigenciaInicio: vigenciaEnabled ? fechaVigenciaInicio : undefined,
      fechaVigenciaFin: vigenciaEnabled ? fechaVigenciaFin : undefined,
      diasVigencia: vigenciaEnabled ? diasVigencia : undefined,
      guardiasTotalContratadas: totalContratadas,
      guardiasAgendadas: agendadas,
      guardiasPendientesPorAgendar: pendientesPorAgendar,
      guardiasProgramadas: scheduledShifts,
      notasVigencia: vigenciaEnabled ? notasVigencia : undefined,
      inicio: calculatedInicio,
      fin: calculatedFin,
    };
  }, [
    formData,
    scheduledShifts,
    targetTotalShifts,
    vigenciaEnabled,
    fechaVigenciaInicio,
    fechaVigenciaFin,
    diasVigencia,
    notasVigencia,
  ]);

  // Calendar calculations for the interactive mini calendar
  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : notification.type === "info"
              ? "bg-sky-50 border-sky-300 text-sky-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-xs">
            {notification.type === "success" && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === "info" && <Info className="w-4 h-4 text-sky-600 shrink-0" />}
            {notification.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <Trash2 className="w-4 h-4 opacity-0" />
          </button>
        </div>
      )}

      {/* Top Banner & Quick Controls */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-mono text-[10px] font-bold uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5" />
            {initialCaratulaToEdit ? "MODIFICACIÓN DE DOCUMENTO" : "REGISTRO DE NUEVA CARÁTULA"}
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Carátula: <span className="text-blue-400 font-mono">{formData.folio}</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowLivePreview(!showLivePreview)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
          >
            {showLivePreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-sky-400" />}
            <span>{showLivePreview ? "Ocultar Prevista" : "Ver Prevista"}</span>
          </button>

          <button
            onClick={() => printCaratulaDocument()}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
            title="Imprimir formato"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={() => downloadCaratulaImage("caratula-official-document", `Caratula_${formData.folio}.png`)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
            title="Descargar como imagen PNG"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Imagen</span>
          </button>

          <button
            onClick={() => downloadCaratulaPDF("caratula-official-document", `Caratula_${formData.folio}.pdf`)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm min-h-[40px]"
            title="Descargar PDF"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>

          <button
            onClick={() => setShowVerificationModal(true)}
            className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all min-h-[40px]"
            title="Verificar Link de Autenticidad"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Verificar Link</span>
          </button>

          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md min-h-[42px]"
          >
            <Save className="w-4 h-4" />
            <span>Guardar y Agendar</span>
          </button>
        </div>
      </div>

      {/* Grid: Form on Left, Live Document on Right */}
      <div className={`grid grid-cols-1 ${showLivePreview ? "lg:grid-cols-12" : ""} gap-6`}>
        {/* FORM PANEL */}
        <div className={showLivePreview ? "lg:col-span-6 space-y-5" : "space-y-5"}>
          {/* Document Type Selector (Carátula vs Cotización) */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Tipo de Documento a Generar:
              </span>
              {formData.tipoDocumento === "Cotización" && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  ⏱️ Válida por 7 días
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => {
                    const isNew = !initialCaratulaToEdit;
                    const newFolio = isNew || prev.folio.startsWith("CPCOTA") || prev.folio.startsWith("COT") ? getNextFolio("Caratula", prev.sucursalId) : prev.folio;
                    return {
                      ...prev,
                      tipoDocumento: "Caratula",
                      folio: newFolio,
                      estado: prev.estado === "Cotización" ? "Activo" : prev.estado,
                    };
                  })
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  formData.tipoDocumento === "Caratula" || !formData.tipoDocumento
                    ? "bg-blue-600 text-white border-blue-500 shadow-md"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                }`}
              >
                📄 Carátula de Servicio (Oficial)
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => {
                    const isNew = !initialCaratulaToEdit;
                    const newFolio = isNew || prev.folio.startsWith("CPSEA") ? getNextFolio("Cotización", prev.sucursalId) : prev.folio;

                    return {
                      ...prev,
                      tipoDocumento: "Cotización",
                      folio: newFolio,
                      estado: "Cotización",
                      detallesCotizacionText: prev.detallesCotizacionText || "",
                      validezCotizacion:
                        prev.validezCotizacion ||
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    };
                  })
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  formData.tipoDocumento === "Cotización"
                    ? "bg-amber-600 text-white border-amber-500 shadow-md"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white"
                }`}
              >
                📋 Cotización / Presupuesto
              </button>
            </div>

            {/* Estado del Documento (Activo, Completado, Cancelado) */}
            {formData.tipoDocumento === "Caratula" && (
              <div className="pt-2 mt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Estado de la Carátula:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          estado: "Activo",
                          motivoCancelacion: undefined,
                          fechaCancelacion: undefined,
                          canceladoPor: undefined,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        formData.estado === "Activo" || !formData.estado
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ✓ Activa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          estado: "Completado",
                          motivoCancelacion: undefined,
                          fechaCancelacion: undefined,
                          canceladoPor: undefined,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        formData.estado === "Completado"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ✔ Completada
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          estado: "Cancelado",
                          motivoCancelacion: prev.motivoCancelacion || "Cancelación de carátula por administración",
                          fechaCancelacion: prev.fechaCancelacion || new Date().toLocaleString(),
                          canceladoPor: prev.canceladoPor || currentUserName || "Administración",
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        formData.estado === "Cancelado"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      ⛔ Cancelada
                    </button>
                  </div>
                </div>

                {formData.estado === "Cancelado" && (
                  <div className="w-full bg-rose-950/40 border border-rose-800/80 rounded-xl p-2.5 space-y-1.5">
                    <label className="block text-[11px] font-bold text-rose-300 uppercase">
                      Motivo de Cancelación:
                    </label>
                    <input
                      type="text"
                      value={formData.motivoCancelacion || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, motivoCancelacion: e.target.value }))
                      }
                      placeholder="Ej. Servicio cancelado por el cliente / Cambio de fecha"
                      className="w-full bg-slate-900 border border-rose-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Asignación de Sucursal y Folio Oficial (CXXXX0000A00) */}
            <div className="pt-3 mt-3 border-t border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    Sucursal Asignada *
                  </label>
                  <select
                    value={formData.sucursalId || ""}
                    onChange={(e) => {
                      const newBranchId = e.target.value;
                      const branchObj = effectiveSucursales.find((s) => s.id === newBranchId);
                      const branchName = branchObj?.nombre || "Cuidarte México";
                      const newFolio = getNextFolio(formData.tipoDocumento, newBranchId);
                      setFormData((prev) => ({
                        ...prev,
                        sucursalId: newBranchId,
                        sucursalNombre: branchName,
                        folio: !initialCaratulaToEdit ? newFolio : prev.folio,
                      }));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    {effectiveSucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.codigo || resolveSucursalAbbreviation(s)}) - {s.ciudad}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Abrev: <strong className="text-sky-300 font-mono">{resolveSucursalAbbreviation(effectiveSucursales.find((s) => s.id === formData.sucursalId))}</strong>
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300 uppercase">
                      Folio Oficial:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newFolio = getNextFolio(formData.tipoDocumento, formData.sucursalId);
                        setFormData((prev) => ({ ...prev, folio: newFolio }));
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1"
                      title="Recalcular consecutivo oficial de la sucursal"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Regenerar Folio
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.folio}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, folio: e.target.value.toUpperCase() }))
                    }
                    placeholder="Ej. CPACH1026A00"
                    className="w-full bg-slate-800 border border-slate-700 text-sky-300 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none uppercase"
                  />
                  <p className="text-[10px] text-slate-400">
                    Formato: <strong className="text-slate-300 font-mono">C + ABREV + MM + AA + FOLIO (A00-Z99)</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Client & Patient Information */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Datos del Cliente y Receptor de Servicio (RS)
              </h3>
              <span className="text-[11px] text-slate-500">Obligatorio</span>
            </div>

            {/* Client Autofill Dropdown */}
            {uniqueClients && uniqueClients.length > 0 && (
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200">
                <label className="block text-[11px] font-bold text-blue-900 mb-1 uppercase flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  Cargar Datos de Cliente Existente:
                </label>
                <select
                  value={formData.id}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Seleccionar de la Base de Clientes --</option>
                  {uniqueClients.map((c, idx) => (
                    <option key={`cli-opt-${c.id || idx}-${idx}`} value={c.id}>
                      [{c.id}] {c.nombreCompletoCliente} - Tel: {c.numeroContacto}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  NOMBRE COMPLETO CLIENTE (CONTRATANTE)
                </label>
                <input
                  type="text"
                  placeholder="Nombre de la persona o familiar contratante"
                  value={formData.nombreCompletoCliente}
                  onChange={(e) => setFormData({ ...formData, nombreCompletoCliente: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  TELÉFONO DE CONTACTO 1
                </label>
                <input
                  type="text"
                  placeholder="Ej: 771 123 4567"
                  value={formData.numeroContacto}
                  onChange={(e) => setFormData({ ...formData, numeroContacto: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  TELÉFONO 2 (OPCIONAL)
                </label>
                <input
                  type="text"
                  placeholder="Teléfono alterno"
                  value={formData.numeroContacto2 || ""}
                  onChange={(e) => setFormData({ ...formData, numeroContacto2: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  CORREO ELECTRÓNICO
                </label>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.correo}
                  onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  DIRECCIÓN DEL SERVICIO
                </label>
                <input
                  type="text"
                  placeholder="Calle, número, colonia, municipio..."
                  value={formData.direccionServicio}
                  onChange={(e) => setFormData({ ...formData, direccionServicio: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  NOMBRE COMPLETO RECEPTOR DE SERVICIO (RS)
                </label>
                <input
                  type="text"
                  placeholder="Paciente receptor del cuidado"
                  value={formData.nombreCompletoRS}
                  onChange={(e) => setFormData({ ...formData, nombreCompletoRS: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  EDAD
                </label>
                <input
                  type="text"
                  placeholder="Ej: 82 AÑOS"
                  value={formData.edad}
                  onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  DIAGNÓSTICO
                </label>
                <input
                  type="text"
                  placeholder="Diagnóstico médico principal"
                  value={formData.diagnostico}
                  onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  ESPECIFICACIONES
                </label>
                <textarea
                  rows={2}
                  placeholder="Especificaciones o instrucciones particulares..."
                  value={formData.especificaciones}
                  onChange={(e) => setFormData({ ...formData, especificaciones: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Detalles del Servicio */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  2. {formData.tipoDocumento === "Cotización" ? "Servicios a Cotizar" : "Detalles y Servicios Contratados"} ({formData.servicios.length} {formData.servicios.length === 1 ? "concepto" : "conceptos"})
                </h3>
                <p className="text-[11px] text-slate-500">Agregue los servicios requeridos seleccionando del catálogo o escribiendo conceptos personalizados</p>
              </div>
              <button
                type="button"
                onClick={handleAddServiceRow}
                className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold rounded-xl border border-sky-200 flex items-center gap-1.5 self-start sm:self-center transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Servicio
              </button>
            </div>

            <div className="space-y-3">
              {formData.servicios.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 transition rounded-xl border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span>SERVICIO #{idx + 1}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {line.servicio && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px]">
                            Venta: {formatCurrency(line.precioTot)}
                          </span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                            Honorarios: {formatCurrency((line.cantidad || 0) * (line.costoU || 0))}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveServiceRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Eliminar este servicio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    {/* Service Name Selector or Input */}
                    <div className="sm:col-span-5">
                      <select
                        value={services.some((s) => s.nombreServicio === line.servicio) ? line.servicio : ""}
                        onChange={(e) => handleSelectServiceLine(idx, e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none"
                      >
                        <option value="">-- Escoger del Catálogo --</option>
                        {services.map((s) => (
                          <option key={s.id} value={s.nombreServicio}>
                            {s.nombreServicio} ({formatCurrency(s.precio)})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="O escriba un servicio personalizado..."
                        value={line.servicio}
                        onChange={(e) => handleSelectServiceLine(idx, e.target.value)}
                        className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5 uppercase">
                        CANTIDAD
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={line.cantidad}
                        onChange={(e) => handleUpdateQuantity(idx, parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5 uppercase">
                        PRECIO VENTA ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.precioU}
                        onChange={(e) => handleUpdateUnitPrice(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold outline-none"
                      />
                    </div>

                    {/* Unit Cost / Honorario */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-rose-600 font-semibold mb-0.5 uppercase">
                        HONORARIO BASE ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.costoU ?? 0}
                        onChange={(e) => handleUpdateUnitCost(idx, parseFloat(e.target.value) || 0)}
                        className="w-full bg-rose-50/50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-rose-700 outline-none focus:ring-1 focus:ring-rose-400"
                        placeholder="0.00"
                        title="Honorarios a pagar al personal por cada guardia de este tipo"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Button to add service */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddServiceRow}
                className="w-full py-2.5 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50 text-sky-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4" /> Agregar Otro Servicio / Concepto a la Carátula o Cotización
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                DETALLES O ESPECIFICACIONES DEL SERVICIO
              </label>
              <textarea
                rows={3}
                placeholder="Escriba aquí los detalles del servicio, especificaciones de las propuestas, turnos u observaciones particulares..."
                value={formData.detallesServicio || ""}
                onChange={(e) => setFormData({ ...formData, detallesServicio: e.target.value })}
                className="w-full border border-slate-300 rounded-xl p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Section 3: Descuentos, Pagos y Resumen Financiero */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                3. {formData.tipoDocumento === "Cotización" ? "Resumen Financiero y Descuentos" : "Descuentos, Pagos y Resumen Financiero"}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* DESCUENTO FIELD */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  DESCUENTO ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.descuento || 0}
                  onChange={(e) => {
                    const desc = parseFloat(e.target.value) || 0;
                    recalculateTotals(formData.servicios, desc, formData.pagado);
                  }}
                  className="w-full border border-slate-300 font-mono text-amber-700 font-bold px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/30"
                  placeholder="0.00"
                />
              </div>

              {/* PAYMENT - ONLY FOR CARÁTULA */}
              {formData.tipoDocumento !== "Cotización" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      PAGADO / ABONADO ($)
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Editable
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.pagado === 0 ? "0" : (formData.pagado ?? "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      const pag = val === "" ? 0 : parseFloat(val) || 0;
                      recalculateTotals(formData.servicios, formData.descuento, pag);
                    }}
                    className="w-full border border-slate-300 font-mono text-emerald-700 font-extrabold px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/30"
                    placeholder="0.00"
                  />
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => recalculateTotals(formData.servicios, formData.descuento, formData.total || 0)}
                      className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-1 rounded transition"
                      title="Marcar como liquidado totalmente"
                    >
                      Liquidar Total ({formatCurrency(formData.total || 0)})
                    </button>
                    <button
                      type="button"
                      onClick={() => recalculateTotals(formData.servicios, formData.descuento, Math.round((formData.total || 0) * 0.5))}
                      className="text-[10px] font-bold text-sky-800 bg-sky-100/70 hover:bg-sky-200 px-2 py-1 rounded transition"
                      title="Abonar 50% de anticipo"
                    >
                      50% Anticipo
                    </button>
                    <button
                      type="button"
                      onClick={() => recalculateTotals(formData.servicios, formData.descuento, 0)}
                      className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition"
                      title="Dejar pagado en $0.00"
                    >
                      $0.00
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    El monto pagado se registrará en el saldo del cliente y se generará o ajustará automáticamente el comprobante de pago oficial.
                  </p>
                </div>
              )}

              {/* Financial Summary Card */}
              <div className="sm:col-span-2 bg-slate-900 text-white p-4 rounded-2xl space-y-2 font-mono text-xs shadow-inner">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Subtotal Servicios:</span>
                  <span>{formatCurrency(formData.subtotal || 0)}</span>
                </div>
                {formData.descuento > 0 && (
                  <div className="flex justify-between items-center text-amber-400 font-bold">
                    <span>Descuento Aplicado:</span>
                    <span>- {formatCurrency(formData.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-white font-bold text-sm pt-1 border-t border-slate-700">
                  <span>Total Neto:</span>
                  <span className="text-sky-400">{formatCurrency(formData.total || 0)}</span>
                </div>
                {formData.tipoDocumento !== "Cotización" && (
                  <>
                    <div className="flex justify-between items-center text-emerald-400">
                      <span>Monto Pagado / Abonado:</span>
                      <span>{formatCurrency(formData.pagado || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-400 font-extrabold text-sm pt-1 border-t border-slate-700">
                      <span>Saldo Pendiente:</span>
                      <span>{formatCurrency(formData.pendiente >= 0 ? formData.pendiente : 0)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: VIGENCIA DE COTIZACIÓN (FOR COTIZACIÓN) OR PROGRAMACIÓN DE GUARDIAS (FOR CARATULA) */}
          {formData.tipoDocumento === "Cotización" ? (
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-amber-600 font-mono text-[10px] font-bold uppercase tracking-wider">
                    ⏱️ PERÍODO DE VALIDEZ DE LA PROPUESTA
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mt-0.5">
                    4. Vigencia de la Cotización
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1.5 font-mono">
                    <span>📅</span>
                    <span>Válida hasta: {formData.validezCotizacion || "7 días"}</span>
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 mt-0.5">
                    ⏱️
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                      Garantía de Tarifas y Disponibilidad
                    </h4>
                    <p className="text-[11.5px] text-amber-900 leading-relaxed">
                      En las cotizaciones <strong>no se incluye la programación de guardias</strong> ni asignación de enfermeras. La vigencia establecida fija los precios y tarifas para que el cliente formalice su servicio. Las fechas y turnos definitivos se agendarán al formalizar la carátula de servicio oficial.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-amber-950 mb-1 uppercase">
                      FECHA LÍMITE DE VALIDEZ / VIGENCIA:
                    </label>
                    <input
                      type="date"
                      value={formData.validezCotizacion || ""}
                      onChange={(e) => setFormData({ ...formData, validezCotizacion: e.target.value })}
                      className="w-full bg-white border border-amber-300 font-mono font-bold text-amber-950 px-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-7 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-900 uppercase mr-1">
                      Ajuste rápido:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                        setFormData({ ...formData, validezCotizacion: d });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 transition"
                    >
                      +7 Días
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                        setFormData({ ...formData, validezCotizacion: d });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 transition"
                    >
                      +15 Días
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                        setFormData({ ...formData, validezCotizacion: d });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-300 transition"
                    >
                      +30 Días
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Section 4: PROGRAMACIÓN DE GUARDIAS Y CALENDARIO DE TURNOS (FOR CARÁTULAS DE SERVICIO) */
            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-4">
              {/* Header & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sky-600 font-mono text-[10px] font-bold uppercase tracking-wider">
                    <CalendarDays className="w-4 h-4" />
                    PROGRAMACIÓN DE TURNOS EN CALENDARIO
                  </div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wide mt-0.5">
                    4. Fechas, Horarios y Asignación de Guardias
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-800 font-bold px-3 py-1 rounded-full border border-slate-200">
                    Contratadas: <strong className="text-slate-900">{targetTotalShifts}</strong>
                  </span>
                  <span className="text-xs bg-sky-100 text-sky-900 font-black px-3 py-1 rounded-full border border-sky-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>Agendadas: {scheduledShifts.length}</span>
                  </span>
                  {vigenciaEnabled && (
                    <span className="text-xs bg-emerald-100 text-emerald-900 font-bold px-3 py-1 rounded-full border border-emerald-300">
                      Disponibles: {Math.max(0, targetTotalShifts - scheduledShifts.length)}
                    </span>
                  )}
                </div>
              </div>

              {/* Notice banner for atomic sync & folios */}
              <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-sky-950">
                <span className="text-base shrink-0">🛡️</span>
                <div className="space-y-0.5">
                  <p className="font-bold">
                    Agenda protegida contra duplicados con Folio de Control Único de Serie (GACP26A...):
                  </p>
                  <p className="text-slate-600 text-[11px]">
                    Las guardias se registran en el calendario oficial únicamente al guardar la carátula. Al editar la carátula se sincronizan y actualizan automáticamente sin duplicarse.
                  </p>
                </div>
              </div>

              {/* MODALIDAD DE SERVICIO: FECHAS FIJAS vs VIGENCIA FLEXIBLE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                      Modalidad de Programación:
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Elige si se agendan todas las fechas fijas ahora o si se emiten con vigencia abierta de consumo a demanda.
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl bg-white p-1 border border-slate-300 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setVigenciaEnabled(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        !vigenciaEnabled
                          ? "bg-sky-600 text-white shadow-xs"
                          : "text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      <span>📅</span> Fechas Fijas
                    </button>
                    <button
                      type="button"
                      onClick={() => setVigenciaEnabled(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        vigenciaEnabled
                          ? "bg-sky-600 text-white shadow-xs"
                          : "text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      <span>⏱️</span> Vigencia Abierta
                    </button>
                  </div>
                </div>

                {vigenciaEnabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-200/80 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-slate-600 uppercase mr-1">
                        Plazo Rápido:
                      </span>
                      {[
                        { days: 15, label: "15 Días" },
                        { days: 30, label: "30 Días (1 Mes)" },
                        { days: 45, label: "45 Días" },
                        { days: 60, label: "60 Días (2 Meses)" },
                        { days: 90, label: "90 Días (3 Meses)" },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => handleSetVigenciaPresetDays(preset.days)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                            diasVigencia === preset.days
                              ? "bg-sky-600 text-white shadow-sm"
                              : "bg-white text-slate-700 hover:bg-sky-50 border border-slate-200"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-sky-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">
                          INICIO DE VIGENCIA
                        </label>
                        <input
                          type="date"
                          value={fechaVigenciaInicio}
                          onChange={(e) => handleUpdateVigenciaInicio(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">
                          DÍAS NATURALES
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={diasVigencia}
                          onChange={(e) => {
                            const d = Math.max(1, parseInt(e.target.value) || 1);
                            setDiasVigencia(d);
                            setFechaVigenciaFin(addDaysToDateString(fechaVigenciaInicio, d));
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase">
                          LÍMITE DE USO (FIN VIGENCIA)
                        </label>
                        <input
                          type="date"
                          value={fechaVigenciaFin}
                          onChange={(e) => setFechaVigenciaFin(e.target.value)}
                          className="w-full bg-sky-50/70 border border-sky-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-black text-sky-900 outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* GENERADOR RÁPIDO & ACOMODO AUTOMÁTICO DE AGENDA */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                        📅 Acomodar desde:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={autoScheduleStartDate}
                          onChange={(e) => setAutoScheduleStartDate(e.target.value)}
                          className="bg-white border border-slate-300 font-mono font-bold text-slate-800 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setAutoScheduleStartDate(new Date().toISOString().slice(0, 10))}
                          className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1.5 rounded-md transition"
                        >
                          Hoy
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                        ⏰ Hora inicio:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={autoScheduleStartTime}
                          onChange={(e) => {
                            setAutoScheduleStartTime(e.target.value);
                            setBaseHoraInicio(e.target.value);
                          }}
                          className="bg-white border border-slate-300 font-mono font-bold text-slate-800 text-xs px-2 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <div className="flex items-center gap-0.5">
                          {["07:00", "08:00", "14:00", "20:00"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setBaseHoraInicio(t);
                                setAutoScheduleStartTime(t);
                              }}
                              className={`text-[9px] px-1.5 py-1 rounded font-mono font-bold border transition ${
                                autoScheduleStartTime === t
                                  ? "bg-sky-600 border-sky-600 text-white"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                        Modalidad base:
                      </label>
                      <select
                        value={defaultShiftPreset}
                        onChange={(e) => {
                          const newPreset = e.target.value as ShiftPresetType;
                          setDefaultShiftPreset(newPreset);
                          const details = getShiftPresetDetails(newPreset, new Date().toISOString().slice(0, 10));
                          setBaseHoraInicio(details.horaInicio);
                          setAutoScheduleStartTime(details.horaInicio);
                        }}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="12h_dia">☀️ 12 Horas Diurna</option>
                        <option value="12h_noche">🌙 12 Horas Nocturna</option>
                        <option value="24h">⏱️ 24 Horas Continuas</option>
                        <option value="8h_mat">🌅 8 Horas Matutino</option>
                        <option value="8h_vesp">🌆 8 Horas Vespertino</option>
                        <option value="8h_noc">🌃 8 Horas Nocturno</option>
                        <option value="custom">⚙️ Horario Personalizado</option>
                      </select>
                    </div>
                  </div>

                  {scheduledShifts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearShifts}
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 font-bold rounded-lg border border-rose-300 shadow-2xs transition text-xs flex items-center gap-1.5 self-start md:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Limpiar calendario</span>
                    </button>
                  )}
                </div>

                {/* 1-Click Schedule Action Buttons */}
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase mb-2">
                    Acomodar con 1 Clic ({targetTotalShifts} guardias):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* 1. CONTINUO 24/7 */}
                    <button
                      type="button"
                      onClick={() => handleGenerateContinuousConsecutive(targetTotalShifts)}
                      className="p-3 bg-gradient-to-br from-sky-600 to-indigo-700 hover:from-sky-500 hover:to-indigo-600 text-white rounded-xl shadow-xs text-left transition flex flex-col justify-between"
                    >
                      <div className="font-black text-xs flex items-center gap-1.5">
                        <span>⚡</span> Continuo 24/7 Ininterrumpido
                      </div>
                      <div className="text-[10.5px] text-sky-100 mt-1 leading-snug">
                        Termina un turno e inicia inmediatamente el siguiente sin descansos.
                      </div>
                    </button>

                    {/* 2. UNA DIARIO */}
                    <button
                      type="button"
                      onClick={() => handleGenerateOnePerDay(targetTotalShifts)}
                      className="p-3 bg-white hover:bg-sky-50 text-slate-900 border-2 border-sky-400 rounded-xl shadow-2xs text-left transition flex flex-col justify-between"
                    >
                      <div className="font-black text-xs text-sky-900 flex items-center gap-1.5">
                        <span>📅</span> 1 Guardia Diaria ({targetTotalShifts} días)
                      </div>
                      <div className="text-[10.5px] text-slate-600 mt-1 leading-snug">
                        1 turno fijo cada día consecutivo en el horario configurado.
                      </div>
                    </button>

                    {/* 3. 2 POR DÍA */}
                    <button
                      type="button"
                      onClick={() => handleGenerateConsecutiveDays(targetTotalShifts, 2)}
                      className="p-3 bg-white hover:bg-indigo-50 text-slate-900 border border-indigo-200 rounded-xl shadow-2xs text-left transition flex flex-col justify-between"
                    >
                      <div className="font-black text-xs text-indigo-900 flex items-center gap-1.5">
                        <span>☀️🌙</span> 2 al Día (Día y Noche)
                      </div>
                      <div className="text-[10.5px] text-slate-600 mt-1 leading-snug">
                        Cobertura completa con 12h diurna y 12h nocturna por fecha.
                      </div>
                    </button>

                    {/* 4. DÍAS ALTERNOS */}
                    <button
                      type="button"
                      onClick={() => handleGenerateAlternateDays(targetTotalShifts, 1)}
                      className="p-3 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl shadow-2xs text-left transition flex flex-col justify-between"
                    >
                      <div className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                        <span>🔄</span> Días Alternos (1 Sí, 1 No)
                      </div>
                      <div className="text-[10.5px] text-slate-600 mt-1 leading-snug">
                        Turnos con un día de descanso intermedio entre cada fecha.
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* CALENDARIO VISUAL INTERACTIVO */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-xs uppercase tracking-wider">
                      {monthNames[calMonth]} {calYear}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      • Haz clic en el '+' de un día para agregar turno
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(new Date(calYear, calMonth - 1, 1))
                      }
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarMonth(new Date())}
                      className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(new Date(calYear, calMonth + 1, 1))
                      }
                      className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 text-center bg-slate-100 text-[10px] font-bold text-slate-600 py-1.5 border-b border-slate-200">
                  <span>DOM</span>
                  <span>LUN</span>
                  <span>MAR</span>
                  <span>MIÉ</span>
                  <span>JUE</span>
                  <span>VIE</span>
                  <span>SÁB</span>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 p-2 bg-slate-50/50">
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[54px] rounded-lg bg-transparent" />
                  ))}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const dayShifts = scheduledShifts.filter((s) => s.fecha === dateStr);
                    const hasShifts = dayShifts.length > 0;
                    const isToday =
                      new Date().toISOString().slice(0, 10) === dateStr;

                    return (
                      <div
                        key={dayNum}
                        className={`min-h-[56px] rounded-xl p-1 text-xs font-bold flex flex-col justify-between transition-all border relative group ${
                          hasShifts
                            ? dayShifts.length >= 2
                              ? "bg-indigo-50/90 border-indigo-300 text-indigo-950 shadow-xs"
                              : "bg-sky-50/90 border-sky-300 text-sky-950 shadow-xs"
                            : isToday
                            ? "bg-amber-50/50 text-amber-900 border-amber-300"
                            : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[11px] font-mono ${isToday ? "text-amber-700 font-black underline" : ""}`}>
                            {dayNum}
                          </span>

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddShiftToDate(dateStr);
                              }}
                              title="Agregar guardia a esta fecha"
                              className="w-4 h-4 rounded bg-sky-100 hover:bg-sky-600 text-sky-700 hover:text-white flex items-center justify-center text-[10px] font-black transition"
                            >
                              +
                            </button>

                            {hasShifts && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleClearDayShifts(dateStr);
                                }}
                                title="Quitar turnos de esta fecha"
                                className="w-4 h-4 rounded bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white flex items-center justify-center text-[9px] font-black transition opacity-70 group-hover:opacity-100"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Day Shift Badge */}
                        <button
                          type="button"
                          onClick={() => handleToggleOrAddShift(dateStr)}
                          className="w-full text-left mt-0.5 space-y-0.5 outline-none"
                        >
                          {hasShifts ? (
                            <>
                              {dayShifts.length === 1 ? (
                                <div className="text-[8.5px] bg-sky-600 text-white font-mono px-1 py-0.5 rounded leading-tight text-center font-bold flex items-center justify-center gap-0.5 truncate">
                                  <span>{dayShifts[0].preset.includes("noc") ? "🌙" : "☀️"}</span>
                                  <span>{dayShifts[0].horaInicio}-{dayShifts[0].horaFin}</span>
                                </div>
                              ) : dayShifts.length === 2 ? (
                                <div className="text-[8px] bg-indigo-600 text-white font-mono px-1 py-0.5 rounded leading-tight text-center font-bold flex items-center justify-center gap-0.5 truncate">
                                  <span>☀️🌙 2 Guardias</span>
                                </div>
                              ) : (
                                <div className="text-[8px] bg-emerald-700 text-white font-mono px-1 py-0.5 rounded leading-tight text-center font-bold flex items-center justify-center gap-0.5 truncate">
                                  <span>🔄 {dayShifts.length} Guardias (8h)</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-[8.5px] text-slate-400 font-normal text-center py-1 opacity-0 group-hover:opacity-100 transition">
                              + Agregar
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LISTA DE GUARDIAS PROGRAMADAS CON FOLIO DE CONTROL */}
              {scheduledShifts.length > 0 && (
                <div className="space-y-3 pt-2">
                  {/* Bulk Staff Assignment Header */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-sky-400 block text-[11px]">
                        ASIGNACIÓN RÁPIDA DE ENFERMERÍA
                      </span>
                      <span className="text-[11px] text-slate-300">
                        Asigna un socio/enfermero a múltiples turnos en un solo paso:
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        id="bulk-staff-selector"
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-medium max-w-xs"
                        defaultValue=""
                      >
                        <option value="">-- Seleccionar Enfermero/a --</option>
                        {activeStaff.map((s) => (
                          <option key={s.id} value={`[SOC-${s.noSocio}] ${s.nombre} ${s.apellidos}`}>
                            SOC-{s.noSocio} - {s.nombre} {s.apellidos}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const select = document.getElementById("bulk-staff-selector") as HTMLSelectElement;
                          if (select?.value) handleBulkAssignStaff(select.value, "dia");
                        }}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition"
                      >
                        ☀️ Asignar a Diurnos
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const select = document.getElementById("bulk-staff-selector") as HTMLSelectElement;
                          if (select?.value) handleBulkAssignStaff(select.value, "noche");
                        }}
                        className="px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg text-xs transition"
                      >
                        🌙 Asignar a Nocturnos
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const select = document.getElementById("bulk-staff-selector") as HTMLSelectElement;
                          if (select?.value) handleBulkAssignStaff(select.value, "unassigned");
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
                      >
                        ⚠️ A pendientes
                      </button>
                    </div>
                  </div>

                  {/* Bulk Honorarios Configuration Bar */}
                  <div className="bg-rose-950/90 text-white p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border border-rose-900/60 shadow-sm">
                    <div>
                      <span className="font-bold uppercase tracking-wider text-rose-300 block text-[11px] flex items-center gap-1.5">
                        <span>💵 AJUSTE DE HONORARIOS POR GUARDIA</span>
                      </span>
                      <span className="text-[11px] text-rose-200/80">
                        Configura o iguala el costo de honorarios por turno de forma masiva o individual:
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-rose-900/60 px-2 py-1 rounded-lg border border-rose-700/50">
                        <span className="text-[11px] font-bold text-rose-200">$ MXN:</span>
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={bulkHonorarioAmount || ""}
                          onChange={(e) => setBulkHonorarioAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          placeholder="0.00"
                          className="w-24 bg-slate-900 text-white border border-rose-500/50 rounded px-2 py-0.5 text-xs font-mono font-bold outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBulkSetShiftCost(bulkHonorarioAmount, "all")}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition"
                        title="Aplicar este monto a todas las guardias"
                      >
                        💰 A Todas ({scheduledShifts.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkSetShiftCost(bulkHonorarioAmount, "dia")}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition"
                        title="Aplicar solo a turnos diurnos"
                      >
                        ☀️ Solo Diurnas
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBulkSetShiftCost(bulkHonorarioAmount, "noche")}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition"
                        title="Aplicar solo a turnos nocturnos"
                      >
                        🌙 Solo Nocturnas
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <span>Lista de Guardias con Folio Único ({scheduledShifts.length}):</span>
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-mono">
                      Total Honorarios Estimados:{" "}
                      <strong className="text-rose-600">
                        {formatCurrency(
                          scheduledShifts.reduce(
                            (acc, s) =>
                              acc +
                              (s.costoHonorarios !== undefined && s.costoHonorarios !== null
                                ? Number(s.costoHonorarios)
                                : getDefaultHonorarioForService(s.tipoServicio)),
                            0
                          )
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {scheduledShifts.map((shift, idx) => {
                      const sameDayShifts = scheduledShifts.filter((s) => s.fecha === shift.fecha);
                      const isMultiShiftDay = sameDayShifts.length > 1;
                      const isNocturno = shift.preset.includes("noc") || shift.horaInicio >= "19:00" || shift.horaFin <= "08:00";
                      const currentCost =
                        shift.costoHonorarios !== undefined && shift.costoHonorarios !== null
                          ? Number(shift.costoHonorarios)
                          : getDefaultHonorarioForService(shift.tipoServicio);

                      return (
                        <div
                          key={`car-shift-${shift.id || idx}-${idx}`}
                          className={`p-3 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs transition ${
                            isNocturno
                              ? "bg-slate-900 text-white border-slate-800 shadow-xs"
                              : "bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-xs"
                          }`}
                        >
                          {/* Left Folio & Date */}
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-full font-black flex items-center justify-center text-[10px] shrink-0 ${
                                isNocturno ? "bg-indigo-600 text-white" : "bg-sky-600 text-white"
                              }`}
                            >
                              {idx + 1}
                            </span>

                            <div>
                              <div className="font-bold flex items-center gap-2 flex-wrap">
                                {shift.folioGuardia && (
                                  <span className="text-[11px] font-mono font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded">
                                    🛡️ {shift.folioGuardia}
                                  </span>
                                )}
                                <span className="text-xs">📅 {shift.fecha}</span>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                    isNocturno
                                      ? "bg-indigo-900/60 text-indigo-300 border border-indigo-700/50"
                                      : "bg-sky-100 text-sky-900 border border-sky-200"
                                  }`}
                                >
                                  {isNocturno ? "🌙 Turno Nocturno" : "☀️ Turno Diurno"} ({shift.horaInicio} - {shift.horaFin})
                                </span>

                                {isMultiShiftDay && (
                                  <span className="text-[9.5px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                                    Multiturno en fecha
                                  </span>
                                )}
                              </div>

                              <div className={`text-[11px] font-medium mt-0.5 ${isNocturno ? "text-slate-300" : "text-slate-600"}`}>
                                Servicio: {shift.tipoServicio}
                              </div>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Individual Shift Cost (Honorarios) */}
                            <div
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs ${
                                isNocturno
                                  ? "bg-slate-800/80 border-rose-900/60 text-rose-300"
                                  : "bg-rose-50/70 border-rose-200 text-rose-800"
                              }`}
                              title="Honorarios a pagar al personal por esta guardia específica"
                            >
                              <span className="text-[10px] font-black uppercase font-mono">Honorarios $:</span>
                              <input
                                type="number"
                                step="10"
                                min="0"
                                value={currentCost}
                                onChange={(e) =>
                                  handleUpdateShiftCost(shift.id, parseFloat(e.target.value) || 0)
                                }
                                className={`w-20 px-1.5 py-0.5 rounded text-xs font-mono font-black outline-none border ${
                                  isNocturno
                                    ? "bg-slate-900 border-slate-700 text-rose-400 focus:border-rose-500"
                                    : "bg-white border-slate-300 text-rose-600 focus:border-rose-500"
                                }`}
                              />
                            </div>

                            {/* Preset selector */}
                            <select
                              value={shift.preset}
                              onChange={(e) =>
                                handleUpdateShiftPreset(shift.id, e.target.value as ShiftPresetType)
                              }
                              className={`border rounded-lg px-2 py-1.5 text-xs font-medium outline-none ${
                                isNocturno
                                  ? "bg-slate-800 border-slate-700 text-white"
                                  : "bg-slate-50 border-slate-300 text-slate-800"
                              }`}
                            >
                              <option value="12h_dia">☀️ 12h Día</option>
                              <option value="12h_noche">🌙 12h Noche</option>
                              <option value="24h">⏱️ 24h Continua</option>
                              <option value="8h_mat">🌅 8h Matutino</option>
                              <option value="8h_vesp">🌆 8h Vespertino</option>
                              <option value="8h_noc">🌃 8h Nocturno</option>
                              <option value="custom">⚙️ Personalizado</option>
                            </select>

                            {/* Time inputs */}
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <input
                                type="time"
                                value={shift.horaInicio}
                                onChange={(e) => {
                                  const newStart = e.target.value;
                                  const durationHours =
                                    shift.preset === "24h"
                                      ? 24
                                      : shift.preset.startsWith("8h")
                                      ? 8
                                      : shift.preset === "custom"
                                      ? undefined
                                      : 12;
                                  if (durationHours) {
                                    const times = computeShiftTimes(shift.fecha, newStart, durationHours);
                                    handleUpdateShiftCustomTime(shift.id, times.horaInicio, times.horaFin, times.fechaFinCalculada);
                                  } else {
                                    handleUpdateShiftCustomTime(shift.id, newStart, shift.horaFin);
                                  }
                                }}
                                className={`border rounded px-1.5 py-1 font-bold ${
                                  isNocturno ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                }`}
                              />
                              <span>-</span>
                              <input
                                type="time"
                                value={shift.horaFin}
                                onChange={(e) =>
                                  handleUpdateShiftCustomTime(shift.id, shift.horaInicio, e.target.value)
                                }
                                className={`border rounded px-1.5 py-1 font-bold ${
                                  isNocturno ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                }`}
                              />
                            </div>

                            {/* Staff Assignment */}
                            <select
                              value={shift.personalAsignado}
                              onChange={(e) => handleUpdateShiftStaff(shift.id, e.target.value)}
                              className={`border rounded-lg px-2 py-1.5 text-xs font-medium outline-none max-w-xs ${
                                shift.personalAsignado === "Por asignar" || !shift.personalAsignado
                                  ? isNocturno
                                    ? "bg-amber-950/80 border-amber-600 text-amber-300 font-bold"
                                    : "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                                  : isNocturno
                                  ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 font-bold"
                                  : "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                              }`}
                            >
                              <option value="Por asignar">⚠️ Por Asignar (Pendiente)</option>
                              {activeStaff.map((s, sIdx) => (
                                <option
                                  key={`staff-opt-${s.id || s.noSocio || sIdx}-${sIdx}`}
                                  value={`[SOC-${s.noSocio}] ${s.nombre} ${s.apellidos}`}
                                >
                                  SOC-{s.noSocio} - {s.nombre} {s.apellidos}
                                </option>
                              ))}
                            </select>

                            {/* Duplicate / Add another shift on same day */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateShift(shift)}
                              className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition ${
                                isNocturno
                                  ? "bg-slate-800 border-slate-700 text-sky-300 hover:bg-slate-700"
                                  : "bg-slate-100 border-slate-300 text-sky-700 hover:bg-sky-50"
                              }`}
                              title="Agregar otro turno en esta misma fecha"
                            >
                              <span>+ Otro turno</span>
                            </button>

                            {/* Delete shift */}
                            <button
                              type="button"
                              onClick={() => handleRemoveShift(shift.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                              title="Eliminar esta guardia"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Links / Contract Reference Info */}
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  ENLACE / NOTA DE CONTRATO
                </label>
                <input
                  type="text"
                  placeholder="https://... o folio de contrato"
                  value={formData.contratoLink}
                  onChange={(e) => setFormData({ ...formData, contratoLink: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-1.5 rounded-lg text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                  ENLACE / NOTA DE TÉRMINOS Y CONDICIONES (T&C)
                </label>
                <input
                  type="text"
                  placeholder="https://... o cláusula aplicable"
                  value={formData.tycLink}
                  onChange={(e) => setFormData({ ...formData, tycLink: e.target.value })}
                  className="w-full border border-slate-300 px-3 py-1.5 rounded-lg text-xs outline-none"
                />
              </div>
            </div>
          </div>
          )}

          {/* Section 5: Optional Notes / Extra Details */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                5. Notas o Condiciones Adicionales {formData.tipoDocumento === "Cotización" ? "de la Cotización" : "del Servicio / Carátula"}
              </h3>
              <span className="text-[11px] text-slate-500">Opcional</span>
            </div>
            <textarea
              rows={3}
              value={formData.detallesCotizacionText || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, detallesCotizacionText: e.target.value }))
              }
              placeholder="Escriba condiciones de validez, especificaciones del personal, turnos o notas adicionales..."
              className="w-full border border-slate-300 rounded-xl p-3 text-xs font-mono leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/20"
            />
          </div>
        </div>

        {/* DOCUMENT PREVIEW PANEL */}
        {showLivePreview && (
          <div className="lg:col-span-6 space-y-3">
            <div className="bg-slate-800 text-white p-3 rounded-xl flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                Prevista en Vivo del Documento Oficial
              </span>
              <span className="text-slate-400 font-mono">{formData.folio}</span>
            </div>

            <div className="overflow-x-auto bg-slate-200 p-2 sm:p-4 rounded-2xl border border-slate-300 shadow-inner">
              <CaratulaDocument caratula={previewCaratula} documentRef={documentRef} />
            </div>
          </div>
        )}
      </div>

      {/* Hidden Off-Screen Document for PDF / PNG Export when Preview is Hidden */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "0",
          width: "850px",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <div id="caratula-export-document">
          <CaratulaDocument caratula={previewCaratula} />
        </div>
      </div>

      {/* Verification Portal Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto p-2 sm:p-6 animate-in fade-in">
          <CaratulaVerificationPortal
            folio={formData.folio}
            caratulas={caratulas}
            onBack={() => setShowVerificationModal(false)}
            isAdminView={true}
          />
        </div>
      )}
    </div>
  );
};
