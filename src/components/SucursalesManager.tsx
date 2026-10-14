import React, { useState, useMemo } from "react";
import {
  Building2,
  PlusCircle,
  Search,
  MapPin,
  Phone,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Edit2,
  Lock,
  ArrowRight,
  Eye,
  X,
  Key,
  Landmark,
  Sparkles,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  Sucursal,
  Client,
  Caratula,
  AbonoTicket,
  SystemUser,
  UserSession,
} from "../types";
import { generateSecureRandomPassword } from "../utils/passwordGenerator";
import { logAuditEvent } from "../services/auditService";

interface SucursalesManagerProps {
  sucursales: Sucursal[];
  clients: Client[];
  caratulas: Caratula[];
  abonos: AbonoTicket[];
  systemUsers: SystemUser[];
  currentUserSession?: UserSession | null;
  onSaveSucursal: (sucursal: Sucursal) => Promise<void>;
  onDeleteSucursal?: (id: string) => Promise<void>;
  onSaveSystemUser?: (user: SystemUser) => Promise<void>;
  onSelectBranchContext?: (sucursalId: string) => void;
  onNavigateToTab?: (tab: any) => void;
}

export const SucursalesManager: React.FC<SucursalesManagerProps> = ({
  sucursales,
  clients,
  caratulas,
  abonos,
  systemUsers,
  currentUserSession,
  onSaveSucursal,
  onDeleteSucursal,
  onSaveSystemUser,
  onSelectBranchContext,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<"all" | "activas" | "inactivas">("all");
  const [showModal, setShowModal] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);

  // Modal Form State
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [estado, setEstado] = useState("Hidalgo");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [colorBadge, setColorBadge] = useState<string>("sky");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [activa, setActiva] = useState(true);

  // Admin Assignment Mode: "existing" or "new"
  const [adminMode, setAdminMode] = useState<"existing" | "new">("new");
  const [selectedAdminUx, setSelectedAdminUx] = useState("");

  // New Admin Form State
  const [newAdminNombre, setNewAdminNombre] = useState("");
  const [newAdminUx, setNewAdminUx] = useState("");
  const [newAdminCx, setNewAdminCx] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPhone, setNewAdminPhone] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Available existing admins for selection
  const existingAdmins = useMemo(() => {
    return systemUsers.filter((u) => u.role === "admin" || u.isSuperAdmin);
  }, [systemUsers]);

  // Filtered branches list
  const filteredSucursales = useMemo(() => {
    return sucursales.filter((s) => {
      const matchSearch =
        !searchTerm ||
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.ciudad.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.administradorNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.administradorUx.toLowerCase().includes(searchTerm.toLowerCase());

      const matchEstado =
        filterEstado === "all" ||
        (filterEstado === "activas" && s.activa) ||
        (filterEstado === "inactivas" && !s.activa);

      return matchSearch && matchEstado;
    });
  }, [sucursales, searchTerm, filterEstado]);

  // Calculate live stats for each branch
  const getBranchStats = (branchId: string) => {
    const branchClients = clients.filter((c) => (c.sucursalId || "pachuca") === branchId);
    const branchCaratulas = caratulas.filter((c) => (c.sucursalId || "pachuca") === branchId);
    const branchAbonos = abonos.filter((a) => (a.sucursalId || "pachuca") === branchId);

    const facturadoTotal = branchCaratulas
      .filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización")
      .reduce((sum, c) => sum + (c.total || 0), 0);

    const cobradoTotal = branchAbonos
      .filter((a) => a.estado !== "Cancelado")
      .reduce((sum, a) => sum + (a.montoAbonado || 0), 0);

    const saldoPendiente = Math.max(0, facturadoTotal - cobradoTotal);

    return {
      totalClientes: branchClients.length,
      totalCaratulas: branchCaratulas.length,
      caratulasActivas: branchCaratulas.filter((c) => c.estado === "Activo" && c.tipoDocumento !== "Cotización").length,
      facturadoTotal,
      cobradoTotal,
      saldoPendiente,
    };
  };

  const handleOpenCreateModal = () => {
    setEditingSucursal(null);
    setNombre("");
    setCodigo("");
    setCiudad("");
    setEstado("Hidalgo");
    setDireccion("");
    setTelefono("");
    setEmail("");
    setColorBadge("sky");
    setNotas("");
    setActiva(true);
    setLogoUrl("");
    setAdminMode("new");
    setSelectedAdminUx("");
    setNewAdminNombre("");
    setNewAdminUx("");
    setNewAdminCx(generateSecureRandomPassword(10));
    setNewAdminEmail("");
    setNewAdminPhone("");
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (s: Sucursal) => {
    setEditingSucursal(s);
    setNombre(s.nombre);
    setCodigo(s.codigo);
    setCiudad(s.ciudad);
    setEstado(s.estado);
    setDireccion(s.direccion || "");
    setTelefono(s.telefono || "");
    setEmail(s.email || "");
    setColorBadge(s.colorBadge || "sky");
    setLogoUrl(s.logoUrl || "");
    setNotas(s.notas || "");
    setActiva(s.activa);
    setAdminMode("existing");
    setSelectedAdminUx(s.administradorUx);
    setNewAdminNombre("");
    setNewAdminUx("");
    setNewAdminCx("");
    setNewAdminEmail("");
    setNewAdminPhone("");
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNombre = nombre.trim();
    const cleanCiudad = ciudad.trim();
    const cleanEstado = estado.trim();
    let cleanCodigo = codigo.trim().toUpperCase();

    if (!cleanNombre) {
      setFormError("Por favor ingresa el nombre de la sucursal (ej. Cuidarte CDMX).");
      return;
    }

    if (!cleanCiudad) {
      setFormError("Por favor ingresa la ciudad de la sucursal.");
      return;
    }

    if (!cleanCodigo) {
      // Auto generate code from city or name
      cleanCodigo = cleanCiudad.slice(0, 3).toUpperCase();
    }

    // Branch ID
    const branchId = editingSucursal
      ? editingSucursal.id
      : cleanNombre
          .toLowerCase()
          .replace(/cuidarte/g, "")
          .replace(/[^a-z0-9]/g, "") || `suc-${Date.now()}`;

    // Admin resolution
    let finalAdminUx = "";
    let finalAdminNombre = "";
    let finalAdminEmail = "";
    let finalAdminPhone = "";

    if (adminMode === "existing") {
      if (!selectedAdminUx) {
        setFormError("Por favor selecciona un administrador existente para esta sucursal.");
        return;
      }
      const existingUser = systemUsers.find((u) => u.ux.trim().toLowerCase() === selectedAdminUx.trim().toLowerCase());
      finalAdminUx = existingUser?.ux || selectedAdminUx;
      finalAdminNombre = existingUser?.nombre || existingUser?.ux || selectedAdminUx;

      // Update existing user with branch assignment
      if (existingUser && onSaveSystemUser) {
        await onSaveSystemUser({
          ...existingUser,
          sucursalId: branchId,
          sucursalNombre: cleanNombre,
          isGeneralAdmin: false,
        });
      }
    } else {
      // New Admin
      const cAdminNombre = newAdminNombre.trim();
      const cAdminUx = newAdminUx.trim();
      const cAdminCx = newAdminCx.trim();

      if (!cAdminNombre || !cAdminUx || !cAdminCx) {
        setFormError("Por favor completa los campos del nuevo administrador: Nombre, Usuario y Contraseña.");
        return;
      }

      // Check if username already exists
      const usernameExists = systemUsers.some(
        (u) => u.ux && u.ux.trim().toLowerCase() === cAdminUx.toLowerCase()
      );
      if (usernameExists) {
        setFormError(`El usuario @${cAdminUx} ya existe en el sistema. Elige otro usuario único o selecciona 'Asignar Administrador Existente'.`);
        return;
      }

      finalAdminUx = cAdminUx;
      finalAdminNombre = cAdminNombre;
      finalAdminEmail = newAdminEmail.trim();
      finalAdminPhone = newAdminPhone.trim();

      // Create new system user for branch administrator
      if (onSaveSystemUser) {
        const newUser: SystemUser = {
          id: `usr-admin-${branchId}-${Date.now().toString().slice(-4)}`,
          ux: cAdminUx,
          cx: cAdminCx,
          nombre: cAdminNombre,
          role: "admin",
          isSuperAdmin: false,
          isGeneralAdmin: false,
          sucursalId: branchId,
          sucursalNombre: cleanNombre,
          estatus: "Activo",
          timestamp: new Date().toISOString(),
        };
        await onSaveSystemUser(newUser);
      }
    }

    setIsSaving(true);
    try {
      const sucursalToSave: Sucursal = {
        id: branchId,
        nombre: cleanNombre,
        codigo: cleanCodigo,
        ciudad: cleanCiudad,
        estado: cleanEstado,
        direccion: direccion.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        administradorUx: finalAdminUx,
        administradorNombre: finalAdminNombre,
        administradorEmail: finalAdminEmail || undefined,
        administradorTelefono: finalAdminPhone || undefined,
        activa,
        fechaCreacion: editingSucursal ? editingSucursal.fechaCreacion : new Date().toISOString(),
        colorBadge,
        logoUrl: logoUrl.trim() || undefined,
        notas: notas.trim() || undefined,
      };

      await onSaveSucursal(sucursalToSave);

      logAuditEvent({
        tipoAccion: editingSucursal ? "MODIFICAR_SUCURSAL" : "CREAR_SUCURSAL",
        usuarioUx: currentUserSession?.username || "admin",
        usuarioNombre: currentUserSession?.nombre,
        rol: "admin",
        descripcion: `${editingSucursal ? "Modificación de sucursal" : "Creación de nueva sucursal"} ${cleanNombre} (Admin asignado: ${finalAdminNombre} @${finalAdminUx})`,
        sucursalId: branchId,
        sucursalNombre: cleanNombre,
      }).catch(console.error);

      setShowModal(false);
    } catch (err: any) {
      setFormError(err?.message || "Ocurrió un error al guardar la sucursal.");
    } finally {
      setIsSaving(false);
    }
  };

  const getBadgeBg = (color?: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
      case "indigo":
        return "bg-indigo-500/10 text-indigo-700 border-indigo-500/30";
      case "amber":
        return "bg-amber-500/10 text-amber-700 border-amber-500/30";
      case "purple":
        return "bg-purple-500/10 text-purple-700 border-purple-500/30";
      case "rose":
        return "bg-rose-500/10 text-rose-700 border-rose-500/30";
      default:
        return "bg-sky-500/10 text-sky-700 border-sky-500/30";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-sky-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                Cuidarte México — Corporativo Matriz
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium">
                Gestión Multi-Sucursal
              </span>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-medium">
                Administrador General
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-sky-400" />
              Gestión de Sucursales y Delegaciones
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Como <strong>Administrador General de Cuidarte México</strong>, tienes control total para supervisar todas las sucursales, crear nuevas delegaciones y designar administradores locales con acceso restringido a su territorio.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 hover:shadow-sky-500/25"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Sucursal</span>
            </button>
          </div>
        </div>

        {/* Global summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Sucursales Registradas
            </span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">
              {sucursales.length}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">
              {sucursales.filter((s) => s.activa).length} operando activamente
            </span>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Clientes en Red Nacional
            </span>
            <span className="text-xl font-extrabold text-sky-400 mt-0.5 block">
              {clients.length}
            </span>
            <span className="text-[10px] text-slate-400">Pacientes asignados por sede</span>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Carátulas Activas Red
            </span>
            <span className="text-xl font-extrabold text-emerald-400 mt-0.5 block">
              {caratulas.filter((c) => c.estado === "Activo" && c.tipoDocumento !== "Cotización").length}
            </span>
            <span className="text-[10px] text-slate-400">Servicios en curso</span>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Administradores Locales
            </span>
            <span className="text-xl font-extrabold text-amber-400 mt-0.5 block">
              {new Set(sucursales.map((s) => s.administradorUx)).size}
            </span>
            <span className="text-[10px] text-slate-400">Directores de sucursal</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por sucursal, ciudad, estado, código o administrador..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterEstado("all")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterEstado === "all" ? "bg-white text-slate-900 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas ({sucursales.length})
            </button>
            <button
              onClick={() => setFilterEstado("activas")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterEstado === "activas" ? "bg-white text-emerald-700 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Activas ({sucursales.filter((s) => s.activa).length})
            </button>
            <button
              onClick={() => setFilterEstado("inactivas")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterEstado === "inactivas" ? "bg-white text-rose-700 shadow-sm font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Inactivas ({sucursales.filter((s) => !s.activa).length})
            </button>
          </div>
        </div>
      </div>

      {/* Branches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSucursales.map((branch) => {
          const stats = getBranchStats(branch.id);
          const isPachuca = branch.id === "pachuca";

          return (
            <div
              key={branch.id}
              className={`bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                branch.activa
                  ? "border-slate-200 hover:border-sky-300"
                  : "border-slate-200 opacity-70 bg-slate-50"
              }`}
            >
              {/* Card Header */}
              <div className="p-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {branch.logoUrl ? (
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center p-1 border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0">
                        <img src={branch.logoUrl} alt={branch.nombre} className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm border shadow-sm ${getBadgeBg(
                          branch.colorBadge
                        )}`}
                      >
                        {branch.codigo || branch.ciudad.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {branch.nombre}
                        </h3>
                        {isPachuca && (
                          <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[10px] font-extrabold border border-sky-300">
                            Matriz Regional
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {branch.ciudad}, {branch.estado}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      branch.activa
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {branch.activa ? "Activa" : "Inactiva"}
                  </span>
                </div>

                {/* Administrator In Charge */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-sky-600" />
                    Administrador Asignado
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {branch.administradorNombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {branch.administradorNombre}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          @{branch.administradorUx}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenEditModal(branch)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors shrink-0"
                      title="Cambiar o reasignar administrador"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                  {branch.telefono && (
                    <div className="flex items-center gap-1.5 truncate" title={branch.telefono}>
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{branch.telefono}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-1.5 truncate" title={branch.email}>
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Metrics */}
              <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Clientes
                    </span>
                    <span className="text-base font-extrabold text-slate-800 mt-0.5 block">
                      {stats.totalClientes}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Carátulas
                    </span>
                    <span className="text-base font-extrabold text-sky-700 mt-0.5 block">
                      {stats.caratulasActivas}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded-xl border border-slate-200/70">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Cobrado
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 mt-1 block truncate">
                      ${stats.cobradoTotal.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Quick Context Switch / Filter Action */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (onSelectBranchContext) {
                        onSelectBranchContext(branch.id);
                      }
                      if (onNavigateToTab) {
                        onNavigateToTab("historial");
                      }
                    }}
                    className="flex-1 py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title={`Filtrar todo el sistema para ver solo datos de ${branch.nombre}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Carátulas de Sucursal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(branch)}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-all"
                    title="Editar información de sucursal"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: CREAR / EDITAR SUCURSAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    {editingSucursal ? `Editar Sucursal: ${editingSucursal.nombre}` : "Nueva Sucursal — Cuidarte México"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asigna la ubicación geográfica y el Administrador responsable de esta sucursal.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Sección 1: Datos de la Sucursal */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-sky-600" />
                  1. Información de la Delegación / Sucursal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">Nombre de la Sucursal *</label>
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Cuidarte CDMX, Cuidarte Querétaro"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Abreviación para Folios *</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                      placeholder="Ej. PACH, CDMX"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none uppercase"
                    />
                    <p className="text-[10px] text-slate-500">
                      Nomenclatura: <strong className="text-sky-700 font-mono">C{codigo || "PACH"}{String(new Date().getMonth() + 1).padStart(2, "0")}{String(new Date().getFullYear()).slice(-2)}A00</strong>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Ciudad *</label>
                    <input
                      type="text"
                      required
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      placeholder="Ej. Ciudad de México, Querétaro, Pachuca"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Estado de la República *</label>
                    <input
                      type="text"
                      required
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      placeholder="Ej. Hidalgo, CDMX, Querétaro, Jalisco"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Dirección Operativa</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, número, colonia, código postal"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Teléfono Oficial</label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej. 771-123-4567"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Correo Electrónico Oficial</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Ej. sucursal.cdmx@cuidarte.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Color Distintivo del Badge</label>
                    <select
                      value={colorBadge}
                      onChange={(e) => setColorBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                      <option value="sky">Azul Cielo (Pachuca / Corporativo)</option>
                      <option value="emerald">Verde Esmeralda</option>
                      <option value="indigo">Índigo / Azul Profundo</option>
                      <option value="amber">Ámbar / Dorado</option>
                      <option value="purple">Púrpura / Violeta</option>
                      <option value="rose">Rosa / Carmesí</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="sucursalActivaCheck"
                      checked={activa}
                      onChange={(e) => setActiva(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                    />
                    <label htmlFor="sucursalActivaCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                      Sucursal Operativa y Activa
                    </label>
                  </div>
                </div>

                {/* Logotipo Distintivo de la Sucursal */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                      Logotipo / Isotipo de la Sucursal (Opcional)
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold underline"
                      >
                        Restablecer a logo oficial predeterminado
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Por defecto, se utiliza el logotipo oficial de Cuidarte con el nombre de esta sucursal ({nombre || "Sucursal"}). Si esta sucursal tiene un logo particular, puedes subir la imagen o especificar una URL.
                  </p>
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                        <img src={logoUrl} alt="Logo sucursal" className="w-full h-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-sky-50 border border-sky-200 flex flex-col items-center justify-center shrink-0 text-sky-700 font-extrabold text-[11px]">
                        <span>Oficial</span>
                      </div>
                    )}
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5">
                          <span>Subir Imagen de Logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  if (typeof reader.result === "string") {
                                    setLogoUrl(reader.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <span className="text-[10px] text-slate-400">o pega la URL:</span>
                      </div>
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://... o data:image/png;base64,..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2: Asignación Obligatoria de Administrador */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                    2. Asignación de Administrador de Sucursal *
                  </h4>

                  {/* Mode switch */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setAdminMode("existing")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        adminMode === "existing"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Usuario Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminMode("new")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        adminMode === "new"
                          ? "bg-white text-sky-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      Crear Nuevo Administrador
                    </button>
                  </div>
                </div>

                {adminMode === "existing" ? (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      Seleccionar Administrador de la lista de usuarios:
                    </label>
                    <select
                      value={selectedAdminUx}
                      onChange={(e) => setSelectedAdminUx(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                      <option value="">-- Selecciona un usuario administrador --</option>
                      {existingAdmins.map((adm) => (
                        <option key={adm.id} value={adm.ux}>
                          {adm.nombre || adm.ux} (@{adm.ux}) {adm.isSuperAdmin ? "— Super Admin" : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Este usuario tendrá todas las funciones administrativas pero filtradas estrictamente a los datos de esta sucursal.
                    </p>
                  </div>
                ) : (
                  <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-950">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>Crear Cuenta de Acceso para el Director de Sucursal</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Nombre Completo del Administrador *</label>
                        <input
                          type="text"
                          required={adminMode === "new"}
                          value={newAdminNombre}
                          onChange={(e) => setNewAdminNombre(e.target.value)}
                          placeholder="Ej. Lic. Carlos Mendoza Sánchez"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Usuario de Acceso (Login UX) *</label>
                        <input
                          type="text"
                          required={adminMode === "new"}
                          value={newAdminUx}
                          onChange={(e) => setNewAdminUx(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                          placeholder="Ej. admin_cdmx, director_qro"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>Contraseña (CX) *</span>
                          <button
                            type="button"
                            onClick={() => setNewAdminCx(generateSecureRandomPassword(10))}
                            className="text-[10px] text-sky-600 hover:underline"
                          >
                            Generar
                          </button>
                        </label>
                        <input
                          type="text"
                          required={adminMode === "new"}
                          value={newAdminCx}
                          onChange={(e) => setNewAdminCx(e.target.value)}
                          placeholder="Contraseña"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-700">Correo Personal</label>
                        <input
                          type="email"
                          value={newAdminEmail}
                          onChange={(e) => setNewAdminEmail(e.target.value)}
                          placeholder="admin@correo.com"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-700">Teléfono</label>
                        <input
                          type="text"
                          value={newAdminPhone}
                          onChange={(e) => setNewAdminPhone(e.target.value)}
                          placeholder="Teléfono móvil"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de acción del Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? "Guardando..." : editingSucursal ? "Actualizar Sucursal" : "Crear y Asignar Sucursal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
