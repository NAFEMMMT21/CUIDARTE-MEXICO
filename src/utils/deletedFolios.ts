export const DELETED_FOLIOS_STORAGE_KEY = "cuidarte_pachuca_deleted_caratulas_v1";

/**
 * Loads the list of normalized folios of carátulas that have been permanently deleted by the user.
 */
export function loadDeletedCaratulaFolios(): string[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(DELETED_FOLIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((f) => String(f).trim().toLowerCase()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Persists the list of permanently deleted carátula folios in localStorage.
 */
export function saveDeletedCaratulaFolios(folios: string[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const clean = Array.from(
      new Set((folios || []).map((f) => String(f).trim().toLowerCase()).filter(Boolean))
    );
    localStorage.setItem(DELETED_FOLIOS_STORAGE_KEY, JSON.stringify(clean));
  } catch {}
}

/**
 * Checks whether a given carátula folio has been permanently deleted.
 */
export function isCaratulaFolioDeleted(folio?: string): boolean {
  if (!folio) return false;
  const list = loadDeletedCaratulaFolios();
  return list.includes(folio.trim().toLowerCase());
}

/**
 * Marks a carátula folio as permanently deleted.
 */
export function markCaratulaFolioDeleted(folio: string): void {
  if (!folio) return;
  const list = loadDeletedCaratulaFolios();
  const norm = folio.trim().toLowerCase();
  if (!list.includes(norm)) {
    saveDeletedCaratulaFolios([...list, norm]);
  }
}

/**
 * Removes a carátula folio from the deleted set (e.g. if recreated or restored explicitly).
 */
export function unmarkCaratulaFolioDeleted(folio: string): void {
  if (!folio) return;
  const list = loadDeletedCaratulaFolios();
  const norm = folio.trim().toLowerCase();
  saveDeletedCaratulaFolios(list.filter((f) => f !== norm));
}
