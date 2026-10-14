import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  getDocs
} from "firebase/firestore";
import { db } from "../services/firebase";
import {
  Users,
  Radio,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  Stethoscope,
  HeartHandshake,
  LogOut,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  Filter,
  UserX,
  Smartphone,
  Info
} from "lucide-react";
import { revokeUserSessionInFirestore, sanitizeForFirestore } from "../services/firestoreSync";
import { UserSession } from "../services/auth";

export interface LiveOnlineUserRecord {
  id: string;
  ux: string;
  nombre: string;
  role: "admin" | "nurse" | "coordinator" | "director" | "client" | string;
  isOnline: boolean;
  sesionActiva?: boolean;
  status?: "online" | "idle" | "offline";
  ultimaConexionIso?: string;
  ultimaConexionTimestamp?: number;
  nurseId?: string;
  clientId?: string;
  updatedAt?: string;
  ipAddress?: string;
  device?: string;
}

interface LiveSessionsDashboardProps {
  currentUser?: UserSession | null;
  onRefresh?: () => void;
}

export const LiveSessionsDashboard: React.FC<LiveSessionsDashboardProps> = ({
  currentUser,
  onRefresh,
}) => {
  const [liveUsers, setLiveUsers] = useState<LiveOnlineUserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "online" | "staff" | "client" | "admin">("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedUserToRevoke, setSelectedUserToRevoke] = useState<LiveOnlineUserRecord | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update relative time clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Real-time listener to Firestore onlineStatus collection
  useEffect(() => {
    setLoading(true);
    let unsubStatus: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;

    try {
      // Primary: Listen to onlineStatus collection
      const statusColRef = collection(db, "onlineStatus");
      unsubStatus = onSnapshot(
        statusColRef,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: LiveOnlineUserRecord[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as LiveOnlineUserRecord;
              list.push({
                ...data,
                id: docSnap.id,
              });
            });
            setLiveUsers(list);
            setLoading(false);
          } else {
            // If onlineStatus is empty, query system_users as fallback
            fetchSystemUsersFallback();
          }
        },
        (error) => {
          console.warn("onlineStatus subscription notice:", error);
          fetchSystemUsersFallback();
        }
      );
    } catch (err) {
      console.warn("Could not attach onlineStatus listener, falling back to system_users", err);
      fetchSystemUsersFallback();
    }

    function fetchSystemUsersFallback() {
      try {
        const usersColRef = collection(db, "system_users");
        unsubUsers = onSnapshot(usersColRef, (snap) => {
          const list: LiveOnlineUserRecord[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as any;
            list.push({
              id: docSnap.id,
              ux: data.ux || data.username || docSnap.id,
              nombre: data.nombre || data.displayName || data.ux || "Usuario",
              role: data.role || "nurse",
              isOnline: Boolean(data.isOnline || data.sesionActiva),
              sesionActiva: Boolean(data.sesionActiva || data.isOnline),
              status: data.isOnline ? "online" : "offline",
              ultimaConexionIso: data.ultimaConexionIso || data.lastActive || new Date().toISOString(),
              ultimaConexionTimestamp: data.ultimaConexionTimestamp || (data.lastActive ? new Date(data.lastActive).getTime() : Date.now()),
              nurseId: data.nurseId,
              clientId: data.clientId,
            });
          });
          setLiveUsers(list);
          setLoading(false);
        });
      } catch (e) {
        console.error("Fallback system_users error", e);
        setLoading(false);
      }
    }

    return () => {
      if (unsubStatus) unsubStatus();
      if (unsubUsers) unsubUsers();
    };
  }, []);

  // Handle Remote Forced Session Revocation
  const handleForceRevoke = async (user: LiveOnlineUserRecord) => {
    setActionLoading(user.ux);
    setActionFeedback(null);

    try {
      const res = await revokeUserSessionInFirestore(user.ux, user.nurseId);
      
      // Also explicitly update onlineStatus doc
      try {
        const cleanId = user.ux.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
        const statusDocRef = doc(db, "onlineStatus", `status-${cleanId}`);
        await setDoc(
          statusDocRef,
          sanitizeForFirestore({
            isOnline: false,
            sesionActiva: false,
            status: "offline",
            revokedAt: new Date().toISOString(),
            revokedBy: currentUser?.username || "admin",
          }),
          { merge: true }
        );
      } catch {}

      if (res.success) {
        setActionFeedback({
          type: "success",
          message: `Sesión de ${user.nombre || user.ux} revocada y cerrada con éxito.`,
        });
      } else {
        setActionFeedback({
          type: "error",
          message: res.message || "No se pudo revocar la sesión remota.",
        });
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: "Error de comunicación al revocar la sesión.",
      });
    } finally {
      setActionLoading(null);
      setSelectedUserToRevoke(null);
    }
  };

  // Helper to format human-readable time ago
  const formatTimeAgo = (timestamp?: number, isoString?: string) => {
    const time = timestamp || (isoString ? new Date(isoString).getTime() : 0);
    if (!time) return "Sin registro reciente";
    const diffSec = Math.max(0, Math.floor((now - time) / 1000));
    if (diffSec < 60) return `Hace ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return new Date(time).toLocaleDateString("es-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Compute stats
  const stats = useMemo(() => {
    const total = liveUsers.length;
    const onlineCount = liveUsers.filter((u) => u.isOnline || u.sesionActiva).length;
    const staffOnline = liveUsers.filter((u) => (u.isOnline || u.sesionActiva) && u.role !== "client").length;
    const clientOnline = liveUsers.filter((u) => (u.isOnline || u.sesionActiva) && u.role === "client").length;
    return { total, onlineCount, staffOnline, clientOnline };
  }, [liveUsers]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return liveUsers.filter((user) => {
      const isUserOnline = user.isOnline || user.sesionActiva;

      // Role/Status Tab filter
      if (roleFilter === "online" && !isUserOnline) return false;
      if (roleFilter === "staff" && (user.role === "client" || !isUserOnline)) return false;
      if (roleFilter === "client" && user.role !== "client") return false;
      if (roleFilter === "admin" && user.role !== "admin" && user.role !== "director") return false;

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = (user.nombre || "").toLowerCase().includes(term);
        const matchUx = (user.ux || "").toLowerCase().includes(term);
        const matchRole = (user.role || "").toLowerCase().includes(term);
        return matchName || matchUx || matchRole;
      }

      return true;
    });
  }, [liveUsers, roleFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-5 sm:p-6 rounded-2xl shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-sky-500/20 border border-sky-400/30 rounded-xl text-sky-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Monitor de Sesiones en Vivo</h2>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Firestore Realtime
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Monitoreo activo de conexiones y auditoría de accesos al sistema clínico.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefresh?.()}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-600 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-700/60">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium block">Sesiones Activas</span>
            <div className="flex items-center gap-2 mt-1">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xl font-black text-emerald-400">{stats.onlineCount}</span>
              <span className="text-[10px] text-slate-400">en línea</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium block">Personal Clínico</span>
            <div className="flex items-center gap-2 mt-1">
              <Stethoscope className="w-4 h-4 text-sky-400" />
              <span className="text-xl font-black text-sky-400">{stats.staffOnline}</span>
              <span className="text-[10px] text-slate-400">en servicio</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium block">Clientes / Familiares</span>
            <div className="flex items-center gap-2 mt-1">
              <HeartHandshake className="w-4 h-4 text-amber-400" />
              <span className="text-xl font-black text-amber-400">{stats.clientOnline}</span>
              <span className="text-[10px] text-slate-400">conectados</span>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] text-slate-400 font-medium block">Cuentas Registradas</span>
            <div className="flex items-center gap-2 mt-1">
              <Users className="w-4 h-4 text-slate-300" />
              <span className="text-xl font-black text-white">{stats.total}</span>
              <span className="text-[10px] text-slate-400">usuarios</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, usuario o rol..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter("all")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({liveUsers.length})
          </button>
          <button
            onClick={() => setRoleFilter("online")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              roleFilter === "online"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            En línea ({stats.onlineCount})
          </button>
          <button
            onClick={() => setRoleFilter("staff")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === "staff"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
            }`}
          >
            Enfermería ({stats.staffOnline})
          </button>
          <button
            onClick={() => setRoleFilter("client")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === "client"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            Clientes ({stats.clientOnline})
          </button>
        </div>
      </div>

      {/* Users List Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Sincronizando estado en vivo con Firestore...</p>
          <p className="text-xs text-slate-400 mt-1">Escuchando cambios en la colección onlineStatus</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
          <WifiOff className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No se encontraron sesiones coincidentes</h3>
          <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros o el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => {
            const isUserOnline = Boolean(user.isOnline || user.sesionActiva);
            const isClient = user.role === "client";
            const isAdmin = user.role === "admin" || user.role === "director";

            return (
              <div
                key={user.id}
                className={`bg-white rounded-xl border p-4 shadow-sm transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                  isUserOnline ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200 bg-slate-50/50 opacity-80"
                }`}
              >
                {/* Top Status Strip */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                          isAdmin
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : isClient
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-sky-100 text-sky-800 border border-sky-200"
                        }`}
                      >
                        {user.nombre?.charAt(0)?.toUpperCase() || user.ux?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      {/* Status indicator dot */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          isUserOnline ? "bg-emerald-500 shadow-sm" : "bg-slate-300"
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                          {user.nombre || user.ux}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 block">
                        UX: {user.ux}
                      </span>
                    </div>
                  </div>

                  {/* Badge */}
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      isUserOnline
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {isUserOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Activo</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-2.5 h-2.5" />
                        <span>Desconectado</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Body details */}
                <div className="py-3 space-y-2 text-xs text-slate-600 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Rol del Sistema:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                        isAdmin
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : isClient
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-sky-50 text-sky-700 border border-sky-200"
                      }`}
                    >
                      {isAdmin ? "Administrador / Dirección" : isClient ? "Cliente / Familiar" : "Personal de Enfermería"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Última actividad:
                    </span>
                    <span className="font-medium text-slate-800">
                      {formatTimeAgo(user.ultimaConexionTimestamp, user.ultimaConexionIso)}
                    </span>
                  </div>

                  {user.nurseId && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">ID Enfermería:</span>
                      <span className="font-mono font-semibold text-slate-700">{user.nurseId}</span>
                    </div>
                  )}

                  {user.clientId && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">ID Cliente:</span>
                      <span className="font-mono font-semibold text-slate-700">{user.clientId}</span>
                    </div>
                  )}
                </div>

                {/* Action footer: Forced logout */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[10px] text-slate-400">
                    {isUserOnline ? "Sesión interactiva" : "Sin conexión activa"}
                  </div>

                  <button
                    onClick={() => setSelectedUserToRevoke(user)}
                    disabled={actionLoading === user.ux}
                    className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Cierre forzado</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Forced Logout */}
      {selectedUserToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <UserX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">Confirmar Cierre Forzado de Sesión</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Estás seguro de que deseas desconectar y cerrar forzosamente la sesión de{" "}
              <strong className="text-slate-900">{selectedUserToRevoke.nombre || selectedUserToRevoke.ux}</strong>?
            </p>

            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
              <div className="font-bold flex items-center gap-1 mb-0.5">
                <Info className="w-3.5 h-3.5 text-amber-700" />
                Efecto Inmediato
              </div>
              El usuario será desconectado remotamente en tiempo real de todos sus dispositivos abiertos.
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setSelectedUserToRevoke(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleForceRevoke(selectedUserToRevoke)}
                disabled={actionLoading === selectedUserToRevoke.ux}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-md shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Confirmar Cierre Forzado</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
