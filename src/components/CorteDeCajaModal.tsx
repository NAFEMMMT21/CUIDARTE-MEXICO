import React, { useState, useRef } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { AbonoTicket, Expense, CorteDeCajaRecord, DenominationBreakdown } from "../types";
import { formatCurrency } from "../utils/formatters";
import { CuidarteLogo } from "./CuidarteLogo";
import {
  DollarSign,
  Printer,
  Calendar,
  CheckCircle2,
  X,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Calculator,
  AlertTriangle,
  FileText,
  Trash2,
  Eye,
  ShieldCheck,
  TrendingUp,
  Banknote
} from "lucide-react";

interface CorteDeCajaModalProps {
  abonos: AbonoTicket[];
  expenses: Expense[];
  cortesHistory?: CorteDeCajaRecord[];
  onSaveCorte: (corte: CorteDeCajaRecord) => Promise<void>;
  onDeleteCorte?: (id: string) => Promise<void>;
  onClose: () => void;
  currentUserName?: string;
  onCorteExecuted?: () => void;
}

export const CorteDeCajaModal: React.FC<CorteDeCajaModalProps> = ({
  abonos,
  expenses,
  cortesHistory = [],
  onSaveCorte,
  onDeleteCorte,
  onClose,
  currentUserName = "Cajero / Administración",
  onCorteExecuted,
}) => {
  useLockBodyScroll(true);

  const printRef = useRef<HTMLDivElement>(null);

  // Active view tab: "nuevo" (New Cut) vs "historial" (Past Cuts History) vs "ticket" (View Generated Ticket)
  const [activeTab, setActiveTab] = useState<"nuevo" | "historial" | "ticket">("nuevo");
  const [selectedCorteForTicket, setSelectedCorteForTicket] = useState<CorteDeCajaRecord | null>(null);

  // Date selection (default today YYYY-MM-DD)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // Last corte timestamp from localStorage
  const lastCorteIso = typeof window !== "undefined" ? localStorage.getItem("cuidarte_last_corte_timestamp") : null;
  const lastCorteFondo = typeof window !== "undefined" ? Number(localStorage.getItem("cuidarte_last_corte_fondo") || 1000) : 1000;

  // Form states for new cut
  const [filterMode, setFilterMode] = useState<"postCorte" | "fecha">("postCorte");
  const [fondoInicial, setFondoInicial] = useState<number>(lastCorteFondo);
  const [useDenominations, setUseDenominations] = useState<boolean>(true);
  const [directEfectivoContado, setDirectEfectivoContado] = useState<number>(0);

  // Denominations Breakdown state
  const [denominations, setDenominations] = useState<DenominationBreakdown>({
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    m20: 0,
    m10: 0,
    m5: 0,
    m2: 0,
    m1: 0,
    m050: 0,
  });

  // Retiro de caja & notas
  const [retiroEfectivo, setRetiroEfectivo] = useState<number>(0);
  const [notasCorte, setNotasCorte] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Calculate total from denominations
  const totalDenominaciones =
    (denominations.b1000 || 0) * 1000 +
    (denominations.b500 || 0) * 500 +
    (denominations.b200 || 0) * 200 +
    (denominations.b100 || 0) * 100 +
    (denominations.b50 || 0) * 50 +
    (denominations.b20 || 0) * 20 +
    (denominations.m20 || 0) * 20 +
    (denominations.m10 || 0) * 10 +
    (denominations.m5 || 0) * 5 +
    (denominations.m2 || 0) * 2 +
    (denominations.m1 || 0) * 1 +
    (denominations.m050 || 0) * 0.5;

  const efectivoFisicoContado = useDenominations ? totalDenominaciones : directEfectivoContado;

  // Filter Abonos (Income)
  const filteredAbonos = abonos.filter((a) => {
    if (a.estado === "Cancelado") return false;
    if (filterMode === "postCorte" && lastCorteIso) {
      return a.timestamp >= lastCorteIso || a.fecha >= lastCorteIso.slice(0, 10);
    }
    return (
      a.fecha.includes(selectedDate) ||
      a.fecha.startsWith(selectedDate) ||
      new Date(a.fecha).toISOString().slice(0, 10) === selectedDate
    );
  });

  // Filter Expenses (Egresos)
  const filteredExpenses = expenses.filter((e) => {
    if (e.estado === "Cancelado") return false;
    if (filterMode === "postCorte" && lastCorteIso) {
      return e.timestamp >= lastCorteIso;
    }
    return (
      e.timestamp.includes(selectedDate) ||
      e.timestamp.startsWith(selectedDate) ||
      new Date(e.timestamp).toISOString().slice(0, 10) === selectedDate
    );
  });

  // Income breakdowns
  const ingresosEfectivo = filteredAbonos
    .filter((a) => a.metodoPago === "Efectivo")
    .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

  const ingresosTransferencia = filteredAbonos
    .filter((a) => a.metodoPago === "Transferencia" || a.metodoPago === "Transferencia Bancaria")
    .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

  const ingresosTarjeta = filteredAbonos
    .filter(
      (a) =>
        a.metodoPago === "Tarjeta de Débito (TD)" ||
        a.metodoPago === "Tarjeta de Crédito (TC)" ||
        a.metodoPago === "Tarjeta de Débito/Crédito" ||
        a.metodoPago.includes("Tarjeta")
    )
    .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

  const ingresosOtros = filteredAbonos
    .filter(
      (a) =>
        a.metodoPago !== "Efectivo" &&
        a.metodoPago !== "Transferencia" &&
        a.metodoPago !== "Transferencia Bancaria" &&
        a.metodoPago !== "Tarjeta de Débito (TD)" &&
        a.metodoPago !== "Tarjeta de Crédito (TC)" &&
        a.metodoPago !== "Tarjeta de Débito/Crédito" &&
        !a.metodoPago.includes("Tarjeta")
    )
    .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

  const totalIngresos = ingresosEfectivo + ingresosTransferencia + ingresosTarjeta + ingresosOtros;
  const totalEgresos = filteredExpenses.reduce((sum, e) => sum + (e.monto || 0), 0);

  // Expected Cash in Register
  const efectivoEsperado = fondoInicial + ingresosEfectivo - totalEgresos;

  // Difference: Real Counted - Expected
  const diferenciaArqueo = efectivoFisicoContado - efectivoEsperado;

  // Remaining Cash Base left for next shift
  const fondoSiguienteTurno = Math.max(0, efectivoFisicoContado - retiroEfectivo);

  const handleExecuteCorte = async () => {
    if (
      !confirm(
        `¿CONFIRMAR Y REGISTRAR CORTE DE CAJA Z?\n\n` +
          `• Efectivo Esperado: ${formatCurrency(efectivoEsperado)}\n` +
          `• Efectivo Contado: ${formatCurrency(efectivoFisicoContado)}\n` +
          `• Diferencia: ${formatCurrency(diferenciaArqueo)}\n` +
          `• Retiro a Bóveda: ${formatCurrency(retiroEfectivo)}\n` +
          `• Fondo para Siguiente Turno: ${formatCurrency(fondoSiguienteTurno)}\n\n` +
          `Al ejecutar, los contadores de ingresos/gastos se reiniciarán a $0 para el nuevo turno.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const formattedDate = `${now.toLocaleDateString("es-MX")} ${now.toLocaleTimeString("es-MX")}`;
      const newId = `CORTE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

      const corteRecord: CorteDeCajaRecord = {
        id: newId,
        fechaIso: nowIso,
        fechaFormateada: formattedDate,
        usuario: currentUserName,
        fondoInicial,
        ingresosEfectivo,
        ingresosTransferencia,
        ingresosTarjeta,
        ingresosOtros,
        totalIngresos,
        numAbonos: filteredAbonos.length,
        totalEgresos,
        numEgresos: filteredExpenses.length,
        efectivoEsperado,
        efectivoContado: efectivoFisicoContado,
        diferenciaArqueo,
        denominaciones: useDenominations ? denominations : undefined,
        retiroEfectivo,
        fondoSiguienteTurno,
        notas: notasCorte,
        timestamp: nowIso,
      };

      await onSaveCorte(corteRecord);

      // Save cutoff timestamp and next shift initial cash base to localStorage
      localStorage.setItem("cuidarte_last_corte_timestamp", nowIso);
      localStorage.setItem("cuidarte_last_corte_fondo", String(fondoSiguienteTurno));

      if (onCorteExecuted) {
        onCorteExecuted();
      }

      setSelectedCorteForTicket(corteRecord);
      setActiveTab("ticket");
      alert(`✅ CORTE DE CAJA REGISTRADO CON ÉXITO.\n\nFolio: ${newId}\nPeriodo operativo reiniciado para el siguiente turno.`);
    } catch (err) {
      console.error("Error al registrar corte de caja:", err);
      alert("Error al guardar el corte de caja en la base de datos.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Render view for past corte ticket / report
  const activeTicketRecord =
    selectedCorteForTicket ||
    (cortesHistory.length > 0 ? cortesHistory[0] : null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full my-4 sm:my-8 shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Corte de Caja (Punto de Venta)</h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Cierre Z
                </span>
              </div>
              <p className="text-xs text-slate-400">Arqueo de efectivo, conciliación y control de flujo de caja</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeTab === "ticket" && (
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 transition-all"
              >
                <Printer className="w-4 h-4" /> Imprimir Ticket
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Hidden on Print) */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden text-xs font-bold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("nuevo")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "nuevo"
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
              }`}
            >
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Realizar Nuevo Arqueo</span>
            </button>

            <button
              onClick={() => setActiveTab("historial")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "historial"
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-white text-slate-700 hover:bg-slate-200 border border-slate-300"
              }`}
            >
              <History className="w-4 h-4 text-sky-400" />
              <span>Historial de Cortes ({cortesHistory.length})</span>
            </button>

            {selectedCorteForTicket && (
              <button
                onClick={() => setActiveTab("ticket")}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  activeTab === "ticket"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Ticket de Corte [{selectedCorteForTicket.id}]</span>
              </button>
            )}
          </div>

          {activeTab === "nuevo" && lastCorteIso && (
            <div className="text-[11px] text-slate-500 font-mono">
              Último corte: <strong>{new Date(lastCorteIso).toLocaleString("es-MX")}</strong>
            </div>
          )}
        </div>

        {/* TAB 1: REALIZAR NUEVO ARQUEO Y CORTE Z */}
        {activeTab === "nuevo" && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800">
            {/* Header / Parameter Bar */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Cajero / Operador</label>
                <div className="font-bold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>{currentUserName}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Filtrar Movimientos Por</label>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as "postCorte" | "fecha")}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="postCorte">Desde el Último Corte de Caja</option>
                  <option value="fecha">Por Fecha Específica</option>
                </select>
              </div>

              {filterMode === "fecha" ? (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fecha del Corte</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Fondo Inicial Base ($)</label>
                  <input
                    type="number"
                    value={fondoInicial || ""}
                    onChange={(e) => setFondoInicial(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                  />
                </div>
              )}
            </div>

            {/* SECTION 1: SYSTEM CALCULATED BREAKDOWN */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-0">
              <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider flex justify-between items-center">
                <span>1. MOVIMIENTOS REGISTRADOS EN SISTEMA (COBROS Y EGRESOS)</span>
                <span className="font-mono text-emerald-400">{filteredAbonos.length} abonos / {filteredExpenses.length} gastos</span>
              </div>

              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">💵 Cobros en Efectivo</span>
                  <span className="text-base font-mono font-extrabold text-emerald-600 block mt-0.5">
                    {formatCurrency(ingresosEfectivo)}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">🏦 Transferencias</span>
                  <span className="text-base font-mono font-extrabold text-sky-600 block mt-0.5">
                    {formatCurrency(ingresosTransferencia)}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">💳 Tarjetas Débito/Crédito</span>
                  <span className="text-base font-mono font-extrabold text-violet-600 block mt-0.5">
                    {formatCurrency(ingresosTarjeta)}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">🔴 Egresos en Efectivo</span>
                  <span className="text-base font-mono font-extrabold text-rose-600 block mt-0.5">
                    {formatCurrency(totalEgresos)}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-950 text-white p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <span className="text-xs font-bold text-emerald-300 uppercase block">EFECTIVO ESPERADO EN CAJA FÍSICA (SISTEMA)</span>
                  <span className="text-[11px] text-slate-300">Fondo Inicial ({formatCurrency(fondoInicial)}) + Cobros Efectivo ({formatCurrency(ingresosEfectivo)}) - Gastos ({formatCurrency(totalEgresos)})</span>
                </div>
                <div className="text-2xl font-mono font-black text-emerald-400">
                  {formatCurrency(efectivoEsperado)}
                </div>
              </div>
            </div>

            {/* SECTION 2: PHYSICAL CASH COUNT (DENOMINATION CALCULATOR) */}
            <div className="border-2 border-slate-300 rounded-2xl p-4 sm:p-5 bg-white space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-sm uppercase text-slate-900">2. ARQUEO FÍSICO DE EFECTIVO EN CAJA</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUseDenominations(!useDenominations)}
                    className="text-xs text-sky-700 font-bold hover:underline"
                  >
                    {useDenominations ? "→ Cambiar a ingreso directo" : "→ Usar desglose por billetes y monedas"}
                  </button>
                </div>
              </div>

              {useDenominations ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">Ingrese el número de piezas por cada denominación contada en el cajón:</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    {/* Billetes */}
                    {[
                      { key: "b1000", val: 1000, label: "$1,000 Billete" },
                      { key: "b500", val: 500, label: "$500 Billete" },
                      { key: "b200", val: 200, label: "$200 Billete" },
                      { key: "b100", val: 100, label: "$100 Billete" },
                      { key: "b50", val: 50, label: "$50 Billete" },
                      { key: "b20", val: 20, label: "$20 Billete" },
                    ].map((den) => (
                      <div key={den.key} className="bg-emerald-50/60 border border-emerald-200 p-2.5 rounded-xl">
                        <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-1">{den.label}</label>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs">x</span>
                          <input
                            type="number"
                            min="0"
                            value={(denominations as any)[den.key] || ""}
                            onChange={(e) =>
                              setDenominations({ ...denominations, [den.key]: Math.max(0, parseInt(e.target.value) || 0) })
                            }
                            className="w-full bg-white border border-emerald-300 rounded-lg px-2 py-1 font-mono font-bold text-center text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-[10px] font-mono text-emerald-700 font-bold text-right mt-1">
                          = {formatCurrency(((denominations as any)[den.key] || 0) * den.val)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    {/* Monedas */}
                    {[
                      { key: "m20", val: 20, label: "$20 Moneda" },
                      { key: "m10", val: 10, label: "$10 Moneda" },
                      { key: "m5", val: 5, label: "$5 Moneda" },
                      { key: "m2", val: 2, label: "$2 Moneda" },
                      { key: "m1", val: 1, label: "$1 Moneda" },
                      { key: "m050", val: 0.5, label: "$0.50 Moneda" },
                    ].map((den) => (
                      <div key={den.key} className="bg-amber-50/60 border border-amber-200 p-2.5 rounded-xl">
                        <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">{den.label}</label>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 text-xs">x</span>
                          <input
                            type="number"
                            min="0"
                            value={(denominations as any)[den.key] || ""}
                            onChange={(e) =>
                              setDenominations({ ...denominations, [den.key]: Math.max(0, parseInt(e.target.value) || 0) })
                            }
                            className="w-full bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono font-bold text-center text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="0"
                          />
                        </div>
                        <div className="text-[10px] font-mono text-amber-800 font-bold text-right mt-1">
                          = {formatCurrency(((denominations as any)[den.key] || 0) * den.val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-sm">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Efectivo Total Físicamente Contado ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={directEfectivoContado || ""}
                    onChange={(e) => setDirectEfectivoContado(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-lg font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* ARQUEO RESULTS COMPARISON BOX */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Efectivo Físico Contado</span>
                  <span className="text-xl font-mono font-extrabold text-emerald-400">
                    {formatCurrency(efectivoFisicoContado)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Efectivo Esperado (Sistema)</span>
                  <span className="text-xl font-mono font-extrabold text-slate-200">
                    {formatCurrency(efectivoEsperado)}
                  </span>
                </div>

                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-300 block">Diferencia / Conciliación</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-lg font-mono font-black ${
                        diferenciaArqueo === 0
                          ? "text-emerald-400"
                          : diferenciaArqueo > 0
                          ? "text-sky-400"
                          : "text-rose-400 animate-pulse"
                      }`}
                    >
                      {formatCurrency(diferenciaArqueo)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        diferenciaArqueo === 0
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : diferenciaArqueo > 0
                          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {diferenciaArqueo === 0 ? "Cuadrado Perfectamente" : diferenciaArqueo > 0 ? "Sobrante" : "Faltante"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: CASH WITHDRAWAL & NEXT SHIFT BASE */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 text-xs">
              <h3 className="font-black text-xs uppercase text-slate-800">
                3. RETIRO DE CAJA A BÓVEDA Y FONDO PARA EL SIGUIENTE TURNO
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Monto a Retirar a Bóveda / Depósito Bancario ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={efectivoFisicoContado}
                    value={retiroEfectivo || ""}
                    onChange={(e) => setRetiroEfectivo(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-extrabold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej. 5000"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Efectivo físico que se retira de la caja al cierre.</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-300 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Fondo Restante para Siguiente Turno</span>
                    <span className="text-xl font-mono font-black text-slate-900 block mt-1">
                      {formatCurrency(fondoSiguienteTurno)}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Quedará asignado como fondo base inicial.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones / Notas del Cierre</label>
                <textarea
                  rows={2}
                  value={notasCorte}
                  onChange={(e) => setNotasCorte(e.target.value)}
                  placeholder="Escriba comentarios, folios de comprobantes de depósito o razones si existió sobrante/faltante..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* EXECUTE CORTE BUTTON */}
            <div className="pt-2">
              <button
                onClick={handleExecuteCorte}
                disabled={isSubmitting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all border border-emerald-400 disabled:opacity-50"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                <span>{isSubmitting ? "REGISTRANDO CORTE DE CAJA Z..." : "EJECUTAR Y REGISTRAR CORTE DE CAJA Z (REINICIAR PERIODO)"}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: HISTORIAL DE CORTES ANTERIORES */}
        {activeTab === "historial" && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-slate-800">Historial de Cortes de Caja Registrados</h3>
              <span className="text-slate-500 text-xs">{cortesHistory.length} cortes guardados</span>
            </div>

            {cortesHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 italic">
                No hay cortes de caja registrados en el historial aún.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Folio</th>
                      <th className="py-2.5 px-3">Fecha/Hora</th>
                      <th className="py-2.5 px-3">Cajero</th>
                      <th className="py-2.5 px-3 text-right">Fondo Ini.</th>
                      <th className="py-2.5 px-3 text-right">Ingresos</th>
                      <th className="py-2.5 px-3 text-right">Egresos</th>
                      <th className="py-2.5 px-3 text-right">Esperado</th>
                      <th className="py-2.5 px-3 text-right">Contado</th>
                      <th className="py-2.5 px-3 text-center">Diferencia</th>
                      <th className="py-2.5 px-3 text-right">Retiro</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {cortesHistory.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{c.id}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{c.fechaFormateada || c.timestamp?.slice(0, 16)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{c.usuario}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(c.fondoInicial)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(c.totalIngresos)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">{formatCurrency(c.totalEgresos)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatCurrency(c.efectivoEsperado)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(c.efectivoContado)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                              c.diferenciaArqueo === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : c.diferenciaArqueo > 0
                                ? "bg-sky-100 text-sky-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {formatCurrency(c.diferenciaArqueo)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">{formatCurrency(c.retiroEfectivo)}</td>
                        <td className="py-2.5 px-3 text-center flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedCorteForTicket(c);
                              setActiveTab("ticket");
                            }}
                            className="p-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg border border-sky-200"
                            title="Ver Ticket de Corte"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteCorte && (
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar registro de corte ${c.id}?`)) {
                                  await onDeleteCorte(c.id);
                                }
                              }}
                              className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg border border-rose-200"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PRINTABLE TICKET / REPORT VIEW */}
        {activeTab === "ticket" && activeTicketRecord && (
          <div className="p-6 overflow-y-auto space-y-6 text-slate-900 font-sans print:p-2" ref={printRef}>
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <CuidarteLogo
                size="md"
                showTagline={true}
                variant="document"
                sucursalId={activeTicketRecord.sucursalId}
                sucursalNombre={activeTicketRecord.sucursalNombre}
              />
              <div className="text-right">
                <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-slate-900">
                  CORTE DE CAJA Z (COMPROBANTE)
                </h1>
                <p className="text-xs font-mono font-bold text-slate-700">FOLIO: {activeTicketRecord.id}</p>
                <p className="text-[11px] font-mono text-slate-500">{activeTicketRecord.fechaFormateada}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Cajero / Atendió: <strong>{activeTicketRecord.usuario}</strong>
                </p>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                  Ingresos Totales
                </div>
                <div className="text-base font-mono font-extrabold text-emerald-700 mt-0.5">
                  {formatCurrency(activeTicketRecord.totalIngresos)}
                </div>
                <div className="text-[10px] text-emerald-600 font-mono">{activeTicketRecord.numAbonos} abonos registrados</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  Egresos Totales
                </div>
                <div className="text-base font-mono font-extrabold text-rose-700 mt-0.5">
                  {formatCurrency(activeTicketRecord.totalEgresos)}
                </div>
                <div className="text-[10px] text-rose-600 font-mono">{activeTicketRecord.numEgresos} egresos</div>
              </div>

              <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl">
                <div className="text-[10px] font-bold text-sky-800 uppercase">Efectivo Contado</div>
                <div className="text-base font-mono font-extrabold text-sky-700 mt-0.5">
                  {formatCurrency(activeTicketRecord.efectivoContado)}
                </div>
                <div className="text-[10px] text-sky-600">Arqueo físico</div>
              </div>

              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-md">
                <div className="text-[10px] font-bold text-slate-300 uppercase">Diferencia de Arqueo</div>
                <div className="text-base font-mono font-extrabold text-emerald-400 mt-0.5">
                  {formatCurrency(activeTicketRecord.diferenciaArqueo)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {activeTicketRecord.diferenciaArqueo === 0 ? "Sin diferencia" : activeTicketRecord.diferenciaArqueo > 0 ? "Sobrante" : "Faltante"}
                </div>
              </div>
            </div>

            {/* Income breakdown table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="bg-slate-900 text-white px-4 py-2 text-xs font-extrabold uppercase tracking-wider flex justify-between items-center">
                <span>1. DESGLOSE DE INGRESOS POR MÉTODOS DE PAGO</span>
                <span className="font-mono text-emerald-400">{formatCurrency(activeTicketRecord.totalIngresos)}</span>
              </div>
              <table className="w-full text-xs text-left">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">💵 Cobros en Efectivo</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(activeTicketRecord.ingresosEfectivo)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">🏦 Transferencias Bancarias</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(activeTicketRecord.ingresosTransferencia)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-semibold text-slate-800">💳 Tarjetas de Débito/Crédito</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(activeTicketRecord.ingresosTarjeta)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Final Cash drawer reconciliation box */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2.5 font-mono text-xs">
              <h3 className="font-sans font-black uppercase text-emerald-400 text-xs">2. BALANCE Y LIQUIDACIÓN DE CAJA</h3>
              <div className="flex justify-between items-center text-slate-300">
                <span>(+) Fondo Inicial Base:</span>
                <span>{formatCurrency(activeTicketRecord.fondoInicial)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300">
                <span>(+) Cobros en Efectivo:</span>
                <span>{formatCurrency(activeTicketRecord.ingresosEfectivo)}</span>
              </div>
              <div className="flex justify-between items-center text-rose-300 border-b border-slate-700 pb-2">
                <span>(-) Egresos y Gastos en Efectivo:</span>
                <span>{formatCurrency(activeTicketRecord.totalEgresos)}</span>
              </div>

              <div className="flex justify-between items-center font-bold text-white pt-1">
                <span className="font-sans uppercase">(=) EFECTIVO ESPERADO EN CAJA:</span>
                <span className="text-slate-200">{formatCurrency(activeTicketRecord.efectivoEsperado)}</span>
              </div>
              <div className="flex justify-between items-center font-extrabold">
                <span className="font-sans uppercase">(=) EFECTIVO FÍSICO CONTADO:</span>
                <span className="text-emerald-400 text-sm">{formatCurrency(activeTicketRecord.efectivoContado)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-700 pt-2 text-amber-300">
                <span className="font-sans uppercase">(-) Retiro de Efectivo a Bóveda:</span>
                <span>{formatCurrency(activeTicketRecord.retiroEfectivo)}</span>
              </div>
              <div className="flex justify-between items-center font-black text-sky-300 text-sm pt-1">
                <span className="font-sans uppercase">(=) FONDO PARA SIGUIENTE TURNO:</span>
                <span>{formatCurrency(activeTicketRecord.fondoSiguienteTurno)}</span>
              </div>
            </div>

            {/* Notes */}
            {activeTicketRecord.notas && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block mb-1">Observaciones:</span>
                <p className="text-slate-600 italic">{activeTicketRecord.notas}</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div className="border-t border-slate-800 pt-2 font-bold text-slate-800">
                {activeTicketRecord.usuario}
                <div className="text-[10px] text-slate-500 font-normal">Firma Cajero / Elaboró</div>
              </div>
              <div className="border-t border-slate-800 pt-2 font-bold text-slate-800">
                Supervisión / Gerencia
                <div className="text-[10px] text-slate-500 font-normal">Firma Vo.Bo. Recibido</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
