import React, { useState, useEffect, useMemo } from "react";
import { AuditLog, AuditActionType, UserRole } from "../types";
import { subscribeToAuditLogs } from "../services/auditService";
import {
  ShieldAlert,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Shield,
  Activity,
  FileText,
  Eye,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  Tag,
  FileCheck,
  MapPin,
  ExternalLink,
  Navigation,
  Globe,
  Smartphone,
  Laptop,
} from "lucide-react";

interface AuditLogViewerProps {
  currentUserRole?: UserRole;
  isSuperAdmin?: boolean;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  currentUserRole = "admin",
  isSuperAdmin = false,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToAuditLogs((items) => {
      setLogs(items);
      setLoading(false);
    });

    const handleLocalAuditUpdate = (e: any) => {
      if (e?.detail) {
        setLogs((prev) => [e.detail, ...prev.filter((l) => l.id !== e.detail.id)]);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("audit-log-updated", handleLocalAuditUpdate);
    }

    return () => {
      unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("audit-log-updated", handleLocalAuditUpdate);
      }
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const locText = log.ubicacion
        ? `${log.ubicacion.city || ""} ${log.ubicacion.state || ""} ${log.ubicacion.country || ""} ${log.ubicacion.latitude || ""} ${log.ubicacion.longitude || ""}`
        : "";

      const matchSearch =
        !searchQuery ||
        log.usuarioUx.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.usuarioNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
        locText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.folioReferencia && log.folioReferencia.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.clienteIdReferencia && log.clienteIdReferencia.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchAction = actionFilter === "ALL" || log.tipoAccion === actionFilter;
      const matchRole = roleFilter === "ALL" || log.rol === roleFilter;

      return matchSearch && matchAction && matchRole;
    });
  }, [logs, searchQuery, actionFilter, roleFilter]);

  const getActionBadge = (tipo: AuditActionType) => {
    switch (tipo) {
      case "CREAR_CARATULA":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <FileCheck className="w-3 h-3" /> Carátula Creada
          </span>
        );
      case "CREAR_COTIZACION":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Cotización Creada
          </span>
        );
      case "CONSULTA_CLIENTE":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Consulta Cliente
          </span>
        );
      case "CONSULTA_CARATULA":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Consulta Carátula
          </span>
        );
      case "LOGIN_EXITOSO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Login Exitoso
          </span>
        );
      case "ACCESO_DENEGADO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Acceso Denegado
          </span>
        );
      case "INGRESO_PORTAL":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <Globe className="w-3 h-3" /> Ingreso a Portal
          </span>
        );
      case "LOGOUT":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30 flex items-center gap-1">
            <User className="w-3 h-3" /> Cierre de Sesión
          </span>
        );
      case "AGENDAR_TURNO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Guardia Agendada
          </span>
        );
      case "MODIFICAR_TURNO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Guardia Modificada
          </span>
        );
      case "ELIMINAR_TURNO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Guardia Eliminada
          </span>
        );
      case "INICIO_TURNO_ENFERMERIA":
      case "FIN_TURNO_ENFERMERIA":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Turno Enfermería
          </span>
        );
      case "REGISTRAR_EXPEDIENTE":
      case "MODIFICAR_EXPEDIENTE":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Expediente Clínico
          </span>
        );
      case "ADMINISTRAR_MEDICAMENTO":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Medicamento Administrado
          </span>
        );
      case "CREAR_CLIENTE":
      case "MODIFICAR_CLIENTE":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <User className="w-3 h-3" /> Gestión Cliente
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
            {tipo}
          </span>
        );
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <span className="text-[10px] font-bold text-amber-400">Admin</span>;
      case "ventas":
        return <span className="text-[10px] font-bold text-indigo-400">Ventas</span>;
      case "atencion_clientes":
        return <span className="text-[10px] font-bold text-teal-400">Atención</span>;
      case "nurse":
        return <span className="text-[10px] font-bold text-emerald-400">Enfermería</span>;
      case "client":
        return <span className="text-[10px] font-bold text-sky-400">Cliente</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              Registro de Auditoría de Operaciones
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {logs.length} registros
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Trazabilidad inmutable de carátulas emitidas, cotizaciones, geoposición y accesos por rol y usuario.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario, folio, ciudad o detalle..."
            className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white py-2 px-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">-- Todas las Acciones --</option>
            <option value="CREAR_CARATULA">Creación de Carátula</option>
            <option value="CREAR_COTIZACION">Creación de Cotización</option>
            <option value="CONSULTA_CARATULA">Consulta de Carátula</option>
            <option value="CONSULTA_CLIENTE">Consulta de Cliente</option>
            <option value="CREAR_CLIENTE">Registro de Cliente</option>
            <option value="LOGIN_EXITOSO">Inicio de Sesión</option>
            <option value="ACCESO_DENEGADO">Acceso Denegado</option>
          </select>
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white py-2 px-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">-- Todos los Roles --</option>
            <option value="admin">Administrador</option>
            <option value="ventas">Ventas</option>
            <option value="atencion_clientes">Atención a Clientes</option>
            <option value="nurse">Enfermería</option>
            <option value="client">Cliente</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Usuario Responsable</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Ubicación Registrada</th>
                <th className="py-3 px-4">Descripción / Folio</th>
                <th className="py-3 px-4 text-right">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Cargando bitácora de auditoría...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500">
                    No se encontraron registros de auditoría que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const loc = log.ubicacion;
                  const hasCoords = typeof loc?.latitude === "number" && typeof loc?.longitude === "number";
                  const mapsUrl = loc?.mapsUrl || (hasCoords ? `https://www.google.com/maps?q=${loc!.latitude},${loc!.longitude}` : undefined);

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {log.fechaHoraFormateada || new Date(log.fechaHoraIso).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getActionBadge(log.tipoAccion)}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        <div>{log.usuarioNombre}</div>
                        <div className="text-[10px] font-mono text-slate-400">@{log.usuarioUx}</div>
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(log.rol)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {loc ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-medium text-emerald-400 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{loc.city || "Pachuca de Soto"}{loc.state ? `, ${loc.state}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              {hasCoords ? (
                                <span title={`Precisión: ~${loc.accuracy || 0}m`}>
                                  {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                                </span>
                              ) : (
                                <span>{loc.rawAddress || "Ubicación detectada"}</span>
                              )}
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 ml-1 underline cursor-pointer"
                                  title="Abrir en Google Maps"
                                >
                                  <span>Ver mapa</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">No registrada</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">{log.descripcion}</div>
                        {(log.folioReferencia || log.clienteIdReferencia) && (
                          <div className="text-[10px] font-mono text-sky-400 flex items-center gap-2 mt-0.5">
                            {log.folioReferencia && <span>Folio: {log.folioReferencia}</span>}
                            {log.clienteIdReferencia && <span>Cliente: {log.clienteIdReferencia}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-bold cursor-pointer transition"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON & Geo Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Detalles del Evento de Auditoría</h3>
                <span className="text-[10px] font-mono text-indigo-400">{selectedLog.id}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Geolocation Card */}
            {selectedLog.ubicacion && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <MapPin className="w-4 h-4" />
                    <span>Ubicación del Usuario al Operar</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Fuente: {selectedLog.ubicacion.source?.toUpperCase() || "GPS"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Ciudad / Región:</span>
                    <span className="text-white font-medium">
                      {selectedLog.ubicacion.city || "Pachuca de Soto"}, {selectedLog.ubicacion.state || "Hidalgo"}
                    </span>
                  </div>
                  {selectedLog.ubicacion.latitude && selectedLog.ubicacion.longitude && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Coordenadas GPS:</span>
                      <span className="text-white font-mono text-[11px]">
                        {selectedLog.ubicacion.latitude}, {selectedLog.ubicacion.longitude}
                      </span>
                    </div>
                  )}
                  {selectedLog.ubicacion.accuracy && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Precisión de señal:</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        ±{selectedLog.ubicacion.accuracy} metros
                      </span>
                    </div>
                  )}
                  {selectedLog.ubicacion.ip && (
                    <div>
                      <span className="text-slate-500 block text-[10px]">Dirección IP:</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {selectedLog.ubicacion.ip}
                      </span>
                    </div>
                  )}
                </div>

                {selectedLog.ubicacion.latitude && selectedLog.ubicacion.longitude && (
                  <div className="pt-2">
                    <a
                      href={`https://www.google.com/maps?q=${selectedLog.ubicacion.latitude},${selectedLog.ubicacion.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Abrir Coordenadas en Google Maps</span>
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Device Info */}
            {selectedLog.dispositivo && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                <div className="text-slate-400 font-bold text-[11px] flex items-center gap-1.5">
                  {selectedLog.dispositivo.isMobile ? <Smartphone className="w-3.5 h-3.5 text-sky-400" /> : <Laptop className="w-3.5 h-3.5 text-sky-400" />}
                  <span>Dispositivo: {selectedLog.dispositivo.platform || "Navegador"}</span>
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">
                  {selectedLog.dispositivo.userAgent}
                </div>
              </div>
            )}

            {/* JSON Payload */}
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-bold">Datos del Registro:</span>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 overflow-x-auto max-h-48">
                <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
