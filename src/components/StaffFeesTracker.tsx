import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Caratula,
  Expense,
  Service,
  CaratulaServiceLine,
  StaffMember,
  CalendarEvent,
  GuardiaShiftRecord,
  ScheduledShiftItem,
} from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  calculateGlobalFinancialSummary,
  CaratulaCostStats,
  getServiceUnitCost,
} from "../utils/financeCalculations";
import {
  isSameGuardia,
  deduplicateShiftsList,
  isValidGuardiaFolio,
} from "../utils/guardiaFolio";
import {
  Users,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  History,
  Trash2,
  X,
  RefreshCw,
  Edit3,
  Pencil,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  FileSpreadsheet,
  Plus,
  Building2,
  CreditCard,
  Copy,
  UserCheck,
  ExternalLink,
  Calendar,
  ArrowRight,
  ChevronRight,
  ShieldAlert,
  ArrowDownLeft,
  CalendarDays,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { deleteCalendarEventFromFirestore } from "../services/firestoreSync";

export interface StaffFeesTrackerProps {
  caratulas: Caratula[];
  services?: Service[];
  expenses: Expense[];
  staffMembers?: StaffMember[];
  calendarEvents?: CalendarEvent[];
  guardiaRecords?: GuardiaShiftRecord[];
  onAddExpense: (expense: Partial<Expense>) => void;
  onSaveExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onSaveCaratula?: (caratula: Caratula) => Promise<void> | void;
  onSaveCalendarEvent?: (event: CalendarEvent) => Promise<void> | void;
  onDeleteCalendarEvent?: (id: string) => Promise<void> | void;
  currentUserName?: string;
  onNavigateToFinancial?: () => void;
}

export interface ShiftPaymentItem {
  id: string;
  folioGuardia: string;
  caratulaFolio: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tipoServicio: string;
  personalAsignado: string;
  staffId?: string;
  staffNoSocio?: string;
  costoHonorarios: number;
  honorarioPagado: boolean;
  pagoHonorarioId?: string;
  fechaPagoHonorario?: string;
  montoPagadoHonorario?: number;
  source: "caratula" | "calendar";
  calendarEventId?: string;
  notasTurno?: string;
}

export const StaffFeesTracker: React.FC<StaffFeesTrackerProps> = ({
  caratulas,
  services = [],
  expenses,
  staffMembers = [],
  calendarEvents = [],
  guardiaRecords = [],
  onAddExpense,
  onSaveExpense,
  onDeleteExpense,
  onSaveCaratula,
  onSaveCalendarEvent,
  onDeleteCalendarEvent,
  currentUserName,
  onNavigateToFinancial,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    "caratulas_con_adeudos" | "adeudos" | "pagos_realizados" | "resumen_caratulas"
  >("caratulas_con_adeudos");

  // Filter for Carátulas con Adeudos tab
  const [adeudosCaratulaSearch, setAdeudosCaratulaSearch] = useState("");
  // Track expanded cards in Tab 0 to view/manage shifts directly
  const [expandedCardFolios, setExpandedCardFolios] = useState<Record<string, boolean>>({});

  // Selection states for Tab 1: Carátula y Socio
  const [selectedCaratulaFolio, setSelectedCaratulaFolio] = useState<string>("");
  const [selectedStaffKey, setSelectedStaffKey] = useState<string>("ALL");

  // Quick edit for individual guardia honorario amount
  const [editingGuardiaAmounts, setEditingGuardiaAmounts] = useState<
    Record<string, number>
  >({});
  const [savingShiftId, setSavingShiftId] = useState<string | null>(null);

  // Pay single shift modal state
  const [payingShift, setPayingShift] = useState<ShiftPaymentItem | null>(null);
  const [payMonto, setPayMonto] = useState<number>(0);
  const [payMetodoPago, setPayMetodoPago] = useState<string>("Transferencia");
  const [payReferencia, setPayReferencia] = useState<string>("");
  const [payNotas, setPayNotas] = useState<string>("");
  const [payConcepto, setPayConcepto] = useState<string>("");

  // Delete payment confirmation modal state
  const [paymentToDelete, setPaymentToDelete] = useState<Expense | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // Shift Management State: View filter (Pending vs All)
  const [shiftsViewFilter, setShiftsViewFilter] = useState<"pending" | "all">("pending");

  // Edit Scheduled Shift Modal state
  const [editingShift, setEditingShift] = useState<ShiftPaymentItem | null>(null);
  const [editShiftForm, setEditShiftForm] = useState<{
    fecha: string;
    horaInicio: string;
    horaFin: string;
    personalAsignado: string;
    staffId?: string;
    staffNoSocio?: string;
    tipoServicio: string;
    costoHonorarios: number;
    notasTurno: string;
  }>({
    fecha: "",
    horaInicio: "08:00",
    horaFin: "20:00",
    personalAsignado: "",
    tipoServicio: "Guardia Asignada",
    costoHonorarios: 600,
    notasTurno: "",
  });
  const [isSavingShift, setIsSavingShift] = useState(false);

  // Delete Scheduled Shift Confirmation Modal state
  const [shiftToDelete, setShiftToDelete] = useState<ShiftPaymentItem | null>(null);
  const [isDeletingShift, setIsDeletingShift] = useState(false);

  // Historial tab filters
  const [historialSearch, setHistorialSearch] = useState("");
  const [historialCaratulaFilter, setHistorialCaratulaFilter] = useState("ALL");
  const [historialStaffFilter, setHistorialStaffFilter] = useState("ALL");

  // Resumen Carátulas tab search & status filter
  const [resumenSearch, setResumenSearch] = useState("");
  const [resumenStatusFilter, setResumenStatusFilter] = useState<
    "ALL" | "PENDING" | "PARTIAL" | "PAID"
  >("ALL");

  // Edit Caratula Honorarios Budget Modal state (legacy/general budget modal)
  const [editingCaratula, setEditingCaratula] = useState<Caratula | null>(null);
  const [editTotalHonorarios, setEditTotalHonorarios] = useState<number>(0);
  const [editServiceLines, setEditServiceLines] = useState<CaratulaServiceLine[]>([]);
  const [editGuardiasShifts, setEditGuardiasShifts] = useState<ScheduledShiftItem[]>([]);
  const [editNotasHonorarios, setEditNotasHonorarios] = useState("");
  const [editIsLiquidado, setEditIsLiquidado] = useState(false);
  const [isSavingCaratula, setIsSavingCaratula] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "info" | "error";
  } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Helper strings normalizer
  const norm = (s?: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const digits = (s?: string) => (s || "").replace(/\D/g, "");

  // Matcher for a staff member against a target
  const isStaffMatch = (
    targetStaff: StaffMember | undefined,
    targetName: string,
    targetKey: string,
    sId?: string,
    sNoSocio?: string,
    sName?: string
  ) => {
    const targetTokens = [
      targetKey.toLowerCase().trim(),
      digits(targetKey),
      targetStaff?.id?.toLowerCase().trim(),
      targetStaff?.noSocio?.toLowerCase().trim(),
      digits(targetStaff?.noSocio),
      norm(targetStaff?.nombre),
      norm(targetStaff?.apellidos),
      norm(`${targetStaff?.nombre || ""} ${targetStaff?.apellidos || ""}`),
      norm(targetName),
    ].filter((t): t is string => Boolean(t && t.length >= 2));

    if (sId && targetTokens.includes(sId.toLowerCase().trim())) return true;
    if (
      sNoSocio &&
      (targetTokens.includes(sNoSocio.toLowerCase().trim()) ||
        (digits(sNoSocio) && targetTokens.includes(digits(sNoSocio))))
    )
      return true;

    const n = norm(sName);
    if (!n) return false;
    return targetTokens.some((t) => n.includes(t) || t.includes(n));
  };

  // Helper: check if a shift is already paid
  const checkIsShiftPaid = (
    shift: {
      id?: string;
      folioGuardia?: string;
      honorarioPagado?: boolean;
      pagoHonorarioId?: string;
    },
    caratulaFolio: string,
    expensesList: Expense[]
  ): boolean => {
    // 1. Explicitly marked as paid in shift model
    if (shift.honorarioPagado) return true;

    // 2. Has a valid pagoHonorarioId matching an active expense
    if (shift.pagoHonorarioId) {
      const matchingExp = expensesList.find(
        (e) => e.id === shift.pagoHonorarioId && e.estado !== "Cancelado"
      );
      if (matchingExp) return true;
    }

    // 3. Matched by expense guardiaId or folioGuardia
    const targetId = (shift.folioGuardia || shift.id || "").trim();
    if (targetId) {
      const folioClean = (caratulaFolio || "").trim().toUpperCase();
      const hasLinkedExpense = expensesList.some((e) => {
        if (e.categoria !== "Honorarios Enfermería") return false;
        if (e.estado === "Cancelado") return false;
        if ((e.caratulaFolio || "").trim().toUpperCase() !== folioClean) return false;
        return (
          (e.guardiaId && e.guardiaId.trim().toUpperCase() === targetId.toUpperCase()) ||
          (e.folioGuardia && e.folioGuardia.trim().toUpperCase() === targetId.toUpperCase()) ||
          (e.concepto && e.concepto.toUpperCase().includes(targetId.toUpperCase()))
        );
      });
      if (hasLinkedExpense) return true;
    }

    return false;
  };

  // Find linked expense for a shift
  const findLinkedExpenseForShift = (
    shift: {
      id?: string;
      folioGuardia?: string;
      pagoHonorarioId?: string;
    },
    caratulaFolio: string
  ): Expense | undefined => {
    if (shift.pagoHonorarioId) {
      const found = expenses.find(
        (e) => e.id === shift.pagoHonorarioId && e.estado !== "Cancelado"
      );
      if (found) return found;
    }
    const targetId = (shift.folioGuardia || shift.id || "").trim();
    if (targetId) {
      const folioClean = (caratulaFolio || "").trim().toUpperCase();
      return expenses.find((e) => {
        if (e.categoria !== "Honorarios Enfermería") return false;
        if (e.estado === "Cancelado") return false;
        if ((e.caratulaFolio || "").trim().toUpperCase() !== folioClean) return false;
        return (
          (e.guardiaId && e.guardiaId.trim().toUpperCase() === targetId.toUpperCase()) ||
          (e.folioGuardia && e.folioGuardia.trim().toUpperCase() === targetId.toUpperCase()) ||
          (e.concepto && e.concepto.toUpperCase().includes(targetId.toUpperCase()))
        );
      });
    }
    return undefined;
  };

  // Helper to get linked staff for a carátula
  const getLinkedStaffForCaratula = (c: Caratula) => {
    const staffMap = new Map<
      string,
      {
        staff?: StaffMember;
        nombre: string;
        noSocio?: string;
        roles: string[];
        key: string;
      }
    >();

    // 1. From caratula.guardiasProgramadas (strictly for this carátula)
    if (Array.isArray(c.guardiasProgramadas)) {
      c.guardiasProgramadas
        .filter((gp) => !gp.caratulaFolio || gp.caratulaFolio.trim().toUpperCase() === c.folio.trim().toUpperCase())
        .forEach((gp) => {
        const name = (gp.personalAsignado || "").trim();
        const sId = gp.staffId;
        const sNo = gp.staffNoSocio;
        if (name || sId || sNo) {
          const found = (staffMembers || []).find(
            (s) =>
              (sId && s.id === sId) ||
              (sNo && s.noSocio === sNo) ||
              (name && `${s.nombre} ${s.apellidos}`.toLowerCase().includes(name.toLowerCase()))
          );
          const key = found?.id || sId || sNo || name;
          const entry = staffMap.get(key) || {
            key,
            staff: found,
            nombre: found ? `${found.nombre} ${found.apellidos}` : name || "Personal",
            noSocio: found?.noSocio || sNo,
            roles: [],
          };
          if (!entry.staff && found) entry.staff = found;
          const roleDesc = gp.tipoServicio || gp.preset || "Guardia Programada";
          if (!entry.roles.includes(roleDesc)) entry.roles.push(roleDesc);
          staffMap.set(key, entry);
        }
      });
    }

    // 2. From calendarEvents (strictly for this carátula folio only)
    if (Array.isArray(calendarEvents)) {
      calendarEvents
        .filter(
          (ev) =>
            Boolean(ev.caratulaFolio && ev.caratulaFolio.trim().toUpperCase() === c.folio.trim().toUpperCase())
        )
        .forEach((ev) => {
          const name = (ev.personalAsignado || "").trim();
          const sId = ev.staffId;
          const sNo = ev.staffNoSocio;
          if (name || sId || sNo) {
            const found = (staffMembers || []).find(
              (s) =>
                (sId && s.id === sId) ||
                (sNo && s.noSocio === sNo) ||
                (name && `${s.nombre} ${s.apellidos}`.toLowerCase().includes(name.toLowerCase()))
            );
            const key = found?.id || sId || sNo || name;
            const entry = staffMap.get(key) || {
              key,
              staff: found,
              nombre: found ? `${found.nombre} ${found.apellidos}` : name || "Personal",
              noSocio: found?.noSocio || sNo,
              roles: [],
            };
            if (!entry.staff && found) entry.staff = found;
            const roleDesc = ev.tipoServicio || "Agenda";
            if (!entry.roles.includes(roleDesc)) entry.roles.push(roleDesc);
            staffMap.set(key, entry);
          }
        });
    }

    return Array.from(staffMap.values());
  };

  // Selected Caratula Object
  const selectedCaratula = useMemo(() => {
    if (!selectedCaratulaFolio) return null;
    return caratulas.find((c) => c.folio === selectedCaratulaFolio) || null;
  }, [caratulas, selectedCaratulaFolio]);

  // List of staff linked to selected carátula
  const staffListForSelectedCaratula = useMemo(() => {
    if (!selectedCaratula) return [];
    return getLinkedStaffForCaratula(selectedCaratula);
  }, [selectedCaratula, staffMembers, calendarEvents]);

  // Auto-select first carátula if none selected
  useEffect(() => {
    if (!selectedCaratulaFolio && caratulas.length > 0) {
      // Prioritize carátulas with guardiasProgramadas that have pending/unpaid shifts
      const withGuardias = caratulas.find(
        (c) =>
          Array.isArray(c.guardiasProgramadas) &&
          c.guardiasProgramadas.length > 0 &&
          (!c.honorariosLiquidados || c.guardiasProgramadas.some((g) => !g.honorarioPagado))
      );
      if (withGuardias) {
        setSelectedCaratulaFolio(withGuardias.folio);
      } else {
        setSelectedCaratulaFolio(caratulas[0].folio);
      }
    }
  }, [caratulas, selectedCaratulaFolio]);

  // Auto-select first staff for the selected carátula or default to ALL
  useEffect(() => {
    if (staffListForSelectedCaratula.length > 0) {
      const exists = staffListForSelectedCaratula.some(
        (s) => s.key === selectedStaffKey
      );
      if (!exists && selectedStaffKey !== "ALL") {
        setSelectedStaffKey("ALL");
      }
    } else {
      setSelectedStaffKey("ALL");
    }
  }, [staffListForSelectedCaratula, selectedStaffKey]);

  // Selected Staff Object & Details
  const selectedStaffInfo = useMemo(() => {
    if (!selectedStaffKey || selectedStaffKey === "ALL") return null;
    const foundInLinked = staffListForSelectedCaratula.find(
      (s) => s.key === selectedStaffKey
    );
    if (foundInLinked) return foundInLinked;

    const sm = staffMembers.find(
      (s) =>
        s.id === selectedStaffKey ||
        s.noSocio === selectedStaffKey ||
        `${s.nombre} ${s.apellidos}` === selectedStaffKey
    );
    if (sm) {
      return {
        key: sm.id,
        staff: sm,
        nombre: `${sm.nombre} ${sm.apellidos}`,
        noSocio: sm.noSocio,
        roles: [sm.puestoTipoPersonal || "Personal Clínico"],
      };
    }
    return null;
  }, [selectedStaffKey, staffListForSelectedCaratula, staffMembers]);

  // Unified builder of all shifts for ANY given Carátula
  const buildShiftsForCaratula = useCallback(
    (c: Caratula): ShiftPaymentItem[] => {
      if (!c) return [];
      const rawShifts: ShiftPaymentItem[] = [];

      // 1. From c.guardiasProgramadas - STRICTLY for this carátula
      (c.guardiasProgramadas || []).forEach((g) => {
        if (g.caratulaFolio && g.caratulaFolio.trim().toUpperCase() !== c.folio.trim().toUpperCase()) {
          return;
        }

        let cost =
          typeof g.costoHonorarios === "number" && g.costoHonorarios >= 0
            ? g.costoHonorarios
            : 0;

        if (cost === 0 && Array.isArray(c.servicios)) {
          const matchServ =
            c.servicios.find((s) => s.servicio === g.tipoServicio) || c.servicios[0];
          if (matchServ) {
            cost = getServiceUnitCost(matchServ, services);
          }
        }

        const isPaid = checkIsShiftPaid(g, c.folio, expenses);
        const linkedExp = isPaid ? findLinkedExpenseForShift(g, c.folio) : undefined;

        const matchedStaff = (staffMembers || []).find(
          (sm) =>
            (g.staffId && sm.id === g.staffId) ||
            (g.staffNoSocio && sm.noSocio === g.staffNoSocio) ||
            (g.personalAsignado && `${sm.nombre} ${sm.apellidos}`.toLowerCase().includes(g.personalAsignado.toLowerCase()))
        );

        const resolvedFolio = g.folioGuardia || g.id || `shift-${g.fecha}-${g.horaInicio || "08:00"}`;

        rawShifts.push({
          id: g.id || resolvedFolio,
          folioGuardia: resolvedFolio,
          caratulaFolio: c.folio,
          fecha: g.fecha || "",
          horaInicio: g.horaInicio || "08:00",
          horaFin: g.horaFin || "20:00",
          tipoServicio: g.tipoServicio || "Guardia Asignada",
          personalAsignado: g.personalAsignado || (matchedStaff ? `${matchedStaff.nombre} ${matchedStaff.apellidos}` : "Personal Asignado"),
          staffId: g.staffId || matchedStaff?.id,
          staffNoSocio: g.staffNoSocio || matchedStaff?.noSocio,
          costoHonorarios: cost,
          honorarioPagado: isPaid,
          pagoHonorarioId: g.pagoHonorarioId || linkedExp?.id,
          fechaPagoHonorario: g.fechaPagoHonorario || linkedExp?.timestamp,
          montoPagadoHonorario: g.montoPagadoHonorario || linkedExp?.monto || (isPaid ? cost : 0),
          source: "caratula",
          notasTurno: g.notasTurno || "",
        });
      });

      // 2. From calendarEvents - STRICTLY for this carátula folio only
      calendarEvents.forEach((ev) => {
        const matchesCaratula = Boolean(
          ev.caratulaFolio &&
          ev.caratulaFolio.trim().toUpperCase() === c.folio.trim().toUpperCase()
        );
        if (!matchesCaratula) return;

        const date = ev.fechaInicio ? ev.fechaInicio.split("T")[0] : "";
        const horaI = ev.fechaInicio
          ? ev.fechaInicio.split("T")[1]?.slice(0, 5) || "08:00"
          : "08:00";
        const horaF = ev.fechaFin
          ? ev.fechaFin.split("T")[1]?.slice(0, 5) || "20:00"
          : "20:00";

        let cost =
          typeof ev.costoHonorarios === "number" && ev.costoHonorarios >= 0
            ? ev.costoHonorarios
            : 0;

        if (cost === 0 && Array.isArray(c.servicios)) {
          const matchServ =
            c.servicios.find((s) => s.servicio === ev.tipoServicio) || c.servicios[0];
          if (matchServ) {
            cost = getServiceUnitCost(matchServ, services);
          }
        }

        const existingIdx = rawShifts.findIndex((s) => isSameGuardia(s, ev));
        const isPaid = (existingIdx >= 0 && rawShifts[existingIdx].honorarioPagado) || checkIsShiftPaid(ev, c.folio, expenses);
        const linkedExp = isPaid ? findLinkedExpenseForShift(ev, c.folio) : undefined;

        const matchedStaff = (staffMembers || []).find(
          (sm) =>
            (ev.staffId && sm.id === ev.staffId) ||
            (ev.staffNoSocio && sm.noSocio === ev.staffNoSocio) ||
            (ev.personalAsignado && `${sm.nombre} ${sm.apellidos}`.toLowerCase().includes(ev.personalAsignado.toLowerCase()))
        );

        const resolvedFolio =
          (ev.folioGuardia && isValidGuardiaFolio(ev.folioGuardia))
            ? ev.folioGuardia
            : existingIdx >= 0 && isValidGuardiaFolio(rawShifts[existingIdx].folioGuardia)
            ? rawShifts[existingIdx].folioGuardia
            : ev.folioGuardia || ev.id;

        if (existingIdx >= 0) {
          const existing = rawShifts[existingIdx];
          rawShifts[existingIdx] = {
            ...existing,
            folioGuardia: resolvedFolio,
            tipoServicio: ev.tipoServicio || existing.tipoServicio,
            personalAsignado: existing.personalAsignado || ev.personalAsignado || (matchedStaff ? `${matchedStaff.nombre} ${matchedStaff.apellidos}` : "Personal Asignado"),
            staffId: existing.staffId || ev.staffId || matchedStaff?.id,
            staffNoSocio: existing.staffNoSocio || ev.staffNoSocio || matchedStaff?.noSocio,
            costoHonorarios: existing.costoHonorarios > 0 ? existing.costoHonorarios : cost,
            honorarioPagado: isPaid,
            pagoHonorarioId: existing.pagoHonorarioId || ev.pagoHonorarioId || linkedExp?.id,
            fechaPagoHonorario: existing.fechaPagoHonorario || ev.fechaPagoHonorario || linkedExp?.timestamp,
            montoPagadoHonorario:
              existing.montoPagadoHonorario ||
              ev.montoPagadoHonorario ||
              linkedExp?.monto ||
              (isPaid ? (existing.costoHonorarios > 0 ? existing.costoHonorarios : cost) : 0),
            calendarEventId: ev.id,
            notasTurno: existing.notasTurno || ev.notas || (ev as any).notasInicio || "",
          };
        } else {
          rawShifts.push({
            id: ev.id,
            folioGuardia: resolvedFolio,
            caratulaFolio: c.folio,
            fecha: date,
            horaInicio: horaI,
            horaFin: horaF,
            tipoServicio: ev.tipoServicio || "Guardia Asignada",
            personalAsignado: ev.personalAsignado || (matchedStaff ? `${matchedStaff.nombre} ${matchedStaff.apellidos}` : "Personal Asignado"),
            staffId: ev.staffId || matchedStaff?.id,
            staffNoSocio: ev.staffNoSocio || matchedStaff?.noSocio,
            costoHonorarios: cost,
            honorarioPagado: isPaid,
            pagoHonorarioId: ev.pagoHonorarioId || linkedExp?.id,
            fechaPagoHonorario: ev.fechaPagoHonorario || linkedExp?.timestamp,
            montoPagadoHonorario: ev.montoPagadoHonorario || linkedExp?.monto || (isPaid ? cost : 0),
            source: "calendar",
            calendarEventId: ev.id,
            notasTurno: ev.notas || (ev as any).notasInicio || "",
          });
        }
      });

      return deduplicateShiftsList(rawShifts).sort((a, b) =>
        a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)
      );
    },
    [calendarEvents, expenses, services, staffMembers]
  );

  // Unified list of all shifts for the selected Carátula and Socio
  const {
    allShiftsForSocio,
    pendingAdeudosForSocio,
    paidShiftsForSocio,
    socioTotalAsignado,
    socioTotalPagado,
    socioTotalPendiente,
  } = useMemo(() => {
    if (!selectedCaratula) {
      return {
        allShiftsForSocio: [],
        pendingAdeudosForSocio: [],
        paidShiftsForSocio: [],
        socioTotalAsignado: 0,
        socioTotalPagado: 0,
        socioTotalPendiente: 0,
      };
    }

    const isAllStaff = selectedStaffKey === "ALL" || !selectedStaffKey;
    const targetStaff = selectedStaffInfo?.staff;
    const targetName = selectedStaffInfo?.nombre;
    const targetKey = selectedStaffInfo?.key;

    const consolidated = buildShiftsForCaratula(selectedCaratula);

    // Filter by socio if selected
    const filtered = isAllStaff
      ? consolidated
      : consolidated.filter((shift) => {
          if (!targetName && !targetKey) return true;
          return isStaffMatch(
            targetStaff,
            targetName,
            targetKey,
            shift.staffId,
            shift.staffNoSocio,
            shift.personalAsignado
          );
        });

    const all = filtered.sort((a, b) =>
      a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)
    );

    const pending = all.filter((s) => !s.honorarioPagado);
    const paid = all.filter((s) => s.honorarioPagado);

    const totalAsignado = all.reduce((sum, s) => sum + s.costoHonorarios, 0);
    const totalPagado = paid.reduce(
      (sum, s) => sum + (s.montoPagadoHonorario || s.costoHonorarios),
      0
    );
    const totalPendiente = Math.max(0, totalAsignado - totalPagado);

    return {
      allShiftsForSocio: all,
      pendingAdeudosForSocio: pending,
      paidShiftsForSocio: paid,
      socioTotalAsignado: totalAsignado,
      socioTotalPagado: totalPagado,
      socioTotalPendiente: totalPendiente,
    };
  }, [
    selectedCaratula,
    selectedStaffInfo,
    selectedStaffKey,
    buildShiftsForCaratula,
  ]);

  // Global summary across all carátulas and expenses
  const globalSummary = calculateGlobalFinancialSummary(
    caratulas,
    services,
    expenses,
    [],
    calendarEvents
  );
  const feesReport: CaratulaCostStats[] = globalSummary.caratulaStatsList;
  const totalEstimadoGlobal = globalSummary.totalHonorariosPresupuestados;
  const totalPagadoGlobal = globalSummary.totalHonorariosPagados;
  const totalPendienteGlobal = globalSummary.totalHonorariosPendientes;

  // List of all paid honorarios expenses (Historial)
  const paidHonorariosExpenses = useMemo(() => {
    return expenses
      .filter((e) => e.categoria === "Honorarios Enfermería" && e.estado !== "Cancelado")
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, [expenses]);

  // Filtered paid honorarios for Tab 2
  const filteredPaidExpenses = useMemo(() => {
    return paidHonorariosExpenses.filter((e) => {
      const matchesSearch =
        historialSearch === "" ||
        e.concepto.toLowerCase().includes(historialSearch.toLowerCase()) ||
        (e.caratulaFolio && e.caratulaFolio.toLowerCase().includes(historialSearch.toLowerCase())) ||
        (e.staffNombre && e.staffNombre.toLowerCase().includes(historialSearch.toLowerCase())) ||
        (e.folioGuardia && e.folioGuardia.toLowerCase().includes(historialSearch.toLowerCase())) ||
        (e.notas && e.notas.toLowerCase().includes(historialSearch.toLowerCase()));

      const matchesCaratula =
        historialCaratulaFilter === "ALL" ||
        e.caratulaFolio === historialCaratulaFilter;

      const matchesStaff =
        historialStaffFilter === "ALL" ||
        e.staffId === historialStaffFilter ||
        e.staffNoSocio === historialStaffFilter ||
        (e.staffNombre &&
          e.staffNombre.toLowerCase().includes(historialStaffFilter.toLowerCase()));

      return matchesSearch && matchesCaratula && matchesStaff;
    });
  }, [
    paidHonorariosExpenses,
    historialSearch,
    historialCaratulaFilter,
    historialStaffFilter,
  ]);

  // Filtered Carátulas Report for Tab 3
  const filteredCaratulasReport = useMemo(() => {
    return feesReport.filter((r) => {
      const linked = getLinkedStaffForCaratula(r.caratula);
      const staffNames = linked
        .map(
          (l) =>
            `${l.nombre} ${l.staff?.banco || ""} ${l.staff?.clabeInterbancaria || ""}`
        )
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        resumenSearch === "" ||
        r.folio.toLowerCase().includes(resumenSearch.toLowerCase()) ||
        r.clienteNombre.toLowerCase().includes(resumenSearch.toLowerCase()) ||
        r.receptorNombre.toLowerCase().includes(resumenSearch.toLowerCase()) ||
        staffNames.includes(resumenSearch.toLowerCase());

      const matchesStatus =
        resumenStatusFilter === "ALL" ||
        (resumenStatusFilter === "PENDING" && r.status === "PENDING") ||
        (resumenStatusFilter === "PARTIAL" && r.status === "PARTIAL") ||
        (resumenStatusFilter === "PAID" && r.status === "PAID");

      return matchesSearch && matchesStatus;
    });
  }, [feesReport, resumenSearch, resumenStatusFilter]);

  // List of all carátulas that currently have pending honorarios
  const caratulasConAdeudoList = useMemo(() => {
    return feesReport.filter((r) => {
      // 1. If there are unpaid shifts, it MUST be included as having an adeudo!
      if (r.unpaidShiftsCount !== undefined && r.unpaidShiftsCount > 0) return true;

      // 2. Check if monetary debt remains
      if (r.honorariosPendientes > 0) return true;

      // 3. Or if status is not PAID and has shifts or services
      if (
        r.status !== "PAID" &&
        ((r.totalShiftsCount !== undefined && r.totalShiftsCount > 0) ||
          (Array.isArray(r.caratula.servicios) && r.caratula.servicios.length > 0))
      ) {
        return true;
      }

      // If manually liquidated AND has 0 unpaid shifts and no monetary debt, then settled
      if (
        r.caratula.honorariosLiquidados === true &&
        (r.unpaidShiftsCount === 0 || r.unpaidShiftsCount === undefined) &&
        r.honorariosPendientes <= 0
      ) {
        return false;
      }

      return false;
    });
  }, [feesReport]);

  const filteredCaratulasConAdeudo = useMemo(() => {
    if (!adeudosCaratulaSearch.trim()) return caratulasConAdeudoList;
    const q = adeudosCaratulaSearch.toLowerCase().trim();
    return caratulasConAdeudoList.filter((r) => {
      const linked = getLinkedStaffForCaratula(r.caratula);
      const staffText = linked.map((l) => l.nombre).join(" ").toLowerCase();
      return (
        r.folio.toLowerCase().includes(q) ||
        r.clienteNombre.toLowerCase().includes(q) ||
        r.receptorNombre.toLowerCase().includes(q) ||
        staffText.includes(q)
      );
    });
  }, [caratulasConAdeudoList, adeudosCaratulaSearch]);

  // Handler: Modify individual guardia payment amount
  const handleSaveIndividualShiftCost = async (
    shift: ShiftPaymentItem,
    newCost: number
  ) => {
    if (!selectedCaratula || newCost < 0) return;
    try {
      setSavingShiftId(shift.id);

      // 1. Update in caratula.guardiasProgramadas
      const existingShifts = selectedCaratula.guardiasProgramadas || [];
      const shiftIdx = existingShifts.findIndex((s) => isSameGuardia(s, shift));

      const updatedShifts = [...existingShifts];
      if (shiftIdx >= 0) {
        updatedShifts[shiftIdx] = {
          ...updatedShifts[shiftIdx],
          costoHonorarios: newCost,
        };
      } else {
        updatedShifts.push({
          id: shift.folioGuardia || shift.id,
          folioGuardia: shift.folioGuardia || shift.id,
          fecha: shift.fecha,
          horaInicio: shift.horaInicio,
          horaFin: shift.horaFin,
          fechaFinCalculada: shift.fecha,
          preset: "12h_dia",
          tipoServicio: shift.tipoServicio,
          personalAsignado: shift.personalAsignado,
          staffId: shift.staffId,
          staffNoSocio: shift.staffNoSocio,
          costoHonorarios: newCost,
        });
      }

      const sanitizedShifts = deduplicateShiftsList(updatedShifts);

      if (onSaveCaratula) {
        await onSaveCaratula({
          ...selectedCaratula,
          guardiasProgramadas: sanitizedShifts,
        });
      }

      // 2. Update in calendarEvents if linked
      if (onSaveCalendarEvent && Array.isArray(calendarEvents)) {
        const matchingEv = calendarEvents.find(
          (ev) =>
            (shift.folioGuardia && ev.folioGuardia === shift.folioGuardia) ||
            ev.id === shift.id ||
            (shift.calendarEventId && ev.id === shift.calendarEventId)
        );
        if (matchingEv) {
          await onSaveCalendarEvent({
            ...matchingEv,
            costoHonorarios: newCost,
          });
        }
      }

      // Clear local edit buffer for this shift
      setEditingGuardiaAmounts((prev) => {
        const next = { ...prev };
        delete next[shift.id];
        return next;
      });

      setToastMessage({
        text: `Monto de guardia ${shift.folioGuardia || shift.id} actualizado a ${formatCurrency(newCost)}.`,
        type: "success",
      });
    } catch (err) {
      console.error("Error actualizando monto de guardia:", err);
      setToastMessage({
        text: "Error al actualizar el monto de la guardia.",
        type: "error",
      });
    } finally {
      setSavingShiftId(null);
    }
  };

  // Open Pay Modal for a single guardia
  const handleOpenPayShiftModal = (shift: ShiftPaymentItem) => {
    setPayingShift(shift);
    const amount =
      editingGuardiaAmounts[shift.id] !== undefined
        ? editingGuardiaAmounts[shift.id]
        : shift.costoHonorarios;
    setPayMonto(amount);
    setPayMetodoPago("Transferencia");
    setPayReferencia("");

    const staffObj =
      selectedStaffInfo?.staff ||
      (staffMembers || []).find(
        (sm) =>
          (shift.staffId && sm.id === shift.staffId) ||
          (shift.staffNoSocio && sm.noSocio === shift.staffNoSocio) ||
          (shift.personalAsignado &&
            `${sm.nombre} ${sm.apellidos}`.toLowerCase().includes(shift.personalAsignado.toLowerCase()))
      );
    const staffTitle =
      selectedStaffInfo?.nombre ||
      (staffObj ? `${staffObj.nombre} ${staffObj.apellidos}` : shift.personalAsignado);
    const bankInfo = staffObj?.banco
      ? `Banco: ${staffObj.banco} | CLABE: ${staffObj.clabeInterbancaria || "N/A"} | Titular: ${staffObj.titularCuenta || staffTitle}`
      : "Sin datos bancarios registrados";

    setPayNotas(bankInfo);
    setPayConcepto(
      `Pago Honorarios Guardia ${shift.folioGuardia || shift.id} (${shift.fecha} ${shift.tipoServicio}) - Enf. ${staffTitle} - Folio ${selectedCaratula?.folio}`
    );
  };

  // Confirm payment of a guardia
  const handleConfirmPayShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingShift || !selectedCaratula || payMonto <= 0) return;

    try {
      const targetStaff =
        selectedStaffInfo?.staff ||
        (staffMembers || []).find(
          (sm) =>
            (payingShift.staffId && sm.id === payingShift.staffId) ||
            (payingShift.staffNoSocio && sm.noSocio === payingShift.staffNoSocio) ||
            (payingShift.personalAsignado &&
              `${sm.nombre} ${sm.apellidos}`.toLowerCase().includes(payingShift.personalAsignado.toLowerCase()))
        );
      const staffName =
        selectedStaffInfo?.nombre ||
        (targetStaff ? `${targetStaff.nombre} ${targetStaff.apellidos}` : payingShift.personalAsignado);
      const staffNoSocio =
        selectedStaffInfo?.noSocio || payingShift.staffNoSocio || targetStaff?.noSocio;
      const staffId = targetStaff?.id || payingShift.staffId;

      const newExpenseId = `EXP-${Date.now().toString().slice(-6)}`;
      const timestampNow = new Date().toLocaleString();

      const newExpense: Partial<Expense> = {
        id: newExpenseId,
        caratulaFolio: selectedCaratula.folio,
        timestamp: timestampNow,
        concepto: payConcepto.trim(),
        monto: Number(payMonto),
        categoria: "Honorarios Enfermería",
        registradoPor: currentUserName || "Administración",
        notas: payNotas.trim(),
        estado: "Activo",
        guardiaId: payingShift.folioGuardia || payingShift.id,
        folioGuardia: payingShift.folioGuardia || payingShift.id,
        staffId: staffId,
        staffNoSocio: staffNoSocio,
        staffNombre: staffName,
        metodoPago: payMetodoPago,
        referenciaPago: payReferencia.trim(),
      };

      // 1. Create expense
      onAddExpense(newExpense);

      // 2. Mark guardia as paid in caratula.guardiasProgramadas
      const existingShifts = selectedCaratula.guardiasProgramadas || [];
      const shiftIdx = existingShifts.findIndex((s) => isSameGuardia(s, payingShift));

      const updatedShifts = [...existingShifts];
      if (shiftIdx >= 0) {
        updatedShifts[shiftIdx] = {
          ...updatedShifts[shiftIdx],
          folioGuardia: (payingShift.folioGuardia && isValidGuardiaFolio(payingShift.folioGuardia))
            ? payingShift.folioGuardia
            : updatedShifts[shiftIdx].folioGuardia || payingShift.folioGuardia,
          costoHonorarios: Number(payMonto),
          honorarioPagado: true,
          pagoHonorarioId: newExpenseId,
          fechaPagoHonorario: timestampNow,
          montoPagadoHonorario: Number(payMonto),
        };
      } else {
        updatedShifts.push({
          id: payingShift.folioGuardia || payingShift.id,
          folioGuardia: payingShift.folioGuardia || payingShift.id,
          fecha: payingShift.fecha,
          horaInicio: payingShift.horaInicio,
          horaFin: payingShift.horaFin,
          fechaFinCalculada: payingShift.fecha,
          preset: "12h_dia",
          tipoServicio: payingShift.tipoServicio,
          personalAsignado: staffName,
          staffId: staffId,
          staffNoSocio: staffNoSocio,
          costoHonorarios: Number(payMonto),
          honorarioPagado: true,
          pagoHonorarioId: newExpenseId,
          fechaPagoHonorario: timestampNow,
          montoPagadoHonorario: Number(payMonto),
        });
      }

      const sanitizedShifts = deduplicateShiftsList(updatedShifts);

      if (onSaveCaratula) {
        await onSaveCaratula({
          ...selectedCaratula,
          guardiasProgramadas: sanitizedShifts,
        });
      }

      // 3. Update calendarEvents
      if (onSaveCalendarEvent && Array.isArray(calendarEvents)) {
        const matchingEv = calendarEvents.find(
          (ev) =>
            (payingShift.folioGuardia && ev.folioGuardia === payingShift.folioGuardia) ||
            ev.id === payingShift.id ||
            (payingShift.calendarEventId && ev.id === payingShift.calendarEventId)
        );
        if (matchingEv) {
          await onSaveCalendarEvent({
            ...matchingEv,
            costoHonorarios: Number(payMonto),
            honorarioPagado: true,
            pagoHonorarioId: newExpenseId,
            fechaPagoHonorario: timestampNow,
            montoPagadoHonorario: Number(payMonto),
          });
        }
      }

      setPayingShift(null);
      setToastMessage({
        text: `✅ Pago de guardia ${payingShift.folioGuardia || payingShift.id} registrado por ${formatCurrency(payMonto)}. ¡Se descontó de los adeudos pendientes!`,
        type: "success",
      });
    } catch (err) {
      console.error("Error registrando pago de guardia:", err);
      setToastMessage({
        text: "Error al registrar el pago de la guardia.",
        type: "error",
      });
    }
  };

  // Delete payment / undo movement
  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete || !onDeleteExpense) return;

    try {
      setIsDeletingPayment(true);
      const exp = paymentToDelete;

      // 1. Delete expense from store
      onDeleteExpense(exp.id);

      // 2. Revert shift in caratula.guardiasProgramadas
      const targetCaratula = caratulas.find((c) => c.folio === exp.caratulaFolio);
      if (targetCaratula && onSaveCaratula) {
        const updatedShifts = (targetCaratula.guardiasProgramadas || []).map((s) => {
          const isMatch =
            s.pagoHonorarioId === exp.id ||
            (exp.guardiaId && (s.folioGuardia === exp.guardiaId || s.id === exp.guardiaId)) ||
            (exp.folioGuardia && (s.folioGuardia === exp.folioGuardia || s.id === exp.folioGuardia)) ||
            (s.folioGuardia && exp.concepto && exp.concepto.includes(s.folioGuardia));

          if (isMatch) {
            return {
              ...s,
              honorarioPagado: false,
              pagoHonorarioId: undefined,
              fechaPagoHonorario: undefined,
              montoPagadoHonorario: undefined,
            };
          }
          return s;
        });

        const sanitized = deduplicateShiftsList(updatedShifts);
        await onSaveCaratula({
          ...targetCaratula,
          guardiasProgramadas: sanitized,
        });
      }

      // 3. Revert calendarEvents
      if (onSaveCalendarEvent && Array.isArray(calendarEvents)) {
        const matchingEvs = calendarEvents.filter(
          (ev) =>
            ev.pagoHonorarioId === exp.id ||
            (exp.guardiaId && (ev.folioGuardia === exp.guardiaId || ev.id === exp.guardiaId)) ||
            (exp.folioGuardia && (ev.folioGuardia === exp.folioGuardia || ev.id === exp.folioGuardia)) ||
            (ev.folioGuardia && exp.concepto && exp.concepto.includes(ev.folioGuardia))
        );

        for (const ev of matchingEvs) {
          await onSaveCalendarEvent({
            ...ev,
            honorarioPagado: false,
            pagoHonorarioId: undefined,
            fechaPagoHonorario: undefined,
            montoPagadoHonorario: undefined,
          });
        }
      }

      setPaymentToDelete(null);
      setToastMessage({
        text: `🔄 Movimiento ${exp.id} eliminado. La guardia ha vuelto a la lista de adeudos pendientes.`,
        type: "info",
      });
    } catch (err) {
      console.error("Error eliminando movimiento de pago:", err);
      setToastMessage({
        text: "Error al eliminar el movimiento de pago.",
        type: "error",
      });
    } finally {
      setIsDeletingPayment(false);
    }
  };

  // Open Edit Scheduled Shift Modal
  const handleOpenEditShiftModal = (shift: ShiftPaymentItem) => {
    setEditingShift(shift);
    const matchingCaratulaShift = selectedCaratula?.guardiasProgramadas?.find((g) => isSameGuardia(g, shift));
    const matchingCalEvent = (calendarEvents || []).find((ev) => isSameGuardia(ev, shift));
    const existingNotes = matchingCaratulaShift?.notasTurno || matchingCalEvent?.notas || shift.notasTurno || "";

    setEditShiftForm({
      fecha: shift.fecha || new Date().toISOString().split("T")[0],
      horaInicio: shift.horaInicio || "08:00",
      horaFin: shift.horaFin || "20:00",
      personalAsignado: shift.personalAsignado || "",
      staffId: shift.staffId,
      staffNoSocio: shift.staffNoSocio,
      tipoServicio: shift.tipoServicio || "Guardia Asignada",
      costoHonorarios: shift.costoHonorarios || 600,
      notasTurno: existingNotes,
    });
  };

  // Save modified scheduled shift
  const handleSaveEditShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    try {
      setIsSavingShift(true);
      const {
        fecha,
        horaInicio,
        horaFin,
        personalAsignado,
        staffId,
        staffNoSocio,
        tipoServicio,
        costoHonorarios,
        notasTurno,
      } = editShiftForm;

      // Calculate overnight end date if applicable
      let fechaFinCalculada = fecha;
      if (horaFin <= horaInicio) {
        const d = new Date(fecha + "T00:00:00");
        d.setDate(d.getDate() + 1);
        fechaFinCalculada = d.toISOString().split("T")[0];
      }

      const cleanHoraInicio = horaInicio.length === 5 ? horaInicio : horaInicio.slice(0, 5);
      const cleanHoraFin = horaFin.length === 5 ? horaFin : horaFin.slice(0, 5);
      const startDateTime = `${fecha}T${cleanHoraInicio}`;
      const endDateTime = `${fechaFinCalculada}T${cleanHoraFin}`;

      const targetFolio = (editingShift.caratulaFolio || selectedCaratula?.folio || "").trim().toUpperCase();
      const targetCaratula =
        (selectedCaratula && (selectedCaratula.folio || "").trim().toUpperCase() === targetFolio ? selectedCaratula : null) ||
        caratulas.find((c) => (c.folio || "").trim().toUpperCase() === targetFolio) ||
        selectedCaratula;

      if (!targetCaratula) {
        throw new Error("No se encontró la carátula vinculada para guardar la modificación.");
      }

      // 1. Update in Caratula.guardiasProgramadas
      const existingProgramadas = targetCaratula.guardiasProgramadas || [];
      const shiftIdx = existingProgramadas.findIndex((s) => isSameGuardia(s, editingShift));

      let updatedProgramadas: ScheduledShiftItem[];
      if (shiftIdx >= 0) {
        updatedProgramadas = [...existingProgramadas];
        updatedProgramadas[shiftIdx] = {
          ...updatedProgramadas[shiftIdx],
          fecha,
          horaInicio: cleanHoraInicio,
          horaFin: cleanHoraFin,
          fechaFinCalculada,
          personalAsignado,
          staffId,
          staffNoSocio,
          tipoServicio,
          costoHonorarios: Number(costoHonorarios),
          notasTurno,
        };
      } else {
        updatedProgramadas = [
          ...existingProgramadas,
          {
            id: editingShift.folioGuardia || editingShift.id,
            folioGuardia: editingShift.folioGuardia || editingShift.id,
            caratulaFolio: targetCaratula.folio,
            fecha,
            horaInicio: cleanHoraInicio,
            horaFin: cleanHoraFin,
            fechaFinCalculada,
            preset: cleanHoraInicio >= "19:00" ? "12h_noche" : "12h_dia",
            tipoServicio,
            personalAsignado,
            staffId,
            staffNoSocio,
            costoHonorarios: Number(costoHonorarios),
            notasTurno,
          },
        ];
      }

      const updatedCaratula: Caratula = {
        ...targetCaratula,
        guardiasProgramadas: deduplicateShiftsList(updatedProgramadas),
        guardiasAgendadas: Math.max(0, updatedProgramadas.length),
      };

      if (onSaveCaratula) {
        await onSaveCaratula(updatedCaratula);
      }

      // 2. Update matching event(s) in Calendar
      const matchingEvents = (calendarEvents || []).filter((ev) =>
        (editingShift.calendarEventId && ev.id === editingShift.calendarEventId) ||
        (editingShift.folioGuardia && ev.folioGuardia === editingShift.folioGuardia) ||
        (editingShift.folioGuardia && ev.id === editingShift.folioGuardia) ||
        ev.id === editingShift.id ||
        ev.folioGuardia === editingShift.id ||
        isSameGuardia(ev, editingShift)
      );

      if (matchingEvents.length > 0) {
        for (const matchingEv of matchingEvents) {
          if (onSaveCalendarEvent) {
            const updatedEv: CalendarEvent = {
              ...matchingEv,
              caratulaFolio: targetCaratula.folio,
              fechaInicio: startDateTime,
              fechaFin: endDateTime,
              personalAsignado,
              staffId,
              staffNoSocio,
              tipoServicio,
              costoHonorarios: Number(costoHonorarios),
              titulo: `${tipoServicio} - ${targetCaratula.nombreCompletoCliente || targetCaratula.folio}`,
              notas: notasTurno || matchingEv.notas,
            };
            await onSaveCalendarEvent(updatedEv);
          }
        }
      } else if (onSaveCalendarEvent) {
        const newEv: CalendarEvent = {
          id: editingShift.folioGuardia || editingShift.id || `EVT-${Date.now()}`,
          folioGuardia: editingShift.folioGuardia || editingShift.id,
          clientId: targetCaratula.clienteId || (targetCaratula as any).id || "CLI-001",
          clientNombre: targetCaratula.nombreCompletoCliente,
          caratulaFolio: targetCaratula.folio,
          titulo: `${tipoServicio} - ${targetCaratula.nombreCompletoCliente || targetCaratula.folio}`,
          fechaInicio: startDateTime,
          fechaFin: endDateTime,
          personalAsignado,
          staffId,
          staffNoSocio,
          tipoServicio,
          costoHonorarios: Number(costoHonorarios),
          notas: notasTurno,
          estado: "Programado",
        };
        await onSaveCalendarEvent(newEv);
      }

      setToastMessage({
        text: `Guardia ${editingShift.folioGuardia || editingShift.id} modificada exitosamente en carátula y calendario.`,
        type: "success",
      });
      setEditingShift(null);
    } catch (err) {
      console.error("Error al modificar guardia:", err);
      setToastMessage({
        text: "Error al guardar la modificación de la guardia.",
        type: "error",
      });
    } finally {
      setIsSavingShift(false);
    }
  };

  // Open Delete Scheduled Shift Modal
  const handleOpenDeleteShiftModal = (shift: ShiftPaymentItem) => {
    setShiftToDelete(shift);
  };

  // Confirm delete scheduled shift
  const handleConfirmDeleteShift = async () => {
    if (!shiftToDelete) return;

    try {
      setIsDeletingShift(true);
      const targetFolio = (shiftToDelete.caratulaFolio || selectedCaratula?.folio || "").trim().toUpperCase();
      const targetCaratula =
        (selectedCaratula && (selectedCaratula.folio || "").trim().toUpperCase() === targetFolio ? selectedCaratula : null) ||
        caratulas.find((c) => (c.folio || "").trim().toUpperCase() === targetFolio) ||
        selectedCaratula;

      if (targetCaratula) {
        // 1. Remove from Caratula.guardiasProgramadas
        const currentProgramadas = targetCaratula.guardiasProgramadas || [];
        const remainingProgramadas = currentProgramadas.filter(
          (s) => !isSameGuardia(s, shiftToDelete)
        );

        const updatedCaratula: Caratula = {
          ...targetCaratula,
          guardiasProgramadas: remainingProgramadas,
          guardiasAgendadas: Math.max(0, remainingProgramadas.length),
        };

        if (onSaveCaratula) {
          await onSaveCaratula(updatedCaratula);
        }
      }

      // 2. Remove from Calendar Events
      const matchingEvents = (calendarEvents || []).filter((ev) =>
        (shiftToDelete.calendarEventId && ev.id === shiftToDelete.calendarEventId) ||
        (shiftToDelete.folioGuardia && ev.folioGuardia === shiftToDelete.folioGuardia) ||
        (shiftToDelete.folioGuardia && ev.id === shiftToDelete.folioGuardia) ||
        ev.id === shiftToDelete.id ||
        ev.folioGuardia === shiftToDelete.id ||
        isSameGuardia(ev, shiftToDelete)
      );

      if (matchingEvents.length > 0) {
        for (const ev of matchingEvents) {
          if (onDeleteCalendarEvent) {
            await onDeleteCalendarEvent(ev.id);
          } else {
            await deleteCalendarEventFromFirestore(ev.id);
          }
        }
      } else {
        const fallbackId = shiftToDelete.calendarEventId || shiftToDelete.folioGuardia || shiftToDelete.id;
        if (fallbackId) {
          if (onDeleteCalendarEvent) {
            await onDeleteCalendarEvent(fallbackId);
          } else {
            await deleteCalendarEventFromFirestore(fallbackId);
          }
        }
      }

      setToastMessage({
        text: `Guardia ${shiftToDelete.folioGuardia || shiftToDelete.id} eliminada de la carátula y del calendario.`,
        type: "success",
      });
      setShiftToDelete(null);
    } catch (err) {
      console.error("Error al eliminar guardia:", err);
      setToastMessage({
        text: "Error al eliminar la guardia.",
        type: "error",
      });
    } finally {
      setIsDeletingShift(false);
    }
  };

  // Open Edit Caratula Honorarios Modal (for general budget edit)
  const handleOpenEditModal = (item: CaratulaCostStats) => {
    const c = item.caratula;
    setEditingCaratula(c);

    const numShifts = (c.guardiasProgramadas || []).length;
    let initialBudget = item.costoPresupuestado;
    if (initialBudget <= 0 && numShifts > 0) {
      initialBudget = numShifts * 600;
    } else if (initialBudget <= 0 && c.total && c.total > 0) {
      initialBudget = Math.round(c.total * 0.6);
    }
    setEditTotalHonorarios(initialBudget);

    const serviceLines = (c.servicios || []).map((s) => {
      const uCost = getServiceUnitCost(s, services);
      return {
        ...s,
        costoU: uCost,
      };
    });
    setEditServiceLines(serviceLines);

    const shifts = (c.guardiasProgramadas || []).map((g) => {
      const matchingLine =
        serviceLines.find((s) => s.servicio === g.tipoServicio) || serviceLines[0];
      const defaultCost =
        matchingLine?.costoU ||
        (initialBudget > 0 && numShifts > 0 ? Math.round(initialBudget / numShifts) : 600);

      return {
        ...g,
        costoHonorarios:
          g.costoHonorarios !== undefined &&
          g.costoHonorarios !== null &&
          Number(g.costoHonorarios) > 0
            ? Number(g.costoHonorarios)
            : defaultCost,
      };
    });
    setEditGuardiasShifts(shifts);
    setEditNotasHonorarios(c.notasHonorarios || "");
    setEditIsLiquidado(Boolean(c.honorariosLiquidados));
  };

  const handleReopenCaratulaHonorarios = async (c: Caratula) => {
    if (!onSaveCaratula) return;
    try {
      const updated: Caratula = {
        ...c,
        honorariosLiquidados: false,
        fechaLiquidacionHonorarios: undefined,
        liquidadoHonorariosPor: undefined,
      };
      await onSaveCaratula(updated);
      setToastMessage({
        text: `Adeudo de honorarios para carátula ${c.folio} reabierto correctamente.`,
        type: "success",
      });
    } catch (err) {
      console.error("Error al reabrir adeudo de carátula:", err);
      setToastMessage({
        text: "Error al reabrir adeudo de la carátula.",
        type: "error",
      });
    }
  };

  const handleLiquidateAllShifts = async (c: Caratula, shifts: ShiftPaymentItem[]) => {
    if (!onSaveCaratula) return;
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const shiftsMap = new Map(shifts.map((s) => [s.folioGuardia || s.id, s]));

      const updatedProgramadas = (c.guardiasProgramadas || []).map((g) => {
        const key = g.folioGuardia || g.id;
        const sh = shiftsMap.get(key);
        return {
          ...g,
          honorarioPagado: true,
          montoPagadoHonorario: g.montoPagadoHonorario || g.costoHonorarios || (sh?.costoHonorarios ?? 600),
          fechaPagoHonorario: g.fechaPagoHonorario || todayStr,
        };
      });

      const updated: Caratula = {
        ...c,
        guardiasProgramadas: updatedProgramadas,
        honorariosLiquidados: true,
        fechaLiquidacionHonorarios: new Date().toLocaleString(),
        liquidadoHonorariosPor: currentUserName || "Administración",
      };

      await onSaveCaratula(updated);

      if (onSaveCalendarEvent) {
        for (const ev of calendarEvents) {
          if (ev.caratulaFolio && ev.caratulaFolio.trim().toUpperCase() === c.folio.trim().toUpperCase()) {
            if (!ev.honorarioPagado) {
              await onSaveCalendarEvent({
                ...ev,
                honorarioPagado: true,
                montoPagadoHonorario: ev.montoPagadoHonorario || ev.costoHonorarios || 600,
                fechaPagoHonorario: ev.fechaPagoHonorario || todayStr,
              });
            }
          }
        }
      }

      setToastMessage({
        text: `Todas las guardias de ${c.folio} han sido marcadas como liquidadas.`,
        type: "success",
      });
    } catch (err) {
      console.error("Error al liquidar guardias de carátula:", err);
      setToastMessage({
        text: "Error al liquidar guardias.",
        type: "error",
      });
    }
  };

  const handleSaveCaratulaHonorarios = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCaratula || !onSaveCaratula) return;

    try {
      setIsSavingCaratula(true);
      const totalHonorariosNum = Math.max(0, Number(editTotalHonorarios));
      const existingShifts = editingCaratula.guardiasProgramadas || [];
      const numShifts = existingShifts.length;
      const perShiftFallback = numShifts > 0 ? Math.round(totalHonorariosNum / numShifts) : 600;

      let updatedShifts = (editGuardiasShifts.length > 0 ? editGuardiasShifts : existingShifts).map((g) => ({
        ...g,
        costoHonorarios:
          g.costoHonorarios !== undefined && g.costoHonorarios !== null && Number(g.costoHonorarios) > 0
            ? Number(g.costoHonorarios)
            : perShiftFallback,
      }));

      if (editIsLiquidado) {
        const todayStr = new Date().toISOString().split("T")[0];
        updatedShifts = updatedShifts.map((g) => ({
          ...g,
          honorarioPagado: true,
          montoPagadoHonorario: g.montoPagadoHonorario || g.costoHonorarios || perShiftFallback,
          fechaPagoHonorario: g.fechaPagoHonorario || todayStr,
        }));
      } else {
        // If unchecking liquidated flag, keep paid status only if an active expense exists
        updatedShifts = updatedShifts.map((g) => {
          const hasExp = checkIsShiftPaid(g, editingCaratula.folio, expenses);
          return {
            ...g,
            honorarioPagado: hasExp,
            montoPagadoHonorario: hasExp ? g.montoPagadoHonorario : undefined,
            fechaPagoHonorario: hasExp ? g.fechaPagoHonorario : undefined,
          };
        });
      }

      const updated: Caratula = {
        ...editingCaratula,
        servicios: editServiceLines,
        guardiasProgramadas: updatedShifts,
        honorarioPersonalPersonalizado: totalHonorariosNum > 0 ? totalHonorariosNum : undefined,
        notasHonorarios: editNotasHonorarios.trim(),
        honorariosLiquidados: editIsLiquidado,
        fechaLiquidacionHonorarios: editIsLiquidado
          ? editingCaratula.fechaLiquidacionHonorarios || new Date().toLocaleString()
          : undefined,
        liquidadoHonorariosPor: editIsLiquidado
          ? editingCaratula.liquidadoHonorariosPor || currentUserName || "Administración"
          : undefined,
      };

      await onSaveCaratula(updated);
      setEditingCaratula(null);
      setToastMessage({
        text: `Honorarios para carátula ${updated.folio} guardados exitosamente.`,
        type: "success",
      });
    } catch (err) {
      console.error("Error guardando honorarios:", err);
      setToastMessage({
        text: "Error al guardar los honorarios de la carátula.",
        type: "error",
      });
    } finally {
      setIsSavingCaratula(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : toastMessage.type === "info"
              ? "bg-sky-50 border-sky-300 text-sky-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-xs">
            {toastMessage.type === "success" && (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {toastMessage.type === "info" && (
              <Info className="w-4 h-4 text-sky-600 shrink-0" />
            )}
            {toastMessage.type === "error" && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header with Global Financial Totals */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            CONTROL Y DISPERSIÓN DE HONORARIOS
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Pagos de Honorarios por Guardia y Socio
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Filtro estricto por carátula y socio, guardias en adeudo, modificación de montos por turno y reversión de pagos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 min-w-[140px]">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Honorarios Totales</div>
            <div className="text-lg font-black text-white font-mono">{formatCurrency(totalEstimadoGlobal)}</div>
          </div>
          <div className="bg-emerald-950/60 p-3 rounded-2xl border border-emerald-800/60 min-w-[140px]">
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Pagado a Personal</div>
            <div className="text-lg font-black text-emerald-300 font-mono">{formatCurrency(totalPagadoGlobal)}</div>
          </div>
          <div className="bg-rose-950/60 p-3 rounded-2xl border border-rose-800/60 min-w-[140px]">
            <div className="text-[10px] text-rose-400 font-bold uppercase">Pendiente Por Liquidar</div>
            <div className="text-lg font-black text-rose-400 font-mono">{formatCurrency(totalPendienteGlobal)}</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("caratulas_con_adeudos")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "caratulas_con_adeudos"
              ? "bg-rose-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>🔴 Carátulas con Adeudos de Honorarios</span>
          {caratulasConAdeudoList.length > 0 && (
            <span className="bg-rose-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {caratulasConAdeudoList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("adeudos")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "adeudos"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>⚡ Pagar Guardias por Carátula y Socio</span>
          {selectedCaratula && pendingAdeudosForSocio.length > 0 && (
            <span className="bg-indigo-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {pendingAdeudosForSocio.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pagos_realizados")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "pagos_realizados"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          <span>💳 Historial de Pagos Realizados</span>
          <span className="bg-emerald-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
            {paidHonorariosExpenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("resumen_caratulas")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "resumen_caratulas"
              ? "bg-slate-800 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📋 Resumen Consolidado (Todas)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: VISTA GENERAL DE CARÁTULAS CON ADEUDOS DE HONORARIOS */}
      {/* ========================================================================= */}
      {activeTab === "caratulas_con_adeudos" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Filter & Search Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                  Carátulas que aún deben Honorarios a Personal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lista global de carátulas activas con saldo o guardias pendientes de liquidar a enfermería y personal clínico.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">
                  {caratulasConAdeudoList.length} Carátula(s) con Adeudo
                </span>
                <span className="px-3 py-1.5 bg-slate-900 text-white rounded-xl font-bold">
                  Pendiente Total: {formatCurrency(caratulasConAdeudoList.reduce((s, c) => s + c.honorariosPendientes, 0))}
                </span>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={adeudosCaratulaSearch}
                onChange={(e) => setAdeudosCaratulaSearch(e.target.value)}
                placeholder="Buscar por folio (ej. CPSEA199), cliente o personal asignado..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
              />
              {adeudosCaratulaSearch && (
                <button
                  onClick={() => setAdeudosCaratulaSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List / Cards of Caratulas with Debt */}
          {filteredCaratulasConAdeudo.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                {caratulasConAdeudoList.length === 0
                  ? "¡No hay carátulas con adeudos de honorarios!"
                  : "No se encontraron carátulas con el filtro de búsqueda."}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {caratulasConAdeudoList.length === 0
                  ? "Todos los honorarios del personal clínico han sido cubiertos y liquidados satisfactoriamente."
                  : "Intenta con otro término de búsqueda o limpia el filtro."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredCaratulasConAdeudo.map((item) => {
                const c = item.caratula;
                const linkedStaff = getLinkedStaffForCaratula(c);
                const cardShifts = buildShiftsForCaratula(c);
                const isZeroCostAlert =
                  item.costoPresupuestado === 0 &&
                  ((item.totalShiftsCount && item.totalShiftsCount > 0) ||
                    (Array.isArray(c.servicios) && c.servicios.length > 0));

                return (
                  <div
                    key={c.id || item.folio}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition space-y-4"
                  >
                    {/* Header: Folio, Status, Client */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-xl shadow-xs">
                          {item.folio}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">
                          {c.tipoDocumento || "Carátula"}
                        </span>
                        {c.honorariosLiquidados && (item.unpaidShiftsCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-700" /> MARCADA LIQUIDADA ({item.unpaidShiftsCount} TURNOS PENDIENTES)
                            </span>
                            <button
                              onClick={() => handleReopenCaratulaHonorarios(c)}
                              className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer transition"
                              title="Quitar marca de liquidada y dejarla como pendiente de pago"
                            >
                              Reabrir Adeudo
                            </button>
                          </div>
                        ) : item.status === "PARTIAL" ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                            PAGO PARCIAL ({item.pctHonorariosPagado}%)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                            ADEUDO PENDIENTE (0%)
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-medium text-slate-500">
                        {c.fechaElaboracion && <span>Fecha: {c.fechaElaboracion}</span>}
                      </div>
                    </div>

                    {/* Client & Assigned Staff details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Column 1: Client & Service */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Cliente / Paciente</div>
                        <div className="font-black text-slate-900 text-sm">
                          {item.clienteNombre}
                        </div>
                        {item.receptorNombre && item.receptorNombre !== "-" && (
                          <div className="text-[11px] text-slate-500">
                            Receptor: {item.receptorNombre}
                          </div>
                        )}
                        {Array.isArray(c.servicios) && c.servicios.length > 0 && (
                          <div className="text-[11px] text-slate-600 pt-1">
                            <span className="font-semibold">Servicios:</span>{" "}
                            {c.servicios
                              .map((s) => `${s.servicio} (${s.cantidad || 1})`)
                              .join(", ")}
                          </div>
                        )}
                      </div>

                      {/* Column 2: Personal Asignado & Guardias */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                          <span>Personal Clínico Asignado</span>
                          <span className="font-mono">
                            {item.totalShiftsCount
                              ? `${item.unpaidShiftsCount ?? item.totalShiftsCount} de ${item.totalShiftsCount} turnos pendientes`
                              : ""}
                          </span>
                        </div>

                        {linkedStaff.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic">
                            Sin personal asignado en guardias todavía
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedStaff.map((st) => (
                              <span
                                key={st.key}
                                className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-200 flex items-center gap-1"
                              >
                                <Users className="w-3 h-3 text-sky-600" />
                                <span>{st.nombre}</span>
                                {st.noSocio && (
                                  <span className="text-[9px] font-mono text-sky-700">
                                    ({st.noSocio})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Column 3: Financial Figures */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 text-right">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Honorarios Totales:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {formatCurrency(item.costoPresupuestado)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Pagado a Personal:</span>
                          <span className="font-mono font-bold text-emerald-600">
                            {formatCurrency(item.honorariosPagados)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-black border-t border-slate-200 pt-1">
                          <span className="text-rose-700">Saldo Pendiente:</span>
                          <span className="font-mono text-base text-rose-600 font-black">
                            {formatCurrency(item.honorariosPendientes)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Zero cost alert banner if unconfigured */}
                    {isZeroCostAlert && (
                      <div className="bg-amber-50 p-3 rounded-2xl border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Atención:</strong> Esta carátula tiene turnos pero no tiene costo unitario en catálogo. Haz clic en <strong>Ajustar Honorarios</strong> para fijar la tarifa por turno o presupuesto global.
                          </span>
                        </div>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shrink-0 cursor-pointer"
                        >
                          Asignar Tarifa
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-400 font-mono">
                        Venta Cliente: {formatCurrency(item.totalVenta)} • Cobrado: {formatCurrency(item.pagadoCliente)}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCardFolios((prev) => ({
                              ...prev,
                              [item.folio]: !prev[item.folio],
                            }))
                          }
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs border flex items-center gap-1.5 cursor-pointer transition ${
                            expandedCardFolios[item.folio]
                              ? "bg-indigo-50 border-indigo-300 text-indigo-900"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                          }`}
                          title="Desplegar y gestionar guardias agendadas de esta carátula (Modificar o Eliminar)"
                        >
                          <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            {expandedCardFolios[item.folio]
                              ? "Ocultar Guardias"
                              : `Ver / Gestionar Guardias (${cardShifts.length})`}
                          </span>
                          {expandedCardFolios[item.folio] ? (
                            <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Ajustar Honorarios</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCaratulaFolio(item.folio);
                            setSelectedStaffKey("ALL");
                            setActiveTab("adeudos");
                          }}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <span>Pagar Guardias ({item.unpaidShiftsCount})</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Section: Guardias Agendadas with Modificar & Eliminar */}
                    {expandedCardFolios[item.folio] && (
                      <div className="mt-3 pt-3 border-t border-slate-200 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wide">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            <span>Guardias Agendadas en Carátula y Calendario ({cardShifts.length})</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Puedes <strong>Modificar</strong> o <strong>Eliminar</strong> cualquier guardia incorrecta aquí mismo.
                          </div>
                        </div>

                        {cardShifts.length === 0 ? (
                          <div className="bg-slate-50 p-4 rounded-2xl text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200">
                            No hay guardias registradas en esta carátula actualmente.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            {cardShifts.map((shift) => {
                              const isNoc = shift.horaInicio >= "19:00" || shift.horaFin <= "08:00";
                              return (
                                <div
                                  key={shift.id}
                                  className="bg-slate-50 hover:bg-slate-100/80 p-3 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-black text-indigo-700 text-xs bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                        {shift.folioGuardia || shift.id}
                                      </span>
                                      <span className="text-xs font-black text-slate-900">
                                        📅 {shift.fecha}
                                      </span>
                                      <span
                                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                          isNoc
                                            ? "bg-purple-100 text-purple-900"
                                            : "bg-amber-100 text-amber-900"
                                        }`}
                                      >
                                        {isNoc ? "🌙 Noche" : "☀️ Día"} ({shift.horaInicio} - {shift.horaFin})
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {shift.tipoServicio}
                                      </span>
                                      {shift.honorarioPagado ? (
                                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>PAGADA ({formatCurrency(shift.montoPagadoHonorario || shift.costoHonorarios)})</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                                          PENDIENTE ({formatCurrency(shift.costoHonorarios)})
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                      <span>
                                        Asignado: <strong>{shift.personalAsignado}</strong>
                                      </span>
                                      {shift.staffNoSocio && (
                                        <span className="font-mono text-[10px] text-sky-700 font-bold">
                                          (Socio {shift.staffNoSocio})
                                        </span>
                                      )}
                                      {shift.notasTurno && (
                                        <>
                                          <span>•</span>
                                          <span className="text-slate-500 italic text-[11px]">
                                            💬 {shift.notasTurno}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Modificar y Eliminar Buttons */}
                                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditShiftModal(shift)}
                                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Modificar fecha, horario, personal o costo de esta guardia en carátula y calendario"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Modificar</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenDeleteShiftModal(shift)}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Eliminar guardia agendada de la carátula y del calendario"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Eliminar</span>
                                    </button>

                                    {!shift.honorarioPagado && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedCaratulaFolio(item.folio);
                                          setSelectedStaffKey("ALL");
                                          setActiveTab("adeudos");
                                          handleOpenPayShiftModal(shift);
                                        }}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                        title="Pagar honorario de esta guardia"
                                      >
                                        <DollarSign className="w-3.5 h-3.5" />
                                        <span>Pagar</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ADEUDOS DE GUARDIAS POR CARÁTULA Y SOCIO (PRIMARY WORKFLOW) */}
      {/* ========================================================================= */}
      {activeTab === "adeudos" && (
        <div className="space-y-6">
          {/* Top Control Bar: Select Carátula & Select Socio */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wide">
                <Filter className="w-4 h-4 text-rose-600" />
                <span>1. Seleccione la Carátula de Servicio y el Socio / Personal Asignado</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Solo aparecerán los adeudos de la carátula y socio seleccionados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selector 1: Carátula */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase">
                  Carátula de Pago:
                </label>
                <div className="relative">
                  <select
                    value={selectedCaratulaFolio}
                    onChange={(e) => setSelectedCaratulaFolio(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer transition"
                  >
                    <option value="">-- Seleccionar Carátula de Servicio --</option>
                    {caratulas.map((c) => {
                      const rep = feesReport.find(
                        (r) => r.folio.trim().toUpperCase() === c.folio.trim().toUpperCase()
                      );
                      const totalShifts = rep?.totalShiftsCount ?? (c.guardiasProgramadas || []).length;
                      const unpaidShifts =
                        rep?.unpaidShiftsCount ??
                        (c.guardiasProgramadas || []).filter((g) => !g.honorarioPagado).length;
                      const isFullySettled =
                        (Boolean(c.honorariosLiquidados) || rep?.status === "PAID") && unpaidShifts === 0;

                      let statusBadge = "";
                      if (isFullySettled) {
                        statusBadge = "[LIQUIDADA]";
                      } else if (unpaidShifts > 0) {
                        statusBadge = `[${unpaidShifts} PENDIENTE${unpaidShifts > 1 ? "S" : ""}]`;
                      }

                      return (
                        <option key={c.folio} value={c.folio}>
                          {c.folio} - {c.nombreCompletoCliente} {totalShifts > 0 ? `(${totalShifts} guardias)` : ""} {statusBadge}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {selectedCaratula && (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>
                      Cliente: <strong>{selectedCaratula.nombreCompletoCliente}</strong>
                    </span>
                    <span className="font-mono">
                      Folio: <strong>{selectedCaratula.folio}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Selector 2: Socio / Personal */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase">
                  Socio / Personal que cubrió las guardias:
                </label>
                <div className="relative">
                  <select
                    value={selectedStaffKey}
                    onChange={(e) => setSelectedStaffKey(e.target.value)}
                    disabled={!selectedCaratula}
                    className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <option value="ALL">👥 Todos los Socios / Personal de esta Carátula</option>
                    {staffListForSelectedCaratula.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.nombre} {s.noSocio ? `(Socio: SOCP-${s.noSocio})` : ""} - {s.roles[0] || "Asignado"}
                      </option>
                    ))}
                    {staffListForSelectedCaratula.length === 0 && selectedCaratula && (
                      <option value="" disabled>
                        (Sin personal específico en guardias)
                      </option>
                    )}
                    <option value="" disabled>
                      ──────── Plantilla General ────────
                    </option>
                    {staffMembers.map((sm) => (
                      <option key={sm.id} value={sm.id}>
                        {sm.nombre} {sm.apellidos} {sm.noSocio ? `(SOCP-${sm.noSocio})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedStaffInfo ? (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>
                      Socio: <strong>{selectedStaffInfo.nombre}</strong>
                    </span>
                    {selectedStaffInfo.noSocio && (
                      <span className="font-mono text-sky-700 font-bold">
                        No. Socio: SOCP-{selectedStaffInfo.noSocio}
                      </span>
                    )}
                  </div>
                ) : selectedCaratula ? (
                  <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>
                      Mostrando: <strong>Todos los adeudos de la Carátula {selectedCaratula.folio}</strong>
                    </span>
                    <span className="text-slate-400">
                      (Puedes seleccionar un socio en particular arriba)
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Socio Highlight & Bank Data Card (Single Socio) */}
            {selectedStaffInfo && (
              <div className="mt-2 bg-gradient-to-r from-slate-50 via-sky-50/40 to-slate-50 p-4 rounded-2xl border border-sky-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {selectedStaffInfo.staff?.fotoUrl ? (
                    <img
                      src={selectedStaffInfo.staff.fotoUrl}
                      alt={selectedStaffInfo.nombre}
                      className="w-12 h-12 rounded-full object-cover border-2 border-sky-300 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-800 font-black text-sm flex items-center justify-center border-2 border-sky-300 shadow-sm shrink-0">
                      {selectedStaffInfo.nombre.charAt(0)}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm">
                        {selectedStaffInfo.nombre}
                      </h4>
                      {selectedStaffInfo.noSocio && (
                        <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md border border-sky-200">
                          SOCP-{selectedStaffInfo.noSocio}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {selectedStaffInfo.roles[0] || "Personal Clínico"}
                      </span>
                    </div>

                    {/* Bank Info */}
                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sky-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-sky-600" />
                        {selectedStaffInfo.staff?.banco || "Banco no capturado"}
                      </span>
                      <span>•</span>
                      {selectedStaffInfo.staff?.clabeInterbancaria ? (
                        <div className="flex items-center gap-1.5 font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                          <span>CLABE: {selectedStaffInfo.staff.clabeInterbancaria}</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                selectedStaffInfo.staff?.clabeInterbancaria || ""
                              );
                              setToastMessage({
                                text: `CLABE copiada: ${selectedStaffInfo.staff?.clabeInterbancaria}`,
                                type: "info",
                              });
                            }}
                            className="text-[10px] text-sky-700 hover:text-sky-900 flex items-center gap-0.5 cursor-pointer ml-1"
                            title="Copiar CLABE"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-amber-700 italic text-[11px]">
                          Sin CLABE interbancaria registrada
                        </span>
                      )}
                      {selectedStaffInfo.staff?.titularCuenta && (
                        <span className="text-[11px] text-slate-500">
                          Titular: <strong>{selectedStaffInfo.staff.titularCuenta}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtotals for this specific socio on this carátula */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <div className="text-[9.5px] text-slate-500 uppercase font-bold">Total Asignado</div>
                    <div className="text-xs font-black font-mono text-slate-900">
                      {formatCurrency(socioTotalAsignado)}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <div className="text-[9.5px] text-slate-500 uppercase font-bold">Total Pagado</div>
                    <div className="text-xs font-black font-mono text-emerald-700">
                      {formatCurrency(socioTotalPagado)}
                    </div>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center min-w-[100px]">
                    <div className="text-[9.5px] text-rose-800 uppercase font-black">Adeudo Pendiente</div>
                    <div className="text-sm font-black font-mono text-rose-600">
                      {formatCurrency(socioTotalPendiente)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Summary for All Staff on this Carátula */}
            {selectedCaratula && !selectedStaffInfo && (
              <div className="mt-2 bg-gradient-to-r from-slate-50 via-rose-50/40 to-slate-50 p-4 rounded-2xl border border-rose-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-800 font-black text-sm flex items-center justify-center border-2 border-rose-300 shadow-sm shrink-0">
                    <Users className="w-6 h-6 text-rose-700" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-slate-900 text-sm">
                        Honorarios Pendientes de la Carátula {selectedCaratula.folio}
                      </h4>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        {selectedCaratula.nombreCompletoCliente}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Exclusivamente turnos asignados a este folio. Los honorarios de otras carátulas están estrictamente separados.
                    </p>
                  </div>
                </div>

                {/* Subtotals for all staff on this carátula */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <div className="text-[9.5px] text-slate-500 uppercase font-bold">Total Asignado</div>
                    <div className="text-xs font-black font-mono text-slate-900">
                      {formatCurrency(socioTotalAsignado)}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center min-w-[90px]">
                    <div className="text-[9.5px] text-slate-500 uppercase font-bold">Total Pagado</div>
                    <div className="text-xs font-black font-mono text-emerald-700">
                      {formatCurrency(socioTotalPagado)}
                    </div>
                  </div>
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center min-w-[100px]">
                    <div className="text-[9.5px] text-rose-800 uppercase font-black">Adeudo Pendiente</div>
                    <div className="text-sm font-black font-mono text-rose-600">
                      {formatCurrency(socioTotalPendiente)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* List of Guardias (Adeudos Pendientes o Todas las Guardias) */}
          {(() => {
            const shiftsToDisplay =
              shiftsViewFilter === "all" ? allShiftsForSocio : pendingAdeudosForSocio;

            return (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <span>
                        {shiftsViewFilter === "pending"
                          ? "Guardias en Adeudo Pendiente por Liquidar"
                          : "Todas las Guardias Agendadas de la Carátula"}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-black border ${
                          shiftsViewFilter === "pending"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-indigo-100 text-indigo-800 border-indigo-300"
                        }`}
                      >
                        {shiftsToDisplay.length}{" "}
                        {shiftsViewFilter === "pending" ? "pendientes" : "guardias"}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {shiftsViewFilter === "pending"
                        ? "Puedes pagar cada guardia o, si está incorrecta, modificarla o eliminarla de la carátula y el calendario."
                        : "Visualizando todas las guardias agendadas. Puedes modificar horarios/personal o eliminar turnos incorrectos."}
                    </p>
                  </div>

                  {/* Filter Toggle Buttons */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setShiftsViewFilter("pending")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        shiftsViewFilter === "pending"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      <span>Pendientes</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          shiftsViewFilter === "pending"
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {pendingAdeudosForSocio.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftsViewFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        shiftsViewFilter === "all"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      <span>Todas las Guardias</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          shiftsViewFilter === "all"
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {allShiftsForSocio.length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Helpful tip banner for shift management */}
                <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3 text-xs text-sky-950 flex items-start gap-2.5 shadow-2xs">
                  <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong>Gestión de Guardias Agendadas:</strong> Si tienes turnos agendados de manera incorrecta, utiliza el botón <strong className="text-amber-800">Modificar</strong> para ajustar fecha, horario, personal o costo, o el botón <strong className="text-rose-700">Eliminar</strong> para cancelarlos sin generar egresos ni adeudos. Los cambios se sincronizan en tiempo real tanto en la <strong>carátula</strong> como en la <strong>agenda / calendario</strong>.
                  </div>
                </div>

                {/* Warning if carátula was previously marked as liquidada but still has pending guardias */}
                {selectedCaratula && selectedCaratula.honorariosLiquidados && pendingAdeudosForSocio.length > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 text-xs shadow-xs animate-fadeIn">
                    <div className="flex items-center gap-2.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-amber-950">
                          Esta carátula figuraba marcada como [LIQUIDADA], pero tiene {pendingAdeudosForSocio.length} turnos con adeudo pendiente de pago.
                        </p>
                        <p className="text-amber-800 text-[11px]">
                          Puedes reabrir el adeudo para que se compute como pendiente o liquidar todas las guardias restantes.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReopenCaratulaHonorarios(selectedCaratula)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1"
                      >
                        <span>Reabrir Adeudo</span>
                      </button>
                      <button
                        onClick={() => handleLiquidateAllShifts(selectedCaratula, allShiftsForSocio)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Liquidar Todo</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Instruction if no Caratula selected */}
                {!selectedCaratula && (
                  <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">
                      Selecciona una Carátula de Servicio
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Para visualizar únicamente los turnos y adeudos de esa carátula en específico, selecciónala en los controles superiores.
                    </p>
                  </div>
                )}

                {/* Empty state when there are NO shifts matching current filter */}
                {selectedCaratula && shiftsToDisplay.length === 0 && (
                  <div className="bg-white p-10 rounded-3xl border border-emerald-200 text-center space-y-3 shadow-xs">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-slate-900">
                        {shiftsViewFilter === "pending"
                          ? selectedStaffInfo
                            ? `¡Sin Adeudos Pendientes para ${selectedStaffInfo.nombre}!`
                            : `¡Sin Adeudos Pendientes en la Carátula ${selectedCaratula.folio}!`
                          : `No hay guardias registradas`}
                      </h4>
                      <p className="text-xs text-slate-600 max-w-lg mx-auto">
                        {shiftsViewFilter === "pending"
                          ? selectedStaffInfo
                            ? `Todas las guardias asignadas a este socio en la carátula ${selectedCaratula.folio} han sido pagadas o no hay turnos registrados pendientes de pago.`
                            : `Todos los honorarios y guardias de la carátula ${selectedCaratula.folio} han sido pagados y liquidados satisfactoriamente.`
                          : `No se encontraron turnos agendados para este criterio de búsqueda.`}
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      {shiftsViewFilter === "pending" && allShiftsForSocio.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShiftsViewFilter("all")}
                          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-black rounded-xl border border-indigo-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Calendar className="w-4 h-4 text-indigo-600" />
                          <span>
                            Ver todas las {allShiftsForSocio.length} guardias agendadas (para modificar o eliminar)
                          </span>
                        </button>
                      )}

                      {paidShiftsForSocio.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistorialCaratulaFilter(selectedCaratula.folio);
                            if (selectedStaffInfo) {
                              setHistorialStaffFilter(selectedStaffInfo.key);
                            }
                            setActiveTab("pagos_realizados");
                          }}
                          className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black rounded-xl border border-emerald-300 inline-flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <History className="w-4 h-4" />
                          <span>
                            Ver los {paidShiftsForSocio.length} pagos realizados ({formatCurrency(socioTotalPagado)})
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Active Guardias Cards */}
                {selectedCaratula && shiftsToDisplay.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {shiftsToDisplay.map((shift, sIdx) => {
                      const currentAmount =
                        editingGuardiaAmounts[shift.id] !== undefined
                          ? editingGuardiaAmounts[shift.id]
                          : shift.costoHonorarios;

                      const isAmountModified =
                        editingGuardiaAmounts[shift.id] !== undefined &&
                        editingGuardiaAmounts[shift.id] !== shift.costoHonorarios;

                      const isNoc =
                        shift.horaInicio >= "19:00" || shift.horaFin <= "08:00";

                      const isSavingThis = savingShiftId === shift.id;

                      return (
                        <div
                          key={shift.id || sIdx}
                          className={`bg-white hover:bg-slate-50/70 p-4 rounded-2xl border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition ${
                            shift.honorarioPagado
                              ? "border-emerald-200/80 bg-emerald-50/20"
                              : "border-slate-200"
                          }`}
                        >
                          {/* Left: Guardia Info */}
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center font-mono font-black text-xs shrink-0 mt-0.5 ${
                                shift.honorarioPagado
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                  : "bg-rose-50 border-rose-200 text-rose-700"
                              }`}
                            >
                              {sIdx + 1}
                            </div>

                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                                  {shift.folioGuardia || shift.id}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                  📅 {shift.fecha || "Fecha N/D"}
                                </span>
                                <span
                                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                                    isNoc
                                      ? "bg-indigo-100 text-indigo-900 border border-indigo-200"
                                      : "bg-amber-100 text-amber-900 border border-amber-200"
                                  }`}
                                >
                                  {isNoc ? "🌙 Noche" : "☀️ Día"} ({shift.horaInicio} - {shift.horaFin})
                                </span>
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {shift.tipoServicio}
                                </span>

                                {/* Status badge */}
                                {shift.honorarioPagado ? (
                                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>LIQUIDADA ({formatCurrency(shift.montoPagadoHonorario || shift.costoHonorarios)})</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                                    PENDIENTE DE PAGO ({formatCurrency(shift.costoHonorarios)})
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                <span>
                                  Asignado: <strong>{shift.personalAsignado}</strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Carátula: <strong className="font-mono text-slate-800">{shift.caratulaFolio}</strong>
                                </span>
                                <span>•</span>
                                <span className="text-slate-400 text-[11px]">
                                  {selectedCaratula.nombreCompletoCliente}
                                </span>
                                {shift.notasTurno && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-500 italic text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                                      💬 {shift.notasTurno}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions (Modificar, Eliminar, Editable Amount & Pay Button) */}
                          <div className="flex items-center gap-2 shrink-0 self-end lg:self-center flex-wrap justify-end">
                            {/* Modificar Guardia Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditShiftModal(shift)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Modificar fecha, horario, personal clínico, tipo de servicio o costo de esta guardia en carátula y calendario"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-700" />
                              <span>Modificar</span>
                            </button>

                            {/* Eliminar Guardia Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteShiftModal(shift)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Eliminar guardia agendada de la carátula y del calendario permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Eliminar</span>
                            </button>

                            {/* If pending: Editable Amount & Pay Button */}
                            {!shift.honorarioPagado ? (
                              <>
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                                  <span className="text-[11px] font-bold text-slate-600 pl-1.5">
                                    $:
                                  </span>
                                  <input
                                    type="number"
                                    step="10"
                                    min="0"
                                    value={currentAmount}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setEditingGuardiaAmounts((prev) => ({
                                        ...prev,
                                        [shift.id]: val,
                                      }));
                                    }}
                                    className="w-20 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-rose-500 text-right"
                                    title="Modifica el monto de honorarios acordado para esta guardia en específico"
                                  />

                                  {/* Save amount button if modified */}
                                  {isAmountModified && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveIndividualShiftCost(shift, currentAmount)
                                      }
                                      disabled={isSavingThis}
                                      className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                      title="Guardar nuevo monto de esta guardia sin liquidar todavía"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>{isSavingThis ? "..." : "OK"}</span>
                                    </button>
                                  )}
                                </div>

                                {/* Pay this Guardia Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayShiftModal(shift)}
                                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-xs transition active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                                >
                                  <DollarSign className="w-4 h-4" />
                                  <span>Pagar ({formatCurrency(currentAmount)})</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-bold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                                Pagada en Egresos
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HISTORIAL DE PAGOS REALIZADOS (WITH DELETE / UNDO ACTION) */}
      {/* ========================================================================= */}
      {activeTab === "pagos_realizados" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar en pagos por folio de guardia, socio, carátula o concepto..."
                value={historialSearch}
                onChange={(e) => setHistorialSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              {/* Caratula filter */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500">Carátula:</span>
                <select
                  value={historialCaratulaFilter}
                  onChange={(e) => setHistorialCaratulaFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                >
                  <option value="ALL">Todas las carátulas</option>
                  {caratulas.map((c) => (
                    <option key={c.folio} value={c.folio}>
                      {c.folio} - {c.nombreCompletoCliente.slice(0, 20)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff filter */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-slate-500">Socio:</span>
                <select
                  value={historialStaffFilter}
                  onChange={(e) => setHistorialStaffFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                >
                  <option value="ALL">Todos los socios</option>
                  {staffMembers.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.nombre} {sm.apellidos}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Payments list table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Movimientos de Pagos de Honorarios Realizados ({filteredPaidExpenses.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Si marcaste un pago por error, haz clic en <strong>Eliminar Movimiento</strong> para cancelarlo y regresar la guardia a adeudos pendientes.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha / Folio Egreso</th>
                    <th className="py-3 px-4">Carátula</th>
                    <th className="py-3 px-4">Guardia / Concepto</th>
                    <th className="py-3 px-4">Socio / Personal</th>
                    <th className="py-3 px-4">Método & Ref.</th>
                    <th className="py-3 px-4 text-right">Monto Pagado</th>
                    <th className="py-3 px-4 text-right">Acción (Deshacer)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPaidExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No se encontraron registros de pagos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredPaidExpenses.map((exp) => {
                      const linkedCaratula = caratulas.find(
                        (c) => c.folio === exp.caratulaFolio
                      );

                      return (
                        <tr key={exp.id} className="hover:bg-slate-50 transition">
                          {/* Fecha / Folio */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-slate-900 text-xs">
                              {exp.id}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {exp.timestamp}
                            </div>
                            <div className="text-[9.5px] text-slate-400">
                              Por: {exp.registradoPor || "Admin"}
                            </div>
                          </td>

                          {/* Caratula */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-black text-indigo-700 text-xs">
                              {exp.caratulaFolio}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-800">
                              {linkedCaratula?.nombreCompletoCliente || "-"}
                            </div>
                          </td>

                          {/* Guardia / Concepto */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {exp.folioGuardia && (
                              <span className="font-mono text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded mr-1.5 inline-block">
                                {exp.folioGuardia}
                              </span>
                            )}
                            <span className="font-bold text-slate-800">
                              {exp.concepto}
                            </span>
                            {exp.notas && (
                              <div className="text-[10.5px] text-slate-500 italic mt-0.5 truncate" title={exp.notas}>
                                📝 {exp.notas}
                              </div>
                            )}
                          </td>

                          {/* Socio */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {exp.staffNombre || "Personal Clínico"}
                            </div>
                            {exp.staffNoSocio && (
                              <span className="text-[9.5px] font-mono font-bold bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded">
                                SOCP-{exp.staffNoSocio}
                              </span>
                            )}
                          </td>

                          {/* Método & Ref */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {exp.metodoPago || "Transferencia"}
                            </span>
                            {exp.referenciaPago && (
                              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                Ref: {exp.referenciaPago}
                              </div>
                            )}
                          </td>

                          {/* Monto */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-emerald-700 text-sm">
                              {formatCurrency(exp.monto)}
                            </span>
                          </td>

                          {/* Action: Revert / Delete Movement */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setPaymentToDelete(exp)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                              title="Eliminar este movimiento de pago y devolver la guardia a adeudos pendientes"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Eliminar Movimiento</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RESUMEN CONSOLIDADO DE CARÁTULAS */}
      {/* ========================================================================= */}
      {activeTab === "resumen_caratulas" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por folio, cliente o personal asignado..."
                value={resumenSearch}
                onChange={(e) => setResumenSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={resumenStatusFilter}
                onChange={(e) => setResumenStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
              >
                <option value="ALL">Todas las Carátulas ({feesReport.length})</option>
                <option value="PENDING">
                  🔴 Con Adeudos ({feesReport.filter((r) => r.status === "PENDING").length})
                </option>
                <option value="PARTIAL">
                  🟡 Parciales ({feesReport.filter((r) => r.status === "PARTIAL").length})
                </option>
                <option value="PAID">
                  🟢 Liquidadas ({feesReport.filter((r) => r.status === "PAID").length})
                </option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Folio / Cliente</th>
                    <th className="py-3.5 px-4">Personal & Guardias</th>
                    <th className="py-3.5 px-4 text-right">Honorarios Totales</th>
                    <th className="py-3.5 px-4 text-right">Pagado a Personal</th>
                    <th className="py-3.5 px-4 text-right">Honorarios Pendientes</th>
                    <th className="py-3.5 px-4 text-center">Estatus</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCaratulasReport.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No se encontraron registros de honorarios con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCaratulasReport.map((item) => {
                      const c = item.caratula;
                      const linkedStaff = getLinkedStaffForCaratula(c);
                      const isLiquidated = Boolean(c.honorariosLiquidados);

                      return (
                        <tr key={c.folio} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 whitespace-nowrap">
                            <div className="font-mono font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                              <span>{c.folio}</span>
                            </div>
                            <div className="font-bold text-slate-800">{c.nombreCompletoCliente}</div>
                            <div className="text-[11px] text-slate-400">RS: {c.nombreCompletoRS || "-"}</div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="space-y-1 max-w-xs">
                              {linkedStaff.length === 0 ? (
                                <span className="text-slate-400 italic text-[11px]">Sin personal asignado</span>
                              ) : (
                                linkedStaff.map((ls, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between"
                                  >
                                    <span className="font-bold text-slate-800 truncate">{ls.nombre}</span>
                                    {ls.noSocio && (
                                      <span className="text-[9.5px] font-mono text-sky-700 font-bold ml-1">
                                        SOCP-{ls.noSocio}
                                      </span>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </td>

                          <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                            {formatCurrency(item.costoPresupuestado)}
                          </td>

                          <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                            {formatCurrency(item.honorariosPagados)}
                          </td>

                          <td className="py-4 px-4 text-right font-mono font-black text-rose-600 text-sm whitespace-nowrap">
                            {formatCurrency(item.honorariosPendientes)}
                          </td>

                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            {item.status === "PAID" ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Liquidado
                              </span>
                            ) : item.status === "PARTIAL" ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-amber-300">
                                <Clock className="w-3 h-3" /> Parcial ({item.pctHonorariosPagado}%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-rose-300">
                                <AlertCircle className="w-3 h-3" /> Pendiente
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Ir a dispersión de esta carátula */}
                              <button
                                onClick={() => {
                                  setSelectedCaratulaFolio(c.folio);
                                  setActiveTab("adeudos");
                                }}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition"
                                title="Ir a dispersión de guardias y adeudos de esta carátula"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Ver Adeudos</span>
                              </button>

                              {/* Editar Presupuesto */}
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-1 transition"
                                title="Editar presupuesto global de honorarios"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Presupuesto</span>
                              </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PAY SINGLE GUARDIA */}
      {/* ========================================================================= */}
      {payingShift && selectedCaratula && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest font-mono flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> REGISTRAR PAGO DE HONORARIOS DE GUARDIA
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Guardia: <span className="font-mono text-indigo-700">{payingShift.folioGuardia || payingShift.id}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Carátula: <strong className="text-slate-800">{selectedCaratula.folio}</strong> • {selectedCaratula.nombreCompletoCliente}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingShift(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayShift} className="space-y-4">
              {/* Socio & Bank Summary */}
              {(() => {
                const payingStaffObj =
                  selectedStaffInfo?.staff ||
                  (staffMembers || []).find(
                    (sm) =>
                      (payingShift.staffId && sm.id === payingShift.staffId) ||
                      (payingShift.staffNoSocio && sm.noSocio === payingShift.staffNoSocio) ||
                      (payingShift.personalAsignado &&
                        `${sm.nombre} ${sm.apellidos}`.toLowerCase().includes(payingShift.personalAsignado.toLowerCase()))
                  );
                const payingDisplayName =
                  selectedStaffInfo?.nombre ||
                  (payingStaffObj ? `${payingStaffObj.nombre} ${payingStaffObj.apellidos}` : payingShift.personalAsignado);
                const payingDisplayNoSocio =
                  selectedStaffInfo?.noSocio || payingShift.staffNoSocio || payingStaffObj?.noSocio;

                return (
                  <div className="bg-sky-50/80 p-3.5 rounded-2xl border border-sky-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-950">
                        Socio a Pagar: <strong>{payingDisplayName}</strong>
                      </span>
                      {payingDisplayNoSocio && (
                        <span className="font-mono font-bold text-[10px] bg-sky-200/80 text-sky-900 px-1.5 py-0.2 rounded">
                          SOCP-{payingDisplayNoSocio}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-700">
                      <span className="font-medium">
                        Banco: <strong>{payingStaffObj?.banco || "No especificado"}</strong>
                      </span>
                      {payingStaffObj?.clabeInterbancaria && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              payingStaffObj?.clabeInterbancaria || ""
                            );
                            setToastMessage({
                              text: `CLABE copiada: ${payingStaffObj?.clabeInterbancaria}`,
                              type: "info",
                            });
                          }}
                          className="text-[10px] font-bold text-sky-800 bg-white border border-sky-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar CLABE ({payingStaffObj.clabeInterbancaria})</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Guardia details card */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>📅 Fecha: {payingShift.fecha}</span>
                  <span>⏰ {payingShift.horaInicio} - {payingShift.horaFin}</span>
                </div>
                <div className="text-slate-600 text-[11px]">
                  Servicio: <strong>{payingShift.tipoServicio}</strong>
                </div>
              </div>

              {/* Monto de pago (editable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a Pagar por esta Guardia ($ MXN):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payMonto || ""}
                    onChange={(e) => setPayMonto(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-lg font-mono font-black text-rose-600 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Puedes modificar el monto final si hubo ajuste específico para esta guardia.
                </p>
              </div>

              {/* Método de Pago */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Método de Pago:
                  </label>
                  <select
                    value={payMetodoPago}
                    onChange={(e) => setPayMetodoPago(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Transferencia">Transferencia SPEI</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Folio Rastreo / Ref:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. SPEI 190926..."
                    value={payReferencia}
                    onChange={(e) => setPayReferencia(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto del Pago:
                </label>
                <input
                  type="text"
                  required
                  value={payConcepto}
                  onChange={(e) => setPayConcepto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas / Datos Bancarios:
                </label>
                <textarea
                  rows={2}
                  value={payNotas}
                  onChange={(e) => setPayNotas(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Important rule reminder */}
              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Al confirmar, esta guardia quedará como <strong>PAGADA</strong> y desaparecerá automáticamente de la lista de adeudos pendientes.
                </span>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingShift(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar y Registrar Pago</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE PAYMENT / UNDO MOVEMENT CONFIRMATION */}
      {/* ========================================================================= */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  ¿Eliminar Movimiento de Pago?
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Folio Egreso: {paymentToDelete.id}
                </p>
              </div>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-2">
              <p>
                Estás a punto de eliminar el pago de{" "}
                <strong className="font-mono text-sm text-rose-700">
                  {formatCurrency(paymentToDelete.monto)}
                </strong>{" "}
                a <strong>{paymentToDelete.staffNombre || "Personal"}</strong>.
              </p>
              <div className="bg-white p-2.5 rounded-xl border border-rose-200/80 font-mono text-[11px] text-slate-700 space-y-0.5">
                <div>Carátula: {paymentToDelete.caratulaFolio}</div>
                <div>Concepto: {paymentToDelete.concepto}</div>
                {paymentToDelete.folioGuardia && (
                  <div>Guardia: {paymentToDelete.folioGuardia}</div>
                )}
              </div>
              <p className="font-bold text-rose-900 flex items-center gap-1.5 pt-1">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  La guardia volverá a aparecer inmediatamente en la lista de adeudos pendientes por pagar.
                </span>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={isDeletingPayment}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                No, conservar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePayment}
                disabled={isDeletingPayment}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingPayment ? "Eliminando..." : "Sí, Eliminar Movimiento"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT CARATULA GENERAL HONORARIOS BUDGET */}
      {/* ========================================================================= */}
      {editingCaratula && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest font-mono flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> MODIFICAR PRESUPUESTO DE HONORARIOS
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  Folio: <span className="font-mono text-sky-600">{editingCaratula.folio}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong className="text-slate-800">{editingCaratula.nombreCompletoCliente}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCaratula(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCaratulaHonorarios} className="space-y-4">
              <div className="bg-sky-50 p-3.5 rounded-2xl border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  Permite ajustar el monto global de honorarios presupuestados para la carátula o marcarla como liquidada externamente.
                </p>
              </div>

              {/* Total Budgeted Honorarios input */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Monto Total de Honorarios Presupuestados ($ MXN):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editTotalHonorarios}
                  onChange={(e) => setEditTotalHonorarios(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-mono font-black text-rose-600 outline-none focus:ring-2 focus:ring-sky-500"
                />

                {/* Quick Calculation Presets */}
                <div className="pt-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Cálculo rápido de honorarios sugeridos:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(editingCaratula.guardiasProgramadas) &&
                      editingCaratula.guardiasProgramadas.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditTotalHonorarios(
                                editingCaratula.guardiasProgramadas!.length * 600
                              )
                            }
                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-200 cursor-pointer transition"
                          >
                            $600 × {editingCaratula.guardiasProgramadas.length} turnos (
                            {formatCurrency(
                              editingCaratula.guardiasProgramadas.length * 600
                            )}
                            )
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setEditTotalHonorarios(
                                editingCaratula.guardiasProgramadas!.length * 700
                              )
                            }
                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-200 cursor-pointer transition"
                          >
                            $700 × {editingCaratula.guardiasProgramadas.length} turnos (
                            {formatCurrency(
                              editingCaratula.guardiasProgramadas.length * 700
                            )}
                            )
                          </button>
                        </>
                      )}

                    {editingCaratula.total && editingCaratula.total > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditTotalHonorarios(
                            Math.round(editingCaratula.total! * 0.6)
                          )
                        }
                        className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg border border-purple-200 cursor-pointer transition"
                      >
                        60% de Venta (
                        {formatCurrency(Math.round(editingCaratula.total * 0.6))})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Liquidated Checkbox */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsLiquidado}
                    onChange={(e) => setEditIsLiquidado(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Marcar honorarios como LIQUIDADOS / CUBIERTOS</span>
                </label>
                <p className="text-[11px] text-slate-500 pl-6 mt-0.5">
                  Cierra los adeudos de esta carátula sin requerir egresos adicionales.
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas de Control de Honorarios:
                </label>
                <textarea
                  rows={2}
                  value={editNotasHonorarios}
                  onChange={(e) => setEditNotasHonorarios(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingCaratula(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  disabled={isSavingCaratula}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCaratula}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingCaratula ? "Guardando..." : "Guardar Presupuesto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: MODIFICAR GUARDIA AGENDADA (EN CARÁTULA Y CALENDARIO) */}
      {/* ========================================================================= */}
      {editingShift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Modificar Guardia Agendada
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Folio: <strong className="font-mono text-indigo-700">{editingShift.folioGuardia || editingShift.id}</strong> • Carátula: <strong className="font-mono text-slate-800">{editingShift.caratulaFolio}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingShift(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditShift} className="space-y-4 pt-4">
              {/* Sync Alert */}
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-xs text-sky-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Sincronización Bidireccional Activa</p>
                  <p className="text-sky-800 text-[11px]">
                    Al guardar, los cambios se reflejarán tanto en la carátula como en la agenda y el calendario de turnos. Los honorarios se recalcularán automáticamente.
                  </p>
                </div>
              </div>

              {/* Fecha y Horario */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📅 Fecha del Turno:
                  </label>
                  <input
                    type="date"
                    required
                    value={editShiftForm.fecha}
                    onChange={(e) =>
                      setEditShiftForm((prev) => ({ ...prev, fecha: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ⏰ Hora Inicio:
                  </label>
                  <input
                    type="time"
                    required
                    value={editShiftForm.horaInicio}
                    onChange={(e) =>
                      setEditShiftForm((prev) => ({ ...prev, horaInicio: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ⏰ Hora Fin:
                  </label>
                  <input
                    type="time"
                    required
                    value={editShiftForm.horaFin}
                    onChange={(e) =>
                      setEditShiftForm((prev) => ({ ...prev, horaFin: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Plantillas rápidas de horario:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "08:00",
                        horaFin: "20:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    ☀️ Día 12h (08:00 - 20:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "20:00",
                        horaFin: "08:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    🌙 Noche 12h (20:00 - 08:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "08:00",
                        horaFin: "08:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    🕒 24 Horas (08:00 - 08:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "07:00",
                        horaFin: "15:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    8h Mat (07:00 - 15:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "14:00",
                        horaFin: "22:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    8h Vesp (14:00 - 22:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        horaInicio: "21:00",
                        horaFin: "07:00",
                      }))
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition"
                  >
                    8h Noc (21:00 - 07:00)
                  </button>
                </div>
              </div>

              {/* Personal Clínico Asignado */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  👩‍⚕️ Personal Clínico / Socio Asignado:
                </label>
                <select
                  value={
                    editShiftForm.staffId ||
                    (editShiftForm.staffNoSocio ? `no-${editShiftForm.staffNoSocio}` : "MANUAL")
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "MANUAL") {
                      setEditShiftForm((prev) => ({
                        ...prev,
                        staffId: undefined,
                        staffNoSocio: undefined,
                      }));
                    } else {
                      const found = staffMembers.find(
                        (s) => s.id === val || (val.startsWith("no-") && s.noSocio === val.replace("no-", ""))
                      );
                      if (found) {
                        setEditShiftForm((prev) => ({
                          ...prev,
                          staffId: found.id,
                          staffNoSocio: found.noSocio,
                          personalAsignado: `${found.nombre} ${found.apellidos}`,
                        }));
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500 mb-2"
                >
                  <option value="MANUAL">-- Asignación manual / Escribir nombre --</option>
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} {s.apellidos} {s.noSocio ? `(Socio ${s.noSocio})` : ""} - {s.rol || "Enfermería"}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  required
                  value={editShiftForm.personalAsignado}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({
                      ...prev,
                      personalAsignado: e.target.value,
                    }))
                  }
                  placeholder="Nombre completo del personal asignado..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Tipo de Servicio y Costo de Honorarios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    🏷️ Tipo de Servicio:
                  </label>
                  <input
                    type="text"
                    required
                    value={editShiftForm.tipoServicio}
                    onChange={(e) =>
                      setEditShiftForm((prev) => ({
                        ...prev,
                        tipoServicio: e.target.value,
                      }))
                    }
                    list="servicios-datalist"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <datalist id="servicios-datalist">
                    {(selectedCaratula?.servicios || []).map((s, idx) => (
                      <option key={idx} value={s.servicio} />
                    ))}
                    {services.map((s) => (
                      <option key={s.id} value={s.nombre} />
                    ))}
                    <option value="Guardia Día 12 hrs" />
                    <option value="Guardia Noche 12 hrs" />
                    <option value="Guardia 24 hrs" />
                    <option value="Enfermería General" />
                    <option value="Cuidados Holísticos" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    💵 Costo de Honorarios ($ MXN):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      required
                      value={editShiftForm.costoHonorarios}
                      onChange={(e) =>
                        setEditShiftForm((prev) => ({
                          ...prev,
                          costoHonorarios: Math.max(0, parseFloat(e.target.value) || 0),
                        }))
                      }
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black font-mono text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[600, 700, 800, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() =>
                          setEditShiftForm((prev) => ({ ...prev, costoHonorarios: val }))
                        }
                        className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono rounded font-bold cursor-pointer transition"
                      >
                        ${val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Observaciones / Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  📝 Observaciones / Notas del Turno:
                </label>
                <textarea
                  rows={2}
                  value={editShiftForm.notasTurno}
                  onChange={(e) =>
                    setEditShiftForm((prev) => ({
                      ...prev,
                      notasTurno: e.target.value,
                    }))
                  }
                  placeholder="Indicaciones, motivo de la modificación o notas para el enfermero..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition"
                  disabled={isSavingShift}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingShift}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  {isSavingShift ? (
                    <span>Guardando en Carátula y Calendario...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CONFIRMACIÓN DE ELIMINACIÓN DE GUARDIA AGENDADA */}
      {/* ========================================================================= */}
      {shiftToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2 mb-4">
              <h3 className="text-base font-black text-slate-900">
                ¿Eliminar Guardia Agendada?
              </h3>
              <p className="text-xs text-slate-600">
                Esta acción removerá esta guardia de la carátula y también la eliminará permanentemente de la agenda / calendario.
              </p>
            </div>

            {/* Details Box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-700 mb-4 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Folio Guardia:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {shiftToDelete.folioGuardia || shiftToDelete.id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Carátula:</span>
                <span className="font-mono font-bold text-slate-800">
                  {shiftToDelete.caratulaFolio}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Fecha y Horario:</span>
                <span className="font-bold text-slate-900">
                  📅 {shiftToDelete.fecha} ({shiftToDelete.horaInicio} - {shiftToDelete.horaFin})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Personal Asignado:</span>
                <span className="font-bold text-slate-900">
                  {shiftToDelete.personalAsignado}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Honorarios Presupuestados:</span>
                <span className="font-mono font-black text-rose-600">
                  {formatCurrency(shiftToDelete.costoHonorarios)}
                </span>
              </div>
            </div>

            {/* Warning if paid */}
            {shiftToDelete.honorarioPagado && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-amber-950 text-[11px] font-medium mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-900 block font-bold">Atención: Guardia con Pago Registrado</strong>
                  Esta guardia ya cuenta con un registro de honorario liquidado. Al eliminarla, considera también revisar o cancelar el egreso en el Historial de Pagos.
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShiftToDelete(null)}
                disabled={isDeletingShift}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition"
              >
                No, Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteShift}
                disabled={isDeletingShift}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                {isDeletingShift ? (
                  <span>Eliminando...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sí, Eliminar Guardia</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
