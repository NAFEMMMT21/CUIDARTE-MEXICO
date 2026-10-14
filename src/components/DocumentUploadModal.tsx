import React, { useState, useEffect } from "react";
import { StaffDocument, ClientDocument } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import {
  readFileAsBase64,
  optimizeImageFile,
  formatBytes,
  saveDocumentToIndexedDB,
  deleteDocumentFromIndexedDB,
  getDocumentFromIndexedDB,
  getDocumentsByOwnerFromIndexedDB,
  StoredDocument,
} from "../utils/fileStore";
import { deleteClinicalDocumentFromFirestore } from "../services/firestoreSync";
import { DocumentViewerModal } from "./DocumentViewerModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  FileCheck,
  HardDrive,
  FolderOpen,
  Image as ImageIcon,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface DocumentUploadModalProps {
  title: string;
  subtitle: string;
  ownerName: string;
  ownerId: string;
  category: "staff" | "client";
  documents?: (StaffDocument | ClientDocument)[];
  onSaveDocuments: (updatedDocs: any[]) => void;
  onClose: () => void;
}

const STAFF_DOC_TYPES = [
  { value: "INE", label: "INE / Identificación Oficial" },
  { value: "Cedula_Titulo", label: "Cédula Profesional o Título" },
  { value: "CV", label: "Currículum Vitae (CV)" },
  { value: "Comprobante_Domicilio", label: "Comprobante de Domicilio" },
  { value: "Certificacion", label: "Certificación RCP / Cursos Médicos" },
  { value: "Contrato", label: "Contrato de Prestación de Servicios" },
  { value: "Otro", label: "Otro Documento" },
];

const CLIENT_DOC_TYPES = [
  { value: "Contrato", label: "Contrato Oficial de Prestación de Servicios" },
  { value: "Receta_Medica", label: "Receta Médica Oficial" },
  { value: "INE", label: "INE / Identificación del Titular / Responsable" },
  { value: "Poliza_Seguro", label: "Póliza de Seguro de Gastos Médicos" },
  { value: "Estudio_Laboratorio", label: "Estudios de Laboratorio / Gabinete" },
  { value: "Historia_Clinica", label: "Historia Médica / Resumen Médico" },
  { value: "Comprobante_Pago", label: "Comprobante de Pago / Facturación" },
  { value: "Otro", label: "Otro Archivo / Documento" },
];

// Allowed extensions and MIME types for strict clinical document validation
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  title,
  subtitle,
  ownerName,
  ownerId,
  category,
  documents = [],
  onSaveDocuments,
  onClose,
}) => {
  useLockBodyScroll(true);

  const [docList, setDocList] = useState<(StaffDocument | ClientDocument)[]>(documents);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<(StaffDocument | ClientDocument & { fullUrl?: string }) | null>(null);
  const [docToDelete, setDocToDelete] = useState<(StaffDocument | ClientDocument) | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // New Document Form State
  const [docNombre, setDocNombre] = useState("");
  const [docTipo, setDocTipo] = useState(category === "staff" ? "INE" : "Receta_Medica");
  const [docNotas, setDocNotas] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    base64: string;
    type: string;
    isOptimized?: boolean;
  } | null>(null);

  const availableTypes = category === "staff" ? STAFF_DOC_TYPES : CLIENT_DOC_TYPES;

  // Hydrate documents from local IndexedDB if full data was stored locally
  useEffect(() => {
    let isMounted = true;
    async function hydrateDocs() {
      try {
        const localStored = await getDocumentsByOwnerFromIndexedDB(ownerId);
        if (localStored && localStored.length > 0 && isMounted) {
          // Merge props documents with IndexedDB items to ensure full data availability
          setDocList((prev) => {
            const mergedMap = new Map<string, any>();
            // Add props docs first
            for (const d of prev) {
              mergedMap.set(d.id, d);
            }
            // Enhance existing docs with binary URLs from IndexedDB
            for (const stored of localStored) {
              const existing = mergedMap.get(stored.id);
              if (existing) {
                mergedMap.set(stored.id, {
                  ...existing,
                  url: stored.url || stored.archivoUrl || existing.url,
                  archivoUrl: stored.archivoUrl || stored.url || existing.archivoUrl,
                });
              }
            }
            return Array.from(mergedMap.values());
          });
        }
      } catch (err) {
        console.warn("[DocumentUploadModal] Error hydrating from IndexedDB:", err);
      }
    }
    hydrateDocs();
    return () => {
      isMounted = false;
    };
  }, [ownerId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSecurityError(null);
    setSuccessMessage(null);

    // 1. Validate Extension & MIME Type
    const fileNameLower = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const hasValidMime =
      ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) ||
      (file.type === "" && hasValidExtension);

    if (!hasValidExtension || !hasValidMime) {
      setSecurityError(
        "Por motivos de seguridad médica y confidencialidad, únicamente se permiten documentos PDF e imágenes (JPG, JPEG, PNG, WEBP). Se prohíben archivos ejecutables o no autorizados."
      );
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    // 2. Check maximum raw file size (15MB ceiling)
    if (file.size > 15 * 1024 * 1024) {
      setSecurityError("El archivo supera el límite de 15MB. Por favor seleccione un archivo más liviano o una fotografía directa.");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    setIsProcessingFile(true);

    try {
      if (file.type.startsWith("image/") || (!file.type && !fileNameLower.endsWith(".pdf"))) {
        // Optimize Image for fast loading, ultra-crisp resolution and unlimited capacity
        const { base64, size } = await optimizeImageFile(file);
        setSelectedFile({
          name: file.name,
          size,
          base64,
          type: "image/jpeg",
          isOptimized: true,
        });
      } else {
        // Safely read PDF and await full resolution
        const base64 = await readFileAsBase64(file);
        setSelectedFile({
          name: file.name,
          size: file.size,
          base64,
          type: file.type || "application/pdf",
        });
      }

      if (!docNombre) {
        // Auto set default title from file name without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setDocNombre(cleanName);
      }
    } catch (err: any) {
      console.error("Error processing file:", err);
      setSecurityError("Hubo un problema al procesar el archivo. Inténtelo de nuevo con otra imagen o PDF.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSecurityError("Por favor seleccione un archivo válido (PDF o Imagen).");
      return;
    }
    if (!docNombre.trim()) {
      setSecurityError("Por favor ingrese un nombre descriptivo para el documento.");
      return;
    }

    setIsProcessingFile(true);
    try {
      const docId = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const docDate = getCurrentTimestamp().split(" ")[0] || new Date().toISOString().split("T")[0];

      const newDoc: StoredDocument = {
        id: docId,
        ownerId,
        category,
        nombre: docNombre.trim(),
        tipo: docTipo,
        url: selectedFile.base64,
        archivoUrl: selectedFile.base64,
        tamano: formatBytes(selectedFile.size),
        tamanoBytes: selectedFile.size,
        nombreArchivoOriginal: selectedFile.name,
        fechaSubida: docDate,
        notas: docNotas.trim(),
        mimeType: selectedFile.type,
      };

      // 1. Save directly into persistent IndexedDB storage
      await saveDocumentToIndexedDB(newDoc);

      // 2. Append to state and notify parent component
      const updated = [newDoc, ...docList];
      setDocList(updated);
      onSaveDocuments(updated);

      // 3. Reset form and display success feedback
      setSelectedFile(null);
      setDocNombre("");
      setDocNotas("");
      setSecurityError(null);
      setIsUploading(false);
      setSuccessMessage("¡Documento digitalizado y guardado con éxito en el expediente!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error saving document:", err);
      setSecurityError("Error al guardar el documento. Por favor intente nuevamente.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleRequestDelete = (doc: StaffDocument | ClientDocument) => {
    setDocToDelete(doc);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    const id = docToDelete.id;
    try {
      await deleteDocumentFromIndexedDB(id);
      await deleteClinicalDocumentFromFirestore(id);
      const updated = docList.filter((d) => d.id !== id);
      setDocList(updated);
      onSaveDocuments(updated);
      if (previewDoc?.id === id) {
        setPreviewDoc(null);
      }
      setSuccessMessage("Documento eliminado definitivamente del expediente.");
      setTimeout(() => setSuccessMessage(null), 4000);
      setDocToDelete(null);
    } catch (err) {
      console.warn("Error deleting document:", err);
      setSecurityError("Ocurrió un error al eliminar el documento. Intente nuevamente.");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleOpenPreview = async (doc: StaffDocument | ClientDocument) => {
    try {
      let docUrl = doc.url || (doc as any).archivoUrl || "";
      if (!docUrl || docUrl.length < 100) {
        // Fetch full data from IndexedDB
        const stored = await getDocumentFromIndexedDB(doc.id);
        if (stored?.url) {
          docUrl = stored.url;
        }
      }
      setPreviewDoc({
        ...doc,
        fullUrl: docUrl || doc.url || (doc as any).archivoUrl,
      });
    } catch (err) {
      console.warn("Error loading preview:", err);
      setPreviewDoc(doc);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                  {title}
                </span>
                <span className="font-mono text-xs text-slate-400">ID: {ownerId}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">{ownerName}</h2>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar Expediente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1 bg-slate-50/60">
          {/* Security & Integrity Banner */}
          <div className="bg-emerald-50/90 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs text-emerald-950">
              <span className="font-black block">Resguardo y Digitalización Segura de Expedientes</span>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Archivos compatibles: <strong>Documentos PDF</strong> y <strong>fotografías / recetas (JPG, PNG, WEBP)</strong>. Todos los archivos se almacenan con respaldo de base de datos local y en la nube sin pérdida de información.
              </p>
            </div>
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div className="bg-emerald-600 text-white p-3.5 rounded-2xl flex items-center gap-3 shadow-md animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <p className="text-xs font-bold">{successMessage}</p>
            </div>
          )}

          {/* Security Error Alert */}
          {securityError && (
            <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-3 text-rose-900 animate-fadeIn">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold block">Aviso de Validación</span>
                <p className="text-[11px] text-rose-800">{securityError}</p>
              </div>
            </div>
          )}

          {/* Action to Toggle Upload Form */}
          {!isUploading && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  Archivos en Expediente ({docList.length})
                </h4>
                <p className="text-xs text-slate-500">
                  Consulte, descargue o suba nuevos documentos oficiales y recetas médicas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSecurityError(null);
                  setSuccessMessage(null);
                  setIsUploading(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Subir Nuevo Documento</span>
              </button>
            </div>
          )}

          {/* Upload Form */}
          {isUploading && (
            <form
              onSubmit={handleAddDocument}
              className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/40 shadow-md space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Cargar Documento al Expediente
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploading(false);
                    setSelectedFile(null);
                    setSecurityError(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Documento *
                  </label>
                  <select
                    value={docTipo}
                    onChange={(e) => setDocTipo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {availableTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre o Título del Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={docNombre}
                    onChange={(e) => setDocNombre(e.target.value)}
                    placeholder="Ej. Receta Médica Dr. Morales, INE Titular, Póliza..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  value={docNotas}
                  onChange={(e) => setDocNotas(e.target.value)}
                  placeholder="Vigencia, médico tratante, indicaciones clave..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seleccionar Archivo (PDF, JPG, PNG, WEBP) *
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/80 hover:bg-emerald-50/30 rounded-2xl p-5 text-center cursor-pointer relative transition-all">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={handleFileChange}
                    disabled={isProcessingFile}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5 pointer-events-none">
                    {isProcessingFile ? (
                      <>
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                        <p className="text-xs font-bold text-slate-700">Optimizando y procesando archivo digital...</p>
                      </>
                    ) : selectedFile ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Tamaño: {formatBytes(selectedFile.size)} - Archivo preparado y verificado
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-400" />
                        <p className="text-xs font-bold text-slate-700">
                          Haga clic o arrastre el archivo aquí
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Formatos admitidos: Archivos PDF e imágenes de alta definición (hasta 15MB)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploading(false);
                    setSelectedFile(null);
                    setSecurityError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || isProcessingFile}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Guardar en Expediente</span>
                </button>
              </div>
            </form>
          )}

          {/* Documents Grid */}
          {docList.length === 0 ? (
            <div className="bg-white p-8 sm:p-12 text-center rounded-3xl border border-slate-200 text-slate-400 space-y-3">
              <HardDrive className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="font-bold text-slate-700 text-base">Expediente Vacío</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Aún no se han digitalizado documentos para este expediente. Haga clic en "Subir Nuevo Documento" para cargar contratos, recetas, identificaciones o estudios de laboratorio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {docList.map((doc) => {
                const docUrl = doc.url || (doc as any).archivoUrl || "";
                const isPDF =
                  docUrl.startsWith("data:application/pdf") ||
                  doc.nombreArchivoOriginal?.toLowerCase().endsWith(".pdf") ||
                  doc.nombre.toLowerCase().endsWith(".pdf");
                const isImage =
                  docUrl.startsWith("data:image/") ||
                  /\.(jpeg|jpg|png|webp|gif)/i.test(docUrl) ||
                  /\.(jpeg|jpg|png|webp|gif)/i.test(doc.nombre);

                return (
                  <div
                    key={doc.id}
                    className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-2 rounded-xl ${
                              isPDF
                                ? "bg-rose-100 text-rose-700"
                                : isImage
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {isPDF ? (
                              <FileText className="w-4 h-4" />
                            ) : isImage ? (
                              <ImageIcon className="w-4 h-4" />
                            ) : (
                              <FileCheck className="w-4 h-4" />
                            )}
                          </div>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            {doc.tipo.replace(/_/g, " ")}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRequestDelete(doc)}
                          className="text-slate-300 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs line-clamp-2" title={doc.nombre}>
                        {doc.nombre}
                      </h4>
                      {doc.notas && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{doc.notas}</p>
                      )}

                      <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 space-y-0.5">
                        <p className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Subido: {doc.fechaSubida}</span>
                        </p>
                        <p>{formatBytes(doc.tamanoBytes)}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(doc)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                        <span>Ver</span>
                      </button>

                      {docUrl && (
                        <a
                          href={docUrl}
                          download={doc.nombreArchivoOriginal || `${doc.nombre}.${isPDF ? "pdf" : "jpg"}`}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors shrink-0 cursor-pointer"
                          title="Descargar archivo original"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Total de archivos en expediente: <strong className="text-slate-800">{docList.length}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer"
          >
            Cerrar Expediente
          </button>
        </div>
      </div>

      {/* Universal Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={Boolean(previewDoc)}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(docToDelete)}
        itemName={docToDelete?.nombre || ""}
        itemType={docToDelete?.tipo}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDocToDelete(null)}
        isDeleting={isDeletingDoc}
      />
    </div>
  );
};
