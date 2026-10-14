import React, { useState } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { ExpedienteEntry, Client, Caratula, VitalsData, ExpedienteType, KardexRecord, UserRole, CalendarEvent, InventoryItem, ClientDocument, LiquidBalanceData, GuardiaShiftRecord } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import { KardexManager } from "./KardexManager";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { downloadCaratulaPDF } from "../utils/pdfExport";
import { getDocumentsByOwnerFromIndexedDB, getDocumentFromIndexedDB, deleteDocumentFromIndexedDB } from "../utils/fileStore";
import { deleteClinicalDocumentFromFirestore } from "../services/firestoreSync";
import { CuidarteLogo } from "./CuidarteLogo";
import { ReceptorServicioSearchSelector } from "./ReceptorServicioSearchSelector";
import { evaluateAllVitals, parseAgeGroup, evaluatePresionArterial, evaluateFrecuenciaCardiaca, evaluateTemperatura, evaluateSaturacionOxigeno, evaluateGlucosa, evaluateFrecuenciaRespiratoria } from "../utils/vitalsEvaluator";
import {
  Activity,
  FileText,
  Newspaper,
  Plus,
  Trash2,
  Edit2,
  Clock,
  User,
  Heart,
  Thermometer,
  Zap,
  Filter,
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Printer,
  Pill,
  ShieldAlert,
  Download,
  ChevronUp,
  Ban,
  RotateCcw,
  Menu,
  FolderOpen,
  Upload,
  Eye,
  FileCheck,
  Droplets,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale
} from "lucide-react";

interface ExpedienteManagerProps {
  entries: ExpedienteEntry[];
  clients: Client[];
  caratulas: Caratula[];
  calendarEvents?: CalendarEvent[];
  guardiaRecords?: GuardiaShiftRecord[];
  activeGuardia?: GuardiaShiftRecord | null;
  kardexRecords?: KardexRecord[];
  inventoryItems?: InventoryItem[];
  onSaveEntry?: (entry: ExpedienteEntry) => void;
  onDeleteEntry?: (id: string) => void;
  onSaveKardex?: (record: KardexRecord) => void;
  onDeleteKardex?: (id: string) => void;
  onSaveInventoryItem?: (item: InventoryItem) => void;
  onSaveClient?: (client: Client) => void;
  readOnly?: boolean;
  userRole?: UserRole;
  currentUserName?: string;
  filterClientId?: string; // Pre-filter for Client Portal
  onSelectClient?: (clientId: string) => void;
}

export const ExpedienteManager: React.FC<ExpedienteManagerProps> = ({
  entries = [],
  clients = [],
  caratulas = [],
  calendarEvents = [],
  guardiaRecords = [],
  activeGuardia = null,
  kardexRecords = [],
  inventoryItems = [],
  onSaveEntry,
  onDeleteEntry,
  onSaveKardex,
  onDeleteKardex,
  onSaveInventoryItem,
  onSaveClient,
  readOnly = false,
  userRole = "admin",
  currentUserName = "Personal Cuidarte",
  filterClientId,
  onSelectClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(filterClientId || clients[0]?.id || "CLI-001");

  React.useEffect(() => {
    if (filterClientId) {
      setSelectedClientId(filterClientId);
    }
  }, [filterClientId]);
  const [activeTabMode, setActiveTabMode] = useState<"diario" | "kardex" | "documentos">("diario");
  const [activeTypeFilter, setActiveTypeFilter] = useState<"todos" | ExpedienteType>("todos");
  const [docTypeFilter, setDocTypeFilter] = useState<string>("ALL");
  const [isDocUploadModalOpen, setIsDocUploadModalOpen] = useState(false);
  const [previewClinicalDoc, setPreviewClinicalDoc] = useState<ClientDocument | null>(null);
  const [clinicalDocToDelete, setClinicalDocToDelete] = useState<ClientDocument | null>(null);
  const [isDeletingClinicalDoc, setIsDeletingClinicalDoc] = useState<boolean>(false);
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "today" | "7days" | "30days">("all");
  const [customDate, setCustomDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // Mobile Options Menu
  const [isMobileOptionsOpen, setIsMobileOptionsOpen] = useState(false);

  // Pagination limit for days view (defaults to 7 days, expandable with "Ver más")
  const [visibleDaysLimit, setVisibleDaysLimit] = useState<number>(7);

  // Vitals PDF Download Modal state
  const [isVitalsPdfModalOpen, setIsVitalsPdfModalOpen] = useState(false);
  const [selectedPdfMonth, setSelectedPdfMonth] = useState<number>(new Date().getMonth());
  const [selectedPdfYear, setSelectedPdfYear] = useState<number>(new Date().getFullYear());

  // Form State
  const [editingEntry, setEditingEntry] = useState<ExpedienteEntry | null>(null);
  const [entryType, setEntryType] = useState<ExpedienteType>("novedad");

  // Lock background body scroll when any modal or drawer is open
  useLockBodyScroll(Boolean(isModalOpen || isVitalsPdfModalOpen || isDocUploadModalOpen || previewClinicalDoc || isMobileOptionsOpen));
  const [formState, setFormState] = useState<Partial<ExpedienteEntry>>({
    titulo: "",
    descripcion: "",
    registradoPor: currentUserName || "Enf. En Turno",
    fechaHora: new Date().toISOString().slice(0, 16).replace("T", " "),
    estado: "Activo",
  });

  const [vitalsState, setVitalsState] = useState<VitalsData>({
    presionArterial: "120/80",
    frecuenciaCardiaca: 75,
    temperatura: 36.5,
    saturacionOxigeno: 98,
    glucosa: 95,
    frecuenciaRespiratoria: 16,
  });

  const [liquidBalanceState, setLiquidBalanceState] = useState<LiquidBalanceData>({
    entradasOralMl: undefined,
    entradasIVMl: undefined,
    entradasSondaMl: undefined,
    entradasMedicamentosMl: undefined,
    entradasOtrasMl: undefined,
    entradasDetalle: "",
    salidasOrinaMl: undefined,
    salidasOrinaAspecto: "",
    salidasEvacuacionesMl: undefined,
    salidasEvacuacionesAspecto: "",
    salidasVomitoMl: undefined,
    salidasVomitoAspecto: "",
    salidasDrenajesMl: undefined,
    salidasDrenajesTipo: "",
    salidasOtrasPerdidasMl: undefined,
    salidasDetalle: "",
    totalEntradasMl: 0,
    totalSalidasMl: 0,
    balanceNetoMl: 0,
  });

  // Client currently being viewed
  const effectiveClientSearchId = (filterClientId || selectedClientId || "").toUpperCase();

  const currentClient = clients.find(
    (c) => c.id && (c.id || "").toUpperCase() === effectiveClientSearchId
  );

  // Local IndexedDB documents state for current client
  const [localDocs, setLocalDocs] = useState<ClientDocument[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    async function loadLocalClientDocs() {
      if (!currentClient?.id) {
        setLocalDocs([]);
        return;
      }
      try {
        const stored = await getDocumentsByOwnerFromIndexedDB(currentClient.id);
        if (isMounted) {
          setLocalDocs(stored || []);
        }
      } catch (err) {
        console.warn("[ExpedienteManager] Error loading local docs:", err);
      }
    }
    loadLocalClientDocs();
    return () => {
      isMounted = false;
    };
  }, [currentClient?.id, currentClient?.documentos?.length, isDocUploadModalOpen]);

  // Combined client documents (from Client prop + IndexedDB storage)
  const effectiveClientDocs: ClientDocument[] = React.useMemo(() => {
    const clientDocs = currentClient?.documentos || [];
    return clientDocs.map((doc) => {
      const local = localDocs.find((l) => l.id === doc.id);
      return {
        ...doc,
        url: local?.url || (local as any)?.archivoUrl || doc.url || (doc as any)?.archivoUrl || "",
        archivoUrl: (local as any)?.archivoUrl || local?.url || (doc as any)?.archivoUrl || doc.url || "",
      };
    });
  }, [currentClient?.documentos, localDocs]);

  const handleOpenClinicalDocPreview = async (doc: ClientDocument) => {
    let docUrl = doc.url || (doc as any).archivoUrl || "";
    if (!docUrl || docUrl.length < 100) {
      const stored = await getDocumentFromIndexedDB(doc.id);
      if (stored?.url || stored?.archivoUrl) {
        docUrl = stored.url || stored.archivoUrl || "";
      }
    }
    setPreviewClinicalDoc({
      ...doc,
      ownerId: doc.ownerId || currentClient?.id,
      clienteId: (doc as any).clienteId || currentClient?.id,
      url: docUrl || doc.url,
      archivoUrl: (doc as any).archivoUrl || docUrl || doc.url,
    });
  };

  const handleConfirmDeleteClinicalDoc = async () => {
    if (!clinicalDocToDelete) return;
    setIsDeletingClinicalDoc(true);
    const id = clinicalDocToDelete.id;
    try {
      await deleteClinicalDocumentFromFirestore(id);
      await deleteDocumentFromIndexedDB(id);
      setLocalDocs((prev) => prev.filter((d) => d.id !== id));
      if (currentClient) {
        const updatedDocs = (currentClient.documentos || []).filter((d) => d.id !== id);
        const updatedClient = { ...currentClient, documentos: updatedDocs };
        if (onSaveClient) {
          await onSaveClient(updatedClient);
        }
      }
      setClinicalDocToDelete(null);
    } catch (err) {
      console.error("Error al eliminar documento clínico:", err);
    } finally {
      setIsDeletingClinicalDoc(false);
    }
  };

  // Filter entries for selected client, sorted descending (most recent to oldest)
  const clientEntries = entries
    .filter(
      (item) => item.clientId && (item.clientId || "").toUpperCase() === effectiveClientSearchId
    )
    .sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));

  const todayStr = new Date().toISOString().split("T")[0];

  const getDateStrFromEntry = (fechaHora: string) => {
    if (!fechaHora) return todayStr;
    const parts = fechaHora.trim().split(" ");
    return parts[0] || todayStr;
  };

  const formatDateToSpanish = (dateStr: string) => {
    if (!dateStr) return dateStr;
    try {
      const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
      if (!year || !month || !day) return dateStr;
      const dateObj = new Date(year, month - 1, day);
      return dateObj.toLocaleDateString("es-MX", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Filtered entries for daily view
  const displayedEntries = clientEntries.filter((item) => {
    const matchesType = activeTypeFilter === "todos" || item.tipo === activeTypeFilter;
    const matchesSearch =
      item.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.registradoPor.toLowerCase().includes(searchQuery.toLowerCase());

    const itemDate = getDateStrFromEntry(item.fechaHora);

    let matchesDate = true;
    if (customDate) {
      matchesDate = itemDate === customDate;
    } else if (dateFilterMode === "today") {
      matchesDate = itemDate === todayStr;
    } else if (dateFilterMode === "7days") {
      const diffDays = (new Date(todayStr).getTime() - new Date(itemDate).getTime()) / (1000 * 3600 * 24);
      matchesDate = diffDays >= 0 && diffDays <= 7;
    } else if (dateFilterMode === "30days") {
      const diffDays = (new Date(todayStr).getTime() - new Date(itemDate).getTime()) / (1000 * 3600 * 24);
      matchesDate = diffDays >= 0 && diffDays <= 30;
    }

    return matchesType && matchesSearch && matchesDate;
  });

  // Group entries by date (YYYY-MM-DD)
  const groupedEntriesByDate = displayedEntries.reduce((acc, item) => {
    const dateKey = getDateStrFromEntry(item.fechaHora);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ExpedienteEntry[]>);

  // Sorted date keys descending (most recent to oldest)
  const sortedDateKeys = Object.keys(groupedEntriesByDate).sort((a, b) => b.localeCompare(a));
  
  // Sort items inside each date group descending (most recent hour and minute first)
  sortedDateKeys.forEach((dateKey) => {
    groupedEntriesByDate[dateKey].sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));
  });
  
  // Paginated date keys according to visibleDaysLimit
  const visibleDateKeys = sortedDateKeys.slice(0, visibleDaysLimit);

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates((prev) => {
      // By default, if undefined, it is collapsed (true). Toggling inverts it.
      const isCurrentlyCollapsed = prev[dateKey] !== false;
      return {
        ...prev,
        [dateKey]: isCurrentlyCollapsed ? false : true,
      };
    });
  };

  // Month names for vital signs PDF download
  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Get vitals entries for the selected month and year, sorted descending (most recent to oldest)
  const getMonthlyVitalsEntries = () => {
    return clientEntries.filter((item) => {
      if (item.tipo !== "signos" || !item.vitals) return false;
      const dateStr = getDateStrFromEntry(item.fechaHora);
      const [year, month] = dateStr.split("-").map(Number);
      return year === selectedPdfYear && month === (selectedPdfMonth + 1);
    }).sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));
  };

  const defaultLiquidBalance: LiquidBalanceData = {
    entradasOralMl: undefined,
    entradasIVMl: undefined,
    entradasSondaMl: undefined,
    entradasMedicamentosMl: undefined,
    entradasOtrasMl: undefined,
    entradasDetalle: "",
    salidasOrinaMl: undefined,
    salidasOrinaAspecto: "",
    salidasEvacuacionesMl: undefined,
    salidasEvacuacionesAspecto: "",
    salidasVomitoMl: undefined,
    salidasVomitoAspecto: "",
    salidasDrenajesMl: undefined,
    salidasDrenajesTipo: "",
    salidasOtrasPerdidasMl: undefined,
    salidasDetalle: "",
    totalEntradasMl: 0,
    totalSalidasMl: 0,
    balanceNetoMl: 0,
  };

  const handleOpenAddModal = (type: ExpedienteType) => {
    setEditingEntry(null);
    setEntryType(type);
    setFormState({
      id: `EXPED-${Date.now()}`,
      clientId: filterClientId || selectedClientId,
      clientNombre: currentClient?.nombreCompletoCliente || "",
      caratulaFolio: caratulas.find((c) => c.id === (filterClientId || selectedClientId))?.folio || "",
      tipo: type,
      titulo:
        type === "signos"
          ? "Toma de Signos Vitales y Balance de Líquidos"
          : type === "novedad"
          ? "Novedad del Servicio"
          : "Reporte de Guardia de Enfermería",
      descripcion: "",
      registradoPor: currentUserName || "CP-ADMIN",
      fechaHora: new Date().toISOString().slice(0, 16).replace("T", " "),
      estado: "Activo",
      timestamp: getCurrentTimestamp(),
    });

    if (type === "signos") {
      setVitalsState({
        presionArterial: "",
        frecuenciaCardiaca: 0,
        temperatura: 0,
        saturacionOxigeno: 0,
        glucosa: 0,
        frecuenciaRespiratoria: 0,
      });
    }

    setLiquidBalanceState({ ...defaultLiquidBalance });

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry: ExpedienteEntry) => {
    setEditingEntry(entry);
    setEntryType(entry.tipo);
    setFormState({
      ...entry,
    });
    if (entry.vitals) {
      setVitalsState({ ...entry.vitals });
    } else {
      setVitalsState({
        presionArterial: "",
        frecuenciaCardiaca: 0,
        temperatura: 0,
        saturacionOxigeno: 0,
        glucosa: 0,
        frecuenciaRespiratoria: 0,
      });
    }

    if (entry.balanceLiquidos) {
      setLiquidBalanceState({ ...entry.balanceLiquidos });
    } else {
      setLiquidBalanceState({ ...defaultLiquidBalance });
    }

    setIsModalOpen(true);
  };

  const handleToggleCancelEntry = (entry: ExpedienteEntry) => {
    if (userRole !== "admin") {
      alert("Solo el Administrador puede cancelar o reactivar registros.");
      return;
    }
    const isCancelled = entry.estado === "Cancelado";
    const nextStatus = isCancelled ? "Activo" : "Cancelado";
    if (
      !window.confirm(
        isCancelled
          ? `¿Reactivar el registro "${entry.titulo}"?`
          : `¿Cancelar/anular el registro "${entry.titulo}"?`
      )
    ) {
      return;
    }

    const updated: ExpedienteEntry = {
      ...entry,
      estado: nextStatus,
      fechaCancelacion: nextStatus === "Cancelado" ? new Date().toISOString() : undefined,
      canceladoPor: nextStatus === "Cancelado" ? (currentUserName || "Administrador") : undefined,
    };

    if (onSaveEntry) {
      onSaveEntry(updated);
    }
  };

  const handleDeleteEntryClick = (entry: ExpedienteEntry) => {
    if (userRole !== "admin") {
      alert("Solo el Administrador puede eliminar registros.");
      return;
    }
    if (window.confirm(`¿Está seguro de eliminar definitivamente el registro "${entry.titulo}"?`)) {
      if (onDeleteEntry) {
        onDeleteEntry(entry.id);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In strict compliance with user instructions: No mandatory fields! Everything is optional.
    const fallbackTitle = formState.titulo?.trim() 
      ? formState.titulo 
      : entryType === "signos" 
      ? "Bitácora de Signos & Balance" 
      : entryType === "novedad" 
      ? "Novedad del Servicio" 
      : "Reporte de Guardia";

    // Auto calculate liquid balance totals
    const oral = Number(liquidBalanceState.entradasOralMl) || 0;
    const iv = Number(liquidBalanceState.entradasIVMl) || 0;
    const sonda = Number(liquidBalanceState.entradasSondaMl) || 0;
    const meds = Number(liquidBalanceState.entradasMedicamentosMl) || 0;
    const otrasEntradas = Number(liquidBalanceState.entradasOtrasMl) || 0;
    const totalEntradas = oral + iv + sonda + meds + otrasEntradas;

    const orina = Number(liquidBalanceState.salidasOrinaMl) || 0;
    const vomito = Number(liquidBalanceState.salidasVomitoMl) || 0;
    const drenajes = Number(liquidBalanceState.salidasDrenajesMl) || 0;
    const otrasSalidas = Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0;
    const totalSalidas = orina + vomito + drenajes + otrasSalidas;

    const balanceNeto = totalEntradas - totalSalidas;

    const hasAnyLiquidData =
      totalEntradas > 0 ||
      totalSalidas > 0 ||
      Boolean(liquidBalanceState.huboEvacuacion) ||
      Boolean(liquidBalanceState.salidasEvacuacionesRealizada) ||
      (Number(liquidBalanceState.numeroEvacuaciones) > 0) ||
      Boolean(liquidBalanceState.entradasDetalle?.trim()) ||
      Boolean(liquidBalanceState.salidasDetalle?.trim()) ||
      Boolean(liquidBalanceState.salidasOrinaAspecto?.trim()) ||
      Boolean(liquidBalanceState.salidasEvacuacionesAspecto?.trim()) ||
      Boolean(liquidBalanceState.salidasVomitoAspecto?.trim()) ||
      Boolean(liquidBalanceState.salidasDrenajesTipo?.trim());

    const computedLiquidBalance: LiquidBalanceData | undefined = hasAnyLiquidData
      ? {
          ...liquidBalanceState,
          totalEntradasMl: totalEntradas,
          totalSalidasMl: totalSalidas,
          balanceNetoMl: balanceNeto,
        }
      : undefined;

    const newEntry: ExpedienteEntry = {
      id: formState.id || `EXPED-${Date.now()}`,
      clientId: formState.clientId || filterClientId || selectedClientId,
      clientNombre: formState.clientNombre || currentClient?.nombreCompletoCliente || "Cliente Cuidarte",
      caratulaFolio: formState.caratulaFolio || "",
      tipo: entryType,
      titulo: fallbackTitle,
      descripcion: formState.descripcion || "",
      vitals: entryType === "signos" ? vitalsState : undefined,
      balanceLiquidos: computedLiquidBalance,
      registradoPor: formState.registradoPor || currentUserName || "Personal Cuidarte",
      fechaHora: formState.fechaHora || new Date().toISOString().slice(0, 16).replace("T", " "),
      eventId: formState.eventId || undefined,
      eventTitle: formState.eventTitle || undefined,
      estado: formState.estado || "Activo",
      timestamp: formState.timestamp || getCurrentTimestamp(),
    };

    if (onSaveEntry) {
      onSaveEntry(newEntry);
    }

    setIsModalOpen(false);
  };

  const getTypeBadge = (type: ExpedienteType) => {
    switch (type) {
      case "signos":
        return {
          label: "Signos Vitales",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <Activity className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case "novedad":
        return {
          label: "Novedad del Servicio",
          bg: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <Newspaper className="w-3.5 h-3.5 text-sky-600" />,
        };
      case "reporte":
        return {
          label: "Reporte de Guardia",
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <FileText className="w-3.5 h-3.5 text-purple-600" />,
        };
    }
  };

  const monthlyVitalsEntries = getMonthlyVitalsEntries();

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sky-700 font-bold text-xs uppercase tracking-wider mb-1">
            <Stethoscope className="w-4 h-4 text-sky-600" />
            <span>Expediente Digital & Bitácora Clasificada</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Histórico de Guardia y Bitácora de Signos Vitales
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Muestra los últimos 7 días de información por defecto con opción de descarga de bitácora mensual en PDF.
          </p>
        </div>

        {/* Action Controls & Mobile Hamburger */}
        <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
          {/* Mobile Options Hamburger Button (Visible only on mobile) */}
          <button
            onClick={() => setIsMobileOptionsOpen(!isMobileOptionsOpen)}
            className="md:hidden bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition"
            aria-label="Abrir opciones del expediente"
          >
            {isMobileOptionsOpen ? <X className="w-4 h-4 text-rose-400" /> : <Menu className="w-4 h-4 text-sky-400" />}
            <span>Menú de Opciones</span>
          </button>

          {!filterClientId && clients.length > 1 && (
            <div className="w-full md:w-auto min-w-[280px] sm:min-w-[340px]">
              <ReceptorServicioSearchSelector
                clients={clients}
                caratulas={caratulas}
                selectedClientId={selectedClientId}
                onSelectClient={(newId) => {
                  setSelectedClientId(newId);
                  if (onSelectClient) onSelectClient(newId);
                }}
                variant="compact"
                label=""
                placeholder="Buscar Receptor, Folio o Responsable..."
              />
            </div>
          )}

          {/* Desktop Direct Action Buttons (Hidden on mobile, accessible via mobile hamburger) */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            {/* Button to download monthly Vitals PDF */}
            <button
              onClick={() => setIsVitalsPdfModalOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
              title="Descargar tabla de signos vitales del mes en formato PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Bitácora Signos (PDF)</span>
            </button>

            {!readOnly && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenAddModal("novedad")}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novedad</span>
                </button>

                <button
                  onClick={() => handleOpenAddModal("signos")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-sm"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Bitácora Signos</span>
                </button>

                <button
                  onClick={() => handleOpenAddModal("reporte")}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Reporte Guardia</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE EXPEDIENTE OPTIONS DRAWER / DROPDOWN */}
      {isMobileOptionsOpen && (
        <div className="md:hidden bg-slate-900 border border-slate-700 text-white p-4 rounded-2xl shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Menu className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">Acciones del Expediente</span>
            </div>
            <button
              onClick={() => setIsMobileOptionsOpen(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => {
                setActiveTabMode("diario");
                setIsMobileOptionsOpen(false);
              }}
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTabMode === "diario" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-sky-300" />
              <span>Ver Bitácora Diaria</span>
            </button>

            <button
              onClick={() => {
                setActiveTabMode("kardex");
                setIsMobileOptionsOpen(false);
              }}
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTabMode === "kardex" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              <Pill className="w-4 h-4 text-emerald-300" />
              <span>Ver Kárdex de Medicación</span>
            </button>

            <button
              onClick={() => {
                setActiveTabMode("documentos");
                setIsMobileOptionsOpen(false);
              }}
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTabMode === "documentos" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              <FolderOpen className="w-4 h-4 text-amber-300" />
              <span>Ver Documentos Clínicos ({effectiveClientDocs.length})</span>
            </button>

            <button
              onClick={() => {
                setIsVitalsPdfModalOpen(true);
                setIsMobileOptionsOpen(false);
              }}
              className="p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-800/80 hover:bg-emerald-700 text-white"
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span>Descargar Bitácora PDF</span>
            </button>

            {!readOnly && (
              <>
                <button
                  onClick={() => {
                    handleOpenAddModal("novedad");
                    setIsMobileOptionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-sky-700 hover:bg-sky-600 text-white"
                >
                  <Plus className="w-4 h-4 text-sky-200" />
                  <span>+ Nueva Novedad</span>
                </button>

                <button
                  onClick={() => {
                    handleOpenAddModal("signos");
                    setIsMobileOptionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Activity className="w-4 h-4 text-emerald-200" />
                  <span>+ Registrar Signos Vitales</span>
                </button>

                <button
                  onClick={() => {
                    handleOpenAddModal("reporte");
                    setIsMobileOptionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white"
                >
                  <FileText className="w-4 h-4 text-purple-200" />
                  <span>+ Reporte de Guardia</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Receptor de Servicio Header Summary Card */}
      {currentClient && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-500/30">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                  Receptor del Servicio ({currentClient?.id || filterClientId || selectedClientId})
                </span>
                {currentClient?.id && caratulas.find((cr) => cr.id && (cr.id || "").toUpperCase() === (currentClient.id || "").toUpperCase())?.folio && (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
                    Folio: {caratulas.find((cr) => cr.id && (cr.id || "").toUpperCase() === (currentClient.id || "").toUpperCase())?.folio}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-white">{currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente || "Receptor de Servicio"}</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                <strong className="text-slate-100">Diagnóstico:</strong> {currentClient?.diagnostico || "Atención geriátrica / cuidado integral"}
              </p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs space-y-1 min-w-[240px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Responsable del Servicio:</span>
              <span className="font-bold text-white">{currentClient.nombreCompletoCliente}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dirección:</span>
              <span className="font-semibold text-slate-200 truncate max-w-[150px]">{currentClient.direccionServicio}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Edad:</span>
              <span className="font-bold text-emerald-400">{currentClient.edad} años</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIDENTIALITY NOTICE FOR PERSONAL / ENFERMERÍA */}
      {userRole === "nurse" && (
        <div className="bg-amber-950/90 border border-amber-500/70 p-3.5 rounded-2xl text-amber-200 space-y-1 print:hidden shadow-sm">
          <div className="flex items-center gap-2 font-black text-amber-300 text-xs uppercase tracking-wide">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>Aviso de Confidencialidad Obligatorio para el Personal</span>
          </div>
          <p className="text-xs text-amber-100/90 font-medium leading-relaxed">
            El personal no tiene autorizado imprimir, fotografiar, realizar capturas o extraer información de la plataforma o expedientes sin autorización expresa por escrito de Cuidarte Pachuca.
          </p>
        </div>
      )}

      {/* VIEW TABS: Bitácora Diaria vs Kárdex de Medicación vs Documentos del Expediente */}
      <div className="bg-slate-200/80 p-1.5 rounded-2xl flex flex-col sm:flex-row items-stretch gap-1">
        <button
          onClick={() => setActiveTabMode("diario")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTabMode === "diario"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-sky-600" />
          <span>Bitácora Diaria ({clientEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveTabMode("kardex")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTabMode === "kardex"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Pill className="w-4 h-4 text-emerald-300" />
          <span>Kárdex de Medicación</span>
        </button>

        <button
          onClick={() => setActiveTabMode("documentos")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTabMode === "documentos"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FolderOpen className="w-4 h-4 text-amber-300" />
          <span>Documentos Clínicos & Recetas ({effectiveClientDocs.length})</span>
        </button>
      </div>

      {/* MODE 0: DOCUMENTOS Y ESTUDIOS CLÍNICOS DEL EXPEDIENTE */}
      {activeTabMode === "documentos" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <span>Expediente Documental, Recetas y Estudios Clínicos</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Archivos oficiales, recetas médicas, estudios de laboratorio y pólizas de <strong className="text-slate-700">{currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsDocUploadModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-950/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Subir / Adjuntar Documento</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 shrink-0">Filtrar:</span>
            {[
              { id: "ALL", label: `Todos (${effectiveClientDocs.length})` },
              { id: "Receta_Medica", label: "Recetas Médicas" },
              { id: "Estudio_Laboratorio", label: "Laboratorios" },
              { id: "Historia_Clinica", label: "Historia Médica" },
              { id: "Poliza_Seguro", label: "Seguro / Póliza" },
              { id: "INE", label: "Identificación INE" },
              { id: "Otro", label: "Otros" },
            ].map((f) => {
              const count = f.id === "ALL" 
                ? effectiveClientDocs.length
                : effectiveClientDocs.filter((d) => d.tipo === f.id).length;

              if (f.id !== "ALL" && count === 0) return null;

              return (
                <button
                  key={f.id}
                  onClick={() => setDocTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    docTypeFilter === f.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Documents Grid / List */}
          {effectiveClientDocs.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto border border-amber-100">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h4 className="font-black text-slate-800 text-base">Sin documentos clínicos adjuntos</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No se han cargado recetas médicas, órdenes ni estudios de laboratorio para este receptor de servicio. Puede adjuntar archivos digitales desde aquí.
              </p>
              <button
                type="button"
                onClick={() => setIsDocUploadModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Adjuntar Primer Documento</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {effectiveClientDocs
                .filter((d) => docTypeFilter === "ALL" || d.tipo === docTypeFilter)
                .map((doc) => {
                  const docUrl = doc.url || (doc as any).archivoUrl || "";
                  const isPdf = docUrl.startsWith("data:application/pdf") || docUrl.toLowerCase().includes(".pdf") || doc.nombre.toLowerCase().endsWith(".pdf");

                  return (
                    <div
                      key={doc.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                            {doc.tipo?.replace(/_/g, " ") || "Documento"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {doc.tamano || (doc.tamanoBytes ? `${Math.round(doc.tamanoBytes / 1024)} KB` : "Digital")}
                          </span>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl shrink-0 group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                            {isPdf ? <FileText className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 text-xs line-clamp-2" title={doc.nombre}>
                              {doc.nombre}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {doc.fechaSubida}
                            </p>
                          </div>
                        </div>

                        {doc.notas && (
                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-600 leading-tight">
                            <strong className="text-slate-700">Nota:</strong> {doc.notas}
                          </div>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenClinicalDocPreview(doc)}
                          className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visualizar</span>
                        </button>

                        {docUrl && (
                          <a
                            href={docUrl}
                            download={doc.nombreArchivoOriginal || `${doc.nombre}.${isPdf ? "pdf" : "jpg"}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Descargar archivo original"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}

                        {!readOnly && userRole !== "cliente" && userRole !== "familiar" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClinicalDocToDelete(doc);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                            title="Eliminar documento del expediente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* MODE 1: KÁRDEX DE MEDICACIÓN */}
      {activeTabMode === "kardex" && (
        <div className="animate-fadeIn">
          <KardexManager
            kardexRecords={kardexRecords}
            clients={clients}
            caratulas={caratulas}
            inventoryItems={inventoryItems}
            calendarEvents={calendarEvents}
            guardiaRecords={guardiaRecords}
            activeGuardia={activeGuardia}
            onSaveKardex={onSaveKardex || (() => {})}
            onDeleteKardex={onDeleteKardex}
            onSaveInventoryItem={onSaveInventoryItem}
            userRole={userRole}
            currentUserName={currentUserName}
            filterClientId={filterClientId || selectedClientId}
          />
        </div>
      )}

      {/* MODE 1: CLASIFICACIÓN DIARIA POR DÍAS (MOSTRANDO ÚLTIMOS 7 DÍAS CON OPCIÓN VER MÁS) */}
      {activeTabMode === "diario" && (
        <div className="space-y-4">
          {/* Filters & Search Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            {/* Quick Date Filters */}
            <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5 text-sky-600" />
                Filtros:
              </span>
              <button
                onClick={() => {
                  setDateFilterMode("all");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === "all" && !customDate
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Últimos {visibleDaysLimit} días
              </button>
              <button
                onClick={() => {
                  setDateFilterMode("today");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === "today" && !customDate
                    ? "bg-sky-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => {
                  setDateFilterMode("7days");
                  setCustomDate("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilterMode === "7days" && !customDate
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Últimos 7 días
              </button>

              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateFilterMode("all");
                }}
                className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                title="Seleccionar un día específico"
              />
            </div>

            {/* Type Filters and Search */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTypeFilter("todos")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTypeFilter === "todos"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setActiveTypeFilter("signos")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTypeFilter === "signos"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Signos
                </button>
                <button
                  onClick={() => setActiveTypeFilter("novedad")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTypeFilter === "novedad"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Novedades
                </button>
              </div>

              <div className="relative w-40 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar texto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          {/* ACCORDION BY DAY */}
          {visibleDateKeys.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
              <Stethoscope className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700">No hay registros para la selección actual.</p>
              <p className="text-xs">Pruebe cambiando los filtros de fecha o agregando una nueva novedad/signos.</p>
            </div>
          ) : (
            visibleDateKeys.map((dateKey) => {
              const dayEntries = groupedEntriesByDate[dateKey];
              const isCollapsed = collapsedDates[dateKey] !== false; // Collapsed by default for better ergonomics
              const signosCount = dayEntries.filter((e) => e.tipo === "signos").length;
              const novedadCount = dayEntries.filter((e) => e.tipo === "novedad").length;
              const reporteCount = dayEntries.filter((e) => e.tipo === "reporte").length;

              return (
                <div
                  key={dateKey}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Day Header Accordion Toggle */}
                  <div
                    onClick={() => toggleDateCollapse(dateKey)}
                    className="bg-slate-50 hover:bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-200 text-slate-700 rounded-xl">
                        <CalendarIcon className="w-4 h-4 text-sky-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-900 text-sm capitalize">
                            {formatDateToSpanish(dateKey)}
                          </h4>
                          {dateKey === todayStr && (
                            <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              HOY
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {dateKey} • {dayEntries.length} registro(s)
                        </span>

                        {/* Title Badges list of Novedades / Signos / Reportes on this Date */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {dayEntries.map((e) => {
                            const isCancelled = e.estado === "Cancelado";
                            const tagBg = isCancelled
                              ? "bg-rose-100 text-rose-800 border-rose-300 line-through opacity-75"
                              : e.tipo === "novedad"
                              ? "bg-sky-100 text-sky-800 border-sky-300"
                              : e.tipo === "reporte"
                              ? "bg-purple-100 text-purple-800 border-purple-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300";

                            const typeName =
                              e.tipo === "novedad"
                                ? "Novedad"
                                : e.tipo === "reporte"
                                ? "Reporte"
                                : "Signos";
                            const timeOnly = e.fechaHora ? e.fechaHora.split(" ")[1] || "" : "";

                            return (
                              <span
                                key={e.id}
                                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border flex items-center gap-1.5 shadow-2xs ${tagBg}`}
                                title={`${typeName}: ${e.titulo} (${e.fechaHora})`}
                              >
                                {timeOnly && (
                                  <span className="font-mono text-slate-500 font-normal text-[9.5px]">
                                    {timeOnly}
                                  </span>
                                )}
                                <span className="truncate max-w-[200px]">{e.titulo}</span>
                                {isCancelled && (
                                  <span className="text-[9px] font-black uppercase text-rose-700">
                                    (CANCELADO)
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
                        {signosCount > 0 && (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <Activity className="w-3 h-3" /> {signosCount}
                          </span>
                        )}
                        {novedadCount > 0 && (
                          <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <Newspaper className="w-3 h-3" /> {novedadCount}
                          </span>
                        )}
                        {reporteCount > 0 && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {reporteCount}
                          </span>
                        )}
                      </div>

                      <div className="p-1 rounded-lg text-slate-400">
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Day Content */}
                  {!isCollapsed && (
                    <div className="p-4 space-y-3 divide-y divide-slate-100">
                      {dayEntries.map((item) => {
                        const badge = getTypeBadge(item.tipo);

                        return (
                          <div key={item.id} className="pt-3 first:pt-0 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                                  {badge.icon}
                                  <span>{badge.label}</span>
                                </span>
                                <h5 className={`font-bold text-slate-900 text-sm ${item.estado === "Cancelado" ? "line-through text-slate-500" : ""}`}>
                                  {item.titulo}
                                </h5>
                                {item.estado === "Cancelado" && (
                                  <span className="bg-rose-100 text-rose-800 border border-rose-300 font-extrabold text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Ban className="w-3 h-3 text-rose-600" />
                                    CANCELADO
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  {item.fechaHora}
                                </span>

                                {/* Admin Only Action Buttons: Editar, Cancelar, Eliminar */}
                                {userRole === "admin" && !readOnly && (
                                  <div className="flex items-center gap-1 ml-2 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                      onClick={() => handleOpenEditModal(item)}
                                      className="p-1 text-slate-700 hover:text-emerald-700 hover:bg-emerald-100/60 rounded transition-colors"
                                      title="Editar registro (Solo Admin)"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleToggleCancelEntry(item)}
                                      className={`p-1 rounded transition-colors ${
                                        item.estado === "Cancelado"
                                          ? "text-emerald-700 hover:bg-emerald-100/60"
                                          : "text-amber-700 hover:bg-amber-100/60"
                                      }`}
                                      title={item.estado === "Cancelado" ? "Reactivar registro" : "Cancelar / Anular registro"}
                                    >
                                      {item.estado === "Cancelado" ? (
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      ) : (
                                        <Ban className="w-3.5 h-3.5" />
                                      )}
                                    </button>

                                    {onDeleteEntry && (
                                      <button
                                        onClick={() => handleDeleteEntryClick(item)}
                                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-100/60 rounded transition-colors"
                                        title="Eliminar registro definitivamente"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-1">
                              {item.descripcion}
                            </p>

                            {/* Linked Calendar Event Badge */}
                            {item.eventTitle && (
                              <div className="mt-1 flex items-center gap-1.5 bg-sky-50 text-sky-800 text-[11px] font-bold px-2.5 py-1 rounded-xl border border-sky-200 w-fit">
                                <CalendarIcon className="w-3.5 h-3.5 text-sky-600" />
                                <span>Evento Vinculado: {item.eventTitle}</span>
                              </div>
                            )}

                            {/* Vitals Data Cards with Age-Based Clinical Evaluation */}
                            {item.tipo === "signos" && item.vitals && (() => {
                              const itemClient = clients.find((c) => c.id === item.clientId) || currentClient;
                              const evalResults = evaluateAllVitals(item.vitals, itemClient?.edad);
                              return (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-medium flex-wrap">
                                    <span className="flex items-center gap-1.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>Evaluación etaria: <strong className="text-slate-800">{evalResults.ageInfo.groupLabel}</strong></span>
                                      {itemClient?.edad && <span className="text-slate-400">({itemClient.edad})</span>}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">PALS / OMS / Altitud Pachuca (2,450 msnm)</span>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {/* P. Arterial */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.presionArterial.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.presionArterial.status === "danger" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">P. ARTERIAL</span>
                                        <span className="text-[9px] text-slate-400">mmHg</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">{item.vitals.presionArterial || "-"}</span>
                                      {item.vitals.presionArterial ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.presionArterial.textColor}`} title={`Rango Normal: ${evalResults.presionArterial.referenceRange}`}>
                                          {evalResults.presionArterial.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>

                                    {/* Frec. Cardíaca */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.frecuenciaCardiaca.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.frecuenciaCardiaca.status === "danger" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">FREC. CARDÍACA</span>
                                        <span className="text-[9px] text-slate-400">lpm</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm flex items-center gap-1 mt-0.5">
                                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                                        {item.vitals.frecuenciaCardiaca || "-"}
                                      </span>
                                      {item.vitals.frecuenciaCardiaca ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.frecuenciaCardiaca.textColor}`} title={`Rango Normal: ${evalResults.frecuenciaCardiaca.referenceRange}`}>
                                          {evalResults.frecuenciaCardiaca.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>

                                    {/* Temperatura */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.temperatura.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.temperatura.status === "danger" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">TEMPERATURA</span>
                                        <span className="text-[9px] text-slate-400">°C</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm flex items-center gap-1 mt-0.5">
                                        <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                        {item.vitals.temperatura !== undefined && item.vitals.temperatura !== null ? `${item.vitals.temperatura} °C` : "-"}
                                      </span>
                                      {item.vitals.temperatura !== undefined && item.vitals.temperatura !== null && item.vitals.temperatura > 0 ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.temperatura.textColor}`} title={`Rango Normal: ${evalResults.temperatura.referenceRange}`}>
                                          {evalResults.temperatura.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>

                                    {/* Sat. Oxígeno */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.saturacionOxigeno.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.saturacionOxigeno.status === "warning" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">SAT. OXÍGENO</span>
                                        <span className="text-[9px] text-slate-400">% SpO2</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm flex items-center gap-1 mt-0.5">
                                        <Zap className="w-3.5 h-3.5 text-sky-500" />
                                        {item.vitals.saturacionOxigeno !== undefined && item.vitals.saturacionOxigeno !== null ? `${item.vitals.saturacionOxigeno} %` : "-"}
                                      </span>
                                      {item.vitals.saturacionOxigeno !== undefined && item.vitals.saturacionOxigeno !== null && item.vitals.saturacionOxigeno > 0 ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.saturacionOxigeno.textColor}`} title={`Rango Normal: ${evalResults.saturacionOxigeno.referenceRange}`}>
                                          {evalResults.saturacionOxigeno.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>

                                    {/* Glucosa */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.glucosa.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.glucosa.status === "danger" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">GLUCOSA</span>
                                        <span className="text-[9px] text-slate-400">mg/dL</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">{item.vitals.glucosa || "-"}</span>
                                      {item.vitals.glucosa ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.glucosa.textColor}`} title={`Rango Normal: ${evalResults.glucosa.referenceRange}`}>
                                          {evalResults.glucosa.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>

                                    {/* Frec. Respiratoria */}
                                    <div className={`p-2 rounded-xl border transition-all ${evalResults.frecuenciaRespiratoria.isEmergency ? "bg-red-50 border-red-300 ring-1 ring-red-400" : evalResults.frecuenciaRespiratoria.status === "danger" ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">FREC. RESP.</span>
                                        <span className="text-[9px] text-slate-400">rpm</span>
                                      </div>
                                      <span className="font-mono font-black text-slate-900 text-sm block mt-0.5">{item.vitals.frecuenciaRespiratoria || "-"}</span>
                                      {item.vitals.frecuenciaRespiratoria ? (
                                        <span className={`text-[10px] block mt-1 leading-tight ${evalResults.frecuenciaRespiratoria.textColor}`} title={`Rango Normal: ${evalResults.frecuenciaRespiratoria.referenceRange}`}>
                                          {evalResults.frecuenciaRespiratoria.label}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-slate-400 block mt-1">Sin dato</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Liquid Balance Data Card */}
                            {item.balanceLiquidos && (
                              <div className="bg-gradient-to-br from-sky-50/70 via-slate-50 to-indigo-50/50 p-3 rounded-2xl border border-sky-200/80 space-y-2 mt-2">
                                <div className="flex items-center justify-between border-b border-sky-200/60 pb-1.5 flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                                    <Droplets className="w-4 h-4 text-sky-600" />
                                    <span>Balance de Líquidos (24 hrs / Guardia)</span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded-md border border-sky-300/60">
                                      Ingresos: {item.balanceLiquidos.totalEntradasMl || 0} ml
                                    </span>
                                    <span className="text-[10px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-300/60">
                                      Egresos: {item.balanceLiquidos.totalSalidasMl || 0} ml
                                    </span>
                                    <span
                                      className={`text-[10px] font-mono font-black px-2.5 py-0.5 rounded-md border ${
                                        (item.balanceLiquidos.balanceNetoMl || 0) >= 0
                                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                          : "bg-amber-100 text-amber-900 border-amber-300"
                                      }`}
                                    >
                                      Neto: {(item.balanceLiquidos.balanceNetoMl || 0) > 0 ? `+${item.balanceLiquidos.balanceNetoMl}` : item.balanceLiquidos.balanceNetoMl} ml
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {/* Desglose Ingresos */}
                                  <div className="bg-white/80 p-2 rounded-xl border border-sky-100 text-[11px] space-y-1">
                                    <span className="font-bold text-sky-700 block text-[10px] uppercase">Detalle de Ingresos</span>
                                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                                      {item.balanceLiquidos.entradasOralMl !== undefined && (
                                        <div>Oral: <strong className="font-mono text-slate-900">{item.balanceLiquidos.entradasOralMl} ml</strong></div>
                                      )}
                                      {item.balanceLiquidos.entradasIVMl !== undefined && (
                                        <div>IV: <strong className="font-mono text-slate-900">{item.balanceLiquidos.entradasIVMl} ml</strong></div>
                                      )}
                                      {item.balanceLiquidos.entradasSondaMl !== undefined && (
                                        <div>Sonda: <strong className="font-mono text-slate-900">{item.balanceLiquidos.entradasSondaMl} ml</strong></div>
                                      )}
                                      {item.balanceLiquidos.entradasMedicamentosMl !== undefined && (
                                        <div>Meds/Infusión: <strong className="font-mono text-slate-900">{item.balanceLiquidos.entradasMedicamentosMl} ml</strong></div>
                                      )}
                                    </div>
                                    {item.balanceLiquidos.entradasDetalle && (
                                      <p className="text-[10px] text-slate-500 italic pt-0.5">
                                        Nota: {item.balanceLiquidos.entradasDetalle}
                                      </p>
                                    )}
                                  </div>

                                  {/* Desglose Egresos */}
                                  <div className="bg-white/80 p-2 rounded-xl border border-rose-100 text-[11px] space-y-1">
                                    <span className="font-bold text-rose-700 block text-[10px] uppercase">Detalle de Egresos</span>
                                    <div className="grid grid-cols-2 gap-1 text-slate-600">
                                      {item.balanceLiquidos.salidasOrinaMl !== undefined && (
                                        <div>Diuresis: <strong className="font-mono text-slate-900">{item.balanceLiquidos.salidasOrinaMl} ml</strong></div>
                                      )}
                                      {(Boolean(item.balanceLiquidos.huboEvacuacion) || Boolean(item.balanceLiquidos.salidasEvacuacionesRealizada) || (Number(item.balanceLiquidos.numeroEvacuaciones) > 0) || Boolean(item.balanceLiquidos.salidasEvacuacionesAspecto && item.balanceLiquidos.salidasEvacuacionesAspecto !== "Sin evacuación en turno") || (Number(item.balanceLiquidos.salidasEvacuacionesMl) > 0)) && (
                                        <div className="col-span-2 bg-amber-50/70 p-1 rounded border border-amber-200/50 text-amber-950 font-medium">
                                          Evacuaciones: <strong className="font-bold text-amber-900">{item.balanceLiquidos.numeroEvacuaciones || 1} evac.</strong>{" "}
                                          {item.balanceLiquidos.salidasEvacuacionesAspecto && (
                                            <span className="text-slate-600 font-normal">({item.balanceLiquidos.salidasEvacuacionesAspecto})</span>
                                          )}
                                        </div>
                                      )}
                                      {item.balanceLiquidos.salidasVomitoMl !== undefined && (
                                        <div>Vómito: <strong className="font-mono text-slate-900">{item.balanceLiquidos.salidasVomitoMl} ml</strong></div>
                                      )}
                                      {item.balanceLiquidos.salidasDrenajesMl !== undefined && (
                                        <div>Drenajes: <strong className="font-mono text-slate-900">{item.balanceLiquidos.salidasDrenajesMl} ml</strong></div>
                                      )}
                                    </div>
                                    {item.balanceLiquidos.salidasDetalle && (
                                      <p className="text-[10px] text-slate-500 italic pt-0.5">
                                        Nota: {item.balanceLiquidos.salidasDetalle}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                              <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <User className="w-3 h-3 text-slate-400" />
                                Registrado por: <strong className="text-slate-800">{item.registradoPor}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* VER MÁS BUTTON TO LOAD 7 MORE DAYS CONSECUTIVELY */}
          {sortedDateKeys.length > visibleDaysLimit && (
            <div className="text-center pt-2 pb-6">
              <button
                onClick={() => setVisibleDaysLimit((prev) => prev + 7)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 mx-auto"
              >
                <ChevronDown className="w-4 h-4 text-sky-400" />
                <span>Ver más (Cargar 7 días más de información)</span>
                <span className="bg-slate-700 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {visibleDaysLimit} de {sortedDateKeys.length} días mostrados
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: DESCARGAR BITÁCORA DE SIGNOS VITALES EN PDF POR MES */}
      {isVitalsPdfModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Descargar Bitácora de Signos Vitales en PDF
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seleccione el mes y año deseado para generar el reporte en formato oficial
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsVitalsPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Mes de la Bitácora
                </label>
                <select
                  value={selectedPdfMonth}
                  onChange={(e) => setSelectedPdfMonth(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Año
                </label>
                <select
                  value={selectedPdfYear}
                  onChange={(e) => setSelectedPdfYear(parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() =>
                    downloadCaratulaPDF(
                      "vitals-monthly-pdf-document",
                      `Bitacora_Signos_${currentClient?.nombreCompletoRS || "ReceptorServicio"}_${MONTH_NAMES[selectedPdfMonth]}_${selectedPdfYear}.pdf`
                    )
                  }
                  disabled={monthlyVitalsEntries.length === 0}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-md transition ${
                    monthlyVitalsEntries.length > 0
                      ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Descargar Reporte PDF</span>
                </button>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Registros encontrados para {MONTH_NAMES[selectedPdfMonth]} {selectedPdfYear}:
                </span>
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full font-mono">
                  {monthlyVitalsEntries.length} lectura(s)
                </span>
              </div>

              {/* PDF Document Container (Target for HTML2PDF export) */}
              <div
                id="vitals-monthly-pdf-document"
                className="bg-white p-6 rounded-xl border border-gray-800 text-slate-900 font-sans shadow-xs space-y-4 text-xs"
              >
                {/* Official Header */}
                <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3">
                  <div className="flex items-center gap-3">
                    <CuidarteLogo
                      size="md"
                      showTagline={true}
                      variant="document"
                      sucursalId={currentClient?.sucursalId}
                      sucursalNombre={currentClient?.sucursalNombre}
                    />
                    <div>
                      <h2 className="text-base font-black uppercase text-gray-900 leading-tight">
                        {currentClient?.sucursalNombre?.toUpperCase() || "CUIDARTE MÉXICO"}
                      </h2>
                      <p className="text-[10px] text-gray-600 font-semibold">
                        SOLUCIONES DE ASISTENCIA Y GESTIÓN PARA EL BIENESTAR FAMILIAR
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-gray-900 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded">
                      BITÁCORA OFICIAL DE SIGNOS VITALES
                    </span>
                    <p className="text-[10px] font-mono font-bold text-gray-700 mt-1">
                      PERIODO: {MONTH_NAMES[selectedPdfMonth].toUpperCase()} {selectedPdfYear}
                    </p>
                  </div>
                </div>

                {/* Receptor de Servicio Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50 border border-gray-400 p-2.5 rounded text-[10.5px]">
                  <div>
                    <span className="font-bold block text-gray-500 text-[9px] uppercase">RECEPTOR DE SERVICIO:</span>
                    <span className="font-bold text-gray-900">{currentClient?.nombreCompletoRS || selectedClientId}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 text-[9px] uppercase">EDAD:</span>
                    <span className="font-bold text-gray-900">{currentClient?.edad || "-"} AÑOS</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 text-[9px] uppercase">RESPONSABLE / FOLIO:</span>
                    <span className="font-bold text-gray-900">{currentClient?.nombreCompletoCliente}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-gray-500 text-[9px] uppercase">DIAGNÓSTICO:</span>
                    <span className="font-bold text-gray-900 truncate block">{currentClient?.diagnostico || "Cuidado Integral"}</span>
                  </div>
                </div>

                {/* Table of Monthly Vital Signs */}
                {monthlyVitalsEntries.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 italic text-xs border border-dashed border-gray-300 rounded">
                    No se encontraron registros de signos vitales para el mes de {MONTH_NAMES[selectedPdfMonth]} de {selectedPdfYear}.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-800 rounded">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead className="bg-gray-800 text-white font-bold uppercase tracking-wider text-[9.5px]">
                        <tr className="divide-x divide-gray-700">
                          <th className="p-2 border-b border-gray-800">Fecha y Hora</th>
                          <th className="p-2 border-b border-gray-800 text-center">P. Arterial</th>
                          <th className="p-2 border-b border-gray-800 text-center">F. Cardíaca</th>
                          <th className="p-2 border-b border-gray-800 text-center">Temp (°C)</th>
                          <th className="p-2 border-b border-gray-800 text-center">Sat. O2</th>
                          <th className="p-2 border-b border-gray-800 text-center">Glucosa</th>
                          <th className="p-2 border-b border-gray-800 text-center">F. Resp.</th>
                          <th className="p-2 border-b border-gray-800">Registrado Por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300 font-mono text-[10px]">
                        {monthlyVitalsEntries.map((e, idx) => {
                          const itemClient = clients.find((c) => c.id === e.clientId) || currentClient;
                          const ev = evaluateAllVitals(e.vitals, itemClient?.edad);
                          return (
                            <tr key={e.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="p-2 font-bold text-gray-900 border-r border-gray-300 whitespace-nowrap">{e.fechaHora}</td>
                              
                              {/* P. Arterial */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">{e.vitals?.presionArterial || "-"}</span>
                                {e.vitals?.presionArterial && (
                                  <span className={`text-[8.5px] font-bold block ${ev.presionArterial.isEmergency ? "text-red-700 underline" : ev.presionArterial.status === "danger" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.presionArterial.label}
                                  </span>
                                )}
                              </td>

                              {/* F. Cardíaca */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">
                                  {e.vitals?.frecuenciaCardiaca ? `${e.vitals.frecuenciaCardiaca} lpm` : "-"}
                                </span>
                                {Boolean(e.vitals?.frecuenciaCardiaca) && (
                                  <span className={`text-[8.5px] font-bold block ${ev.frecuenciaCardiaca.isEmergency ? "text-red-700 underline" : ev.frecuenciaCardiaca.status === "danger" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.frecuenciaCardiaca.label}
                                  </span>
                                )}
                              </td>

                              {/* Temp (°C) */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">
                                  {e.vitals?.temperatura !== undefined && e.vitals?.temperatura !== null && e.vitals?.temperatura > 0 ? `${e.vitals.temperatura} °C` : "-"}
                                </span>
                                {e.vitals?.temperatura !== undefined && e.vitals?.temperatura !== null && e.vitals?.temperatura > 0 && (
                                  <span className={`text-[8.5px] font-bold block ${ev.temperatura.isEmergency ? "text-red-700 underline" : ev.temperatura.status === "danger" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.temperatura.label}
                                  </span>
                                )}
                              </td>

                              {/* Sat. O2 */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">
                                  {e.vitals?.saturacionOxigeno !== undefined && e.vitals?.saturacionOxigeno !== null && e.vitals?.saturacionOxigeno > 0 ? `${e.vitals.saturacionOxigeno}%` : "-"}
                                </span>
                                {e.vitals?.saturacionOxigeno !== undefined && e.vitals?.saturacionOxigeno !== null && e.vitals?.saturacionOxigeno > 0 && (
                                  <span className={`text-[8.5px] font-bold block ${ev.saturacionOxigeno.isEmergency ? "text-red-700 underline" : ev.saturacionOxigeno.status === "warning" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.saturacionOxigeno.label}
                                  </span>
                                )}
                              </td>

                              {/* Glucosa */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">
                                  {e.vitals?.glucosa ? `${e.vitals.glucosa} mg/dL` : "-"}
                                </span>
                                {Boolean(e.vitals?.glucosa) && (
                                  <span className={`text-[8.5px] font-bold block ${ev.glucosa.isEmergency ? "text-red-700 underline" : ev.glucosa.status === "danger" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.glucosa.label}
                                  </span>
                                )}
                              </td>

                              {/* F. Resp. */}
                              <td className="p-2 text-center border-r border-gray-300">
                                <span className="font-bold text-gray-900 block">
                                  {e.vitals?.frecuenciaRespiratoria ? `${e.vitals.frecuenciaRespiratoria} rpm` : "-"}
                                </span>
                                {Boolean(e.vitals?.frecuenciaRespiratoria) && (
                                  <span className={`text-[8.5px] font-bold block ${ev.frecuenciaRespiratoria.isEmergency ? "text-red-700 underline" : ev.frecuenciaRespiratoria.status === "danger" ? "text-amber-800" : "text-gray-600"}`}>
                                    {ev.frecuenciaRespiratoria.label}
                                  </span>
                                )}
                              </td>

                              <td className="p-2 font-sans font-medium text-gray-700">{e.registradoPor}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer Validation Notice */}
                <div className="pt-2 border-t border-gray-300 text-[9px] text-gray-500 flex justify-between items-center">
                  <span>Documento oficial generado por el Expediente Digital Cuidarte Pachuca</span>
                  <span>Fecha de Emisión: {new Date().toLocaleDateString("es-MX")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD EXPEDIENTE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  {entryType === "signos" ? (
                    <Activity className="w-5 h-5 text-emerald-600" />
                  ) : entryType === "novedad" ? (
                    <Newspaper className="w-5 h-5 text-sky-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingEntry
                      ? `Editar ${editingEntry.tipo === "signos" ? "Signos Vitales" : editingEntry.tipo === "novedad" ? "Novedad" : "Reporte de Guardia"}`
                      : entryType === "signos"
                      ? "Nueva Lectura de Signos Vitales"
                      : entryType === "novedad"
                      ? "Nueva Novedad del Servicio"
                      : "Nuevo Reporte de Guardia"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Receptor de Servicio: {currentClient?.nombreCompletoRS || selectedClientId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 pt-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Título del Registro <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Toma de Signos y Balance - Turno Matutino"
                  value={formState.titulo}
                  onChange={(e) => setFormState({ ...formState, titulo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 font-medium"
                />
              </div>

              {/* Vitals Input Grid if type === 'signos' */}
              {entryType === "signos" && (() => {
                const liveClient = currentClient;
                const liveEval = evaluateAllVitals(vitalsState, liveClient?.edad);
                return (
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          Mediciones de Signos Vitales
                        </span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {liveEval.ageInfo.groupLabel} {liveClient?.edad ? `(${liveClient.edad})` : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      {/* P. Arterial */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">P. Arterial</label>
                          <span className="text-[9px] text-slate-400">mmHg</span>
                        </div>
                        <input
                          type="text"
                          placeholder="120/80"
                          value={vitalsState.presionArterial || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, presionArterial: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {vitalsState.presionArterial ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.presionArterial.textColor}`}>
                              {liveEval.presionArterial.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.presionArterial.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.presionArterial.referenceRange}</span>
                        )}
                      </div>

                      {/* Frec. Cardíaca */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Frec. Cardíaca</label>
                          <span className="text-[9px] text-slate-400">lpm</span>
                        </div>
                        <input
                          type="number"
                          placeholder="75"
                          value={vitalsState.frecuenciaCardiaca || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, frecuenciaCardiaca: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {Boolean(vitalsState.frecuenciaCardiaca) ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.frecuenciaCardiaca.textColor}`}>
                              {liveEval.frecuenciaCardiaca.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.frecuenciaCardiaca.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.frecuenciaCardiaca.referenceRange}</span>
                        )}
                      </div>

                      {/* Temperatura */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Temperatura</label>
                          <span className="text-[9px] text-slate-400">°C</span>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="36.5"
                          value={vitalsState.temperatura || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, temperatura: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {vitalsState.temperatura !== undefined && vitalsState.temperatura !== null && vitalsState.temperatura > 0 ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.temperatura.textColor}`}>
                              {liveEval.temperatura.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.temperatura.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.temperatura.referenceRange}</span>
                        )}
                      </div>

                      {/* Sat. Oxígeno */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Sat. Oxígeno</label>
                          <span className="text-[9px] text-slate-400">%</span>
                        </div>
                        <input
                          type="number"
                          placeholder="98"
                          value={vitalsState.saturacionOxigeno || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, saturacionOxigeno: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {vitalsState.saturacionOxigeno !== undefined && vitalsState.saturacionOxigeno !== null && vitalsState.saturacionOxigeno > 0 ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.saturacionOxigeno.textColor}`}>
                              {liveEval.saturacionOxigeno.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.saturacionOxigeno.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.saturacionOxigeno.referenceRange}</span>
                        )}
                      </div>

                      {/* Glucosa */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Glucosa Capilar</label>
                          <span className="text-[9px] text-slate-400">mg/dL</span>
                        </div>
                        <input
                          type="number"
                          placeholder="95"
                          value={vitalsState.glucosa || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, glucosa: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {Boolean(vitalsState.glucosa) ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.glucosa.textColor}`}>
                              {liveEval.glucosa.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.glucosa.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.glucosa.referenceRange}</span>
                        )}
                      </div>

                      {/* Frec. Resp. */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-600 uppercase">Frec. Resp.</label>
                          <span className="text-[9px] text-slate-400">rpm</span>
                        </div>
                        <input
                          type="number"
                          placeholder="16"
                          value={vitalsState.frecuenciaRespiratoria || ""}
                          onChange={(e) => setVitalsState({ ...vitalsState, frecuenciaRespiratoria: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                        />
                        {Boolean(vitalsState.frecuenciaRespiratoria) ? (
                          <div className="flex items-center justify-between text-[9.5px]">
                            <span className={`font-bold ${liveEval.frecuenciaRespiratoria.textColor}`}>
                              {liveEval.frecuenciaRespiratoria.label}
                            </span>
                            <span className="text-slate-400 text-[8.5px]">{liveEval.frecuenciaRespiratoria.referenceRange}</span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-400 block">Ref: {liveEval.frecuenciaRespiratoria.referenceRange}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SECCIÓN ESPECÍFICA: BALANCE DE LÍQUIDOS (INGRESOS Y EGRESOS CON SUMA AUTOMÁTICA) */}
              <div className="bg-gradient-to-br from-sky-50/50 via-slate-50 to-indigo-50/40 p-3.5 rounded-2xl border border-sky-200/80 space-y-3">
                <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-600 text-white rounded-lg shadow-xs">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">
                        Balance de Líquidos e Hidratación
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Registro de ingresos y egresos con cálculo automático acumulado (Todos los campos son opcionales)
                      </span>
                    </div>
                  </div>

                  {/* Resumen Calculado en Vivo */}
                  <div className="flex items-center gap-2 bg-white/90 px-3 py-1.5 rounded-xl border border-sky-200 shadow-xs">
                    <span className="text-[10px] font-black uppercase text-slate-500">Balance Neto:</span>
                    <span
                      className={`text-xs font-mono font-black ${
                        ((Number(liquidBalanceState.entradasOralMl) || 0) +
                          (Number(liquidBalanceState.entradasIVMl) || 0) +
                          (Number(liquidBalanceState.entradasSondaMl) || 0) +
                          (Number(liquidBalanceState.entradasMedicamentosMl) || 0) +
                          (Number(liquidBalanceState.entradasOtrasMl) || 0)) -
                          ((Number(liquidBalanceState.salidasOrinaMl) || 0) +
                            (Number(liquidBalanceState.salidasEvacuacionesMl) || 0) +
                            (Number(liquidBalanceState.salidasVomitoMl) || 0) +
                            (Number(liquidBalanceState.salidasDrenajesMl) || 0) +
                            (Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0)) >= 0
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {((Number(liquidBalanceState.entradasOralMl) || 0) +
                        (Number(liquidBalanceState.entradasIVMl) || 0) +
                        (Number(liquidBalanceState.entradasSondaMl) || 0) +
                        (Number(liquidBalanceState.entradasMedicamentosMl) || 0) +
                        (Number(liquidBalanceState.entradasOtrasMl) || 0)) -
                        ((Number(liquidBalanceState.salidasOrinaMl) || 0) +
                          (Number(liquidBalanceState.salidasEvacuacionesMl) || 0) +
                          (Number(liquidBalanceState.salidasVomitoMl) || 0) +
                          (Number(liquidBalanceState.salidasDrenajesMl) || 0) +
                          (Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0)) > 0
                        ? `+${
                            ((Number(liquidBalanceState.entradasOralMl) || 0) +
                              (Number(liquidBalanceState.entradasIVMl) || 0) +
                              (Number(liquidBalanceState.entradasSondaMl) || 0) +
                              (Number(liquidBalanceState.entradasMedicamentosMl) || 0) +
                              (Number(liquidBalanceState.entradasOtrasMl) || 0)) -
                            ((Number(liquidBalanceState.salidasOrinaMl) || 0) +
                              (Number(liquidBalanceState.salidasEvacuacionesMl) || 0) +
                              (Number(liquidBalanceState.salidasVomitoMl) || 0) +
                              (Number(liquidBalanceState.salidasDrenajesMl) || 0) +
                              (Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0))
                          } ml`
                        : `${
                            ((Number(liquidBalanceState.entradasOralMl) || 0) +
                              (Number(liquidBalanceState.entradasIVMl) || 0) +
                              (Number(liquidBalanceState.entradasSondaMl) || 0) +
                              (Number(liquidBalanceState.entradasMedicamentosMl) || 0) +
                              (Number(liquidBalanceState.entradasOtrasMl) || 0)) -
                            ((Number(liquidBalanceState.salidasOrinaMl) || 0) +
                              (Number(liquidBalanceState.salidasEvacuacionesMl) || 0) +
                              (Number(liquidBalanceState.salidasVomitoMl) || 0) +
                              (Number(liquidBalanceState.salidasDrenajesMl) || 0) +
                              (Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0))
                          } ml`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* ENTRADAS / INGRESOS */}
                  <div className="bg-white/90 p-3 rounded-xl border border-sky-200 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-sky-100 pb-1">
                      <div className="flex items-center gap-1.5 text-sky-800 font-bold text-[11px] uppercase">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-sky-600" />
                        <span>Entradas (Ingresos)</span>
                      </div>
                      <span className="text-[10px] font-mono font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        Total:{" "}
                        {(Number(liquidBalanceState.entradasOralMl) || 0) +
                          (Number(liquidBalanceState.entradasIVMl) || 0) +
                          (Number(liquidBalanceState.entradasSondaMl) || 0) +
                          (Number(liquidBalanceState.entradasMedicamentosMl) || 0) +
                          (Number(liquidBalanceState.entradasOtrasMl) || 0)}{" "}
                        ml
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Vía Oral (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 250"
                          value={liquidBalanceState.entradasOralMl !== undefined ? liquidBalanceState.entradasOralMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              entradasOralMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Intravenosa / IV (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 500"
                          value={liquidBalanceState.entradasIVMl !== undefined ? liquidBalanceState.entradasIVMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              entradasIVMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Sonda / Enteral (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 200"
                          value={liquidBalanceState.entradasSondaMl !== undefined ? liquidBalanceState.entradasSondaMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              entradasSondaMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Infusión / Meds (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 100"
                          value={liquidBalanceState.entradasMedicamentosMl !== undefined ? liquidBalanceState.entradasMedicamentosMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              entradasMedicamentosMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600">Detalle de Soluciones / Ingresos</label>
                      <input
                        type="text"
                        placeholder="Ej. Sol. Salina 0.9% 500ml a 21 gtt/min, gelatina 100ml"
                        value={liquidBalanceState.entradasDetalle || ""}
                        onChange={(e) =>
                          setLiquidBalanceState({
                            ...liquidBalanceState,
                            entradasDetalle: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* SALIDAS / EGRESOS */}
                  <div className="bg-white/90 p-3 rounded-xl border border-rose-200 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-rose-100 pb-1">
                      <div className="flex items-center gap-1.5 text-rose-800 font-bold text-[11px] uppercase">
                        <ArrowUpCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Salidas (Egresos)</span>
                      </div>
                      <span className="text-[10px] font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                        Total:{" "}
                        {(Number(liquidBalanceState.salidasOrinaMl) || 0) +
                          (Number(liquidBalanceState.salidasVomitoMl) || 0) +
                          (Number(liquidBalanceState.salidasDrenajesMl) || 0) +
                          (Number(liquidBalanceState.salidasOtrasPerdidasMl) || 0)}{" "}
                        ml
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Orina / Diuresis (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 350"
                          value={liquidBalanceState.salidasOrinaMl !== undefined ? liquidBalanceState.salidasOrinaMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              salidasOrinaMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Vómito / Emesis (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 100"
                          value={liquidBalanceState.salidasVomitoMl !== undefined ? liquidBalanceState.salidasVomitoMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              salidasVomitoMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600">Drenajes (ml)</label>
                        <input
                          type="number"
                          placeholder="Ej. 50"
                          value={liquidBalanceState.salidasDrenajesMl !== undefined ? liquidBalanceState.salidasDrenajesMl : ""}
                          onChange={(e) =>
                            setLiquidBalanceState({
                              ...liquidBalanceState,
                              salidasDrenajesMl: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    {/* Evacuaciones Checkbox & Conteo */}
                    <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(liquidBalanceState.huboEvacuacion || (liquidBalanceState.numeroEvacuaciones && liquidBalanceState.numeroEvacuaciones > 0) || liquidBalanceState.salidasEvacuacionesRealizada)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setLiquidBalanceState({
                                ...liquidBalanceState,
                                huboEvacuacion: checked,
                                salidasEvacuacionesRealizada: checked,
                                numeroEvacuaciones: checked ? (liquidBalanceState.numeroEvacuaciones || 1) : 0,
                                salidasEvacuacionesAspecto: checked ? (liquidBalanceState.salidasEvacuacionesAspecto || "Formada / Normal (Bristol 3-4)") : "Sin evacuación en turno",
                                salidasEvacuacionesMl: undefined,
                              });
                            }}
                            className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                          />
                          <span className="font-bold text-[11px] text-amber-950">
                            Registrar Evacuación en Turno
                          </span>
                        </label>
                        {(liquidBalanceState.huboEvacuacion || (liquidBalanceState.numeroEvacuaciones && liquidBalanceState.numeroEvacuaciones > 0) || liquidBalanceState.salidasEvacuacionesRealizada) && (
                          <span className="text-[10px] font-black uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                            {liquidBalanceState.numeroEvacuaciones || 1} Evac.
                          </span>
                        )}
                      </div>

                      {(liquidBalanceState.huboEvacuacion || (liquidBalanceState.numeroEvacuaciones && liquidBalanceState.numeroEvacuaciones > 0) || liquidBalanceState.salidasEvacuacionesRealizada) && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700">Número de Evacuaciones</label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={liquidBalanceState.numeroEvacuaciones ?? 1}
                              onChange={(e) =>
                                setLiquidBalanceState({
                                  ...liquidBalanceState,
                                  numeroEvacuaciones: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs font-bold text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-700">Consistencia / Bristol</label>
                            <select
                              value={liquidBalanceState.salidasEvacuacionesAspecto || "Formada / Normal (Bristol 3-4)"}
                              onChange={(e) =>
                                setLiquidBalanceState({
                                  ...liquidBalanceState,
                                  salidasEvacuacionesAspecto: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900"
                            >
                              <option value="Formada / Normal (Bristol 3-4)">Formada / Normal (Bristol 3-4)</option>
                              <option value="Blanda / Pastosa (Bristol 5-6)">Blanda / Pastosa (Bristol 5-6)</option>
                              <option value="Líquida / Diarreica (Bristol 7)">Líquida / Diarreica (Bristol 7)</option>
                              <option value="Dura / Caprina (Bristol 1-2)">Dura / Caprina (Bristol 1-2)</option>
                              <option value="Melena (Heces oscuras)">Melena (Heces oscuras)</option>
                              <option value="Con moco / sangre visible">Con moco / sangre visible</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600">Detalle de Egresos / Características</label>
                      <input
                        type="text"
                        placeholder="Ej. Orina clara con sonda Foley, drenovac serohemático 50ml"
                        value={liquidBalanceState.salidasDetalle || ""}
                        onChange={(e) =>
                          setLiquidBalanceState({
                            ...liquidBalanceState,
                            salidasDetalle: e.target.value,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Descripción / Observaciones <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalles sobre el estado del receptor de servicio, alimentación, tolerancia, observaciones de enfermería..."
                  value={formState.descripcion}
                  onChange={(e) => setFormState({ ...formState, descripcion: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              {/* Link Calendar Event Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Vincular a Evento en Calendario (Opcional)
                </label>
                <select
                  value={formState.eventId || ""}
                  onChange={(e) => {
                    const evtId = e.target.value;
                    const evt = calendarEvents.find((ce) => ce.id === evtId);
                    setFormState({
                      ...formState,
                      eventId: evtId,
                      eventTitle: evt ? `${evt.titulo} (${evt.fechaInicio ? evt.fechaInicio.replace("T", " ") : ""})` : "",
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                >
                  <option value="">-- Sin Vincular --</option>
                  {calendarEvents
                    .filter((ce) => !ce.clientId || ce.clientId.toUpperCase() === (filterClientId || selectedClientId).toUpperCase())
                    .map((ce) => (
                      <option key={ce.id} value={ce.id}>
                        📅 {ce.titulo} [{ce.fechaInicio ? ce.fechaInicio.replace("T", " ") : ""}] ({ce.tipoServicio || "Evento"})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Vincula resúmenes de consultas médicas, laboratorios agendados o valoraciones.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Registrado Por <span className="text-[9px] text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formState.registradoPor}
                    onChange={(e) => setFormState({ ...formState, registradoPor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Fecha y Hora <span className="text-[9px] text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formState.fechaHora}
                    onChange={(e) => setFormState({ ...formState, fechaHora: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Estatus del Registro
                  </label>
                  <select
                    value={formState.estado || "Activo"}
                    onChange={(e) => setFormState({ ...formState, estado: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  >
                    <option value="Activo">🟢 Activo</option>
                    <option value="Cancelado">🔴 Cancelado / Anulado</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Guardar en Expediente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Clinical Document Upload Modal for Client / Receptor */}
      {isDocUploadModalOpen && currentClient && (
        <DocumentUploadModal
          title="Expediente Digital del Receptor"
          subtitle={`Receptor: ${currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente} | ID: ${currentClient.id}`}
          ownerName={currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente}
          ownerId={currentClient.id}
          category="client"
          documents={effectiveClientDocs}
          onSaveDocuments={(updatedDocs) => {
            setLocalDocs(updatedDocs);
            const updatedClient: Client = {
              ...currentClient,
              documentos: updatedDocs,
            };
            if (onSaveClient) {
              onSaveClient(updatedClient);
            }
          }}
          onClose={() => setIsDocUploadModalOpen(false)}
        />
      )}

      {/* Universal Document Viewer Modal for Clinical Documents */}
      <DocumentViewerModal
        isOpen={Boolean(previewClinicalDoc)}
        doc={previewClinicalDoc}
        onClose={() => setPreviewClinicalDoc(null)}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(clinicalDocToDelete)}
        itemName={clinicalDocToDelete?.nombre || ""}
        itemType={clinicalDocToDelete?.tipo}
        onConfirm={handleConfirmDeleteClinicalDoc}
        onCancel={() => setClinicalDocToDelete(null)}
        isDeleting={isDeletingClinicalDoc}
      />
    </div>
  );
};
