import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText
} from "lucide-react";

// Configure worker src
try {
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn("Could not set pdf worker:", e);
}

interface PDFCanvasViewerProps {
  url: string; // Base64 or URL or Blob URL
  title?: string;
  className?: string;
}

function dataURLToUint8Array(dataUrl: string): Uint8Array {
  let base64 = dataUrl;
  if (dataUrl.includes(",")) {
    base64 = dataUrl.split(",")[1];
  }
  base64 = base64.replace(/\s/g, "");
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  url,
  title = "Documento PDF",
  className = "",
}) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackBlobUrl, setFallbackBlobUrl] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Prepare fallback blob URL in case canvas rendering is not supported
  useEffect(() => {
    let blobUrl = "";
    try {
      if (url.startsWith("data:")) {
        const bytes = dataURLToUint8Array(url);
        const blob = new Blob([bytes], { type: "application/pdf" });
        blobUrl = URL.createObjectURL(blob);
      } else {
        blobUrl = url;
      }
      setFallbackBlobUrl(blobUrl);
    } catch (e) {
      setFallbackBlobUrl(url);
    }

    return () => {
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [url]);

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadPdf() {
      try {
        let source: any;
        if (url.startsWith("data:")) {
          const bytes = dataURLToUint8Array(url);
          source = { data: bytes };
        } else {
          source = { url };
        }

        const loadingTask = pdfjsLib.getDocument(source);
        const loadedDoc = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(loadedDoc);
          setNumPages(loadedDoc.numPages);
          setPageNum(1);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn("[PDFCanvasViewer] PDF.js load error:", err);
        if (!isCancelled) {
          setError("No se pudo procesar el PDF directamente en el lienzo. Puede utilizar el visor embebido o descargarlo.");
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  // Render Current Page on Canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale, rotation });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      // Handle high-DPI displays
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext = {
        canvasContext: context,
        transform,
        viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name !== "RenderingCancelledException") {
        console.warn("[PDFCanvasViewer] Page render error:", err);
      }
    }
  }, [pdfDoc, pageNum, scale, rotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum((p) => p - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum((p) => p + 1);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3.0));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleResetZoom = () => setScale(1.2);
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const openInNewTab = () => {
    if (fallbackBlobUrl) {
      window.open(fallbackBlobUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={`flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 w-full h-full ${className}`}>
      {/* Control Bar */}
      <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-white shrink-0">
        {/* Pagination */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition text-slate-200 cursor-pointer"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-medium px-2 py-1 bg-slate-800/80 rounded-md text-slate-300">
            {numPages > 0 ? `${pageNum} / ${numPages}` : "..."}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={pageNum >= numPages || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 transition text-slate-200 cursor-pointer"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Rotation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition text-slate-200 cursor-pointer"
            title="Alejar (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="text-xs font-mono font-bold px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-md text-amber-400 cursor-pointer"
            title="Restablecer zoom"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0 || isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 transition text-slate-200 cursor-pointer"
            title="Acercar (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition text-slate-200 cursor-pointer"
            title="Rotar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {fallbackBlobUrl && (
            <button
              type="button"
              onClick={openInNewTab}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition cursor-pointer"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}

          <a
            href={fallbackBlobUrl || url}
            download={title.endsWith(".pdf") ? title : `${title}.pdf`}
            className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1 text-xs font-bold px-2.5 cursor-pointer"
            title="Descargar PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar</span>
          </a>
        </div>
      </div>

      {/* Canvas Viewport Area */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center min-h-[400px]">
        {isLoading ? (
          <div className="text-center text-white space-y-3 py-12">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-300">Cargando y procesando páginas del PDF...</p>
          </div>
        ) : error ? (
          <div className="w-full max-w-xl text-center p-6 bg-slate-900 rounded-2xl border border-slate-800 space-y-4">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">Visualizador Alternativo de PDF</h4>
              <p className="text-xs text-slate-400">
                El documento está listo. Puede abrirlo en el visor integrado de su navegador o descargarlo directamente.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {fallbackBlobUrl && (
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir en Nueva Ventana</span>
                </button>
              )}
              <a
                href={fallbackBlobUrl || url}
                download={title.endsWith(".pdf") ? title : `${title}.pdf`}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Archivo</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full">
            <canvas ref={canvasRef} className="block mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};
