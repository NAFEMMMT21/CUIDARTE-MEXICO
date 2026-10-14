import React, { useState } from "react";
import { Caratula, Expense, ServiceItem, AbonoTicket } from "../types";
import { formatCurrency } from "../utils/formatters";
import { calculateGlobalFinancialSummary, calculateCaratulaCostStats, CaratulaCostStats } from "../utils/financeCalculations";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Calendar,
  Building2,
  CreditCard,
  Banknote,
  Landmark,
  ArrowDownRight,
  Filter,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  Phone,
  FileText
} from "lucide-react";

interface FinancialDashboardProps {
  caratulas: Caratula[];
  services: ServiceItem[];
  expenses?: Expense[];
  abonos?: AbonoTicket[];
  onNavigateToHonorarios?: () => void;
  onNavigateToExpenses?: () => void;
}

/**
 * Calculates Tuesday to Sunday range for the current week or a reference date
 */
export function getTuesdayToSundayRange(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  
  // Offset to get back to the most recent Tuesday:
  // Tue (2) -> 0 days ago
  // Wed (3) -> 1 day ago
  // Thu (4) -> 2 days ago
  // Fri (5) -> 3 days ago
  // Sat (6) -> 4 days ago
  // Sun (0) -> 5 days ago
  // Mon (1) -> 6 days ago
  const daysSinceTuesday = day >= 2 ? day - 2 : day + 5;

  const tuesday = new Date(d);
  tuesday.setDate(d.getDate() - daysSinceTuesday);
  tuesday.setHours(0, 0, 0, 0);

  const sunday = new Date(tuesday);
  sunday.setDate(tuesday.getDate() + 5);
  sunday.setHours(23, 59, 59, 999);

  return {
    tuesday,
    sunday,
    startFormatted: tuesday.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
    endFormatted: sunday.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
  };
}

/**
 * Helper to safely parse date strings into Date objects
 */
function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

  // Try parsing "DD/MM/YYYY" or "YYYY-MM-DD"
  const clean = dateStr.split(",")[0].trim();
  const parts = clean.split(/[/|-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  return null;
}

export const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  caratulas = [],
  services = [],
  expenses = [],
  abonos = [],
  onNavigateToHonorarios,
  onNavigateToExpenses,
}) => {
  const [period, setPeriod] = useState<"semana" | "mes" | "todos">("semana");
  const [clientSearch, setClientSearch] = useState("");
  const [clientDebtFilter, setClientDebtFilter] = useState<"ALL" | "DEBT" | "PAID">("ALL");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const weekRange = getTuesdayToSundayRange();

  // 1. Filter active abonos and expenses by the selected time period
  const activeAbonos = abonos.filter((a) => a.estado !== "Cancelado");
  const activeExpenses = expenses.filter((e) => e.estado !== "Cancelado");

  const filteredAbonos = activeAbonos.filter((a) => {
    if (period === "todos") return true;
    const aDate = parseDate(a.fecha);
    if (!aDate) return true;

    if (period === "semana") {
      return aDate >= weekRange.tuesday && aDate <= weekRange.sunday;
    } else if (period === "mes") {
      const now = new Date();
      return aDate.getMonth() === now.getMonth() && aDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const filteredExpenses = activeExpenses.filter((e) => {
    if (period === "todos") return true;
    const eDate = parseDate(e.timestamp);
    if (!eDate) return true;

    if (period === "semana") {
      return eDate >= weekRange.tuesday && eDate <= weekRange.sunday;
    } else if (period === "mes") {
      const now = new Date();
      return eDate.getMonth() === now.getMonth() && eDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  // 2. Compute Period Income & Expenses
  const ingresoPeriodo = filteredAbonos.reduce((sum, a) => sum + (a.montoAbonado || 0), 0);
  const gastoPeriodo = filteredExpenses.reduce((sum, e) => sum + (e.monto || 0), 0);
  const balanceNetoPeriodo = ingresoPeriodo - gastoPeriodo;

  // Breakdown of income by payment method in filtered period
  const abonosEfectivo = filteredAbonos.filter((a) => a.metodoPago === "Efectivo").reduce((s, a) => s + a.montoAbonado, 0);
  const abonosTransferencia = filteredAbonos.filter((a) => a.metodoPago?.toLowerCase().includes("transferencia")).reduce((s, a) => s + a.montoAbonado, 0);
  const abonosTarjeta = filteredAbonos.filter((a) => a.metodoPago?.toLowerCase().includes("tarjeta")).reduce((s, a) => s + a.montoAbonado, 0);
  const abonosOtros = ingresoPeriodo - (abonosEfectivo + abonosTransferencia + abonosTarjeta);

  // 3. CONTROL REAL DE CAJA Y BALANCE GLOBAL UNIFICADO
  const globalSummary = calculateGlobalFinancialSummary(caratulas, services, activeExpenses, activeAbonos);

  const totalAbonosHistoricos = globalSummary.totalIngresosAbonosHistoricos;
  const totalGastosHistoricos = globalSummary.totalEgresosHistoricos;
  const saldoRealEnCaja = globalSummary.saldoRealCaja;

  // Cash breakdown in box
  const totalEfectivoHistorico = activeAbonos.filter((a) => a.metodoPago === "Efectivo").reduce((s, a) => s + a.montoAbonado, 0);
  const totalTransferenciasHistorico = activeAbonos.filter((a) => a.metodoPago?.toLowerCase().includes("transferencia")).reduce((s, a) => s + a.montoAbonado, 0);
  const totalTarjetasHistorico = activeAbonos.filter((a) => a.metodoPago?.toLowerCase().includes("tarjeta")).reduce((s, a) => s + a.montoAbonado, 0);

  // 4. CUENTAS POR COBRAR TOTAL (Deuda Total de Clientes de Todos los Servicios)
  const activeCaratulas = caratulas.filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización");
  const deudaTotalClientes = globalSummary.totalDeudaClientes;

  // 5. CUENTAS POR PAGAR (Costos / Honorarios de Personal Pendientes de Pago - Reconciled 100%)
  const caratulaStats = globalSummary.caratulaStatsList;
  const totalCostosEstimados = globalSummary.totalHonorariosPresupuestados;
  const totalGastosCaratulas = globalSummary.totalHonorariosPagados;
  const totalCuentasPorPagarEstimadas = globalSummary.totalHonorariosPendientes;

  // General Agency Expenses (caratulaFolio === "AGENCIA" or no folio)
  const generalAgencyExpenses = activeExpenses.filter(
    (e) => !e.caratulaFolio || e.caratulaFolio === "AGENCIA" || e.caratulaFolio === "GENERAL"
  );
  const totalGastosGeneralesAgencia = globalSummary.totalGastosGeneralesAgencia;

  // 6. CLIENT-SPECIFIC DEBT & BALANCE AGGREGATION
  const clientMap = new Map<string, {
    clientKey: string;
    nombreCliente: string;
    nombreRS: string;
    telefono: string;
    caratulas: Caratula[];
    totalVenta: number;
    totalPagado: number;
    saldoPendienteTotal: number;
  }>();

  activeCaratulas.forEach((c) => {
    const key = (c.nombreCompletoCliente || "Sin Nombre").trim().toLowerCase();
    const existing = clientMap.get(key) || {
      clientKey: key,
      nombreCliente: c.nombreCompletoCliente || "Cliente General",
      nombreRS: c.nombreCompletoRS || "-",
      telefono: c.telefono || "-",
      caratulas: [],
      totalVenta: 0,
      totalPagado: 0,
      saldoPendienteTotal: 0,
    };

    const pag = c.pagado || 0;
    const pend = c.pendiente !== undefined ? c.pendiente : Math.max(0, (c.total || 0) - pag);

    existing.caratulas.push(c);
    existing.totalVenta += (c.total || 0);
    existing.totalPagado += pag;
    existing.saldoPendienteTotal += pend;
    if (c.telefono && existing.telefono === "-") {
      existing.telefono = c.telefono;
    }
    if (c.nombreCompletoRS && existing.nombreRS === "-") {
      existing.nombreRS = c.nombreCompletoRS;
    }

    clientMap.set(key, existing);
  });

  const clientSummaryList = Array.from(clientMap.values()).sort((a, b) => b.saldoPendienteTotal - a.saldoPendienteTotal);

  const filteredClients = clientSummaryList.filter((cli) => {
    const term = clientSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      cli.nombreCliente.toLowerCase().includes(term) ||
      cli.nombreRS.toLowerCase().includes(term) ||
      cli.telefono.includes(term) ||
      cli.caratulas.some((c) => c.folio.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (clientDebtFilter === "DEBT") {
      return cli.saldoPendienteTotal > 0;
    } else if (clientDebtFilter === "PAID") {
      return cli.saldoPendienteTotal <= 0;
    }
    return true;
  });

  const totalClientesConDeuda = clientSummaryList.filter((c) => c.saldoPendienteTotal > 0).length;
  const totalClientesAlDia = clientSummaryList.filter((c) => c.saldoPendienteTotal <= 0).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER BANNER & PERIOD FILTER */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">
              Control de Ingresos, Caja y Finanzas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Balance operativo semanal (Miércoles a Martes), estado de caja real y cuentas pendientes.
            </p>
          </div>
        </div>

        {/* Period Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold shrink-0">
          <button
            onClick={() => setPeriod("semana")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              period === "semana"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Semana Actual (Mié - Mar)</span>
          </button>

          <button
            onClick={() => setPeriod("mes")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              period === "mes"
                ? "bg-sky-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Mes Actual</span>
          </button>

          <button
            onClick={() => setPeriod("todos")}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              period === "todos"
                ? "bg-slate-700 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>Histórico Total</span>
          </button>
        </div>
      </div>

      {/* WEEK DATE NOTICE */}
      {period === "semana" && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>
              Período de la Semana Actual: <strong className="text-emerald-800">{weekRange.startFormatted}</strong> al <strong className="text-emerald-800">{weekRange.endFormatted}</strong>
            </span>
          </div>
          <span className="bg-emerald-200 text-emerald-900 font-black px-2.5 py-0.5 rounded-full text-[10px] uppercase">
            Miércoles a Martes
          </span>
        </div>
      )}

      {/* SECTION 1: PERÍODO SELECCIONADO (SEMANA ACTUAL / MES) */}
      <div className="space-y-3">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          {period === "semana"
            ? "Métricas de la Semana Actual (Miércoles a Martes)"
            : period === "mes"
            ? "Métricas del Mes Actual"
            : "Métricas Históricas Totales"}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Ingresos Cobrados */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-emerald-100 opacity-30 pointer-events-none">
              <Banknote className="w-16 h-16" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
                Ingresos Cobrados ({period === "semana" ? "Esta Semana" : period === "mes" ? "Este Mes" : "Total"})
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {formatCurrency(ingresoPeriodo)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {filteredAbonos.length} abono(s) recibido(s)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] font-medium text-slate-600">
              <div>
                <span className="block text-slate-400 font-bold">Efectivo</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(abonosEfectivo)}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold">Transf.</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(abonosTransferencia)}</span>
              </div>
              <div>
                <span className="block text-slate-400 font-bold">Tarjetas</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(abonosTarjeta)}</span>
              </div>
            </div>
          </div>

          {/* Gastos Registrados */}
          <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 text-rose-100 opacity-30 pointer-events-none">
              <Receipt className="w-16 h-16" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">
                Gastos Pagados ({period === "semana" ? "Esta Semana" : period === "mes" ? "Este Mes" : "Total"})
              </span>
              <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
                {formatCurrency(gastoPeriodo)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {filteredExpenses.length} gasto(s) efectuado(s)
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-500">
              <span>Incluye gastos de carátula y gastos generales de agencia.</span>
            </div>
          </div>

          {/* Balance Neto */}
          <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between relative overflow-hidden ${
            balanceNetoPeriodo >= 0 ? "bg-emerald-950 text-white border-emerald-800" : "bg-rose-950 text-white border-rose-800"
          }`}>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                Balance Neto del Período
              </span>
              <div className={`text-2xl font-black mt-1 font-mono ${balanceNetoPeriodo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {formatCurrency(balanceNetoPeriodo)}
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Ingresos Cobrados - Gastos Pagados
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-1.5 text-xs font-bold">
              {balanceNetoPeriodo >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Superávit Positivo</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-300">Déficit Operativo</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: CONTROL DE CAJA REAL & DEUDAS GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* DINERO REAL EN CAJA */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-4 h-4" />
                Dinero Real en Caja (Total Saldo)
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                Liquidez Neta
              </span>
            </div>

            <div className={`text-3xl font-black mt-2 font-mono ${saldoRealEnCaja >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
              {formatCurrency(saldoRealEnCaja)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Total acumulado de entradas cobradas menos salidas pagadas (sin importar el método de pago).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/80 grid grid-cols-3 gap-2 text-[10px] text-slate-300">
            <div>
              <span className="block text-slate-400 font-bold">Efectivo Total</span>
              <span className="font-mono font-bold text-emerald-300">{formatCurrency(totalEfectivoHistorico)}</span>
            </div>
            <div>
              <span className="block text-slate-400 font-bold">Transferencias</span>
              <span className="font-mono font-bold text-sky-300">{formatCurrency(totalTransferenciasHistorico)}</span>
            </div>
            <div>
              <span className="block text-slate-400 font-bold">Tarjetas</span>
              <span className="font-mono font-bold text-purple-300">{formatCurrency(totalTarjetasHistorico)}</span>
            </div>
          </div>
        </div>

        {/* CUENTAS POR COBRAR (DEUDA TOTAL DE CLIENTES DE TODOS LOS SERVICIOS) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Cuentas por Cobrar (Nos Deben)
              </span>
              <span className="bg-rose-100 text-rose-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200">
                Total Servicios
              </span>
            </div>

            <div className="text-3xl font-black text-rose-600 mt-2 font-mono">
              {formatCurrency(deudaTotalClientes)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Monto total acumulado que deben los clientes por todas las carátulas de servicio contratadas.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Servicios Activos: <strong className="text-slate-900 font-mono">{activeCaratulas.length}</strong></span>
            <span className="text-rose-600 font-bold text-[11px]">Saldo Pendiente Acumulado</span>
          </div>
        </div>

        {/* CUENTAS POR PAGAR (HONORARIOS / COSTOS ESTIMADOS PENDIENTES) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-rose-600" />
                Cuentas por Pagar (Honorarios Personal)
              </span>
              <span className="bg-rose-50 text-rose-800 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200">
                Honorarios de Guardias
              </span>
            </div>

            <div className="text-3xl font-black text-rose-600 mt-2 font-mono">
              {formatCurrency(totalCuentasPorPagarEstimadas)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Honorarios de servicios activos pendientes por dispersar al personal de enfermería.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600 font-medium">
            <span>Pagado a Personal: <strong className="text-emerald-600 font-mono">{formatCurrency(totalGastosCaratulas)}</strong></span>
            {onNavigateToHonorarios && (
              <button
                onClick={onNavigateToHonorarios}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 underline"
              >
                Dispersar Honorarios <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: DESGLOSE POR VENTA Y GASTOS GENERALES DE AGENCIA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TABLA PRINCIPAL: CARÁTULAS Y SERVICIOS (2 COLUMNAS) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-600" />
                Estado Financiero por Carátula de Servicio
              </h3>
              <p className="text-xs text-slate-500">
                Total de venta, cobranza a clientes, presupuesto de honorarios y cuentas por pagar a enfermeros.
              </p>
            </div>
            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg font-mono">
              {caratulaStats.length} Carátula(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Folio</th>
                  <th className="py-2.5 px-3">Cliente / Receptor</th>
                  <th className="py-2.5 px-3 text-right">Venta Total</th>
                  <th className="py-2.5 px-3 text-right">Cobrado</th>
                  <th className="py-2.5 px-3 text-right">Nos Debe</th>
                  <th className="py-2.5 px-3 text-right">Honorarios Pend.</th>
                  <th className="py-2.5 px-3 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {caratulaStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No hay carátulas activas registradas.
                    </td>
                  </tr>
                ) : (
                  caratulaStats.map((item) => (
                    <tr key={item.folio} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-sky-600 text-xs block">
                          {item.folio}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.caratula.timestamp?.slice(0, 10) || "-"}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {item.clienteNombre}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                          RS: {item.receptorNombre || "-"}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.totalVenta)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(item.totalCobradoCliente)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(item.deudaCliente)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                        {formatCurrency(item.honorariosPendientes)}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.isClienteLiquidado ? (
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                            Liquidado
                          </span>
                        ) : item.totalCobradoCliente > 0 ? (
                          <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[10px] border border-amber-200">
                            Abonado
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full text-[10px] border border-rose-200">
                            Pendiente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL SECUNDARIO: GASTOS GENERALES DE LA AGENCIA (SIN CARÁTULA) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                Gastos Generales de la Agencia
              </h3>
              <p className="text-xs text-slate-500">
                Gastos administrativos, rentas, servicios o insumos globales de la empresa.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-amber-900">Total Gastos Agencia:</span>
            <span className="font-mono font-black text-amber-800 text-sm">
              {formatCurrency(totalGastosGeneralesAgencia)}
            </span>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {generalAgencyExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay gastos generales registrados sin carátula.
              </p>
            ) : (
              generalAgencyExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 block">{exp.concepto}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {exp.categoria} • {exp.timestamp?.slice(0, 10)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-rose-600 shrink-0 ml-2">
                    {formatCurrency(exp.monto)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: CONSULTA DE SALDOS Y DEUDAS POR CLIENTE */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-2xl border border-rose-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Consulta de Saldos y Deudas por Cliente
              </h3>
              <p className="text-xs text-slate-500">
                Resumen consolidado de todos los servicios contratados, montos cobrados y saldo pendiente por cliente.
              </p>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center gap-2">
            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{totalClientesConDeuda} con deuda</span>
            </span>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{totalClientesAlDia} al día</span>
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente por nombre, receptor, teléfono o folio de carátula..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 text-xs font-bold">
            <button
              onClick={() => setClientDebtFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clientDebtFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos ({clientSummaryList.length})
            </button>
            <button
              onClick={() => setClientDebtFilter("DEBT")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clientDebtFilter === "DEBT"
                  ? "bg-rose-600 text-white shadow-xs font-black"
                  : "text-rose-600 hover:bg-rose-50"
              }`}
            >
              Con Deuda ({totalClientesConDeuda})
            </button>
            <button
              onClick={() => setClientDebtFilter("PAID")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                clientDebtFilter === "PAID"
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              Al Día ({totalClientesAlDia})
            </button>
          </div>
        </div>

        {/* Clients Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Cliente / Titular</th>
                <th className="py-3 px-4">Receptor del Servicio</th>
                <th className="py-3 px-4 text-center">Carátulas</th>
                <th className="py-3 px-4 text-right">Total Contratado</th>
                <th className="py-3 px-4 text-right">Total Pagado</th>
                <th className="py-3 px-4 text-right">Saldo Deudor</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    No se encontraron clientes que coincidan con la búsqueda o filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isExpanded = expandedClientId === client.clientKey;
                  const hasDebt = client.saldoPendienteTotal > 0;

                  return (
                    <React.Fragment key={client.clientKey}>
                      <tr
                        className={`hover:bg-slate-50 transition-colors ${
                          hasDebt ? "bg-rose-50/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {client.nombreCliente}
                          </div>
                          {client.telefono !== "-" && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{client.telefono}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-700">
                          {client.nombreRS}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {client.caratulas.length}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(client.totalVenta)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                          {formatCurrency(client.totalPagado)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-black text-sm">
                          <span
                            className={
                              hasDebt
                                ? "text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 inline-block"
                                : "text-emerald-700"
                            }
                          >
                            {formatCurrency(client.saldoPendienteTotal)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {hasDebt ? (
                            <span className="bg-rose-100 text-rose-800 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-full border border-rose-200">
                              Debe Saldo
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase px-2.5 py-1 rounded-full border border-emerald-200">
                              ✓ Liquidado
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedClientId(isExpanded ? null : client.clientKey)
                            }
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center justify-center mx-auto"
                            title={isExpanded ? "Ocultar carátulas" : "Ver carátulas del cliente"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row for individual Carátulas */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={8} className="p-4 border-t border-slate-200">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                              <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-sky-600" />
                                Carátulas de Servicio de {client.nombreCliente} ({client.caratulas.length})
                              </h5>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                                {client.caratulas.map((caratula) => {
                                  const carPag = caratula.pagado || 0;
                                  const carPend =
                                    caratula.pendiente !== undefined
                                      ? caratula.pendiente
                                      : Math.max(0, (caratula.total || 0) - carPag);

                                  return (
                                    <div
                                      key={caratula.folio}
                                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-mono">
                                        <span className="font-bold text-sky-700">{caratula.folio}</span>
                                        <span className="text-[10px] text-slate-400">
                                          {caratula.timestamp?.slice(0, 10) || "-"}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600">
                                        Total: <strong className="font-mono text-slate-900">{formatCurrency(caratula.total || 0)}</strong>
                                      </div>
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-emerald-700 font-mono">
                                          Pagado: {formatCurrency(carPag)}
                                        </span>
                                        <span
                                          className={`font-mono font-bold ${
                                            carPend > 0 ? "text-rose-600" : "text-slate-400"
                                          }`}
                                        >
                                          Debe: {formatCurrency(carPend)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
