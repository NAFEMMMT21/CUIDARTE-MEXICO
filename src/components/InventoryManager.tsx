import React, { useState } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { InventoryItem, InventoryMovement, InventoryCategory, ControlType, Client, Caratula, UserRole, KardexRecord } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import { calculateStockAndTreatmentStatus, calculateDosesPerDay, parseUnitsPerDose, FREQUENCY_PRESETS } from "../utils/medicationStockUtils";
import { ReceptorServicioSearchSelector } from "./ReceptorServicioSearchSelector";
import { ShoppingListDocument } from "./ShoppingListDocument";
import { InventoryDocument } from "./InventoryDocument";
import { downloadShoppingListPDF, downloadInventoryPDF } from "../utils/pdfExport";
import { PRESENTACIONES_MEDICAMENTOS } from "./KardexManager";
import {
  Package,
  Pill,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  FileText,
  Copy,
  Download,
  Printer,
  X,
  History,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  CheckSquare,
  Info,
  Calendar,
  Bell
} from "lucide-react";

interface InventoryManagerProps {
  inventoryItems: InventoryItem[];
  clients: Client[];
  caratulas?: Caratula[];
  kardexRecords?: KardexRecord[];
  onSaveItem: (item: InventoryItem) => void;
  onDeleteItem?: (id: string) => void;
  userRole?: UserRole;
  currentUserName?: string;
  filterClientId?: string; // For Client Portal or Nurse pre-filter
  onSelectClient?: (clientId: string) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  inventoryItems = [],
  clients = [],
  caratulas = [],
  kardexRecords = [],
  onSaveItem,
  onDeleteItem,
  userRole = "admin",
  currentUserName = "Personal Cuidarte",
  filterClientId,
  onSelectClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(filterClientId || clients[0]?.id || "CLI-001");

  // Ensure selectedClientId stays within available clients or filterClientId
  React.useEffect(() => {
    if (filterClientId) {
      setSelectedClientId(filterClientId);
    } else if (clients.length > 0) {
      const isValid = clients.some((c) => c.id && selectedClientId && (c.id || "").toUpperCase() === (selectedClientId || "").toUpperCase());
      if (!isValid && clients[0]?.id) {
        setSelectedClientId(clients[0].id);
      }
    }
  }, [filterClientId, clients]);

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("todos");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"todos" | "stock_bajo" | "ok">("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [isIngresoModalOpen, setIsIngresoModalOpen] = useState(false);
  const [isUsoModalOpen, setIsUsoModalOpen] = useState(false);
  const [isFaltanteModalOpen, setIsFaltanteModalOpen] = useState(false);
  const [isAdminEditModalOpen, setIsAdminEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Shopping List & Inventory Document PDF Preview & Export Modals
  const [isShoppingListModalOpen, setIsShoppingListModalOpen] = useState(false);
  const [isInventoryDocModalOpen, setIsInventoryDocModalOpen] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isDownloadingInvPDF, setIsDownloadingInvPDF] = useState(false);

  const [activeItem, setActiveItem] = useState<InventoryItem | null>(null);

  // Lock background scroll when any Inventory modal is open
  useLockBodyScroll(Boolean(isNewItemModalOpen || isIngresoModalOpen || isUsoModalOpen || isFaltanteModalOpen || isAdminEditModalOpen || isHistoryModalOpen || isShoppingListModalOpen || isInventoryDocModalOpen));

  // Form states
  const [newItemForm, setNewItemForm] = useState<Partial<InventoryItem>>({
    nombre: "",
    categoria: "Medicamento",
    presentacion: "Tableta",
    tipoFrecuencia: "HorarioFijo",
    indicacionesUsoADemanda: "",
    controlTipo: "Con Control de Inventario",
    stockActual: 0,
    unidadMedida: "Tabletas",
    frecuenciaKardex: "1 vez al día",
    dosesPerDay: 1,
    daysThresholdAlert: 7,
    notas: "",
  });

  const [ingresoForm, setIngresoForm] = useState({
    cantidad: 1,
    notas: "Compra / Recepción de medicamentos enviada por familiares",
  });

  const [usoForm, setUsoForm] = useState({
    cantidad: 1,
    notas: "Uso / Consumo de insumo en atención del paciente",
  });

  const [faltanteForm, setFaltanteForm] = useState({
    tipo: "Ajuste_Faltante" as "Ajuste_Faltante" | "Ajuste_Perdida",
    cantidad: 1,
    notas: "",
  });

  const [adminEditForm, setAdminEditForm] = useState<Partial<InventoryItem>>({});

  const canIngresar = userRole === "admin" || userRole === "nurse";
  const canAdminEdit = userRole === "admin";

  // Active client & caratula objects
  const effectiveClientId = filterClientId || selectedClientId || "";
  const effIdUpper = effectiveClientId.toUpperCase();

  const currentClient = clients.find((c) => c.id && (c.id || "").toUpperCase() === effIdUpper);
  const currentCaratula = (caratulas || []).find(
    (c) => (c.clientId && (c.clientId || "").toUpperCase() === effIdUpper) || (c.id && (c.id || "").toUpperCase() === effIdUpper)
  );

  // Filter items by Client
  const rawClientItems = inventoryItems.filter(
    (item) => item.clientId && (item.clientId || "").toUpperCase() === effIdUpper
  );

  const normalizeText = (s?: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  // Active Kardex for selected client
  const clientKardex = kardexRecords.find((k) => k.clientId && (k.clientId || "").toUpperCase() === effIdUpper);
  const activeKardexMeds = (clientKardex?.medicamentos || []).filter((m) => m.estado === "Activo");

  // Helper to find matching Kardex medication for an inventory item
  const getKardexMedForItem = (item: InventoryItem) => {
    if (!clientKardex?.medicamentos || clientKardex.medicamentos.length === 0) return undefined;
    if (item.kardexMedicationId) {
      const byId = clientKardex.medicamentos.find((m) => m.id === item.kardexMedicationId);
      if (byId) return byId;
    }
    const normInv = normalizeText(item.nombre);
    if (!normInv) return undefined;
    return clientKardex.medicamentos.find((m) => {
      const normMed = normalizeText(m.nombreMedicamento);
      return (
        normMed === normInv ||
        normInv.includes(normMed) ||
        normMed.includes(normInv)
      );
    });
  };

  // Deduplicate and merge repeated medications for this client
  const deduplicateItems = (items: InventoryItem[]): { unique: InventoryItem[]; duplicateIds: string[] } => {
    const map = new Map<string, InventoryItem>();
    const duplicateIds: string[] = [];

    items.forEach((item) => {
      const kardexMed = getKardexMedForItem(item);
      const authName = kardexMed?.nombreMedicamento || item.nombre;
      const normalizedName = normalizeText(authName);

      // Key by kardexMedicationId if present, else linked kardex med ID, else normalized name + category
      const key = item.kardexMedicationId
        ? `kardex-${item.kardexMedicationId}`
        : (kardexMed ? `kardex-${kardexMed.id}` : `name-${normalizedName}-${item.categoria}`);

      if (map.has(key)) {
        const existing = map.get(key)!;
        duplicateIds.push(item.id);
        
        // Take stock from the most recently updated item
        const preferredStock = (item.ultimaActualizacion || "") >= (existing.ultimaActualizacion || "")
          ? item.stockActual
          : existing.stockActual;

        const combinedMovements = [...(existing.historialMovimientos || []), ...(item.historialMovimientos || [])];
        const uniqueMovements = Array.from(new Map(combinedMovements.map((m) => [m.id, m])).values());

        map.set(key, {
          ...existing,
          nombre: authName,
          kardexMedicationId: item.kardexMedicationId || kardexMed?.id || existing.kardexMedicationId,
          stockActual: preferredStock,
          unidadMedida: existing.unidadMedida || item.unidadMedida,
          frecuenciaKardex: existing.frecuenciaKardex || item.frecuenciaKardex,
          dosesPerDay: existing.dosesPerDay || item.dosesPerDay,
          historialMovimientos: uniqueMovements,
          ultimaActualizacion: (existing.ultimaActualizacion || "") > (item.ultimaActualizacion || "")
            ? existing.ultimaActualizacion
            : item.ultimaActualizacion,
        });
      } else {
        map.set(key, {
          ...item,
          nombre: authName,
          kardexMedicationId: item.kardexMedicationId || kardexMed?.id || item.kardexMedicationId,
        });
      }
    });

    return {
      unique: Array.from(map.values()),
      duplicateIds,
    };
  };

  const { unique: clientItems, duplicateIds } = React.useMemo(
    () => deduplicateItems(rawClientItems),
    [rawClientItems, clientKardex?.medicamentos]
  );

  // Auto-clean duplicates from Firestore if detected
  React.useEffect(() => {
    if (duplicateIds.length > 0 && onDeleteItem && canIngresar) {
      duplicateIds.forEach((dupId) => {
        onDeleteItem(dupId);
      });
    }
  }, [duplicateIds.length, onDeleteItem, canIngresar]);

  // Auto-sync names, presentation, frequency and kardex ids if they were updated in Kardex
  React.useEffect(() => {
    if (!onSaveItem || !clientKardex?.medicamentos || clientKardex.medicamentos.length === 0) return;
    rawClientItems.forEach((item) => {
      const med = getKardexMedForItem(item);
      if (
        med &&
        (item.nombre !== med.nombreMedicamento ||
          item.kardexMedicationId !== med.id ||
          (med.presentacion && item.presentacion !== med.presentacion) ||
          (med.tipoFrecuencia && item.tipoFrecuencia !== med.tipoFrecuencia) ||
          (med.indicacionesUsoADemanda && item.indicacionesUsoADemanda !== med.indicacionesUsoADemanda))
      ) {
        onSaveItem({
          ...item,
          nombre: med.nombreMedicamento,
          kardexMedicationId: med.id,
          presentacion: med.presentacion || item.presentacion || "Tableta",
          tipoFrecuencia: med.tipoFrecuencia || item.tipoFrecuencia || "HorarioFijo",
          indicacionesUsoADemanda: med.indicacionesUsoADemanda || item.indicacionesUsoADemanda || "",
          dosisPorToma: med.dosisPorToma !== undefined && Number(med.dosisPorToma) > 0 ? Number(med.dosisPorToma) : item.dosisPorToma,
          vecesAlDia: med.vecesAlDia !== undefined && Number(med.vecesAlDia) > 0 ? Number(med.vecesAlDia) : item.vecesAlDia,
          dosesPerDay: med.vecesAlDia !== undefined && Number(med.vecesAlDia) > 0 ? Number(med.vecesAlDia) : item.dosesPerDay,
          frecuenciaKardex: med.tipoFrecuencia === "ADemanda" ? (med.indicacionesUsoADemanda || "A Demanda / PRN") : `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}`,
          duracionDiasTratamiento: med.duracionDias || item.duracionDiasTratamiento,
          tipoTratamiento: med.tipoTratamiento || item.tipoTratamiento,
          fechaInicioTratamiento: med.fechaInicioTratamiento || item.fechaInicioTratamiento,
          fechaFinTratamiento: med.fechaFinTratamiento || item.fechaFinTratamiento,
          totalMedicamentoRequerido: med.totalMedicamentoRequerido || item.totalMedicamentoRequerido,
          daysThresholdAlert: med.diasAlertaResurtido || item.daysThresholdAlert || 5,
          ultimaActualizacion: getCurrentTimestamp(),
        });
      }
    });
  }, [clientKardex?.medicamentos, effectiveClientId]);

  const unlinkedKardexMeds = activeKardexMeds.filter((med) => {
    const normMed = normalizeText(med.nombreMedicamento);
    return !clientItems.some((inv) => {
      const normInv = normalizeText(inv.nombre);
      return (
        inv.kardexMedicationId === med.id ||
        normInv === normMed ||
        normInv.includes(normMed) ||
        normMed.includes(normInv)
      );
    });
  });

  // Track synced meds ref to avoid duplicate syncs during re-renders
  const syncedMedsRef = React.useRef<Set<string>>(new Set());

  // Function to auto-sync unlinked Kardex medications into inventory
  const handleAutoSyncKardexMeds = () => {
    if (!unlinkedKardexMeds.length) return;
    const timestamp = getCurrentTimestamp();

    unlinkedKardexMeds.forEach((med, idx) => {
      if (syncedMedsRef.current.has(med.id)) return;
      syncedMedsRef.current.add(med.id);

      const lowerName = (med.nombreMedicamento + " " + (med.via || "") + " " + (med.presentacion || "")).toLowerCase();
      // Insulina, jarabes, gotas, cremas, etc., are flagged as Manual Control (Sin Control exacto de dosis)
      const isManualControl =
        lowerName.includes("insulina") ||
        lowerName.includes("jarabe") ||
        lowerName.includes("gotas") ||
        lowerName.includes("crema") ||
        lowerName.includes("gel") ||
        lowerName.includes("solucion") ||
        lowerName.includes("inyectable") ||
        lowerName.includes("suspension") ||
        lowerName.includes("pomada");

      const itemId = `INV-KARDEX-${Date.now()}-${idx}`;
      const controlType: ControlType = isManualControl ? "Sin Control de Inventario" : "Con Control de Inventario";

      const isADemanda = med.tipoFrecuencia === "ADemanda" || (med.horario && (med.horario.toLowerCase().includes("demanda") || med.horario.toLowerCase().includes("prn")));
      const tipoFrecuencia = isADemanda ? "ADemanda" : (med.tipoFrecuencia || "HorarioFijo");
      const derivedPresentacion = med.presentacion || (isManualControl ? "Frasco / Jarabe" : "Tableta");

      const derivedDosisPorToma = med.dosisPorToma !== undefined && Number(med.dosisPorToma) > 0
        ? Number(med.dosisPorToma)
        : (parseUnitsPerDose(med.dosis, med.frecuencia || med.horario) || 1);

      const derivedVecesAlDia = isADemanda
        ? 1
        : med.vecesAlDia !== undefined && Number(med.vecesAlDia) > 0
        ? Number(med.vecesAlDia)
        : calculateDosesPerDay(med.horario || med.frecuencia || "");

      const isFinite = med.tipoTratamiento === "FinDefinido" || Boolean(med.fechaFinTratamiento);
      const derivedDuracion = isFinite ? (med.duracionDias || 7) : 30;
      const totalReq = Math.ceil(derivedDosisPorToma * derivedVecesAlDia * derivedDuracion);

      const initialMovement: InventoryMovement = {
        id: `MOV-${Date.now()}-${idx}`,
        tipo: "Ingreso",
        cantidad: 0,
        stockAnterior: 0,
        stockNuevo: 0,
        fechaHora: timestamp,
        registradoPor: currentUserName,
        notas: `Auto-sincronizado desde Kárdex (${tipoFrecuencia === 'ADemanda' ? 'Uso A Demanda / PRN' : isFinite ? `Tratamiento ${derivedDuracion} días` : 'Tratamiento Indefinido/Continuo'}). Pendiente ingresar recepción de compras.`,
      };

      const newItem: InventoryItem = {
        id: itemId,
        clientId: effectiveClientId,
        clientNombre: currentClient ? currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente : "Receptor de Servicio",
        nombre: med.nombreMedicamento,
        categoria: "Medicamento",
        presentacion: derivedPresentacion,
        tipoFrecuencia: tipoFrecuencia,
        indicacionesUsoADemanda: med.indicacionesUsoADemanda || "",
        controlTipo: controlType,
        stockActual: 0, // Initial 0 until entry is registered
        unidadMedida: derivedPresentacion ? `${derivedPresentacion}s` : (isManualControl ? "Frasco/Pluma" : "Tabletas"),
        kardexMedicationId: med.id,
        dosisPorToma: derivedDosisPorToma,
        vecesAlDia: derivedVecesAlDia,
        frecuenciaKardex: tipoFrecuencia === "ADemanda" ? (med.indicacionesUsoADemanda || "A Demanda / PRN") : `${med.dosis || ""} - ${med.horario || med.frecuencia || ""}`,
        dosesPerDay: derivedVecesAlDia,
        tipoTratamiento: isFinite ? "FinDefinido" : "Indefinido",
        fechaFinTratamiento: med.fechaFinTratamiento,
        duracionDiasTratamiento: derivedDuracion,
        totalMedicamentoRequerido: totalReq,
        daysThresholdAlert: med.diasAlertaResurtido || 5,
        marcadoStockBajoManual: isManualControl ? false : undefined,
        notas: `Cargado automáticamente desde Kárdex. Presentación: ${derivedPresentacion}. Vía: ${med.via || "Oral"}. Dosis: ${med.dosis || ""}. ${med.indicaciones ? "Notas: " + med.indicaciones : ""}`,
        historialMovimientos: [initialMovement],
        registradoPor: currentUserName,
        fechaCreacion: timestamp,
        ultimaActualizacion: timestamp,
      };

      onSaveItem(newItem);
    });
  };

  // Auto-sync effect on mount/patient change if unlinked Kardex items exist
  React.useEffect(() => {
    if (canIngresar && unlinkedKardexMeds.length > 0) {
      handleAutoSyncKardexMeds();
    }
  }, [effectiveClientId, activeKardexMeds.length, clientItems.length]);

  // Helper to test if item is LOW STOCK / NEEDS PURCHASE with treatment end logic
  const isLowStock = (item: InventoryItem): boolean => {
    if (item.controlTipo === "Sin Control de Inventario" || item.controlTipo === "Sin Control (Marcado Manual)") {
      return Boolean(item.marcadoStockBajoManual);
    }

    const med = getKardexMedForItem(item);
    const status = calculateStockAndTreatmentStatus({
      ...item,
      dosis: med?.dosis || (item.dosisPorToma ? `${item.dosisPorToma} dosis` : undefined),
      dosisPorToma: med?.dosisPorToma !== undefined && med.dosisPorToma > 0 ? med.dosisPorToma : item.dosisPorToma,
      vecesAlDia: med?.vecesAlDia !== undefined && med.vecesAlDia > 0 ? med.vecesAlDia : (item.vecesAlDia || item.dosesPerDay),
      horario: med?.horario,
      frecuencia: med?.frecuencia,
      frecuenciaKardex: item.frecuenciaKardex || (med ? `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}` : undefined),
      fechaInicioTratamiento: med?.fechaInicioTratamiento,
      fechaFinTratamiento: item.fechaFinTratamiento || med?.fechaFinTratamiento,
      duracionDias: item.duracionDiasTratamiento || med?.duracionDias,
      duracionDiasTratamiento: item.duracionDiasTratamiento || med?.duracionDias,
      tipoTratamiento: item.tipoTratamiento || med?.tipoTratamiento,
      diasAlertaResurtido: item.daysThresholdAlert || med?.diasAlertaResurtido,
      estado: med?.estado || "Activo",
    });

    return status.isLowStock;
  };

  // Filtered items
  const filteredItems = clientItems.filter((item) => {
    const matchesCat = activeCategoryFilter === "todos" || item.categoria === activeCategoryFilter;
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.frecuenciaKardex && item.frecuenciaKardex.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.notas && item.notas.toLowerCase().includes(searchQuery.toLowerCase()));

    const itemIsLow = isLowStock(item);
    let matchesStatus = true;
    if (activeStatusFilter === "stock_bajo") matchesStatus = itemIsLow;
    if (activeStatusFilter === "ok") matchesStatus = !itemIsLow;

    return matchesCat && matchesSearch && matchesStatus;
  });

  const lowStockItems = clientItems.filter(isLowStock);

  // Handlers
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemForm.nombre?.trim()) return;

    const itemId = `INV-${Date.now()}`;
    const timestamp = getCurrentTimestamp();
    const stockInit = Number(newItemForm.stockActual) || 0;

    const initialMovement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      tipo: "Ingreso",
      cantidad: stockInit,
      stockAnterior: 0,
      stockNuevo: stockInit,
      fechaHora: timestamp,
      registradoPor: currentUserName,
      notas: "Registro inicial de insumo/medicamento",
    };

    const unitsPerDose = Number((newItemForm as any).unitsPerDose) || 1;
    const isADemanda = newItemForm.tipoFrecuencia === "ADemanda";
    const dosesPerDay = isADemanda ? 1 : (Number(newItemForm.dosesPerDay) || calculateDosesPerDay(newItemForm.frecuenciaKardex || "") || 1);
    const duracionDias = Number(newItemForm.duracionDiasTratamiento) || (newItemForm.tipoTratamiento === "FinDefinido" ? 7 : 30);
    const totalRequired = isADemanda ? (unitsPerDose * 10) : Math.ceil(unitsPerDose * dosesPerDay * duracionDias);

    const newItem: InventoryItem = {
      id: itemId,
      clientId: effectiveClientId,
      clientNombre: currentClient ? currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente : "Receptor de Servicio",
      nombre: newItemForm.nombre.trim(),
      categoria: (newItemForm.categoria as InventoryCategory) || "Medicamento",
      presentacion: newItemForm.presentacion || "Tableta",
      tipoFrecuencia: newItemForm.tipoFrecuencia || "HorarioFijo",
      indicacionesUsoADemanda: newItemForm.indicacionesUsoADemanda || "",
      controlTipo: (newItemForm.controlTipo as ControlType) || "Con Control de Inventario",
      stockActual: stockInit,
      unidadMedida: newItemForm.unidadMedida || newItemForm.presentacion || "Tabletas",
      kardexMedicationId: newItemForm.kardexMedicationId || "",
      dosisPorToma: unitsPerDose,
      vecesAlDia: dosesPerDay,
      frecuenciaKardex: isADemanda ? (newItemForm.indicacionesUsoADemanda || "A Demanda / PRN") : (newItemForm.frecuenciaKardex || ""),
      dosesPerDay: dosesPerDay,
      tipoTratamiento: newItemForm.tipoTratamiento || "Indefinido",
      fechaFinTratamiento: newItemForm.fechaFinTratamiento,
      duracionDiasTratamiento: duracionDias,
      totalMedicamentoRequerido: totalRequired,
      daysThresholdAlert: Number(newItemForm.daysThresholdAlert) || 7,
      customStockMinimo: newItemForm.customStockMinimo ? Number(newItemForm.customStockMinimo) : undefined,
      marcadoStockBajoManual: false,
      notas: newItemForm.notas || "",
      historialMovimientos: [initialMovement],
      registradoPor: currentUserName,
      fechaCreacion: timestamp,
      ultimaActualizacion: timestamp,
    };

    onSaveItem(newItem);
    setIsNewItemModalOpen(false);
    setNewItemForm({
      nombre: "",
      categoria: "Medicamento",
      presentacion: "Tableta",
      tipoFrecuencia: "HorarioFijo",
      indicacionesUsoADemanda: "",
      controlTipo: "Con Control de Inventario",
      stockActual: 10,
      unidadMedida: "Tabletas",
      frecuenciaKardex: "1 vez al día",
      dosesPerDay: 1,
      daysThresholdAlert: 7,
      notas: "",
    });
  };

  // Submit Ingreso (Add stock)
  const handleIngresoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    const addQty = Math.max(1, Number(ingresoForm.cantidad) || 1);
    const prevStock = activeItem.stockActual;
    const newStock = prevStock + addQty;
    const timestamp = getCurrentTimestamp();

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      tipo: "Ingreso",
      cantidad: addQty,
      stockAnterior: prevStock,
      stockNuevo: newStock,
      fechaHora: timestamp,
      registradoPor: currentUserName,
      notas: ingresoForm.notas || "Recepción de medicamento",
    };

    const updatedItem: InventoryItem = {
      ...activeItem,
      stockActual: newStock,
      marcadoStockBajoManual: false, // reset alert if manually marked
      ultimaActualizacion: timestamp,
      historialMovimientos: [movement, ...(activeItem.historialMovimientos || [])],
    };

    onSaveItem(updatedItem);
    setIsIngresoModalOpen(false);
    setActiveItem(null);
  };

  // Submit Uso / Consumo de Insumos
  const handleUsoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    const isControlled = activeItem.controlTipo === "Con Control de Inventario" || activeItem.controlTipo === "Con Control Kardex/Conteo";
    const useQty = Math.max(1, Number(usoForm.cantidad) || 1);
    const prevStock = activeItem.stockActual;
    const newStock = isControlled ? Math.max(0, prevStock - useQty) : prevStock;
    const timestamp = getCurrentTimestamp();

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      tipo: "Uso_Insumo",
      cantidad: isControlled ? -useQty : 0,
      stockAnterior: prevStock,
      stockNuevo: newStock,
      fechaHora: timestamp,
      registradoPor: currentUserName,
      notas: usoForm.notas || "Uso/Consumo de insumo en atención del paciente",
    };

    const updatedItem: InventoryItem = {
      ...activeItem,
      stockActual: newStock,
      ultimaActualizacion: timestamp,
      historialMovimientos: [movement, ...(activeItem.historialMovimientos || [])],
    };

    onSaveItem(updatedItem);
    setIsUsoModalOpen(false);
    setActiveItem(null);
  };

  // Submit Faltante / Merma / Pérdida
  const handleFaltanteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    const deductQty = Math.max(1, Number(faltanteForm.cantidad) || 1);
    const prevStock = activeItem.stockActual;
    const newStock = Math.max(0, prevStock - deductQty);
    const timestamp = getCurrentTimestamp();

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      tipo: faltanteForm.tipo,
      cantidad: -deductQty,
      stockAnterior: prevStock,
      stockNuevo: newStock,
      fechaHora: timestamp,
      registradoPor: currentUserName,
      notas: faltanteForm.notas || "Ajuste de faltante o merma reportado",
    };

    const updatedItem: InventoryItem = {
      ...activeItem,
      stockActual: newStock,
      ultimaActualizacion: timestamp,
      historialMovimientos: [movement, ...(activeItem.historialMovimientos || [])],
    };

    onSaveItem(updatedItem);
    setIsFaltanteModalOpen(false);
    setActiveItem(null);
  };

  // Submit Admin Edit / Correction
  const handleAdminEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;

    const targetStock = Number(adminEditForm.stockActual) ?? activeItem.stockActual;
    const timestamp = getCurrentTimestamp();

    let history = activeItem.historialMovimientos || [];
    if (targetStock !== activeItem.stockActual) {
      const diff = targetStock - activeItem.stockActual;
      const movement: InventoryMovement = {
        id: `MOV-${Date.now()}`,
        tipo: "Correccion_Admin",
        cantidad: diff,
        stockAnterior: activeItem.stockActual,
        stockNuevo: targetStock,
        fechaHora: timestamp,
        registradoPor: currentUserName,
        notas: `Ajuste directo de stock por administrador.`,
      };
      history = [movement, ...history];
    }

    const updatedItem: InventoryItem = {
      ...activeItem,
      nombre: adminEditForm.nombre || activeItem.nombre,
      categoria: (adminEditForm.categoria as InventoryCategory) || activeItem.categoria,
      presentacion: adminEditForm.presentacion || activeItem.presentacion || "Tableta",
      tipoFrecuencia: adminEditForm.tipoFrecuencia || activeItem.tipoFrecuencia || "HorarioFijo",
      indicacionesUsoADemanda: adminEditForm.indicacionesUsoADemanda ?? activeItem.indicacionesUsoADemanda ?? "",
      controlTipo: (adminEditForm.controlTipo as ControlType) || activeItem.controlTipo,
      stockActual: targetStock,
      unidadMedida: adminEditForm.unidadMedida || activeItem.unidadMedida,
      frecuenciaKardex: adminEditForm.tipoFrecuencia === "ADemanda" ? (adminEditForm.indicacionesUsoADemanda || "A Demanda / PRN") : (adminEditForm.frecuenciaKardex || activeItem.frecuenciaKardex),
      dosesPerDay: Number(adminEditForm.dosesPerDay) || activeItem.dosesPerDay,
      daysThresholdAlert: Number(adminEditForm.daysThresholdAlert) || activeItem.daysThresholdAlert,
      customStockMinimo: adminEditForm.customStockMinimo ? Number(adminEditForm.customStockMinimo) : undefined,
      notas: adminEditForm.notas ?? activeItem.notas,
      ultimaActualizacion: timestamp,
      historialMovimientos: history,
    };

    onSaveItem(updatedItem);
    setIsAdminEditModalOpen(false);
    setActiveItem(null);
  };

  // Toggle manual low stock status for "Sin Control" items
  const handleToggleManualStockBajo = (item: InventoryItem) => {
    if (!canIngresar) return;
    const newStatus = !item.marcadoStockBajoManual;
    const timestamp = getCurrentTimestamp();

    const movement: InventoryMovement = {
      id: `MOV-${Date.now()}`,
      tipo: "Marca_StockBajo",
      cantidad: 0,
      stockAnterior: item.stockActual,
      stockNuevo: item.stockActual,
      fechaHora: timestamp,
      registradoPor: currentUserName,
      notas: newStatus
        ? "Marcado manualmente como Stock Bajo / Por Comprar"
        : "Marcado como Reabastecido",
    };

    const updatedItem: InventoryItem = {
      ...item,
      marcadoStockBajoManual: newStatus,
      ultimaActualizacion: timestamp,
      historialMovimientos: [movement, ...(item.historialMovimientos || [])],
    };

    onSaveItem(updatedItem);
  };

  // Copy low stock list to clipboard for WhatsApp / Email with precise treatment calculation
  const handleCopyShoppingList = () => {
    if (lowStockItems.length === 0) return;
    const clientName = currentClient ? currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente : "Receptor de Servicio";

    let text = `📋 *LISTA DE INSUMOS Y MEDICAMENTOS POR RESURTIR / COMPRAR*\n`;
    text += `👤 *Receptor de Servicio:* ${clientName}\n`;
    text += `📅 *Fecha de Solicitud:* ${new Date().toLocaleDateString("es-MX")}\n\n`;

    lowStockItems.forEach((item, idx) => {
      const med = getKardexMedForItem(item);
      const status = calculateStockAndTreatmentStatus({
        ...item,
        dosis: med?.dosis || (item.dosisPorToma ? `${item.dosisPorToma} dosis` : undefined),
        dosisPorToma: med?.dosisPorToma !== undefined && med.dosisPorToma > 0 ? med.dosisPorToma : item.dosisPorToma,
        vecesAlDia: med?.vecesAlDia !== undefined && med.vecesAlDia > 0 ? med.vecesAlDia : (item.vecesAlDia || item.dosesPerDay),
        horario: med?.horario,
        frecuencia: med?.frecuencia,
        frecuenciaKardex: item.frecuenciaKardex || (med ? `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}` : undefined),
        fechaInicioTratamiento: med?.fechaInicioTratamiento,
        fechaFinTratamiento: item.fechaFinTratamiento || med?.fechaFinTratamiento,
        duracionDias: item.duracionDiasTratamiento || med?.duracionDias,
        duracionDiasTratamiento: item.duracionDiasTratamiento || med?.duracionDias,
        tipoTratamiento: item.tipoTratamiento || med?.tipoTratamiento,
        diasAlertaResurtido: item.daysThresholdAlert || med?.diasAlertaResurtido,
        estado: med?.estado || "Activo",
      });

      // If treatment is finished, do not ask to buy
      if (status.isTreatmentFinished) return;

      text += `${idx + 1}. *${item.nombre}*\n`;
      text += `   • Categoría: ${item.categoria}\n`;
      if (item.controlTipo === "Con Control de Inventario" || item.controlTipo === "Con Control Kardex/Conteo") {
        text += `   • Dosis por Toma: ${status.dosisPorToma} ${item.unidadMedida}\n`;
        text += `   • Frecuencia Diaria: ${status.vecesAlDia} tomas/día (Consumo: ${status.dailyConsumptionUnits} ${item.unidadMedida}/día)\n`;
        if (status.hasEndDate) {
          text += `   • Duración Restante de Tratamiento: ${status.remainingDaysTreatment} días (Total necesario: ${status.totalDosesNeededToFinish} ${item.unidadMedida})\n`;
          text += `   • Stock Actual en Domicilio: ${item.stockActual} ${item.unidadMedida} (Rinde para ~${status.autonomyFormattedText})\n`;
          text += `   • 🛒 *CANTIDAD EXACTA A COMPRAR:* ${status.suggestedPurchaseQty} ${item.unidadMedida}\n`;
        } else {
          text += `   • Tipo de Tratamiento: Continuo / Indefinido (Cálculo mensual 30 días = ${status.totalMedicamentoRequerido} ${item.unidadMedida})\n`;
          text += `   • Stock Actual en Domicilio: ${item.stockActual} ${item.unidadMedida} (Rinde para ~${status.autonomyFormattedText})\n`;
          text += `   • 🛒 *CANTIDAD SUGERIDA A RESURTIR (1 Mes):* ${status.suggestedPurchaseQty} ${item.unidadMedida}\n`;
        }
      } else {
        text += `   • Estado: Insumo marcado para reposición por enfermería\n`;
      }
      if (item.notas) text += `   • Nota: ${item.notas}\n`;
      text += `\n`;
    });

    text += `_Por favor enviar foto del comprobante o avisar al personal de enfermería cuando se hayan adquirido los insumos._`;

    navigator.clipboard.writeText(text);
    alert("¡Lista de compras copiada al portapapeles! Incluye cantidades calculadas para fin de tratamiento o 1 mes continuo.");
  };

  // Generate & Download Shopping List PDF
  const handleDownloadShoppingListPDFAction = async () => {
    if (lowStockItems.length === 0) {
      alert("No hay insumos ni medicamentos en la lista de compras para exportar.");
      return;
    }
    const clientName = currentClient ? currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente : "Receptor_Servicio";
    try {
      setIsDownloadingPDF(true);
      await downloadShoppingListPDF(clientName);
    } catch (err) {
      console.error("Error al generar PDF de la lista de compras:", err);
      alert("No se pudo generar el PDF directamente. Abriendo diálogo alternativo.");
      window.print();
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // Generate & Download Official Inventory PDF
  const handleDownloadInventoryPDFAction = async () => {
    if (clientItems.length === 0) {
      alert("No hay insumos ni medicamentos registrados en el inventario para exportar.");
      return;
    }
    const clientName = currentClient ? currentClient.nombreCompletoRS || currentClient.nombreCompletoCliente : "Receptor_Servicio";
    try {
      setIsDownloadingInvPDF(true);
      await downloadInventoryPDF(clientName);
    } catch (err) {
      console.error("Error al generar PDF del inventario:", err);
      alert("No se pudo generar el PDF directamente. Abriendo diálogo alternativo.");
      window.print();
    } finally {
      setIsDownloadingInvPDF(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Package className="w-3 h-3 text-emerald-400" /> Control en Tiempo Real
              </span>
              {lowStockItems.length > 0 && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> {lowStockItems.length} por comprar
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Inventario de Insumos y Medicamentos
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Monitoreo activo de medicación, insumos médicos y artículos de cuidado. Descuento automático por Kardex y alertas inteligentes de stock bajo.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {canIngresar && (
              <button
                onClick={() => setIsNewItemModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Insumo / Med</span>
              </button>
            )}

            {/* Inventory PDF & Print Buttons */}
            <button
              type="button"
              onClick={handleDownloadInventoryPDFAction}
              disabled={isDownloadingInvPDF || clientItems.length === 0}
              className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              title="Descargar reporte oficial de inventario en PDF"
            >
              <Download className={`w-4 h-4 ${isDownloadingInvPDF ? "animate-bounce" : ""}`} />
              <span>{isDownloadingInvPDF ? "Generando..." : "Descargar PDF Inventario"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsInventoryDocModalOpen(true)}
              disabled={clientItems.length === 0}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
              title="Vista previa e impresión del reporte de inventario"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Imprimir Inventario</span>
            </button>

            {lowStockItems.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadShoppingListPDFAction}
                  disabled={isDownloadingPDF}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                  title="Generar y descargar archivo PDF de la lista de compras"
                >
                  <Download className={`w-4 h-4 ${isDownloadingPDF ? "animate-bounce" : ""}`} />
                  <span>{isDownloadingPDF ? "Generando..." : `PDF Compras (${lowStockItems.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsShoppingListModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  title="Vista previa e impresión de la lista de compras"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Ver Compras</span>
                </button>

                <button
                  onClick={handleCopyShoppingList}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  title="Copiar texto para WhatsApp"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Receptor de Servicio Selector (if not pre-filtered) */}
        {!filterClientId && clients.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-800/80 max-w-lg">
            <ReceptorServicioSearchSelector
              clients={clients}
              caratulas={caratulas}
              selectedClientId={selectedClientId}
              onSelectClient={(newId) => {
                setSelectedClientId(newId);
                if (onSelectClient) onSelectClient(newId);
              }}
              variant="card"
              label="Receptor de Servicio Seleccionado"
              placeholder="Buscar Receptor, Orden o Responsable..."
            />
          </div>
        )}
      </div>

      {/* ALERT BANNER: INSUMOS POR COMPRAR */}
      {lowStockItems.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 text-amber-900 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-xs shrink-0">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-amber-950 text-sm flex items-center gap-2">
                  <span>Alerta de Insumos y Medicamentos por Comprar</span>
                  <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {lowStockItems.length} requeridos
                  </span>
                </h3>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  Los siguientes medicamentos e insumos están por debajo del nivel de seguridad o fueron marcados por el personal para reabastecer:
                </p>

                {/* Chips of items needing purchase */}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {lowStockItems.map((item) => (
                    <span
                      key={item.id}
                      className="bg-white/80 border border-amber-300 text-amber-950 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-2 shadow-2xs"
                    >
                      <Pill className="w-3.5 h-3.5 text-amber-600" />
                      <span>{item.nombre}</span>
                      {item.controlTipo === "Con Control Kardex/Conteo" && (
                        <span className="bg-amber-200 text-amber-900 font-mono text-[10px] px-1.5 py-0.2 rounded">
                          Quedan: {item.stockActual} {item.unidadMedida}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleDownloadShoppingListPDFAction}
                disabled={isDownloadingPDF}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                title="Descargar lista de compras en formato PDF oficial"
              >
                <Download className={`w-3.5 h-3.5 ${isDownloadingPDF ? "animate-bounce" : ""}`} />
                <span>{isDownloadingPDF ? "Generando..." : "Descargar PDF"}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsShoppingListModalOpen(true)}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                title="Ver e imprimir documento oficial"
              >
                <Printer className="w-3.5 h-3.5 text-amber-600" />
                <span>Imprimir</span>
              </button>

              <button
                onClick={handleCopyShoppingList}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                title="Copiar texto para WhatsApp"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS & FILTERS BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Categorías:
          </span>
          {[
            { id: "todos", label: "Todos" },
            { id: "Medicamento", label: "Medicamentos" },
            { id: "Material/Insumo", label: "Insumos Médicos" },
            { id: "Higiene Personal", label: "Higiene" },
            { id: "Aparato/Equipo", label: "Aparatos/Equipos" },
            { id: "Solicitud de Compra", label: "Solicitudes" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeCategoryFilter === cat.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveStatusFilter("todos")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeStatusFilter === "todos"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              Todos ({clientItems.length})
            </button>
            <button
              onClick={() => setActiveStatusFilter("stock_bajo")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                activeStatusFilter === "stock_bajo"
                  ? "bg-amber-500 text-slate-950 shadow-xs"
                  : "text-slate-600"
              }`}
            >
              Por Comprar ({lowStockItems.length})
            </button>
          </div>

          <div className="relative w-40 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar insumo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* ITEMS GRID */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3 shadow-xs">
          <Package className="w-12 h-12 mx-auto text-slate-300" />
          <p className="font-bold text-slate-700 text-sm">No se encontraron medicamentos ni insumos registrados.</p>
          <p className="text-xs text-slate-500">
            {canIngresar ? "Haga clic en 'Nuevo Medicamento / Insumo' para comenzar el control de stock." : "No hay elementos registrados para este paciente."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const med = getKardexMedForItem(item);
            const status = calculateStockAndTreatmentStatus({
              ...item,
              dosis: med?.dosis || (item.dosisPorToma ? `${item.dosisPorToma} dosis` : undefined),
              dosisPorToma: med?.dosisPorToma !== undefined && med.dosisPorToma > 0 ? med.dosisPorToma : item.dosisPorToma,
              vecesAlDia: med?.vecesAlDia !== undefined && med.vecesAlDia > 0 ? med.vecesAlDia : (item.vecesAlDia || item.dosesPerDay),
              horario: med?.horario,
              frecuencia: med?.frecuencia,
              frecuenciaKardex: item.frecuenciaKardex || (med ? `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}` : undefined),
              fechaInicioTratamiento: med?.fechaInicioTratamiento,
              fechaFinTratamiento: item.fechaFinTratamiento || med?.fechaFinTratamiento,
              duracionDias: item.duracionDiasTratamiento || med?.duracionDias,
              duracionDiasTratamiento: item.duracionDiasTratamiento || med?.duracionDias,
              tipoTratamiento: item.tipoTratamiento || med?.tipoTratamiento,
              diasAlertaResurtido: item.daysThresholdAlert || med?.diasAlertaResurtido,
              estado: med?.estado || "Activo",
            });

            const itemIsLow = status.isLowStock;
            const alertDays = item.daysThresholdAlert || 5;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl border transition-all duration-200 shadow-sm hover:shadow-md p-5 flex flex-col justify-between relative overflow-hidden ${
                  status.isTreatmentFinished
                    ? "border-indigo-200 bg-indigo-50/20"
                    : itemIsLow
                    ? "border-amber-300 bg-amber-50/30 ring-1 ring-amber-400/30"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Top Item Badge Header */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase">
                        {item.categoria}
                      </span>
                      {(item.presentacion || med?.presentacion) && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                          💊 {item.presentacion || med?.presentacion}
                        </span>
                      )}
                      {(item.tipoFrecuencia === "ADemanda" || med?.tipoFrecuencia === "ADemanda" || status.isPRN) && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-[10px] px-2 py-0.5 rounded-lg">
                          ⚡ A Demanda (PRN)
                        </span>
                      )}
                    </div>

                    {status.isTreatmentFinished ? (
                      <span className="bg-indigo-100 text-indigo-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-indigo-600" /> Tratamiento Concluido
                      </span>
                    ) : itemIsLow ? (
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-slate-950" /> Por Comprar ({status.suggestedPurchaseQty} {item.unidadMedida})
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Stock Suficiente
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-slate-900 text-base leading-tight mb-1">
                    {item.nombre}
                  </h3>

                  {(item.tipoFrecuencia === "ADemanda" || med?.tipoFrecuencia === "ADemanda" || status.isPRN) ? (
                    <div className="bg-amber-50/80 border border-amber-200 p-2 rounded-xl text-xs text-amber-950 mb-2">
                      <p className="font-bold flex items-center gap-1 text-amber-900 text-[11px]">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" /> Indicación A Demanda (PRN):
                      </p>
                      <p className="text-[11px] font-medium mt-0.5">
                        {item.indicacionesUsoADemanda || med?.indicacionesUsoADemanda || item.frecuenciaKardex || med?.frecuencia || "Según dolor, fiebre, síntomas o rescate indicado"}
                      </p>
                    </div>
                  ) : (item.frecuenciaKardex || med) ? (
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-2">
                      <Clock className="w-3.5 h-3.5 shrink-0" /> Posología: {item.frecuenciaKardex || `${med?.dosis || ''} - ${med?.horario || med?.frecuencia || ''}`}
                    </p>
                  ) : null}

                  {/* Stock counter block & Autonomy */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 my-2 space-y-3">
                    {(item.controlTipo === "Con Control de Inventario" || item.controlTipo === "Con Control Kardex/Conteo") ? (
                      <>
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                              Stock Disponible
                            </span>
                            <span className={`text-2xl font-black font-mono ${itemIsLow ? "text-amber-600" : "text-slate-900"}`}>
                              {item.stockActual}
                            </span>
                            <span className="text-xs font-bold text-slate-500 ml-1.5">{item.unidadMedida}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                              Autonomía de Stock
                            </span>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-xl inline-block ${
                              status.isPRN
                                ? "bg-amber-100 text-amber-900 border border-amber-300 font-sans"
                                : status.rawDaysOfStock <= alertDays
                                ? "bg-amber-100 text-amber-900 border border-amber-300 font-mono"
                                : "bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono"
                            }`}>
                              {status.isPRN ? "A Demanda (PRN)" : `~${status.autonomyFormattedText}`}
                            </span>
                          </div>
                        </div>

                        {/* DESGLOSE DEL CÁLCULO DE INSUMOS */}
                        {status.isPRN ? (
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase border-b border-slate-100 pb-1">
                              <span>Control de Medicamento A Demanda</span>
                              <span className="text-amber-600 font-bold">Uso Ocasional</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              Este medicamento o insumo no cuenta con un consumo diario fijo predecible. Registre cada aplicación con el botón <strong>&quot;Registrar Uso&quot;</strong> al administrar.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase border-b border-slate-100 pb-1">
                              <span>Variables de Cálculo</span>
                              <span>Parámetro de Dosis</span>
                            </div>

                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-slate-500">Dosis por toma:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {status.dosisPorToma} {item.unidadMedida}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-slate-500">Frecuencia diaria:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {status.vecesAlDia} tomas/día
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded">
                              <span className="font-semibold text-slate-600">Consumo diario:</span>
                              <span className="font-extrabold text-slate-950 font-mono">
                                {status.dailyConsumptionUnits} {item.unidadMedida}/día
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-slate-700">
                              <span className="text-slate-500">Duración del tratamiento:</span>
                              <span className="font-bold text-slate-900 font-mono">
                                {status.hasEndDate ? `${status.remainingDaysTreatment} días restantes` : `30 días (Mes)`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-indigo-950 bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100 font-bold">
                              <span>Total Medicamento Requerido:</span>
                              <span className="font-mono font-black text-indigo-900 text-xs">
                                {status.totalMedicamentoRequerido} {item.unidadMedida}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Status / Purchase recommendation banner */}
                        <div className={`p-2.5 rounded-xl text-[11px] font-medium border ${
                          status.isTreatmentFinished
                            ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                            : itemIsLow
                            ? "bg-amber-100/70 border-amber-300 text-amber-950"
                            : "bg-emerald-50 border-emerald-200 text-emerald-950"
                        }`}>
                          {status.isTreatmentFinished ? (
                            <div className="flex items-center gap-1.5 font-bold">
                              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>Tratamiento concluido. No requiere comprar nuevamente.</span>
                            </div>
                          ) : status.hasEndDate ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                <span>Tratamiento con Fin Programado ({status.remainingDaysTreatment} días)</span>
                              </div>
                              {status.rawDaysOfStock < status.remainingDaysTreatment ? (
                                <p className="text-[10.5px] font-bold text-amber-950 bg-amber-200/60 p-1.5 rounded-lg border border-amber-300/80">
                                  ⚠️ <strong>Faltante por Comprar:</strong> <strong>{status.suggestedPurchaseQty} {item.unidadMedida}</strong> para cubrir los {status.remainingDaysTreatment} días (Se agota el {status.stockExhaustionDateStr}).
                                </p>
                              ) : (
                                <p className="text-[10.5px] text-emerald-900 font-bold">
                                  ✓ Stock suficiente: Cubre los {status.remainingDaysTreatment} días restantes hasta el término del tratamiento.
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 font-bold">
                                <Sparkles className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                <span>Tratamiento Indefinido / Continuo</span>
                              </div>
                              {itemIsLow ? (
                                <p className="text-[10.5px] font-bold text-amber-950 bg-amber-200/60 p-1.5 rounded-lg border border-amber-300/80">
                                  🛒 <strong>Alerta de resurtido:</strong> Stock actual rinde para {status.autonomyFormattedText}. Comprar resurtido de <strong>{status.suggestedPurchaseQty} {item.unidadMedida}</strong> (Para 1 mes).
                                </p>
                              ) : (
                                <p className="text-[10.5px] text-emerald-900 font-medium">
                                  ✓ Stock seguro: Rinde para {status.autonomyFormattedText} de tratamiento continuo (hasta el {status.stockExhaustionDateStr}).
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Nurse Configurable Alert Threshold */}
                        {canIngresar && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                            <span className="text-slate-500 font-bold flex items-center gap-1">
                              <Bell className="w-3 h-3 text-slate-400" /> Alertar si rinde menos de:
                            </span>
                            <select
                              value={alertDays}
                              onChange={(e) => {
                                const newDays = Number(e.target.value);
                                onSaveItem({
                                  ...item,
                                  daysThresholdAlert: newDays,
                                  ultimaActualizacion: getCurrentTimestamp(),
                                });
                              }}
                              className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 font-bold text-slate-800 text-[10.5px] focus:ring-1 focus:ring-emerald-500 outline-none"
                              title="Configurar con cuántos días de anticipación alertar para resurtido"
                            >
                              <option value={3}>3 días</option>
                              <option value={5}>5 días</option>
                              <option value={7}>7 días (1 semana)</option>
                              <option value={10}>10 días</option>
                              <option value={14}>14 días (2 semanas)</option>
                              <option value={30}>30 días (1 mes)</option>
                            </select>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Control Manual</span>
                          <span className="text-xs font-bold text-slate-700">Sin conteo de dosis unitario</span>
                        </div>
                        {canIngresar && (
                          <button
                            onClick={() => handleToggleManualStockBajo(item)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
                              item.marcadoStockBajoManual
                                ? "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200"
                                : "bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300"
                            }`}
                          >
                            {item.marcadoStockBajoManual ? "Marcar Surtido" : "Marcar por Comprar"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {item.notas && (
                    <p className="text-xs text-slate-500 italic mb-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                      "{item.notas}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    {/* Ingreso + Uso + Faltante Buttons (Enfermeros and Admin) */}
                    {canIngresar && (
                      <div className="flex items-center gap-1.5 w-full">
                        <button
                          onClick={() => {
                            setActiveItem(item);
                            setIngresoForm({ cantidad: 10, notas: "Recepción de compras enviada por familiares" });
                            setIsIngresoModalOpen(true);
                          }}
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 py-1.5 px-1.5 rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1"
                          title="Agregar compras o recepciones enviadas por familiares"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                          <span>+ Ingreso</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveItem(item);
                            setUsoForm({ cantidad: 1, notas: `Uso de ${item.nombre} en atención de enfermería` });
                            setIsUsoModalOpen(true);
                          }}
                          className="flex-1 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 py-1.5 px-1.5 rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1"
                          title="Registrar uso o consumo de este insumo/medicamento"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
                          <span>- Marcar Uso</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveItem(item);
                            setFaltanteForm({ tipo: "Ajuste_Faltante", cantidad: 1, notas: "" });
                            setIsFaltanteModalOpen(true);
                          }}
                          className="flex-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 py-1.5 px-1.5 rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1"
                          title="Registrar merma, pérdida o faltante con nota explicativa"
                        >
                          <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                          <span>- Faltante</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Secondary buttons: History, Admin Edit */}
                  <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                    <button
                      onClick={() => {
                        setActiveItem(item);
                        setIsHistoryModalOpen(true);
                      }}
                      className="text-slate-600 hover:text-slate-900 font-bold text-[11px] flex items-center gap-1 hover:underline"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Movimientos ({item.historialMovimientos?.length || 0})</span>
                    </button>

                    {/* Admin Only Direct Stock Edit */}
                    {canAdminEdit && (
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setAdminEditForm({ ...item });
                          setIsAdminEditModalOpen(true);
                        }}
                        className="text-sky-700 hover:text-sky-900 font-bold text-[11px] flex items-center gap-1 hover:underline"
                        title="Modificar stock o datos (Solo Administrador)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar Admin</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: NUEVO MEDICAMENTO / INSUMO */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Nuevo Medicamento o Insumo</h3>
                  <p className="text-xs text-slate-500">Registrar en inventario para paciente actual</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="space-y-4 text-xs">
              {/* Opción de Auto-llenar desde Kárdex */}
              {activeKardexMeds.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-1.5">
                  <label className="block font-black text-emerald-900 uppercase text-[10px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-completar desde Kárdex del Paciente
                  </label>
                  <select
                    value={newItemForm.kardexMedicationId || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      if (!selectedId) return;
                      const selectedMed = activeKardexMeds.find((m) => m.id === selectedId);
                      if (!selectedMed) return;

                      const derivedDose = selectedMed.dosisPorToma !== undefined && Number(selectedMed.dosisPorToma) > 0
                        ? Number(selectedMed.dosisPorToma)
                        : (parseUnitsPerDose(selectedMed.dosis, selectedMed.frecuencia || selectedMed.horario) || 1);

                      const derivedFreq = selectedMed.vecesAlDia !== undefined && Number(selectedMed.vecesAlDia) > 0
                        ? Number(selectedMed.vecesAlDia)
                        : (calculateDosesPerDay(selectedMed.horario || selectedMed.frecuencia || "") || 1);

                      const isFinite = selectedMed.tipoTratamiento === "FinDefinido" || Boolean(selectedMed.fechaFinTratamiento);
                      const derivedDur = isFinite ? (selectedMed.duracionDias || 7) : 30;

                      setNewItemForm({
                        ...newItemForm,
                        nombre: selectedMed.nombreMedicamento,
                        categoria: "Medicamento",
                        kardexMedicationId: selectedMed.id,
                        dosesPerDay: derivedFreq,
                        ...({ unitsPerDose: derivedDose } as any),
                        duracionDiasTratamiento: derivedDur,
                        tipoTratamiento: isFinite ? "FinDefinido" : "Indefinido",
                        fechaFinTratamiento: selectedMed.fechaFinTratamiento,
                        frecuenciaKardex: `${selectedMed.dosis || ""} - ${selectedMed.horario || selectedMed.frecuencia || ""}`,
                        daysThresholdAlert: selectedMed.diasAlertaResurtido || 5,
                      });
                    }}
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Seleccionar medicamento activo del Kárdex --</option>
                    {activeKardexMeds.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombreMedicamento} ({m.dosis} - {m.horario || m.frecuencia})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">
                  Nombre del Medicamento o Insumo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Losartán 50mg, Acetilcisteína 600mg, Gasas estériles, Gel antibacterial..."
                  value={newItemForm.nombre}
                  onChange={(e) => setNewItemForm({ ...newItemForm, nombre: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* PRESENTACIÓN DEL MEDICAMENTO / INSUMO */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-slate-800 uppercase text-[10px]">
                    Presentación Farmacéutica o Tipo de Insumo *
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">Unidad para control</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={newItemForm.presentacion || "Tableta"}
                    onChange={(e) => {
                      const p = e.target.value;
                      setNewItemForm({
                        ...newItemForm,
                        presentacion: p,
                        unidadMedida: `${p}s`,
                      });
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-bold"
                  >
                    {PRESENTACIONES_MEDICAMENTOS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Otra..."
                    value={newItemForm.presentacion || ""}
                    onChange={(e) => {
                      const p = e.target.value;
                      setNewItemForm({
                        ...newItemForm,
                        presentacion: p,
                        unidadMedida: `${p}s`,
                      });
                    }}
                    className="w-28 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-900 text-xs font-semibold"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {["Tableta", "Cápsula", "Jarabe", "Gotas", "Crema", "Ampolleta / Inyectable", "Solución", "Pieza"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setNewItemForm({
                          ...newItemForm,
                          presentacion: chip,
                          unidadMedida: `${chip}s`,
                        });
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition ${
                        newItemForm.presentacion === chip
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* TIPO DE FRECUENCIA: HORARIO FIJO VS A DEMANDA (PRN) */}
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl space-y-2">
                <label className="block font-black text-amber-950 uppercase text-[10px]">
                  Modalidad de Uso / Frecuencia *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemForm({ ...newItemForm, tipoFrecuencia: "HorarioFijo" })}
                    className={`p-2 rounded-xl font-black text-xs border text-left transition ${
                      newItemForm.tipoFrecuencia !== "ADemanda"
                        ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⏰ Horario Fijo
                    <span className={`block text-[10px] font-normal ${newItemForm.tipoFrecuencia !== "ADemanda" ? "text-emerald-100" : "text-slate-500"}`}>
                      Tomas en horas programadas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewItemForm({ ...newItemForm, tipoFrecuencia: "ADemanda" })}
                    className={`p-2 rounded-xl font-black text-xs border text-left transition ${
                      newItemForm.tipoFrecuencia === "ADemanda"
                        ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⚡ A Demanda (PRN)
                    <span className={`block text-[10px] font-normal ${newItemForm.tipoFrecuencia === "ADemanda" ? "text-amber-100" : "text-slate-500"}`}>
                      Según dolor, fiebre o rescate
                    </span>
                  </button>
                </div>

                {newItemForm.tipoFrecuencia === "ADemanda" && (
                  <div className="pt-1.5 space-y-1">
                    <label className="block font-bold text-amber-900 uppercase text-[10px]">
                      Criterio o Indicación de Uso A Demanda *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: En caso de dolor > 4/10, fiebre > 38°C, vómito o agitación..."
                      value={newItemForm.indicacionesUsoADemanda || ""}
                      onChange={(e) => setNewItemForm({ ...newItemForm, indicacionesUsoADemanda: e.target.value })}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-slate-900 font-medium text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Categoría</label>
                  <select
                    value={newItemForm.categoria}
                    onChange={(e) => setNewItemForm({ ...newItemForm, categoria: e.target.value as InventoryCategory })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    <option value="Medicamento">Medicamento</option>
                    <option value="Material/Insumo">Material / Insumo Médico</option>
                    <option value="Higiene Personal">Higiene Personal</option>
                    <option value="Aparato/Equipo">Aparato / Equipo</option>
                    <option value="Solicitud de Compra">Solicitud de Compra</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Tipo de Control</label>
                  <select
                    value={newItemForm.controlTipo}
                    onChange={(e) => setNewItemForm({ ...newItemForm, controlTipo: e.target.value as ControlType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    <option value="Con Control de Inventario">Con Control de Inventario (Conteo Numérico)</option>
                    <option value="Sin Control de Inventario">Sin Control de Inventario (Marcado Manual)</option>
                  </select>
                </div>
              </div>

              {(newItemForm.controlTipo === "Con Control de Inventario" || newItemForm.controlTipo === "Con Control Kardex/Conteo") && (
                <>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Stock Inicial</label>
                      <input
                        type="number"
                        min="0"
                        value={newItemForm.stockActual}
                        onChange={(e) => setNewItemForm({ ...newItemForm, stockActual: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Unidad de Medida</label>
                      <input
                        type="text"
                        placeholder="Ej: Tabletas, Cajas, Piezas, Frascos"
                        value={newItemForm.unidadMedida}
                        onChange={(e) => setNewItemForm({ ...newItemForm, unidadMedida: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  {newItemForm.tipoFrecuencia !== "ADemanda" && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-[11px] font-black uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-emerald-600" />
                          Parámetros de Dosificación y Consumo
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Cálculo Automático
                        </span>
                      </div>

                      {/* Botones de Selección Rápida de Frecuencia */}
                      <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200">
                        <label className="block font-black text-slate-700 uppercase text-[10px]">
                          Frecuencia Médica de Tomas (Horas / Tomas por día) *
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {FREQUENCY_PRESETS.map((preset) => {
                            const isSelected = Number(newItemForm.dosesPerDay) === preset.takesPerDay;
                            return (
                              <button
                                key={preset.intervalHours}
                                type="button"
                                onClick={() => {
                                  setNewItemForm({
                                    ...newItemForm,
                                    dosesPerDay: preset.takesPerDay,
                                    frecuenciaKardex: preset.label,
                                  });
                                }}
                                className={`p-1.5 rounded-lg border text-center transition flex flex-col items-center justify-center ${
                                  isSelected
                                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                    : "bg-slate-50 text-slate-700 hover:bg-emerald-50 border-slate-200"
                                }`}
                              >
                                <span className="text-[11px] font-black">c/{preset.intervalHours}h</span>
                                <span className={`text-[9px] font-bold ${isSelected ? "text-emerald-100" : "text-slate-500"}`}>
                                  {preset.takesPerDay} {preset.takesPerDay === 1 ? 'toma/d' : 'tomas/d'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        {/* Dosis por toma */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <label className="block font-black text-slate-700 uppercase text-[10px]">
                            Dosis por Toma *
                          </label>
                          <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            value={newItemForm.dosesPerDay !== undefined && (newItemForm as any).unitsPerDose !== undefined ? (newItemForm as any).unitsPerDose : 1}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1;
                              setNewItemForm({
                                ...newItemForm,
                                ...({ unitsPerDose: val } as any),
                              });
                            }}
                            className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-2.5 py-1.5 text-slate-900 font-black font-mono"
                          />
                          <span className="text-[9.5px] text-slate-500 block">Unidades en cada toma</span>
                        </div>

                        {/* Frecuencia diaria (veces al día) */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <label className="block font-black text-slate-700 uppercase text-[10px]">
                            Tomas al Día *
                          </label>
                          <select
                            value={newItemForm.dosesPerDay || 3}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setNewItemForm({
                                ...newItemForm,
                                dosesPerDay: v,
                                frecuenciaKardex: v === 12 ? "Cada 2 horas (12 tomas/día)" : v === 6 ? "Cada 4 horas (6 tomas/día)" : v === 4 ? "Cada 6 horas (4 tomas/día)" : v === 3 ? "Cada 8 horas (3 tomas/día)" : v === 2 ? "Cada 12 horas (2 tomas/día)" : "Cada 24 horas (1 toma/día)",
                              });
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-slate-900 font-black"
                          >
                            <option value={12}>12 tomas al día (c/2h)</option>
                            <option value={6}>6 tomas al día (c/4h)</option>
                            <option value={4}>4 tomas al día (c/6h)</option>
                            <option value={3}>3 tomas al día (c/8h)</option>
                            <option value={2}>2 tomas al día (c/12h)</option>
                            <option value={1}>1 toma al día (c/24h)</option>
                          </select>
                          <span className="text-[9.5px] text-slate-500 block">Número de tomas en 24h</span>
                        </div>

                        {/* Duración del tratamiento */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                          <label className="block font-black text-slate-700 uppercase text-[10px]">
                            Duración del Tratamiento *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newItemForm.duracionDiasTratamiento || (newItemForm.tipoTratamiento === "FinDefinido" ? 7 : 30)}
                            onChange={(e) => {
                              const d = Number(e.target.value) || 1;
                              setNewItemForm({
                                ...newItemForm,
                                duracionDiasTratamiento: d,
                              });
                            }}
                            className="w-full bg-amber-50/50 border border-amber-300 rounded-xl px-2.5 py-1.5 text-slate-900 font-black font-mono"
                          />
                          <span className="text-[9.5px] text-slate-500 block">{newItemForm.tipoTratamiento === "FinDefinido" ? "Días restantes" : "Días proyección (30d)"}</span>
                        </div>
                      </div>

                      {/* Resumen de Cálculo de Necesidades y Autonomía */}
                      {(() => {
                        const dose = (newItemForm as any).unitsPerDose || 1;
                        const freq = newItemForm.dosesPerDay || 3;
                        const days = newItemForm.duracionDiasTratamiento || (newItemForm.tipoTratamiento === "FinDefinido" ? 7 : 30);
                        const dailyCons = dose * freq;
                        const totalNeeded = Math.ceil(dose * freq * days);
                        const initialStock = Number(newItemForm.stockActual) || 0;
                        const missingQty = Math.max(0, totalNeeded - initialStock);
                        const daysAutonomy = dailyCons > 0 ? (initialStock / dailyCons).toFixed(1) : "0";

                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-700 space-y-2 text-xs">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-1 text-[10.5px]">
                              <span className="text-emerald-400 font-bold uppercase">Proyección de Consumo y Necesidades</span>
                              <span className="text-slate-300 font-mono">Consumo: <strong>{dailyCons}</strong> {newItemForm.unidadMedida || 'tabletas'}/día</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                              <div className="bg-slate-800 p-1.5 rounded-lg">
                                <span className="text-[9px] text-slate-400 block uppercase">Stock Inicial</span>
                                <span className="text-sm font-black text-white">{initialStock}</span>
                              </div>
                              <div className="bg-slate-800 p-1.5 rounded-lg">
                                <span className="text-[9px] text-slate-400 block uppercase">Total Requerido</span>
                                <span className="text-sm font-black text-amber-300">{totalNeeded}</span>
                              </div>
                              <div className="bg-slate-800 p-1.5 rounded-lg">
                                <span className="text-[9px] text-slate-400 block uppercase">Faltante a Comprar</span>
                                <span className={`text-sm font-black ${missingQty > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                  {missingQty > 0 ? `${missingQty}` : "Cubierto ✓"}
                                </span>
                              </div>
                              <div className="bg-slate-800 p-1.5 rounded-lg">
                                <span className="text-[9px] text-slate-400 block uppercase">Autonomía</span>
                                <span className="text-sm font-black text-emerald-300">{daysAutonomy} días</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 bg-sky-50/60 p-3 rounded-2xl border border-sky-200">
                    <div>
                      <label className="block font-bold text-sky-900 mb-1 uppercase text-[10px]">Tipo de Tratamiento</label>
                      <select
                        value={newItemForm.tipoTratamiento || 'Indefinido'}
                        onChange={(e) => setNewItemForm({ ...newItemForm, tipoTratamiento: e.target.value as any })}
                        className="w-full bg-white border border-sky-300 rounded-xl px-3 py-1.5 text-slate-900 font-bold"
                      >
                        <option value="Indefinido">Indefinido / Crónico (Resurtir 1 mes)</option>
                        <option value="FinDefinido">Fin Definido (Calcular dosis restantes)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-sky-900 mb-1 uppercase text-[10px]">Alertar al quedar (días de stock)</label>
                      <select
                        value={newItemForm.daysThresholdAlert || 5}
                        onChange={(e) => setNewItemForm({ ...newItemForm, daysThresholdAlert: Number(e.target.value) })}
                        className="w-full bg-white border border-sky-300 rounded-xl px-3 py-1.5 text-slate-900 font-bold"
                      >
                        <option value={3}>3 días de stock</option>
                        <option value={5}>5 días de stock</option>
                        <option value={7}>1 semana (7 días)</option>
                        <option value={10}>10 días</option>
                        <option value={14}>2 semanas (14 días)</option>
                        <option value={30}>1 mes (30 días)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Notas Adicionales</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Marca preferida, caja de 30 comprimidos, enviado por hijo en bolsa sellada..."
                  value={newItemForm.notas}
                  onChange={(e) => setNewItemForm({ ...newItemForm, notas: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-md"
                >
                  Guardar en Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INGRESAR COMPRAS / ENVIOS (+ STOCK) */}
      {isIngresoModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Registrar Ingreso de Medicamento</h3>
                  <p className="text-xs text-slate-500">{activeItem.nombre}</p>
                </div>
              </div>
              <button onClick={() => setIsIngresoModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIngresoSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-600">Stock Actual en Sistema:</span>
                <span className="font-black text-slate-900 font-mono text-sm">{activeItem.stockActual} {activeItem.unidadMedida}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">
                  Cantidad Recibida o Comprada *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={ingresoForm.cantidad}
                  onChange={(e) => setIngresoForm({ ...ingresoForm, cantidad: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black font-mono text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Nota de Recepción / Familiar</label>
                <input
                  type="text"
                  placeholder="Ej: Traído por familiar en turno vespertino"
                  value={ingresoForm.notas}
                  onChange={(e) => setIngresoForm({ ...ingresoForm, notas: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsIngresoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-md"
                >
                  Sumar al Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: REGISTRAR USO / CONSUMO DE INSUMO */}
      {isUsoModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-100 text-sky-800 rounded-xl">
                  <CheckSquare className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Registrar Uso / Consumo</h3>
                  <p className="text-xs text-slate-500">{activeItem.nombre}</p>
                </div>
              </div>
              <button onClick={() => setIsUsoModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUsoSubmit} className="space-y-4 text-xs">
              {(activeItem.controlTipo === "Con Control de Inventario" || activeItem.controlTipo === "Con Control Kardex/Conteo") && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-600">Stock Actual Disponible:</span>
                  <span className="font-black text-slate-900 font-mono text-sm">{activeItem.stockActual} {activeItem.unidadMedida}</span>
                </div>
              )}

              {(activeItem.controlTipo === "Con Control de Inventario" || activeItem.controlTipo === "Con Control Kardex/Conteo") ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">
                    Cantidad Utilizada / Consumida * ({activeItem.unidadMedida})
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeItem.stockActual > 0 ? activeItem.stockActual : 999}
                    required
                    value={usoForm.cantidad}
                    onChange={(e) => setUsoForm({ ...usoForm, cantidad: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black font-mono text-lg focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              ) : (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-xs font-medium">
                  Este artículo está registrado en modo <strong>Sin Control de Conteo</strong>. Se registrará la nota de uso en la bitácora sin restar un conteo numérico.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Detalle o Nota de Uso</label>
                <input
                  type="text"
                  placeholder="Ej: Curación de herida, aseo matutino, cambio de pañal..."
                  value={usoForm.notas}
                  onChange={(e) => setUsoForm({ ...usoForm, notas: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsUsoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-white shadow-md"
                >
                  Registrar Uso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isFaltanteModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Registrar Faltante o Merma</h3>
                  <p className="text-xs text-slate-500">{activeItem.nombre}</p>
                </div>
              </div>
              <button onClick={() => setIsFaltanteModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFaltanteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Tipo de Ajuste</label>
                <select
                  value={faltanteForm.tipo}
                  onChange={(e) => setFaltanteForm({ ...faltanteForm, tipo: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                >
                  <option value="Ajuste_Faltante">Faltante o Consumo por Familiar / Externo</option>
                  <option value="Ajuste_Perdida">Pérdida, Daño o Frasco Roto</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Cantidad a Descontar *</label>
                <input
                  type="number"
                  min="1"
                  max={activeItem.stockActual}
                  required
                  value={faltanteForm.cantidad}
                  onChange={(e) => setFaltanteForm({ ...faltanteForm, cantidad: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-black font-mono text-lg focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Explicación / Nota Obligatoria *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ej: Familiar tomó 2 tabletas para consumo propio / Frasco cayó al suelo y se rompió..."
                  value={faltanteForm.notas}
                  onChange={(e) => setFaltanteForm({ ...faltanteForm, notas: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsFaltanteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white shadow-md"
                >
                  Descontar Faltante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADMIN EDIT / CORRECCIÓN DIRECTA */}
      {isAdminEditModalOpen && activeItem && canAdminEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-100 text-sky-800 rounded-xl">
                  <Edit2 className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Edición Directa (Solo Administrador)</h3>
                  <p className="text-xs text-slate-500">Corregir datos de inventario</p>
                </div>
              </div>
              <button onClick={() => setIsAdminEditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Nombre</label>
                  <input
                    type="text"
                    value={adminEditForm.nombre}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, nombre: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Tipo de Control</label>
                  <select
                    value={adminEditForm.controlTipo || "Con Control de Inventario"}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, controlTipo: e.target.value as ControlType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  >
                    <option value="Con Control de Inventario">Con Control de Inventario</option>
                    <option value="Sin Control de Inventario">Sin Control de Inventario</option>
                  </select>
                </div>
              </div>

              {/* PRESENTACIÓN */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                <label className="block font-black text-slate-800 uppercase text-[10px]">
                  Presentación Farmacéutica
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={adminEditForm.presentacion || "Tableta"}
                    onChange={(e) => {
                      const p = e.target.value;
                      setAdminEditForm({
                        ...adminEditForm,
                        presentacion: p,
                        unidadMedida: `${p}s`,
                      });
                    }}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900 font-bold"
                  >
                    {PRESENTACIONES_MEDICAMENTOS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Otra..."
                    value={adminEditForm.presentacion || ""}
                    onChange={(e) => {
                      const p = e.target.value;
                      setAdminEditForm({
                        ...adminEditForm,
                        presentacion: p,
                        unidadMedida: `${p}s`,
                      });
                    }}
                    className="w-28 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-900 text-xs font-semibold"
                  />
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {["Tableta", "Cápsula", "Jarabe", "Gotas", "Crema", "Ampolleta / Inyectable", "Solución", "Pieza"].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setAdminEditForm({
                          ...adminEditForm,
                          presentacion: chip,
                          unidadMedida: `${chip}s`,
                        });
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition ${
                        adminEditForm.presentacion === chip
                          ? "bg-sky-600 text-white border-sky-700 shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* TIPO DE FRECUENCIA: HORARIO FIJO VS A DEMANDA (PRN) */}
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl space-y-2">
                <label className="block font-black text-amber-950 uppercase text-[10px]">
                  Modalidad de Uso / Frecuencia
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminEditForm({ ...adminEditForm, tipoFrecuencia: "HorarioFijo" })}
                    className={`p-2 rounded-xl font-black text-xs border text-left transition ${
                      adminEditForm.tipoFrecuencia !== "ADemanda"
                        ? "bg-sky-600 text-white border-sky-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⏰ Horario Fijo
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminEditForm({ ...adminEditForm, tipoFrecuencia: "ADemanda" })}
                    className={`p-2 rounded-xl font-black text-xs border text-left transition ${
                      adminEditForm.tipoFrecuencia === "ADemanda"
                        ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    ⚡ A Demanda (PRN)
                  </button>
                </div>

                {adminEditForm.tipoFrecuencia === "ADemanda" && (
                  <div className="pt-1.5 space-y-1">
                    <label className="block font-bold text-amber-900 uppercase text-[10px]">
                      Criterio o Indicación de Uso A Demanda
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: En caso de dolor > 4/10, fiebre > 38°C o rescate..."
                      value={adminEditForm.indicacionesUsoADemanda || ""}
                      onChange={(e) => setAdminEditForm({ ...adminEditForm, indicacionesUsoADemanda: e.target.value })}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-slate-900 font-medium text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Stock Modificado Directo</label>
                  <input
                    type="number"
                    min="0"
                    value={adminEditForm.stockActual}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, stockActual: Number(e.target.value) })}
                    className="w-full bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-slate-900 font-black font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase text-[10px]">Unidad de Medida</label>
                  <input
                    type="text"
                    value={adminEditForm.unidadMedida}
                    onChange={(e) => setAdminEditForm({ ...adminEditForm, unidadMedida: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                {onDeleteItem && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar ${activeItem.nombre} del inventario?`)) {
                        onDeleteItem(activeItem.id);
                        setIsAdminEditModalOpen(false);
                      }
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> Eliminar Insumo
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAdminEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-white shadow-md"
                  >
                    Guardar Corrección Admin
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: HISTORIAL DE MOVIMIENTOS */}
      {isHistoryModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto animate-scaleIn">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <History className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Historial de Movimientos</h3>
                  <p className="text-xs text-slate-500">{activeItem.nombre}</p>
                </div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {(!activeItem.historialMovimientos || activeItem.historialMovimientos.length === 0) ? (
                <p className="text-xs text-slate-400 text-center py-6">Sin registros de movimientos guardados.</p>
              ) : (
                activeItem.historialMovimientos.map((mov) => {
                  const isPositive = mov.cantidad > 0;
                  return (
                    <div key={mov.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-start justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-md ${
                            mov.tipo === "Ingreso" ? "bg-emerald-100 text-emerald-800" :
                            mov.tipo === "Descuento_Kardex" ? "bg-sky-100 text-sky-800" :
                            mov.tipo === "Correccion_Admin" ? "bg-purple-100 text-purple-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {mov.tipo}
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">{mov.fechaHora}</span>
                        </div>
                        <p className="text-slate-700 font-medium">{mov.notas || "Sin nota adicional"}</p>
                        <p className="text-[10px] text-slate-400">Por: {mov.registradoPor}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`font-mono font-black text-sm block ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? `+${mov.cantidad}` : mov.cantidad}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Stock: {mov.stockAnterior} ➔ {mov.stockNuevo}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t text-right">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFSCREEN SHOPPING LIST DOCUMENT FOR PDF GENERATION */}
      <div
        id="shopping-list-offscreen-render-wrapper"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0px",
          width: "850px",
          zIndex: -9999,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <ShoppingListDocument
          items={lowStockItems}
          client={currentClient}
          caratula={currentCaratula}
          kardexRecords={kardexRecords}
        />
      </div>

      {/* OFFSCREEN INVENTORY DOCUMENT FOR PDF GENERATION */}
      <div
        id="inventory-offscreen-render-wrapper"
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0px",
          width: "850px",
          zIndex: -9999,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <InventoryDocument
          items={clientItems}
          client={currentClient}
          caratula={currentCaratula}
        />
      </div>

      {/* SHOPPING LIST PREVIEW & EXPORT MODAL */}
      {isShoppingListModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 print:p-0 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:border-none print:bg-white print:rounded-none print:shadow-none">
            {/* Modal Header (Hidden in Print) */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Vista Previa de la Lista de Compras
                  </h3>
                  <p className="text-xs text-slate-400">
                    {currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente || "Receptor de Servicio"} • {lowStockItems.length} insumos por reabastecer
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadShoppingListPDFAction}
                  disabled={isDownloadingPDF}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Descargar archivo PDF"
                >
                  <Download className={`w-4 h-4 ${isDownloadingPDF ? "animate-bounce" : ""}`} />
                  <span>{isDownloadingPDF ? "Generando..." : "Descargar PDF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                  title="Imprimir documento"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyShoppingList}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                  title="Copiar texto para WhatsApp"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsShoppingListModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              <div className="w-full max-w-[850px] shadow-2xl bg-white rounded-xl overflow-hidden print:shadow-none print:rounded-none">
                <ShoppingListDocument
                  items={lowStockItems}
                  client={currentClient}
                  caratula={currentCaratula}
                  kardexRecords={kardexRecords}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL INVENTORY DOCUMENT PREVIEW & EXPORT MODAL */}
      {isInventoryDocModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 print:p-0 animate-fadeIn">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:border-none print:bg-white print:rounded-none print:shadow-none">
            {/* Modal Header (Hidden in Print) */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-600/30 text-sky-400 rounded-xl border border-sky-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Vista Previa del Inventario y Stock Oficial
                  </h3>
                  <p className="text-xs text-slate-400">
                    {currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente || "Receptor de Servicio"} • {clientItems.length} insumos registrados
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadInventoryPDFAction}
                  disabled={isDownloadingInvPDF}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
                  title="Descargar archivo PDF"
                >
                  <Download className={`w-4 h-4 ${isDownloadingInvPDF ? "animate-bounce" : ""}`} />
                  <span>{isDownloadingInvPDF ? "Generando..." : "Descargar PDF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                  title="Imprimir documento"
                >
                  <Printer className="w-4 h-4 text-sky-400" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsInventoryDocModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              <div className="w-full max-w-[850px] shadow-2xl bg-white rounded-xl overflow-hidden print:shadow-none print:rounded-none">
                <InventoryDocument
                  items={clientItems}
                  client={currentClient}
                  caratula={currentCaratula}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
