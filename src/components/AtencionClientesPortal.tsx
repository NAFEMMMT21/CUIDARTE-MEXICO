import React, { useState, useMemo } from "react";
import { evaluateAllVitals } from "../utils/vitalsEvaluator";
import {
  Client,
  Caratula,
  ServiceItem,
  IncidenciaTicket,
  SolicitudIncrementoServicio,
  IncidenciaEstado,
  IncidenciaPrioridad,
  IncidenciaCategoria,
  CaratulaServiceLine,
  UserSession,
  ExpedienteEntry,
  StaffMember,
} from "../types";
import {
  formatCurrency,
  formatDate,
  getCurrentTimestamp,
} from "../utils/formatters";
import { deduplicateClients } from "../utils/dataIntegrity";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  TrendingUp,
  ShieldCheck,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  Check,
  ChevronRight,
  Activity,
  Heart,
  FolderOpen,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRight,
  X,
  Send,
  Sliders,
  DollarSign,
  UserCheck,
  MessageSquare,
  HelpCircle,
  User,
  Menu,
  CreditCard,
} from "lucide-react";
import { LiveClock } from "./LiveClock";
import { CuidarteLogo } from "./CuidarteLogo";
import { CuidarteIsotipo } from "./CuidarteIsotipo";
import { StaffCredentialCard } from "./StaffCredentialCard";
import { Footer } from "./Footer";

interface AtencionClientesPortalProps {
  userSession: UserSession;
  allClients: Client[];
  allCaratulas: Caratula[];
  services: ServiceItem[];
  incidencias: IncidenciaTicket[];
  solicitudesIncremento: SolicitudIncrementoServicio[];
  expedienteEntries?: ExpedienteEntry[];
  staffMembers?: StaffMember[];
  onSaveIncidencia: (incidencia: IncidenciaTicket) => Promise<void>;
  onDeleteIncidencia?: (id: string) => Promise<void>;
  onSaveSolicitudIncremento: (solicitud: SolicitudIncrementoServicio) => Promise<void>;
  onSaveCaratula: (caratula: Caratula) => Promise<void>;
  onLogout: () => void;
  isOnline: boolean;
  isSyncing: boolean;
}

type ActivePortalTab = "clientes" | "incidencias" | "incrementos" | "expedientes";

const INCIDENCIA_CATEGORIAS: IncidenciaCategoria[] = [
  "Atención al Cliente",
  "Desempeño / Personal",
  "Horario / Turnos",
  "Insumos / Medicamentos",
  "Facturación / Pagos",
  "Médico / Salud",
  "Solicitud Especial",
  "Otro",
];

const INCIDENCIA_PRIORIDADES: { value: IncidenciaPrioridad; label: string; color: string; badge: string }[] = [
  { value: "Urgente", label: "Urgente / Inmediata", color: "text-rose-400 border-rose-500/30 bg-rose-950/40", badge: "bg-rose-500 text-white animate-pulse" },
  { value: "Alta", label: "Alta Prioridad", color: "text-amber-400 border-amber-500/30 bg-amber-950/40", badge: "bg-amber-500 text-slate-950" },
  { value: "Media", label: "Prioridad Media", color: "text-sky-400 border-sky-500/30 bg-sky-950/40", badge: "bg-sky-500 text-slate-950" },
  { value: "Baja", label: "Prioridad Baja", color: "text-slate-400 border-slate-700 bg-slate-800", badge: "bg-slate-700 text-slate-300" },
];

export const AtencionClientesPortal: React.FC<AtencionClientesPortalProps> = ({
  userSession,
  allClients,
  allCaratulas,
  services,
  incidencias,
  solicitudesIncremento,
  expedienteEntries = [],
  staffMembers = [],
  onSaveIncidencia,
  onSaveSolicitudIncremento,
  onSaveCaratula,
  onLogout,
  isOnline,
  isSyncing,
}) => {
  const [activeTab, setActiveTab] = useState<ActivePortalTab>("clientes");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOnlyAssigned, setFilterOnlyAssigned] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Selected client for detail view / drawer
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Incidencia Filter States
  const [incidenciaStatusFilter, setIncidenciaStatusFilter] = useState<"Todas" | IncidenciaEstado>("Todas");
  const [incidenciaPriorityFilter, setIncidenciaPriorityFilter] = useState<"Todas" | IncidenciaPrioridad>("Todas");

  // Modal States
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [isNewIncidenciaModalOpen, setIsNewIncidenciaModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedIncidenciaForResolution, setSelectedIncidenciaForResolution] = useState<IncidenciaTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionStatus, setResolutionStatus] = useState<IncidenciaEstado>("Resuelta");

  // Derive or synthesize Corporate Staff Member for Atención a Clientes
  const myStaffMember = useMemo<StaffMember>(() => {
    const userUx = (userSession?.username || "").toLowerCase().trim();
    const userNombre = (userSession?.nombre || "").toLowerCase().trim();

    const found = staffMembers.find((s) => {
      const sUx = (s.id || s.noSocio || "").toLowerCase().trim();
      const sNom = `${s.nombre || ""} ${s.apellidos || ""}`.toLowerCase().trim();
      return (
        (userUx && (sUx === userUx || sNom.includes(userUx) || userUx.includes(sUx))) ||
        (userNombre && (sNom.includes(userNombre) || userNombre.includes(sNom)))
      );
    });

    if (found) return found;

    // Fallback corporate staff profile
    const rawParts = (userSession?.nombre || userSession?.username || "Atención al Cliente").split(" ");
    const nombre = rawParts[0] || "Coordinador";
    const apellidos = rawParts.slice(1).join(" ") || "Atención a Clientes";
    const cleanNum = (userSession?.username || "").replace(/\D/g, "") || "4001";

    return {
      id: userSession?.username || `SOCP-ATC-${cleanNum}`,
      noSocio: cleanNum,
      nombre,
      apellidos,
      gradoTitulo: "LICENCIATURA / ATENCIÓN A CLIENTES",
      puestoTipoPersonal: "Atención a Clientes y Servicios",
      areaAdscripcion: `DIRECCIÓN DE ATENCIÓN A CLIENTES - ${userSession?.sucursalNombre || "CUIDARTE MÉXICO"}`,
      fotoUrl: "",
      folioUrgencias: `CORP-${cleanNum}`,
      fechaExpiracion: "21/08/2030",
      badgePrincipal: "CREDENCIAL CORPORATIVA",
      badgesSecundarios: ["ATENCIÓN A CLIENTES", "CUIDARTE"],
      tipoContrato: "Empleado Corporativo",
      estatus: "Activo",
      notas: `Personal de Atención a Clientes y Seguimiento de Servicios ${userSession?.sucursalNombre || "Cuidarte México"}`,
    };
  }, [staffMembers, userSession]);

  // New Incidencia Form State
  const [newIncidenciaForm, setNewIncidenciaForm] = useState<{
    clientId: string;
    categoria: IncidenciaCategoria;
    prioridad: IncidenciaPrioridad;
    titulo: string;
    descripcion: string;
    reportadoPor: string;
  }>({
    clientId: "",
    categoria: "Atención al Cliente",
    prioridad: "Media",
    titulo: "",
    descripcion: "",
    reportadoPor: "Cliente / Familiar",
  });

  // Incremento / Cotizador de Adicionales State
  const [isIncrementoModalOpen, setIsIncrementoModalOpen] = useState(false);
  const [incrementoClientId, setIncrementoClientId] = useState<string>("");
  const [incrementoTitulo, setIncrementoTitulo] = useState<string>("");
  const [incrementoMotivo, setIncrementoMotivo] = useState<string>("");
  const [incrementoDescuento, setIncrementoDescuento] = useState<number>(0);
  const [incrementoLines, setIncrementoLines] = useState<CaratulaServiceLine[]>([]);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<string>("");
  const [selectedServiceQty, setSelectedServiceQty] = useState<number>(1);
  const [previewIncrementoDoc, setPreviewIncrementoDoc] = useState<SolicitudIncrementoServicio | null>(null);
  const [isApplyingToCaratula, setIsApplyingToCaratula] = useState<boolean>(false);

  // Deduplicate clients to avoid key collisions and merge duplicate records
  const uniqueClients = useMemo(() => deduplicateClients(allClients), [allClients]);

  // Filter clients based on assignment & search query
  const filteredClients = useMemo(() => {
    return uniqueClients.filter((client) => {
      // If user session has username, check if assigned
      const isAssigned =
        !filterOnlyAssigned ||
        (client.asignadoAtencionA && client.asignadoAtencionA.toLowerCase() === userSession.username.toLowerCase()) ||
        (client.asignadoA && client.asignadoA.toLowerCase() === userSession.username.toLowerCase());

      const matchesSearch =
        searchQuery === "" ||
        client.nombreCompletoCliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.nombreCompletoRS && client.nombreCompletoRS.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.numeroContacto && client.numeroContacto.includes(searchQuery)) ||
        (client.diagnostico && client.diagnostico.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.id && client.id.toLowerCase().includes(searchQuery.toLowerCase()));

      return isAssigned && matchesSearch;
    });
  }, [uniqueClients, filterOnlyAssigned, searchQuery, userSession.username]);

  // Clients assigned directly to current agent
  const myAssignedClientsCount = useMemo(() => {
    return uniqueClients.filter(
      (c) =>
        (c.asignadoAtencionA && c.asignadoAtencionA.toLowerCase() === userSession.username.toLowerCase()) ||
        (c.asignadoA && c.asignadoA.toLowerCase() === userSession.username.toLowerCase())
    ).length;
  }, [uniqueClients, userSession.username]);

  // Incidencias metrics & filtered list
  const filteredIncidencias = useMemo(() => {
    return incidencias.filter((inc) => {
      const matchesStatus = incidenciaStatusFilter === "Todas" || inc.estado === incidenciaStatusFilter;
      const matchesPriority = incidenciaPriorityFilter === "Todas" || inc.prioridad === incidenciaPriorityFilter;
      const matchesSearch =
        searchQuery === "" ||
        inc.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.clientNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.categoria.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [incidencias, incidenciaStatusFilter, incidenciaPriorityFilter, searchQuery]);

  const activeIncidenciasCount = useMemo(() => {
    return incidencias.filter((i) => i.estado === "Abierta" || i.estado === "En Proceso").length;
  }, [incidencias]);

  const resolvedIncidenciasCount = useMemo(() => {
    return incidencias.filter((i) => i.estado === "Resuelta").length;
  }, [incidencias]);

  // Helper to find client's active Carátula
  const getActiveCaratulaForClient = (clientId: string, clientName: string) => {
    const targetName = (clientName || "").trim().toLowerCase();
    const targetId = (clientId || "").trim().toLowerCase();

    return (
      allCaratulas.find((c) => {
        if (!c || c.estado === "Cancelado") return false;
        const cClientName = (c.nombreCompletoCliente || (c as any).clienteNombre || "").trim().toLowerCase();
        const cReceptor = (c.nombreCompletoRS || (c as any).receptorNombre || "").trim().toLowerCase();
        const cClientId = (c.clientId || "").trim().toLowerCase();

        return Boolean(
          (targetId && cClientId === targetId) ||
          (targetName && (cClientName === targetName || cReceptor === targetName))
        );
      }) || null
    );
  };

  // Helper to open new incidencia for a specific client
  const handleOpenNewIncidenciaForClient = (client: Client) => {
    setNewIncidenciaForm({
      clientId: client.id,
      categoria: "Atención al Cliente",
      prioridad: "Media",
      titulo: "",
      descripcion: "",
      reportadoPor: `${client.nombreCompletoCliente} (Cliente / Familiar)`,
    });
    setIsNewIncidenciaModalOpen(true);
  };

  // Handle submit new Incidencia
  const handleSubmitNewIncidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncidenciaForm.clientId) {
      alert("Por favor seleccione el cliente asociado a la incidencia.");
      return;
    }
    if (!newIncidenciaForm.titulo.trim() || !newIncidenciaForm.descripcion.trim()) {
      alert("Por favor ingrese el título y la descripción detallada del reporte.");
      return;
    }

    const client = allClients.find((c) => c.id === newIncidenciaForm.clientId);
    const clientName = client ? client.nombreCompletoCliente : "Cliente no especificado";
    const activeCaratula = client ? getActiveCaratulaForClient(client.id, client.nombreCompletoCliente) : null;

    const newTicket: IncidenciaTicket = {
      id: `INC-${Date.now().toString().slice(-6)}`,
      clientId: newIncidenciaForm.clientId,
      clientNombre: clientName,
      caratulaFolio: activeCaratula ? activeCaratula.folio : undefined,
      categoria: newIncidenciaForm.categoria,
      prioridad: newIncidenciaForm.prioridad,
      estado: "Abierta",
      titulo: newIncidenciaForm.titulo.trim(),
      descripcion: newIncidenciaForm.descripcion.trim(),
      reportadoPor: newIncidenciaForm.reportadoPor.trim() || "Cliente",
      atendidoPor: userSession.nombre || userSession.username,
      fechaReporte: new Date().toISOString(),
      timestamp: getCurrentTimestamp(),
    };

    try {
      await onSaveIncidencia(newTicket);
      setIsNewIncidenciaModalOpen(false);
      setNewIncidenciaForm({
        clientId: "",
        categoria: "Atención al Cliente",
        prioridad: "Media",
        titulo: "",
        descripcion: "",
        reportadoPor: "Cliente / Familiar",
      });
      alert("Incidencia / Ticket de atención registrado exitosamente.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la incidencia.");
    }
  };

  // Handle open resolve modal
  const handleOpenResolveModal = (incidencia: IncidenciaTicket) => {
    setSelectedIncidenciaForResolution(incidencia);
    setResolutionNotes(incidencia.resolucion || "");
    setResolutionStatus(incidencia.estado === "Abierta" ? "En Proceso" : "Resuelta");
    setIsResolveModalOpen(true);
  };

  // Handle submit resolution
  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidenciaForResolution) return;

    const updatedTicket: IncidenciaTicket = {
      ...selectedIncidenciaForResolution,
      estado: resolutionStatus,
      resolucion: resolutionNotes.trim(),
      atendidoPor: userSession.nombre || userSession.username,
      fechaResolucion: resolutionStatus === "Resuelta" ? new Date().toISOString() : selectedIncidenciaForResolution.fechaResolucion,
    };

    try {
      await onSaveIncidencia(updatedTicket);
      setIsResolveModalOpen(false);
      setSelectedIncidenciaForResolution(null);
      alert(`Incidencia actualizada correctamente a estado: ${resolutionStatus}.`);
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la incidencia.");
    }
  };

  // Incremento / Cotizador de Servicios Adicionales handlers
  const handleOpenIncrementoForClient = (client: Client) => {
    setIncrementoClientId(client.id);
    setIncrementoTitulo(`Incremento de Servicio - ${client.nombreCompletoCliente}`);
    setIncrementoMotivo("");
    setIncrementoDescuento(0);
    setIncrementoLines([]);
    setIsIncrementoModalOpen(true);
  };

  const handleAddServiceLineToIncremento = () => {
    if (!selectedServiceToAdd) return;
    const srv = services.find((s) => s.id === selectedServiceToAdd);
    if (!srv) return;

    const newLine: CaratulaServiceLine = {
      servicio: srv.nombreServicio,
      cantidad: selectedServiceQty,
      precioU: srv.precio,
      costoU: srv.costo,
      precioTot: srv.precio * selectedServiceQty,
    };

    setIncrementoLines((prev) => [...prev, newLine]);
    setSelectedServiceToAdd("");
    setSelectedServiceQty(1);
  };

  const handleRemoveIncrementoLine = (index: number) => {
    setIncrementoLines((prev) => prev.filter((_, i) => i !== index));
  };

  const incrementoSubtotal = useMemo(() => {
    return incrementoLines.reduce((acc, l) => acc + (l.precioTot || 0), 0);
  }, [incrementoLines]);

  const incrementoTotal = useMemo(() => {
    return Math.max(0, incrementoSubtotal - (incrementoDescuento || 0));
  }, [incrementoSubtotal, incrementoDescuento]);

  const handleSaveIncrementoQuotation = async (incorporateToCaratula: boolean = false) => {
    if (!incrementoClientId) {
      alert("Seleccione el cliente para la cotización de incremento.");
      return;
    }
    if (incrementoLines.length === 0) {
      alert("Agregue al menos un servicio a la cotización de incremento.");
      return;
    }

    const client = allClients.find((c) => c.id === incrementoClientId);
    if (!client) return;

    const activeCaratula = getActiveCaratulaForClient(client.id, client.nombreCompletoCliente);

    const solicitud: SolicitudIncrementoServicio = {
      id: `INC-SERV-${Date.now().toString().slice(-6)}`,
      clientId: client.id,
      clientNombre: client.nombreCompletoCliente,
      caratulaFolioReferencia: activeCaratula ? activeCaratula.folio : undefined,
      titulo: incrementoTitulo.trim() || `Incremento de Servicio`,
      serviciosSolicitados: incrementoLines,
      subtotal: incrementoSubtotal,
      descuento: incrementoDescuento,
      total: incrementoTotal,
      motivoIncremento: incrementoMotivo.trim() || "Ampliación de servicios solicitada por el cliente",
      estado: incorporateToCaratula ? "Agregado al Servicio" : "Cotizado",
      solicitadoPor: `${client.nombreCompletoCliente} (Cliente)`,
      registradoPorUx: userSession.nombre || userSession.username,
      fechaSolicitud: new Date().toISOString(),
      fechaAplicacion: incorporateToCaratula ? new Date().toISOString() : undefined,
      timestamp: getCurrentTimestamp(),
    };

    try {
      // Save the Solicitud de Incremento record
      await onSaveSolicitudIncremento(solicitud);

      // If requested to incorporate directly into active Carátula:
      if (incorporateToCaratula && activeCaratula) {
        const mergedLines = [...(activeCaratula.servicios || []), ...incrementoLines];
        const newSubtotal = mergedLines.reduce((acc, l) => acc + (l.subtotal || 0), 0);
        const newDescuento = (activeCaratula.descuento || 0) + incrementoDescuento;
        const newTotal = Math.max(0, newSubtotal - newDescuento);
        const newPendiente = Math.max(0, newTotal - (activeCaratula.pagado || 0));

        const updatedCaratula: Caratula = {
          ...activeCaratula,
          servicios: mergedLines,
          subtotal: newSubtotal,
          descuento: newDescuento,
          total: newTotal,
          pendiente: newPendiente,
          detallesServicio: `${activeCaratula.detallesServicio || ""}\n[Incremento ${getCurrentTimestamp()} por ${userSession.nombre || userSession.username}]: ${solicitud.titulo} (${formatCurrency(incrementoTotal)})`.trim(),
        };

        await onSaveCaratula(updatedCaratula);
        alert(`¡Cotización registrada y agregada exitosamente a la Carátula activa (${activeCaratula.folio})!`);
      } else {
        alert("¡Cotización de incremento de servicio guardada con éxito!");
      }

      setIsIncrementoModalOpen(false);
      setPreviewIncrementoDoc(solicitud);
    } catch (err) {
      console.error(err);
      alert("Error al procesar el incremento de servicio.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* TOP AGENT NAVIGATION HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Left: Branding & Role Identity */}
            <div className="flex items-center gap-3">
              <div className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-200" style={{ width: "115px", borderRadius: "10px", borderWidth: "1px" }}>
                <CuidarteLogo
                  size="sm"
                  showTagline={true}
                  variant="header"
                  sucursalId={userSession.sucursalId}
                  sucursalNombre={userSession.sucursalNombre || "Cuidarte México"}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
                    Atención a Clientes & Éxito
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Gestión de Cartera Asignada • Resolución de Incidencias • Cotizador de Incrementos
                </p>
              </div>
            </div>

            {/* Right: User Badge, Status & Logout */}
            <div className="flex items-center flex-wrap gap-2.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-slate-300 font-medium">
                  {userSession.nombre || userSession.username}
                </span>
                <span className="text-slate-500 text-[10px] hidden sm:inline">({userSession.username})</span>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/40 border border-slate-800 px-3 py-1.5 rounded-xl">
                <LiveClock />
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-mono">
                    <Wifi className="w-3.5 h-3.5" /> En línea
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-400 text-[11px] font-mono">
                    <WifiOff className="w-3.5 h-3.5" /> Sin conexión
                  </span>
                )}
                {isSyncing && (
                  <RefreshCw className="w-3 h-3 text-sky-400 animate-spin" title="Sincronizando con la nube..." />
                )}
              </div>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
                title="Cerrar Sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Salir</span>
              </button>

              {/* Mobile Hamburger Toggle Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden flex items-center justify-center min-h-[44px] min-w-[44px]"
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* SECONDARY NAVBAR: METRICS & NAVIGATION TABS (DESKTOP) */}
          <div className="hidden md:flex mt-4 pt-3 border-t border-slate-800/80 items-stretch sm:items-center justify-between gap-3">
            <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setActiveTab("clientes")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "clientes"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Clientes Asignados</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900/80 text-[10px] font-mono">
                  {allClients.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("incidencias")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "incidencias"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50"
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <span>Incidencias & Soporte</span>
                {activeIncidenciasCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold animate-pulse">
                    {activeIncidenciasCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("incrementos")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "incrementos"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50"
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-300" />
                <span>Cotizador de Incremento</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-900/80 text-[10px] font-mono">
                  {solicitudesIncremento.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("expedientes")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === "expedientes"
                    ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                    : "bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50"
                }`}
              >
                <Activity className="w-4 h-4 text-sky-300" />
                <span>Expediente & Novedades</span>
              </button>
            </nav>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewIncidenciaForm({
                    clientId: allClients[0]?.id || "",
                    categoria: "Atención al Cliente",
                    prioridad: "Media",
                    titulo: "",
                    descripcion: "",
                    reportadoPor: "Cliente / Familiar",
                  });
                  setIsNewIncidenciaModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-900/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Registrar Incidencia</span>
              </button>

              <button
                onClick={() => {
                  if (allClients.length > 0) {
                    handleOpenIncrementoForClient(allClients[0]);
                  } else {
                    alert("No hay clientes disponibles para cotizar incremento.");
                  }
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-900/30 transition-all cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                <span>+ Cotizar Incremento</span>
              </button>
            </div>
          </div>
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
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm">
                    AC
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Atención a Clientes</h3>
                    <p className="text-[11px] text-slate-400">{userSession.nombre || userSession.username}</p>
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

              {/* KPI Snapshot */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Clientes:</span>
                    <span className="font-mono font-bold text-white">{allClients.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Incidencias Abiertas:</span>
                    <span className="font-mono font-bold text-amber-400">{activeIncidenciasCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Incrementos Cotizados:</span>
                    <span className="font-mono font-bold text-emerald-400">{solicitudesIncremento.length}</span>
                  </div>
                </div>

                {/* Quick Action Shortcuts */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setNewIncidenciaForm({
                        clientId: allClients[0]?.id || "",
                        categoria: "Atención al Cliente",
                        prioridad: "Media",
                        titulo: "",
                        descripcion: "",
                        reportadoPor: "Cliente / Familiar",
                      });
                      setIsNewIncidenciaModalOpen(true);
                    }}
                    className="p-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 rounded-xl text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Incidencia</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (allClients.length > 0) {
                        handleOpenIncrementoForClient(allClients[0]);
                      }
                    }}
                    className="p-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>+ Incremento</span>
                  </button>
                </div>

                {/* Navigation Items List */}
                <div className="space-y-1.5 pt-2">
                  <button
                    onClick={() => {
                      setActiveTab("clientes");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "clientes" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-indigo-300" />
                      <span>Clientes Asignados</span>
                    </div>
                    <span className="bg-indigo-950 text-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-mono">
                      {allClients.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("incidencias");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "incidencias" ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                      <span>Incidencias & Soporte</span>
                    </div>
                    {activeIncidenciasCount > 0 && (
                      <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-mono font-bold animate-pulse">
                        {activeIncidenciasCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("incrementos");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "incrementos" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-emerald-300" />
                      <span>Cotizador de Incremento</span>
                    </div>
                    <span className="bg-emerald-950 text-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-mono">
                      {solicitudesIncremento.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("expedientes");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "expedientes" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-sky-300" />
                      <span>Expediente & Novedades</span>
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

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28 md:pb-6">
        {/* KPI METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-indigo-950/80 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Cartera de Clientes</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-white">{allClients.length}</span>
                {myAssignedClientsCount > 0 && (
                  <span className="text-[10px] text-indigo-300 font-medium">({myAssignedClientsCount} asignados directos)</span>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-amber-950/80 border border-amber-500/30 rounded-xl text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Incidencias Activas</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-amber-400">{activeIncidenciasCount}</span>
                <span className="text-[10px] text-slate-400 font-medium">en seguimiento</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Casos Resueltos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-emerald-400">{resolvedIncidenciasCount}</span>
                <span className="text-[10px] text-slate-400 font-medium">solucionados</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-3 bg-cyan-950/80 border border-cyan-500/30 rounded-xl text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Incrementos de Servicio</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-cyan-400">{solicitudesIncremento.length}</span>
                <span className="text-[10px] text-slate-400 font-medium">cotizados / anexados</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: CLIENTES ASIGNADOS */}
        {activeTab === "clientes" && (
          <div className="space-y-5">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre, paciente, teléfono, dirección o diagnóstico..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterOnlyAssigned(!filterOnlyAssigned)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    filterOnlyAssigned
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Solo Mis Asignados ({myAssignedClientsCount})</span>
                </button>
              </div>
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client, idx) => {
                const activeCaratula = getActiveCaratulaForClient(client.id, client.nombreCompletoCliente);
                const clientIncidencias = incidencias.filter(
                  (i) => i.clientId === client.id && (i.estado === "Abierta" || i.estado === "En Proceso")
                );

                return (
                  <div
                    key={`atencion-cli-${client.id || idx}-${idx}`}
                    className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:shadow-indigo-950/20 space-y-4"
                  >
                    <div>
                      {/* Card Header: Client ID, Status & Incidencias alert */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-indigo-400 font-mono text-[10px] font-bold">
                            {client.id}
                          </span>
                          {client.asignadoAtencionA && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[10px] font-medium">
                              Asignado: {client.asignadoAtencionA}
                            </span>
                          )}
                        </div>

                        {clientIncidencias.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            {clientIncidencias.length} {clientIncidencias.length === 1 ? "incidencia" : "incidencias"}
                          </span>
                        )}
                      </div>

                      {/* Client & Patient Info */}
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cliente Titular</p>
                          <h3 className="text-sm font-bold text-white leading-tight">
                            {client.nombreCompletoCliente}
                          </h3>
                        </div>

                        {client.nombreCompletoRS && (
                          <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="font-semibold uppercase text-indigo-300 flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-400" /> Paciente (RS)
                              </span>
                              {client.edad && <span className="font-mono">{client.edad}</span>}
                            </div>
                            <p className="text-xs font-semibold text-slate-200">{client.nombreCompletoRS}</p>
                            {client.diagnostico && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                                "{client.diagnostico}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* Active Service Summary */}
                        {activeCaratula ? (
                          <div className="p-2.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-indigo-300 font-mono">
                                Servicio Activo: {activeCaratula.folio}
                              </span>
                              <span className="font-mono font-bold text-emerald-400">
                                {formatCurrency(activeCaratula.total)}
                              </span>
                            </div>
                            {activeCaratula.inicio && (
                              <p className="text-[10px] text-slate-400 font-mono">
                                Vigencia: {activeCaratula.inicio} {activeCaratula.fin ? `al ${activeCaratula.fin}` : ""}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
                            <p className="text-[11px] text-slate-400">Sin carátula activa en curso</p>
                          </div>
                        )}

                        {/* Contact details */}
                        <div className="pt-2 border-t border-slate-800/60 space-y-1 text-xs text-slate-300">
                          {client.numeroContacto && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-slate-400">
                                <Phone className="w-3 h-3 text-slate-400" /> {client.numeroContacto}
                              </span>
                              <a
                                href={`https://wa.me/52${client.numeroContacto.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-400 rounded-lg text-[10px] font-semibold transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </a>
                            </div>
                          )}
                          {client.direccionServicio && (
                            <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{client.direccionServicio}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for this client */}
                    <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleOpenNewIncidenciaForClient(client)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Incidencia</span>
                      </button>

                      <button
                        onClick={() => handleOpenIncrementoForClient(client)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+ Incremento</span>
                      </button>

                      <button
                        onClick={() => setSelectedClient(client)}
                        className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Ficha Completa & Expediente</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredClients.length === 0 && (
              <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-300">No se encontraron clientes</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {filterOnlyAssigned
                    ? "No tienes clientes directamente asignados. Desactiva el filtro para ver la cartera completa."
                    : "Intenta con otro término de búsqueda."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INCIDENCIAS & TICKETS DE SOPORTE */}
        {activeTab === "incidencias" && (
          <div className="space-y-5">
            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider mr-1">Estado:</span>
                {(["Todas", "Abierta", "En Proceso", "Resuelta", "Cancelada"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setIncidenciaStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      incidenciaStatusFilter === status
                        ? status === "Abierta"
                          ? "bg-rose-600 text-white"
                          : status === "En Proceso"
                          ? "bg-amber-600 text-white"
                          : status === "Resuelta"
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-750"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={incidenciaPriorityFilter}
                  onChange={(e) => setIncidenciaPriorityFilter(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 px-3 py-2 rounded-xl outline-none"
                >
                  <option value="Todas">Todas las Prioridades</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>

                <button
                  onClick={() => {
                    setNewIncidenciaForm({
                      clientId: allClients[0]?.id || "",
                      categoria: "Atención al Cliente",
                      prioridad: "Media",
                      titulo: "",
                      descripcion: "",
                      reportadoPor: "Cliente / Familiar",
                    });
                    setIsNewIncidenciaModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nueva Incidencia</span>
                </button>
              </div>
            </div>

            {/* Incidencias List */}
            <div className="space-y-3">
              {filteredIncidencias.map((inc) => {
                const priorityConfig = INCIDENCIA_PRIORIDADES.find((p) => p.value === inc.prioridad) || INCIDENCIA_PRIORIDADES[2];

                return (
                  <div
                    key={inc.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-indigo-400 font-mono text-xs font-bold border border-slate-700">
                          {inc.id}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${priorityConfig.badge}`}>
                          {inc.prioridad}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
                          {inc.categoria}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            inc.estado === "Abierta"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                              : inc.estado === "En Proceso"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          }`}
                        >
                          ● {inc.estado}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{inc.timestamp || formatDate(inc.fechaReporte)}</span>
                      </div>
                    </div>

                    {/* Incidencia Title & Description */}
                    <div>
                      <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold mb-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Cliente: {inc.clientNombre}</span>
                        {inc.caratulaFolio && <span className="text-slate-500 font-mono">({inc.caratulaFolio})</span>}
                      </div>
                      <h3 className="text-base font-bold text-white">{inc.titulo}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-1 whitespace-pre-line bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                        {inc.descripcion}
                      </p>
                    </div>

                    {/* Resolution Section if solved or in process */}
                    {inc.resolucion && (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Solución / Bitácora de Atención:
                          </span>
                          {inc.fechaResolucion && (
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatDate(inc.fechaResolucion)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-200 whitespace-pre-line">{inc.resolucion}</p>
                      </div>
                    )}

                    {/* Footer: Reporter & Action Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-slate-800/60">
                      <div>
                        <span>Reportado por: </span>
                        <strong className="text-slate-300">{inc.reportadoPor}</strong>
                        {inc.atendidoPor && (
                          <span className="ml-2 text-slate-400">
                            • Atendido por: <strong className="text-indigo-300">{inc.atendidoPor}</strong>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenResolveModal(inc)}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          inc.estado === "Resuelta"
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>{inc.estado === "Resuelta" ? "Ver / Modificar Resolución" : "Dar Seguimiento / Resolver"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredIncidencias.length === 0 && (
                <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-200">Sin incidencias pendientes en este criterio</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Excelente trabajo manteniendo la cartera de clientes satisfecha y sin reportes activos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COTIZADOR DE INCREMENTO DE SERVICIOS */}
        {activeTab === "incrementos" && (
          <div className="space-y-6">
            {/* Header / Intro Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-base font-bold text-white">Cotizador de Incremento al Servicio Actual</h2>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Este perfil permite presupuestar ampliaciones, guardias extra, insumos o turnos adicionales solicitados por el cliente para agregarlos a su servicio actual.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (allClients.length > 0) {
                      handleOpenIncrementoForClient(allClients[0]);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nueva Cotización de Incremento</span>
                </button>
              </div>
            </div>

            {/* List of Previous Solicitudes de Incremento */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Historial de Solicitudes e Incrementos ({solicitudesIncremento.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {solicitudesIncremento.map((sol) => (
                  <div
                    key={sol.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-mono font-bold text-indigo-400">{sol.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sol.estado === "Agregado al Servicio"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/40"
                          }`}
                        >
                          ● {sol.estado}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <h4 className="text-sm font-bold text-white">{sol.titulo}</h4>
                        <p className="text-xs text-slate-400">
                          Cliente: <strong className="text-slate-200">{sol.clientNombre}</strong>
                        </p>
                        {sol.caratulaFolioReferencia && (
                          <p className="text-[11px] text-slate-500 font-mono">
                            Folio Carátula: {sol.caratulaFolioReferencia}
                          </p>
                        )}
                        <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800 italic">
                          "{sol.motivoIncremento}"
                        </p>

                        {/* Breakdown */}
                        <div className="pt-2 space-y-1">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Líneas Adicionales:</p>
                          <div className="space-y-1">
                            {sol.serviciosSolicitados.map((line, idx) => (
                              <div key={idx} className="flex justify-between text-xs text-slate-300">
                                <span>
                                  {line.cantidad}x {line.servicio}
                                </span>
                                <span className="font-mono text-slate-200">{formatCurrency(line.precioTot)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase">Monto Incremento: </span>
                        <strong className="text-sm font-mono font-bold text-emerald-400">
                          {formatCurrency(sol.total)}
                        </strong>
                      </div>

                      <button
                        onClick={() => setPreviewIncrementoDoc(sol)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ver Presupuesto</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {solicitudesIncremento.length === 0 && (
                <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
                  <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">Aún no se han registrado cotizaciones de incremento</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Usa el botón "+ Nueva Cotización de Incremento" cuando un cliente requiera horas extra, guardias o insumos adicionales.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: EXPEDIENTES & NOVEDADES CLÍNICAS */}
        {activeTab === "expedientes" && (
          <div className="space-y-5">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Expedientes Clínicos & Bitácora de Novedades</h3>
                <p className="text-xs text-slate-400">
                  Consulta de signos vitales, notas médicas y novedades para brindar asesoría y seguimiento integral a los familiares.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[...expedienteEntries]
                .sort((a, b) => ((b.fechaHora || b.timestamp || "")).localeCompare(a.fechaHora || a.timestamp || ""))
                .slice(0, 15)
                .map((entry) => (
                <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-500/30 text-sky-300 text-[10px] font-bold uppercase">
                        {entry.tipo}
                      </span>
                      <strong className="text-xs text-white">{entry.titulo}</strong>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{entry.fechaHora || entry.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{entry.descripcion}</p>

                  {entry.vitals && (() => {
                    const clientData = selectedClient || (allClients && allClients.find((c) => c.id === entry.clientId));
                    const ev = evaluateAllVitals(entry.vitals, clientData?.edad);
                    return (
                      <div className="space-y-1.5 pt-2 border-t border-slate-800/60 text-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Evaluación clínica ({ev.ageInfo.groupLabel})</span>
                          <span className="text-[9px] text-slate-500">PALS / Altitud Pachuca (2,450 msnm)</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {entry.vitals.presionArterial && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">P. Arterial (mmHg)</span>
                              <strong className="text-indigo-400 block">{entry.vitals.presionArterial}</strong>
                              <span className={`text-[9px] font-bold block mt-0.5 ${ev.presionArterial.isEmergency ? "text-red-400" : ev.presionArterial.status === "danger" ? "text-amber-400" : "text-slate-400"}`}>
                                {ev.presionArterial.label}
                              </span>
                            </div>
                          )}
                          {entry.vitals.frecuenciaCardiaca && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">F. Cardíaca (lpm)</span>
                              <strong className="text-rose-400 block">{entry.vitals.frecuenciaCardiaca} bpm</strong>
                              <span className={`text-[9px] font-bold block mt-0.5 ${ev.frecuenciaCardiaca.isEmergency ? "text-red-400" : ev.frecuenciaCardiaca.status === "danger" ? "text-amber-400" : "text-slate-400"}`}>
                                {ev.frecuenciaCardiaca.label}
                              </span>
                            </div>
                          )}
                          {entry.vitals.temperatura && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Temperatura (°C)</span>
                              <strong className="text-amber-400 block">{entry.vitals.temperatura} °C</strong>
                              <span className={`text-[9px] font-bold block mt-0.5 ${ev.temperatura.isEmergency ? "text-red-400" : ev.temperatura.status === "danger" ? "text-amber-400" : "text-slate-400"}`}>
                                {ev.temperatura.label}
                              </span>
                            </div>
                          )}
                          {entry.vitals.saturacionOxigeno && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">SpO2 (%)</span>
                              <strong className="text-emerald-400 block">{entry.vitals.saturacionOxigeno} %</strong>
                              <span className={`text-[9px] font-bold block mt-0.5 ${ev.saturacionOxigeno.isEmergency ? "text-red-400" : ev.saturacionOxigeno.status === "warning" ? "text-amber-400" : "text-slate-400"}`}>
                                {ev.saturacionOxigeno.label}
                              </span>
                            </div>
                          )}
                          {entry.vitals.glucosa && (
                            <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Glucosa (mg/dL)</span>
                              <strong className="text-cyan-400 block">{entry.vitals.glucosa} mg/dL</strong>
                              <span className={`text-[9px] font-bold block mt-0.5 ${ev.glucosa.isEmergency ? "text-red-400" : ev.glucosa.status === "warning" || ev.glucosa.status === "danger" ? "text-amber-400" : "text-slate-400"}`}>
                                {ev.glucosa.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="text-[10px] text-slate-500 pt-1">
                    Registrado por: <span className="text-slate-400">{entry.registradoPor}</span>
                  </div>
                </div>
              ))}

              {expedienteEntries.length === 0 && (
                <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-3xl">
                  <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-slate-300">Sin notas de expediente registradas</h3>
                  <p className="text-xs text-slate-500 mt-1">Los reportes de enfermería aparecerán aquí en tiempo real.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: REGISTRAR NUEVA INCIDENCIA / TICKET */}
      {isNewIncidenciaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Registrar Incidencia / Ticket de Soporte</h3>
                  <p className="text-xs text-slate-400">Reporte y seguimiento de requerimiento o problema del cliente</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewIncidenciaModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewIncidencia} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Cliente Asociado *</label>
                <select
                  required
                  value={newIncidenciaForm.clientId}
                  onChange={(e) => setNewIncidenciaForm({ ...newIncidenciaForm, clientId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Seleccione el Cliente --</option>
                  {uniqueClients.map((c, idx) => (
                    <option key={`inc-cli-opt-${c.id || idx}-${idx}`} value={c.id}>
                      {c.nombreCompletoCliente} {c.nombreCompletoRS ? `(Paciente: ${c.nombreCompletoRS})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Categoría</label>
                  <select
                    value={newIncidenciaForm.categoria}
                    onChange={(e) =>
                      setNewIncidenciaForm({ ...newIncidenciaForm, categoria: e.target.value as IncidenciaCategoria })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {INCIDENCIA_CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Prioridad</label>
                  <select
                    value={newIncidenciaForm.prioridad}
                    onChange={(e) =>
                      setNewIncidenciaForm({ ...newIncidenciaForm, prioridad: e.target.value as IncidenciaPrioridad })
                    }
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  >
                    <option value="Urgente">🔴 Urgente</option>
                    <option value="Alta">🟠 Alta</option>
                    <option value="Media">🔵 Media</option>
                    <option value="Baja">⚪ Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Reportado Por</label>
                <input
                  type="text"
                  placeholder="Ej: Esposa del cliente / Familiar / Llamada telefónica"
                  value={newIncidenciaForm.reportadoPor}
                  onChange={(e) => setNewIncidenciaForm({ ...newIncidenciaForm, reportadoPor: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Título del Problema *</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Solicitud de cambio de horario / Duda con dosificación de medicamentos"
                  value={newIncidenciaForm.titulo}
                  onChange={(e) => setNewIncidenciaForm({ ...newIncidenciaForm, titulo: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Descripción Detallada *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describa claramente la situación reportada por el cliente, requerimientos específicos y acciones inmediatas tomadas..."
                  value={newIncidenciaForm.descripcion}
                  onChange={(e) => setNewIncidenciaForm({ ...newIncidenciaForm, descripcion: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewIncidenciaModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/30"
                >
                  Registrar Incidencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RESOLUCIÓN Y SEGUIMIENTO DE INCIDENCIA */}
      {isResolveModalOpen && selectedIncidenciaForResolution && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Atención y Resolución del Problema</h3>
                  <p className="text-xs text-slate-400">
                    Incidencia: {selectedIncidenciaForResolution.id} • {selectedIncidenciaForResolution.clientNombre}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResolution} className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <h4 className="text-xs font-bold text-amber-400">{selectedIncidenciaForResolution.titulo}</h4>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedIncidenciaForResolution.descripcion}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Estado de la Incidencia</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as IncidenciaEstado)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                >
                  <option value="En Proceso">🟡 En Proceso (En seguimiento con equipo/enfermería)</option>
                  <option value="Resuelta">🟢 Resuelta (Problema solucionado satisfactoriamente)</option>
                  <option value="Abierta">🔴 Abierta (Pendiente de atención)</option>
                  <option value="Cancelada">⚪ Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">
                  Bitácora de Solución / Acciones Realizadas *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describa cómo se atendió o resolvió el problema del cliente, acuerdos con la familia, confirmaciones del personal de enfermería..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30"
                >
                  Guardar Solución & Actualizar Estado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: COTIZADOR E INCORPORADOR DE INCREMENTO DE SERVICIO */}
      {isIncrementoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-indigo-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Cotizar Incremento al Servicio Actual</h3>
                  <p className="text-xs text-slate-400">
                    Presupuestar y/o anexar servicios adicionales a la carátula activa
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIncrementoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Client & Caratula selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Cliente *</label>
                  <select
                    value={incrementoClientId}
                    onChange={(e) => setIncrementoClientId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {uniqueClients.map((c, idx) => (
                      <option key={`incr-cli-opt-${c.id || idx}-${idx}`} value={c.id}>
                        {c.nombreCompletoCliente}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Carátula Activa</label>
                  {(() => {
                    const client = allClients.find((c) => c.id === incrementoClientId);
                    const actCaratula = client ? getActiveCaratulaForClient(client.id, client.nombreCompletoCliente) : null;
                    return (
                      <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-indigo-300">
                        {actCaratula ? `${actCaratula.folio} - Total actual: ${formatCurrency(actCaratula.total)}` : "Sin carátula activa"}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Título de la Cotización / Solicitud</label>
                <input
                  type="text"
                  value={incrementoTitulo}
                  onChange={(e) => setIncrementoTitulo(e.target.value)}
                  placeholder="Ej: Incremento de 3 Guardias Nocturnas y Curaciones"
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-300 mb-1">Motivo / Requerimiento del Cliente</label>
                <textarea
                  rows={2}
                  value={incrementoMotivo}
                  onChange={(e) => setIncrementoMotivo(e.target.value)}
                  placeholder="Ej: Familiar solicita extender el servicio durante el fin de semana por alta médica..."
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Add Service Lines from Catalog */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Agregar Servicios del Catálogo al Incremento
                </h4>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedServiceToAdd}
                    onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none"
                  >
                    <option value="">-- Seleccione un servicio del catálogo --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.categoria}] {s.nombreServicio} - {formatCurrency(s.precio)}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={selectedServiceQty}
                      onChange={(e) => setSelectedServiceQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs text-center font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddServiceLineToIncremento}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                {/* Lines Table */}
                {incrementoLines.length > 0 && (
                  <div className="mt-3 border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Servicio</th>
                          <th className="p-2.5 text-center">Cant.</th>
                          <th className="p-2.5 text-right">P. Unit.</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                          <th className="p-2.5 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-200">
                        {incrementoLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/50">
                            <td className="p-2.5">
                              <span className="font-semibold text-white">{line.servicio}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono">{line.cantidad}</td>
                            <td className="p-2.5 text-right font-mono">{formatCurrency(line.precioU)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                              {formatCurrency(line.precioTot)}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveIncrementoLine(idx)}
                                className="text-rose-400 hover:text-rose-300 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals and Discount */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Subtotal Adicional</label>
                  <div className="text-sm font-mono font-bold text-slate-200">{formatCurrency(incrementoSubtotal)}</div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Descuento ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={incrementoDescuento}
                    onChange={(e) => setIncrementoDescuento(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-emerald-400 font-bold mb-1">Total del Incremento</label>
                  <div className="text-base font-mono font-bold text-emerald-400">{formatCurrency(incrementoTotal)}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsIncrementoModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveIncrementoQuotation(false)}
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Solo Guardar Cotización de Incremento
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveIncrementoQuotation(true)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  Incorporar & Agregar a la Carátula Activa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DOCUMENT PREVIEW MODAL FOR INCREMENTO */}
      {previewIncrementoDoc && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Presupuesto de Incremento de Servicio</h3>
              </div>
              <button
                onClick={() => setPreviewIncrementoDoc(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Document Box */}
            <div className="bg-white text-slate-900 p-6 rounded-2xl space-y-4 font-sans text-xs border border-slate-200">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-indigo-900">CUIDARTE</h2>
                  <p className="text-[10px] text-slate-500">Soluciones de asistencia y gestión para el bienestar familiar</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-mono font-bold text-[10px]">
                    {previewIncrementoDoc.id}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5">{previewIncrementoDoc.timestamp}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Cliente</span>
                  <strong className="text-slate-900">{previewIncrementoDoc.clientNombre}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-bold">Estado</span>
                  <strong className="text-indigo-900">{previewIncrementoDoc.estado}</strong>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[9px] uppercase font-bold mb-1">Motivo / Requerimiento</span>
                <p className="p-2.5 bg-slate-50 rounded-xl text-slate-700 italic">{previewIncrementoDoc.motivoIncremento}</p>
              </div>

              {/* Service lines */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 text-[10px] uppercase font-bold">
                    <th className="py-2">Concepto / Servicio Adicional</th>
                    <th className="py-2 text-center">Cant.</th>
                    <th className="py-2 text-right">Precio Unit.</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewIncrementoDoc.serviciosSolicitados.map((s, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium">{s.servicio}</td>
                      <td className="py-2 text-center font-mono">{s.cantidad}</td>
                      <td className="py-2 text-right font-mono">{formatCurrency(s.precioU)}</td>
                      <td className="py-2 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(s.precioTot)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-slate-300 pt-3 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase">Monto Total Adicional:</span>
                <span className="text-base font-bold font-mono text-indigo-900">
                  {formatCurrency(previewIncrementoDoc.total)}
                </span>
              </div>

              <div className="pt-4 text-center text-[10px] text-slate-500 border-t border-dashed border-slate-200">
                Atendido por: {previewIncrementoDoc.registradoPorUx} • {userSession?.sucursalNombre || "Cuidarte México"}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Presupuesto</span>
              </button>
              <button
                onClick={() => setPreviewIncrementoDoc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: FICHA COMPLETA DE CLIENTE */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">{selectedClient.id}</span>
                <h3 className="text-base font-bold text-white">{selectedClient.nombreCompletoCliente}</h3>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase text-indigo-300">Datos de Contacto</h4>
                <p className="text-slate-300">
                  Teléfono Principal: <strong className="text-white">{selectedClient.numeroContacto || "Sin registrar"}</strong>
                </p>
                {selectedClient.numeroContacto2 && (
                  <p className="text-slate-300">Teléfono 2: {selectedClient.numeroContacto2}</p>
                )}
                {selectedClient.correo && (
                  <p className="text-slate-300">Correo: {selectedClient.correo}</p>
                )}
                {selectedClient.direccionServicio && (
                  <p className="text-slate-300">Dirección: {selectedClient.direccionServicio}</p>
                )}
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase text-rose-300">Paciente / Receptor de Servicio</h4>
                <p className="text-slate-300">
                  Nombre: <strong className="text-white">{selectedClient.nombreCompletoRS || "Mismo que el cliente"}</strong>
                </p>
                {selectedClient.edad && <p className="text-slate-300">Edad: {selectedClient.edad}</p>}
                {selectedClient.diagnostico && (
                  <p className="text-slate-300">Diagnóstico: <span className="italic">{selectedClient.diagnostico}</span></p>
                )}
                {selectedClient.especificaciones && (
                  <p className="text-slate-300">Especificaciones: {selectedClient.especificaciones}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  handleOpenNewIncidenciaForClient(selectedClient);
                  setSelectedClient(null);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                + Registrar Incidencia
              </button>
              <button
                onClick={() => {
                  handleOpenIncrementoForClient(selectedClient);
                  setSelectedClient(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                + Cotizar Incremento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Legal */}
      <Footer className="mt-12 mb-16 md:mb-0" userType="personal" />

      {/* FIXED MOBILE BOTTOM ERGONOMIC TOUCH BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1 flex items-center justify-around shadow-2xl safe-bottom print:hidden">
        <button
          onClick={() => setActiveTab("clientes")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "clientes" ? "text-indigo-400 bg-indigo-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-5 h-5 mb-0.5 text-indigo-400" />
          <span className="text-[10px]">Clientes</span>
        </button>

        <button
          onClick={() => setActiveTab("incidencias")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] relative ${
            activeTab === "incidencias" ? "text-amber-400 bg-amber-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-5 h-5 mb-0.5 text-amber-400" />
          <span className="text-[10px]">Incidencias</span>
          {activeIncidenciasCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("incrementos")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "incrementos" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Incrementos</span>
        </button>

        <button
          onClick={() => setActiveTab("expedientes")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "expedientes" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-5 h-5 mb-0.5 text-sky-400" />
          <span className="text-[10px]">Expedientes</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            isMobileMenuOpen ? "text-purple-400 bg-purple-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5 text-purple-400" />
          <span className="text-[10px]">Más</span>
        </button>
      </nav>
    </div>
  );
};
