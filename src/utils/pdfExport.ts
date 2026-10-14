import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { CUIDARTE_LOGO_PREPROCESSED_BASE64, CUIDARTE_VECTOR_LOGO_BASE64 } from "../assets/logoBase64";

/**
 * Finds the element to export by primary ID or fallback IDs
 */
const getExportElement = (elementId: string): HTMLElement | null => {
  let element = document.getElementById(elementId);
  if (!element) {
    element =
      document.getElementById("care-plan-official-document") ||
      document.getElementById("plano-cuidado-official-document") ||
      document.getElementById("kardex-official-document") ||
      document.getElementById("shopping-list-official-document") ||
      document.getElementById("inventory-official-document") ||
      document.getElementById("vitals-monthly-pdf-document") ||
      document.getElementById("caratula-official-document") ||
      document.getElementById("ticket-official-document") ||
      document.getElementById("caratula-export-document") ||
      document.querySelector<HTMLElement>("[id^='care-plan-']") ||
      document.querySelector<HTMLElement>("[id^='plano-']") ||
      document.querySelector<HTMLElement>("[id^='kardex-official-document']") ||
      document.querySelector<HTMLElement>("[id^='shopping-list-official-document']") ||
      document.querySelector<HTMLElement>("[id^='inventory-official-document']") ||
      document.querySelector<HTMLElement>("[id^='vitals-monthly-pdf-document']") ||
      document.querySelector<HTMLElement>("[id^='caratula-official-document']");
  }
  return element;
};

/**
 * Creates an offscreen fixed-width desktop container (850px).
 * Pre-processes all logos and external images into embedded Base64 strings to ensure
 * 100% reliable rendering without network latency or CORS restrictions.
 */
const prepareDesktopExportClone = (
  element: HTMLElement,
  targetWidth: number = 850
): { target: HTMLElement; cleanup: () => void } => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = `${targetWidth}px`;
  container.style.minWidth = `${targetWidth}px`;
  container.style.maxWidth = `${targetWidth}px`;
  container.style.zIndex = "999999";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#0f172a";
  container.style.opacity = "1";
  container.style.visibility = "visible";
  container.style.display = "block";
  container.style.pointerEvents = "none";
  container.style.overflow = "visible";

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${targetWidth}px`;
  clone.style.minWidth = `${targetWidth}px`;
  clone.style.maxWidth = `${targetWidth}px`;
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.display = "block";
  clone.style.visibility = "visible";
  clone.style.opacity = "1";
  clone.style.boxSizing = "border-box";
  clone.classList.remove("hidden");

  // Pre-process all images inside the clone: Replace external URLs or missing logos with preprocessed Base64
  const clonedImgs = Array.from(clone.querySelectorAll("img"));
  for (const img of clonedImgs) {
    const src = img.getAttribute("src") || "";
    // If it's a remote URL or contains cuidarte/logo references, ensure base64 is used
    if (src.startsWith("http://") || src.startsWith("https://") || src.includes("cuidarte") || src.includes("logo") || !src.startsWith("data:")) {
      img.src = CUIDARTE_LOGO_PREPROCESSED_BASE64;
    }
  }

  container.appendChild(clone);
  document.body.appendChild(container);

  return {
    target: clone,
    cleanup: () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    },
  };
};

/**
 * Generic High-Quality Multi-Page PDF Exporter using preprocessed Base64
 */
export const downloadDocumentPDF = async (
  elementId: string,
  filename: string = "Documento_Cuidarte.pdf"
): Promise<boolean> => {
  const element = getExportElement(elementId);
  if (!element) {
    console.error(`Element not found: ${elementId}`);
    alert("Error: No se encontró el documento en pantalla para exportar a PDF.");
    return false;
  }

  const { target: exportTarget, cleanup } = prepareDesktopExportClone(element, 850);

  try {
    // Wait for fonts to be ready
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    // Ensure all images inside target are ready (Base64 images resolve immediately)
    const images = Array.from(exportTarget.querySelectorAll("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
        img.crossOrigin = "anonymous";
        return new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => {
            // Fallback immediately to preprocessed vector base64
            img.src = CUIDARTE_LOGO_PREPROCESSED_BASE64;
            resolve(true);
          };
          setTimeout(() => resolve(true), 300);
        });
      })
    );

    // Micro-delay for layout settlement
    await new Promise((r) => setTimeout(r, 60));

    let dataUrl: string = "";
    try {
      const canvas = await html2canvas(exportTarget, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: 850,
        windowWidth: 850,
        imageTimeout: 3000,
      });
      dataUrl = canvas.toDataURL("image/png");
    } catch (primaryErr) {
      console.warn("html2canvas fallback, trying html-to-image with skipFonts", primaryErr);
      dataUrl = await toPng(exportTarget, {
        quality: 0.98,
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: "#ffffff",
        width: 850,
        fontEmbedCSS: "", // Prevents SecurityError on remote font stylesheets (Open Sans, etc.)
        skipFonts: true, // Prevents SecurityError on remote font stylesheets
      });
    }

    if (!dataUrl || dataUrl.length < 100) {
      throw new Error("No se pudo generar la imagen del documento.");
    }

    const img = document.createElement("img");
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = reject;
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210; // A4 width mm
    const pageHeight = 297; // A4 height mm
    const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;

    const totalPages = Math.max(1, Math.ceil(imgHeight / pageHeight));

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) {
        pdf.addPage();
      }
      const yOffset = -page * pageHeight;
      pdf.addImage(dataUrl, "PNG", 0, yOffset, imgWidth, imgHeight, undefined, "FAST");
    }

    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF generation error:", err);
    alert("Iniciando ventana de impresión / guardado como PDF en el navegador...");
    window.print();
    return false;
  } finally {
    cleanup();
  }
};

/**
 * Asynchronous Document & Plan / Plano PDF Downloader
 * Executes asynchronously without blocking UI, returns promise and status
 */
export const downloadDocumentPDFAsync = async (
  elementId: string,
  filename: string,
  onProgress?: (step: "capturing" | "building_pdf" | "saving" | "done" | "error") => void
): Promise<{ success: boolean; filename: string }> => {
  try {
    onProgress?.("capturing");
    const ok = await downloadDocumentPDF(elementId, filename);
    if (ok) {
      onProgress?.("done");
      return { success: true, filename };
    } else {
      onProgress?.("error");
      return { success: false, filename };
    }
  } catch (err) {
    onProgress?.("error");
    return { success: false, filename };
  }
};

/**
 * Asynchronous Care Plan / Plan de Cuidados & Planos PDF Downloader
 */
export const downloadCarePlanPDF = async (
  patientOrFolio: string = "Paciente",
  elementId: string = "caratula-official-document"
): Promise<{ success: boolean; filename: string }> => {
  const safe = (patientOrFolio || "Plan_de_Cuidados").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Plan_de_Cuidados_${safe}_Cuidarte_Mexico.pdf`;
  return downloadDocumentPDFAsync(elementId, filename);
};

export const downloadCaratulaPDF = async (
  elementId: string = "caratula-official-document",
  filename: string = "Caratula_Servicio_Cuidarte_Mexico.pdf"
) => {
  return downloadDocumentPDF(elementId, filename);
};

export const downloadKardexPDF = async (
  patientName: string = "Receptor_Servicio",
  filename?: string
) => {
  const safeName = (patientName || "Receptor_Servicio").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `Kardex_Medicacion_${safeName}_Cuidarte_Mexico.pdf`;
  return downloadDocumentPDF("kardex-official-document", actualFilename);
};

export const downloadShoppingListPDF = async (
  patientName: string = "Receptor_Servicio",
  filename?: string
) => {
  const safeName = (patientName || "Receptor_Servicio").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `Lista_Compras_Insumos_${safeName}_Cuidarte_Mexico.pdf`;
  return downloadDocumentPDF("shopping-list-official-document", actualFilename);
};

export const downloadInventoryPDF = async (
  patientName: string = "Receptor_Servicio",
  filename?: string
) => {
  const safeName = (patientName || "Receptor_Servicio").replace(/[^a-zA-Z0-9_-]/g, "_");
  const actualFilename = filename || `Inventario_Insumos_${safeName}_Cuidarte_Mexico.pdf`;
  return downloadDocumentPDF("inventory-official-document", actualFilename);
};

export const downloadCaratulaImage = async (
  elementId: string,
  filename: string = "Caratula_Servicio_Cuidarte.png"
) => {
  const element = getExportElement(elementId);
  if (!element) {
    alert("Error: No se encontró el documento para exportar.");
    return;
  }

  const { target: exportTarget, cleanup } = prepareDesktopExportClone(element, 850);

  try {
    await new Promise((r) => setTimeout(r, 100));

    let dataUrl: string;
    try {
      const canvas = await html2canvas(exportTarget, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: 850,
        windowWidth: 850,
        imageTimeout: 3000,
      });
      dataUrl = canvas.toDataURL("image/png");
    } catch (primaryErr) {
      console.warn("html2canvas failed, trying html-to-image with skipFonts", primaryErr);
      dataUrl = await toPng(exportTarget, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: false,
        backgroundColor: "#ffffff",
        fontEmbedCSS: "",
        skipFonts: true,
      });
    }

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Image generation error:", err);
    alert("Ocurrió un error al generar la imagen PNG. Intente con el botón Imprimir.");
  } finally {
    cleanup();
  }
};

export const printCaratulaDocument = () => {
  window.print();
};


