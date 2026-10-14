import React, { useState, useMemo } from "react";
import {
  Database,
  Download,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Server,
  FileText,
  Users,
  Briefcase,
  Receipt,
  Calendar,
  Stethoscope,
  Upload,
  Lock,
  Filter,
  UserCheck,
  Clock,
  Package,
  FileSignature,
  Activity,
  AlertCircle
} from "lucide-react";
import {
  Caratula,
  Client,
  ServiceItem,
  Expense,
  AbonoTicket,
  ServiceCategory,
  CalendarEvent,
  ExpedienteEntry,
  KardexRecord,
  InventoryItem,
  StaffMember,
  SystemUser,
  CorteDeCajaRecord,
  GuardiaShiftRecord,
  IncidenciaTicket,
  SolicitudIncrementoServicio
} from "../types";
import { formatCurrency } from "../utils/formatters";
import { RestoreBackupModal } from "./RestoreBackupModal";

interface DatabaseBackupManagerProps {
  caratulas: Caratula[];
  clients: Client[];
  services: ServiceItem[];
  expenses: Expense[];
  abonos: AbonoTicket[];
  categories: ServiceCategory[];
  calendarEvents: CalendarEvent[];
  expedienteEntries: ExpedienteEntry[];
  kardexRecords: KardexRecord[];
  inventoryItems?: InventoryItem[];
  staffMembers?: StaffMember[];
  systemUsers?: SystemUser[];
  cortesHistory?: CorteDeCajaRecord[];
  guardiaRecords?: GuardiaShiftRecord[];
  incidencias?: IncidenciaTicket[];
  solicitudesIncremento?: SolicitudIncrementoServicio[];
  currentUserName?: string;
  userRole?: string;
  onRestoreCompleted?: (data: any) => void;
}

export const DatabaseBackupManager: React.FC<DatabaseBackupManagerProps> = ({
  caratulas = [],
  clients = [],
  services = [],
  expenses = [],
  abonos = [],
  categories = [],
  calendarEvents = [],
  expedienteEntries = [],
  kardexRecords = [],
  inventoryItems = [],
  staffMembers = [],
  systemUsers = [],
  cortesHistory = [],
  guardiaRecords = [],
  incidencias = [],
  solicitudesIncremento = [],
  currentUserName = "Administrador",
  userRole = "admin",
  onRestoreCompleted,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState<boolean>(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");

  const todayStr = new Date().toISOString().slice(0, 10);

  // Helper to trigger browser JSON file download
  const downloadJSONFile = (dataObj: any, filename: string) => {
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to convert objects array to CSV string
  const downloadCSVFile = (dataArray: any[], filename: string) => {
    if (!dataArray || dataArray.length === 0) {
      alert("No hay registros en esta colección para exportar.");
      return;
    }

    // Extract headers
    const keys = Array.from(
      new Set(dataArray.flatMap((item) => Object.keys(item)))
    );

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += keys.join(",") + "\n";

    dataArray.forEach((row) => {
      const line = keys.map((key) => {
        let val = row[key];
        if (val === undefined || val === null) return '""';
        if (typeof val === "object") {
          val = JSON.stringify(val);
        }
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      });
      csvContent += line.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Combined users list for filtering dropdown
  const filterableUsers = useMemo(() => {
    const list: Array<{ id: string; name: string; type: "STAFF" | "USER"; badge: string }> = [];

    staffMembers.forEach((s) => {
      list.push({
        id: s.id || `staff-${s.noSocio}`,
        name: `${s.nombre} ${s.apellidos} (${s.noSocio ? `SOCP-${s.noSocio}` : s.puestoTipoPersonal})`,
        type: "STAFF",
        badge: s.esSocioOperativo ? "Socio Operativo Urgencias" : s.puestoTipoPersonal,
      });
    });

    systemUsers.forEach((u) => {
      if (!list.some((existing) => existing.id === u.id)) {
        list.push({
          id: u.id,
          name: `${u.nombre} (${u.username} - ${u.role})`,
          type: "USER",
          badge: u.role,
        });
      }
    });

    return list;
  }, [staffMembers, systemUsers]);

  // Filtered dataset according to selected user
  const userFilteredData = useMemo(() => {
    if (selectedUserFilter === "ALL") {
      return {
        isFiltered: false,
        userLabel: "Base de Datos Completa (Todos los Registros)",
        caratulas,
        clients,
        services,
        expenses,
        abonos,
        categories,
        calendarEvents,
        expedienteEntries,
        kardexRecords,
        inventoryItems,
        staffMembers,
        systemUsers,
        cortesHistory,
        guardiaRecords,
        incidencias,
        solicitudesIncremento,
      };
    }

    const targetUser = filterableUsers.find((u) => u.id === selectedUserFilter);
    const targetStaff = staffMembers.find((s) => s.id === selectedUserFilter || `staff-${s.noSocio}` === selectedUserFilter);
    const targetSysUser = systemUsers.find((u) => u.id === selectedUserFilter);

    const staffName = targetStaff ? `${targetStaff.nombre} ${targetStaff.apellidos}`.toLowerCase() : "";
    const staffNoSocio = targetStaff?.noSocio?.toLowerCase() || "";
    const username = targetSysUser?.username?.toLowerCase() || "";

    const userGuardias = guardiaRecords.filter((g) => {
      if (targetStaff && (g.staffId === targetStaff.id || g.staffNoSocio === targetStaff.noSocio)) return true;
      if (staffName && g.staffNombre?.toLowerCase().includes(staffName)) return true;
      return false;
    });

    const userExpedientes = expedienteEntries.filter((e) => {
      if (targetStaff && e.enfermeraTurno && e.enfermeraTurno.toLowerCase().includes(staffName)) return true;
      if (username && e.enfermeraTurno && e.enfermeraTurno.toLowerCase().includes(username)) return true;
      if (targetStaff && e.staffNoSocio === targetStaff.noSocio) return true;
      return false;
    });

    const userKardex = kardexRecords.filter((k) => {
      if (targetStaff && k.administradoPor && k.administradoPor.toLowerCase().includes(staffName)) return true;
      if (username && k.administradoPor && k.administradoPor.toLowerCase().includes(username)) return true;
      return false;
    });

    const userCalendarEvents = calendarEvents.filter((c) => {
      if (targetStaff && c.staffId === targetStaff.id) return true;
      if (targetStaff && c.staffNoSocio === targetStaff.noSocio) return true;
      if (staffName && c.title?.toLowerCase().includes(staffName)) return true;
      return false;
    });

    const userIncidencias = incidencias.filter((i) => {
      if (targetStaff && i.staffId === targetStaff.id) return true;
      if (targetStaff && i.staffNoSocio === targetStaff.noSocio) return true;
      if (staffName && i.reportadoPor?.toLowerCase().includes(staffName)) return true;
      return false;
    });

    // Assigned clients to this staff
    const userClients = clients.filter((c) => {
      if (!targetStaff) return false;
      const idMatch = c.staffAsignadoId === targetStaff.id || c.staffAsignadoNoSocio === targetStaff.noSocio;
      const nameMatch = staffName && c.staffAsignadoNombre?.toLowerCase().includes(staffName);
      const listMatch = c.personalAsignadoIds?.includes(targetStaff.id) || c.receptoresAsignados?.some((r) => r.staffId === targetStaff.id);
      return Boolean(idMatch || nameMatch || listMatch);
    });

    const userClientIds = new Set(userClients.map((c) => c.id));
    const userCaratulas = caratulas.filter((ct) => userClientIds.has(ct.clienteId || ""));

    return {
      isFiltered: true,
      userLabel: targetUser?.name || selectedUserFilter,
      caratulas: userCaratulas,
      clients: userClients,
      services,
      expenses: [],
      abonos: [],
      categories,
      calendarEvents: userCalendarEvents,
      expedienteEntries: userExpedientes,
      kardexRecords: userKardex,
      inventoryItems,
      staffMembers: targetStaff ? [targetStaff] : [],
      systemUsers: targetSysUser ? [targetSysUser] : [],
      cortesHistory: [],
      guardiaRecords: userGuardias,
      incidencias: userIncidencias,
      solicitudesIncremento: [],
    };
  }, [
    selectedUserFilter,
    filterableUsers,
    caratulas,
    clients,
    services,
    expenses,
    abonos,
    categories,
    calendarEvents,
    expedienteEntries,
    kardexRecords,
    inventoryItems,
    staffMembers,
    systemUsers,
    cortesHistory,
    guardiaRecords,
    incidencias,
    solicitudesIncremento,
  ]);

  // Export database backup JSON (full or filtered)
  const handleExportBackup = (onlyFiltered: boolean = false) => {
    const isExportingFiltered = onlyFiltered && userFilteredData.isFiltered;
    const dataToExport = isExportingFiltered ? userFilteredData : {
      isFiltered: false,
      userLabel: "Completa",
      caratulas,
      clients,
      services,
      expenses,
      abonos,
      categories,
      calendarEvents,
      expedienteEntries,
      kardexRecords,
      inventoryItems,
      staffMembers,
      systemUsers,
      cortesHistory,
      guardiaRecords,
      incidencias,
      solicitudesIncremento,
    };

    const totalRecords =
      dataToExport.caratulas.length +
      dataToExport.clients.length +
      dataToExport.services.length +
      dataToExport.expenses.length +
      dataToExport.abonos.length +
      dataToExport.categories.length +
      dataToExport.calendarEvents.length +
      dataToExport.expedienteEntries.length +
      dataToExport.kardexRecords.length +
      (dataToExport.inventoryItems?.length || 0) +
      (dataToExport.staffMembers?.length || 0) +
      (dataToExport.systemUsers?.length || 0) +
      (dataToExport.cortesHistory?.length || 0) +
      (dataToExport.guardiaRecords?.length || 0) +
      (dataToExport.incidencias?.length || 0) +
      (dataToExport.solicitudesIncremento?.length || 0);

    const backupData = {
      backupInfo: {
        sistema: "Cuidarte Pachuca - Base de Datos Integral",
        tipoRespaldo: isExportingFiltered ? `Filtrado por Usuario: ${dataToExport.userLabel}` : "Respaldo Total de Base de Datos",
        fechaExportacion: new Date().toLocaleString("es-MX"),
        isoTimestamp: new Date().toISOString(),
        generadoPor: currentUserName,
        totalRegistrosCount: totalRecords,
        schemaVersion: "2026.2",
      },
      colecciones: {
        caratulas: dataToExport.caratulas,
        clientes: dataToExport.clients,
        servicios: dataToExport.services,
        gastos: dataToExport.expenses,
        abonosCaja: dataToExport.abonos,
        categoriasServicios: dataToExport.categories,
        agendaTurnos: dataToExport.calendarEvents,
        expedientesMedicos: dataToExport.expedienteEntries,
        kardexMedicamentos: dataToExport.kardexRecords,
        inventarioInsumos: dataToExport.inventoryItems,
        personalYSocios: dataToExport.staffMembers,
        usuariosSistema: dataToExport.systemUsers,
        cortesDeCaja: dataToExport.cortesHistory,
        guardiasYTurnos: dataToExport.guardiaRecords,
        incidencias: dataToExport.incidencias,
        solicitudesIncremento: dataToExport.solicitudesIncremento,
      },
    };

    const sanitizedLabel = isExportingFiltered
      ? `_Usuario_${dataToExport.userLabel.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 25)}`
      : "_COMPLETO";

    const fileName = `Respaldo_BaseDeDatos_CuidartePachuca${sanitizedLabel}_${todayStr}.json`;
    downloadJSONFile(backupData, fileName);

    setDownloadSuccess(`Respaldo descargado exitosamente: ${fileName}`);
    setTimeout(() => setDownloadSuccess(null), 6000);
  };

  const collectionsStats = [
    {
      title: "Personal, Socios y Credenciales",
      count: staffMembers.length,
      icon: <Users className="w-5 h-5 text-rose-600" />,
      color: "bg-rose-50 text-rose-800 border-rose-200",
      data: staffMembers,
      jsonName: `Personal_Socios_Cuidarte_${todayStr}.json`,
      csvName: `Personal_Socios_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Control de Guardias y Turnos",
      count: guardiaRecords.length,
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      color: "bg-amber-50 text-amber-800 border-amber-200",
      data: guardiaRecords,
      jsonName: `Guardias_Turnos_Cuidarte_${todayStr}.json`,
      csvName: `Guardias_Turnos_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Directorio de Clientes y Receptores",
      count: clients.length,
      icon: <Users className="w-5 h-5 text-indigo-600" />,
      color: "bg-indigo-50 text-indigo-800 border-indigo-200",
      data: clients,
      jsonName: `Clientes_Cuidarte_${todayStr}.json`,
      csvName: `Clientes_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Carátulas y Cotizaciones Oficiales",
      count: caratulas.length,
      icon: <FileText className="w-5 h-5 text-sky-600" />,
      color: "bg-sky-50 text-sky-800 border-sky-200",
      data: caratulas,
      jsonName: `Caratulas_Cuidarte_${todayStr}.json`,
      csvName: `Caratulas_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Expedientes y Notas de Enfermería",
      count: expedienteEntries.length,
      icon: <Stethoscope className="w-5 h-5 text-purple-600" />,
      color: "bg-purple-50 text-purple-800 border-purple-200",
      data: expedienteEntries,
      jsonName: `Expedientes_Medicos_Cuidarte_${todayStr}.json`,
      csvName: `Expedientes_Medicos_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Kárdex de Medicamentos",
      count: kardexRecords.length,
      icon: <Activity className="w-5 h-5 text-emerald-600" />,
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      data: kardexRecords,
      jsonName: `Kardex_Medicamentos_Cuidarte_${todayStr}.json`,
      csvName: `Kardex_Medicamentos_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Inventario de Insumos y Equipos",
      count: inventoryItems.length,
      icon: <Package className="w-5 h-5 text-teal-600" />,
      color: "bg-teal-50 text-teal-800 border-teal-200",
      data: inventoryItems,
      jsonName: `Inventario_Cuidarte_${todayStr}.json`,
      csvName: `Inventario_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Catálogo de Servicios y Costos",
      count: services.length,
      icon: <Briefcase className="w-5 h-5 text-blue-600" />,
      color: "bg-blue-50 text-blue-800 border-blue-200",
      data: services,
      jsonName: `Servicios_Cuidarte_${todayStr}.json`,
      csvName: `Servicios_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Gastos y Egresos Operativos",
      count: expenses.length,
      icon: <Receipt className="w-5 h-5 text-rose-600" />,
      color: "bg-rose-50 text-rose-800 border-rose-200",
      data: expenses,
      jsonName: `Gastos_Cuidarte_${todayStr}.json`,
      csvName: `Gastos_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Abonos y Recibos de Caja",
      count: abonos.length,
      icon: <Database className="w-5 h-5 text-emerald-600" />,
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      data: abonos,
      jsonName: `Abonos_Caja_Cuidarte_${todayStr}.json`,
      csvName: `Abonos_Caja_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Agenda de Turnos y Eventos",
      count: calendarEvents.length,
      icon: <Calendar className="w-5 h-5 text-sky-600" />,
      color: "bg-sky-50 text-sky-800 border-sky-200",
      data: calendarEvents,
      jsonName: `Agenda_Turnos_Cuidarte_${todayStr}.json`,
      csvName: `Agenda_Turnos_Cuidarte_${todayStr}.csv`,
    },
    {
      title: "Usuarios y Credenciales del Sistema",
      count: systemUsers.length,
      icon: <Lock className="w-5 h-5 text-slate-600" />,
      color: "bg-slate-50 text-slate-800 border-slate-200",
      data: systemUsers,
      jsonName: `Usuarios_Sistema_Cuidarte_${todayStr}.json`,
      csvName: `Usuarios_Sistema_Cuidarte_${todayStr}.csv`,
    },
  ];

  const grandTotalRecords =
    caratulas.length +
    clients.length +
    services.length +
    expenses.length +
    abonos.length +
    categories.length +
    calendarEvents.length +
    expedienteEntries.length +
    kardexRecords.length +
    inventoryItems.length +
    staffMembers.length +
    systemUsers.length +
    cortesHistory.length +
    guardiaRecords.length +
    incidencias.length +
    solicitudesIncremento.length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <HardDrive className="w-64 h-64 text-sky-400" />
        </div>

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            Acceso Exclusivo Administración • Respaldo Integral de Base de Datos
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Descarga de Base de Datos y Respaldos Completos
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Genera una copia de seguridad exhaustiva de <strong>toda la base de datos</strong> (sin que falte ningún registro ni colección), o filtra la descarga para un socio o usuario específico.
          </p>

          {/* User Filtering Section */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Filter className="w-4 h-4 text-sky-400" />
                <span>Modo de Descarga del Respaldo:</span>
              </label>
              {userFilteredData.isFiltered && (
                <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-600/50">
                  Filtro activo: {userFilteredData.userLabel}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="w-full sm:flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 font-semibold focus:outline-none focus:border-sky-500"
              >
                <option value="ALL">🌐 Descarga Completa de Toda la Base de Datos ({grandTotalRecords} registros)</option>
                <optgroup label="Filtrar por Socio / Personal Operativo:">
                  {filterableUsers
                    .filter((u) => u.type === "STAFF")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        👤 {u.name} — [{u.badge}]
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Filtrar por Usuario del Sistema:">
                  {filterableUsers
                    .filter((u) => u.type === "USER")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        🔑 {u.name}
                      </option>
                    ))}
                </optgroup>
              </select>

              {selectedUserFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedUserFilter("ALL")}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition whitespace-nowrap"
                >
                  Restablecer a Todos
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {selectedUserFilter === "ALL" ? (
              <button
                onClick={() => handleExportBackup(false)}
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-sky-900/40 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 min-h-[48px]"
              >
                <Download className="w-5 h-5" />
                <span>Descargar Respaldo Completo Total (JSON)</span>
              </button>
            ) : (
              <button
                onClick={() => handleExportBackup(true)}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-amber-900/40 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 min-h-[48px]"
              >
                <Download className="w-5 h-5" />
                <span>Descargar Respaldo Filtrado del Usuario (JSON)</span>
              </button>
            )}

            <button
              onClick={() => setRestoreModalOpen(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-900/40 flex items-center gap-2.5 transition-all transform hover:-translate-y-0.5 min-h-[48px] border border-emerald-400/30"
            >
              <Upload className="w-5 h-5 text-emerald-200" />
              <span>Restaurar Copia de Seguridad JSON</span>
            </button>
          </div>

          {downloadSuccess && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-sky-600" />
              Módulos y Colecciones de la Base de Datos
            </h2>
            <p className="text-xs text-slate-500">
              Descarga colecciones específicas en formato JSON o CSV (compatible con Excel)
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
            Total Base de Datos: {grandTotalRecords} registros
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collectionsStats.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2.5 rounded-xl border ${item.color}`}>
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {item.title}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.count} registros activos
                    </span>
                  </div>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                <button
                  onClick={() => downloadJSONFile(item.data, item.jsonName)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition min-h-[38px]"
                  title="Descargar archivo JSON"
                >
                  <FileJson className="w-4 h-4 text-sky-600" />
                  <span>JSON</span>
                </button>

                <button
                  onClick={() => downloadCSVFile(item.data, item.csvName)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition min-h-[38px]"
                  title="Descargar archivo CSV Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Restore Section Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700 p-6 shadow-xl text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                Acceso Exclusivo • Super Administrador
              </div>
              <h3 className="text-lg font-black text-white">
                Restauración de Copia de Seguridad JSON
              </h3>
              <p className="text-xs text-slate-300 max-w-xl mt-1 leading-relaxed">
                Si requieres restaurar clientes, historial de carátulas, socios de enfermería, inventario o expedientes médicos desde un archivo JSON previamente descargado, puedes procesarlo aquí de forma segura.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRestoreModalOpen(true)}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition whitespace-nowrap border border-emerald-400/40 shrink-0 min-h-[46px]"
          >
            <Upload className="w-4 h-4 text-emerald-200" />
            <span>Abrir Asistente de Restauración</span>
          </button>
        </div>
      </div>

      {/* Security & Data Integrity Note */}
      <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 flex items-start gap-3.5 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">
            Seguridad y Privacidad de la Información
          </p>
          <p className="leading-relaxed">
            Los respaldos generados contienen información protegida de Cuidarte México, sus clientes, personal y expedientes de atención. Almacena las copias de seguridad en un disco seguro o almacenamiento encriptado. Solo el personal de administración tiene privilegios para ejecutar y descargar respaldos.
          </p>
        </div>
      </div>

      {/* Modal de Restauración */}
      <RestoreBackupModal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        onRestoreCompleted={onRestoreCompleted}
      />
    </div>
  );
};
