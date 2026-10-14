import React, { useState, useRef } from "react";
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  Database,
  X,
  Loader2,
  Users,
  FileText,
  Briefcase,
  Stethoscope,
  Receipt,
  Calendar,
  Pill,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  Client,
  ServiceItem,
  Caratula,
  Expense,
  AbonoTicket,
  ServiceCategory,
  CalendarEvent,
  ExpedienteEntry,
  KardexRecord,
  StaffMember,
  SystemUser,
  InventoryItem,
  CorteDeCajaRecord,
  GuardiaShiftRecord,
  IncidenciaTicket,
  SolicitudIncrementoServicio,
} from "../types";
import {
  saveCaratulas,
  saveClients,
  saveServices,
  saveExpenses,
  saveAbonos,
  saveCategories,
  saveCalendarEvents,
  saveExpedienteEntries,
  saveKardexRecords,
  saveStaffMembers,
  saveSystemUsers,
  saveInventory,
  saveCortes,
  saveGuardias,
  saveIncidencias,
  saveSolicitudesIncremento,
} from "../utils/storage";
import {
  saveClientToFirestore,
  saveCaratulaToFirestore,
  saveServiceToFirestore,
  saveExpenseToFirestore,
  saveAbonoToFirestore,
  saveStaffMemberToFirestore,
  saveSystemUserToFirestore,
  saveCalendarEventToFirestore,
  saveExpedienteEntryToFirestore,
  saveKardexRecordToFirestore,
  saveInventoryItemToFirestore,
} from "../services/firestoreSync";

export interface BackupDataPayload {
  caratulas?: Caratula[];
  clientes?: Client[];
  clients?: Client[];
  servicios?: ServiceItem[];
  services?: ServiceItem[];
  gastos?: Expense[];
  expenses?: Expense[];
  abonosCaja?: AbonoTicket[];
  abonos?: AbonoTicket[];
  categoriasServicios?: ServiceCategory[];
  categories?: ServiceCategory[];
  agendaTurnos?: CalendarEvent[];
  calendarEvents?: CalendarEvent[];
  expedientesMedicos?: ExpedienteEntry[];
  expedienteEntries?: ExpedienteEntry[];
  kardexMedicamentos?: KardexRecord[];
  kardexRecords?: KardexRecord[];
  personalSocios?: StaffMember[];
  staffMembers?: StaffMember[];
  staff?: StaffMember[];
  socios?: StaffMember[];
  usuariosSistema?: SystemUser[];
  systemUsers?: SystemUser[];
  users?: SystemUser[];
  inventario?: InventoryItem[];
  inventoryItems?: InventoryItem[];
  cortesCaja?: CorteDeCajaRecord[];
  guardias?: GuardiaShiftRecord[];
  incidencias?: IncidenciaTicket[];
  solicitudesIncremento?: SolicitudIncrementoServicio[];
}

interface RestoreBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreCompleted?: (data: BackupDataPayload) => void;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreCompleted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<BackupDataPayload | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content || !content.trim()) {
          setErrorMsg("El archivo seleccionado está vacío.");
          setParsedData(null);
          return;
        }

        const rawJson = JSON.parse(content);

        // Normalize various backup structures
        let payload: any = {};

        if (Array.isArray(rawJson)) {
          // If the JSON is a raw array of items
          if (rawJson.length > 0) {
            const first = rawJson[0];
            if ("nombreCompletoCliente" in first || "telefono" in first || "noExpediente" in first) {
              payload.clientes = rawJson;
            } else if ("folio" in first || "datosServicio" in first) {
              payload.caratulas = rawJson;
            } else if ("nombreCompleto" in first || "noSocio" in first || "cedulaProfesional" in first) {
              payload.personalSocios = rawJson;
            } else if ("nombreServicio" in first || "precio" in first) {
              payload.servicios = rawJson;
            } else if ("medicamento" in first || "dosis" in first) {
              payload.kardexMedicamentos = rawJson;
            } else {
              payload.items = rawJson;
            }
          }
        } else if (typeof rawJson === "object" && rawJson !== null) {
          // Check if nested in colecciones, data, datos, backup, or root
          const source = rawJson.colecciones || rawJson.datos || rawJson.data || rawJson.backup || rawJson;

          payload = {
            clientes: source.clientes || source.clients || rawJson.clientes || rawJson.clients || [],
            caratulas: source.caratulas || rawJson.caratulas || [],
            servicios: source.servicios || source.services || rawJson.servicios || rawJson.services || [],
            gastos: source.gastos || source.expenses || rawJson.gastos || rawJson.expenses || [],
            abonosCaja: source.abonosCaja || source.abonos || rawJson.abonosCaja || rawJson.abonos || [],
            categoriasServicios: source.categoriasServicios || source.categories || rawJson.categoriasServicios || rawJson.categories || [],
            agendaTurnos: source.agendaTurnos || source.calendarEvents || source.events || rawJson.agendaTurnos || rawJson.calendarEvents || [],
            expedientesMedicos: source.expedientesMedicos || source.expedienteEntries || source.expedientes || rawJson.expedientesMedicos || rawJson.expedienteEntries || [],
            kardexMedicamentos: source.kardexMedicamentos || source.kardexRecords || source.kardex || rawJson.kardexMedicamentos || rawJson.kardexRecords || [],
            personalSocios: source.personalSocios || source.staffMembers || source.staff || source.socios || rawJson.personalSocios || rawJson.staffMembers || rawJson.staff || rawJson.socios || [],
            usuariosSistema: source.usuariosSistema || source.systemUsers || source.users || rawJson.usuariosSistema || rawJson.systemUsers || rawJson.users || [],
            inventario: source.inventario || source.inventoryItems || source.inventory || rawJson.inventario || rawJson.inventoryItems || [],
            cortesCaja: source.cortesCaja || source.cortes || rawJson.cortesCaja || rawJson.cortes || [],
            guardias: source.guardias || rawJson.guardias || [],
            incidencias: source.incidencias || rawJson.incidencias || [],
            solicitudesIncremento: source.solicitudesIncremento || rawJson.solicitudesIncremento || [],
          };
        }

        const counts = calculateCounts(payload);
        if (counts.total === 0) {
          // If no recognized keys, store the object directly to allow fallback
          console.warn("[Restore] No standard keys recognized, dumping object keys:", Object.keys(rawJson));
          setParsedData(rawJson);
        } else {
          setParsedData(payload);
        }
      } catch (err: any) {
        console.error("Error al leer archivo JSON:", err);
        setErrorMsg("El archivo seleccionado no tiene un formato JSON válido: " + (err?.message || ""));
        setParsedData(null);
      }
    };
    reader.readAsText(file);
  };

  const calculateCounts = (data: any | null) => {
    if (!data) return { total: 0, details: [] };
    const clientsList = data.clientes || data.clients || [];
    const caratulasList = data.caratulas || [];
    const servicesList = data.servicios || data.services || [];
    const expensesList = data.gastos || data.expenses || [];
    const abonosList = data.abonosCaja || data.abonos || [];
    const eventsList = data.agendaTurnos || data.calendarEvents || [];
    const expList = data.expedientesMedicos || data.expedienteEntries || [];
    const kardexList = data.kardexMedicamentos || data.kardexRecords || [];
    const staffList = data.personalSocios || data.staffMembers || data.staff || data.socios || [];
    const usersList = data.usuariosSistema || data.systemUsers || data.users || [];
    const invList = data.inventario || data.inventoryItems || [];

    let total =
      clientsList.length +
      caratulasList.length +
      servicesList.length +
      expensesList.length +
      abonosList.length +
      eventsList.length +
      expList.length +
      kardexList.length +
      staffList.length +
      usersList.length +
      invList.length;

    const details = [
      { name: "Clientes / Pacientes", count: clientsList.length, icon: Users, color: "text-indigo-600 bg-indigo-50" },
      { name: "Carátulas de Servicio", count: caratulasList.length, icon: FileText, color: "text-sky-600 bg-sky-50" },
      { name: "Socios / Personal Clínico", count: staffList.length, icon: Users, color: "text-blue-600 bg-blue-50" },
      { name: "Catálogo de Servicios", count: servicesList.length, icon: Briefcase, color: "text-amber-600 bg-amber-50" },
      { name: "Kárdex de Medicación", count: kardexList.length, icon: Pill, color: "text-purple-600 bg-purple-50" },
      { name: "Expedientes y Notas", count: expList.length, icon: Stethoscope, color: "text-emerald-600 bg-emerald-50" },
      { name: "Agenda de Turnos", count: eventsList.length, icon: Calendar, color: "text-sky-600 bg-sky-50" },
      { name: "Gastos y Honorarios", count: expensesList.length, icon: Receipt, color: "text-rose-600 bg-rose-50" },
      { name: "Abonos y Recibos", count: abonosList.length, icon: Database, color: "text-teal-600 bg-teal-50" },
      { name: "Insumos e Inventario", count: invList.length, icon: Pill, color: "text-lime-600 bg-lime-50" },
      { name: "Usuarios de Acceso", count: usersList.length, icon: ShieldCheck, color: "text-amber-600 bg-amber-50" },
    ].filter((d) => d.count > 0);

    // If no mapped keys matched, but object has properties, count top-level entries
    if (total === 0 && typeof data === "object") {
      const topKeys = Object.keys(data);
      if (topKeys.length > 0) {
        total = topKeys.length;
        details.push({
          name: "Estructura de Datos Detectada",
          count: topKeys.length,
          icon: Database,
          color: "text-sky-600 bg-sky-50",
        });
      }
    }

    return { total, details };
  };

  const stats = calculateCounts(parsedData);

  const handleExecuteRestore = async () => {
    if (!parsedData) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // Deep scan all properties of parsedData
      const source = parsedData.colecciones || parsedData.datos || parsedData.data || parsedData;

      const clientsList: Client[] = source.clientes || source.clients || parsedData.clientes || parsedData.clients || [];
      const caratulasList: Caratula[] = source.caratulas || parsedData.caratulas || [];
      const servicesList: ServiceItem[] = source.servicios || source.services || parsedData.servicios || parsedData.services || [];
      const expensesList: Expense[] = source.gastos || source.expenses || parsedData.gastos || parsedData.expenses || [];
      const abonosList: AbonoTicket[] = source.abonosCaja || source.abonos || parsedData.abonosCaja || parsedData.abonos || [];
      const categoriesList: ServiceCategory[] = source.categoriasServicios || source.categories || parsedData.categoriasServicios || parsedData.categories || [];
      const eventsList: CalendarEvent[] = source.agendaTurnos || source.calendarEvents || parsedData.agendaTurnos || parsedData.calendarEvents || [];
      const expList: ExpedienteEntry[] = source.expedientesMedicos || source.expedienteEntries || parsedData.expedientesMedicos || parsedData.expedienteEntries || [];
      const kardexList: KardexRecord[] = source.kardexMedicamentos || source.kardexRecords || parsedData.kardexMedicamentos || parsedData.kardexRecords || [];
      const staffList: StaffMember[] = source.personalSocios || source.staffMembers || source.staff || source.socios || parsedData.personalSocios || parsedData.staffMembers || parsedData.staff || parsedData.socios || [];
      const usersList: SystemUser[] = source.usuariosSistema || source.systemUsers || source.users || parsedData.usuariosSistema || parsedData.systemUsers || parsedData.users || [];
      const invList: InventoryItem[] = source.inventario || source.inventoryItems || parsedData.inventario || parsedData.inventoryItems || [];
      const cortesList: CorteDeCajaRecord[] = source.cortesCaja || parsedData.cortesCaja || [];
      const guardiasList: GuardiaShiftRecord[] = source.guardias || parsedData.guardias || [];
      const incidenciasList: IncidenciaTicket[] = source.incidencias || parsedData.incidencias || [];
      const solList: SolicitudIncrementoServicio[] = source.solicitudesIncremento || parsedData.solicitudesIncremento || [];

      // 1. Guardar de forma ultra-rápida y directa en almacenamiento local
      if (clientsList.length > 0) saveClients(clientsList);
      if (caratulasList.length > 0) saveCaratulas(caratulasList);
      if (servicesList.length > 0) saveServices(servicesList);
      if (expensesList.length > 0) saveExpenses(expensesList);
      if (abonosList.length > 0) saveAbonos(abonosList);
      if (categoriesList.length > 0) saveCategories(categoriesList);
      if (eventsList.length > 0) saveCalendarEvents(eventsList);
      if (expList.length > 0) saveExpedienteEntries(expList);
      if (kardexList.length > 0) saveKardexRecords(kardexList);
      if (staffList.length > 0) saveStaffMembers(staffList);
      if (usersList.length > 0) saveSystemUsers(usersList);
      if (invList.length > 0) saveInventory(invList);
      if (cortesList.length > 0) saveCortes(cortesList);
      if (guardiasList.length > 0) saveGuardias(guardiasList);
      if (incidenciasList.length > 0) saveIncidencias(incidenciasList);
      if (solList.length > 0) saveSolicitudesIncremento(solList);

      // Si el archivo JSON contenía claves no estándar directas en localStorage
      for (const [key, val] of Object.entries(parsedData)) {
        if (key.startsWith("cuidarte_") && typeof val === "object") {
          try {
            localStorage.setItem(key, JSON.stringify(val));
          } catch (e) {}
        }
      }

      // 2. Intentar sincronización en background no bloqueante hacia Firestore
      setTimeout(() => {
        try {
          clientsList.forEach((c) => saveClientToFirestore(c).catch(() => {}));
          caratulasList.forEach((car) => saveCaratulaToFirestore(car).catch(() => {}));
          servicesList.forEach((s) => saveServiceToFirestore(s).catch(() => {}));
          staffList.forEach((st) => saveStaffMemberToFirestore(st).catch(() => {}));
          usersList.forEach((u) => saveSystemUserToFirestore(u).catch(() => {}));
          kardexList.forEach((k) => saveKardexRecordToFirestore(k).catch(() => {}));
          expList.forEach((e) => saveExpedienteEntryToFirestore(e).catch(() => {}));
          eventsList.forEach((ev) => saveCalendarEventToFirestore(ev).catch(() => {}));
          expensesList.forEach((exp) => saveExpenseToFirestore(exp).catch(() => {}));
          abonosList.forEach((ab) => saveAbonoToFirestore(ab).catch(() => {}));
          invList.forEach((inv) => saveInventoryItemToFirestore(inv).catch(() => {}));
        } catch (cloudErr) {
          console.warn("[Restore] Background cloud sync deferred", cloudErr);
        }
      }, 100);

      setSuccessMsg(`¡Restauración exitosa! Se han cargado ${stats.total} elementos en el sistema.`);
      if (onRestoreCompleted) {
        onRestoreCompleted(parsedData);
      }

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
        // Recargar la aplicación para reflejar todos los registros de inmediato
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      console.error("Error durante la restauración:", err);
      setErrorMsg("Ocurrió un error al procesar los datos: " + (err?.message || "Error desconocido"));
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100060] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                Restaurar Copia de Seguridad JSON
              </h2>
              <p className="text-xs text-slate-400">
                Carga un archivo de respaldo para recuperar clientes, carátulas, personal y kárdex
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? "border-sky-500 bg-sky-50"
                : parsedData
                ? "border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70"
                : "border-slate-300 hover:border-sky-400 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div
                className={`p-4 rounded-2xl ${
                  parsedData
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-sky-100 text-sky-700"
                }`}
              >
                {parsedData ? (
                  <FileJson className="w-8 h-8 text-emerald-600" />
                ) : (
                  <Upload className="w-8 h-8 text-sky-600" />
                )}
              </div>

              <div>
                <p className="text-sm font-bold text-slate-800">
                  {parsedData
                    ? `Archivo cargado: ${fileName} (${fileSize})`
                    : "Arrastra aquí tu archivo JSON de respaldo o haz clic para buscar"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos compatibles: Copia completa de Cuidarte Pachuca (.json)
                </p>
              </div>

              {parsedData && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs text-sky-600 hover:text-sky-800 font-bold underline"
                >
                  Cambiar archivo
                </button>
              )}
            </div>
          </div>

          {/* Parsed Preview */}
          {parsedData && (
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Resumen de Registros Encontrados
                </span>
                <span className="text-xs font-mono font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  Total: {stats.total} registros
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {stats.details.map((det, idx) => {
                  const Icon = det.icon;
                  return (
                    <div
                      key={idx}
                      className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center gap-2"
                    >
                      <div className={`p-1.5 rounded-lg ${det.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-slate-600 truncate">
                          {det.name}
                        </div>
                        <div className="text-xs font-black text-slate-900">
                          {det.count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Informational Security Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Al confirmar, los registros se cargarán de inmediato en la base de datos de tu navegador y se intentará la sincronización en la nube.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleExecuteRestore}
            disabled={!parsedData || isProcessing}
            className={`px-6 py-2.5 text-xs font-extrabold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all ${
              parsedData && !isProcessing
                ? "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/30 cursor-pointer"
                : "bg-slate-400 cursor-not-allowed opacity-60 shadow-none"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Restaurando {stats.total > 0 ? stats.total : ""} registros...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Restaurar Base de Datos Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
