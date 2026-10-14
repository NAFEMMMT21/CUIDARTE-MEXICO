/**
 * IndexedDB & Local File Storage Engine for Cuidarte Pachuca
 * Provides robust, high-capacity client-side persistence for medical PDFs,
 * clinical photos, lab studies, and contracts without hitting localStorage or Firestore limits.
 */

const DB_NAME = "CuidarteFilesDB";
const DB_VERSION = 1;
const STORE_NAME = "documents";

export interface StoredDocument {
  id: string;
  ownerId: string; // Client ID, Staff ID, or Expediente ID
  category: "client" | "staff" | "expediente" | "caratula";
  nombre: string;
  tipo: string;
  url: string; // Base64 data URL
  archivoUrl?: string;
  tamano?: string;
  tamanoBytes?: number;
  nombreArchivoOriginal?: string;
  fechaSubida: string;
  notas?: string;
  mimeType?: string;
}

let dbInstance: IDBDatabase | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("ownerId", "ownerId", { unique: false });
        store.createIndex("category", "category", { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a document into persistent IndexedDB storage
 */
export async function saveDocumentToIndexedDB(doc: StoredDocument): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Error saving document:", err);
  }
}

/**
 * Save multiple documents in a single transaction
 */
export async function saveBatchDocumentsToIndexedDB(docs: StoredDocument[]): Promise<void> {
  if (!docs || docs.length === 0) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const doc of docs) {
        store.put(doc);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Error batch saving documents:", err);
  }
}

/**
 * Retrieve a specific document by its ID
 */
export async function getDocumentFromIndexedDB(id: string): Promise<StoredDocument | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IndexedDB] Error reading document:", err);
    return null;
  }
}

/**
 * Retrieve all documents belonging to a specific owner (Client, Staff, etc.)
 */
export async function getDocumentsByOwnerFromIndexedDB(ownerId: string): Promise<StoredDocument[]> {
  if (!ownerId) return [];
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const target = ownerId.trim().toUpperCase();

      // Retrieve all documents and match case-insensitively for 100% reliability
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as StoredDocument[];
        const filtered = all.filter(
          (d) => (d.ownerId || "").trim().toUpperCase() === target ||
                 (d.id || "").trim().toUpperCase().includes(target)
        );
        resolve(filtered);
      };
      req.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] Error reading documents by owner:", err);
    return [];
  }
}

/**
 * Retrieve all stored documents from IndexedDB
 */
export async function getAllDocumentsFromIndexedDB(): Promise<StoredDocument[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[IndexedDB] Error reading all documents:", err);
    return [];
  }
}

/**
 * Delete a document from IndexedDB
 */
export async function deleteDocumentFromIndexedDB(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      
      // 1. Direct delete by ID
      store.delete(id);

      // 2. Also search case-insensitively to guarantee no orphaned records
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as StoredDocument[];
        const target = id.trim().toLowerCase();
        for (const item of all) {
          if (item && item.id && item.id.trim().toLowerCase() === target) {
            store.delete(item.id);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn("[IndexedDB] Error deleting document:", err);
  }
}

/**
 * Reads any File object safely and resolves as a Base64 data URL
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer el archivo como formato texto/Base64"));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.onabort = () => reject(new Error("Lectura de archivo abortada"));
    reader.readAsDataURL(file);
  });
}

/**
 * Optimizes images client-side to ensure crystal-clear visual quality (1600px)
 * while compressing size down to ~80KB-250KB for fast syncing.
 */
export function optimizeImageFile(file: File, maxDimension = 1600, quality = 0.82): Promise<{ base64: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawBase64 = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ base64: rawBase64, size: file.size });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        const approximateBytes = Math.round((compressedBase64.length * 3) / 4);

        resolve({
          base64: compressedBase64,
          size: approximateBytes,
        });
      };
      img.onerror = () => {
        resolve({ base64: rawBase64, size: file.size });
      };
      img.src = rawBase64;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Human-readable byte size formatter
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "Archivo digital";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
