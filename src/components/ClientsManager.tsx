import React, { useState, useRef, useMemo } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { Client, ClientDocument, Caratula, AbonoTicket, Sucursal, UserSession } from "../types";
import { getCurrentTimestamp, getNextClientId, formatCurrency } from "../utils/formatters";
import { deduplicateClients } from "../utils/dataIntegrity";
import { calculateClientBalance } from "../utils/clientBalance";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Upload,
  FolderOpen,
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  Scale,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Building2,
} from "lucide-react";
import { MassImportModal } from "./MassImportModal";
import { DocumentUploadModal } from "./DocumentUploadModal";
import { readFileAsBase64, optimizeImageFile, formatBytes, saveDocumentToIndexedDB } from "../utils/fileStore";

interface ClientsManagerProps {
  clients: Client[];
  caratulas?: Caratula[];
  abonos?: AbonoTicket[];
  sucursales?: Sucursal[];
  userSession?: UserSession | null;
  onSaveClient: (client: Client) => void;
  onBatchSaveClients?: (clients: Client[]) => void;
  onDeleteClient: (id: string) => void;
  onSelectForCaratula?: (client: Client) => void;
  onViewBalances?: (client: Client) => void;
}

export const ClientsManager: React.FC<ClientsManagerProps> = ({
  clients,
  caratulas = [],
  abonos = [],
  sucursales = [],
  userSession,
  onSaveClient,
  onBatchSaveClients,
  onDeleteClient,
  onSelectForCaratula,
  onViewBalances,
}) => {
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedClientForDocuments, setSelectedClientForDocuments] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [formError, setFormError] = useState("");
  const contractFileInputRef = useRef<HTMLInputElement>(null);

  // Lock background body scroll when any modal is open
  useLockBodyScroll(Boolean(clientToDelete || selectedClientForDocuments || isImportModalOpen));

  const [formState, setFormState] = useState<Partial<Client>>({
    id: "",
    nombreCompletoCliente: "",
    numeroContacto: "",
    numeroContacto2: "",
    numeroContacto3: "",
    correo: "",
    direccionServicio: "",
    nombreCompletoRS: "",
    edad: "",
    diagnostico: "",
    especificaciones: "",
    documentos: [],
    contratoUrl: "",
    contratoNombre: "",
    contratoFecha: "",
    contratoNotas: "",
    contratoLink: "",
    saldoAFavorManual: undefined,
    saldoPendienteManual: undefined,
    saldoAjusteNotas: "",
    sucursalId: "pachuca",
    sucursalNombre: "Cuidarte Pachuca",
  });

  const handleOpenNew = () => {
    const nextId = getNextClientId(clients);
    const defaultSucursalId = userSession?.sucursalId || (sucursales[0]?.id || "pachuca");
    const defaultSucursalObj = sucursales.find((s) => s.id === defaultSucursalId);
    const defaultSucursalNombre = userSession?.sucursalNombre || defaultSucursalObj?.nombre || "Cuidarte Pachuca";

    setFormState({
      id: nextId,
      timestamp: getCurrentTimestamp(),
      nombreCompletoCliente: "",
      numeroContacto: "",
      numeroContacto2: "",
      numeroContacto3: "",
      correo: "",
      direccionServicio: "",
      nombreCompletoRS: "",
      edad: "",
      diagnostico: "",
      especificaciones: "",
      documentos: [],
      contratoUrl: "",
      contratoNombre: "",
      contratoFecha: "",
      contratoNotas: "",
      contratoLink: "",
      saldoAFavorManual: undefined,
      saldoPendienteManual: undefined,
      saldoAjusteNotas: "",
      sucursalId: defaultSucursalId,
      sucursalNombre: defaultSucursalNombre,
    });
    setFormError("");
    setIsEditing(true);
  };

  const handleEdit = (client: Client) => {
    setFormState({
      ...client,
      documentos: client.documentos || [],
      saldoAFavorManual: client.saldoAFavorManual,
      saldoPendienteManual: client.saldoPendienteManual,
      saldoAjusteNotas: client.saldoAjusteNotas || "",
      sucursalId: client.sucursalId || "pachuca",
      sucursalNombre: client.sucursalNombre || "Cuidarte Pachuca",
    });
    setFormError("");
    setIsEditing(true);
  };

  const handleContractFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let base64 = "";
      let approximateSize = file.size;

      if (file.type.startsWith("image/")) {
        const optimized = await optimizeImageFile(file);
        base64 = optimized.base64;
        approximateSize = optimized.size;
      } else {
        base64 = await readFileAsBase64(file);
      }

      const docDate = new Date().toISOString().split("T")[0];
      const docId = `DOC-CTR-${Date.now()}`;
      const newContractDoc: ClientDocument = {
        id: docId,
        nombre: file.name || "Contrato Oficial de Prestación de Servicios",
        tipo: "Contrato",
        url: base64,
        archivoUrl: base64,
        tamano: formatBytes(approximateSize),
        tamanoBytes: approximateSize,
        nombreArchivoOriginal: file.name,
        fechaSubida: docDate,
        subidoPor: "Administración General",
        notas: "Contrato digital cargado desde panel administrativo",
      };

      // Save into persistent IndexedDB storage
      await saveDocumentToIndexedDB({
        id: docId,
        ownerId: formState.id || "TEMP",
        category: "client",
        nombre: newContractDoc.nombre,
        tipo: "Contrato",
        url: base64,
        archivoUrl: base64,
        tamano: newContractDoc.tamano,
        tamanoBytes: approximateSize,
        nombreArchivoOriginal: file.name,
        fechaSubida: docDate,
        notas: newContractDoc.notas,
      });

      const existingDocs = (formState.documentos || []).filter((d) => d.tipo !== "Contrato");
      setFormState((prev) => ({
        ...prev,
        contratoUrl: base64,
        contratoNombre: file.name,
        contratoFecha: docDate,
        documentos: [newContractDoc, ...existingDocs],
      }));
    } catch (err) {
      console.error("Error processing contract file:", err);
      setFormError("Error al procesar el archivo del contrato.");
    }
  };

  const handleRemoveContract = () => {
    const remainingDocs = (formState.documentos || []).filter((d) => d.tipo !== "Contrato");
    setFormState((prev) => ({
      ...prev,
      contratoUrl: "",
      contratoNombre: "",
      contratoFecha: "",
      documentos: remainingDocs,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!formState.nombreCompletoCliente?.trim()) {
      setFormError("Por favor ingrese el Nombre Completo del Cliente.");
      return;
    }

    const resolvedSucursalId = formState.sucursalId || userSession?.sucursalId || "pachuca";
    const matchedSucursal = sucursales.find((s) => s.id === resolvedSucursalId);
    const resolvedSucursalNombre =
      formState.sucursalNombre ||
      userSession?.sucursalNombre ||
      matchedSucursal?.nombre ||
      "Cuidarte Pachuca";

    const newClient: Client = {
      id: formState.id || `CLI-${Date.now()}`,
      timestamp: formState.timestamp || getCurrentTimestamp(),
      nombreCompletoCliente: formState.nombreCompletoCliente.trim(),
      numeroContacto: formState.numeroContacto || "",
      numeroContacto2: formState.numeroContacto2 || "",
      numeroContacto3: formState.numeroContacto3 || "",
      correo: formState.correo || "",
      direccionServicio: formState.direccionServicio || "",
      nombreCompletoRS: formState.nombreCompletoRS || "",
      edad: formState.edad || "",
      diagnostico: formState.diagnostico || "",
      especificaciones: formState.especificaciones || "",
      documentos: formState.documentos || [],
      contratoUrl: formState.contratoUrl || "",
      contratoNombre: formState.contratoNombre || "",
      contratoFecha: formState.contratoFecha || "",
      contratoNotas: formState.contratoNotas || "",
      contratoLink: formState.contratoLink || "",
      asignadoA: formState.asignadoA || "",
      asignadoAtencionA: formState.asignadoAtencionA || "",
      creadoPor: formState.creadoPor || "",
      saldoAFavorManual: formState.saldoAFavorManual,
      saldoPendienteManual: formState.saldoPendienteManual,
      saldoAjusteNotas: formState.saldoAjusteNotas || "",
      sucursalId: resolvedSucursalId,
      sucursalNombre: resolvedSucursalNombre,
    };

    onSaveClient(newClient);
    setIsEditing(false);
  };

  const handleConfirmDeleteClient = () => {
    if (clientToDelete) {
      onDeleteClient(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  const uniqueClients = useMemo(() => deduplicateClients(clients), [clients]);

  const filteredClients = useMemo(() => {
    const term = search.toLowerCase();
    return uniqueClients.filter((c) => {
      return (
        (c.nombreCompletoCliente || "").toLowerCase().includes(term) ||
        (c.id || "").toLowerCase().includes(term) ||
        (c.numeroContacto || "").includes(term) ||
        (c.nombreCompletoRS || "").toLowerCase().includes(term) ||
        (c.diagnostico || "").toLowerCase().includes(term)
      );
    });
  }, [uniqueClients, search]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Directorio de Clientes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Registro de clientes y receptores de servicio con datos de contacto, diagnóstico y especificaciones médicas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Importar Masivo (CSV)</span>
          </button>

          <button
            onClick={handleOpenNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Editing Modal / Collapsible Form */}
      {isEditing && (
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 animate-fadeIn">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
              <User className="w-5 h-5" />
              {formState.id ? `Cliente (${formState.id})` : "Nuevo Cliente"}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Marca Temporal: {formState.timestamp || getCurrentTimestamp()}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <span>{formError}</span>
              </div>
            )}
            {/* Section 1: Datos de "EL CLIENTE" */}
            <div className="border border-slate-800 p-4 rounded-xl bg-slate-800/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3 border-b border-slate-800 pb-1">
                DATOS DE "EL CLIENTE" Y CONTACTO
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    ID CLIENTE *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.id}
                    onChange={(e) => setFormState({ ...formState, id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    NOMBRE COMPLETO CLIENTE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura Gómez Hernández"
                    value={formState.nombreCompletoCliente}
                    onChange={(e) =>
                      setFormState({ ...formState, nombreCompletoCliente: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    NÚMERO DE CONTACTO *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="771 123 4567"
                    value={formState.numeroContacto}
                    onChange={(e) =>
                      setFormState({ ...formState, numeroContacto: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    NÚMERO DE CONTACTO 2
                  </label>
                  <input
                    type="text"
                    placeholder="771 987 6543"
                    value={formState.numeroContacto2}
                    onChange={(e) =>
                      setFormState({ ...formState, numeroContacto2: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    NÚMERO DE CONTACTO 3
                  </label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={formState.numeroContacto3}
                    onChange={(e) =>
                      setFormState({ ...formState, numeroContacto3: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    CORREO ELECTRÓNICO
                  </label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formState.correo}
                    onChange={(e) =>
                      setFormState({ ...formState, correo: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    DIRECCIÓN DEL SERVICIO
                  </label>
                  <input
                    type="text"
                    placeholder="Calle, Número, Colonia, Municipio, Estado"
                    value={formState.direccionServicio}
                    onChange={(e) =>
                      setFormState({ ...formState, direccionServicio: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    ASESOR DE VENTAS ASIGNADO
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: ventas1 / Juan Pérez"
                    value={formState.asignadoA || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, asignadoA: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    ASESOR DE ATENCIÓN A CLIENTES ASIGNADO
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: atencion1 / María López"
                    value={formState.asignadoAtencionA || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, asignadoAtencionA: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>SUCURSAL ASIGNADA (CUIDARTE MÉXICO) *</span>
                  </label>
                  {userSession?.isGeneralAdmin || userSession?.isSuperAdmin ? (
                    <select
                      value={formState.sucursalId || "pachuca"}
                      onChange={(e) => {
                        const sId = e.target.value;
                        const sObj = sucursales.find((s) => s.id === sId);
                        setFormState({
                          ...formState,
                          sucursalId: sId,
                          sucursalNombre: sObj?.nombre || "Cuidarte Pachuca",
                        });
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
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
                  ) : (
                    <div className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-sky-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-400" />
                      <span className="font-semibold">{formState.sucursalNombre || userSession?.sucursalNombre || "Cuidarte Pachuca"}</span>
                      <span className="text-[10px] text-slate-400">(Asignada automáticamente a tu sucursal)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Datos de "EL RECEPTOR DE SERVICIO" */}
            <div className="border border-slate-800 p-4 rounded-xl bg-slate-800/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-3 border-b border-slate-800 pb-1">
                DATOS DE "EL RECEPTOR DE SERVICIO" (PACIENTE)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    NOMBRE COMPLETO RS
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Roberto Gómez Hernández"
                    value={formState.nombreCompletoRS}
                    onChange={(e) =>
                      setFormState({ ...formState, nombreCompletoRS: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    EDAD (AÑOS)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 82"
                    value={formState.edad}
                    onChange={(e) =>
                      setFormState({ ...formState, edad: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    DIAGNÓSTICO
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Alzheimer moderado, hipertensión arterial y movilidad reducida..."
                    value={formState.diagnostico}
                    onChange={(e) =>
                      setFormState({ ...formState, diagnostico: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">
                    ESPECIFICACIONES
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Cuidados especiales, horarios de medicamentos, alergias o instrucciones clave..."
                    value={formState.especificaciones}
                    onChange={(e) =>
                      setFormState({ ...formState, especificaciones: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Contrato Oficial de Prestación de Servicios */}
            <div className="border border-emerald-900/50 p-4 rounded-xl bg-emerald-950/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-900/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-emerald-500 text-slate-900 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      CONTRATO OFICIAL DE PRESTACIÓN DE SERVICIOS (DIGITAL)
                    </h4>
                    <p className="text-[11px] text-emerald-400/80">
                      Este contrato será visible y descargable por el cliente desde su pestaña "Mi Información".
                    </p>
                  </div>
                </div>

                <input
                  type="file"
                  ref={contractFileInputRef}
                  accept=".pdf,image/*"
                  onChange={handleContractFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => contractFileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{formState.contratoUrl || formState.documentos?.some(d => d.tipo === "Contrato") ? "Reemplazar Contrato" : "Subir Contrato (PDF / Imagen)"}</span>
                </button>
              </div>

              {formState.contratoUrl || formState.documentos?.some(d => d.tipo === "Contrato") ? (
                <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-950 text-emerald-400 rounded-lg border border-emerald-800">
                      <FileCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-900/80 text-emerald-200 font-bold px-2 py-0.5 rounded uppercase border border-emerald-700">
                          Contrato Digital Cargado
                        </span>
                        {formState.contratoFecha && (
                          <span className="text-[10px] text-slate-400">
                            Fecha: {formState.contratoFecha}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white mt-0.5">
                        {formState.contratoNombre || formState.documentos?.find(d => d.tipo === "Contrato")?.nombre || "Contrato_Oficial_Servicio.pdf"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRemoveContract}
                      className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg border border-rose-800/40 transition"
                      title="Remover Contrato"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Sin contrato digital adjunto. Presione el botón verde arriba para digitalizar y subir el contrato de este cliente.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Ajuste de Saldo en Cuenta (Manual / Saldo Inicial) */}
            <div className="border border-indigo-900/50 p-4 rounded-xl bg-indigo-950/20 space-y-3">
              <div className="flex items-center gap-2 border-b border-indigo-900/40 pb-2">
                <span className="p-1 bg-indigo-500 text-slate-900 rounded-lg">
                  <Scale className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    4. Saldo en Cuenta / Ajuste Manual (Opcional)
                  </h4>
                  <p className="text-[11px] text-indigo-400/80">
                    Si el cliente cuenta con un saldo inicial previo o ajuste contable manual, ingréselo aquí.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">
                    Saldo a Favor Manual ($ MXN):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={formState.saldoAFavorManual !== undefined ? formState.saldoAFavorManual : ""}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        saldoAFavorManual: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Crédito o saldo a favor del cliente registrado manualmente.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-300 mb-1">
                    Saldo Pendiente Manual ($ MXN):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={formState.saldoPendienteManual !== undefined ? formState.saldoPendienteManual : ""}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        saldoPendienteManual: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-rose-400 font-mono font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Adeudo pendiente inicial o forzado del cliente.
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Motivo o Notas del Ajuste de Saldo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Saldo a favor de póliza anterior / Depósito inicial de garantía"
                    value={formState.saldoAjusteNotas || ""}
                    onChange={(e) =>
                      setFormState({ ...formState, saldoAjusteNotas: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-md"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, nombre del cliente, teléfono, receptor o diagnóstico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-2 bg-white p-8 rounded-2xl text-center text-slate-400 border border-slate-200">
            No se encontraron clientes registrados.
          </div>
        ) : (
          filteredClients.map((client, idx) => (
            <div
              key={`client-card-${client.id || idx}-${idx}`}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                        {client.id}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full" title="Sucursal de Cuidarte México">
                        <Building2 className="w-3 h-3 text-sky-600" />
                        {client.sucursalNombre || "Cuidarte Pachuca"}
                      </span>
                      {client.contratoUrl || client.documentos?.some(d => d.tipo === "Contrato") ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Contrato Digital
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Sin Contrato
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base mt-1">
                      {client.nombreCompletoCliente}
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {client.timestamp || ""}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono font-medium">{client.numeroContacto}</span>
                    {client.numeroContacto2 && (
                      <span className="text-slate-400 font-mono">/ {client.numeroContacto2}</span>
                    )}
                  </div>

                  {client.correo && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-700 truncate">{client.correo}</span>
                    </div>
                  )}

                  {client.direccionServicio && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-700 line-clamp-2">{client.direccionServicio}</span>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-slate-100 bg-slate-50 p-2.5 rounded-lg space-y-1">
                    <div className="font-bold text-slate-800 text-[11px] flex justify-between">
                      <span>RECEPTOR: {client.nombreCompletoRS || "-"}</span>
                      {client.edad && <span>{client.edad} años</span>}
                    </div>
                    {client.diagnostico && (
                      <p className="text-[11px] text-slate-600 italic">
                        <strong className="not-italic text-slate-700">Diag:</strong> {client.diagnostico}
                      </p>
                    )}
                  </div>

                  {/* Estado de Cuenta & Saldo Real en Vivo */}
                  {(() => {
                    const clientBal = calculateClientBalance(client, caratulas || [], abonos || [], clients);
                    const hasDebt = clientBal.saldoPendienteTotal > 0;
                    const hasCredit = clientBal.saldoAFavorTotal > 0;
                    const isUpToDate = !hasDebt && !hasCredit;

                    return (
                      <div className={`p-2.5 rounded-xl border mt-2.5 text-xs transition-all ${
                        hasDebt
                          ? "bg-rose-50/70 border-rose-200 text-rose-900"
                          : hasCredit
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                          : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}>
                        <div className="flex items-center justify-between pb-1.5 border-b border-black/5">
                          <span className="font-extrabold uppercase text-[10px] tracking-wider flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5 text-slate-600" /> Saldo Real
                          </span>
                          {hasDebt && (
                            <span className="font-mono font-black text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded border border-rose-300 text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Adeudo: {formatCurrency(clientBal.saldoPendienteTotal)}
                            </span>
                          )}
                          {hasCredit && (
                            <span className="font-mono font-black text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 text-[11px] flex items-center gap-1">
                              <Wallet className="w-3 h-3 text-emerald-600" />
                              A Favor: {formatCurrency(clientBal.saldoAFavorTotal)}
                            </span>
                          )}
                          {isUpToDate && (
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 text-[11px]">
                              ✓ Al Corriente ($0.00)
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1.5 text-[11px]">
                          <div>
                            <span className="text-slate-500 text-[10px] block">Contratado:</span>
                            <strong className="font-mono font-bold text-slate-800">{formatCurrency(clientBal.totalContratado)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Abonado:</span>
                            <strong className="font-mono font-bold text-slate-800">{formatCurrency(clientBal.totalAbonado)}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 mt-1 border-t border-black/5 text-[10px] text-slate-500">
                          <span>
                            Carátulas: <strong className="text-slate-700">{clientBal.caratulasCount}</strong>
                            {clientBal.caratulasPendientesCount > 0 && (
                              <span className="text-rose-600 font-bold ml-1">({clientBal.caratulasPendientesCount} pendientes)</span>
                            )}
                          </span>
                          {clientBal.isManualOverride && (
                            <span
                              className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200 text-[9px]"
                              title={clientBal.saldoManualNotas || "Ajuste manual aplicado"}
                            >
                              Ajuste Manual
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedClientForDocuments(client)}
                    className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-sky-200"
                    title="Expediente Digital del Cliente (Recetas, INE, Pólizas, etc.)"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Expediente ({client.documentos?.length || 0})</span>
                  </button>

                  {onViewBalances && (
                    <button
                      onClick={() => onViewBalances(client)}
                      className="text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-emerald-200"
                      title="Ver Saldo, Adeudos y Tickets de Pago del Cliente"
                    >
                      <Scale className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">Ver Saldo</span>
                    </button>
                  )}

                  {onSelectForCaratula && (
                    <button
                      onClick={() => onSelectForCaratula(client)}
                      className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-indigo-200"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Crear Carátula</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleEdit(client)}
                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Editar Cliente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setClientToDelete(client)}
                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar Cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </span>
                <h3 className="font-black text-slate-900 text-base">Eliminar Cliente</h3>
              </div>
              <button
                onClick={() => setClientToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Está seguro de eliminar al cliente <strong className="text-slate-900">"{clientToDelete.nombreCompletoCliente}"</strong> ({clientToDelete.id})? Esta acción removerá el registro del directorio.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClient}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all cursor-pointer"
              >
                Sí, Eliminar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mass Import Modal */}
      <MassImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        type="clients"
        existingClients={clients}
        onImportClients={async (newClients) => {
          if (onBatchSaveClients) {
            await onBatchSaveClients(newClients);
          } else {
            for (const c of newClients) {
              await onSaveClient(c);
            }
          }
        }}
      />

      {/* Client Documents Expediente Modal */}
      {selectedClientForDocuments && (
        <DocumentUploadModal
          title="Expediente Digital del Cliente"
          subtitle={`Receptor: ${selectedClientForDocuments.nombreCompletoRS || "N/A"} | Tel: ${selectedClientForDocuments.numeroContacto}`}
          ownerName={selectedClientForDocuments.nombreCompletoCliente}
          ownerId={selectedClientForDocuments.id}
          category="client"
          documents={selectedClientForDocuments.documentos || []}
          onSaveDocuments={(updatedDocs) => {
            const foundContract = updatedDocs.find((d) => d.tipo === "Contrato");
            const updatedClient: Client = {
              ...selectedClientForDocuments,
              documentos: updatedDocs,
              contratoUrl: foundContract ? (foundContract.url || foundContract.archivoUrl) : (selectedClientForDocuments.contratoUrl?.startsWith("data:") ? "" : selectedClientForDocuments.contratoUrl),
              contratoNombre: foundContract ? foundContract.nombre : (selectedClientForDocuments.contratoUrl?.startsWith("data:") ? "" : selectedClientForDocuments.contratoNombre),
              contratoFecha: foundContract ? foundContract.fechaSubida : selectedClientForDocuments.contratoFecha,
            };
            setSelectedClientForDocuments(updatedClient);
            onSaveClient(updatedClient);
          }}
          onClose={() => setSelectedClientForDocuments(null)}
        />
      )}
    </div>
  );
};
