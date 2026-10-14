import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Wallet,
  Scale,
  Search,
  FileText,
  Receipt,
  PlusCircle,
  Printer,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  X,
  User,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  RotateCcw,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Client, Caratula, AbonoTicket } from "../types";
import { formatCurrency, isTestCaratulaFolio } from "../utils/formatters";
import {
  calculateClientBalance,
  ClientBalanceInfo,
  matchCaratulaToClient,
  matchAbonoToClient,
  normalizeClientKey,
} from "../utils/clientBalance";
import { AbonoTicketDocument } from "./AbonoTicketDocument";
import { deduplicateClients } from "../utils/dataIntegrity";

interface ClientBalancesManagerProps {
  clients: Client[];
  caratulas: Caratula[];
  abonos: AbonoTicket[];
  initialSelectedClientId?: string | null;
  onSaveAbono: (abono: AbonoTicket) => void;
  onCancelAbono?: (abono: AbonoTicket, motivo?: string) => void;
  onReactivateAbono?: (abono: AbonoTicket) => void;
  onDeleteAbono?: (id: string, caratulaFolio: string) => void;
  onSaveClient?: (client: Client) => void;
  onSaveCaratula?: (caratula: Caratula) => void;
  onSelectCaratulaForView?: (caratula: Caratula) => void;
  currentUserName?: string;
}

export const ClientBalancesManager: React.FC<ClientBalancesManagerProps> = ({
  clients,
  caratulas,
  abonos,
  initialSelectedClientId,
  onSaveAbono,
  onCancelAbono,
  onReactivateAbono,
  onDeleteAbono,
  onSaveClient,
  onSaveCaratula,
  onSelectCaratulaForView,
  currentUserName = "Administración",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "adeudo" | "favor" | "al_corriente">("todos");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialSelectedClientId || null);
  const [activeTab, setActiveTab] = useState<"caratulas" | "tickets">("caratulas");

  useEffect(() => {
    if (initialSelectedClientId) {
      setSelectedClientId(initialSelectedClientId);
    }
  }, [initialSelectedClientId]);

  // Payment Modal state
  const [paymentModalClient, setPaymentModalClient] = useState<Client | null>(null);
  const [paymentModalCaratula, setPaymentModalCaratula] = useState<Caratula | null>(null);
  const [montoAbono, setMontoAbono] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<string>("Transferencia");
  const [referenciaAbono, setReferenciaAbono] = useState<string>("");

  // Viewing Ticket Document Modal
  const [viewingTicket, setViewingTicket] = useState<AbonoTicket | null>(null);
  const ticketDocRef = useRef<HTMLDivElement>(null);
  const accountStatementRef = useRef<HTMLDivElement>(null);

  // Manual balance override modal state
  const [manualBalanceModalOpen, setManualBalanceModalOpen] = useState(false);
  const [manualSaldoAFavor, setManualSaldoAFavor] = useState<string>("");
  const [manualSaldoPendiente, setManualSaldoPendiente] = useState<string>("");
  const [manualNotas, setManualNotas] = useState<string>("");

  // In-app interactive confirmation dialogs (eliminates blocked window.confirm / prompt)
  const [ticketToDelete, setTicketToDelete] = useState<AbonoTicket | null>(null);
  const [ticketToCancel, setTicketToCancel] = useState<AbonoTicket | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>("Cancelación de abono por administración");
  const [ticketToReactivate, setTicketToReactivate] = useState<AbonoTicket | null>(null);
  const [caratulaToLiquidate, setCaratulaToLiquidate] = useState<Caratula | null>(null);

  // Compute all clients' balances
  const clientBalancesList = useMemo(() => {
    const uniqueClients = deduplicateClients(clients);

    const knownNames = new Set(
      uniqueClients.map((c) => normalizeClientKey(c.nombreCompletoCliente))
    );

    const allClients: Client[] = [...uniqueClients];

    // Detect clients who have carátulas but aren't in the clients table yet
    caratulas.forEach((c) => {
      if (c.estado === "Cancelado" || c.tipoDocumento === "Cotización") return;
      const nameKey = normalizeClientKey(c.nombreCompletoCliente);
      if (nameKey && !knownNames.has(nameKey)) {
        knownNames.add(nameKey);
        allClients.push({
          id: c.id && !uniqueClients.some((uc) => uc.id === c.id) ? c.id : `CLI-${c.folio || Date.now()}`,
          timestamp: c.timestamp || new Date().toISOString(),
          nombreCompletoCliente: c.nombreCompletoCliente,
          nombreCompletoRS: c.nombreCompletoRS || c.nombreCompletoCliente,
          numeroContacto: c.numeroContacto || "",
          numeroContacto2: c.numeroContacto2 || "",
          numeroContacto3: c.numeroContacto3 || "",
          correo: c.correo || "",
          direccionServicio: c.direccionServicio || "",
          edad: c.edad || "",
          diagnostico: c.diagnostico || "",
          especificaciones: c.especificaciones || "",
        });
      }
    });

    // Detect clients who have abonos but aren't in the clients table yet
    abonos.forEach((a) => {
      if (a.estado === "Cancelado") return;
      const nameKey = normalizeClientKey(a.clienteNombre);
      if (nameKey && !knownNames.has(nameKey)) {
        knownNames.add(nameKey);
        allClients.push({
          id: `CLI-${a.id || Date.now()}`,
          timestamp: a.fecha || new Date().toISOString(),
          nombreCompletoCliente: a.clienteNombre,
          nombreCompletoRS: a.receptorNombre || a.clienteNombre,
          numeroContacto: "",
          correo: "",
          direccionServicio: "",
          edad: "",
          diagnostico: "",
          especificaciones: "",
        });
      }
    });

    return allClients.map((client) => {
      const balance = calculateClientBalance(client, caratulas, abonos, allClients);
      return {
        client,
        balance,
      };
    });
  }, [clients, caratulas, abonos]);

  // Aggregate global metrics
  const globalMetrics = useMemo(() => {
    let totalAdeudo = 0;
    let totalFavor = 0;
    let countAdeudo = 0;
    let countFavor = 0;
    let countAlCorriente = 0;

    clientBalancesList.forEach(({ balance }) => {
      if (balance.saldoPendienteTotal > 0) {
        totalAdeudo += balance.saldoPendienteTotal;
        countAdeudo++;
      } else if (balance.saldoAFavorTotal > 0) {
        totalFavor += balance.saldoAFavorTotal;
        countFavor++;
      } else {
        countAlCorriente++;
      }
    });

    const totalTicketsRecaudados = abonos
      .filter((a) => a.estado !== "Cancelado")
      .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

    return {
      totalAdeudo,
      totalFavor,
      totalTicketsRecaudados,
      countAdeudo,
      countFavor,
      countAlCorriente,
      totalClientes: clientBalancesList.length,
    };
  }, [clientBalancesList, abonos]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return clientBalancesList.filter(({ client, balance }) => {
      // Search match
      const matchSearch =
        !q ||
        (client.nombreCompletoCliente || "").toLowerCase().includes(q) ||
        (client.id || "").toLowerCase().includes(q) ||
        (client.numeroContacto || "").includes(q) ||
        (client.nombreCompletoRS || "").toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Status filter
      if (statusFilter === "adeudo") return balance.saldoPendienteTotal > 0;
      if (statusFilter === "favor") return balance.saldoAFavorTotal > 0;
      if (statusFilter === "al_corriente")
        return balance.saldoPendienteTotal <= 0 && balance.saldoAFavorTotal <= 0;
      return true;
    });
  }, [clientBalancesList, searchTerm, statusFilter]);

  // Selected client details
  const activeSelected = useMemo(() => {
    if (!selectedClientId) {
      // If nothing selected, pick the first one from filtered list if available
      return filteredClients[0] || null;
    }
    const targetKey = normalizeClientKey(selectedClientId);
    const found = clientBalancesList.find(
      (c) =>
        normalizeClientKey(c.client.id) === targetKey ||
        normalizeClientKey(c.client.nombreCompletoCliente) === targetKey
    );
    return found || filteredClients[0] || null;
  }, [selectedClientId, clientBalancesList, filteredClients]);

  // Caratulas of the active client (excluding test carátulas)
  const activeClientCaratulas = useMemo(() => {
    if (!activeSelected) return [];
    return caratulas
      .filter((c) => matchCaratulaToClient(c, activeSelected.client) && !isTestCaratulaFolio(c.folio))
      .sort((a, b) => (b.folio || "").localeCompare(a.folio || "", undefined, { numeric: true }));
  }, [activeSelected, caratulas]);

  // Payment Tickets of the active client
  const activeClientTickets = useMemo(() => {
    if (!activeSelected) return [];
    const clientFolios = new Set<string>(activeClientCaratulas.map((c) => String(c.folio || "").trim().toUpperCase()));
    return abonos
      .filter((a) => matchAbonoToClient(a, activeSelected.client, clientFolios))
      .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
  }, [activeSelected, activeClientCaratulas, abonos]);

  // Handle Manual Balance Editor
  const handleOpenManualBalanceModal = (client: Client, balance: ClientBalanceInfo) => {
    setManualBalanceModalOpen(true);
    setManualSaldoAFavor(
      typeof client.saldoAFavorManual === "number"
        ? String(client.saldoAFavorManual)
        : balance.saldoAFavorTotal > 0
        ? String(balance.saldoAFavorTotal)
        : ""
    );
    setManualSaldoPendiente(
      typeof client.saldoPendienteManual === "number"
        ? String(client.saldoPendienteManual)
        : balance.saldoPendienteTotal > 0
        ? String(balance.saldoPendienteTotal)
        : ""
    );
    setManualNotas(client.saldoAjusteNotas || "");
  };

  const handleSaveManualBalance = () => {
    if (!activeSelected || !onSaveClient) return;
    const aFavorClean = manualSaldoAFavor.trim();
    const pendienteClean = manualSaldoPendiente.trim();

    const aFavorNum = aFavorClean === "" ? null : Number(aFavorClean);
    const pendienteNum = pendienteClean === "" ? null : Number(pendienteClean);

    const updatedClient: Client = {
      ...activeSelected.client,
      saldoAFavorManual: aFavorNum !== null && !isNaN(aFavorNum) ? Math.max(0, aFavorNum) : null,
      saldoPendienteManual: pendienteNum !== null && !isNaN(pendienteNum) ? Math.max(0, pendienteNum) : null,
      saldoAjusteNotas: manualNotas.trim(),
      saldoAjusteFecha: new Date().toISOString(),
      saldoAjustePor: currentUserName,
    };

    onSaveClient(updatedClient);
    setManualBalanceModalOpen(false);
  };

  const handleResetManualBalance = () => {
    if (!activeSelected || !onSaveClient) return;
    const updatedClient: Client = {
      ...activeSelected.client,
      saldoAFavorManual: null,
      saldoPendienteManual: null,
      saldoAjusteNotas: "",
      saldoAjusteFecha: new Date().toISOString(),
      saldoAjustePor: currentUserName,
    };

    onSaveClient(updatedClient);
    setManualBalanceModalOpen(false);
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
    onCancelAbono(ticketToCancel, cancelReasonInput.trim() || "Cancelación de abono por administración");
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

  const handleConfirmLiquidateCaratula = () => {
    if (!caratulaToLiquidate || !onSaveCaratula) return;
    const updated: Caratula = {
      ...caratulaToLiquidate,
      pagado: caratulaToLiquidate.total,
      pendiente: 0,
      estado: caratulaToLiquidate.estado === "Cancelado" ? "Activo" : caratulaToLiquidate.estado,
    };
    onSaveCaratula(updated);
    setCaratulaToLiquidate(null);
  };

  // Handle opening payment modal
  const handleOpenPayment = (client: Client, caratula?: Caratula) => {
    setPaymentModalClient(client);
    setPaymentModalCaratula(caratula || null);
    const balance = calculateClientBalance(client, caratulas, abonos);
    const defaultAmount = caratula ? caratula.pendiente || 0 : balance.saldoPendienteTotal || 0;
    setMontoAbono(defaultAmount > 0 ? defaultAmount : 0);
    setReferenciaAbono("");
  };

  // Submit payment from modal
  const handleSavePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalClient) return;
    if (montoAbono <= 0) {
      alert("Por favor ingrese un monto de abono mayor a $0.00.");
      return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const targetCaratula = paymentModalCaratula;
    const clientBal = calculateClientBalance(
      paymentModalClient,
      caratulas,
      abonos
    );

    const targetFolio = targetCaratula ? targetCaratula.folio : "CUENTA-GENERAL";
    const caratulaMontoTotal = targetCaratula ? targetCaratula.total || 0 : clientBal.totalContratado;
    const pagadoCaratulaAnterior = targetCaratula ? targetCaratula.pagado || 0 : clientBal.totalAbonado;
    const pagadoCaratulaNuevoTotal = pagadoCaratulaAnterior + montoAbono;
    const pendienteRestante = targetCaratula
      ? Math.max(0, caratulaMontoTotal - pagadoCaratulaNuevoTotal)
      : Math.max(0, clientBal.saldoPendienteTotal - montoAbono);

    const assignedBranchId =
      targetCaratula?.sucursalId ||
      paymentModalClient.sucursalId ||
      "pachuca";
    const assignedBranchName =
      targetCaratula?.sucursalNombre ||
      paymentModalClient.sucursalNombre ||
      "Cuidarte Pachuca";

    const newTicket: AbonoTicket = {
      id: `TKT-${targetFolio}-${now.getTime().toString().slice(-4)}`,
      caratulaFolio: targetFolio,
      clienteNombre: paymentModalClient.nombreCompletoCliente,
      receptorNombre:
        paymentModalClient.nombreCompletoRS || paymentModalClient.nombreCompletoCliente,
      montoAbonado: montoAbono,
      totalCaratula: caratulaMontoTotal,
      pagadoAnterior: pagadoCaratulaAnterior,
      pagadoNuevoTotal: pagadoCaratulaNuevoTotal,
      pendienteRestante,
      metodoPago,
      referencia: referenciaAbono.trim() || "Abono / Pago registrado",
      fecha: formattedDate,
      atendidoPor: currentUserName || "Administración",
      saldoAFavorAplicado: metodoPago === "Saldo a Favor" ? montoAbono : undefined,
      sucursalId: assignedBranchId,
      sucursalNombre: assignedBranchName,
    };

    onSaveAbono(newTicket);
    setPaymentModalClient(null);
    setPaymentModalCaratula(null);
    setMontoAbono(0);
  };

  const handlePrintAccountStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Banner & Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Scale className="w-4 h-4" />
            Control Financiero de Clientes
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Saldos y Estados de Cuenta de Clientes
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Supervisa el estado financiero de cada cliente: saldos en adeudo, saldos a favor, monto
            pagado por carátula y desglose de tickets de abono.
          </p>
        </div>

        {activeSelected && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenPayment(activeSelected.client)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Abono a Cliente</span>
            </button>
            <button
              onClick={handlePrintAccountStatement}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition min-h-[44px]"
              title="Imprimir Estado de Cuenta del Cliente Seleccionado"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Imprimir Estado de Cuenta</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Financial Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">
              Saldo Total en Adeudo
            </span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 mt-2 font-mono">
            {formatCurrency(globalMetrics.totalAdeudo)}
          </div>
          <p className="text-[11px] text-rose-600 mt-1 font-medium">
            {globalMetrics.countAdeudo} clientes con adeudo pendiente
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
              Saldo Total a Favor
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2 font-mono">
            {formatCurrency(globalMetrics.totalFavor)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 font-medium">
            {globalMetrics.countFavor} clientes con crédito excedente
          </p>
        </div>

        <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wide">
              Total Abonado / Tickets
            </span>
            <Receipt className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-sky-700 mt-2 font-mono">
            {formatCurrency(globalMetrics.totalTicketsRecaudados)}
          </div>
          <p className="text-[11px] text-sky-600 mt-1 font-medium">
            {abonos.filter((a) => a.estado !== "Cancelado").length} comprobantes de pago registrados
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Cuentas al Corriente
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2 font-mono">
            {globalMetrics.countAlCorriente} / {globalMetrics.totalClientes}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Clientes sin deuda pendiente
          </p>
        </div>
      </div>

      {/* Main Content Area: Split List & Selected Client Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client Selector & Filterable List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-600" />
                Listado de Clientes
              </h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {filteredClients.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, ID o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <button
                onClick={() => setStatusFilter("todos")}
                className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                  statusFilter === "todos"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter("adeudo")}
                className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === "adeudo"
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Adeudo ({globalMetrics.countAdeudo})
              </button>
              <button
                onClick={() => setStatusFilter("favor")}
                className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === "favor"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                A Favor ({globalMetrics.countFavor})
              </button>
              <button
                onClick={() => setStatusFilter("al_corriente")}
                className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                  statusFilter === "al_corriente"
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Al Corriente
              </button>
            </div>

            {/* Client Cards List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredClients.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No se encontraron clientes con los filtros aplicados.
                </div>
              ) : (
                filteredClients.map(({ client, balance }, idx) => {
                  const isSelected =
                    (Boolean(activeSelected?.client.id) && activeSelected?.client.id === client.id) ||
                    normalizeClientKey(activeSelected?.client.nombreCompletoCliente) ===
                      normalizeClientKey(client.nombreCompletoCliente);
                  const hasDebt = balance.saldoPendienteTotal > 0;
                  const hasFavor = balance.saldoAFavorTotal > 0;

                  return (
                    <button
                      key={`bal-cli-${client.id || idx}-${idx}`}
                      onClick={() => setSelectedClientId(client.id || client.nombreCompletoCliente)}
                      className={`w-full text-left p-3 rounded-xl border transition flex flex-col gap-2 min-h-[44px] ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-800 shadow-md ring-2 ring-emerald-500"
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-bold text-xs">
                          {client.nombreCompletoCliente}
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            isSelected ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {client.id}
                        </span>
                      </div>

                      {/* Balance Badge */}
                      <div className="flex items-center justify-between text-xs">
                        <span className={`text-[11px] ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          Saldo actual:
                        </span>
                        {hasDebt ? (
                          <span
                            className={`font-mono font-extrabold px-2 py-0.5 rounded-full text-[11px] ${
                              isSelected
                                ? "bg-rose-500 text-white"
                                : "bg-rose-100 text-rose-700 border border-rose-300"
                            }`}
                          >
                            Adeudo: {formatCurrency(balance.saldoPendienteTotal)}
                          </span>
                        ) : hasFavor ? (
                          <span
                            className={`font-mono font-extrabold px-2 py-0.5 rounded-full text-[11px] ${
                              isSelected
                                ? "bg-emerald-500 text-white"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            }`}
                          >
                            A Favor: {formatCurrency(balance.saldoAFavorTotal)}
                          </span>
                        ) : (
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                              isSelected
                                ? "bg-slate-800 text-emerald-400"
                                : "bg-slate-100 text-emerald-700"
                            }`}
                          >
                            $0.00 Al corriente
                          </span>
                        )}
                      </div>

                      {/* Mini stats */}
                      <div
                        className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                          isSelected ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"
                        }`}
                      >
                        <span>Contratado: {formatCurrency(balance.totalContratado)}</span>
                        <span>Abonado: {formatCurrency(balance.totalAbonado)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Account Statement of the Selected Client */}
        <div className="lg:col-span-8 space-y-6">
          {activeSelected ? (
            <div
              ref={accountStatementRef}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 print:p-0 print:border-none print:shadow-none"
            >
              {/* Client Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">
                      {activeSelected.client.nombreCompletoCliente}
                    </h2>
                    <span className="bg-sky-100 text-sky-800 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border border-sky-200">
                      {activeSelected.client.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    {activeSelected.client.nombreCompletoRS && (
                      <p>
                        <strong className="text-slate-700">Receptor / Paciente:</strong>{" "}
                        {activeSelected.client.nombreCompletoRS}
                      </p>
                    )}
                    {activeSelected.client.numeroContacto && (
                      <p>
                        <strong className="text-slate-700">Contacto:</strong>{" "}
                        {activeSelected.client.numeroContacto}
                      </p>
                    )}
                    {activeSelected.client.direccionServicio && (
                      <p>
                        <strong className="text-slate-700">Domicilio:</strong>{" "}
                        {activeSelected.client.direccionServicio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  {/* Big Balance Box */}
                  <div
                    className={`p-4 rounded-xl border text-right min-w-[210px] ${
                      activeSelected.balance.saldoPendienteTotal > 0
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : activeSelected.balance.saldoAFavorTotal > 0
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider block">
                        {activeSelected.balance.saldoPendienteTotal > 0
                          ? "Saldo Pendiente en Adeudo"
                          : activeSelected.balance.saldoAFavorTotal > 0
                          ? "Saldo a Favor del Cliente"
                          : "Estado de Cuenta"}
                      </span>
                      {activeSelected.balance.isManualOverride && (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                          Manual
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-2xl font-mono font-black mt-0.5 ${
                        activeSelected.balance.saldoPendienteTotal > 0
                          ? "text-rose-700"
                          : activeSelected.balance.saldoAFavorTotal > 0
                          ? "text-emerald-700"
                          : "text-slate-800"
                      }`}
                    >
                      {activeSelected.balance.saldoPendienteTotal > 0
                        ? formatCurrency(activeSelected.balance.saldoPendienteTotal)
                        : activeSelected.balance.saldoAFavorTotal > 0
                        ? formatCurrency(activeSelected.balance.saldoAFavorTotal)
                        : "$0.00 Al Corriente"}
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {activeSelected.balance.saldoPendienteTotal > 0
                        ? "Monto pendiente por liquidar"
                        : activeSelected.balance.saldoAFavorTotal > 0
                        ? "Crédito a favor para futuros servicios"
                        : "Sin saldos adeudados"}
                    </span>
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenManualBalanceModal(activeSelected.client, activeSelected.balance)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow-xs"
                      title="Editar manualmente el saldo a favor o pendiente de este cliente"
                    >
                      <Wrench className="w-3.5 h-3.5 text-amber-700" />
                      <span>Editar Saldo Manual</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition"
                      title="Imprimir estado de cuenta"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Manual Override Banner */}
              {activeSelected.balance.isManualOverride && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Wrench className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">Ajuste de Saldo Manual Vigente</span>
                        {activeSelected.client.saldoAjusteFecha && (
                          <span className="text-[10px] text-amber-700 font-medium">
                            (Actualizado: {new Date(activeSelected.client.saldoAjusteFecha).toLocaleDateString("es-MX")})
                          </span>
                        )}
                      </div>
                      <p className="text-amber-900 mt-0.5">
                        {activeSelected.balance.saldoManualNotas || "El saldo ha sido fijado manualmente para este cliente."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenManualBalanceModal(activeSelected.client, activeSelected.balance)}
                      className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Modificar
                    </button>
                    <button
                      onClick={handleResetManualBalance}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-amber-300 text-slate-700 font-semibold rounded-lg transition flex items-center gap-1"
                      title="Restablecer el saldo al cálculo automático de carátulas y tickets"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" /> Restablecer Automático
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Financial KPI cards for Client */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Total Contratado
                  </span>
                  <span className="text-base font-extrabold font-mono text-slate-900">
                    {formatCurrency(activeSelected.balance.totalContratado)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                    Total Pagado / Abonado
                  </span>
                  <span className="text-base font-extrabold font-mono text-emerald-700">
                    {formatCurrency(activeSelected.balance.totalAbonado)}
                  </span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block">
                    Saldo Pendiente
                  </span>
                  <span className="text-base font-extrabold font-mono text-rose-700">
                    {formatCurrency(activeSelected.balance.saldoPendienteTotal)}
                  </span>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                    Saldo a Favor
                  </span>
                  <span className="text-base font-extrabold font-mono text-emerald-800">
                    {formatCurrency(activeSelected.balance.saldoAFavorTotal)}
                  </span>
                </div>
              </div>

              {/* Navigation Switch Between Carátulas and Tickets */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("caratulas")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "caratulas"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>Carátulas del Cliente ({activeClientCaratulas.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("tickets")}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "tickets"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <span>Tickets de Pago ({activeClientTickets.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => handleOpenPayment(activeSelected.client)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Nuevo Abono</span>
                </button>
              </div>

              {/* SECTION 1: Caratulas Breakdown */}
              {activeTab === "caratulas" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <p>
                      Desglose de carátulas de servicio, total contratado, monto pagado y saldo
                      pendiente por carátula:
                    </p>
                  </div>

                  {activeClientCaratulas.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
                      Este cliente no cuenta con carátulas activas registradas.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-800">
                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3">Folio</th>
                            <th className="py-3 px-3">Periodo / Fecha</th>
                            <th className="py-3 px-3 text-right">Total Carátula</th>
                            <th className="py-3 px-3 text-right text-emerald-700">Monto Pagado</th>
                            <th className="py-3 px-3 text-right text-rose-700">Saldo Pendiente</th>
                            <th className="py-3 px-3 text-center">Estatus</th>
                            <th className="py-3 px-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {activeClientCaratulas.map((c) => {
                            const isPaid = (c.pendiente || 0) <= 0;
                            return (
                              <tr key={c.folio} className="hover:bg-slate-50/80 transition">
                                <td className="py-3 px-3 font-mono font-bold text-sky-700">
                                  {c.folio}
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  {c.inicio ? c.inicio.slice(0, 10) : "Sin fecha"}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                  {formatCurrency(c.total || 0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                                  {formatCurrency(c.pagado || 0)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                                  {formatCurrency(c.pendiente >= 0 ? c.pendiente : 0)}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {isPaid ? (
                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                                      Liquidado
                                    </span>
                                  ) : (c.pagado || 0) > 0 ? (
                                    <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-amber-200">
                                      Abonado
                                    </span>
                                  ) : (
                                    <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-rose-200">
                                      Pendiente
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {!isPaid && (
                                      <>
                                        <button
                                          onClick={() => handleOpenPayment(activeSelected.client, c)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                                          title="Abonar a esta carátula"
                                        >
                                          Abonar
                                        </button>
                                        {onSaveCaratula && (
                                          <button
                                            onClick={() => setCaratulaToLiquidate(c)}
                                            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5"
                                            title="Marcar esta carátula como 100% liquidada"
                                          >
                                            <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                            <span>Liquidar</span>
                                          </button>
                                        )}
                                      </>
                                    )}
                                    {onSelectCaratulaForView && (
                                      <button
                                        onClick={() => onSelectCaratulaForView(c)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                                        title="Ver Carátula"
                                      >
                                        Ver
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: Payment Tickets History */}
              {activeTab === "tickets" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <p>Historial de comprobantes y tickets de pago registrados para el cliente:</p>
                  </div>

                  {activeClientTickets.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
                      No se han registrado tickets de pago o abonos para este cliente todavía.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs text-slate-800">
                        <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3">Folio Ticket</th>
                            <th className="py-3 px-3">Fecha y Hora</th>
                            <th className="py-3 px-3">Carátula Ref.</th>
                            <th className="py-3 px-3 text-right text-emerald-700">Monto Abonado</th>
                            <th className="py-3 px-3">Método de Pago</th>
                            <th className="py-3 px-3">Referencia</th>
                            <th className="py-3 px-3 text-center">Estatus</th>
                            <th className="py-3 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-sans">
                          {activeClientTickets.map((t) => {
                            const isCancelled = t.estado === "Cancelado";
                            return (
                              <tr
                                key={t.id}
                                className={`hover:bg-slate-50/80 transition ${
                                  isCancelled ? "bg-rose-50/40 text-slate-400 opacity-75" : ""
                                }`}
                              >
                                <td className="py-3 px-3 font-mono font-bold text-slate-900">
                                  {t.id}
                                </td>
                                <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                  {t.fecha}
                                </td>
                                <td className="py-3 px-3 font-mono text-sky-700 font-semibold">
                                  {t.caratulaFolio}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                                  {formatCurrency(t.montoAbonado)}
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700">
                                  {t.metodoPago}
                                </td>
                                <td className="py-3 px-3 text-slate-500 max-w-[150px] truncate">
                                  {t.referencia || "—"}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {isCancelled ? (
                                    <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-rose-200">
                                      Cancelado
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">
                                      Activo
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setViewingTicket(t)}
                                      className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-1"
                                      title="Ver / Imprimir Ticket"
                                    >
                                      <Printer className="w-3 h-3 text-sky-600" />
                                      <span>Ticket</span>
                                    </button>
                                    {!isCancelled && onCancelAbono && (
                                      <button
                                        onClick={() => {
                                          setTicketToCancel(t);
                                          setCancelReasonInput("Cancelación de ticket por administración");
                                        }}
                                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5"
                                        title="Cancelar Abono"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>Cancelar</span>
                                      </button>
                                    )}
                                    {isCancelled && onReactivateAbono && (
                                      <button
                                        onClick={() => setTicketToReactivate(t)}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5"
                                        title="Reactivar Abono"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Reactivar</span>
                                      </button>
                                    )}
                                    {onDeleteAbono && (
                                      <button
                                        onClick={() => setTicketToDelete(t)}
                                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold p-1.5 rounded-lg transition"
                                        title="Eliminar ticket definitivamente"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
              Seleccione un cliente de la lista para visualizar su saldo y estado de cuenta detallado.
            </div>
          )}
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {paymentModalClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Registrar Pago / Abono</h3>
              </div>
              <button
                onClick={() => setPaymentModalClient(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePaymentSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1 text-xs">
                <div>
                  <strong className="text-slate-700">Cliente:</strong>{" "}
                  {paymentModalClient.nombreCompletoCliente}
                </div>
                {paymentModalCaratula && (
                  <div>
                    <strong className="text-slate-700">Carátula Destino:</strong>{" "}
                    <span className="font-mono text-sky-700 font-bold">
                      {paymentModalCaratula.folio}
                    </span>{" "}
                    (Pendiente: {formatCurrency(paymentModalCaratula.pendiente || 0)})
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a Abonar ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={montoAbono || ""}
                  onChange={(e) => setMontoAbono(parseFloat(e.target.value) || 0)}
                  className="w-full text-lg font-mono font-bold text-emerald-700 border border-slate-300 rounded-xl px-3 py-2 bg-emerald-50/20 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Método de Pago *
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Transferencia">Transferencia Interbancaria (SPEI)</option>
                  <option value="Efectivo">Efectivo en Ventanilla / Domicilio</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Depósito Bancario">Depósito en Efectivo / Banco</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Referencia / Folio Bancario
                </label>
                <input
                  type="text"
                  value={referenciaAbono}
                  onChange={(e) => setReferenciaAbono(e.target.value)}
                  placeholder="Ej. SPEI 8392183 o Recibo #001"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalClient(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar y Emitir Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEWING TICKET MODAL */}
      {viewingTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-sm">Comprobante Oficial de Abono</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>

                {viewingTicket.estado !== "Cancelado" && onCancelAbono && (
                  <button
                    onClick={() => {
                      setTicketToCancel(viewingTicket);
                      setCancelReasonInput("Cancelación de ticket por administración");
                    }}
                    className="bg-amber-600/80 hover:bg-amber-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                    title="Cancelar este ticket"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}

                {viewingTicket.estado === "Cancelado" && onReactivateAbono && (
                  <button
                    onClick={() => setTicketToReactivate(viewingTicket)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                    title="Reactivar este ticket"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reactivar</span>
                  </button>
                )}

                {onDeleteAbono && (
                  <button
                    onClick={() => setTicketToDelete(viewingTicket)}
                    className="bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                    title="Eliminar este ticket definitivamente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
                  </button>
                )}

                <button
                  onClick={() => setViewingTicket(null)}
                  className="text-slate-400 hover:text-white p-1 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto">
              <AbonoTicketDocument
                ticket={viewingTicket}
                documentRef={ticketDocRef}
                onReactivate={
                  viewingTicket.estado === "Cancelado" && onReactivateAbono
                    ? () => setTicketToReactivate(viewingTicket)
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDITAR SALDO MANUAL DEL CLIENTE */}
      {manualBalanceModalOpen && activeSelected && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                <h3 className="font-bold text-sm">Editar Saldo Manualmente</h3>
              </div>
              <button
                onClick={() => setManualBalanceModalOpen(false)}
                className="text-amber-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
                <p className="font-bold">Cliente: {activeSelected.client.nombreCompletoCliente}</p>
                <p className="text-[11px] text-amber-800 mt-1">
                  Aquí puede fijar directamente el saldo a favor o el saldo pendiente en adeudo del cliente, según sus registros contables manuales.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Saldo a Favor del Cliente ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualSaldoAFavor}
                    onChange={(e) => {
                      setManualSaldoAFavor(e.target.value);
                      if (parseFloat(e.target.value) > 0) {
                        setManualSaldoPendiente("");
                      }
                    }}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-emerald-700 bg-emerald-50/10 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Ej. 500 si solo tiene 500 a favor (dejar vacío si no aplica saldo a favor).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Saldo Pendiente en Adeudo ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualSaldoPendiente}
                    onChange={(e) => {
                      setManualSaldoPendiente(e.target.value);
                      if (parseFloat(e.target.value) > 0) {
                        setManualSaldoAFavor("");
                      }
                    }}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold text-rose-700 bg-rose-50/10 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Si tiene adeudo pendiente (dejar vacío o 0 si está al corriente).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo / Observaciones del Ajuste
                </label>
                <textarea
                  rows={2}
                  value={manualNotas}
                  onChange={(e) => setManualNotas(e.target.value)}
                  placeholder="Ej. Ajuste contable manual conforme a recibos de administración..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setManualBalanceModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManualBalance}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Ajuste Manual</span>
                  </button>
                </div>

                {activeSelected.balance.isManualOverride && (
                  <button
                    type="button"
                    onClick={handleResetManualBalance}
                    className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Restablecer a Cálculo Automático de Carátulas</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR ELIMINACIÓN DEFINITIVA DE TICKET */}
      {ticketToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-rose-200 overflow-hidden">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Eliminar Ticket Definitivamente</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Está completamente seguro de eliminar el ticket{" "}
                <strong className="text-slate-900 font-mono">{ticketToDelete.id}</strong> por un monto de{" "}
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
                  <span className="text-slate-500">Carátula Ref:</span>{" "}
                  <span className="font-mono font-bold text-sky-700">{ticketToDelete.caratulaFolio}</span>
                </div>
                <div>
                  <span className="text-slate-500">Cliente:</span>{" "}
                  <span className="font-semibold text-slate-800">{ticketToDelete.clienteNombre}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                Esta acción borrará el registro del abono y reajustará el saldo del cliente automáticamente.
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

      {/* MODAL 3: CANCELAR TICKET */}
      {ticketToCancel && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
            <div className="bg-amber-600 text-white p-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Cancelar Ticket de Abono</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                El ticket quedará marcado como <strong className="text-rose-700">Cancelado</strong> y su monto ya no se computará como abonado.
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

      {/* MODAL 4: REACTIVAR TICKET */}
      {ticketToReactivate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden">
            <div className="bg-emerald-600 text-white p-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Reactivar Ticket de Abono</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Desea reactivar el ticket <strong className="text-slate-900 font-mono">{ticketToReactivate.id}</strong> por{" "}
                <strong className="text-emerald-700 font-mono">
                  {formatCurrency(ticketToReactivate.montoAbonado)}
                </strong>
                ? Volverá a sumar como pago activo del cliente.
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
                  <RefreshCw className="w-4 h-4" />
                  <span>Reactivar Abono</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LIQUIDAR CARÁTULA */}
      {caratulaToLiquidate && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-sky-200 overflow-hidden">
            <div className="bg-sky-600 text-white p-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <h3 className="font-bold text-sm">Liquidar Carátula</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ¿Desea marcar la carátula <strong className="text-sky-700 font-mono">{caratulaToLiquidate.folio}</strong> como liquidada al 100%?
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Total:</span>{" "}
                  <span className="font-mono font-bold text-slate-900">{formatCurrency(caratulaToLiquidate.total)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Saldo Pendiente Actual:</span>{" "}
                  <span className="font-mono font-bold text-rose-600">{formatCurrency(caratulaToLiquidate.pendiente || 0)}</span>
                </div>
              </div>
              <p className="text-[11px] text-sky-700">
                Esta acción actualizará el saldo pendiente a $0.00 y el monto pagado al 100% del valor de la carátula.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setCaratulaToLiquidate(null)}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmLiquidateCaratula}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 min-h-[44px]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sí, Liquidar al 100%</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
