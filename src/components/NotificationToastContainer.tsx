import React, { useState, useEffect } from "react";
import { AppNotification, pushNotificationService } from "../services/pushNotificationService";
import {
  Bell,
  Pill,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Volume2,
  ChevronRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface NotificationToastContainerProps {
  onNavigateAction?: (
    actionType: AppNotification["actionType"],
    actionPayload?: AppNotification["actionPayload"]
  ) => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  onNavigateAction,
}) => {
  const [activeToasts, setActiveToasts] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsubscribe = pushNotificationService.subscribeToast((newToast) => {
      setActiveToasts((prev) => [newToast, ...prev.slice(0, 2)]);

      // Auto dismiss after 10 seconds (or 14s for overdue)
      const duration = newToast.category === "med_overdue" ? 14000 : 9000;
      setTimeout(() => {
        setActiveToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, duration);
    });

    return () => unsubscribe();
  }, []);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
    pushNotificationService.markAsRead(id);
  };

  const handleActionClick = (toast: AppNotification) => {
    dismissToast(toast.id);
    if (onNavigateAction && toast.actionType) {
      onNavigateAction(toast.actionType, toast.actionPayload);
    }
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-3 right-2 sm:right-6 left-2 sm:left-auto z-[100050] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-auto pointer-events-none">
      {activeToasts.map((toast) => {
        const isMedOverdue = toast.category === "med_overdue";
        const isMed5Min = toast.category === "med_5min";
        const isShiftStart = toast.category === "shift_start_soon";
        const isShiftEnd = toast.category === "shift_end_10min";
        const isShiftNew = toast.category === "shift_new" || toast.category === "shift_change";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl shadow-2xl p-4 border transition-all transform animate-slideInRight flex flex-col gap-2.5 backdrop-blur-md ${
              isMedOverdue
                ? "bg-rose-950/95 text-rose-50 border-rose-600 ring-2 ring-rose-500/50"
                : isMed5Min
                ? "bg-amber-950/95 text-amber-50 border-amber-500/80 ring-2 ring-amber-500/40"
                : isShiftStart
                ? "bg-indigo-950/95 text-indigo-50 border-indigo-500/80 ring-2 ring-indigo-500/40"
                : isShiftEnd
                ? "bg-slate-900/95 text-slate-50 border-cyan-500/80 ring-2 ring-cyan-500/40"
                : "bg-blue-950/95 text-blue-50 border-blue-500/80 ring-2 ring-blue-500/40"
            }`}
          >
            {/* Header: Icon + Category Badge + Sound indicator + Close */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                    isMedOverdue
                      ? "bg-rose-600 text-white animate-pulse"
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
                    <AlertTriangle className="w-4 h-4" />
                  ) : isMed5Min ? (
                    <Pill className="w-4 h-4" />
                  ) : isShiftStart ? (
                    <Clock className="w-4 h-4" />
                  ) : isShiftEnd ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span
                    className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full ${
                      isMedOverdue
                        ? "bg-rose-500/30 text-rose-200 border border-rose-500/40"
                        : isMed5Min
                        ? "bg-amber-500/30 text-amber-200 border border-amber-500/40"
                        : isShiftStart
                        ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/40"
                        : isShiftEnd
                        ? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
                        : "bg-blue-500/30 text-blue-200 border border-blue-500/40"
                    }`}
                  >
                    {isMedOverdue
                      ? "¡Medicamento Vencido!"
                      : isMed5Min
                      ? "Aviso en 5 Minutos"
                      : isShiftStart
                      ? "Turno Próximo a Iniciar"
                      : isShiftEnd
                      ? "Turno Vencido (+10 min)"
                      : "Guardia / Agenda"}
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-white mt-0.5 leading-tight">{toast.title}</h4>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span className="p-1 text-slate-300">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                </span>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="p-1 hover:bg-white/20 rounded-lg text-slate-300 hover:text-white transition-colors"
                  title="Cerrar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <p className="text-xs text-slate-200 leading-relaxed font-normal">{toast.body}</p>

            {/* Action Bar */}
            {toast.actionType && (
              <div className="flex items-center justify-between pt-1 border-t border-white/10 mt-0.5">
                <span className="text-[10px] text-slate-400">
                  {new Date(toast.timestamp).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  onClick={() => handleActionClick(toast)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
                    isMedOverdue
                      ? "bg-rose-500 hover:bg-rose-400 text-white"
                      : isMed5Min
                      ? "bg-amber-400 hover:bg-amber-300 text-slate-950 font-black"
                      : isShiftStart
                      ? "bg-indigo-500 hover:bg-indigo-400 text-white"
                      : isShiftEnd
                      ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black"
                      : "bg-blue-500 hover:bg-blue-400 text-white"
                  }`}
                >
                  <span>
                    {toast.actionType === "open_kardex"
                      ? "Abrir Kárdex"
                      : toast.actionType === "start_guardia"
                      ? "Iniciar Guardia"
                      : toast.actionType === "end_guardia"
                      ? "Finalizar Turno"
                      : "Ver en Agenda"}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
