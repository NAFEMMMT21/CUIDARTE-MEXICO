import React, { useState, useRef } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { Client, ServiceItem, ServiceCategory } from "../types";
import { getCurrentTimestamp } from "../utils/formatters";
import {
  Upload,
  Download,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  RefreshCw,
  Info,
  Trash2,
  Plus
} from "lucide-react";

type ImportType = "clients" | "services";

interface MassImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ImportType;
  existingClients?: Client[];
  existingServices?: ServiceItem[];
  existingCategories?: ServiceCategory[];
  onImportClients?: (clients: Client[]) => Promise<void> | void;
  onImportServices?: (services: ServiceItem[]) => Promise<void> | void;
}

export const MassImportModal: React.FC<MassImportModalProps> = ({
  isOpen,
  onClose,
  type,
  existingClients = [],
  existingServices = [],
  existingCategories = [],
  onImportClients,
  onImportServices,
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [pastedText, setPastedText] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importSummary, setImportSummary] = useState<{
    successCount: number;
    skippedCount: number;
    errorCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock background scroll while modal is active
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const isClients = type === "clients";
  const title = isClients ? "Importación Masiva de Clientes" : "Importación Masiva de Servicios";

  // Sample CSV Downloads
  const downloadTemplate = () => {
    let headers = "";
    let sampleRows = "";
    let filename = "";

    if (isClients) {
      headers = "Nombre Cliente,Telefono 1,Telefono 2,Telefono 3,Correo,Direccion,Receptor Servicio,Edad,Diagnostico,Especificaciones\n";
      sampleRows =
        'Juan Perez Gomez,7711234567,7717654321,,juan.perez@example.com,"Av. Revolución 123, Pachuca",María Perez Gomez,75,Hipertensión y Diabetes,Atención en turno matutino\n' +
        'Ana Maria Torres,7719876543,,,ana.torres@example.com,"Col. Centro, Pachuca",Ana Maria Torres,82,Cuidados postoperatorios,Requiere asistencia para movilidad\n';
      filename = "plantilla_clientes_cuidarte.csv";
    } else {
      headers = "Nombre Servicio,Categoria,Descripcion,Precio,Costo\n";
      sampleRows =
        'Guardia Nocturna 12 hrs,Enfermería General,Atención integral de enfermería durante turno nocturno,1200,850\n' +
        'Toma de Signos Vitales,Procedimientos,Monitoreo y registro de presión arterial y signos,250,150\n' +
        'Acompañamiento Adulto Mayor,Acompañamiento,Asistencia en actividades diarias y administración de medicamentos,800,550\n';
      filename = "plantilla_servicios_cuidarte.csv";
    }

    const blob = new Blob(["\uFEFF" + headers + sampleRows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV / TSV Line Parser supporting quotes and delimiters
  const parseDelimitedText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    // Detect delimiter (comma, tab, semicolon)
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";")) delimiter = ";";

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          if (inQuotes && line[i + 1] === char) {
            current += char;
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
    const dataRows = lines.slice(1);

    const parsedData: any[] = [];

    dataRows.forEach((rowStr, idx) => {
      const values = parseLine(rowStr);
      if (values.every((v) => v === "")) return; // Skip empty row

      if (isClients) {
        // Map columns for Client
        let nombre = "";
        let tel1 = "";
        let tel2 = "";
        let tel3 = "";
        let correo = "";
        let direccion = "";
        let receptor = "";
        let edad = "";
        let diagnostico = "";
        let espec = "";

        headers.forEach((h, i) => {
          const val = values[i] || "";
          if (h.includes("nombre") && !h.includes("receptor") && !h.includes("rs")) nombre = val;
          else if (h.includes("cliente")) nombre = val;
          else if (h.includes("tel") || h.includes("contacto") || h.includes("celular")) {
            if (h.includes("2") || h.includes("segundo")) tel2 = val;
            else if (h.includes("3") || h.includes("tercer")) tel3 = val;
            else if (!tel1) tel1 = val;
            else if (!tel2) tel2 = val;
            else tel3 = val;
          } else if (h.includes("correo") || h.includes("email")) correo = val;
          else if (h.includes("direccion") || h.includes("domicilio")) direccion = val;
          else if (h.includes("receptor") || h.includes("rs")) receptor = val;
          else if (h.includes("edad")) edad = val;
          else if (h.includes("diag")) diagnostico = val;
          else if (h.includes("espec") || h.includes("nota") || h.includes("obs")) espec = val;
        });

        // Fallback positional if header mapping missed name
        if (!nombre && values[0]) nombre = values[0];
        if (!tel1 && values[1]) tel1 = values[1];

        parsedData.push({
          rowId: idx + 1,
          nombreCompletoCliente: nombre,
          numeroContacto: tel1,
          numeroContacto2: tel2,
          numeroContacto3: tel3,
          correo,
          direccionServicio: direccion,
          nombreCompletoRS: receptor || nombre,
          edad,
          diagnostico,
          especificaciones: espec,
          isValid: Boolean(nombre && nombre.length > 1),
        });
      } else {
        // Map columns for Service
        let nombre = "";
        let categoria = "";
        let descripcion = "";
        let precio = "";
        let costo = "";

        headers.forEach((h, i) => {
          const val = values[i] || "";
          if (h.includes("servicio") || (h.includes("nombre") && !h.includes("cat"))) nombre = val;
          else if (h.includes("cat")) categoria = val;
          else if (h.includes("desc") || h.includes("detalle")) descripcion = val;
          else if (h.includes("precio") || h.includes("venta")) precio = val;
          else if (h.includes("costo") || h.includes("inversion")) costo = val;
        });

        // Fallback positional
        if (!nombre && values[0]) nombre = values[0];
        if (!categoria && values[1]) categoria = values[1];
        if (!precio && values[3]) precio = values[3];

        const numericPrice = parseFloat(precio.replace(/[^0-9.]/g, "")) || 0;
        const numericCost = parseFloat(costo.replace(/[^0-9.]/g, "")) || 0;

        parsedData.push({
          rowId: idx + 1,
          nombreServicio: nombre,
          categoria: categoria || "Enfermería General",
          descripcion: descripcion || "",
          precio: numericPrice,
          costo: numericCost,
          isValid: Boolean(nombre && nombre.length > 1),
        });
      }
    });

    return parsedData;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const rows = parseDelimitedText(content);
        setParsedRows(rows);
        setImportSummary(null);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handlePasteProcess = () => {
    if (!pastedText.trim()) return;
    const rows = parseDelimitedText(pastedText);
    setParsedRows(rows);
    setImportSummary(null);
  };

  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert("No hay registros válidos para importar.");
      return;
    }

    setIsProcessing(true);
    setImportProgress(10);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const currentTimestamp = getCurrentTimestamp();

    if (isClients && onImportClients) {
      const existingNames = new Set(
        existingClients.map((c) => c.nombreCompletoCliente.trim().toLowerCase())
      );

      const clientsToSave: Client[] = [];
      const total = validRows.length;

      for (let i = 0; i < total; i++) {
        const row = validRows[i];
        const normName = row.nombreCompletoCliente.trim().toLowerCase();

        if (skipDuplicates && existingNames.has(normName)) {
          skippedCount++;
        } else {
          const newClient: Client = {
            id: `CLI-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            timestamp: currentTimestamp,
            nombreCompletoCliente: row.nombreCompletoCliente.trim(),
            numeroContacto: row.numeroContacto || "",
            numeroContacto2: row.numeroContacto2 || "",
            numeroContacto3: row.numeroContacto3 || "",
            correo: row.correo || "",
            direccionServicio: row.direccionServicio || "",
            nombreCompletoRS: row.nombreCompletoRS || row.nombreCompletoCliente.trim(),
            edad: row.edad || "",
            diagnostico: row.diagnostico || "",
            especificaciones: row.especificaciones || "",
          };
          clientsToSave.push(newClient);
          existingNames.add(normName);
          successCount++;
        }

        setImportProgress(Math.round(((i + 1) / total) * 90));
      }

      if (clientsToSave.length > 0) {
        await onImportClients(clientsToSave);
      }
    } else if (!isClients && onImportServices) {
      const existingNames = new Set(
        existingServices.map((s) => s.nombreServicio.trim().toLowerCase())
      );

      const servicesToSave: ServiceItem[] = [];
      const total = validRows.length;

      for (let i = 0; i < total; i++) {
        const row = validRows[i];
        const normName = row.nombreServicio.trim().toLowerCase();

        if (skipDuplicates && existingNames.has(normName)) {
          skippedCount++;
        } else {
          const newService: ServiceItem = {
            id: `SRV-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
            timestamp: currentTimestamp,
            nombreServicio: row.nombreServicio.trim(),
            categoria: row.categoria || "Enfermería General",
            descripcion: row.descripcion || "",
            precio: Number(row.precio) || 0,
            costo: Number(row.costo) || 0,
          };
          servicesToSave.push(newService);
          existingNames.add(normName);
          successCount++;
        }

        setImportProgress(Math.round(((i + 1) / total) * 90));
      }

      if (servicesToSave.length > 0) {
        await onImportServices(servicesToSave);
      }
    }

    setImportProgress(100);
    setIsProcessing(false);
    setImportSummary({
      successCount,
      skippedCount,
      errorCount,
    });
  };

  const resetModal = () => {
    setParsedRows([]);
    setFileName("");
    setPastedText("");
    setImportSummary(null);
    setImportProgress(0);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">{title}</h2>
              <p className="text-xs text-slate-400">
                Cargue archivos CSV o pegue datos desde Excel/Tablas de forma masiva
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Actions & Template Download */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Recomendamos descargar nuestra plantilla prediseñada para garantizar que los encabezados coincidan perfectamente.
              </span>
            </div>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold transition shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Plantilla CSV</span>
            </button>
          </div>

          {/* Import Summary Results if completed */}
          {importSummary && (
            <div className="bg-emerald-950/40 border border-emerald-800/80 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>¡Proceso de Importación Finalizado!</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs pt-1 font-mono">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Importados</span>
                  <span className="text-emerald-400 font-bold text-base">+{importSummary.successCount}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Omitidos (Duplicados)</span>
                  <span className="text-amber-400 font-bold text-base">{importSummary.skippedCount}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-slate-400 text-[10px] block uppercase font-sans">Errores</span>
                  <span className="text-rose-400 font-bold text-base">{importSummary.errorCount}</span>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={resetModal}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Importar Más Datos</span>
                </button>
              </div>
            </div>
          )}

          {/* Input Method Selector Tabs */}
          {parsedRows.length === 0 && !importSummary && (
            <div className="space-y-4">
              <div className="flex border-b border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setActiveTab("file")}
                  className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === "file"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Subir Archivo CSV / TXT</span>
                </button>
                <button
                  onClick={() => setActiveTab("paste")}
                  className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition ${
                    activeTab === "paste"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Copiar y Pegar Texto / Tablas</span>
                </button>
              </div>

              {/* Option 1: File Upload */}
              {activeTab === "file" && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-8 text-center cursor-pointer transition space-y-3 group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                  />
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition border border-emerald-500/20">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200">
                      {fileName ? fileName : "Haga clic para seleccionar o arrastre su archivo aquí"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Formatos compatibles: .CSV, .TSV, .TXT (Delimitados por coma, punto y coma o tabulador)
                    </p>
                  </div>
                </div>
              )}

              {/* Option 2: Paste Area */}
              {activeTab === "paste" && (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={
                      isClients
                        ? "Pegue aquí sus filas desde Excel o Google Sheets, por ejemplo:\nNombre Cliente,Telefono,Correo,Direccion\nJuan Perez,7711234567,juan@correo.com,Pachuca Hidalgo"
                        : "Pegue aquí sus filas desde Excel o Google Sheets, por ejemplo:\nNombre Servicio,Categoria,Precio,Costo\nGuardia Nocturna,Enfermería,1200,850"
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handlePasteProcess}
                    disabled={!pastedText.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Procesar Texto Pegado</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Parsed Rows Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300">
                    Registros Detectados: {parsedRows.length}
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {parsedRows.filter((r) => r.isValid).length} válidos
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-0"
                    />
                    <span>Omitir duplicados por nombre</span>
                  </label>
                  <button
                    onClick={resetModal}
                    className="text-slate-400 hover:text-rose-400 transition text-[11px] font-bold underline"
                  >
                    Limpiar y Cambiar Archivo
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-mono uppercase text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Estado</th>
                      {isClients ? (
                        <>
                          <th className="p-2.5">Cliente</th>
                          <th className="p-2.5">Teléfono</th>
                          <th className="p-2.5">Correo</th>
                          <th className="p-2.5">Dirección / RS</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2.5">Servicio</th>
                          <th className="p-2.5">Categoría</th>
                          <th className="p-2.5">Precio Venta</th>
                          <th className="p-2.5">Costo Unit.</th>
                        </>
                      )}
                      <th className="p-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? "hover:bg-slate-900/50" : "bg-rose-950/20"}>
                        <td className="p-2.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                              <AlertCircle className="w-3 h-3" /> Incompleto
                            </span>
                          )}
                        </td>

                        {isClients ? (
                          <>
                            <td className="p-2.5 font-bold text-white">{row.nombreCompletoCliente || "-"}</td>
                            <td className="p-2.5 font-mono">{row.numeroContacto || "-"}</td>
                            <td className="p-2.5 text-slate-400">{row.correo || "-"}</td>
                            <td className="p-2.5 text-slate-400 text-[11px] truncate max-w-xs">
                              {row.direccionServicio || row.nombreCompletoRS || "-"}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2.5 font-bold text-white">{row.nombreServicio || "-"}</td>
                            <td className="p-2.5 font-mono text-slate-300">{row.categoria}</td>
                            <td className="p-2.5 font-mono text-emerald-400 font-bold">${row.precio}</td>
                            <td className="p-2.5 font-mono text-slate-400">${row.costo}</td>
                          </>
                        )}

                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition rounded"
                            title="Quitar esta fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Bar during execution */}
          {isProcessing && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Guardando registros en la base de datos...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold rounded-xl transition"
          >
            {importSummary ? "Cerrar Ventana" : "Cancelar"}
          </button>

          {parsedRows.length > 0 && !importSummary && (
            <button
              onClick={handleExecuteImport}
              disabled={isProcessing || parsedRows.filter((r) => r.isValid).length === 0}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-900/30"
            >
              <Upload className="w-4 h-4" />
              <span>
                {isProcessing
                  ? "Importando..."
                  : `Confirmar e Importar (${parsedRows.filter((r) => r.isValid).length} registros)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
