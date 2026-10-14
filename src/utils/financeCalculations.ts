import { Caratula, Expense, Service, AbonoTicket, CalendarEvent } from "../types";
import { isSameGuardia, deduplicateShiftsList } from "./guardiaFolio";

export interface CaratulaCostStats {
  caratula: Caratula;
  folio: string;
  clienteNombre: string;
  receptorNombre: string;
  totalVenta: number;
  pagadoCliente: number;
  totalCobradoCliente: number;
  deudaCliente: number;
  isClienteLiquidado: boolean;
  costoPresupuestado: number;
  honorariosPagados: number;
  honorariosPendientes: number;
  otrosGastosPagados: number;
  totalGastosPagados: number;
  costoTotalPendiente: number;
  pctHonorariosPagado: number;
  status: "PAID" | "PARTIAL" | "PENDING";
  totalShiftsCount?: number;
  unpaidShiftsCount?: number;
}

export interface GlobalFinancialSummary {
  // 1. Cuentas por Cobrar (Clientes)
  totalVentaContratada: number;
  totalCobradoClientes: number;
  totalDeudaClientes: number; // Cuentas por cobrar acumuladas de clientes

  // 2. Cuentas por Pagar (Honorarios a Personal de Enfermería & Costos de Servicios)
  totalHonorariosPresupuestados: number;
  totalHonorariosPagados: number;
  totalHonorariosPendientes: number; // EXACT Accounts Payable to Staff

  // 3. Gastos Directos e Indirectos
  totalOtrosGastosCaratulas: number;
  totalGastosGeneralesAgencia: number;
  totalEgresosHistoricos: number;

  // 4. Flujo Real de Caja
  totalIngresosAbonosHistoricos: number;
  saldoRealCaja: number;

  // 5. Desglose detallado por carátula
  caratulaStatsList: CaratulaCostStats[];
}

/**
 * Returns the reliable unit cost for a service line item, checking
 * the line's own unit cost, then falling back to the service catalog default,
 * then estimating from the sale price (~60%), or standard nursing shift fee.
 */
export function getServiceUnitCost(
  serviceLine: { servicio?: string; costoU?: number; precioU?: number },
  servicesCatalog: Service[] = []
): number {
  if (
    serviceLine.costoU !== undefined &&
    serviceLine.costoU !== null &&
    Number(serviceLine.costoU) > 0
  ) {
    return Number(serviceLine.costoU);
  }

  if (serviceLine.servicio && servicesCatalog && servicesCatalog.length > 0) {
    const normalizedName = serviceLine.servicio.trim().toLowerCase();
    const catalogMatch =
      servicesCatalog.find(
        (s) => s.nombreServicio.trim().toLowerCase() === normalizedName
      ) ||
      servicesCatalog.find((s) => {
        const catNorm = s.nombreServicio.trim().toLowerCase();
        return catNorm.includes(normalizedName) || normalizedName.includes(catNorm);
      });

    if (catalogMatch && catalogMatch.costo !== undefined && Number(catalogMatch.costo) > 0) {
      return Number(catalogMatch.costo);
    }
  }

  // Fallback: estimate from sale price if present (~60% standard agency nurse cost)
  if (serviceLine.precioU && Number(serviceLine.precioU) > 0) {
    return Math.round(Number(serviceLine.precioU) * 0.6);
  }

  // Standard baseline shift cost in nursing care
  return 600;
}

/**
 * Calculates comprehensive financial metrics for a single carátula.
 */
export function calculateCaratulaCostStats(
  caratula: Caratula,
  servicesCatalog: Service[] = [],
  expenses: Expense[] = [],
  calendarEvents: CalendarEvent[] = []
): CaratulaCostStats {
  const folio = caratula.folio || "";
  const folioClean = folio.trim().toUpperCase();
  const totalVenta = caratula.total || 0;
  const pagadoCliente = caratula.pagado || 0;
  const deudaCliente =
    caratula.pendiente !== undefined && caratula.pendiente >= 0
      ? caratula.pendiente
      : Math.max(0, totalVenta - pagadoCliente);

  const isClienteLiquidado = deudaCliente <= 0;

  // Collect all shifts from caratula.guardiasProgramadas and linked calendarEvents strictly for this carátula
  const caratulaGuardias = (Array.isArray(caratula.guardiasProgramadas) ? caratula.guardiasProgramadas : []).filter(
    (g) => !g.caratulaFolio || g.caratulaFolio.trim().toUpperCase() === folioClean
  );
  const linkedEvents = calendarEvents.filter(
    (ev) =>
      Boolean(ev.caratulaFolio && ev.caratulaFolio.trim().toUpperCase() === folioClean)
  );

  // Consolidate shift fees without duplicates
  const rawShifts: Array<{ id?: string; folioGuardia?: string; fecha?: string; horaInicio?: string; tipoServicio?: string; costoHonorarios?: number; honorarioPagado?: boolean }> = [];

  caratulaGuardias.forEach((g) => {
    rawShifts.push({
      id: g.id,
      folioGuardia: g.folioGuardia,
      fecha: g.fecha,
      horaInicio: g.horaInicio,
      tipoServicio: g.tipoServicio,
      costoHonorarios:
        g.costoHonorarios !== undefined && g.costoHonorarios !== null && Number(g.costoHonorarios) > 0
          ? Number(g.costoHonorarios)
          : undefined,
      honorarioPagado: Boolean(g.honorarioPagado),
    });
  });

  linkedEvents.forEach((ev) => {
    const existingIdx = rawShifts.findIndex((s) => isSameGuardia(s, ev));
    if (existingIdx >= 0) {
      const existing = rawShifts[existingIdx];
      rawShifts[existingIdx] = {
        ...existing,
        folioGuardia: ev.folioGuardia || existing.folioGuardia,
        costoHonorarios:
          ev.costoHonorarios !== undefined && ev.costoHonorarios !== null && Number(ev.costoHonorarios) > 0
            ? Number(ev.costoHonorarios)
            : existing.costoHonorarios,
        tipoServicio: ev.tipoServicio || existing.tipoServicio,
        honorarioPagado: existing.honorarioPagado || Boolean(ev.honorarioPagado),
      };
    } else {
      rawShifts.push({
        id: ev.id,
        folioGuardia: ev.folioGuardia,
        fecha: ev.fechaInicio ? ev.fechaInicio.split("T")[0] : "",
        horaInicio: ev.fechaInicio?.split("T")[1]?.slice(0, 5) || "08:00",
        tipoServicio: ev.tipoServicio,
        costoHonorarios:
          ev.costoHonorarios !== undefined && ev.costoHonorarios !== null && Number(ev.costoHonorarios) > 0
            ? Number(ev.costoHonorarios)
            : undefined,
        honorarioPagado: Boolean(ev.honorarioPagado),
      });
    }
  });

  const deduplicatedShifts = deduplicateShiftsList(rawShifts);
  const consolidatedShifts = deduplicatedShifts.map((s) => ({
    costoHonorarios: s.costoHonorarios,
    tipoServicio: s.tipoServicio,
    isPaid: Boolean(s.honorarioPagado),
  }));

  // Calculate budgeted staff cost based on custom override, individual scheduled shifts, or service lines
  let costoPresupuestado = 0;
  if (
    caratula.honorarioPersonalPersonalizado !== undefined &&
    caratula.honorarioPersonalPersonalizado !== null &&
    Number(caratula.honorarioPersonalPersonalizado) > 0
  ) {
    costoPresupuestado = Number(caratula.honorarioPersonalPersonalizado);
  } else {
    if (consolidatedShifts.length > 0) {
      costoPresupuestado = consolidatedShifts.reduce((sum, s) => {
        if (s.costoHonorarios !== undefined && s.costoHonorarios !== null && Number(s.costoHonorarios) > 0) {
          return sum + Number(s.costoHonorarios);
        }
        const matchingLine =
          (caratula.servicios || []).find((line) => line.servicio === s.tipoServicio) || caratula.servicios?.[0];
        const uCost = matchingLine ? getServiceUnitCost(matchingLine, servicesCatalog) : 600;
        return sum + uCost;
      }, 0);
    } else if (caratulaGuardias.length > 0) {
      costoPresupuestado = caratulaGuardias.reduce((sum, g) => {
        if (g.costoHonorarios !== undefined && g.costoHonorarios !== null && Number(g.costoHonorarios) > 0) {
          return sum + Number(g.costoHonorarios);
        }
        const matchingLine =
          (caratula.servicios || []).find((s) => s.servicio === g.tipoServicio) || caratula.servicios?.[0];
        const uCost = matchingLine ? getServiceUnitCost(matchingLine, servicesCatalog) : 600;
        return sum + uCost;
      }, 0);
    } else if (Array.isArray(caratula.servicios) && caratula.servicios.length > 0) {
      costoPresupuestado = caratula.servicios.reduce((sum, line) => {
        const uCost = getServiceUnitCost(line, servicesCatalog);
        const qty = Number(line.cantidad) || 1;
        return sum + qty * uCost;
      }, 0);
    }
  }

  // Filter active expenses linked directly to this carátula (case-insensitive)
  const linkedExpenses = expenses.filter(
    (e) =>
      (e.caratulaFolio || "").trim().toUpperCase() === folioClean &&
      e.estado !== "Cancelado"
  );

  const honorariosPagados = linkedExpenses
    .filter((e) => e.categoria === "Honorarios Enfermería")
    .reduce((sum, e) => sum + (e.monto || 0), 0);

  const otrosGastosPagados = linkedExpenses
    .filter((e) => e.categoria !== "Honorarios Enfermería")
    .reduce((sum, e) => sum + (e.monto || 0), 0);

  const totalGastosPagados = honorariosPagados + otrosGastosPagados;

  // Count shifts strictly for this carátula
  const allShifts = (Array.isArray(caratula.guardiasProgramadas) ? caratula.guardiasProgramadas : []).filter(
    (g) => !g.caratulaFolio || g.caratulaFolio.trim().toUpperCase() === folioClean
  );
  const totalShiftsCount =
    consolidatedShifts && consolidatedShifts.length > 0 ? consolidatedShifts.length : allShifts.length;
  const unpaidShiftsCount =
    consolidatedShifts && consolidatedShifts.length > 0
      ? consolidatedShifts.filter((s) => !s.isPaid).length
      : allShifts.filter((g) => !g.honorarioPagado).length;

  let honorariosPendientes = Math.max(0, costoPresupuestado - honorariosPagados);
  const costoTotalPendiente = Math.max(0, costoPresupuestado - totalGastosPagados);

  let status: "PAID" | "PARTIAL" | "PENDING" = "PENDING";
  let pctHonorariosPagado = 0;

  // A carátula can ONLY be truly PAID if there are no unpaid shifts remaining
  if (unpaidShiftsCount > 0) {
    if (honorariosPagados > 0) {
      status = "PARTIAL";
      pctHonorariosPagado =
        costoPresupuestado > 0
          ? Math.min(99, Math.round((honorariosPagados / costoPresupuestado) * 100))
          : 0;
    } else {
      status = "PENDING";
      pctHonorariosPagado = 0;
    }
    // Guarantee that pending amount reflects the debt if cost was set or default
    if (honorariosPendientes <= 0 && costoPresupuestado > 0) {
      honorariosPendientes = costoPresupuestado;
    } else if (honorariosPendientes <= 0 && unpaidShiftsCount > 0) {
      honorariosPendientes = unpaidShiftsCount * 600;
    }
  } else if (caratula.honorariosLiquidados === true) {
    // Manually marked as liquidated AND no unpaid shifts exist
    status = "PAID";
    honorariosPendientes = 0;
    pctHonorariosPagado = 100;
  } else if (costoPresupuestado > 0 && honorariosPagados >= costoPresupuestado) {
    status = "PAID";
    honorariosPendientes = 0;
    pctHonorariosPagado = 100;
  } else if (honorariosPagados > 0) {
    status = "PARTIAL";
    pctHonorariosPagado =
      costoPresupuestado > 0
        ? Math.min(100, Math.round((honorariosPagados / costoPresupuestado) * 100))
        : 0;
  } else {
    // Not liquidated and not covered yet: stays as PENDING
    status = "PENDING";
    pctHonorariosPagado = 0;
  }

  return {
    caratula,
    folio,
    clienteNombre: caratula.nombreCompletoCliente || "Cliente Sin Nombre",
    receptorNombre: caratula.nombreCompletoRS || "-",
    totalVenta,
    pagadoCliente,
    totalCobradoCliente: pagadoCliente,
    deudaCliente,
    isClienteLiquidado,
    costoPresupuestado,
    honorariosPagados,
    honorariosPendientes,
    otrosGastosPagados,
    totalGastosPagados,
    costoTotalPendiente,
    pctHonorariosPagado,
    status,
    totalShiftsCount,
    unpaidShiftsCount,
  };
}

/**
 * Calculates global reconciled financial figures for the entire agency.
 * Guarantees that Cuentas por Pagar = Total Honorarios Pendientes across all views.
 */
export function calculateGlobalFinancialSummary(
  caratulas: Caratula[],
  servicesCatalog: Service[] = [],
  expenses: Expense[] = [],
  abonos: AbonoTicket[] = [],
  calendarEvents: CalendarEvent[] = []
): GlobalFinancialSummary {
  // Only consider active, non-cancelled, non-quote carátulas
  const activeCaratulas = caratulas.filter(
    (c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización"
  );

  const activeExpenses = expenses.filter((e) => e.estado !== "Cancelado");
  const activeAbonos = abonos.filter((a) => a.estado !== "Cancelado");

  const caratulaStatsList = activeCaratulas.map((c) =>
    calculateCaratulaCostStats(c, servicesCatalog, activeExpenses, calendarEvents)
  );

  // 1. Cuentas por Cobrar (Clientes)
  const totalVentaContratada = caratulaStatsList.reduce((s, i) => s + i.totalVenta, 0);
  const totalCobradoClientes = caratulaStatsList.reduce((s, i) => s + i.pagadoCliente, 0);
  const totalDeudaClientes = caratulaStatsList.reduce((s, i) => s + i.deudaCliente, 0);

  // 2. Cuentas por Pagar (Honorarios a Personal de Enfermería)
  const totalHonorariosPresupuestados = caratulaStatsList.reduce(
    (s, i) => s + i.costoPresupuestado,
    0
  );
  const totalHonorariosPagados = caratulaStatsList.reduce(
    (s, i) => s + i.honorariosPagados,
    0
  );
  const totalHonorariosPendientes = caratulaStatsList.reduce(
    (s, i) => s + i.honorariosPendientes,
    0
  );

  const totalOtrosGastosCaratulas = caratulaStatsList.reduce(
    (s, i) => s + i.otrosGastosPagados,
    0
  );

  // 3. Gastos Generales de Agencia (No vinculados a un folio de carátula activo)
  const activeFoliosSet = new Set(activeCaratulas.map((c) => c.folio));
  const generalAgencyExpenses = activeExpenses.filter(
    (e) => !e.caratulaFolio || e.caratulaFolio === "AGENCIA" || e.caratulaFolio === "GENERAL" || !activeFoliosSet.has(e.caratulaFolio)
  );
  const totalGastosGeneralesAgencia = generalAgencyExpenses.reduce(
    (s, e) => s + (e.monto || 0),
    0
  );

  // 4. Caja Real
  const totalIngresosAbonosHistoricos = activeAbonos.reduce(
    (s, a) => s + (a.montoAbonado || 0),
    0
  );
  const totalEgresosHistoricos = activeExpenses.reduce((s, e) => s + (e.monto || 0), 0);
  const saldoRealCaja = totalIngresosAbonosHistoricos - totalEgresosHistoricos;

  return {
    totalVentaContratada,
    totalCobradoClientes,
    totalDeudaClientes,
    totalHonorariosPresupuestados,
    totalHonorariosPagados,
    totalHonorariosPendientes,
    totalOtrosGastosCaratulas,
    totalGastosGeneralesAgencia,
    totalEgresosHistoricos,
    totalIngresosAbonosHistoricos,
    saldoRealCaja,
    caratulaStatsList,
  };
}
