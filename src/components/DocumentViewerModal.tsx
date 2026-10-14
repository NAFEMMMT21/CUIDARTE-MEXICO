import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Download,
  FileText,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  RefreshCw,
  Printer,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  User,
  ExternalLink,
  Lock,
  FileCheck2,
  Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { PDFCanvasViewer } from "./PDFCanvasViewer";
import {
  getDocumentFromIndexedDB,
  getDocumentsByOwnerFromIndexedDB,
  saveDocumentToIndexedDB,
  readFileAsBase64,
  optimizeImageFile,
  formatBytes,
  StoredDocument,
} from "../utils/fileStore";
import {
  getDocumentFromFirestore,
  getDocumentsByOwnerFromFirestore,
  saveClinicalDocumentToFirestore,
} from "../services/firestoreSync";
import { loadClients, loadStaffMembers } from "../utils/storage";

interface DocumentViewerModalProps {
  isOpen: boolean;
  doc: {
    id: string;
    nombre: string;
    tipo?: string;
    url?: string;
    archivoUrl?: string;
    fechaSubida?: string;
    nombreArchivoOriginal?: string;
    notas?: string;
    ownerId?: string;
    clienteId?: string;
    tamano?: string;
    tamanoBytes?: number;
  } | null;
  onClose: () => void;
  onDocumentUpdated?: (updatedDoc: any) => void;
}

// Normalizes document URLs to valid data URLs if raw base64 or missing MIME prefix
function normalizeDocumentUrl(rawUrl: string, docName: string = "", docType: string = ""): string {
  if (!rawUrl) return "";
  const trimmed = rawUrl.trim();

  // Already a valid data URL, http, https, or blob
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Detect PDF signature in raw base64: JVBERi0...
  if (trimmed.startsWith("JVBERi")) {
    return `data:application/pdf;base64,${trimmed}`;
  }

  // Detect JPEG signature: /9j/
  if (trimmed.startsWith("/9j/")) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  // Detect PNG signature: iVBORw0KGgo
  if (trimmed.startsWith("iVBORw0KGgo")) {
    return `data:image/png;base64,${trimmed}`;
  }

  // Fallback based on extension or type
  const lowerName = docName.toLowerCase();
  const lowerType = docType.toLowerCase();
  if (lowerName.endsWith(".pdf") || lowerType.includes("pdf") || lowerType === "contrato") {
    return `data:application/pdf;base64,${trimmed}`;
  }
  if (lowerName.endsWith(".png")) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return `data:image/jpeg;base64,${trimmed}`;
  }

  // Default to PDF if length resembles encoded document
  if (trimmed.length > 500) {
    return `data:application/pdf;base64,${trimmed}`;
  }

  return trimmed;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  doc,
  onClose,
  onDocumentUpdated,
}) => {
  useLockBodyScroll(isOpen);

  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [imgZoom, setImgZoom] = useState<number>(100);
  const [imgRotate, setImgRotate] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Main resolution function
  const resolveDocUrl = useCallback(async () => {
    if (!isOpen || !doc) {
      setResolvedUrl("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setImgZoom(100);
    setImgRotate(0);
    setUploadSuccess(null);

    try {
      let candidateUrl = doc.url || doc.archivoUrl || (doc as any).fullUrl || (doc as any).base64 || "";

      // 1. Direct valid data URL / HTTP link
      if (candidateUrl && candidateUrl.length > 50) {
        const normalized = normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo);
        if (normalized && normalized.length > 80) {
          setResolvedUrl(normalized);
          setIsLoading(false);
          return;
        }
      }

      // 2. Query IndexedDB by exact document ID
      if (doc.id) {
        const stored = await getDocumentFromIndexedDB(doc.id);
        if (stored?.url || stored?.archivoUrl) {
          candidateUrl = stored.url || stored.archivoUrl || "";
          if (candidateUrl.length > 50) {
            setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
            setIsLoading(false);
            return;
          }
        }
      }

      // 3. Query Cloud Firestore by exact document ID
      if (doc.id) {
        const cloudDoc = await getDocumentFromFirestore(doc.id);
        if (cloudDoc?.url || cloudDoc?.archivoUrl) {
          candidateUrl = cloudDoc.url || cloudDoc.archivoUrl || "";
          if (candidateUrl.length > 50) {
            setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
            setIsLoading(false);
            return;
          }
        }
      }

      // 4. Resolve owner ID (from doc, or by searching client/staff collections)
      let ownerId = doc.ownerId || doc.clienteId || (doc as any).staffId || (doc as any).socioId || "";
      if (!ownerId && doc.id) {
        try {
          const clients = loadClients();
          const foundClient = clients.find((c) =>
            (c.documentos || []).some((d) => d.id === doc.id) || doc.id.includes(c.id)
          );
          if (foundClient) {
            ownerId = foundClient.id;
          } else {
            const staffList = loadStaffMembers();
            const foundStaff = staffList.find((s) =>
              (s.documentos || []).some((d) => d.id === doc.id) || doc.id.includes(s.id)
            );
            if (foundStaff) {
              ownerId = foundStaff.id;
            }
          }
        } catch (e) {
          // ignore lookup err
        }
      }

      // 5. Special resolution for Contracts
      const isContract =
        doc.tipo?.toLowerCase() === "contrato" ||
        doc.nombre?.toLowerCase().includes("contrato") ||
        doc.id?.startsWith("DOC-CTR") ||
        doc.id?.startsWith("CONTRATO");

      if (isContract && ownerId) {
        // Check IndexedDB CONTRATO-${ownerId}
        const storedContract = await getDocumentFromIndexedDB(`CONTRATO-${ownerId}`);
        if (storedContract?.url || storedContract?.archivoUrl) {
          candidateUrl = storedContract.url || storedContract.archivoUrl || "";
          if (candidateUrl.length > 50) {
            setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
            setIsLoading(false);
            return;
          }
        }

        // Check Firestore CONTRATO-${ownerId}
        const cloudContract = await getDocumentFromFirestore(`CONTRATO-${ownerId}`);
        if (cloudContract?.url || cloudContract?.archivoUrl) {
          candidateUrl = cloudContract.url || cloudContract.archivoUrl || "";
          if (candidateUrl.length > 50) {
            setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
            setIsLoading(false);
            return;
          }
        }

        // Check client profile in local state
        const clients = loadClients();
        const clientObj = clients.find((c) => c.id === ownerId);
        if (clientObj?.contratoUrl && clientObj.contratoUrl.length > 50) {
          setResolvedUrl(normalizeDocumentUrl(clientObj.contratoUrl, doc.nombre, doc.tipo));
          setIsLoading(false);
          return;
        }
      }

      // 6. Query all documents by owner from IndexedDB
      if (ownerId) {
        const ownerIndexedDocs = await getDocumentsByOwnerFromIndexedDB(ownerId);
        if (ownerIndexedDocs && ownerIndexedDocs.length > 0) {
          const match = ownerIndexedDocs.find(
            (d) =>
              d.id === doc.id ||
              (d.nombre && doc.nombre && d.nombre.toLowerCase().trim() === doc.nombre.toLowerCase().trim()) ||
              (isContract && (d.tipo?.toLowerCase() === "contrato" || d.nombre?.toLowerCase().includes("contrato")))
          );
          if (match && (match.url || match.archivoUrl)) {
            candidateUrl = match.url || match.archivoUrl || "";
            if (candidateUrl.length > 50) {
              setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
              setIsLoading(false);
              return;
            }
          }
        }

        // 7. Query all documents by owner from Firestore Cloud
        const ownerCloudDocs = await getDocumentsByOwnerFromFirestore(ownerId);
        if (ownerCloudDocs && ownerCloudDocs.length > 0) {
          const match = ownerCloudDocs.find(
            (d) =>
              d.id === doc.id ||
              (d.nombre && doc.nombre && d.nombre.toLowerCase().trim() === doc.nombre.toLowerCase().trim()) ||
              (isContract && (d.tipo?.toLowerCase() === "contrato" || d.nombre?.toLowerCase().includes("contrato")))
          );
          if (match && (match.url || match.archivoUrl)) {
            candidateUrl = match.url || match.archivoUrl || "";
            if (candidateUrl.length > 50) {
              setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
              setIsLoading(false);
              return;
            }
          }
        }
      }

      // Fallback
      setResolvedUrl(normalizeDocumentUrl(candidateUrl, doc.nombre, doc.tipo));
    } catch (err) {
      console.warn("[DocumentViewerModal] Error resolving doc url:", err);
      setResolvedUrl(normalizeDocumentUrl(doc.url || doc.archivoUrl || "", doc.nombre, doc.tipo));
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [
    isOpen,
    doc?.id,
    doc?.url,
    doc?.archivoUrl,
    doc?.nombre,
    doc?.tipo,
    (doc as any)?.ownerId,
    (doc as any)?.clienteId
  ]);

  useEffect(() => {
    if (isOpen && doc) {
      resolveDocUrl();
    }
  }, [isOpen, doc?.id, doc?.url, doc?.archivoUrl, resolveDocUrl]);

  // Handle direct file attachment from the viewer modal
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc) return;

    setIsUploading(true);
    setUploadSuccess(null);

    try {
      let base64 = "";
      const isPdfFile = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      if (isPdfFile) {
        base64 = await readFileAsBase64(file);
      } else {
        const optimized = await optimizeImageFile(file, 1600, 0.85);
        base64 = optimized.base64;
      }

      const ownerId = doc.ownerId || doc.clienteId || "GENERIC";
      const storedDoc: StoredDocument = {
        id: doc.id || `DOC-${Date.now()}`,
        ownerId,
        category: (doc as any).category || "client",
        nombre: doc.nombre || file.name,
        tipo: doc.tipo || (isPdfFile ? "PDF" : "Imagen"),
        url: base64,
        archivoUrl: base64,
        tamano: formatBytes(file.size),
        tamanoBytes: file.size,
        nombreArchivoOriginal: file.name,
        fechaSubida: doc.fechaSubida || new Date().toISOString().split("T")[0],
        notas: doc.notas || "Documento digitalizado",
      };

      // Save to IndexedDB and Firestore
      await saveDocumentToIndexedDB(storedDoc);
      await saveClinicalDocumentToFirestore(storedDoc);

      setResolvedUrl(base64);
      setUploadSuccess("¡Archivo digitalizado y sincronizado exitosamente!");

      if (onDocumentUpdated) {
        onDocumentUpdated(storedDoc);
      }
    } catch (err: any) {
      console.error("[DocumentViewerModal] Upload error:", err);
      alert("Error al procesar el archivo. Por favor intente de nuevo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePrintCertificate = () => {
    window.print();
  };

  if (!isOpen || !doc) return null;

  const fileName = doc.nombreArchivoOriginal || doc.nombre || "documento_cuidarte";
  const isPdf =
    resolvedUrl.startsWith("data:application/pdf") ||
    resolvedUrl.toLowerCase().includes(".pdf") ||
    fileName.toLowerCase().endsWith(".pdf") ||
    (doc.tipo && doc.tipo.toLowerCase().includes("pdf")) ||
    (doc.nombre && doc.nombre.toLowerCase().endsWith(".pdf")) ||
    (doc.tipo && doc.tipo.toLowerCase() === "contrato" && !resolvedUrl.startsWith("data:image/"));

  const isImage =
    resolvedUrl.startsWith("data:image/") ||
    /\.(jpeg|jpg|png|webp|gif|svg)($|\?)/i.test(resolvedUrl) ||
    /\.(jpeg|jpg|png|webp|gif|svg)($|\?)/i.test(fileName) ||
    /\.(jpeg|jpg|png|webp|gif|svg)($|\?)/i.test(doc.nombre || "");

  const handleRetry = () => {
    setIsRetrying(true);
    resolveDocUrl();
  };

  const ownerId = doc.ownerId || doc.clienteId || "Expediente Central";

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn print:p-0 print:bg-white">
      <div className="bg-slate-900 w-full max-w-5xl h-[94vh] sm:h-[90vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col my-auto print:border-none print:shadow-none print:w-full print:h-auto print:bg-white print:rounded-none">
        {/* MODAL HEADER */}
        <div className="bg-slate-950 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 text-white print:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {doc.tipo && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                  {doc.tipo.replace(/_/g, " ")}
                </span>
              )}
              {doc.fechaSubida && (
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {doc.fechaSubida}
                </span>
              )}
              {ownerId && (
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  {ownerId}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-white truncate mt-1" title={doc.nombre}>
              {doc.nombre}
            </h3>
          </div>

          {/* TOP ACTIONS */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Hidden file input for direct in-modal attachment */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleDirectFileUpload}
              accept="application/pdf,image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer disabled:opacity-50"
              title="Adjuntar o reemplazar archivo digitalizado"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">{resolvedUrl ? "Reemplazar" : "Digitalizar"}</span>
            </button>

            {resolvedUrl && (
              <a
                href={resolvedUrl}
                download={fileName.includes(".") ? fileName : `${fileName}.${isPdf ? "pdf" : "jpg"}`}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                title="Descargar archivo"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Descargar</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* UPLOAD SUCCESS ALERT */}
        {uploadSuccess && (
          <div className="bg-emerald-500/20 text-emerald-300 px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-emerald-500/30 print:hidden">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {uploadSuccess}
            </span>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 overflow-hidden bg-slate-950 flex items-center justify-center relative p-2 print:p-0 print:bg-white">
          {isLoading ? (
            <div className="text-center text-white space-y-3 p-8">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Resolviendo y sincronizando documento...</p>
            </div>
          ) : isPdf && resolvedUrl ? (
            <PDFCanvasViewer
              url={resolvedUrl}
              title={doc.nombre}
              className="w-full h-full"
            />
          ) : isImage && resolvedUrl ? (
            <div className="flex flex-col w-full h-full">
              {/* Image Toolbar */}
              <div className="bg-slate-900 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-white shrink-0 print:hidden">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImgZoom((z) => Math.max(z - 25, 25))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 cursor-pointer"
                    title="Alejar (-)"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgZoom(100)}
                    className="text-xs font-mono font-bold px-2 py-1 bg-slate-800 rounded-md text-amber-400 cursor-pointer"
                    title="Restablecer"
                  >
                    {imgZoom}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgZoom((z) => Math.min(z + 25, 300))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 cursor-pointer"
                    title="Acercar (+)"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImgRotate((r) => (r + 90) % 360)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 cursor-pointer"
                    title="Rotar 90°"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    Formato Imagen
                  </span>
                </div>
              </div>

              {/* Image Viewport */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                <img
                  src={resolvedUrl}
                  alt={doc.nombre}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150"
                  style={{
                    transform: `scale(${imgZoom / 100}) rotate(${imgRotate}deg)`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </div>
          ) : (
            /* OFFICIAL DIGITAL RECORD & EXPEDIENTE CERTIFICATE VIEW */
            <div className="w-full h-full overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
              <div className="w-full max-w-2xl bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-6 relative overflow-hidden print:p-0 print:border-none print:shadow-none">
                {/* Background Watermark */}
                <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center">
                  <Building2 className="w-96 h-96 text-slate-900" />
                </div>

                {/* Header Badge */}
                <div className="flex items-center justify-between border-b-2 border-amber-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md font-black text-xl">
                      CP
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight">CUIDARTE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Soluciones de asistencia y gestión para el bienestar familiar</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] uppercase font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Expediente Digital Activo
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">Folio: {doc.id}</p>
                  </div>
                </div>

                {/* Document Information Card */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Documento Registrado</p>
                      <h5 className="font-extrabold text-base text-slate-900">{doc.nombre}</h5>
                      <p className="text-xs text-amber-700 font-semibold mt-0.5">Categoría: {doc.tipo || "Expediente General"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium block text-[11px]">Titular / Asignación:</span>
                      <span className="font-bold text-slate-900">{ownerId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block text-[11px]">Fecha de Alta en Sistema:</span>
                      <span className="font-bold text-slate-900">{doc.fechaSubida || "Registrado"}</span>
                    </div>
                  </div>

                  {doc.notas && (
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-slate-500 font-medium block text-[11px]">Observaciones Clínicas / Administrativas:</span>
                      <p className="text-xs text-slate-800 bg-white p-3 rounded-xl border border-slate-200/80 mt-1 italic">
                        "{doc.notas}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Validation and QR Section */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                      <QRCodeSVG
                        value={`https://cuidartepachuca.mx/valida/${doc.id}?owner=${ownerId}`}
                        size={64}
                        level="M"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900">Sello Digital de Validación</p>
                      <p className="text-[11px] text-slate-600">Este registro certifica la vigencia del documento en la plataforma Cuidarte Pachuca.</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 print:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition border border-slate-300 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin text-amber-600" : ""}`} />
                      <span>{isRetrying ? "Sincronizando..." : "Reintentar Nube"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintCertificate}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition border border-slate-300 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Imprimir Constancia</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-lg cursor-pointer transition"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{isUploading ? "Cargando..." : "Digitalizar / Adjuntar Archivo"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
