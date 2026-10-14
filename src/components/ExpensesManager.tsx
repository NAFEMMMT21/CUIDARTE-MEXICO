import React, { useState } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import {
  DollarSign,
  PlusCircle,
  Receipt,
  Search,
  Trash2,
  Edit2,
  TrendingDown,
  CheckCircle2,
  Clock,
  Building2,
  Filter,
  FileText,
  UserCheck,
  RefreshCw,
  AlertCircle,
  X
} from "lucide-react";
import { Caratula, Expense, ExpenseCategory, Service, Sucursal, UserSession } from "../types";
import { formatCurrency } from "../utils/formatters";
import { calculateCaratulaCostStats, calculateGlobalFinancialSummary } from "../utils/financeCalculations";

interface ExpensesManagerProps {
  caratulas: Caratula[];
  services?: Service[];
  expenses: Expense[];
  sucursales?: Sucursal[];
  userSession?: UserSession | null;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  currentUserName?: string;
  onNavigateToHonorarios?: () => void;
}

const CATEGORIES: ExpenseCategory[] = [
  "Honorarios Enfermería",
  "Materiales y Suministros",
  "Transporte",
  "Gastos Administrativos",
  "Otro"
];

export const ExpensesManager: React.FC<ExpensesManagerProps> = ({
  caratulas,
  services = [],
  expenses,
  sucursales = [],
  userSession,
  onSaveExpense,
  onDeleteExpense,
  currentUserName = "Administrador",
  onNavigateToHonorarios,
}) => {
  const [selectedFolioFilter, setSelectedFolioFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Lock body scroll when any modal in ExpensesManager is open
  useLockBodyScroll(Boolean(isFormOpen || expenseToDelete));
  const [expenseToCancel, setExpenseToCancel] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState("Error de captura / Pago duplicado");
  const [formError, setFormError] = useState("");

  const [formFolio, setFormFolio] = useState<string>("");
  const [formConcepto, setFormConcepto] = useState<string>("");
  const [formMonto, setFormMonto] = useState<string>("");
  const [formCategoria, setFormCategoria] = useState<ExpenseCategory>("Honorarios Enfermería");
  const [formNotas, setFormNotas] = useState<string>("");

  // Open modal for NEW expense
  const handleOpenNewExpense = (presetFolio?: string) => {
    setEditingExpense(null);
    setFormFolio(presetFolio || "AGENCIA");
    setFormConcepto("");
    setFormMonto("");
    setFormCategoria("Gastos Administrativos");
    setFormNotas("");
    setFormError("");
    setIsFormOpen(true);
  };

  // Open modal for EDITING expense
  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setFormFolio(exp.caratulaFolio);
    setFormConcepto(exp.concepto);
    setFormMonto(exp.monto.toString());
    setFormCategoria(exp.categoria);
    setFormNotas(exp.notas || "");
    setFormError("");
    setIsFormOpen(true);
  };

  const handleOpenCancelExpense = (exp: Expense) => {
    setExpenseToCancel(exp);
    setCancelReason("Error de captura / Pago duplicado");
  };

  const handleConfirmCancelExpense = () => {
    if (expenseToCancel) {
      onSaveExpense({
        ...expenseToCancel,
        estado: "Cancelado",
        motivoCancelacion: cancelReason.trim() || "Cancelado por administración",
        fechaCancelacion: new Date().toLocaleString(),
        canceladoPor: currentUserName
      });
      setExpenseToCancel(null);
    }
  };

  const handleReactivateExpense = (exp: Expense) => {
    onSaveExpense({
      ...exp,
      estado: "Activo",
      motivoCancelacion: undefined,
      fechaCancelacion: undefined,
      canceladoPor: undefined,
    });
  };

  const handleConfirmDeleteExpense = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!formFolio || !formConcepto.trim() || !formMonto || Number(formMonto) <= 0) {
      setFormError("Por favor completa todos los campos requeridos con un monto válido.");
      return;
    }

    const expId = editingExpense ? editingExpense.id : `EXP-${Date.now().toString().slice(-6)}`;
    const linkedCaratula = caratulas.find((c) => c.folio === formFolio);
    const resolvedSucursalId =
      linkedCaratula?.sucursalId ||
      userSession?.sucursalId ||
      sucursales[0]?.id ||
      "pachuca";
    const resolvedSucursalNombre =
      linkedCaratula?.sucursalNombre ||
      sucursales.find((s) => s.id === resolvedSucursalId)?.nombre ||
      userSession?.sucursalNombre ||
      "Cuidarte México";

    const newExpense: Expense = {
      id: expId,
      caratulaFolio: formFolio,
      concepto: formConcepto.trim(),
      monto: Number(formMonto),
      categoria: formCategoria,
      timestamp: editingExpense ? editingExpense.timestamp : new Date().toLocaleString(),
      registradoPor: currentUserName,
      notas: formNotas.trim(),
      estado: editingExpense ? editingExpense.estado || "Activo" : "Activo",
      sucursalId: resolvedSucursalId,
      sucursalNombre: resolvedSucursalNombre,
    };

    onSaveExpense(newExpense);
    setIsFormOpen(false);
  };

  // Unified Global Financial Calculations
  const globalSummary = calculateGlobalFinancialSummary(caratulas, services, expenses);
  const validCaratulasForCosts = caratulas.filter(
    (c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización"
  );

  const totalCostosEstimadosTodos = globalSummary.totalHonorariosPresupuestados;
  const totalHonorariosPagadosTodos = globalSummary.totalHonorariosPagados;
  const totalHonorariosPendientesTodos = globalSummary.totalHonorariosPendientes;
  const totalGastosGeneralesAgencia = globalSummary.totalGastosGeneralesAgencia;
  const totalEgresosHistoricos = globalSummary.totalEgresosHistoricos;

  // Filtered Expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesFolio = selectedFolioFilter === "ALL" || e.caratulaFolio === selectedFolioFilter;
    const matchesCategory = selectedCategoryFilter === "ALL" || e.categoria === selectedCategoryFilter;
    const isCancelled = e.estado === "Cancelado";
    const matchesStatus =
      selectedStatusFilter === "ALL" ||
      (selectedStatusFilter === "Activo" && !isCancelled) ||
      (selectedStatusFilter === "Cancelado" && isCancelled);

    const caratulaObj = caratulas.find((c) => c.folio === e.caratulaFolio);
    const clientName = caratulaObj ? caratulaObj.nombreCompletoCliente.toLowerCase() : "";

    const matchesSearch =
      searchTerm.trim() === "" ||
      e.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.caratulaFolio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.includes(searchTerm.toLowerCase());

    return matchesFolio && matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <Receipt className="w-3.5 h-3.5" />
            Control de Gastos y Costos Operativos
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Descuento y Pago de Costos por Servicio
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
            Registra los gastos efectuados (honorarios de personal, medicamentos, traslados) para descontar progresivamente el costo asignado a cada carátula de servicio.
          </p>
        </div>

        <button
          onClick={() => handleOpenNewExpense()}
          className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-rose-900/40 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Registrar Nuevo Gasto / Pago
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Presupuesto Guardias
            </p>
            <p className="text-lg font-black text-slate-900 mt-0.5 font-mono">
              {formatCurrency(totalCostosEstimadosTodos)}
            </p>
            <p className="text-[10px] text-slate-400">Honorarios calculados</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Honorarios Pagados
            </p>
            <p className="text-lg font-black text-emerald-600 mt-0.5 font-mono">
              {formatCurrency(totalHonorariosPagadosTodos)}
            </p>
            <p className="text-[10px] text-emerald-600/80 font-medium">
              Dispersado a personal
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Honorarios Pendientes
            </p>
            <p className="text-lg font-black text-rose-600 mt-0.5 font-mono">
              {formatCurrency(totalHonorariosPendientesTodos)}
            </p>
            <p className="text-[10px] text-rose-600/80 font-medium">
              Cuentas por pagar a personal
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Gastos Agencia / Total
            </p>
            <p className="text-lg font-black text-amber-700 mt-0.5 font-mono">
              {formatCurrency(totalGastosGeneralesAgencia)}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Total Egresos: {formatCurrency(totalEgresosHistoricos)}
            </p>
          </div>
        </div>
      </div>

      {/* Services Cost Breakdown Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-600" />
            Estado de Pago de Costos por Carátula de Servicio
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {validCaratulasForCosts.length} Servicios Activos / Históricos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {validCaratulasForCosts.map((c) => {
            const stats = calculateCaratulaCostStats(c, services, expenses);
            return (
              <div
                key={c.folio}
                className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl p-4 transition-all"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                        {c.folio}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          c.estado === "Completado"
                            ? "bg-emerald-100 text-emerald-800"
                            : c.estado === "Cancelado"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {c.estado || "Activo"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">
                      {c.nombreCompletoCliente}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Receptor: <span className="font-medium text-slate-700">{c.nombreCompletoRS || "-"}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenNewExpense(c.folio)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shrink-0"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Abonar Gasto
                  </button>
                </div>

                {/* Client Payment Status vs Staff Honorarios Distinction */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs mb-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Cobro a Cliente:</span>
                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                      stats.isClienteLiquidado
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}>
                      {stats.isClienteLiquidado
                        ? "✓ Cliente Pagó 100%"
                        : `Pendiente: ${formatCurrency(stats.deudaCliente)}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Total Carátula: {formatCurrency(stats.totalVenta)}</span>
                    <span className="text-emerald-700 font-bold">Cobrado: {formatCurrency(stats.totalCobradoCliente)}</span>
                  </div>
                </div>

                {/* Costs Summary Line (Staff Honorarios & Supplies) */}
                <div className="grid grid-cols-3 gap-2 bg-white rounded-lg p-2.5 border border-slate-200 text-center my-2">
                  <div>
                    <span className="text-[9px] uppercase font-black text-slate-500 block leading-tight">
                      Presupuesto Personal
                    </span>
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      {formatCurrency(stats.costoPresupuestado)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-emerald-600 block leading-tight">
                      Honorarios Pagados
                    </span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">
                      {formatCurrency(stats.honorariosPagados)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-black text-rose-600 block leading-tight">
                      Por Pagar a Personal
                    </span>
                    <span className="text-xs font-bold text-rose-600 font-mono">
                      {formatCurrency(stats.honorariosPendientes)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>Dispersión a Personal</span>
                    <span className="font-bold text-slate-700">{stats.pctHonorariosPagado}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        stats.pctHonorariosPagado >= 100
                          ? "bg-emerald-500"
                          : stats.pctHonorariosPagado > 50
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${stats.pctHonorariosPagado}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expenses History List & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-600" />
            Historial General de Gastos y Salidas
          </h2>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por concepto o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Folio Filter */}
            <select
              value={selectedFolioFilter}
              onChange={(e) => setSelectedFolioFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            >
              <option value="ALL">Todos los Registros</option>
              <option value="AGENCIA">🏢 Solo Gastos Generales Agencia</option>
              {caratulas.map((c) => (
                <option key={c.folio} value={c.folio}>
                  📄 {c.folio} - {c.nombreCompletoCliente}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
            >
              <option value="ALL">Todas las Categorías</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
            >
              <option value="ALL">Todos los Estatus</option>
              <option value="Activo">Solo Activos</option>
              <option value="Cancelado">Solo Cancelados</option>
            </select>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Folio Servicio</th>
                <th className="py-3 px-4">Concepto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-right">Monto Pagado</th>
                <th className="py-3 px-4 text-center">Registró</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 font-medium">
                    No se encontraron registros de gastos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const isCancelled = exp.estado === "Cancelado";
                  return (
                    <tr
                      key={exp.id}
                      className={`transition-colors ${
                        isCancelled ? "bg-rose-50/40 text-slate-400" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {exp.timestamp}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {!exp.caratulaFolio || exp.caratulaFolio === "AGENCIA" || exp.caratulaFolio === "GENERAL" ? (
                          <span className="font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-700" />
                            Gasto General Agencia
                          </span>
                        ) : (
                          <span className="font-mono font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800">
                            {exp.caratulaFolio}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-xs">
                        <span className={isCancelled ? "line-through text-slate-400" : ""}>
                          {exp.concepto}
                        </span>
                        {exp.notas && (
                          <p className="text-[11px] text-slate-400 font-normal truncate">
                            {exp.notas}
                          </p>
                        )}
                        {isCancelled && exp.motivoCancelacion && (
                          <p className="text-[11px] text-rose-600 font-medium mt-0.5 italic">
                            Motivo cancelado: {exp.motivoCancelacion}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 font-medium px-2.5 py-0.5 rounded-full text-[11px]">
                          {exp.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isCancelled ? (
                          <span className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase">
                            Cancelado
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                            Activo
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-4 text-right whitespace-nowrap font-black text-sm ${
                          isCancelled ? "text-slate-400 line-through" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(exp.monto)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap text-slate-500 text-[11px]">
                        {exp.registradoPor || "Admin"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isCancelled ? (
                            <button
                              onClick={() => handleReactivateExpense(exp)}
                              title="Reactivar gasto"
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded-lg transition-colors border border-emerald-300 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Reactivar
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenEditExpense(exp)}
                                title="Editar gasto"
                                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenCancelExpense(exp)}
                                title="Cancelar gasto"
                                className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold rounded-lg transition-colors border border-rose-300"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpenseToDelete(exp)}
                            title="Eliminar registro"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal Cancel Expense */}
      {expenseToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </span>
                <h3 className="font-black text-slate-900 text-base">Cancelar Gasto</h3>
              </div>
              <button
                onClick={() => setExpenseToCancel(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Desea marcar como <strong>CANCELADO</strong> el gasto de <strong>{formatCurrency(expenseToCancel.monto)}</strong> por concepto de <em>"{expenseToCancel.concepto}"</em>?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo de Cancelación:
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. Error de captura / Duplicado"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExpenseToCancel(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelExpense}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Delete Expense */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </span>
                <h3 className="font-black text-slate-900 text-base">Eliminar Registro de Gasto</h3>
              </div>
              <button
                onClick={() => setExpenseToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Está seguro de eliminar definitivamente el gasto <strong>"{expenseToDelete.concepto}"</strong> por <strong>{formatCurrency(expenseToDelete.monto)}</strong>? Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteExpense}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all"
              >
                Sí, Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog for Adding / Editing Expense */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </span>
                <h3 className="font-black text-slate-900 text-base">
                  {editingExpense ? "Editar Registro de Gasto" : "Nuevo Registro de Gasto / Egreso"}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Select Caratula */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Servicio / Carátula Asociada *
                </label>
                <select
                  value={formFolio}
                  onChange={(e) => setFormFolio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  required
                >
                  <option value="AGENCIA">🏢 Gasto General de la Agencia (Sin Carátula)</option>
                  {caratulas.map((c) => (
                    <option key={c.folio} value={c.folio}>
                      📄 {c.folio} - {c.nombreCompletoCliente}
                    </option>
                  ))}
                </select>
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Concepto del Gasto / Pago *
                </label>
                <input
                  type="text"
                  placeholder="Ej. Pago Turno 1 Enfermería"
                  value={formConcepto}
                  onChange={(e) => setFormConcepto(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  required
                />
              </div>

              {/* Monto & Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Monto a Pagar ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={formMonto}
                      onChange={(e) => setFormMonto(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Notas / Comprobante (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Transferencia No. 892110 / Factura o recibo"
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-900/20 transition-all"
                >
                  {editingExpense ? "Guardar Cambios" : "Registrar Gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
