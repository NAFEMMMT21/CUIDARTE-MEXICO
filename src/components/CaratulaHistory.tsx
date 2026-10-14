import React, { useState, useRef } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { Caratula, AbonoTicket, PaymentMethod, CalendarEvent, ScheduledShiftItem, ShiftPresetType, Sucursal, UserSession } from "../types";
import { formatCurrency } from "../utils/formatters";
import { isCaratulaActivaOConDeuda, calculateClientBalance } from "../utils/clientBalance";
import { CaratulaDocument } from "./CaratulaDocument";
import { AbonoTicketDocument } from "./AbonoTicketDocument";
import { CaratulaVerificationPortal } from "./CaratulaVerificationPortal";
import { downloadCaratulaPDF, downloadCaratulaImage, printCaratulaDocument } from "../utils/pdfExport";
import { Search, FileText, Download, Image as ImageIcon, Printer, Edit3, Trash2, DollarSign, X, Copy, Eye, Receipt, PlusCircle, History, ShieldCheck, RefreshCw, Sparkles, Filter, ChevronDown, AlertTriangle, AlertCircle, CheckCircle2, Building2 } from "lucide-react";

interface CaratulaHistoryProps {
  caratulas: Caratula[];
  abonos?: AbonoTicket[];
  calendarEvents?: CalendarEvent[];
  sucursales?: Sucursal[];
  userSession?: UserSession | null;
  selectedSucursalId?: string;
  onEditCaratula: (caratula: Caratula) => void;
  onSaveCaratula?: (caratula: Caratula) => void;
  onDeleteCaratula: (folio: string) => void;
  onUpdatePayment: (folio: string, nuevoPagado: number) => void;
  onSaveAbono?: (abono: AbonoTicket) => void;
  onCancelAbono?: (abono: AbonoTicket, motivo: string) => void;
  onReactivateAbono?: (abono: AbonoTicket) => void;
  onDeleteAbono?: (id: string, caratulaFolio: string) => void;
  onDuplicateCaratula: (caratula: Caratula) => void;
  currentUserName?: string;
}

export const CaratulaHistory: React.FC<CaratulaHistoryProps> = ({
  caratulas,
  abonos = [],
  calendarEvents = [],
  sucursales = [],
  userSession,
  selectedSucursalId,
  onEditCaratula,
  onSaveCaratula,
  onDeleteCaratula,
  onUpdatePayment,
  onSaveAbono,
  onCancelAbono,
  onReactivateAbono,
  onDeleteAbono,
  onDuplicateCaratula,
  currentUserName,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pagado" | "pendiente">("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | "caratula" | "cotizacion" | "cancelado">("todos");
  const [showOnlyActive, setShowOnlyActive] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(50);

  const [viewingCaratula, setViewingCaratula] = useState<Caratula | null>(null);
  const [paymentModalCaratula, setPaymentModalCaratula] = useState<Caratula | null>(null);
  const [paymentModalClient, setPaymentModalClient] = useState<string | null>(null);
  const [montoAbono, setMontoAbono] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>("Efectivo");
  const [referenciaAbono, setReferenciaAbono] = useState<string>("");
  const [notasAbono, setNotasAbono] = useState<string>("");

  // Complementary payment states
  const [useComplementaryPayment, setUseComplementaryPayment] = useState<boolean>(false);
  const [complementaryMethod, setComplementaryMethod] = useState<PaymentMethod>("Efectivo");
  const [complementaryAmount, setComplementaryAmount] = useState<number>(0);

  // Ticket viewing state
  const [viewingTicket, setViewingTicket] = useState<AbonoTicket | null>(null);
  const [viewingAbonosFolio, setViewingAbonosFolio] = useState<string | null>(null);
  const [verifyingFolio, setVerifyingFolio] = useState<string | null>(null);

  // Interactive confirmation states to prevent blocked browser prompt/confirm
  const [ticketToDelete, setTicketToDelete] = useState<AbonoTicket | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<AbonoTicket | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>("Error de registro / Cobro no efectuado");
  const [ticketToReactivate, setTicketToReactivate] = useState<AbonoTicket | null>(null);
  const [caratulaToCancel, setCaratulaToCancel] = useState<Caratula | null>(null);
  const [caratulaCancelReason, setCaratulaCancelReason] = useState<string>("Servicio cancelado por el cliente / Error de captura");
  const [caratulaToReactivate, setCaratulaToReactivate] = useState<Caratula | null>(null);
  const [caratulaToConvert, setCaratulaToConvert] = useState<Caratula | null>(null);
  const [caratulaToDelete, setCaratulaToDelete] = useState<Caratula | null>(null);

  // Lock background scroll when any modal is open
  useLockBodyScroll(
    Boolean(
      viewingCaratula ||
      paymentModalCaratula ||
      viewingTicket ||
      viewingAbonosFolio ||
      verifyingFolio ||
      ticketToDelete ||
      ticketToCancel ||
      ticketToReactivate ||
      caratulaToCancel ||
      caratulaToReactivate ||
      caratulaToConvert ||
      caratulaToDelete
    )
  );

  const documentRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Active / Pending debt Carátulas calculation for summary
  const activeCaratulasList = caratulas.filter(isCaratulaActivaOConDeuda);
  const totalContratadoActivas = activeCaratulasList.reduce((sum, c) => sum + (c.total || 0), 0);
  const activeFolios = new Set(activeCaratulasList.map((c) => c.folio));
  const activeAbonosList = abonos.filter((a) => a.estado !== "Cancelado" && activeFolios.has(a.caratulaFolio));
  const totalAbonadoActivas = activeAbonosList.reduce((sum, a) => sum + (a.montoAbonado || 0), 0);
  const pendienteTotalActivas = Math.max(0, totalContratadoActivas - totalAbonadoActivas);

  const filteredCaratulas = caratulas.filter((c) => {
    const matchesSearch =
      c.folio.toLowerCase().includes(search.toLowerCase()) ||
      c.nombreCompletoCliente.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.nombreCompletoRS.toLowerCase().includes(search.toLowerCase());

    const isCancelled = c.estado === "Cancelado";
    const isQuote = c.tipoDocumento === "Cotización";
    const isPaid = c.pendiente <= 0;
    const isActivaOConDeuda = isCaratulaActivaOConDeuda(c);

    // Default view shows active or pending-debt carátulas unless user explicitly selects "Ver Todas" or searches
    if (showOnlyActive && !isActivaOConDeuda && !search.trim() && statusFilter === "todos" && typeFilter === "todos") {
      return false;
    }

    const matchesStatus =
      statusFilter === "todos" ||
      (statusFilter === "pagado" && isPaid && !isCancelled) ||
      (statusFilter === "pendiente" && !isPaid && !isCancelled);

    const matchesType =
      typeFilter === "todos" ||
      (typeFilter === "caratula" && !isQuote && !isCancelled) ||
      (typeFilter === "cotizacion" && isQuote && !isCancelled) ||
      (typeFilter === "cancelado" && isCancelled);

    return matchesSearch && matchesStatus && matchesType;
  });

  const displayedCaratulas = filteredCaratulas.slice(0, visibleCount);

  const handleConfirmCancelCaratula = () => {
    if (!caratulaToCancel || !onSaveCaratula) return;
    onSaveCaratula({
      ...caratulaToCancel,
      estado: "Cancelado",
      motivoCancelacion: caratulaCancelReason.trim() || "Cancelación de carátula por administración",
      fechaCancelacion: new Date().toLocaleString(),
      canceladoPor: currentUserName || "Administración",
    });
    setCaratulaToCancel(null);
  };

  const handleConfirmReactivateCaratula = () => {
    if (!caratulaToReactivate || !onSaveCaratula) return;
    const isPaid = caratulaToReactivate.pendiente <= 0;
    onSaveCaratula({
      ...caratulaToReactivate,
      estado: isPaid ? "Pagado" : "Activo",
      motivoCancelacion: undefined,
      fechaCancelacion: undefined,
      canceladoPor: undefined,
    });
    setCaratulaToReactivate(null);
  };

  const handleConfirmConvertToCaratula = () => {
    if (!caratulaToConvert || !onSaveCaratula) return;
    onSaveCaratula({
      ...caratulaToConvert,
      tipoDocumento: "Caratula",
      estado: "Activo",
    });
    setCaratulaToConvert(null);
  };

  const handleConfirmDeleteCaratula = () => {
    if (!caratulaToDelete) return;
    onDeleteCaratula(caratulaToDelete.folio);
    setCaratulaToDelete(null);
  };

  const handleConfirmDeleteTicket = () => {
    if (!ticketToDelete || !onDeleteAbono) return;
    onDeleteAbono(ticketToDelete.id, ticketToDelete.caratulaFolio);
    if (viewingTicket?.id === ticketToDelete.id) {
      setViewingTicket(null);
    }
    setTicketToDelete(null);
  };

  const handleConfirmCancelTicket = () => {
    if (!ticketToCancel || !onCancelAbono) return;
    onCancelAbono(ticketToCancel, cancelReasonInput.trim() || "Error de registro / Cobro no efectuado");
    if (viewingTicket?.id === ticketToCancel.id) {
      setViewingTicket(null);
    }
    setTicketToCancel(null);
  };

  const handleConfirmReactivateTicket = () => {
    if (!ticketToReactivate || !onReactivateAbono) return;
    onReactivateAbono(ticketToReactivate);
    if (viewingTicket?.id === ticketToReactivate.id) {
      setViewingTicket(null);
    }
    setTicketToReactivate(null);
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const activeClientName = paymentModalClient || paymentModalCaratula?.nombreCompletoCliente;
    if (!activeClientName) {
      alert("Por favor seleccione un cliente para registrar el abono.");
      return;
    }

    const abonadoMonto = Number(montoAbono);
    if (abonadoMonto <= 0) {
      alert("Ingrese un monto de abono válido mayor a $0.");
      return;
    }

    const clientBal = calculateClientBalance(activeClientName, caratulas, abonos);
    const availableCredit = clientBal.saldoAFavorTotal;

    if (metodoPago === "Saldo a Favor" && abonadoMonto > availableCredit + 0.01) {
      alert(`El cliente solo cuenta con ${formatCurrency(availableCredit)} de Saldo a Favor disponible.`);
      return;
    }

    const compAmount = useComplementaryPayment ? Number(complementaryAmount) : 0;
    const totalAbonadoModal = abonadoMonto + compAmount;

    // Target folio for record: prefer selected caratula's folio or first pending/active caratula
    const targetFolio = paymentModalCaratula?.folio || clientBal.detallesFolios[0]?.folio || "CLIENTE";
    const targetCaratula = caratulas.find((c) => c.folio === targetFolio) || paymentModalCaratula;
    const targetRS = targetCaratula?.nombreCompletoRS || paymentModalCaratula?.nombreCompletoRS || clientBal.detallesFolios[0]?.folio || "";

    const now = new Date();
    const formattedDate = now.toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const caratulaMontoTotal = targetCaratula ? (targetCaratula.total || 0) : clientBal.totalContratado;
    const pagadoCaratulaAnterior = targetCaratula ? (targetCaratula.pagado || 0) : clientBal.totalAbonado;
    const pagadoCaratulaNuevoTotal = pagadoCaratulaAnterior + abonadoMonto;
    const pendienteRestante = targetCaratula
      ? Math.max(0, caratulaMontoTotal - pagadoCaratulaNuevoTotal)
      : Math.max(0, clientBal.saldoPendienteTotal - abonadoMonto);

    const assignedBranchId =
      targetCaratula?.sucursalId ||
      (selectedSucursalId && selectedSucursalId !== "all" ? selectedSucursalId : userSession?.sucursalId || "pachuca");
    const assignedBranchName =
      targetCaratula?.sucursalNombre ||
      sucursales.find((s) => s.id === assignedBranchId)?.nombre ||
      userSession?.sucursalNombre ||
      "Cuidarte Pachuca";

    const newTicket: AbonoTicket = {
      id: `TKT-${targetFolio}-${now.getTime().toString().slice(-4)}`,
      caratulaFolio: targetFolio,
      clienteNombre: activeClientName,
      receptorNombre: targetRS,
      montoAbonado: abonadoMonto,
      totalCaratula: caratulaMontoTotal,
      pagadoAnterior: pagadoCaratulaAnterior,
      pagadoNuevoTotal: pagadoCaratulaNuevoTotal,
      pendienteRestante,
      metodoPago,
      referencia: referenciaAbono.trim(),
      fecha: formattedDate,
      atendidoPor: currentUserName || "Administración",
      notas: notasAbono.trim() || `Abono a servicio folio ${targetFolio} de ${activeClientName}`,
      saldoAFavorAplicado: metodoPago === "Saldo a Favor" ? abonadoMonto : undefined,
      sucursalId: assignedBranchId,
      sucursalNombre: assignedBranchName,
    };

    // Save main ticket to Firestore
    if (onSaveAbono) {
      onSaveAbono(newTicket);
    }

    // Save complementary ticket if used
    if (useComplementaryPayment && compAmount > 0) {
      const compTicket: AbonoTicket = {
        id: `TKT-${targetFolio}-${(now.getTime() + 1).toString().slice(-4)}`,
        caratulaFolio: targetFolio,
        clienteNombre: activeClientName,
        receptorNombre: targetRS,
        montoAbonado: compAmount,
        totalCaratula: caratulaMontoTotal,
        pagadoAnterior: pagadoCaratulaNuevoTotal,
        pagadoNuevoTotal: pagadoCaratulaAnterior + totalAbonadoModal,
        pendienteRestante: targetCaratula
          ? Math.max(0, caratulaMontoTotal - (pagadoCaratulaAnterior + totalAbonadoModal))
          : Math.max(0, clientBal.saldoPendienteTotal - totalAbonadoModal),
        metodoPago: complementaryMethod,
        referencia: `Pago complementario (${metodoPago})`,
        fecha: formattedDate,
        atendidoPor: currentUserName || "Administración",
        notas: `Abono complementario a servicio folio ${targetFolio}`,
        sucursalId: assignedBranchId,
        sucursalNombre: assignedBranchName,
      };

      if (onSaveAbono) {
        onSaveAbono(compTicket);
      }
    }

    // Trigger payment update sync across all client caratulas
    onUpdatePayment(targetFolio, pagadoCaratulaAnterior + totalAbonadoModal);

    // Reset payment modal state
    setPaymentModalCaratula(null);
    setPaymentModalClient(null);
    setMontoAbono(0);
    setMetodoPago("Efectivo");
    setReferenciaAbono("");
    setNotasAbono("");
    setUseComplementaryPayment(false);
    setComplementaryAmount(0);

    // Open ticket document viewer automatically
    setViewingTicket(newTicket);
  };

  // Unique Clients list for Client-level payments
  const uniqueClients = Array.from<string>(
    new Set(
      caratulas
        .map((c) => c.nombreCompletoCliente?.trim())
        .filter((n): n is string => Boolean(n && n.length > 0))
    )
  ).sort((a, b) => a.localeCompare(b));

  const activePaymentClientName =
    paymentModalClient || paymentModalCaratula?.nombreCompletoCliente || uniqueClients[0] || "";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Consulta de Carátulas Registradas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Historial completo de carátulas generadas. Consulte, descargue en PDF/Imagen, registre abonos o re-imprima documentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const firstClient = uniqueClients[0] || "";
              setPaymentModalClient(firstClient);
              setPaymentModalCaratula(null);
              const bal = calculateClientBalance(firstClient, caratulas, abonos);
              setMontoAbono(bal.saldoPendienteTotal > 0 ? bal.saldoPendienteTotal : 0);
              setMetodoPago("Efectivo");
              setReferenciaAbono("");
              setNotasAbono("");
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <DollarSign className="w-4 h-4" />
            <span>➕ Registrar Abono a Cliente</span>
          </button>
          <div className="text-xs font-mono font-bold bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hidden sm:block">
            Total: {caratulas.length}
          </div>
        </div>
      </div>

      {/* Active Carátulas KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Contratado (Activas)
            </span>
            <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
              {formatCurrency(totalContratadoActivas)}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              {activeCaratulasList.length} carátula(s) en curso / con deuda
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Abonado (Activas)
            </span>
            <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
              {formatCurrency(totalAbonadoActivas)}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Pagos validados en servicios activos
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Saldo Pendiente Global
            </span>
            <span className={`text-xl font-black font-mono mt-0.5 block ${pendienteTotalActivas > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(pendienteTotalActivas)}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">
              Por recuperar en cartera activa
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${pendienteTotalActivas > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por folio (CPSEA000), cliente, receptor o ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(10);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setShowOnlyActive(!showOnlyActive);
              setVisibleCount(50);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              showOnlyActive
                ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs"
                : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs"
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            {showOnlyActive ? `🟢 Filtrando: Solo Activas (${activeCaratulasList.length})` : `📦 Mostrando: Todas (${caratulas.length})`}
          </button>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setVisibleCount(10);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="caratula">📄 Carátulas Oficiales</option>
            <option value="cotizacion">⏱️ Cotizaciones (7 días)</option>
            <option value="cancelado">⛔ Canceladas</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setVisibleCount(10);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos los Estatus</option>
            <option value="pagado">Pagados / Liquidados</option>
            <option value="pendiente">Con Pago Pendiente</option>
          </select>
        </div>

        {caratulas.length > 0 && (
          <button
            onClick={() => {
              const pendingCaratula = caratulas.find((c) => c.pendiente > 0) || caratulas[0];
              if (pendingCaratula) {
                setPaymentModalCaratula(pendingCaratula);
                setMontoAbono(pendingCaratula.pendiente > 0 ? pendingCaratula.pendiente : 0);
              }
            }}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 shrink-0 transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> Registrar Abono / Ticket
          </button>
        )}
      </div>

      {/* Carátulas List Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* MOBILE CARD VIEW (sm:hidden) */}
        <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-3">
          {filteredCaratulas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se encontraron carátulas con los criterios seleccionados.
            </div>
          ) : (
            displayedCaratulas.map((c) => {
              const isPaid = c.pendiente <= 0;
              const abonosCount = abonos.filter((a) => a.caratulaFolio === c.folio).length;

              return (
                <div key={c.folio} className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-black text-red-600 text-base block">{c.folio}</span>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">{c.timestamp || "-"}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <Building2 className="w-2.5 h-2.5 text-sky-600" />
                          {c.sucursalNombre || "Cuidarte Pachuca"}
                        </span>
                      </div>
                    </div>
                    <div>
                      {c.estado === "Cancelado" ? (
                        <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-rose-300">
                          ⛔ Cancelada
                        </span>
                      ) : c.tipoDocumento === "Cotización" ? (
                        <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-full text-[10px] border border-amber-300">
                          ⏱️ Cotización
                        </span>
                      ) : isPaid ? (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-emerald-300">
                          Liquidado
                        </span>
                      ) : c.pagado > 0 ? (
                        <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-amber-300">
                          Abonado
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-red-300">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-slate-900 text-sm">{c.nombreCompletoCliente}</p>
                    {c.nombreCompletoRS && (
                      <p className="text-xs text-slate-500">Receptor: {c.nombreCompletoRS}</p>
                    )}
                  </div>

                  {/* Vigencia & Guardias Info Pill on Mobile */}
                  {Boolean(c.modalidadVigencia) && (
                    <div className="flex items-center justify-between text-[11px] bg-sky-50 px-2.5 py-1.5 rounded-xl border border-sky-200 text-sky-900 font-mono">
                      <span className="font-bold flex items-center gap-1">
                        <span>⏱️</span> Vigencia: {c.fechaVigenciaFin || c.fin?.slice(0, 10)}
                      </span>
                      <span className="font-bold text-[10px] bg-white px-2 py-0.5 rounded border border-sky-300">
                        {c.guardiasAgendadas ?? 0}/{c.guardiasTotalContratadas ?? c.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0)} agendadas
                      </span>
                    </div>
                  )}

                  {/* Financial Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-center">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Total</span>
                      <span className="font-bold text-slate-900">{formatCurrency(c.total)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Pagado</span>
                      <span className="font-semibold text-emerald-600">{formatCurrency(c.pagado)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Pendiente</span>
                      <span className="font-bold text-red-600">{formatCurrency(c.pendiente >= 0 ? c.pendiente : 0)}</span>
                    </div>
                  </div>

                  {/* Mobile Action Touch Buttons Bar */}
                  <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      onClick={() => setViewingCaratula(c)}
                      className="flex-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                    >
                      <Eye className="w-4 h-4 text-sky-600" />
                      <span>Ver</span>
                    </button>

                    <button
                      onClick={() => setVerifyingFolio(c.folio)}
                      className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                      title="Verificar Autenticidad"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    </button>

                    {c.tipoDocumento === "Cotización" && c.estado !== "Cancelado" && (
                      <button
                        onClick={() => setCaratulaToConvert(c)}
                        className="bg-amber-500 text-white font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                      >
                        Aprobar
                      </button>
                    )}

                    {c.estado !== "Cancelado" && (
                      <button
                        onClick={() => {
                          setPaymentModalCaratula(c);
                          setMontoAbono(c.pendiente > 0 ? c.pendiente : 0);
                          setMetodoPago("Efectivo");
                          setReferenciaAbono("");
                          setNotasAbono("");
                        }}
                        className="bg-emerald-600 text-white font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Abonar</span>
                      </button>
                    )}

                    <button
                      onClick={() => setViewingAbonosFolio(c.folio)}
                      className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px] relative"
                    >
                      <Receipt className="w-4 h-4" />
                      {abonosCount > 0 && (
                        <span className="bg-indigo-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.2">
                          {abonosCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => onEditCaratula(c)}
                      className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                    >
                      <Edit3 className="w-4 h-4 text-amber-600" />
                    </button>

                    <button
                      onClick={() => onDuplicateCaratula(c)}
                      className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                    >
                      <Copy className="w-4 h-4 text-indigo-600" />
                    </button>

                    {c.estado === "Cancelado" ? (
                      <button
                        onClick={() => setCaratulaToReactivate(c)}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                        title="Reactivar Carátula"
                      >
                        <RefreshCw className="w-4 h-4 text-emerald-600" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setCaratulaToCancel(c);
                          setCaratulaCancelReason("Servicio cancelado por el cliente / Error de captura");
                        }}
                        className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                        title="Cancelar Carátula"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setCaratulaToDelete(c)}
                      className="bg-red-50 text-red-700 border border-red-200 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1 min-h-[42px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Folio / Fecha</th>
                <th className="py-3 px-4">Cliente & Receptor</th>
                <th className="py-3 px-4">Período Servicio</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Pagado</th>
                <th className="py-3 px-4 text-right">Pendiente</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCaratulas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No se encontraron carátulas con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                displayedCaratulas.map((c) => {
                  const isPaid = c.pendiente <= 0;

                  return (
                    <tr key={c.folio} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-extrabold text-red-600 text-base">
                          {c.folio}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {c.timestamp || "-"}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <Building2 className="w-2.5 h-2.5 text-sky-600" />
                            {c.sucursalNombre || "Cuidarte Pachuca"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.nombreCompletoCliente}</div>
                        <div className="text-xs text-slate-500">
                          RS: {c.nombreCompletoRS || "-"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {Boolean(c.modalidadVigencia) ? (
                          <div>
                            <div className="text-sky-700 font-bold flex items-center gap-1">
                              <span>⏱️ Vigencia:</span>
                              <span>{c.fechaVigenciaFin || c.fin?.slice(0, 10)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-sans">
                              {c.guardiasAgendadas ?? 0} de {c.guardiasTotalContratadas ?? c.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0)} agendadas
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>In: {c.inicio || "-"}</div>
                            <div>Fin: {c.fin || "-"}</div>
                          </>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(c.total)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-medium">
                        {formatCurrency(c.pagado)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-red-600 font-bold">
                        {formatCurrency(c.pendiente >= 0 ? c.pendiente : 0)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {c.estado === "Cancelado" ? (
                          <span className="bg-rose-100 text-rose-800 font-extrabold px-2.5 py-1 rounded-full text-xs border border-rose-300">
                            ⛔ Cancelada
                          </span>
                        ) : c.tipoDocumento === "Cotización" ? (
                          <span className="bg-amber-100 text-amber-900 font-extrabold px-2.5 py-1 rounded-full text-xs border border-amber-300 flex items-center justify-center gap-1">
                            ⏱️ Cotización
                          </span>
                        ) : isPaid ? (
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-xs border border-emerald-200">
                            Liquidado
                          </span>
                        ) : c.pagado > 0 ? (
                          <span className="bg-amber-50 text-amber-700 font-bold px-2.5 py-1 rounded-full text-xs border border-amber-200">
                            Abonado
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 font-bold px-2.5 py-1 rounded-full text-xs border border-red-200">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingCaratula(c)}
                            className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Ver / Imprimir Carátula Documento"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setVerifyingFolio(c.folio)}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Verificar Autenticidad Oficial"
                          >
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          </button>

                          {c.tipoDocumento === "Cotización" && c.estado !== "Cancelado" && (
                            <button
                              onClick={() => setCaratulaToConvert(c)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg shadow-sm transition-colors"
                              title="Convertir Cotización a Carátula Oficial"
                            >
                              Aprobar
                            </button>
                          )}

                          {c.estado !== "Cancelado" && (
                            <button
                              onClick={() => {
                                setPaymentModalCaratula(c);
                                setMontoAbono(c.pendiente > 0 ? c.pendiente : 0);
                                setMetodoPago("Efectivo");
                                setReferenciaAbono("");
                                setNotasAbono("");
                              }}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Registrar Abono y Generar Ticket"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}

                          {/* Tickets History Button */}
                          <button
                            onClick={() => setViewingAbonosFolio(c.folio)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors relative"
                            title="Ver Tickets / Comprobantes de Abonos"
                          >
                            <Receipt className="w-4 h-4" />
                            {abonos.filter((a) => a.caratulaFolio === c.folio).length > 0 && (
                              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {abonos.filter((a) => a.caratulaFolio === c.folio).length}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => onEditCaratula(c)}
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Editar Carátula"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onDuplicateCaratula(c)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Duplicar / Nueva con estos datos"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {c.estado === "Cancelado" ? (
                            <button
                              onClick={() => setCaratulaToReactivate(c)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Reactivar Carátula"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setCaratulaToCancel(c);
                                setCaratulaCancelReason("Servicio cancelado por el cliente / Error de captura");
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Cancelar Carátula"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setCaratulaToDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar Carátula"
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

        {/* Load More Pagination Footer */}
        {filteredCaratulas.length > visibleCount && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando <span className="font-bold text-slate-900">{displayedCaratulas.length}</span> de <span className="font-bold text-slate-900">{filteredCaratulas.length}</span> carátulas
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVisibleCount((prev) => prev + 25)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" /> Cargar 25 más
              </button>
              <button
                onClick={() => setVisibleCount(filteredCaratulas.length)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Ver Todas ({filteredCaratulas.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DOCUMENT FULL VIEW MODAL */}
      {viewingCaratula && (() => {
        let finalCaratula = { ...viewingCaratula };
        if (
          (!finalCaratula.guardiasProgramadas || finalCaratula.guardiasProgramadas.length === 0) &&
          calendarEvents &&
          calendarEvents.length > 0
        ) {
          const matchingEvents = calendarEvents.filter((ev) => {
            if (ev.caratulaFolio && ev.caratulaFolio.trim().toLowerCase() === finalCaratula.folio.trim().toLowerCase()) {
              return true;
            }
            if ((!ev.caratulaFolio || ev.caratulaFolio === "sin asociar") && ev.clientId === finalCaratula.id) {
              return true;
            }
            return false;
          });
          if (matchingEvents.length > 0) {
            const loadedShifts: ScheduledShiftItem[] = matchingEvents.map((ev, i) => {
              const fecha = ev.fechaInicio ? ev.fechaInicio.slice(0, 10) : new Date().toISOString().slice(0, 10);
              const horaInicio = ev.fechaInicio ? ev.fechaInicio.slice(11, 16) : "08:00";
              const horaFin = ev.fechaFin ? ev.fechaFin.slice(11, 16) : "20:00";
              const fechaFinCalculada = ev.fechaFin ? ev.fechaFin.slice(0, 10) : fecha;
              let preset: ShiftPresetType = "custom";
              if (horaInicio === "08:00" && horaFin === "20:00") preset = "12h_dia";
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
                tipoServicio: ev.tipoServicio || finalCaratula.servicios[0]?.servicio || "Enfermería General",
                personalAsignado: ev.personalAsignado || "Por asignar",
                staffId: ev.staffId,
                staffNoSocio: ev.staffNoSocio,
                staffFoto: ev.staffFoto,
              };
            });
            finalCaratula = {
              ...finalCaratula,
              guardiasProgramadas: loadedShifts,
              guardiasAgendadas: loadedShifts.length,
            };
          }
        }

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 text-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Carátula de Servicio <span className="text-red-500 font-mono">{finalCaratula.folio}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Cliente: {finalCaratula.nombreCompletoCliente}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => printCaratulaDocument()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button
                    onClick={() =>
                      downloadCaratulaImage("caratula-modal-document", `Caratula_${finalCaratula.folio}.png`)
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1"
                  >
                    <ImageIcon className="w-4 h-4" /> PNG
                  </button>
                  <button
                    onClick={() =>
                      downloadCaratulaPDF("caratula-modal-document", `Caratula_${finalCaratula.folio}.pdf`)
                    }
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={() => setViewingCaratula(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Document Render Inside Modal */}
              <div className="bg-slate-200 p-4 rounded-2xl overflow-x-auto">
                <div id="caratula-modal-document">
                  <CaratulaDocument caratula={finalCaratula} documentRef={documentRef} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TICKET DOCUMENT VIEW MODAL */}
      {viewingTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-3xl max-w-lg w-full max-h-[95vh] overflow-y-auto p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  Ticket de Abono Generado
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Folio Ticket: <span className="font-mono text-emerald-400 font-bold">{viewingTicket.id}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => printCaratulaDocument()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1"
                  title="Imprimir Ticket"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    downloadCaratulaPDF("ticket-official-document", `Ticket_${viewingTicket.id}.pdf`)
                  }
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                  title="Descargar Ticket PDF"
                >
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button
                  onClick={() => setViewingTicket(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Ticket Content Container */}
            <div className="bg-slate-800/50 p-3 rounded-2xl">
              <AbonoTicketDocument
                ticket={viewingTicket}
                documentRef={ticketRef}
                onReactivate={
                  viewingTicket.estado === "Cancelado" && onReactivateAbono
                    ? () => setTicketToReactivate(viewingTicket)
                    : undefined
                }
              />
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setViewingTicket(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Cerrar Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER PAYMENT MODAL */}
      {(paymentModalCaratula || paymentModalClient) && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Registrar Abono a Cuenta de Cliente
              </h3>
              <button
                onClick={() => {
                  setPaymentModalCaratula(null);
                  setPaymentModalClient(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              {/* Cliente Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  CLIENTE / CONTRATANTE *
                </label>
                <select
                  value={activePaymentClientName}
                  onChange={(e) => {
                    const newClient = e.target.value;
                    setPaymentModalClient(newClient);
                    setPaymentModalCaratula(null);
                    const newBal = calculateClientBalance(newClient, caratulas, abonos);
                    setMontoAbono(newBal.saldoPendienteTotal > 0 ? newBal.saldoPendienteTotal : 0);
                  }}
                  className="w-full bg-white border border-slate-300 text-sm font-bold px-3 py-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {uniqueClients.map((clientName) => {
                    const bal = calculateClientBalance(clientName, caratulas, abonos);
                    return (
                      <option key={clientName} value={clientName}>
                        👤 {clientName} — Pendiente Global: {formatCurrency(bal.saldoPendienteTotal)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Client Balance Summary Box */}
              {(() => {
                const modalClientBal = calculateClientBalance(activePaymentClientName, caratulas, abonos);
                const clientCaratulas = caratulas.filter(
                  (c) =>
                    c.nombreCompletoCliente?.trim().toLowerCase() === activePaymentClientName.trim().toLowerCase() &&
                    isCaratulaActivaOConDeuda(c)
                );

                // Simulation of auto-allocation
                const testPool = modalClientBal.totalAbonado + Number(montoAbono) + (useComplementaryPayment ? Number(complementaryAmount) : 0);
                let poolRem = testPool;
                const allocationSimulation = clientCaratulas.map((c) => {
                  const req = c.total || 0;
                  const allocated = Math.min(req, Math.max(0, poolRem));
                  poolRem -= allocated;
                  const newPending = Math.max(0, req - allocated);
                  const isPaid = newPending <= 0;
                  return {
                    folio: c.folio,
                    total: req,
                    allocated,
                    newPending,
                    isPaid,
                  };
                });
                const excessCreditGenerated = Math.max(0, poolRem);

                return (
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Deuda Total Contratada:</span>
                        <span className="font-bold text-slate-800">{formatCurrency(modalClientBal.totalContratado)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Abonado Acumulado en Cuenta:</span>
                        <span className="font-bold">{formatCurrency(modalClientBal.totalAbonado)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 border-t border-slate-200 pt-1.5 font-bold">
                        <span>Saldo Pendiente Global Cliente:</span>
                        <span className="text-sm">{formatCurrency(modalClientBal.saldoPendienteTotal)}</span>
                      </div>
                      {modalClientBal.saldoAFavorTotal > 0 && (
                        <div className="flex justify-between text-indigo-700 font-extrabold bg-indigo-50 p-1 rounded border border-indigo-200">
                          <span>🎟️ Saldo a Favor Disponible:</span>
                          <span>{formatCurrency(modalClientBal.saldoAFavorTotal)}</span>
                        </div>
                      )}
                    </div>

                    {/* Live Auto-Allocation Simulation Box */}
                    {Number(montoAbono) > 0 && (
                      <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-300 text-xs space-y-2">
                        <div className="flex items-center justify-between font-extrabold text-emerald-900 border-b border-emerald-200 pb-1">
                          <span>💡 Simulación de Asignación Automática:</span>
                          <span className="font-mono text-emerald-800">+{formatCurrency(montoAbono)}</span>
                        </div>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          {allocationSimulation.map((sim) => (
                            <div key={sim.folio} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-emerald-100 shadow-2xs">
                              <span className="font-bold text-slate-800">{sim.folio}</span>
                              <span className="text-slate-600">Abono: <strong className="text-emerald-700">{formatCurrency(sim.allocated)}</strong></span>
                              <span className={sim.isPaid ? "text-emerald-600 font-black" : "text-amber-700 font-bold"}>
                                {sim.isPaid ? "🟢 Liquidada" : `Rest: ${formatCurrency(sim.newPending)}`}
                              </span>
                            </div>
                          ))}
                          {excessCreditGenerated > 0 && (
                            <div className="flex justify-between items-center bg-indigo-50 p-1.5 rounded-lg border border-indigo-200 text-indigo-950 font-bold">
                              <span>🎟️ Crédito Libre Guardado (A Favor):</span>
                              <span>+{formatCurrency(excessCreditGenerated)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Monto a Pagar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  MONTO A PAGAR / ABONAR ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Ingrese el monto recibido"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border-2 border-emerald-400 font-mono font-black text-xl px-4 py-2.5 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-inner"
                />

                {/* Overpayment Notice */}
                {(() => {
                  const bal = calculateClientBalance(activePaymentClientName, caratulas, abonos);
                  if (montoAbono > bal.saldoPendienteTotal && metodoPago !== "Saldo a Favor") {
                    return (
                      <div className="mt-2 bg-amber-50 p-2.5 rounded-xl border border-amber-300 text-[11px] text-amber-900 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Abono superior a la deuda del cliente: </span>
                          Se liquidarán los {formatCurrency(bal.saldoPendienteTotal)} pendientes y el excedente de{" "}
                          <span className="font-mono font-bold text-amber-950">
                            {formatCurrency(montoAbono - bal.saldoPendienteTotal)}
                          </span>{" "}
                          se guardará como <span className="font-extrabold underline">Saldo a Favor libre</span> para las próximas carátulas del cliente.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  MÉTODO DE PAGO *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago("Efectivo")}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      metodoPago === "Efectivo"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">💵</span>
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago("Transferencia")}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      metodoPago === "Transferencia" || metodoPago === "Transferencia Bancaria"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">🏦</span>
                    <span>Transf.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago("Tarjeta de Débito (TD)")}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      metodoPago === "Tarjeta de Débito (TD)"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">💳</span>
                    <span>TD Débito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago("Tarjeta de Crédito (TC)")}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      metodoPago === "Tarjeta de Crédito (TC)"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">💳</span>
                    <span>TC Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago("Saldo a Favor")}
                    className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                      metodoPago === "Saldo a Favor"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300"
                        : "bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    <span className="text-base">🎟️</span>
                    <span>A Favor</span>
                  </button>
                </div>

                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as PaymentMethod)}
                  className="w-full bg-white border border-slate-300 text-xs font-semibold px-3 py-2 rounded-xl text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Transferencia">🏦 Transferencia</option>
                  <option value="Tarjeta de Débito (TD)">💳 Tarjeta de Débito (TD)</option>
                  <option value="Tarjeta de Crédito (TC)">💳 Tarjeta de Crédito (TC)</option>
                  <option value="Saldo a Favor">🎟️ Saldo a Favor (Crédito acumulado)</option>
                  <option value="Transferencia Bancaria">🏦 Transferencia Bancaria</option>
                  <option value="Tarjeta de Débito/Crédito">💳 Tarjeta de Débito/Crédito</option>
                  <option value="Cheque">📄 Cheque</option>
                  <option value="Otro">❓ Otro / Diversos</option>
                </select>
              </div>

              {/* Complementary Payment Option */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs">
                  <input
                    type="checkbox"
                    checked={useComplementaryPayment}
                    onChange={(e) => {
                      setUseComplementaryPayment(e.target.checked);
                      if (e.target.checked) {
                        const rem = Math.max(0, paymentModalCaratula.pendiente - montoAbono);
                        setComplementaryAmount(rem);
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Agregar pago complementario en este mismo registro</span>
                </label>

                {useComplementaryPayment && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                        Método Complementario:
                      </label>
                      <select
                        value={complementaryMethod}
                        onChange={(e) => setComplementaryMethod(e.target.value as PaymentMethod)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold"
                      >
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="Transferencia">🏦 Transferencia</option>
                        <option value="Tarjeta de Débito (TD)">💳 Tarjeta Débito</option>
                        <option value="Tarjeta de Crédito (TC)">💳 Tarjeta Crédito</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                        Monto Complementario ($):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={complementaryAmount}
                        onChange={(e) => setComplementaryAmount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-300 font-mono font-bold rounded-lg p-1.5 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Referencia o Comprobante */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  NÚMERO DE REFERENCIA / CLAVE DE RASTREO <span className="text-slate-400 font-normal">(OPCIONAL)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Clave SPEI, # Voucher, Folio de autorización"
                  value={referenciaAbono}
                  onChange={(e) => setReferenciaAbono(e.target.value)}
                  className="w-full bg-white border border-slate-300 font-mono text-xs px-3 py-2 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Notas del Abono */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  NOTAS U OBSERVACIONES DEL PAGO <span className="text-slate-400 font-normal">(OPCIONAL)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej. Entregado por familiar / Pago parcial de turno"
                  value={notasAbono}
                  onChange={(e) => setNotasAbono(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-xs px-3 py-2 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalCaratula(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  <Receipt className="w-4 h-4" /> Generar Ticket de Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ABONOS & TICKETS HISTORY MODAL FOR A SPECIFIC CARÁTULA */}
      {viewingAbonosFolio && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  Historial de Abonos y Tickets — Folio <span className="text-red-600 font-mono">{viewingAbonosFolio}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Listado de comprobantes oficiales generados para esta carátula.
                </p>
              </div>
              <button
                onClick={() => setViewingAbonosFolio(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Abonos List */}
            {abonos.filter((a) => a.caratulaFolio === viewingAbonosFolio).length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Receipt className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-sm">No se han registrado abonos o tickets para este folio aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {abonos
                  .filter((a) => a.caratulaFolio === viewingAbonosFolio)
                  .map((t) => {
                    const isCancelled = t.estado === "Cancelado";
                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                          isCancelled
                            ? "bg-rose-50/50 border-rose-200 opacity-80"
                            : "bg-slate-50 border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                              {t.id}
                            </span>
                            <span className="text-xs text-slate-500">{t.fecha}</span>

                            {isCancelled ? (
                              <span className="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase">
                                Cancelado
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase">
                                Activo
                              </span>
                            )}
                          </div>

                          <div className="text-sm font-bold text-slate-900">
                            Abono de{" "}
                            <span
                              className={`font-mono text-base ${
                                isCancelled ? "text-slate-500 line-through" : "text-emerald-600"
                              }`}
                            >
                              {formatCurrency(t.montoAbonado)}
                            </span>{" "}
                            ({t.metodoPago})
                          </div>

                          {t.referencia && (
                            <div className="text-xs text-slate-500 font-mono">
                              Ref: {t.referencia}
                            </div>
                          )}

                          {isCancelled && t.motivoCancelacion && (
                            <div className="text-xs text-rose-700 bg-rose-100/70 px-2.5 py-1 rounded-lg border border-rose-200">
                              <strong>Motivo Cancelación:</strong> {t.motivoCancelacion}
                              {t.fechaCancelacion && ` (${t.fechaCancelacion})`}
                            </div>
                          )}

                          <div className="text-[11px] text-slate-400">
                            Registrado por: {t.atendidoPor || "Administración"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setViewingAbonosFolio(null);
                              setViewingTicket(t);
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Ticket
                          </button>

                          {isCancelled && onReactivateAbono ? (
                            <button
                              onClick={() => setTicketToReactivate(t)}
                              className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors border border-emerald-300"
                              title="Volver a activar este ticket/abono"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Reactivar Ticket
                            </button>
                          ) : !isCancelled && onCancelAbono ? (
                            <button
                              onClick={() => {
                                setTicketToCancel(t);
                                setCancelReasonInput("Error de registro / Cobro no efectuado");
                              }}
                              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors border border-rose-300"
                              title="Cancelar este abono"
                            >
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          ) : null}

                          {onDeleteAbono && (
                            <button
                              onClick={() => setTicketToDelete(t)}
                              className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors border border-slate-200"
                              title="Eliminar registro de abono"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="pt-2 text-right">
              <button
                onClick={() => setViewingAbonosFolio(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Portal Modal Overlay */}
      {verifyingFolio && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto p-2 sm:p-6 animate-in fade-in">
          <CaratulaVerificationPortal
            folio={verifyingFolio}
            caratulas={caratulas}
            abonos={abonos}
            onBack={() => setVerifyingFolio(null)}
            isAdminView={true}
          />
        </div>
      )}

      {/* CONFIRMAR ELIMINACIÓN DEFINITIVA DE TICKET */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Eliminar Ticket Definitivamente</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Está seguro de eliminar definitivamente el ticket{" "}
                <strong className="text-slate-900 font-mono">{ticketToDelete.id}</strong> por{" "}
                <strong className="text-rose-700 font-mono">
                  {formatCurrency(ticketToDelete.montoAbonado)}
                </strong>
                ?
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Fecha:</span>{" "}
                  <span className="font-medium text-slate-800">{ticketToDelete.fecha}</span>
                </div>
                <div>
                  <span className="text-slate-500">Carátula:</span>{" "}
                  <span className="font-mono font-bold text-sky-700">{ticketToDelete.caratulaFolio}</span>
                </div>
                <div>
                  <span className="text-slate-500">Cliente:</span>{" "}
                  <span className="font-semibold text-slate-800">{ticketToDelete.clienteNombre}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                Esta acción recalculará el saldo de la carátula y del cliente automáticamente.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setTicketToDelete(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmDeleteTicket}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, Eliminar Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR CANCELACIÓN DE TICKET */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
            <div className="bg-amber-600 text-white p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Cancelar Ticket de Abono</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                El ticket <strong className="font-mono text-slate-900">{ticketToCancel.id}</strong> por{" "}
                <strong className="text-emerald-700 font-mono">{formatCurrency(ticketToCancel.montoAbonado)}</strong> quedará cancelado.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la Cancelación:
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                  placeholder="Ej. Error en captura de monto"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setTicketToCancel(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmCancelTicket}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Cancelación</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR REACTIVACIÓN DE TICKET */}
      {ticketToReactivate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
            <div className="bg-emerald-600 text-white p-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Reactivar Ticket de Abono</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Desea reactivar el ticket <strong className="font-mono text-slate-900">{ticketToReactivate.id}</strong> por{" "}
                <strong className="text-emerald-700 font-mono">{formatCurrency(ticketToReactivate.montoAbonado)}</strong>?
              </p>
              <p className="text-[11px] text-slate-500">
                El monto se volverá a contabilizar como abonado hacia la carátula y el saldo del cliente.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setTicketToReactivate(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmReactivateTicket}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reactivar Ticket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR CANCELACIÓN DE CARÁTULA */}
      {caratulaToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Cancelar Carátula</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Está seguro de cancelar la carátula <strong className="font-mono text-slate-900">{caratulaToCancel.folio}</strong> de{" "}
                <strong className="text-slate-800">{caratulaToCancel.nombreCompletoCliente}</strong>?
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de Cancelación:
                </label>
                <input
                  type="text"
                  value={caratulaCancelReason}
                  onChange={(e) => setCaratulaCancelReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                  placeholder="Ej. Servicio cancelado por el cliente"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCaratulaToCancel(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmCancelCaratula}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <X className="w-4 h-4" />
                  <span>Sí, Cancelar Carátula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR REACTIVACIÓN DE CARÁTULA */}
      {caratulaToReactivate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
            <div className="bg-emerald-600 text-white p-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Reactivar Carátula</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Desea reactivar la carátula <strong className="font-mono text-slate-900">{caratulaToReactivate.folio}</strong> de{" "}
                <strong className="text-slate-800">{caratulaToReactivate.nombreCompletoCliente}</strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCaratulaToReactivate(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmReactivateCaratula}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reactivar Carátula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR CONVERSIÓN DE COTIZACIÓN */}
      {caratulaToConvert && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
            <div className="bg-amber-500 text-white p-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Aprobar y Convertir a Carátula Oficial</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Desea convertir la Cotización <strong className="font-mono text-slate-900">{caratulaToConvert.folio}</strong> a una Carátula Oficial contratada por{" "}
                <strong className="text-slate-800">{caratulaToConvert.nombreCompletoCliente}</strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCaratulaToConvert(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmConvertToCaratula}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprobar Carátula</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR ELIMINACIÓN DE CARÁTULA */}
      {caratulaToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Eliminar Carátula</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Está seguro de eliminar definitivamente la carátula{" "}
                <strong className="font-mono text-slate-900">{caratulaToDelete.folio}</strong> de{" "}
                <strong className="text-slate-800">{caratulaToDelete.nombreCompletoCliente}</strong>?
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCaratulaToDelete(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmDeleteCaratula}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
