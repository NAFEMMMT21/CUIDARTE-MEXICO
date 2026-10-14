import React, { useState, useEffect } from "react";
import { FileText, Users, Briefcase, BarChart3, PlusCircle, User, LogOut, Receipt, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, Cloud, Calendar, Stethoscope, PhoneCall, Siren, Mail, Pill, Menu, X, ChevronRight, Database, ShieldCheck, DollarSign, Bell, Scale, BookOpen, Building2, Landmark } from "lucide-react";
import { CuidarteLogo } from "./CuidarteLogo";
import { UserSession } from "../services/auth";
import { LiveClock } from "./LiveClock";
import { ReceptorServicioSearchSelector } from "./ReceptorServicioSearchSelector";
import { NotificationCenterModal } from "./NotificationCenterModal";
import { pushNotificationService, AppNotification } from "../services/pushNotificationService";
import { Client, Caratula, Sucursal } from "../types";

export type TabType = "crear" | "historial" | "servicios" | "clientes" | "saldos" | "personal" | "usuarios" | "financiero" | "gastos" | "honorarios" | "agenda" | "expedientes" | "inventario" | "respaldo" | "auditoria" | "sucursales";
export type SyncStatus = "synced" | "saving" | "error";

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  caratulasCount: number;
  userSession?: UserSession | null;
  onLogout?: () => void;
  onResetDatabase?: () => void;
  onForceSync?: () => void;
  isOnline: boolean;
  isQuotaExhausted?: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  clients?: Client[];
  caratulas?: Caratula[];
  globalSelectedClientId?: string;
  onSelectGlobalClient?: (clientId: string) => void;
  sucursales?: Sucursal[];
  selectedSucursalId?: string;
  onSelectSucursal?: (sucursalId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  caratulasCount,
  userSession,
  onLogout,
  onResetDatabase,
  onForceSync,
  isOnline,
  isQuotaExhausted,
  syncStatus,
  lastSyncedAt,
  clients = [],
  caratulas = [],
  globalSelectedClientId,
  onSelectGlobalClient,
  sucursales = [],
  selectedSucursalId,
  onSelectSucursal,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    const unsubscribe = pushNotificationService.subscribe((list) => {
      setUnreadNotificationsCount(list.filter((n) => !n.read).length);
    });
    return () => unsubscribe();
  }, []);

  const handleNavigateFromNotification = (
    actionType?: AppNotification["actionType"],
    actionPayload?: AppNotification["actionPayload"]
  ) => {
    if (actionType === "open_kardex" || actionType === "open_expediente") {
      setActiveTab("expedientes");
    } else if (actionType === "open_calendar") {
      setActiveTab("agenda");
    } else if (actionType === "start_guardia" || actionType === "end_guardia") {
      setActiveTab("agenda");
    }
  };

  const formatTime = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 print:hidden border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between h-auto py-2.5 sm:py-3 gap-2 sm:gap-3">
            {/* Brand Logo & SICCUM Title */}
            <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => handleTabClick("crear")}>
              <div
                className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-200 shadow-sm"
                style={{ borderRadius: "10px", borderWidth: "1px" }}
              >
                <CuidarteLogo
                  size="sm"
                  showTagline={true}
                  variant="header"
                  sucursalId={
                    userSession?.isGeneralAdmin || userSession?.isSuperAdmin
                      ? selectedSucursalId && selectedSucursalId !== "all"
                        ? selectedSucursalId
                        : undefined
                      : userSession?.sucursalId
                  }
                  sucursalNombre={
                    userSession?.isGeneralAdmin || userSession?.isSuperAdmin
                      ? selectedSucursalId && selectedSucursalId !== "all"
                        ? sucursales.find((s) => s.id === selectedSucursalId)?.nombre || "Cuidarte México"
                        : "Cuidarte México"
                      : userSession?.sucursalNombre || "Cuidarte México"
                  }
                  isMultiSucursal={
                    (userSession?.isGeneralAdmin || userSession?.isSuperAdmin) &&
                    (!selectedSucursalId || selectedSucursalId === "all")
                  }
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-black tracking-wider text-white">
                    SICCUM
                  </span>
                  {/* Sede / Sucursal Badge next to SICCUM */}
                  {userSession?.isGeneralAdmin || userSession?.isSuperAdmin ? (
                    selectedSucursalId && selectedSucursalId !== "all" ? (
                      <span className="text-[10px] sm:text-xs font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-500/40">
                        {sucursales.find((s) => s.id === selectedSucursalId)?.nombre || "Cuidarte México"}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-xs font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-500/40">
                        Cuidarte México
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
                      {userSession?.sucursalNombre || "Cuidarte México"}
                    </span>
                  )}
                  {userSession?.isSuperAdmin && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded-md border border-amber-500/30 hidden md:inline">
                      SuperAdmin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 font-medium hidden sm:block mt-0.5">
                  Sistema de Control de Cuidarte México
                </p>
              </div>
            </div>

            {/* BRANCH SELECTOR (FOR GENERAL ADMINS) OR BRANCH BADGE (FOR LOCAL BRANCH ADMINS) */}
            {sucursales && sucursales.length > 0 && onSelectSucursal && (userSession?.isGeneralAdmin || userSession?.isSuperAdmin) ? (
              <div className="flex items-center gap-1.5 bg-slate-800/95 border border-slate-700/80 hover:border-sky-500/50 px-2.5 py-1.5 rounded-xl text-xs shadow-sm transition-all">
                <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[10px] text-slate-400 uppercase font-extrabold hidden lg:inline">Sede:</span>
                <select
                  value={selectedSucursalId || "all"}
                  onChange={(e) => onSelectSucursal(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer pr-1 focus:text-sky-300"
                  title="Filtrar datos por sucursal o ver toda la red nacional de Cuidarte México"
                >
                  <option value="all" className="bg-slate-900 text-white">
                    🌐 Todas las Sucursales (Cuidarte México)
                  </option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      📍 {s.nombre} ({s.ciudad})
                    </option>
                  ))}
                </select>
              </div>
            ) : userSession?.sucursalNombre && !userSession?.isGeneralAdmin ? (
              <div className="flex items-center gap-1.5 bg-sky-950/80 border border-sky-500/40 text-sky-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Sucursal: {userSession.sucursalNombre}</span>
              </div>
            ) : null}

            {/* GLOBAL RECEPTOR DE SERVICIO SELECTOR WITH SEARCH */}
            {clients && clients.length > 0 && onSelectGlobalClient && (
              <ReceptorServicioSearchSelector
                clients={clients}
                caratulas={caratulas}
                selectedClientId={globalSelectedClientId}
                onSelectClient={onSelectGlobalClient}
                variant="header"
                placeholder="Buscar Receptor, Orden de Servicio o Responsable..."
              />
            )}

            {/* ONLINE STATUS & CLOUD SYNC INDICATORS */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Live Realtime Clock */}
              <div className="hidden sm:block">
                <LiveClock variant="compact" />
              </div>
              {/* Connection Status Badge */}
              <div
                className={`flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-all ${
                  isOnline
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950"
                    : "bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse"
                }`}
                title={isOnline ? "Conexión a Internet activa" : "Sin conexión a Internet. Los cambios se guardarán localmente."}
              >
                <span className="relative flex h-2 w-2">
                  {isOnline && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      isOnline ? "bg-emerald-400" : "bg-rose-500"
                    }`}
                  ></span>
                </span>
                {isOnline ? (
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="hidden xs:inline">En línea</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-rose-400" />
                    <span>Sin conexión</span>
                  </span>
                )}
              </div>

              {/* Cloud Sync Status Badge & Force Refresh */}
              <div className="flex items-center gap-1">
                {isQuotaExhausted ? (
                  <div
                    className="hidden xs:flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold border bg-amber-950/80 text-amber-300 border-amber-500/50"
                    title="Modo Persistencia Local de Alta Velocidad activo (Límite diario gratuito de Firestore alcanzado). Todos tus datos se guardan y leen de forma 100% segura en tu navegador."
                  >
                    <Database className="w-3 h-3 text-amber-400" />
                    <span>Caché Local</span>
                  </div>
                ) : (
                  <div
                    className={`hidden xs:flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-all ${
                      syncStatus === "saving"
                        ? "bg-amber-950/80 text-amber-300 border-amber-500/50"
                        : syncStatus === "error"
                        ? "bg-rose-950/80 text-rose-300 border-rose-500/50"
                        : "bg-sky-950/80 text-sky-300 border-sky-500/40"
                    }`}
                  >
                    {syncStatus === "saving" && (
                      <>
                        <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                        <span>Sincronizando...</span>
                      </>
                    )}
                    {syncStatus === "synced" && (
                      <>
                        <Cloud className="w-3 h-3 text-sky-400" />
                        <span>
                          Nube <span className="font-mono text-[10px] text-sky-200">{formatTime(lastSyncedAt)}</span>
                        </span>
                      </>
                    )}
                    {syncStatus === "error" && (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>Error</span>
                      </>
                    )}
                  </div>
                )}

                {onForceSync && (
                  <button
                    onClick={onForceSync}
                    title="Actualizar datos desde la nube inmediatamente (Forzar Sincronización)"
                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 hover:border-sky-500/50 rounded-full sm:rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "saving" ? "animate-spin text-amber-400" : ""}`} />
                    <span className="hidden md:inline">Actualizar</span>
                  </button>
                )}
              </div>

              {/* Action buttons on top right */}
              <button
                onClick={() => setShowNotificationModal(true)}
                className={`p-2 rounded-lg border transition-all relative ${
                  unreadNotificationsCount > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-500/30"
                    : "bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700"
                }`}
                title="Centro de Notificaciones y Avisos"
              >
                <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? "text-amber-400 animate-bounce" : ""}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[9px] min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleTabClick("crear")}
                className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all shadow-md shadow-sky-900/30"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Nueva Carátula</span>
                <span className="xs:hidden">Nueva</span>
              </button>

              {userSession && (
                <div className="hidden sm:flex items-center gap-2 border-l border-slate-700/80 pl-2">
                  <div className="flex items-center gap-1.5 bg-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700">
                    <User className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-semibold">{userSession.nombre || userSession.username}</span>
                  </div>

                  <button
                    onClick={onLogout}
                    title="Cerrar sesión"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-xs flex items-center gap-1 border border-slate-700/60 min-h-[36px]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden lg:inline">Salir</span>
                  </button>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg border border-slate-700 md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex space-x-1 sm:space-x-1.5 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/80 pt-2">
            <button
              onClick={() => handleTabClick("crear")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "crear"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <PlusCircle className="w-4 h-4 text-sky-300" />
              <span>Crear Carátula</span>
            </button>

            <button
              onClick={() => handleTabClick("historial")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "historial"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-300" />
              <span>Consultar Carátulas</span>
            </button>

            <button
              onClick={() => handleTabClick("servicios")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "servicios"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Briefcase className="w-4 h-4 text-amber-300" />
              <span>Catálogo Servicios</span>
            </button>

            <button
              onClick={() => handleTabClick("clientes")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "clientes"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4 text-indigo-300" />
              <span>Directorio Clientes</span>
            </button>

            <button
              onClick={() => handleTabClick("saldos")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "saldos"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Scale className="w-4 h-4 text-emerald-300" />
              <span>Saldos Clientes</span>
            </button>

            <button
              onClick={() => handleTabClick("personal")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "personal"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4 text-sky-300" />
              <span>Socios / Personal</span>
            </button>

            <button
              onClick={() => handleTabClick("usuarios")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "usuarios"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Usuarios / Sesiones Activas</span>
            </button>

            <button
              onClick={() => handleTabClick("agenda")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "agenda"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span>Agenda Turnos</span>
            </button>

            <button
              onClick={() => handleTabClick("expedientes")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "expedientes"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Stethoscope className="w-4 h-4 text-emerald-300" />
              <span>Expedientes</span>
            </button>

            <button
              onClick={() => handleTabClick("inventario")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "inventario"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Pill className="w-4 h-4 text-emerald-300" />
              <span>Insumos y Medicamentos</span>
            </button>

            <button
              onClick={() => handleTabClick("financiero")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "financiero"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-violet-300" />
              <span>Ingresos</span>
            </button>

            <button
              onClick={() => handleTabClick("gastos")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "gastos"
                  ? "bg-rose-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Receipt className="w-4 h-4 text-rose-300" />
              <span>Gastos</span>
            </button>

            <button
              onClick={() => handleTabClick("honorarios")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "honorarios"
                  ? "bg-rose-700 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4 text-rose-300" />
              <span>Honorarios</span>
            </button>

            <button
              onClick={() => handleTabClick("respaldo")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "respaldo"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Database className="w-4 h-4 text-emerald-300" />
              <span>Respaldo DB</span>
            </button>

            <button
              onClick={() => handleTabClick("auditoria")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === "auditoria"
                  ? "bg-sky-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
            >
              <BookOpen className="w-4 h-4 text-sky-300" />
              <span>Auditoría & Especificación</span>
            </button>

            {(userSession?.isGeneralAdmin || userSession?.isSuperAdmin) && (
              <button
                onClick={() => handleTabClick("sucursales")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[40px] ${
                  activeTab === "sucursales"
                    ? "bg-amber-600 text-white shadow"
                    : "text-amber-300 hover:text-white hover:bg-slate-800 border border-amber-500/30"
                }`}
                title="Gestión de Sucursales de Cuidarte México"
              >
                <Building2 className="w-4 h-4 text-amber-300" />
                <span>Sucursales ({sucursales?.length || 1})</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* MOBILE FULL NAVIGATION DRAWER (SLIDE OVER) */}
      {isMobileMenuOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm md:hidden flex justify-end animate-fadeIn overscroll-none"
        >
          <div className="bg-slate-900 w-[85vw] max-w-sm min-h-full h-auto border-l border-slate-800 p-5 flex flex-col justify-start space-y-4 shadow-2xl overflow-y-auto overscroll-contain pb-36">
            <div className="space-y-4 min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-black text-sm">
                    C
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Menú Principal</h3>
                    <p className="text-[11px] text-slate-400">Sistema Cuidarte</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User info if logged in */}
              {userSession && (
                <div className="bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                      {userSession.nombre?.[0] || userSession.username?.[0] || "U"}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-white">{userSession.nombre || userSession.username}</p>
                      <p className="text-[10px] text-sky-400 uppercase font-mono">{userSession.rol}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Global Receptor de Servicio Selector */}
              {clients && clients.length > 0 && onSelectGlobalClient && (
                <div className="bg-slate-800/90 border border-slate-700/80 p-3 rounded-xl space-y-1.5">
                  <ReceptorServicioSearchSelector
                    clients={clients}
                    caratulas={caratulas}
                    selectedClientId={globalSelectedClientId}
                    onSelectClient={(id) => {
                      onSelectGlobalClient(id);
                      setIsMobileMenuOpen(false);
                    }}
                    label="Receptor de Servicio Activo"
                    variant="card"
                    placeholder="Buscar Receptor, Orden o Responsable..."
                  />
                </div>
              )}

              {/* Navigation Items List */}
              <div className="space-y-1 pt-1">
                <button
                  onClick={() => handleTabClick("crear")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "crear" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlusCircle className="w-4 h-4 text-sky-300" />
                    <span>Crear Carátula / Cotización</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("historial")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "historial" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-emerald-300" />
                    <span>Consultar Carátulas</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("expedientes")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "expedientes" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-emerald-300" />
                    <span>Expedientes y Kárdex</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("inventario")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "inventario" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Pill className="w-4 h-4 text-emerald-300" />
                    <span>Insumos y Medicamentos</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("agenda")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "agenda" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-amber-300" />
                    <span>Agenda de Turnos</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("clientes")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "clientes" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-indigo-300" />
                    <span>Directorio de Clientes</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("saldos")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "saldos" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Scale className="w-4 h-4 text-emerald-300" />
                    <span>Saldos y Estados de Cuenta</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("personal")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "personal" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-sky-300" />
                    <span>Socios / Personal (Credenciales)</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("usuarios")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "usuarios" ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    <span>Usuarios y Sesiones Activas en Vivo</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("servicios")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "servicios" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-amber-300" />
                    <span>Catálogo de Servicios</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("financiero")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "financiero" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-violet-300" />
                    <span>Ingresos y Financiero</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("gastos")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "gastos" ? "bg-rose-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Receipt className="w-4 h-4 text-rose-300" />
                    <span>Pago de Gastos / Costos</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("honorarios")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "honorarios" ? "bg-rose-700 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-rose-300" />
                    <span>Honorarios Pendientes</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("respaldo")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "respaldo" ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 text-emerald-300" />
                    <span>Respaldo y Base de Datos</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick("auditoria")}
                  className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                    activeTab === "auditoria" ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-sky-300" />
                    <span>Auditoría y Especificación del Sistema</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-50" />
                </button>

                {(userSession?.isGeneralAdmin || userSession?.isSuperAdmin) && (
                  <button
                    onClick={() => handleTabClick("sucursales")}
                    className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-xs transition min-h-[44px] ${
                      activeTab === "sucursales" ? "bg-amber-600 text-white" : "text-amber-300 hover:bg-slate-800 border border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-amber-300" />
                      <span>Sucursales — Cuidarte México ({sucursales?.length || 1})</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                )}

                {onLogout && userSession && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FIXED MOBILE BOTTOM ERGONOMIC TOUCH BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1 flex items-center justify-around shadow-2xl safe-bottom print:hidden">
        <button
          onClick={() => handleTabClick("crear")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "crear" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Crear</span>
        </button>

        <button
          onClick={() => handleTabClick("historial")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "historial" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Carátulas</span>
        </button>

        <button
          onClick={() => handleTabClick("expedientes")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "expedientes" ? "text-sky-400 bg-sky-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Stethoscope className="w-5 h-5 mb-0.5 text-sky-400" />
          <span className="text-[10px]">Expediente</span>
        </button>

        <button
          onClick={() => handleTabClick("inventario")}
          className={`flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-xl transition min-h-[48px] ${
            activeTab === "inventario" ? "text-emerald-400 bg-emerald-950/70 font-black" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Pill className="w-5 h-5 mb-0.5 text-emerald-400" />
          <span className="text-[10px]">Insumos</span>
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

      {/* Modal / Drawer del Centro de Notificaciones y Ajustes de Audio */}
      <NotificationCenterModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onNavigateAction={handleNavigateFromNotification}
      />
    </>
  );
};

