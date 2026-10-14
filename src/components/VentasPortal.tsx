import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Caratula,
  Client,
  ServiceItem,
  UserSession,
  CaratulaServiceLine,
  AuditLog,
  StaffMember,
  Sucursal,
} from "../types";
import {
  formatCurrency,
  formatFolio,
  parseFolioNumber,
  getCurrentTimestamp,
  generateVerificationToken,
  getNextCaratulaFolioNomenclature,
  resolveSucursalAbbreviation,
} from "../utils/formatters";
import {
  downloadCaratulaPDF,
  downloadCaratulaImage,
  printCaratulaDocument,
} from "../utils/pdfExport";
import { loadSucursales } from "../utils/storage";
import { CuidarteLogo } from "./CuidarteLogo";
import { CaratulaDocument } from "./CaratulaDocument";
import { StaffCredentialCard } from "./StaffCredentialCard";
import { Footer } from "./Footer";
import { logAuditEvent } from "../services/auditService";
import {
  PlusCircle,
  FileText,
  Users,
  Search,
  Printer,
  Download,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
  Calendar,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Tag,
  Phone,
  Mail,
  MapPin,
  Clock,
  Sparkles,
  DollarSign,
  Send,
  Copy,
  Lock,
  ChevronRight,
  Filter,
  UserPlus,
  X,
  FileCheck,
  Share2,
  Menu,
  CreditCard,
} from "lucide-react";

interface VentasPortalProps {
  userSession: UserSession;
  allCaratulas: Caratula[];
  allClients: Client[];
  services: ServiceItem[];
  staffMembers?: StaffMember[];
  sucursales?: Sucursal[];
  onSaveCaratula: (caratula: Caratula) => Promise<void>;
  onSaveClient: (client: Client) => Promise<void>;
  onLogout: () => void;
  isOnline: boolean;
  isSyncing: boolean;
}

export const VentasPortal: React.FC<VentasPortalProps> = ({
  userSession,
  allCaratulas,
  allClients,
  services,
  staffMembers = [],
  sucursales = [],
  onSaveCaratula,
  onSaveClient,
  onLogout,
  isOnline,
  isSyncing,
}) => {
  const currentUx = (userSession?.username || userSession?.nombre || "").trim().toLowerCase();
  const currentNombre = userSession?.nombre || userSession?.username || "";

  // Credential Modal State
  const [showCredentialModal, setShowCredentialModal] = useState(false);

  // Derive or synthesize Corporate Staff Member for Ventas
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
    const rawParts = (userSession?.nombre || userSession?.username || "Asesor Comercial").split(" ");
    const nombre = rawParts[0] || "Asesor";
    const apellidos = rawParts.slice(1).join(" ") || "Comercial";
    const cleanNum = (userSession?.username || "").replace(/\D/g, "") || "3001";

    return {
      id: userSession?.username || `SOCP-VEN-${cleanNum}`,
      noSocio: cleanNum,
      nombre,
      apellidos,
      gradoTitulo: "LICENCIATURA / ASESORÍA COMERCIAL",
      puestoTipoPersonal: "Ventas / Asesor Comercial",
      areaAdscripcion: `DIRECCIÓN COMERCIAL - ${userSession?.sucursalNombre || "CUIDARTE MÉXICO"}`,
      fotoUrl: "",
      folioUrgencias: `CORP-${cleanNum}`,
      fechaExpiracion: "21/08/2030",
      badgePrincipal: "CREDENCIAL CORPORATIVA",
      badgesSecundarios: ["DIR COMERCIAL", "CUIDARTE"],
      tipoContrato: "Empleado Corporativo",
      estatus: "Activo",
      notas: `Personal de Ventas y Asesoría Comercial ${userSession?.sucursalNombre || "Cuidarte México"}`,
    };
  }, [staffMembers, userSession]);

  // Active Tab within Ventas Portal: "mis-ventas" | "cotizaciones" | "mis-clientes" | "crear-caratula" | "crear-cotizacion"
  const [activeTab, setActiveTab] = useState<
    "mis-ventas" | "cotizaciones" | "mis-clientes" | "nueva-operacion"
  >("mis-ventas");

  // Document type when opening creator
  const [creationMode, setCreationMode] = useState<"Caratula" | "Cotización">("Cotización");

  // STRICT ACCESS FILTER: Ventas only sees clients assigned to them or created by them
  const myClients = useMemo(() => {
    return allClients.filter((cl) => {
      const assigned = (cl.asignadoA || "").toLowerCase().trim();
      const created = (cl.creadoPor || "").toLowerCase().trim();
      return (
        assigned === currentUx ||
        created === currentUx ||
        cl.nombreCompletoCliente.toLowerCase().includes(`[${currentUx}]`)
      );
    });
  }, [allClients, currentUx]);

  const myClientIds = useMemo(() => {
    return new Set(myClients.map((c) => (c.id || "").toUpperCase()));
  }, [myClients]);

  // STRICT ACCESS FILTER: Ventas only sees Carátulas and Cotizaciones created by them
  const myCaratulas = useMemo(() => {
    return allCaratulas.filter((c) => {
      const created = (c.creadoPor || "").toLowerCase().trim();
      const vendUx = (c.vendedorUx || "").toLowerCase().trim();
      const isClientMine = c.id ? myClientIds.has(c.id.toUpperCase()) : false;
      return created === currentUx || vendUx === currentUx || isClientMine;
    });
  }, [allCaratulas, currentUx, myClientIds]);

  // Separate closed/active sales from quotes
  const myVentasActivas = useMemo(() => {
    return myCaratulas.filter((c) => c.tipoDocumento !== "Cotización");
  }, [myCaratulas]);

  const myCotizaciones = useMemo(() => {
    return myCaratulas.filter((c) => c.tipoDocumento === "Cotización");
  }, [myCaratulas]);

  // Personal Metrics (ONLY personal, NO global revenue)
  const personalStats = useMemo(() => {
    const totalVentasMonto = myVentasActivas.reduce((acc, c) => acc + (c.total || 0), 0);
    const totalCotizacionesMonto = myCotizaciones.reduce((acc, c) => acc + (c.total || 0), 0);
    const ventasCount = myVentasActivas.length;
    const cotizacionesCount = myCotizaciones.length;
    const clientsCount = myClients.length;

    return {
      totalVentasMonto,
      totalCotizacionesMonto,
      ventasCount,
      cotizacionesCount,
      clientsCount,
    };
  }, [myVentasActivas, myCotizaciones, myClients]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCaratulaPreview, setSelectedCaratulaPreview] = useState<Caratula | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Form State for Creating/Editing Caratula or Cotización
  const documentRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<Caratula | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Client Registration Form State
  const [newClientNombre, setNewClientNombre] = useState("");
  const [newClientTelefono, setNewClientTelefono] = useState("");
  const [newClientTelefono2, setNewClientTelefono2] = useState("");
  const [newClientCorreo, setNewClientCorreo] = useState("");
  const [newClientDireccion, setNewClientDireccion] = useState("");
  const [newClientReceptor, setNewClientReceptor] = useState("");
  const [newClientEdad, setNewClientEdad] = useState("");
  const [newClientDiagnostico, setNewClientDiagnostico] = useState("");
  const [newClientEspecificaciones, setNewClientEspecificaciones] = useState("");
  const [isSavingClient, setIsSavingClient] = useState(false);

  // Guaranteed fallback for sucursales
  const effectiveSucursales = useMemo(() => {
    if (sucursales && sucursales.length > 0) return sucursales;
    const loaded = loadSucursales();
    return loaded && loaded.length > 0 ? loaded : [];
  }, [sucursales]);

  // Next Folio Generator strictly for sales with official nomenclature CXXXX0000A00
  const getNextFolio = (tipo: "Caratula" | "Cotización", targetSucursalId?: string): string => {
    const branchId =
      targetSucursalId ||
      userSession?.sucursalId ||
      (effectiveSucursales && effectiveSucursales.length > 0 ? effectiveSucursales[0].id : "pachuca");
    const branchObj = (effectiveSucursales || []).find((s) => s.id === branchId);
    return getNextCaratulaFolioNomenclature({
      sucursal: branchObj,
      sucursalNombre: branchObj?.nombre || userSession?.sucursalNombre || "Cuidarte México",
      caratulas: allCaratulas,
      tipoDocumento: tipo,
    });
  };

  const initializeNewDocument = (tipo: "Caratula" | "Cotización", preselectedClient?: Client) => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const targetClient = preselectedClient || (myClients.length > 0 ? myClients[0] : null);

    const defaultBranchId =
      userSession?.sucursalId ||
      targetClient?.sucursalId ||
      (effectiveSucursales && effectiveSucursales.length > 0 ? effectiveSucursales[0].id : "pachuca");
    const defaultBranchObj = (effectiveSucursales || []).find((s) => s.id === defaultBranchId);
    const defaultBranchName =
      defaultBranchObj?.nombre || userSession?.sucursalNombre || "Cuidarte México";

    const newDoc: Caratula = {
      folio: getNextFolio(tipo, defaultBranchId),
      id: targetClient ? targetClient.id : `CLI-${Date.now().toString().slice(-4)}`,
      timestamp: getCurrentTimestamp(),
      tipoDocumento: tipo,
      validezCotizacion: in7Days,
      nombreCompletoCliente: targetClient ? targetClient.nombreCompletoCliente : "",
      numeroContacto: targetClient ? targetClient.numeroContacto : "",
      numeroContacto2: targetClient ? targetClient.numeroContacto2 || "" : "",
      numeroContacto3: targetClient ? targetClient.numeroContacto3 || "" : "",
      correo: targetClient ? targetClient.correo || "" : "",
      direccionServicio: targetClient ? targetClient.direccionServicio || "" : "",
      nombreCompletoRS: targetClient ? targetClient.nombreCompletoRS || "" : "",
      edad: targetClient ? targetClient.edad || "" : "",
      diagnostico: targetClient ? targetClient.diagnostico || "" : "",
      especificaciones: targetClient ? targetClient.especificaciones || "" : "",
      detallesCotizacionText: "",
      detallesServicio: "",
      servicios: [
        { servicio: "", cantidad: 1, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
        { servicio: "", cantidad: 0, precioU: 0, precioTot: 0, costoU: 0 },
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
      creadoPor: userSession.username,
      vendedorUx: userSession.username,
      vendedorNombre: currentNombre,
    };

    setFormData(newDoc);
    setCreationMode(tipo);
    setActiveTab("nueva-operacion");
  };

  // Client Selection in Document Form
  const handleSelectClientInForm = (clientId: string) => {
    if (!formData) return;
    const client = myClients.find((c) => c.id === clientId);
    if (client) {
      const newBranchId = client.sucursalId || formData.sucursalId;
      const branchObj = (effectiveSucursales || []).find((s) => s.id === newBranchId);
      const newBranchName = client.sucursalNombre || branchObj?.nombre || formData.sucursalNombre;
      const shouldRegen = Boolean(client.sucursalId && client.sucursalId !== formData.sucursalId);
      const newFolio = shouldRegen ? getNextFolio(formData.tipoDocumento, newBranchId) : formData.folio;

      setFormData({
        ...formData,
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
      });
    }
  };

  // Service Line updates
  const handleServiceChange = (index: number, field: keyof CaratulaServiceLine, value: any) => {
    if (!formData) return;
    const lines = [...formData.servicios];
    const target = { ...lines[index], [field]: value };

    if (field === "servicio") {
      const found = services.find((s) => s.nombreServicio === value);
      if (found) {
        target.precioU = found.precio || 0;
        target.costoU = found.costo || 0;
        target.cantidad = target.cantidad || 1;
      }
    }

    if (field === "cantidad" || field === "precioU" || field === "servicio") {
      target.precioTot = (target.cantidad || 0) * (target.precioU || 0);
    }

    lines[index] = target;

    const sub = lines.reduce((acc, l) => acc + (l.precioTot || 0), 0);
    const tot = Math.max(0, sub - (formData.descuento || 0));
    const pend = Math.max(0, tot - (formData.pagado || 0));

    setFormData({
      ...formData,
      servicios: lines,
      subtotal: sub,
      total: tot,
      pendiente: pend,
    });
  };

  // Save Document (Carátula or Cotización)
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    if (!formData.nombreCompletoCliente.trim()) {
      setFeedbackMsg({ type: "error", text: "El nombre del cliente es obligatorio." });
      return;
    }

    const hasServices = formData.servicios.some((s) => s.servicio && s.precioTot > 0);
    if (!hasServices) {
      setFeedbackMsg({ type: "error", text: "Debe agregar al menos un servicio con precio válido." });
      return;
    }

    setIsSavingDoc(true);
    setFeedbackMsg(null);

    try {
      const docToSave: Caratula = {
        ...formData,
        creadoPor: userSession.username,
        vendedorUx: userSession.username,
        vendedorNombre: currentNombre,
        verificationToken: formData.verificationToken || generateVerificationToken(),
        estado: formData.tipoDocumento === "Cotización" ? "Cotización" : "Activo",
      };

      await onSaveCaratula(docToSave);

      // MANDATORY AUDIT LOG
      await logAuditEvent({
        tipoAccion: docToSave.tipoDocumento === "Cotización" ? "CREAR_COTIZACION" : "CREAR_CARATULA",
        descripcion: `${docToSave.tipoDocumento === "Cotización" ? "Cotización" : "Carátula"} ${docToSave.folio} generada por ${currentNombre}`,
        usuarioUx: userSession.username,
        usuarioNombre: currentNombre,
        rol: "ventas",
        folioReferencia: docToSave.folio,
        clienteIdReferencia: docToSave.id,
        detalles: {
          montoTotal: docToSave.total,
          cliente: docToSave.nombreCompletoCliente,
          servicios: docToSave.servicios.filter((s) => s.servicio).map((s) => `${s.cantidad}x ${s.servicio}`),
        },
      });

      setFeedbackMsg({
        type: "success",
        text: `¡${docToSave.tipoDocumento === "Cotización" ? "Cotización" : "Carátula"} ${docToSave.folio} guardada exitosamente!`,
      });

      setTimeout(() => {
        setFormData(null);
        setActiveTab(docToSave.tipoDocumento === "Cotización" ? "cotizaciones" : "mis-ventas");
        setFeedbackMsg(null);
      }, 1500);
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Error al guardar el documento." });
    } finally {
      setIsSavingDoc(false);
    }
  };

  // Convert Quote to Active Carátula
  const handleConvertCotizacionToCaratula = async (quote: Caratula) => {
    if (!window.confirm(`¿Deseas convertir la cotización ${quote.folio} en una Carátula de Venta Activa?`)) {
      return;
    }

    const newFolio = getNextFolio("Caratula");
    const converted: Caratula = {
      ...quote,
      folio: newFolio,
      tipoDocumento: "Caratula",
      estado: "Activo",
      timestamp: getCurrentTimestamp(),
      creadoPor: userSession.username,
      vendedorUx: userSession.username,
      vendedorNombre: currentNombre,
    };

    try {
      await onSaveCaratula(converted);
      await logAuditEvent({
        tipoAccion: "CREAR_CARATULA",
        descripcion: `Cotización ${quote.folio} convertida a Carátula Activa ${converted.folio} por ${currentNombre}`,
        usuarioUx: userSession.username,
        usuarioNombre: currentNombre,
        rol: "ventas",
        folioReferencia: converted.folio,
        clienteIdReferencia: converted.id,
        detalles: { montoTotal: converted.total, cotizacionOrigen: quote.folio },
      });
      alert(`¡Cotización convertida con éxito! Nueva Carátula: ${newFolio}`);
      setActiveTab("mis-ventas");
    } catch (err: any) {
      alert("Error al convertir cotización: " + err.message);
    }
  };

  // Create New Client assigned to this sales rep
  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientNombre.trim()) {
      alert("El nombre del cliente es obligatorio.");
      return;
    }

    setIsSavingClient(true);
    try {
      // Find highest CLI- number
      const maxCliNum = allClients.reduce((max, c) => {
        const num = parseInt(c.id.replace(/\D/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      const nextId = `CLI-${String(maxCliNum + 1).padStart(3, "0")}`;

      const clientToSave: Client = {
        id: nextId,
        nombreCompletoCliente: newClientNombre.trim(),
        numeroContacto: newClientTelefono.trim(),
        numeroContacto2: newClientTelefono2.trim(),
        correo: newClientCorreo.trim(),
        direccionServicio: newClientDireccion.trim(),
        nombreCompletoRS: newClientReceptor.trim() || newClientNombre.trim(),
        edad: newClientEdad.trim(),
        diagnostico: newClientDiagnostico.trim(),
        especificaciones: newClientEspecificaciones.trim(),
        timestamp: new Date().toISOString(),
        asignadoA: userSession.username,
        creadoPor: userSession.username,
      };

      await onSaveClient(clientToSave);

      // Audit Log
      await logAuditEvent({
        tipoAccion: "CREAR_CLIENTE",
        descripcion: `Cliente ${clientToSave.id} (${clientToSave.nombreCompletoCliente}) registrado por ${currentNombre}`,
        usuarioUx: userSession.username,
        usuarioNombre: currentNombre,
        rol: "ventas",
        clienteIdReferencia: clientToSave.id,
      });

      alert(`Cliente ${clientToSave.id} registrado y asignado exitosamente.`);
      // Reset form
      setNewClientNombre("");
      setNewClientTelefono("");
      setNewClientTelefono2("");
      setNewClientCorreo("");
      setNewClientDireccion("");
      setNewClientReceptor("");
      setNewClientEdad("");
      setNewClientDiagnostico("");
      setNewClientEspecificaciones("");
      setIsClientModalOpen(false);
    } catch (err: any) {
      alert("Error al guardar cliente: " + err.message);
    } finally {
      setIsSavingClient(false);
    }
  };

  // Audit view triggers
  const handleOpenCaratulaPreview = (caratula: Caratula) => {
    setSelectedCaratulaPreview(caratula);
    logAuditEvent({
      tipoAccion: "CONSULTA_CARATULA",
      descripcion: `Consulta de detalle ${caratula.tipoDocumento || "Carátula"} ${caratula.folio}`,
      usuarioUx: userSession.username,
      usuarioNombre: currentNombre,
      rol: "ventas",
      folioReferencia: caratula.folio,
      clienteIdReferencia: caratula.id,
    });
  };

  const handleOpenClientDetail = (client: Client) => {
    setSelectedClientDetail(client);
    logAuditEvent({
      tipoAccion: "CONSULTA_CLIENTE",
      descripcion: `Consulta de expediente de cliente ${client.id} - ${client.nombreCompletoCliente}`,
      usuarioUx: userSession.username,
      usuarioNombre: currentNombre,
      rol: "ventas",
      clienteIdReferencia: client.id,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Sticky Header for Ventas Portal */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-xl shadow border border-slate-200">
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
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-indigo-400" />
                  Portal de Ventas & Cotizaciones
                </span>
                {isSyncing && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full animate-pulse font-medium">
                    Sincronizando...
                  </span>
                )}
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {currentNombre}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCredentialModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 border border-amber-500/40 transition shadow-sm cursor-pointer min-h-[40px]"
              title="Ver Mi Credencial Corporativa"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Mi Credencial</span>
            </button>

            <button
              onClick={() => setIsClientModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs hidden sm:flex items-center gap-1.5 transition shadow-sm cursor-pointer min-h-[40px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo Cliente</span>
            </button>

            <button
              onClick={() => initializeNewDocument("Cotización")}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer min-h-[40px]"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Cotizar</span>
            </button>

            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-rose-800/60 transition min-h-[40px]"
              title="Cerrar Sesión"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
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

        {/* Navigation Tabs for Desktop */}
        <div className="hidden md:flex max-w-7xl mx-auto px-4 sm:px-6 overflow-x-auto gap-2 border-t border-slate-800/80 py-2 scrollbar-none">
          <button
            onClick={() => {
              setFormData(null);
              setActiveTab("mis-ventas");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "mis-ventas"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Mis Carátulas ({myVentasActivas.length})</span>
          </button>

          <button
            onClick={() => {
              setFormData(null);
              setActiveTab("cotizaciones");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "cotizaciones"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Cotizaciones ({myCotizaciones.length})</span>
          </button>

          <button
            onClick={() => {
              setFormData(null);
              setActiveTab("mis-clientes");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === "mis-clientes"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Mis Clientes Asignados ({myClients.length})</span>
          </button>

          {activeTab === "nueva-operacion" && (
            <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generando {creationMode}</span>
            </div>
          )}
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
                    V
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Portal de Ventas</h3>
                    <p className="text-[11px] text-slate-400">{currentNombre}</p>
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

              {/* Sales Profile Snapshot */}
              <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl space-y-2 shrink-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total en Ventas:</span>
                    <span className="font-mono font-bold text-emerald-400">{formatCurrency(personalStats.totalVentasMonto)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Cotizaciones Activas:</span>
                    <span className="font-mono font-bold text-indigo-300">{personalStats.cotizacionesCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Clientes Asignados:</span>
                    <span className="font-bold text-white">{personalStats.clientsCount}</span>
                  </div>
                </div>

                {/* Actions Shortcut */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsClientModalOpen(true);
                    }}
                    className="p-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300 font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ Cliente</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      initializeNewDocument("Cotización");
                    }}
                    className="p-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>+ Cotizar</span>
                  </button>
                </div>

                {/* Navigation Items List */}
                <div className="space-y-1.5 pt-2">
                  <button
                    onClick={() => {
                      setFormData(null);
                      setActiveTab("mis-ventas");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "mis-ventas" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileCheck className="w-4 h-4 text-emerald-300" />
                      <span>Mis Carátulas ({myVentasActivas.length})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setFormData(null);
                      setActiveTab("cotizaciones");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "cotizaciones" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-indigo-300" />
                      <span>Cotizaciones ({myCotizaciones.length})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => {
                      setFormData(null);
                      setActiveTab("mis-clientes");
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition min-h-[44px] ${
                      activeTab === "mis-clientes" ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-sky-300" />
                      <span>Mis Clientes Asignados ({myClients.length})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>

                  {/* Mi Credencial Corporativa Button in Mobile Drawer */}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setShowCredentialModal(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <span>Mi Credencial Corporativa</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">OFICIAL</span>
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

      {/* Main Body */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 space-y-6 pb-28 md:pb-10">
        {/* Personal Quick Stats Banner (Least Privilege: NO global data) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mis Clientes
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              {personalStats.clientsCount}
            </div>
            <div className="text-[10px] text-indigo-400 mt-0.5">Asignados a mi usuario</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Cotizaciones Activas
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">
              {personalStats.cotizacionesCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {formatCurrency(personalStats.totalCotizacionesMonto)} cotizado
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Carátulas Cerradas
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">
              {personalStats.ventasCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ventas concretadas</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mi Venta Acumulada
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-400 mt-1">
              {formatCurrency(personalStats.totalVentasMonto)}
            </div>
            <div className="text-[10px] text-sky-300 mt-0.5">Exclusivo de mis operaciones</div>
          </div>
        </div>

        {/* TAB 1: MIS VENTAS & CARATULAS */}
        {activeTab === "mis-ventas" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Mis Carátulas de Servicio
                </h2>
                <p className="text-xs text-slate-400">
                  Carátulas activas registradas bajo tu usuario de ventas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => initializeNewDocument("Caratula")}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Crear Carátula</span>
                </button>
              </div>
            </div>

            {/* List */}
            {myVentasActivas.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 p-6">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-300">No tienes carátulas registradas</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Crea una nueva carátula de servicio o convierte una cotización aceptada.
                </p>
                <button
                  onClick={() => initializeNewDocument("Caratula")}
                  className="mt-4 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl"
                >
                  Crear primera carátula
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myVentasActivas.map((caratula) => (
                  <div
                    key={caratula.folio}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
                          {caratula.folio}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          {caratula.estado || "Activo"}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-2 leading-tight">
                        {caratula.nombreCompletoCliente}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Receptor: <span className="text-slate-200">{caratula.nombreCompletoRS}</span>
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Total Venta:</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {formatCurrency(caratula.total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>Periodo:</span>
                          <span>{caratula.inicio} al {caratula.fin}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
                      <button
                        onClick={() => handleOpenCaratulaPreview(caratula)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>Ver Documento</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COTIZACIONES */}
        {activeTab === "cotizaciones" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Generador de Cotizaciones
                </h2>
                <p className="text-xs text-slate-400">
                  Presupuestos y propuestas comerciales emitidas a tus prospectos.
                </p>
              </div>
              <button
                onClick={() => initializeNewDocument("Cotización")}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nueva Cotización</span>
              </button>
            </div>

            {myCotizaciones.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 p-6">
                <Sparkles className="w-10 h-10 text-amber-500/60 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-300">No tienes cotizaciones emitidas</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Genera una cotización formal para enviarla por WhatsApp o PDF a tus clientes.
                </p>
                <button
                  onClick={() => initializeNewDocument("Cotización")}
                  className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl"
                >
                  Generar Cotización
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myCotizaciones.map((quote) => (
                  <div
                    key={quote.folio}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          {quote.folio}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300">
                          Cotización
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-2 leading-tight">
                        {quote.nombreCompletoCliente}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Receptor: <span className="text-slate-200">{quote.nombreCompletoRS || "No especificado"}</span>
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Monto Cotizado:</span>
                          <span className="font-bold text-amber-300 text-sm">
                            {formatCurrency(quote.total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>Validez hasta:</span>
                          <span className="font-medium text-slate-300">
                            {quote.validezCotizacion || "7 días"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2 border-t border-slate-800">
                      <button
                        onClick={() => handleOpenCaratulaPreview(quote)}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ver / Descargar PDF</span>
                      </button>

                      <button
                        onClick={() => handleConvertCotizacionToCaratula(quote)}
                        className="w-full py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Convertir a Venta Cerrada</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MIS CLIENTES ASIGNADOS */}
        {activeTab === "mis-clientes" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Mis Clientes Asignados
                </h2>
                <p className="text-xs text-slate-400">
                  Directorio exclusivo de clientes asignados a tu cartera comercial.
                </p>
              </div>
              <button
                onClick={() => setIsClientModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Registrar Cliente</span>
              </button>
            </div>

            {myClients.length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 p-6">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-300">No tienes clientes en tu cartera</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Registra a tus prospectos y clientes para generarles cotizaciones y carátulas personalizadas.
                </p>
                <button
                  onClick={() => setIsClientModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
                >
                  Registrar Primer Cliente
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClients.map((client) => (
                  <div
                    key={client.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                          {client.id}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Asignado a ti
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white mt-2 leading-tight">
                        {client.nombreCompletoCliente}
                      </h3>

                      <div className="mt-2.5 space-y-1 text-xs text-slate-300">
                        {client.numeroContacto && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span>{client.numeroContacto}</span>
                          </div>
                        )}
                        {client.correo && (
                          <div className="flex items-center gap-1.5 text-slate-400 truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{client.correo}</span>
                          </div>
                        )}
                        {client.nombreCompletoRS && (
                          <div className="text-[11px] text-slate-400 pt-1">
                            Receptor: <strong className="text-slate-200">{client.nombreCompletoRS}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2 border-t border-slate-800">
                      <button
                        onClick={() => handleOpenClientDetail(client)}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ver Ficha</span>
                      </button>

                      <button
                        onClick={() => initializeNewDocument("Cotización", client)}
                        className="py-1.5 px-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition"
                        title="Cotizar a este cliente"
                      >
                        <span>Cotizar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: NUEVA OPERACIÓN (CREAR CARÁTULA O COTIZACIÓN) */}
        {activeTab === "nueva-operacion" && formData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {formData.tipoDocumento === "Cotización" ? "Nueva Cotización" : "Nueva Carátula"}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  Folio: <span className="font-mono text-sky-400">{formData.folio}</span>
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab(formData.tipoDocumento === "Cotización" ? "cotizaciones" : "mis-ventas")}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>

            {feedbackMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  feedbackMsg.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveDocument} className="space-y-6">
              {/* Document Metadata / Type selector */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={(e) => {
                      const newType = e.target.value as "Caratula" | "Cotización";
                      setFormData({
                        ...formData,
                        tipoDocumento: newType,
                        folio: getNextFolio(newType, formData.sucursalId),
                        estado: newType === "Cotización" ? "Cotización" : "Activo",
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cotización">Cotización Formal</option>
                    <option value="Caratula">Carátula de Venta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sucursal Asignada *
                  </label>
                  <select
                    value={formData.sucursalId || ""}
                    onChange={(e) => {
                      const newBranchId = e.target.value;
                      const branchObj = effectiveSucursales.find((s) => s.id === newBranchId);
                      const branchName = branchObj?.nombre || "Cuidarte México";
                      setFormData({
                        ...formData,
                        sucursalId: newBranchId,
                        sucursalNombre: branchName,
                        folio: getNextFolio(formData.tipoDocumento, newBranchId),
                      });
                    }}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {effectiveSucursales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.codigo || resolveSucursalAbbreviation(s)})
                      </option>
                    ))}
                  </select>
                </div>

                {formData.tipoDocumento === "Cotización" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Vigencia de Cotización
                    </label>
                    <input
                      type="date"
                      value={formData.validezCotizacion || ""}
                      onChange={(e) => setFormData({ ...formData, validezCotizacion: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Vincular Cliente Asignado
                  </label>
                  <select
                    value={formData.id}
                    onChange={(e) => handleSelectClientInForm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Seleccionar de mis clientes --</option>
                    {myClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.nombreCompletoCliente}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Client & Receptor Fields */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Datos del Cliente y Receptor de Servicio
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Nombre Completo del Cliente / Familiar Responsable *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombreCompletoCliente}
                      onChange={(e) => setFormData({ ...formData, nombreCompletoCliente: e.target.value })}
                      placeholder="Ej: Laura Morales Hernández"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      value={formData.numeroContacto}
                      onChange={(e) => setFormData({ ...formData, numeroContacto: e.target.value })}
                      placeholder="Ej: 771 123 4567"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Dirección del Servicio
                    </label>
                    <input
                      type="text"
                      value={formData.direccionServicio}
                      onChange={(e) => setFormData({ ...formData, direccionServicio: e.target.value })}
                      placeholder="Calle, Número, Colonia, Ciudad"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Nombre del Receptor del Servicio (Paciente)
                    </label>
                    <input
                      type="text"
                      value={formData.nombreCompletoRS}
                      onChange={(e) => setFormData({ ...formData, nombreCompletoRS: e.target.value })}
                      placeholder="Ej: Don Roberto Morales"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Edad del Paciente
                    </label>
                    <input
                      type="text"
                      value={formData.edad}
                      onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                      placeholder="Ej: 78 años"
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Diagnóstico y Cuidados Solicitados
                    </label>
                    <textarea
                      rows={2}
                      value={formData.diagnostico}
                      onChange={(e) => setFormData({ ...formData, diagnostico: e.target.value })}
                      placeholder="Diagnóstico médico, indicaciones especiales..."
                      className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Service Line Items */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Servicios Cotizados / Contratados
                </h3>

                <div className="space-y-2.5">
                  {formData.servicios.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <div className="col-span-6">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Servicio #{idx + 1}</label>
                        <select
                          value={line.servicio}
                          onChange={(e) => handleServiceChange(idx, "servicio", e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 text-white p-1.5 rounded-lg text-xs outline-none"
                        >
                          <option value="">-- Seleccionar Servicio del Catálogo --</option>
                          {services.map((srv) => (
                            <option key={srv.id} value={srv.nombreServicio}>
                              {srv.nombreServicio} ({formatCurrency(srv.precio)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Cant.</label>
                        <input
                          type="number"
                          min="0"
                          value={line.cantidad}
                          onChange={(e) => handleServiceChange(idx, "cantidad", parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 text-white p-1.5 rounded-lg text-xs outline-none text-center"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Precio Unit.</label>
                        <input
                          type="number"
                          min="0"
                          value={line.precioU}
                          onChange={(e) => handleServiceChange(idx, "precioU", parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 text-white p-1.5 rounded-lg text-xs outline-none text-right"
                        />
                      </div>

                      <div className="col-span-2 text-right">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Total</label>
                        <div className="font-bold text-white text-xs pt-1">
                          {formatCurrency(line.precioTot)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Summary */}
                <div className="flex flex-col sm:flex-row items-end justify-between pt-3 border-t border-slate-800 gap-3">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Descuento Especial ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.descuento || 0}
                      onChange={(e) => {
                        const desc = parseFloat(e.target.value) || 0;
                        const sub = formData.subtotal;
                        const tot = Math.max(0, sub - desc);
                        setFormData({
                          ...formData,
                          descuento: desc,
                          total: tot,
                          pendiente: Math.max(0, tot - (formData.pagado || 0)),
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-white p-1.5 rounded-lg text-xs outline-none"
                    />
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-xs text-slate-400">
                      Subtotal: <span className="font-semibold text-slate-200">{formatCurrency(formData.subtotal)}</span>
                    </div>
                    <div className="text-base font-bold text-emerald-400">
                      Total a Pagar: <span className="text-xl font-black">{formatCurrency(formData.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Detalles / Especificaciones del Servicio */}
                <div className="pt-3 border-t border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                    Detalles o Especificaciones del Servicio
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Escriba aquí los detalles del servicio, especificaciones de las propuestas, turnos u observaciones particulares..."
                    value={formData.detallesServicio || ""}
                    onChange={(e) => setFormData({ ...formData, detallesServicio: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Seccion Carátula: Abono y Período */}
              {formData.tipoDocumento === "Caratula" && (
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Condiciones, Fechas y Abono de Carátula
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Monto Pagado / Abonado ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.pagado || 0}
                        onChange={(e) => {
                          const pag = parseFloat(e.target.value) || 0;
                          const pend = Math.max(0, formData.total - pag);
                          setFormData({
                            ...formData,
                            pagado: pag,
                            pendiente: pend,
                          });
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Saldo Pendiente de Pago
                      </label>
                      <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-rose-400">
                        {formatCurrency(formData.pendiente >= 0 ? formData.pendiente : 0)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Inicio de Servicio
                      </label>
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY HH:MM"
                        value={formData.inicio || ""}
                        onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Fin de Servicio
                      </label>
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY HH:MM"
                        value={formData.fin || ""}
                        onChange={(e) => setFormData({ ...formData, fin: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Enlace / Nota de Contrato
                      </label>
                      <input
                        type="text"
                        value={formData.contratoLink || "www.cuidartemexico.com/contrato"}
                        onChange={(e) => setFormData({ ...formData, contratoLink: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                        Enlace / Nota de Términos y Condiciones (T&C)
                      </label>
                      <input
                        type="text"
                        value={formData.tycLink || "www.cuidartemexico.com/terminos-y-condiciones"}
                        onChange={(e) => setFormData({ ...formData, tycLink: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notas o Condiciones Adicionales de la Cotización o Carátula */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Notas o Condiciones Adicionales {formData.tipoDocumento === "Cotización" ? "de la Cotización" : "del Servicio / Carátula"}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Opcional</span>
                </div>
                <textarea
                  rows={4}
                  value={formData.detallesCotizacionText || ""}
                  onChange={(e) =>
                    setFormData((prev) => (prev ? { ...prev, detallesCotizacionText: e.target.value } : null))
                  }
                  placeholder="Escriba condiciones de validez, especificaciones del personal, turnos o notas adicionales..."
                  className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-xl text-xs font-mono leading-relaxed outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(formData.tipoDocumento === "Cotización" ? "cotizaciones" : "mis-ventas")}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingDoc}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-indigo-600/30 disabled:opacity-60 cursor-pointer"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{isSavingDoc ? "Guardando..." : `Guardar ${formData.tipoDocumento}`}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Modal: Client Registration */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Registrar Nuevo Cliente</h3>
              </div>
              <button
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewClient} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre Completo del Cliente / Familiar *
                </label>
                <input
                  type="text"
                  required
                  value={newClientNombre}
                  onChange={(e) => setNewClientNombre(e.target.value)}
                  placeholder="Ej: Lic. Maricela Gómez"
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={newClientTelefono}
                    onChange={(e) => setNewClientTelefono(e.target.value)}
                    placeholder="771 000 0000"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={newClientCorreo}
                    onChange={(e) => setNewClientCorreo(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dirección del Servicio</label>
                <input
                  type="text"
                  value={newClientDireccion}
                  onChange={(e) => setNewClientDireccion(e.target.value)}
                  placeholder="Calle, Colonia, Pachuca Hgo."
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Paciente / Receptor</label>
                  <input
                    type="text"
                    value={newClientReceptor}
                    onChange={(e) => setNewClientReceptor(e.target.value)}
                    placeholder="Nombre del paciente"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Edad</label>
                  <input
                    type="text"
                    value={newClientEdad}
                    onChange={(e) => setNewClientEdad(e.target.value)}
                    placeholder="Ej: 75 años"
                    className="w-full bg-slate-800 border border-slate-700 text-white p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Diagnóstico / Cuidados</label>
                <textarea
                  rows={2}
                  value={newClientDiagnostico}
                  onChange={(e) => setNewClientDiagnostico(e.target.value)}
                  placeholder="Detalles médicos o cuidados requeridos..."
                  className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingClient}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{isSavingClient ? "Registrando..." : "Guardar Cliente"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Document Preview & PDF Export */}
      {selectedCaratulaPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-4 sm:p-6 space-y-4 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300">
                  {selectedCaratulaPreview.folio}
                </span>
                <h3 className="font-bold text-white text-sm sm:text-base">
                  {selectedCaratulaPreview.tipoDocumento === "Cotización" ? "Cotización Formal" : "Carátula de Servicio"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaratulaPreview(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Render for Print */}
            <div className="overflow-x-auto bg-slate-100 p-2 sm:p-4 rounded-xl border border-slate-700 flex justify-center">
              <div ref={documentRef} className="w-full max-w-2xl bg-white text-slate-900 shadow-lg rounded-xl overflow-hidden">
                <CaratulaDocument caratula={selectedCaratulaPreview} />
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-[11px] text-slate-400">
                Emitida por: <strong className="text-slate-200">{selectedCaratulaPreview.vendedorNombre || selectedCaratulaPreview.creadoPor}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printCaratulaDocument()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadCaratulaPDF("caratula-official-document", `Caratula_${selectedCaratulaPreview.folio}.pdf`)}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Client Detail Preview */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                  {selectedClientDetail.id}
                </span>
                <h3 className="font-bold text-white text-sm">Ficha de Cliente</h3>
              </div>
              <button
                onClick={() => setSelectedClientDetail(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente / Responsable</span>
                <span className="text-white font-bold text-sm">{selectedClientDetail.nombreCompletoCliente}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Teléfono</span>
                  <span className="text-slate-200">{selectedClientDetail.numeroContacto || "No registrado"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Correo</span>
                  <span className="text-slate-200">{selectedClientDetail.correo || "No registrado"}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Dirección</span>
                <span className="text-slate-200">{selectedClientDetail.direccionServicio || "No especificada"}</span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-indigo-400 block text-[10px] uppercase font-bold">Receptor del Servicio</span>
                <div className="text-white font-bold">{selectedClientDetail.nombreCompletoRS || selectedClientDetail.nombreCompletoCliente}</div>
                {selectedClientDetail.edad && <div className="text-slate-400 text-[11px]">Edad: {selectedClientDetail.edad}</div>}
                {selectedClientDetail.diagnostico && (
                  <div className="text-slate-300 text-[11px] mt-1 pt-1 border-t border-slate-800">
                    <strong className="text-slate-400">Diagnóstico:</strong> {selectedClientDetail.diagnostico}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedClientDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MI CREDENCIAL CORPORATIVA MODAL */}
      {showCredentialModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl relative flex flex-col items-center max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setShowCredentialModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold font-mono uppercase tracking-wider mb-1.5 border border-amber-500/30">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Credencial Corporativa Oficial</span>
              </div>
              <h2 className="text-lg font-black text-white">
                Identificación de Ventas y Comercial
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Identificación oficial corporativa para representación institucional y atención a clientes de {userSession?.sucursalNombre || "Cuidarte México"}.
              </p>
            </div>

            {/* Render Card */}
            <div className="my-2 scale-95 sm:scale-100 origin-top flex justify-center">
              <StaffCredentialCard staff={myStaffMember} showControls={true} />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 w-full flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Titular: <strong className="text-white">{myStaffMember.nombre} {myStaffMember.apellidos}</strong>
              </div>
              <button
                onClick={() => setShowCredentialModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                Listo / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer legal y corporativo */}
      <Footer className="mt-12 mb-16 md:mb-0" userType="personal" />

      {/* FIXED MOBILE BOTTOM ERGONOMIC TOUCH BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1 flex items-center justify-around shadow-2xl safe-bottom print:hidden">
        <button
          onClick={() => {
            setFormData(null);
            setActiveTab("mis-ventas");
          }}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "mis-ventas" ? "text-indigo-400 bg-indigo-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileCheck className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Carátulas</span>
        </button>

        <button
          onClick={() => {
            setFormData(null);
            setActiveTab("cotizaciones");
          }}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "cotizaciones" ? "text-indigo-400 bg-indigo-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5 text-indigo-400" />
          <span className="text-[10px]">Cotizaciones</span>
        </button>

        <button
          onClick={() => {
            setFormData(null);
            setActiveTab("mis-clientes");
          }}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "mis-clientes" ? "text-indigo-400 bg-indigo-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-5 h-5 mb-0.5 text-sky-400" />
          <span className="text-[10px]">Clientes</span>
        </button>

        <button
          onClick={() => initializeNewDocument("Cotización")}
          className="flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] text-emerald-400 hover:text-emerald-300"
        >
          <PlusCircle className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px] font-bold">+ Cotizar</span>
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
