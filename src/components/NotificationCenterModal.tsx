import React, { useState, useEffect } from "react";
import { AppNotification, pushNotificationService } from "../services/pushNotificationService";
import { audioNotificationService } from "../services/audioNotificationService";
import {
  Bell,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  Pill,
  Calendar,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Trash2,
  Sparkles,
  CheckCheck,
  X,
  ChevronRight,
  Sliders,
  Settings,
  ExternalLink,
  RefreshCw,
  Lock,
  Smartphone,
  Globe,
  Info,
  HelpCircle,
} from "lucide-react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateAction?: (
    actionType: AppNotification["actionType"],
    actionPayload?: AppNotification["actionPayload"]
  ) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateAction,
}) => {
  useLockBodyScroll(isOpen);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "meds" | "shifts">("all");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(audioNotificationService.getSoundEnabled());
  const [volume, setVolume] = useState<number>(audioNotificationService.getVolume());
  const [permission, setPermission] = useState<NotificationPermission>(pushNotificationService.getPermissionStatus());
  const [activeTab, setActiveTab] = useState<"history" | "settings">("history");
  const [showHowToUnblock, setShowHowToUnblock] = useState<boolean>(false);
  const [unblockTab, setUnblockTab] = useState<"chrome" | "android" | "ios" | "safari">("chrome");
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [testPushSent, setTestPushSent] = useState<boolean>(false);

  useEffect(() => {
    setIsIframe(pushNotificationService.isInsideIframe());
    setPermission(pushNotificationService.getPermissionStatus());
  }, [isOpen]);

  useEffect(() => {
    const unsubscribe = pushNotificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsubscribe();
  }, []);

  if (!isOpen) return null;

  const handleRefreshPermission = () => {
    const perm = pushNotificationService.getPermissionStatus();
    setPermission(perm);
  };

  const handleRequestPushPermission = async () => {
    const perm = await pushNotificationService.requestPermission();
    setPermission(perm);
    if (perm === "denied") {
      setShowHowToUnblock(true);
    }
  };

  const handleOpenStandalone = () => {
    try {
      window.open(window.location.href, "_blank");
    } catch {
      window.location.href = window.location.href;
    }
  };

  const handleSendTestPush = () => {
    pushNotificationService.sendTestPushNotification();
    setTestPushSent(true);
    setTimeout(() => setTestPushSent(false), 4000);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioNotificationService.setSoundEnabled(next);
    if (next) {
      audioNotificationService.playGenericSound();
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioNotificationService.setVolume(newVol);
  };

  const handleTestSound = (type: "new_shift" | "med_5min" | "med_overdue" | "shift_start" | "shift_end") => {
    if (type === "new_shift") audioNotificationService.playNewShiftSound();
    if (type === "med_5min") audioNotificationService.playMedication5MinSound();
    if (type === "med_overdue") audioNotificationService.playMedicationOverdueSound();
    if (type === "shift_start") audioNotificationService.playShiftStartingSoonSound();
    if (type === "shift_end") audioNotificationService.playShiftEnded10MinSound();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "meds") return n.category === "med_5min" || n.category === "med_overdue";
    if (filter === "shifts") {
      return (
        n.category === "shift_new" ||
        n.category === "shift_change" ||
        n.category === "shift_start_soon" ||
        n.category === "shift_end_10min"
      );
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[calc(100dvh-9.5rem)] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">Centro de Notificaciones y Sonido</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Avisos de guardias, cambios de horario y dosis de medicamentos</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Historial vs Ajustes de Sonido */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl">
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "history"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Historial de Avisos ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "settings"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Ajustes & Tonos</span>
            </button>
          </div>

          {activeTab === "history" && notifications.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => pushNotificationService.markAllAsRead()}
                className="p-1.5 text-xs text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg flex items-center gap-1 font-medium transition-colors"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Marcar Leídas</span>
              </button>
              <button
                onClick={() => pushNotificationService.clearAll()}
                className="p-1.5 text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1 font-medium transition-colors"
                title="Limpiar historial"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Limpiar</span>
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "settings" ? (
            /* SETTINGS & SOUND TEST BENCH */
            <div className="space-y-4">
              {/* Push Permission Card & Browser Unblocking Guide */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span>Notificaciones Push del Navegador</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Recibe alertas emergentes en pantalla o en la barra de tu dispositivo móvil incluso si la app está en segundo plano.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        permission === "granted"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : permission === "denied"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {permission === "granted"
                        ? "✓ Activadas"
                        : permission === "denied"
                        ? "✕ Bloqueadas en Navegador"
                        : "⏳ Pendiente de Permiso"}
                    </span>
                    <button
                      onClick={handleRefreshPermission}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 mt-0.5"
                      title="Volver a verificar permisos del navegador"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Verificar estado</span>
                    </button>
                  </div>
                </div>

                {/* State: GRANTED */}
                {permission === "granted" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>¡Tu navegador tiene los permisos activados correctamente!</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Recibirás avisos nativos del sistema al asignar guardias y 5 minutos antes de la toma de medicamentos.
                    </p>
                    <button
                      onClick={handleSendTestPush}
                      className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{testPushSent ? "¡Notificación Enviada!" : "Enviar Notificación de Prueba al Dispositivo"}</span>
                    </button>
                  </div>
                )}

                {/* State: PENDING (DEFAULT) */}
                {permission === "default" && (
                  <div className="space-y-2">
                    <button
                      onClick={handleRequestPushPermission}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Activar Notificaciones Push en este Dispositivo</span>
                    </button>
                    {isIframe && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                        💡 Si estás en la vista previa embebida, ábrela en una pestaña independiente para que el navegador te muestre el diálogo de confirmación.
                      </p>
                    )}
                  </div>
                )}

                {/* State: BLOCKED / DENIED or Running in iFrame */}
                {(permission === "denied" || showHowToUnblock) && (
                  <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold text-rose-900">
                          ¿Por qué aparecen bloqueadas en el navegador?
                        </p>
                        <p className="text-rose-800 text-[11px] mt-0.5">
                          {isIframe
                            ? "1) La app se encuentra dentro de un marco de vista previa (iFrame), donde los navegadores restringen permisos por seguridad. 2) O el navegador tiene bloqueado el permiso para este sitio."
                            : "El navegador bloqueó el permiso anteriormente. Por seguridad, los navegadores no permiten volver a mostrar el mensaje automático y debe habilitarse en los ajustes del sitio."}
                        </p>
                      </div>
                    </div>

                    {/* Action: How to unblock guide */}
                    <div className="pt-1 flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowHowToUnblock(!showHowToUnblock)}
                        className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>{showHowToUnblock ? "Ocultar Guía" : "Cómo Habilitar Notificaciones en el Navegador"}</span>
                      </button>
                    </div>

                    {/* Step-by-Step Unblocking Accordion */}
                    {showHowToUnblock && (
                      <div className="mt-2 pt-2 border-t border-rose-200 space-y-2.5">
                        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                          <button
                            onClick={() => setUnblockTab("chrome")}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              unblockTab === "chrome" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            🌐 Chrome / Edge
                          </button>
                          <button
                            onClick={() => setUnblockTab("android")}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              unblockTab === "android" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            📱 Android
                          </button>
                          <button
                            onClick={() => setUnblockTab("ios")}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-colors ${
                              unblockTab === "ios" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            🍎 iPhone / iPad
                          </button>
                        </div>

                        {unblockTab === "chrome" && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5">
                            <p className="font-bold text-slate-900 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 text-blue-600" />
                              <span>En Google Chrome o Microsoft Edge (PC / Mac):</span>
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                              <li>Haz clic en el icono de <strong>Candado 🔒 o Ajustes</strong> ubicado a la izquierda de la barra de direcciones (URL).</li>
                              <li>En la opción <strong>"Notificaciones"</strong>, cambia el interruptor a <strong>"Permitir"</strong>.</li>
                              <li>Presiona <strong>Recargar página</strong> o el botón <em>Verificar estado</em> de arriba.</li>
                            </ol>
                          </div>
                        )}

                        {unblockTab === "android" && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5">
                            <p className="font-bold text-slate-900 flex items-center gap-1">
                              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                              <span>En Google Chrome (Celular Android):</span>
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                              <li>Toca el botón de <strong>Ajustes del sitio ⚙️ / Candado 🔒</strong> en la barra del navegador.</li>
                              <li>Toca en <strong>"Permisos" ➔ "Notificaciones"</strong>.</li>
                              <li>Selecciona <strong>"Permitir"</strong> y regresa a la aplicación.</li>
                            </ol>
                          </div>
                        )}

                        {unblockTab === "ios" && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1.5">
                            <p className="font-bold text-slate-900 flex items-center gap-1">
                              <Globe className="w-3.5 h-3.5 text-blue-600" />
                              <span>En Safari (iPhone / iPad iOS 16.4+):</span>
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                              <li>Toca el botón <strong>Compartir ⬆️</strong> (cuadrado con flecha hacia arriba).</li>
                              <li>Elige la opción <strong>"Añadir a pantalla de inicio"</strong>.</li>
                              <li>Abre Cuidarte desde el icono instalado en tu pantalla de inicio para habilitar notificaciones push nativas de iOS.</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Important Peace-of-Mind Notice */}
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2 text-xs text-blue-900">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Avisos y Tonos Clínicos Garantizados:</strong> Aun si tu navegador tiene restringidas las alertas del sistema operativo, <strong>el sintetizador de sonido médico (Web Audio API) y los avisos flotantes en pantalla funcionan permanentemente</strong> en tiempo real dentro de la aplicación.
                  </p>
                </div>
              </div>

              {/* Sound & Volume Control Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {soundEnabled ? (
                      <Volume2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-slate-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Sonido de Notificaciones</h4>
                      <p className="text-xs text-slate-500">Tonos médicos armónicos sintetizados por Web Audio API</p>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleSound}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      soundEnabled
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {soundEnabled ? "Sonido Activo" : "Silenciado"}
                  </button>
                </div>

                {soundEnabled && (
                  <div className="pt-2 border-t border-slate-200/80 flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Volumen:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-700 w-10 text-right">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Sound Test Bench */}
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-600" />
                  <span>Probar Tonos de Alerta del Sistema</span>
                </h4>
                <p className="text-xs text-blue-900/80">
                  Haz clic en cada botón para escuchar el tono característico de cada evento:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleTestSound("new_shift")}
                    className="p-2.5 bg-white hover:bg-blue-100/60 border border-blue-200 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>1. Nueva Guardia / Cambio</span>
                    </div>
                    <Play className="w-3.5 h-3.5 text-blue-600" />
                  </button>

                  <button
                    onClick={() => handleTestSound("med_5min")}
                    className="p-2.5 bg-white hover:bg-amber-100/60 border border-amber-200 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-amber-600" />
                      <span>2. Medicamento en 5 min</span>
                    </div>
                    <Play className="w-3.5 h-3.5 text-amber-600" />
                  </button>

                  <button
                    onClick={() => handleTestSound("med_overdue")}
                    className="p-2.5 bg-white hover:bg-rose-100/60 border border-rose-200 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>3. Medicamento Vencido</span>
                    </div>
                    <Play className="w-3.5 h-3.5 text-rose-600" />
                  </button>

                  <button
                    onClick={() => handleTestSound("shift_start")}
                    className="p-2.5 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>4. Turno por Iniciar</span>
                    </div>
                    <Play className="w-3.5 h-3.5 text-indigo-600" />
                  </button>

                  <button
                    onClick={() => handleTestSound("shift_end")}
                    className="sm:col-span-2 p-2.5 bg-white hover:bg-cyan-100/60 border border-cyan-200 rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-cyan-700" />
                      <span>5. Turno Vencido (+10 min) - Entrega & Cierre</span>
                    </div>
                    <Play className="w-3.5 h-3.5 text-cyan-700" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* NOTIFICATION HISTORY */
            <div className="space-y-3">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 pb-1 overflow-x-auto">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-colors ${
                    filter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter("meds")}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-colors flex items-center gap-1 ${
                    filter === "meds"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Medicamentos</span>
                </button>
                <button
                  onClick={() => setFilter("shifts")}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-colors flex items-center gap-1 ${
                    filter === "shifts"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Guardias & Turnos</span>
                </button>
              </div>

              {/* List */}
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="w-12 h-12 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h5 className="font-bold text-sm text-slate-700">No hay notificaciones pendientes</h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    El sistema te avisará automáticamente con sonido cuando tengas dosis programadas o cambios en tus guardias.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredNotifications.map((notif) => {
                    const isMedOverdue = notif.category === "med_overdue";
                    const isMed5Min = notif.category === "med_5min";
                    const isShiftStart = notif.category === "shift_start_soon";
                    const isShiftEnd = notif.category === "shift_end_10min";

                    return (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${
                          !notif.read
                            ? isMedOverdue
                              ? "bg-rose-50 border-rose-300 ring-1 ring-rose-400/40"
                              : isMed5Min
                              ? "bg-amber-50 border-amber-300 ring-1 ring-amber-400/40"
                              : isShiftStart
                              ? "bg-indigo-50 border-indigo-300"
                              : isShiftEnd
                              ? "bg-cyan-50 border-cyan-300"
                              : "bg-blue-50 border-blue-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                isMedOverdue
                                  ? "bg-rose-600 text-white"
                                  : isMed5Min
                                  ? "bg-amber-500 text-slate-950 font-bold"
                                  : isShiftStart
                                  ? "bg-indigo-600 text-white"
                                  : isShiftEnd
                                  ? "bg-cyan-600 text-white"
                                  : "bg-blue-600 text-white"
                              }`}
                            >
                              {isMedOverdue ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : isMed5Min ? (
                                <Pill className="w-3.5 h-3.5" />
                              ) : isShiftStart ? (
                                <Clock className="w-3.5 h-3.5" />
                              ) : isShiftEnd ? (
                                <ShieldAlert className="w-3.5 h-3.5" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                                {notif.title}
                              </h5>
                              <span className="text-[10px] text-slate-500">
                                {new Date(notif.timestamp).toLocaleString("es-MX", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>

                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                          )}
                        </div>

                        <p className="text-xs text-slate-600 pl-9.5">{notif.body}</p>

                        {/* Action Link Button */}
                        {notif.actionType && (
                          <div className="pl-9.5 pt-1 flex items-center justify-between">
                            <button
                              onClick={() => {
                                pushNotificationService.markAsRead(notif.id);
                                onClose();
                                if (onNavigateAction) {
                                  onNavigateAction(notif.actionType, notif.actionPayload);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <span>
                                {notif.actionType === "open_kardex"
                                  ? "Ir a Kárdex de Medicación"
                                  : notif.actionType === "start_guardia"
                                  ? "Iniciar Guardia en Bitácora"
                                  : notif.actionType === "end_guardia"
                                  ? "Finalizar Turno"
                                  : "Ver en Calendario"}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {!notif.read && (
                              <button
                                onClick={() => pushNotificationService.markAsRead(notif.id)}
                                className="text-[11px] text-slate-400 hover:text-slate-600 font-medium"
                              >
                                Marcar leída
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Monitoreo en tiempo real activo</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
