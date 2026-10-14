import React, { useState, useRef } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import {
  UserSession,
  Caratula,
  Client,
  ClientDocument,
  AbonoTicket,
  CalendarEvent,
  ExpedienteEntry,
  KardexRecord,
  StaffMember,
  InventoryItem
} from "../types";
import { formatCurrency } from "../utils/formatters";
import { isCaratulaActivaOConDeuda, calculateClientWeeklyBalance } from "../utils/clientBalance";
import { CalendarManager } from "./CalendarManager";
import { ExpedienteManager } from "./ExpedienteManager";
import { KardexManager } from "./KardexManager";
import { InventoryManager } from "./InventoryManager";
import { CaratulaDocument } from "./CaratulaDocument";
import { AbonoTicketDocument } from "./AbonoTicketDocument";
import { CaratulaVerificationPortal } from "./CaratulaVerificationPortal";
import { CuidarteLogo } from "./CuidarteLogo";
import { LiveClock } from "./LiveClock";
import { Footer } from "./Footer";
import { TermsAndPrivacyModal } from "./TermsAndPrivacyModal";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { PDFCanvasViewer } from "./PDFCanvasViewer";
import { downloadCaratulaPDF, printCaratulaDocument } from "../utils/pdfExport";
import {
  HeartHandshake,
  LogOut,
  Wifi,
  WifiOff,
  CloudCheck,
  FileText,
  Calendar,
  Stethoscope,
  User,
  DollarSign,
  Clock,
  Eye,
  Download,
  Printer,
  X,
  ShieldCheck,
  Receipt,
  Phone,
  MapPin,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Mail,
  Siren,
  PhoneCall,
  Pill,
  BadgeCheck,
  Search,
  Menu,
  FileSignature,
  FolderCheck,
  CheckCircle2,
  FolderOpen,
  FileCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Lock,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

interface ClientPortalProps {
  userSession: UserSession;
  clients: Client[];
  caratulas: Caratula[];
  abonos: AbonoTicket[];
  calendarEvents: CalendarEvent[];
  expedienteEntries: ExpedienteEntry[];
  kardexRecords?: KardexRecord[];
  inventoryItems?: InventoryItem[];
  staffMembers?: StaffMember[];
  onSaveKardex?: (record: KardexRecord) => void;
  onLogout: () => void;
  isOnline: boolean;
  isSyncing: boolean;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  userSession,
  clients = [],
  caratulas = [],
  abonos = [],
  calendarEvents = [],
  expedienteEntries = [],
  kardexRecords = [],
  inventoryItems = [],
  staffMembers = [],
  onSaveKardex,
  onLogout,
  isOnline,
  isSyncing,
}) => {
  const [activeTab, setActiveTab] = useState<"resumen" | "caratulas" | "agenda" | "expediente" | "inventario" | "perfil" | "verificacion">("resumen");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [viewingCaratula, setViewingCaratula] = useState<Caratula | null>(null);
  const [viewingTicket, setViewingTicket] = useState<AbonoTicket | null>(null);
  const [previewClientDoc, setPreviewClientDoc] = useState<ClientDocument | null>(null);
  const [selectedReceptorFilter, setSelectedReceptorFilter] = useState<string>("all");
  const [visiblePastCount, setVisiblePastCount] = useState<number>(10);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [initialLegalTab, setInitialLegalTab] = useState<"terminos" | "privacidad">("terminos");

  const openLegalModal = (tab: "terminos" | "privacidad") => {
    setInitialLegalTab(tab);
    setLegalModalOpen(true);
  };

  // Lock background scrolling whenever any floating modal or sheet is open
  useLockBodyScroll(Boolean(viewingCaratula || viewingTicket || previewClientDoc || legalModalOpen || isMobileMenuOpen));

  const documentRef = useRef<HTMLDivElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  const rawClientId = (userSession.clientId || "").trim();
  const rawUsername = (userSession.username || "").trim();
  const rawNombre = (userSession.nombre || "").trim();

  // Multi-step robust matching for active client profile
  let foundClient = clients.find((c) => {
    if (rawClientId && c.id.trim().toUpperCase() === rawClientId.toUpperCase()) return true;
    if (rawUsername && c.id.trim().toUpperCase() === rawUsername.toUpperCase()) return true;
    if (c.correo && rawUsername && c.correo.trim().toLowerCase() === rawUsername.toLowerCase()) return true;
    if (rawNombre && c.nombreCompletoCliente && (
      c.nombreCompletoCliente.trim().toLowerCase() === rawNombre.toLowerCase() ||
      c.nombreCompletoCliente.trim().toLowerCase().includes(rawNombre.toLowerCase()) ||
      rawNombre.toLowerCase().includes(c.nombreCompletoCliente.trim().toLowerCase())
    )) return true;
    return false;
  });

  // If not found directly, check matching caratula
  const matchingCaratula = caratulas.find((car) => {
    if (rawClientId && car.id && car.id.trim().toUpperCase() === rawClientId.toUpperCase()) return true;
    if (rawUsername && car.id && car.id.trim().toUpperCase() === rawUsername.toUpperCase()) return true;
    if (car.correo && rawUsername && car.correo.trim().toLowerCase() === rawUsername.toLowerCase()) return true;
    if (rawNombre && car.nombreCompletoCliente && (
      car.nombreCompletoCliente.trim().toLowerCase().includes(rawNombre.toLowerCase()) ||
      rawNombre.toLowerCase().includes(car.nombreCompletoCliente.trim().toLowerCase())
    )) return true;
    return false;
  });

  if (!foundClient && matchingCaratula) {
    foundClient = clients.find((c) => c.id.toUpperCase() === matchingCaratula.id.toUpperCase());
  }

  // Fallback: If still not found and clients array is not empty
  if (!foundClient && clients.length > 0) {
    foundClient = clients.find((c) =>
      c.nombreCompletoCliente.toLowerCase().includes(rawUsername.toLowerCase()) ||
      (c.correo && c.correo.toLowerCase().includes(rawUsername.toLowerCase()))
    );
  }

  // Final synthesized profile to GUARANTEE "Mi Información" always renders beautifully
  const myClientProfile: Client = foundClient || {
    id: matchingCaratula?.id || rawClientId || (rawUsername.toUpperCase().startsWith("CLI-") ? rawUsername.toUpperCase() : "CLI-001"),
    timestamp: matchingCaratula?.timestamp || "2026-08-17",
    nombreCompletoCliente: matchingCaratula?.nombreCompletoCliente || rawNombre || rawUsername || "Cliente Registrado",
    numeroContacto: matchingCaratula?.numeroContacto || "771 123 4567",
    numeroContacto2: matchingCaratula?.numeroContacto2 || "",
    numeroContacto3: matchingCaratula?.numeroContacto3 || "",
    correo: matchingCaratula?.correo || (rawUsername.includes("@") ? rawUsername : "cliente@cuidartemexico.com"),
    direccionServicio: matchingCaratula?.direccionServicio || "Pachuca de Soto, Hidalgo",
    nombreCompletoRS: matchingCaratula?.nombreCompletoRS || "Paciente Receptor",
    edad: matchingCaratula?.edad || "78",
    diagnostico: matchingCaratula?.diagnostico || "Atención integral y cuidados de enfermería",
    especificaciones: matchingCaratula?.especificaciones || "Cuidados asistenciales y monitoreo clínico continuo",
    documentos: [],
  };

  const clientId = myClientProfile.id;
  const myClientsArray = [myClientProfile];

  // Resolve all contracts linked to this client
  const myContracts: ClientDocument[] = (myClientProfile.documentos || []).filter(
    (d) => d.tipo === "Contrato" || (d.nombre && d.nombre.toLowerCase().includes("contrato"))
  );

  // If client has dedicated contratoUrl and it's not already in myContracts
  if (myClientProfile.contratoUrl && !myContracts.some((c) => c.url === myClientProfile.contratoUrl || c.archivoUrl === myClientProfile.contratoUrl)) {
    myContracts.unshift({
      id: "DOC-CTR-DIRECT",
      nombre: myClientProfile.contratoNombre || "Contrato Oficial de Prestación de Servicios",
      tipo: "Contrato",
      url: myClientProfile.contratoUrl,
      archivoUrl: myClientProfile.contratoUrl,
      fechaSubida: myClientProfile.contratoFecha || myClientProfile.timestamp,
      notas: myClientProfile.contratoNotas || "Contrato digital registrado en el sistema",
    });
  }

  // Other documents in expediente
  const myOtherDocuments: ClientDocument[] = (myClientProfile.documentos || []).filter(
    (d) => d.tipo !== "Contrato" && !d.nombre?.toLowerCase().includes("contrato")
  );

  const myCaratulas = caratulas.filter((c) => {
    // 1. Must be linked to client number/ID
    const matchesId = Boolean(c.id && c.id.toUpperCase() === clientId.toUpperCase());
    if (!matchesId) return false;

    // 2. Must be at the name of the client
    const targetName = (myClientProfile?.nombreCompletoCliente || userSession.nombre || userSession.username || "").trim();
    if (targetName) {
      const normTarget = targetName.toLowerCase();
      const normCaratula = (c.nombreCompletoCliente || "").trim().toLowerCase();

      const nameMatches =
        normCaratula === normTarget ||
        normCaratula.includes(normTarget) ||
        normTarget.includes(normCaratula);

      return nameMatches;
    }

    return true;
  });

  // Unique receptor names linked to this client
  const myReceptorNames = Array.from(
    new Set(
      [myClientProfile?.nombreCompletoRS, ...myCaratulas.map((c) => c.nombreCompletoRS)]
        .filter((n): n is string => Boolean(n && n.trim()))
    )
  );

  // Caratulas for selected receptor
  const patientCaratulas = selectedReceptorFilter === "all"
    ? myCaratulas
    : myCaratulas.filter(
        (c) => (c.nombreCompletoRS || "").trim().toLowerCase() === selectedReceptorFilter.trim().toLowerCase()
      );

  const myAbonos = abonos.filter((a) => {
    if (a.estado === "Cancelado") return false;
    
    // Match by caratula folio
    const caratulaFolioMatch = myCaratulas.some(
      (mc) => mc.folio && mc.folio.trim().toLowerCase() === (a.caratulaFolio || "").trim().toLowerCase()
    );
    if (caratulaFolioMatch) return true;

    // Match by client profile name or user session name
    const clientNameNorm = (myClientProfile?.nombreCompletoCliente || userSession.nombre || userSession.username || "").trim().toLowerCase();
    const abonoClientNorm = (a.clienteNombre || "").trim().toLowerCase();
    const abonoReceptorNorm = (a.receptorNombre || "").trim().toLowerCase();

    if (clientNameNorm && abonoClientNorm && (abonoClientNorm.includes(clientNameNorm) || clientNameNorm.includes(abonoClientNorm))) {
      return true;
    }

    if (clientNameNorm && abonoReceptorNorm && (abonoReceptorNorm.includes(clientNameNorm) || clientNameNorm.includes(abonoReceptorNorm))) {
      return true;
    }

    return false;
  });

  // Compute weekly balance metrics
  const weeklyBalance = calculateClientWeeklyBalance(patientCaratulas, myAbonos);

  const {
    periodoTexto,
    caratulasSemanaYPendientes,
    caratulasPasadasPagadas,
    totalContratadoPeriodo,
    totalAbonadoPeriodo,
    saldoPendienteTotal,
    saldoAFavorTotal,
  } = weeklyBalance;

  const balanceStatus: "adeudo" | "favor" | "al_corriente" =
    saldoPendienteTotal > 0 ? "adeudo" : saldoAFavorTotal > 0 ? "favor" : "al_corriente";

  const isUpToDate = balanceStatus === "al_corriente" || balanceStatus === "favor";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-24">
      {/* CLIENT PORTAL HEADER */}
      <header className="bg-slate-900 text-white shadow-xl border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Logo & Portal Identity */}
            <div className="flex items-center gap-3">
              <div className="bg-white px-3 py-1.5 flex items-center justify-center border border-slate-200" style={{ borderRadius: "12px" }}>
                <CuidarteLogo
                  size="sm"
                  showTagline={true}
                  variant="header"
                  sucursalId={userSession.sucursalId || myClientProfile?.sucursalId}
                  sucursalNombre={userSession.sucursalNombre || myClientProfile?.sucursalNombre || "Cuidarte México"}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-sky-500/20 text-sky-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-sky-400/30">
                    PORTAL CLIENTE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                  CUIDADO INTEGRAL, CONFIANZA TOTAL
                </p>
              </div>
            </div>

            {/* Status indicators & User Info */}
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
                {isOnline ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">En Línea</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Sin Red</span>
                  </span>
                )}

                <span className="text-slate-600">|</span>

                {isSyncing ? (
                  <span className="text-amber-300 animate-pulse text-[11px]">Guardando...</span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-300 text-[11px]">
                    <CloudCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden sm:inline">Sincronizado</span>
                  </span>
                )}
              </div>

              {/* Live Clock Display (Hidden on mobile) */}
              <div className="hidden sm:block">
                <LiveClock variant="compact" />
              </div>

              {/* User Session Tag */}
              <div className="bg-sky-950 border border-sky-800/80 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-bold text-sky-200">{clientId}</span>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 text-slate-300 p-2 rounded-xl transition-all border border-slate-700 flex items-center gap-1 text-xs font-bold"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Salir</span>
              </button>

              {/* Mobile Menu Hamburger Toggle (Visible only on mobile) */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-xl border border-slate-700 transition shrink-0"
                aria-label="Menú del Portal de Cliente"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5 text-sky-400" />}
              </button>
            </div>
          </div>

          {/* Desktop Navigation Bar (Hidden on mobile) */}
          <nav className="hidden md:flex space-x-1 sm:space-x-2 overflow-x-auto mt-3 pt-2 border-t border-slate-800 scrollbar-none">
            <button
              onClick={() => setActiveTab("resumen")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "resumen"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-300" />
              <span>Resumen & Estado de Cuenta</span>
            </button>

            <button
              onClick={() => setActiveTab("caratulas")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "caratulas"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4 text-sky-300" />
              <span>Mis Carátulas ({myCaratulas.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("agenda")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "agenda"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>Calendario de Turnos</span>
            </button>

            <button
              onClick={() => setActiveTab("expediente")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "expediente"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Stethoscope className="w-4 h-4 text-emerald-300" />
              <span>Expediente de Servicio</span>
            </button>

            <button
              onClick={() => setActiveTab("inventario")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "inventario"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Pill className="w-4 h-4 text-amber-300" />
              <span>Medicamentos e Insumos</span>
            </button>

            <button
              onClick={() => setActiveTab("perfil")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "perfil"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-900/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <User className="w-4 h-4 text-indigo-300" />
              <span>Mi Información & Contrato</span>
              {myContracts.length > 0 ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("verificacion")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                activeTab === "verificacion"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-black"
                  : "text-emerald-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>Verificar Personal Cuidarte</span>
            </button>
          </nav>
        </div>

        {/* Mobile Navigation Slide-Over Drawer */}
        {isMobileMenuOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
            }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs md:hidden flex justify-end animate-fadeIn"
          >
            <div className="bg-slate-900 w-[85vw] max-w-sm h-full border-l border-slate-800 p-5 flex flex-col justify-start space-y-4 shadow-2xl overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-black text-sm">
                    C
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Portal de Cliente</h3>
                    <p className="text-[11px] text-slate-400">Atención y Servicios Cuidarte</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                  aria-label="Cerrar menú"
                >
                  <X className="w-5 h-5 text-rose-400" />
                </button>
              </div>

              {/* Profile Snapshot */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-white truncate max-w-[160px]">
                      {myClientProfile?.nombreCompletoCliente || clientId}
                    </p>
                    <p className="text-[10px] text-sky-400 font-mono">ID: {clientId}</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    balanceStatus === "adeudo"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : balanceStatus === "favor"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {balanceStatus === "adeudo"
                    ? "Adeudo"
                    : balanceStatus === "favor"
                    ? "A Favor"
                    : "Al corriente"}
                </span>
              </div>

              {/* Navigation Items List */}
              <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => {
                      setActiveTab("resumen");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "resumen" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-4 h-4 text-emerald-300" />
                      <span>Resumen & Estado de Cuenta</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("caratulas");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "caratulas" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-sky-300" />
                      <span>Mis Carátulas de Servicio ({myCaratulas.length})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("agenda");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "agenda" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-amber-300" />
                      <span>Calendario de Turnos</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("expediente");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "expediente" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Stethoscope className="w-4 h-4 text-emerald-300" />
                      <span>Expediente de Servicio</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("inventario");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "inventario" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Pill className="w-4 h-4 text-amber-300" />
                      <span>Medicamentos e Insumos</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("perfil");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "perfil" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-indigo-300" />
                      <span>Mi Información & Contrato</span>
                    </div>
                    {myContracts.length > 0 ? (
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-400/30">
                        Vigente
                      </span>
                    ) : (
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-400/30">
                        Pendiente
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("verificacion");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "verificacion" ? "bg-emerald-600 text-white font-black" : "text-emerald-400 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      <span>Verificar Personal Cuidarte</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                  {/* Logout & Footer */}
                  <div className="pt-6 border-t border-slate-800 mt-6 shrink-0 pb-16">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold p-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition min-h-[44px]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
            </div>
          </div>
        )}
      </header>

      {/* PORTAL MAIN CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-36 md:pb-12">
        {/* TAB 1: RESUMEN & ESTADO DE CUENTA */}
        {activeTab === "resumen" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-sky-800 flex flex-col justify-between gap-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sky-300 text-xs font-bold uppercase tracking-wider mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Bienvenido a su Panel de Cliente</span>
                  </div>
                  <h2 className="text-2xl font-black text-white">
                    {myClientProfile?.nombreCompletoCliente || "Cliente Cuidarte"}
                  </h2>
                  <p className="text-xs text-sky-200 mt-1 max-w-xl">
                    Titular de cuenta registrado con{" "}
                    <strong className="text-white">{myReceptorNames.length} receptor(es) de servicio</strong> asignado(s).
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 text-center min-w-[180px]">
                  <span className="text-[10px] uppercase font-bold text-sky-200 block">ESTADO DE CUENTA</span>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-black mt-1 ${
                      balanceStatus === "adeudo"
                        ? "bg-rose-500 text-white shadow-sm"
                        : balanceStatus === "favor"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-emerald-600 text-white shadow-sm"
                    }`}
                  >
                    {balanceStatus === "adeudo"
                      ? "ADEUDO PENDIENTE"
                      : balanceStatus === "favor"
                      ? "SALDO A FAVOR"
                      : "AL CORRIENTE"}
                  </span>
                </div>
              </div>

              {/* Receptor Selection Bar */}
              {myReceptorNames.length > 0 && (
                <div className="pt-4 border-t border-sky-800/80 flex flex-wrap items-center gap-2 bg-sky-950/60 p-3 rounded-2xl border border-sky-800/60">
                  <span className="text-xs font-bold text-sky-300 mr-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Filtrar por Receptor de Servicio:
                  </span>
                  <button
                    onClick={() => setSelectedReceptorFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedReceptorFilter === "all"
                        ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                        : "bg-slate-800/80 text-sky-200 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    Todos los Receptores ({myReceptorNames.length})
                  </button>

                  {myReceptorNames.map((pName) => (
                    <button
                      key={pName}
                      onClick={() => setSelectedReceptorFilter(pName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        selectedReceptorFilter.toLowerCase() === pName.toLowerCase()
                          ? "bg-sky-500 text-white shadow-md shadow-sky-900/50"
                          : "bg-slate-800/80 text-sky-200 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <User className="w-3 h-3 text-sky-300" />
                      <span>{pName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Overview Metrics Card - UN SOLO TOTAL: Saldo a Favor, Adeudo o Al Corriente */}
            <div
              className={`p-6 rounded-2xl shadow-sm border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 ${
                balanceStatus === "adeudo"
                  ? "bg-white border-rose-200 ring-1 ring-rose-100"
                  : balanceStatus === "favor"
                  ? "bg-white border-emerald-200 ring-1 ring-emerald-100"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      balanceStatus === "adeudo"
                        ? "text-rose-600"
                        : balanceStatus === "favor"
                        ? "text-emerald-700"
                        : "text-slate-700"
                    }`}
                  >
                    {balanceStatus === "adeudo" ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-rose-500" />
                        <span>Saldo en Adeudo (Pendiente Global)</span>
                      </>
                    ) : balanceStatus === "favor" ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span>Saldo a Favor del Cliente</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Saldo Global (Al Corriente)</span>
                      </>
                    )}
                  </span>

                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                      balanceStatus === "adeudo"
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : balanceStatus === "favor"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}
                  >
                    {balanceStatus === "adeudo"
                      ? "Adeudo Pendiente"
                      : balanceStatus === "favor"
                      ? "A Favor"
                      : "Al Corriente"}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <div
                    className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${
                      balanceStatus === "adeudo"
                        ? "text-rose-600"
                        : balanceStatus === "favor"
                        ? "text-emerald-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {balanceStatus === "adeudo"
                      ? formatCurrency(saldoPendienteTotal)
                      : balanceStatus === "favor"
                      ? formatCurrency(saldoAFavorTotal)
                      : "$0.00"}
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium">
                  {balanceStatus === "adeudo"
                    ? "Monto total adeudado por liquidar en carátulas de servicio activas."
                    : balanceStatus === "favor"
                    ? "Cuenta con saldo a su favor aplicable a próximos servicios o carátulas."
                    : "Su cuenta se encuentra al corriente, sin saldos pendientes ni adeudos."}
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left sm:text-right shrink-0 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Período de Servicio Activo</span>
                <span className="text-xs font-bold text-sky-800 font-mono mt-0.5 block">{periodoTexto}</span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {patientCaratulas.length} carátula(s) registrada(s)
                </span>
              </div>
            </div>

            {/* Recent Carátulas & Abonos Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Carátulas List */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-600" />
                    <span>Carátulas de la Semana / Pendientes ({caratulasSemanaYPendientes.length})</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab("caratulas")}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5"
                  >
                    Ver todas <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {caratulasSemanaYPendientes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No hay carátulas activas en la semana actual ni pendientes de pago.</p>
                ) : (
                  <div className="space-y-3">
                    {caratulasSemanaYPendientes.map((c) => (
                      <div key={c.folio} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">Folio {c.folio}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.pendiente <= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                              {c.pendiente <= 0 ? "Pagado" : `Pendiente ${formatCurrency(c.pendiente)}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">Receptor: <strong>{c.nombreCompletoRS}</strong></p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">Total: {formatCurrency(c.total)} | Pagado: {formatCurrency(c.pagado)}</p>
                        </div>

                        <button
                          onClick={() => setViewingCaratula(c)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section for Past Paid Carátulas / Pólizas Pasadas */}
                {caratulasPasadasPagadas.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pólizas Pasadas Pagadas ({caratulasPasadasPagadas.length})</h4>
                    </div>

                    <div className="space-y-2">
                      {caratulasPasadasPagadas.slice(0, visiblePastCount).map((c) => (
                        <div key={c.folio} className="p-3 bg-slate-100/80 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-slate-800">Folio {c.folio}</span>
                            <span className="text-slate-500 ml-2">({c.nombreCompletoRS})</span>
                            <div className="text-[10px] text-slate-400 font-mono">Total: {formatCurrency(c.total)} - Liquidado</div>
                          </div>
                          <button
                            onClick={() => setViewingCaratula(c)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-[11px] rounded-md flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Ver</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {caratulasPasadasPagadas.length > visiblePastCount && (
                      <button
                        onClick={() => setVisiblePastCount((prev) => prev + 10)}
                        className="w-full mt-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1"
                      >
                        <span>Cargar más pólizas pasadas (Mostrando {visiblePastCount} de {caratulasPasadasPagadas.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Payment History (Abonos) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    <span>Historial de Pagos y Abonos</span>
                  </h3>
                </div>

                {myAbonos.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No hay tickets de abono registrados.</p>
                ) : (
                  <div className="space-y-3">
                    {myAbonos.map((ab) => (
                      <div key={ab.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-xs">Ticket #{ab.referencia || ab.id}</span>
                            <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded font-mono">
                              Carátula: {ab.caratulaFolio}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-emerald-700 mt-1 font-mono">{formatCurrency(ab.montoAbonado)} ({ab.metodoPago})</p>
                          <p className="text-[10px] text-slate-500 font-mono">{ab.fecha}</p>
                          {ab.atendidoPor && (
                            <p className="text-[10px] text-slate-400 font-sans mt-0.5">Atendió: {ab.atendidoPor}</p>
                          )}
                        </div>

                        <button
                          onClick={() => setViewingTicket(ab)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Recibo</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CARATULAS DE SERVICIO */}
        {activeTab === "caratulas" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Mis Carátulas de Servicio</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulte los detalles oficiales de sus carátulas de la semana en curso, pendientes y pólizas pasadas.
                </p>
              </div>
            </div>

            {caratulasSemanaYPendientes.length === 0 && caratulasPasadasPagadas.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-600">No hay carátulas de servicio asociadas a su cuenta.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Active / Current week / Pending Carátulas */}
                <div className="space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <span>Carátulas Semana Activa / Pendientes de Pago ({caratulasSemanaYPendientes.length})</span>
                  </h3>

                  {caratulasSemanaYPendientes.length === 0 ? (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 text-slate-400 text-xs text-center">
                      Sin carátulas activas en esta semana ni pendientes de pago.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {caratulasSemanaYPendientes.map((car) => (
                        <div key={car.folio} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 hover:border-sky-300 transition-all">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div>
                              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">FOLIO OFICIAL</span>
                              <h3 className="font-mono font-black text-slate-900 text-lg">{car.folio}</h3>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${car.pendiente <= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"}`}>
                              {car.pendiente <= 0 ? "PAGADO COMPLETO" : `PENDIENTE ${formatCurrency(car.pendiente)}`}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs text-slate-700">
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Receptor del Servicio</span>
                              <span className="font-bold text-slate-900">{car.nombreCompletoRS}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] uppercase font-bold block">Dirección del Servicio</span>
                              <span>{car.direccionServicio}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl font-mono pt-2">
                              <div>
                                <span className="text-[9px] text-slate-400 block">TOTAL</span>
                                <span className="font-bold text-slate-900">{formatCurrency(car.total)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">PAGADO</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(car.pagado)}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block">PENDIENTE</span>
                                <span className="font-bold text-rose-600">{formatCurrency(car.pendiente)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                            <button
                              onClick={() => setViewingCaratula(car)}
                              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-sky-900/20"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Ver Documento Oficial</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Past Paid Carátulas / Pólizas Pasadas */}
                {caratulasPasadasPagadas.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-slate-200">
                    <h3 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      <span>Pólizas y Carátulas Pasadas Pagadas ({caratulasPasadasPagadas.length})</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {caratulasPasadasPagadas.slice(0, visiblePastCount).map((car) => (
                        <div key={car.folio} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">FOLIO PASADO</span>
                              <h4 className="font-mono font-bold text-slate-800 text-base">{car.folio}</h4>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              LIQUIDADO
                            </span>
                          </div>

                          <div className="text-xs space-y-1 text-slate-600">
                            <p>Receptor: <strong className="text-slate-800">{car.nombreCompletoRS}</strong></p>
                            <p className="font-mono text-[11px]">Total: {formatCurrency(car.total)}</p>
                          </div>

                          <button
                            onClick={() => setViewingCaratula(car)}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Carátula</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {caratulasPasadasPagadas.length > visiblePastCount && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setVisiblePastCount((prev) => prev + 10)}
                          className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl shadow-md transition"
                        >
                          Cargar más pólizas pasadas (Mostrando {visiblePastCount} de {caratulasPasadasPagadas.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CALENDARIO DE SERVICIOS */}
        {activeTab === "agenda" && (
          <div className="animate-fadeIn">
            <CalendarManager
              events={calendarEvents}
              clients={myClientsArray}
              caratulas={caratulas}
              staffMembers={staffMembers}
              readOnly={true}
              filterClientId={clientId}
              userRole="client"
            />
          </div>
        )}

        {/* TAB 4: EXPEDIENTE DE SERVICIO */}
        {activeTab === "expediente" && (
          <div className="animate-fadeIn">
            <ExpedienteManager
              entries={expedienteEntries}
              clients={myClientsArray}
              caratulas={caratulas}
              kardexRecords={kardexRecords}
              inventoryItems={inventoryItems}
              readOnly={true}
              userRole="client"
              filterClientId={clientId}
            />
          </div>
        )}

        {/* TAB 5: MEDICAMENTOS E INSUMOS */}
        {activeTab === "inventario" && (
          <div className="animate-fadeIn">
            <InventoryManager
              inventoryItems={inventoryItems}
              clients={myClientsArray}
              caratulas={caratulas}
              kardexRecords={kardexRecords}
              onSaveItem={() => {}}
              userRole="client"
              filterClientId={clientId}
            />
          </div>
        )}

        {/* TAB 5: MI PERFIL Y CONTRATO */}
        {activeTab === "perfil" && (
          <div className="space-y-6 animate-fadeIn pb-12">
            {/* Header banner with identity and metrics */}
            <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-sky-800/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="p-3.5 sm:p-4 bg-sky-500/20 text-sky-300 rounded-2xl border border-sky-400/30 shrink-0">
                    <User className="w-8 h-8 sm:w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-sky-500/30 text-sky-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-sky-400/40">
                        Expediente de Cliente
                      </span>
                      <span className="font-mono text-xs text-slate-300 font-bold bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                        ID: {myClientProfile.id}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {myClientProfile.nombreCompletoCliente}
                    </h2>
                    <p className="text-xs text-sky-200/80 flex items-center gap-1.5">
                      <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Receptor de Servicio: <strong>{myClientProfile.nombreCompletoRS}</strong> ({myClientProfile.edad} años)</span>
                    </p>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                      <FileSignature className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Contrato Digital</span>
                      <span className="text-xs font-black text-white">
                        {myContracts.length > 0 ? "Registrado & Vigente" : "En Proceso"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
                      <FolderCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Expediente Digital</span>
                      <span className="text-xs font-black text-white">
                        {myContracts.length + myOtherDocuments.length} Doc(s)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: CONTRATO OFICIAL DE PRESTACIÓN DE SERVICIOS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2.5">
                  <FileSignature className="w-6 h-6 text-sky-600" />
                  <span>Contrato Oficial de Prestación de Servicios</span>
                </h3>
                {myContracts.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Contrato Activo y Vigente
                  </span>
                )}
              </div>

              {myContracts.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border-2 border-dashed border-slate-300 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center mx-auto border border-sky-100 shadow-inner">
                    <FileSignature className="w-8 h-8 text-sky-500" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <span className="bg-amber-100 text-amber-900 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300">
                      En Proceso de Digitalización Administrativa
                    </span>
                    <h4 className="font-black text-slate-800 text-base mt-2">
                      Contrato Oficial en Proceso de Carga
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      El contrato oficial de prestación de servicios para su cuenta está siendo validado y digitalizado por la Dirección de {userSession?.sucursalNombre || myClientProfile?.sucursalNombre || "Cuidarte México"}. Una vez cargado desde la administración, podrá consultarlo, visualizarlo e imprimirlo en esta sección con plena validez legal.
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center">
                    <a
                      href="tel:7714540072"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-300"
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-600" />
                      <span>Contactar a Dirección Administrativa</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myContracts.map((contrato) => (
                    <div
                      key={contrato.id}
                      className="bg-white rounded-2xl p-5 sm:p-6 border-2 border-sky-200 shadow-md space-y-4 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          <div className="p-3 bg-sky-100 text-sky-700 rounded-2xl border border-sky-200 shrink-0 mt-0.5">
                            <FileSignature className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="bg-sky-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                              Contrato Digital Oficial
                            </span>
                            <h4 className="font-black text-slate-900 text-base mt-1.5 line-clamp-1">
                              {contrato.nombre || "Contrato Oficial de Prestación de Servicios"}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              Registrado el {contrato.fechaSubida || "Fecha oficial"} {contrato.tamano ? `• ${contrato.tamano}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      {contrato.notas && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 italic">
                          "{contrato.notas}"
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewClientDoc({
                              ...contrato,
                              id: contrato.id || `CONTRATO-${myClientProfile.id}`,
                              nombre: contrato.nombre || myClientProfile.contratoNombre || "Contrato Oficial de Prestación de Servicios",
                              tipo: "Contrato",
                              ownerId: myClientProfile.id,
                              clienteId: myClientProfile.id,
                              url: contrato.url || contrato.archivoUrl || myClientProfile.contratoUrl || "",
                              archivoUrl: contrato.archivoUrl || contrato.url || myClientProfile.contratoUrl || "",
                              fechaSubida: contrato.fechaSubida || myClientProfile.contratoFecha || "",
                              notas: contrato.notas || myClientProfile.contratoNotas || "Contrato de servicio",
                            });
                          }}
                          className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Visualizar Contrato</span>
                        </button>

                        {(contrato.archivoUrl || contrato.url) && (
                          <a
                            href={contrato.archivoUrl || contrato.url}
                            download={contrato.nombre || `Contrato_${myClientProfile.id}.pdf`}
                            className="py-2.5 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition border border-slate-300"
                            title="Descargar archivo en PDF"
                          >
                            <Download className="w-4 h-4 text-slate-600" />
                            <span className="hidden sm:inline">Descargar</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: EXPEDIENTE DIGITAL Y DOCUMENTOS ADICIONALES */}
            {myOtherDocuments.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <FolderCheck className="w-5 h-5 text-emerald-600" />
                    <span>Documentos del Expediente del Cliente</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium font-mono">
                    {myOtherDocuments.length} archivo(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myOtherDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                            {doc.tipo}
                          </span>
                          {doc.tamano && (
                            <span className="text-[10px] text-slate-400 font-mono">{doc.tamano}</span>
                          )}
                        </div>

                        <h5 className="font-bold text-slate-900 text-xs line-clamp-2">{doc.nombre}</h5>

                        <p className="text-[10px] text-slate-500 font-mono">
                          Cargado: {doc.fechaSubida}
                        </p>

                        {doc.notas && (
                          <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 italic line-clamp-2">
                            "{doc.notas}"
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewClientDoc({
                              ...doc,
                              ownerId: myClientProfile.id,
                              clienteId: myClientProfile.id,
                            });
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                        {(doc.archivoUrl || doc.url) && (
                          <a
                            href={doc.archivoUrl || doc.url}
                            download={doc.nombre || "documento.pdf"}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200"
                            title="Descargar"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 3: DATOS DEL TITULAR Y DEL RECEPTOR */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Datos del Titular */}
                <div className="space-y-4">
                  <h4 className="font-black text-sky-800 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-sky-600" />
                    <span>Datos del Titular / Cliente</span>
                  </h4>
                  <div className="text-xs space-y-3 text-slate-700">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">ID de Cliente Registrado</span>
                      <span className="font-mono font-black text-slate-900 text-sm">{myClientProfile.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Nombre Completo del Titular</span>
                      <span className="font-bold text-slate-900 text-sm">{myClientProfile.nombreCompletoCliente}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Teléfono(s) de Contacto</span>
                      <div className="font-mono text-slate-900 font-bold space-y-0.5">
                        <p>{myClientProfile.numeroContacto || "771 123 4567"}</p>
                        {myClientProfile.numeroContacto2 && <p className="text-slate-600">{myClientProfile.numeroContacto2}</p>}
                        {myClientProfile.numeroContacto3 && <p className="text-slate-600">{myClientProfile.numeroContacto3}</p>}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Correo Electrónico</span>
                      <span className="text-slate-900 font-medium">{myClientProfile.correo || "No registrado"}</span>
                    </div>
                  </div>
                </div>

                {/* Datos del Paciente / Receptor de Servicio */}
                <div className="space-y-4">
                  <h4 className="font-black text-emerald-800 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                    <HeartHandshake className="w-4 h-4 text-emerald-600" />
                    <span>Datos del Receptor del Servicio (Paciente)</span>
                  </h4>
                  <div className="text-xs space-y-3 text-slate-700">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Nombre del Paciente / Receptor</span>
                      <span className="font-bold text-slate-900 text-sm">{myClientProfile.nombreCompletoRS}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Edad</span>
                      <span className="font-black text-emerald-700 text-sm">{myClientProfile.edad} años</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Dirección del Servicio Domiciliario</span>
                      <span className="text-slate-900 font-medium">{myClientProfile.direccionServicio || "Pachuca de Soto, Hidalgo"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Diagnóstico Médico Principal</span>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-1 font-medium text-slate-800">
                        {myClientProfile.diagnostico || "Atención integral de enfermería y cuidados generales"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {myClientProfile.especificaciones && (
                <div className="pt-4 border-t border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">
                    Especificaciones e Indicaciones Médicas de Atención
                  </span>
                  <p className="bg-amber-50 text-amber-900 border border-amber-200 p-3.5 rounded-2xl text-xs mt-1 leading-relaxed font-medium">
                    {myClientProfile.especificaciones}
                  </p>
                </div>
              )}

              {/* ACCESO A DOCUMENTACIÓN LEGAL */}
              <div className="pt-5 border-t border-slate-200 mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Documentación Legal y Privacidad</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openLegalModal("terminos")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-sky-900 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                    <span>Términos y Condiciones</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openLegalModal("privacidad")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-emerald-900 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Aviso de Privacidad</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: VERIFICADOR DE PERSONAL Y CREDENCIALES */}
        {activeTab === "verificacion" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl border border-emerald-200">
                  <ShieldCheck className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase border border-emerald-300">
                      SEGURIDAD & AUTENTICIDAD
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-0.5">
                    Verificador Oficial de Personal y Credenciales
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Valide en tiempo real la autenticidad del personal de enfermería, cuidadores y atención a urgencias adscritos a {userSession?.sucursalNombre || myClientProfile?.sucursalNombre || "Cuidarte México"}.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden p-1 sm:p-2">
              <CaratulaVerificationPortal
                caratulas={caratulas}
                staffMembers={staffMembers}
                abonos={abonos}
                isAdminView={false}
              />
            </div>
          </div>
        )}
      </main>

      {/* FLOATING PERSISTENT QUICK-ACTION CONTACT FOOTER (DESKTOP ONLY) */}
      <div className="hidden md:block fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 py-2.5 px-4 z-30 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-bold text-slate-200">{userSession?.sucursalNombre || myClientProfile?.sucursalNombre || "Cuidarte México"} - Atención Continua & Urgencias</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="tel:7714540072"
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-900/40 text-xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>771 454 0072</span>
            </a>

            <a
              href="tel:911"
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/40 text-xs"
            >
              <Siren className="w-3.5 h-3.5 text-rose-200 animate-bounce" />
              <span>Urgencias 911</span>
            </a>

            <a
              href="mailto:direccion@cuidartemexico.com"
              className="hidden md:flex bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-medium items-center gap-1.5 transition-all border border-slate-700 text-xs"
            >
              <Mail className="w-3.5 h-3.5 text-sky-400" />
              <span>direccion@cuidartemexico.com</span>
            </a>
          </div>
        </div>
      </div>

      {/* Footer del Panel de Administración con Medios de Contacto */}
      <Footer className="mt-12 mb-14 md:mb-0" userType="cliente" />

      {/* CARÁTULA DOCUMENT MODAL */}
      {viewingCaratula && (
        <div
          onClick={() => setViewingCaratula(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8 border border-slate-200 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <span>Carátula Oficial - Folio {viewingCaratula.folio}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printCaratulaDocument()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => downloadCaratulaPDF("caratula-official-document", `Caratula_${viewingCaratula.folio}.pdf`)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  onClick={() => setViewingCaratula(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto py-4 flex-1">
              <CaratulaDocument ref={documentRef} caratula={viewingCaratula} />
            </div>
          </div>
        </div>
      )}

      {/* ABONO TICKET DOCUMENT MODAL */}
      {viewingTicket && (
        <div
          onClick={() => setViewingTicket(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl my-8 border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Comprobante de Pago</h3>
              <button
                onClick={() => setViewingTicket(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <AbonoTicketDocument ref={ticketRef} ticket={viewingTicket} />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingTicket(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Cerrar Recibo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Términos y Privacidad */}
      <TermsAndPrivacyModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={initialLegalTab}
        userType="cliente"
        verifiedUser={userSession ? { username: userSession.username, nombre: userSession.nombre, role: userSession.role } : null}
      />

      {/* MODAL DE VISUALIZACIÓN DE CONTRATOS Y DOCUMENTOS DEL CLIENTE */}
      <DocumentViewerModal
        isOpen={Boolean(previewClientDoc)}
        doc={previewClientDoc}
        onClose={() => setPreviewClientDoc(null)}
      />

      {/* FIXED MOBILE BOTTOM ERGONOMIC TOUCH BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1 flex items-center justify-around shadow-2xl safe-bottom print:hidden">
        <button
          onClick={() => setActiveTab("resumen")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "resumen" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <DollarSign className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Resumen</span>
        </button>

        <button
          onClick={() => setActiveTab("caratulas")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "caratulas" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5 text-sky-400" />
          <span className="text-[10px]">Carátulas</span>
        </button>

        <button
          onClick={() => setActiveTab("agenda")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "agenda" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5 text-amber-400" />
          <span className="text-[10px]">Turnos</span>
        </button>

        <button
          onClick={() => setActiveTab("perfil")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "perfil" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <User className="w-5 h-5 mb-0.5 text-indigo-400" />
          <span className="text-[10px]">Mi Perfil</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            isMobileMenuOpen ? "text-amber-400 bg-amber-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5 text-amber-400" />
          <span className="text-[10px]">Más</span>
        </button>
      </nav>
    </div>
  );
};
