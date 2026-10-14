import React, { useState } from "react";
import { SystemUser, Client, StaffMember, UserSession, UserRole, GuardiaShiftRecord, Sucursal } from "../types";
import { AuditLogViewer } from "./AuditLogViewer";
import { generateSecureRandomPassword } from "../utils/passwordGenerator";
import { logAuditEvent } from "../services/auditService";
import { deduplicateSystemUsers } from "../utils/dataIntegrity";
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Edit,
  Lock,
  Key,
  UserCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Shield,
  ShieldAlert,
  UserX,
  RefreshCw,
  LogOut,
  Power,
  X,
  Crown,
  Tag,
  Headphones,
  Activity,
  Building2,
} from "lucide-react";

interface UsersManagerProps {
  systemUsers: SystemUser[];
  clients: Client[];
  staffMembers: StaffMember[];
  sucursales?: Sucursal[];
  guardiaRecords?: GuardiaShiftRecord[];
  currentUserSession?: UserSession | null;
  onSaveUser: (user: SystemUser) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onRevokeSession?: (ux: string, nurseId?: string) => Promise<{ success: boolean; message: string }> | Promise<void> | void;
  onRefresh?: () => void;
}

export const UsersManager: React.FC<UsersManagerProps> = ({
  systemUsers,
  clients,
  staffMembers,
  sucursales = [],
  guardiaRecords = [],
  currentUserSession,
  onSaveUser,
  onDeleteUser,
  onRevokeSession,
  onRefresh,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"usuarios" | "auditoria">("usuarios");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Form State
  const [ux, setUx] = useState("");
  const [cx, setCx] = useState("");
  const [nombre, setNombre] = useState("");
  const [role, setRole] = useState<UserRole>("admin");
  const [adminScope, setAdminScope] = useState<"general" | "sucursal">("general");
  const [selectedAdminSucursalId, setSelectedAdminSucursalId] = useState<string>("pachuca");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedNurseId, setSelectedNurseId] = useState("");
  const [estatus, setEstatus] = useState<"Activo" | "Inactivo">("Activo");
  const [showFormPassword, setShowFormPassword] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUx("");
    setCx(generateSecureRandomPassword(10));
    setNombre("");
    setRole("admin");
    setAdminScope("general");
    setSelectedAdminSucursalId(sucursales[0]?.id || "pachuca");
    setSelectedClientId("");
    setSelectedNurseId("");
    setEstatus("Activo");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: SystemUser) => {
    setEditingUser(user);
    setUx(user.ux);
    setCx(user.cx);
    setNombre(user.nombre);
    setRole(user.role);
    const isGen = user.isGeneralAdmin || user.isSuperAdmin || !user.sucursalId;
    setAdminScope(isGen ? "general" : "sucursal");
    setSelectedAdminSucursalId(user.sucursalId || "pachuca");
    setSelectedClientId(user.clientId || "");
    setSelectedNurseId(user.nurseId || "");
    setEstatus(user.estatus || "Activo");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const generateRandomPassword = () => {
    return generateSecureRandomPassword(10);
  };

  const handleClientSelect = (cId: string) => {
    setSelectedClientId(cId);
    if (cId) {
      const found = clients.find((c) => c.id === cId);
      if (found) {
        setNombre(found.nombreCompletoCliente);
        if (!ux) setUx(cId);
      }
    }
  };

  const handleStaffSelect = (sId: string) => {
    setSelectedNurseId(sId);
    if (sId) {
      const found = staffMembers.find((s) => s.id === sId || s.noSocio === sId);
      if (found) {
        setNombre(`${found.nombre} ${found.apellidos}`);
        if (!ux) setUx(`SOCP-${found.noSocio || sId}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!ux.trim()) {
      setErrorMsg("El nombre de usuario (UX) es obligatorio.");
      return;
    }
    if (!cx.trim()) {
      setErrorMsg("La contraseña (CX) es obligatoria.");
      return;
    }

    const cleanUx = ux.trim();
    const isSuperAdmin =
      editingUser?.isSuperAdmin ||
      cleanUx.toLowerCase() === "nestor moedano" ||
      editingUser?.id === "usr-superadmin-nestor";

    // Duplicate check for username across all system users
    const existsUx = systemUsers.some(
      (u) =>
        u.ux.trim().toLowerCase() === cleanUx.toLowerCase() &&
        (!editingUser || u.id !== editingUser.id)
    );
    if (existsUx) {
      setErrorMsg(`El nombre de usuario / folio "${cleanUx}" ya existe registrado para otra cuenta.`);
      return;
    }

    // Duplicate check for client mapping
    if (role === "client" && selectedClientId) {
      const clientUserExists = systemUsers.some(
        (u) =>
          u.role === "client" &&
          (u.clientId || "").trim().toUpperCase() === selectedClientId.trim().toUpperCase() &&
          (!editingUser || u.id !== editingUser.id)
      );
      if (clientUserExists) {
        setErrorMsg(`El cliente "${selectedClientId}" ya tiene un usuario de acceso asignado.`);
        return;
      }
    }

    // Duplicate check for nurse / socio mapping
    if (role === "nurse" && selectedNurseId) {
      const nurseUserExists = systemUsers.some(
        (u) =>
          u.role === "nurse" &&
          (u.nurseId || "").trim().toUpperCase() === selectedNurseId.trim().toUpperCase() &&
          (!editingUser || u.id !== editingUser.id)
      );
      if (nurseUserExists) {
        setErrorMsg(`El personal con folio "${selectedNurseId}" ya tiene un usuario de acceso asignado.`);
        return;
      }
    }

    const isGeneralAdmin =
      role === "admin"
        ? isSuperAdmin || adminScope === "general"
        : undefined;

    const assignedSucursalId =
      role === "admin" && !isGeneralAdmin
        ? selectedAdminSucursalId
        : undefined;

    const assignedSucursalNombre =
      assignedSucursalId
        ? sucursales.find((s) => s.id === assignedSucursalId)?.nombre || "Cuidarte Pachuca"
        : undefined;

    const isNew = !editingUser;
    const userToSave: SystemUser = {
      id: editingUser ? editingUser.id : `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ux: cleanUx,
      cx: cx.trim(),
      nombre: nombre.trim() || cleanUx,
      role,
      isSuperAdmin: isSuperAdmin ? true : undefined,
      isGeneralAdmin,
      sucursalId: assignedSucursalId,
      sucursalNombre: assignedSucursalNombre,
      clientId: role === "client" ? selectedClientId || undefined : undefined,
      nurseId: role === "nurse" ? selectedNurseId || undefined : undefined,
      estatus,
      timestamp: editingUser?.timestamp || new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await onSaveUser(userToSave);
      await logAuditEvent({
        tipoAccion: isNew ? "CREAR_USUARIO" : "MODIFICAR_USUARIO",
        descripcion: `Usuario de sistema @${cleanUx} (${role} - ${userToSave.nombre}) ${isNew ? "creado" : "actualizado"}`,
        usuarioUx: currentUserSession?.username || "admin",
        usuarioNombre: currentUserSession?.nombre || currentUserSession?.username || "Administrador",
        rol: currentUserSession?.role || "admin",
        detalles: { id: userToSave.id, ux: cleanUx, role, estatus },
      });
      setSuccessMsg(`Usuario "${cleanUx}" guardado correctamente.`);
      setTimeout(() => setSuccessMsg(""), 3000);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error saving user:", err);
      setErrorMsg(err.message || "Error al guardar el usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDeleteModal = (user: SystemUser) => {
    if (user.isSuperAdmin || user.ux === "Nestor Moedano" || user.id === "usr-superadmin-nestor") {
      setErrorMsg("El Super Administrador Nestor Moedano está protegido y no se puede eliminar.");
      setTimeout(() => setErrorMsg(""), 4000);
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setErrorMsg("");
    try {
      await onDeleteUser(userToDelete.id);
      await logAuditEvent({
        tipoAccion: "ELIMINAR_USUARIO",
        descripcion: `Usuario @${userToDelete.ux} (${userToDelete.nombre} - ${userToDelete.role}) eliminado del sistema`,
        usuarioUx: currentUserSession?.username || "admin",
        usuarioNombre: currentUserSession?.nombre || currentUserSession?.username || "Administrador",
        rol: currentUserSession?.role || "admin",
        detalles: { id: userToDelete.id, ux: userToDelete.ux, role: userToDelete.role },
      });
      setSuccessMsg(`Usuario "${userToDelete.ux}" (${userToDelete.nombre}) eliminado correctamente.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      setUserToDelete(null);
      if (editingUser?.id === userToDelete.id) {
        setIsModalOpen(false);
        setEditingUser(null);
      }
    } catch (err: any) {
      console.error("Error al eliminar usuario:", err);
      setErrorMsg("Error al eliminar usuario: " + (err.message || "Error desconocido"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeUserSession = async (user: SystemUser) => {
    if (
      !window.confirm(
        `¿Deseas forzar el cierre y revocar la sesión del usuario "${user.ux}" (${user.nombre})? Se desconectará de inmediato en todos sus dispositivos.`
      )
    ) {
      return;
    }
    setRevokingUserId(user.id);
    try {
      if (onRevokeSession) {
        await onRevokeSession(user.ux, user.nurseId || user.id);
      }
      await logAuditEvent({
        tipoAccion: "REVOCAR_SESION",
        descripcion: `Cierre forzado de sesión y revocación ejecutada para usuario @${user.ux} (${user.nombre})`,
        usuarioUx: currentUserSession?.username || "admin",
        usuarioNombre: currentUserSession?.nombre || currentUserSession?.username || "Administrador",
        rol: currentUserSession?.role || "admin",
        detalles: { targetUx: user.ux, targetRole: user.role },
      });
      setSuccessMsg(`✓ Sesión activa de "${user.ux}" cerrada y revocada exitosamente.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Error al revocar sesión:", err);
      setErrorMsg("Error al cerrar sesión: " + (err.message || "Error desconocido"));
    } finally {
      setRevokingUserId(null);
    }
  };

  // Filtered Users
  const filteredUsers = systemUsers.filter((u) => {
    const matchSearch =
      u.ux.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(u.nurseId && u.nurseId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      Boolean(u.clientId && u.clientId.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalUsers = systemUsers.length;
  const adminCount = systemUsers.filter((u) => u.role === "admin").length;
  const nurseCount = systemUsers.filter((u) => u.role === "nurse").length;
  const clientCount = systemUsers.filter((u) => u.role === "client").length;
  const ventasCount = systemUsers.filter((u) => u.role === "ventas").length;
  const atencionCount = systemUsers.filter((u) => u.role === "atencion_clientes").length;

  const handleVerifyIntegrity = () => {
    const deduped = deduplicateSystemUsers(systemUsers);
    const duplicatesRemoved = systemUsers.length - deduped.length;
    if (duplicatesRemoved > 0) {
      deduped.forEach((u) => onSaveUser(u));
      setSuccessMsg(`✓ Verificación completada: Se sanearon ${duplicatesRemoved} usuario(s) duplicado(s). Todos los usuarios y folios son ahora 100% únicos.`);
    } else {
      setSuccessMsg("✓ Verificación de Integridad: No existen usuarios ni folios duplicados. La base de datos es 100% íntegra y única.");
    }
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveSubTab("usuarios")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "usuarios"
              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Usuarios y Credenciales ({totalUsers})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("auditoria")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === "auditoria"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-indigo-400" />
          <span>Bitácora de Auditoría de Operaciones</span>
        </button>
      </div>

      {activeSubTab === "auditoria" ? (
        <AuditLogViewer
          currentUserRole={currentUserSession?.role || "admin"}
          isSuperAdmin={currentUserSession?.isSuperAdmin || false}
        />
      ) : (
        <>
          {/* Header Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
                    <Users className="w-5 h-5" />
                  </span>
                  <h2 className="text-xl font-black text-white tracking-tight">
                    Directorio y Control de Usuarios (UX / CX)
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Administración centralizada de credenciales del personal, clientes y administradores.
                  El <span className="text-amber-400 font-bold">Super Administrador (Nestor Moedano)</span> es ineliminable.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleVerifyIntegrity}
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-700 shadow-sm transition-all cursor-pointer"
                  title="Verificar que no existan usuarios ni folios repetidos en el sistema"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verificar Folios y Unicidad</span>
                </button>

                <button
                  onClick={handleOpenCreateModal}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all self-start sm:self-auto cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Crear Nuevo Usuario</span>
                </button>
              </div>
            </div>

            {/* Stats Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Usuarios</span>
                <span className="text-lg font-black text-white">{totalUsers}</span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Admins</span>
                <span className="text-lg font-black text-amber-300">{adminCount}</span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">Ventas</span>
                <span className="text-lg font-black text-indigo-300">{ventasCount}</span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Socios / Enf.</span>
                <span className="text-lg font-black text-emerald-300">{nurseCount}</span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <span className="text-[10px] uppercase font-bold text-sky-400 block">Clientes</span>
                <span className="text-lg font-black text-sky-300">{clientCount}</span>
              </div>
            </div>
          </div>

          {successMsg && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por usuario, ID o nombre..."
                className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            {/* Role Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setRoleFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  roleFilter === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Todos ({totalUsers})
              </button>
              <button
                onClick={() => setRoleFilter("admin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  roleFilter === "admin" ? "bg-amber-600/30 text-amber-300 border border-amber-500/40" : "text-slate-400 hover:text-white"
                }`}
              >
                Admins ({adminCount})
              </button>
              <button
                onClick={() => setRoleFilter("ventas")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  roleFilter === "ventas" ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40" : "text-slate-400 hover:text-white"
                }`}
              >
                Ventas ({ventasCount})
              </button>
              <button
                onClick={() => setRoleFilter("nurse")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  roleFilter === "nurse" ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
                }`}
              >
                Socios ({nurseCount})
              </button>
              <button
                onClick={() => setRoleFilter("client")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  roleFilter === "client" ? "bg-sky-600/30 text-sky-300 border border-sky-500/40" : "text-slate-400 hover:text-white"
                }`}
              >
                Clientes ({clientCount})
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Usuario (UX)</th>
                    <th className="py-3 px-4">Nombre Completo</th>
                    <th className="py-3 px-4">Rol de Acceso</th>
                    <th className="py-3 px-4">Contraseña (CX)</th>
                    <th className="py-3 px-4">Estatus</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No se encontraron usuarios registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSuper = u.isSuperAdmin || u.ux === "Nestor Moedano" || u.id === "usr-superadmin-nestor";
                      const showPwd = visiblePasswords[u.id];

                      return (
                        <tr
                          key={u.id}
                          className={`hover:bg-slate-800/50 transition ${
                            isSuper ? "bg-amber-950/20" : ""
                          }`}
                        >
                          {/* Usuario UX */}
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            <div className="flex items-center gap-2">
                              {isSuper ? (
                                <span className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40" title="Super Administrador Protegido">
                                  <Crown className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <Key className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{u.ux}</span>
                              {isSuper && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nombre Completo */}
                          <td className="py-3 px-4 font-medium text-slate-200">
                            {u.nombre}
                          </td>

                          {/* Rol */}
                          <td className="py-3 px-4">
                            {u.role === "admin" && (
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex items-center gap-1 ${u.isGeneralAdmin || u.isSuperAdmin ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-sky-500/20 text-sky-300 border-sky-500/40"} border px-2 py-0.5 rounded-full font-bold text-[10px]`}>
                                  <ShieldCheck className="w-3 h-3" />
                                  {u.isGeneralAdmin || u.isSuperAdmin ? "Admin General (México)" : "Admin Sucursal"}
                                </span>
                                {u.sucursalNombre && !u.isGeneralAdmin && (
                                  <span className="text-[10px] text-sky-400 font-medium flex items-center gap-1">
                                    <Building2 className="w-2.5 h-2.5" />
                                    {u.sucursalNombre}
                                  </span>
                                )}
                              </div>
                            )}
                            {u.role === "ventas" && (
                              <span className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                <Tag className="w-3 h-3" />
                                Ventas & Cotizaciones
                              </span>
                            )}
                            {u.role === "atencion_clientes" && (
                              <span className="inline-flex items-center gap-1 bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                <Headphones className="w-3 h-3" />
                                Atención a Clientes
                              </span>
                            )}
                            {u.role === "nurse" && (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                <UserCheck className="w-3 h-3" />
                                Socio / Enfermería
                              </span>
                            )}
                            {u.role === "client" && (
                              <span className="inline-flex items-center gap-1 bg-sky-500/10 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold text-[10px]">
                                <Users className="w-3 h-3" />
                                Cliente (Familia)
                              </span>
                            )}
                          </td>

                          {/* Contraseña CX */}
                          <td className="py-3 px-4 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-md text-slate-200 text-xs tracking-wider min-w-[90px] inline-block">
                                {showPwd ? u.cx : "••••••••"}
                              </span>
                              <button
                                onClick={() => togglePasswordVisibility(u.id)}
                                className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                                title={showPwd ? "Ocultar Contraseña" : "Ver Contraseña"}
                              >
                                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => copyToClipboard(u.cx, u.id)}
                                className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                                title="Copiar Contraseña"
                              >
                                {copiedId === u.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Estatus */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.estatus === "Inactivo"
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {u.estatus || "Activo"}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Cerrar Sesión Remota Button */}
                              <button
                                onClick={() => handleRevokeUserSession(u)}
                                disabled={revokingUserId === u.id}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer flex items-center gap-1"
                                title="Cerrar / Forzar salida de sesión en dispositivos remotos"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold hidden lg:inline">Cerrar Sesión</span>
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                title="Editar Usuario / Cambiar Contraseña"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {isSuper ? (
                                <span
                                  className="p-1.5 rounded-lg bg-amber-950/40 text-amber-500 border border-amber-800/40 cursor-not-allowed opacity-80"
                                  title="Super Administrador Ineliminable"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenDeleteModal(u)}
                                  className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition cursor-pointer"
                                  title="Eliminar Usuario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
        </>
      )}

      {/* Top Banner Success / Error */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && !isModalOpen && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-950/95 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-xs font-bold">{errorMsg}</span>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-500/30 w-full max-w-md rounded-2xl shadow-2xl p-6 relative space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base text-white">¿Eliminar este Usuario?</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Esta acción revocará inmediatamente las credenciales y el acceso a la plataforma.
                </p>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* User Details Summary */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Usuario (UX):</span>
                <span className="text-white font-mono font-bold">{userToDelete.ux}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre:</span>
                <span className="text-slate-200">{userToDelete.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rol:</span>
                <span className="text-amber-400 font-bold uppercase">{userToDelete.role}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-900/40 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 relative space-y-5 animate-scaleUp max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
                  {editingUser ? <Edit className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    {editingUser ? `Editar Usuario: ${editingUser.ux}` : "Crear Nuevo Usuario"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Asigne el rol y credenciales de acceso al sistema informático
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="bg-rose-950/80 border border-rose-500/50 text-rose-300 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Rol Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Rol de Acceso al Sistema *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer"
                >
                  <option value="admin">Administrador (Acceso y Gestión)</option>
                  <option value="ventas">Ventas (Cotizaciones y Carátulas)</option>
                  <option value="atencion_clientes">Atención a Clientes (Incidencias & Servicios)</option>
                  <option value="nurse">Socio / Personal de Enfermería</option>
                  <option value="client">Cliente / Familiar Receptor de Servicio</option>
                </select>
              </div>

              {/* Admin Scope Configuration (General vs Sucursal) */}
              {role === "admin" && (
                <div className="bg-amber-950/25 border border-amber-800/40 p-3.5 rounded-2xl space-y-3">
                  <label className="block text-xs font-bold text-amber-300">
                    Ámbito de Administración & Sucursal
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminScope("general")}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                        adminScope === "general"
                          ? "bg-amber-600 text-white border-amber-500 shadow-md"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      🌐 Administrador General
                      <span className="block text-[10px] font-normal opacity-85 mt-0.5">
                        Cuidarte México (Todas las Sedes)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminScope("sucursal")}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                        adminScope === "sucursal"
                          ? "bg-sky-600 text-white border-sky-500 shadow-md"
                          : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      📍 Administrador de Sucursal
                      <span className="block text-[10px] font-normal opacity-85 mt-0.5">
                        Restringido a su propia sede
                      </span>
                    </button>
                  </div>

                  {adminScope === "sucursal" && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Sucursal Asignada *</span>
                      </label>
                      <select
                        value={selectedAdminSucursalId}
                        onChange={(e) => setSelectedAdminSucursalId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none cursor-pointer"
                      >
                        {sucursales.length > 0 ? (
                          sucursales.map((s) => (
                            <option key={s.id} value={s.id}>
                              📍 {s.nombre} ({s.ciudad}, {s.estado})
                            </option>
                          ))
                        ) : (
                          <option value="pachuca">📍 Cuidarte Pachuca (Pachuca de Soto, Hidalgo)</option>
                        )}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Este administrador solo podrá consultar y gestionar pacientes, carátulas y personal de esta sucursal.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Link to Existing Client */}
              {role === "client" && (
                <div className="bg-sky-950/30 border border-sky-800/40 p-3.5 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-sky-300">
                    Vincular con Expediente de Cliente
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="">-- Seleccionar Cliente Registrado --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.nombreCompletoCliente}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Link to Existing Staff */}
              {role === "nurse" && (
                <div className="bg-emerald-950/30 border border-emerald-800/40 p-3.5 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-emerald-300">
                    Vincular con Socio / Colaborador
                  </label>
                  <select
                    value={selectedNurseId}
                    onChange={(e) => handleStaffSelect(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Seleccionar Socio Activo --</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.noSocio || s.id}>
                        {s.noSocio ? `[${s.noSocio}] ` : ""}
                        {s.nombre} {s.apellidos}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* UX Field */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Usuario (UX) *
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={ux}
                    onChange={(e) => setUx(e.target.value)}
                    placeholder="Ej. JuanPerez o SOCP-25001"
                    className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2.5 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* CX Field with generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Contraseña (CX) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCx(generateRandomPassword())}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generar Segura</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showFormPassword ? "text" : "password"}
                    value={cx}
                    onChange={(e) => setCx(e.target.value)}
                    placeholder="Contraseña del usuario"
                    className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-10 py-2.5 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Nombre Completo del Titular
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre y Apellidos"
                  className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Estatus de la Cuenta
                </label>
                <select
                  value={estatus}
                  onChange={(e) => setEstatus(e.target.value as "Activo" | "Inactivo")}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="Activo">🟢 Activo (Acceso Habilitado)</option>
                  <option value="Inactivo">🔴 Inactivo (Acceso Bloqueado)</option>
                </select>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-900/40 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Guardar Usuario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

