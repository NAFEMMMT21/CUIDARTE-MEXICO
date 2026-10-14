/**
 * Formats a numeric folio index into standard uppercase format like CPSEA000, CPSEA001, CPSEA002
 */
export function formatFolio(num: number, prefix: string = "CPSEA"): string {
  const padded = num.toString().padStart(3, "0");
  return `${prefix.toUpperCase()}${padded}`;
}

/**
 * Parses a folio string like "CPSEA005" to extract the index 5
 */
export function parseFolioNumber(folioStr: string): number {
  const match = folioStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Generates the next sequential client identifier starting from baseline CLI-A170
 */
export function getNextClientId(clients: { id?: string }[] = []): string {
  let maxNum = 169; // baseline start is 170 (CLI-A170)
  clients.forEach((c) => {
    if (!c.id) return;
    const match = c.id.match(/CLI-(?:A)?(\d+)/i) || c.id.match(/CLI[A-Za-z-]*(\d+)/i) || c.id.match(/\d+/);
    if (match) {
      const num = parseInt(match[1] || match[0], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  return `CLI-A${maxNum + 1}`;
}

/**
 * Extracts the numeric sequence or identifier part of a client ID.
 * Examples:
 * - "CLI-001" -> "001"
 * - "CLI-005" -> "005"
 * - "CLI-010" -> "010"
 * - "CLI-A157" -> "157"
 * - "005" -> "005"
 * - "CLI-1" -> "001"
 */
export function extractClientNumber(clientId?: string | null): string {
  if (!clientId) return "001";
  const str = String(clientId).trim();

  // Match CLI-001, CLI-A170, CLI001, etc.
  const match = str.match(/CLI-(?:A)?(\d+)/i) || str.match(/CLI[A-Za-z-]*(\d+)/i) || str.match(/\d+/);
  if (match) {
    const raw = match[1] || match[0];
    return raw.length < 3 ? raw.padStart(3, "0") : raw;
  }

  // Fallback: strip "CLI-" prefix if any
  const stripped = str.replace(/^CLI-?/i, "").trim();
  return stripped || "001";
}

/**
 * Generates the test Carátula folio for a given client:
 * "el número de cliente + 01"
 * E.g.
 * - Client CLI-001 -> "00101"
 * - Client CLI-005 -> "00501"
 * - Client CLI-010 -> "01001"
 * - Client CLI-A157 -> "15701"
 */
export function getTestCaratulaFolio(clientId?: string | null): string {
  const clientNum = extractClientNumber(clientId);
  return `${clientNum}01`;
}

/**
 * Checks if a folio is a test carátula folio (e.g. "00101", "00501", ends with 01, or tagged as prueba)
 */
export function isTestCaratulaFolio(folio?: string | null): boolean {
  if (!folio) return false;
  const f = folio.trim().toUpperCase();
  return /^\d+01$/.test(f) || (f.endsWith("01") && f.length >= 4) || f.includes("PRUEBA");
}

/**
 * Formats a number as Mexican Pesos MXN currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Formats a date string to Spanish localized format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Generates current datetime string for Marca Temporal
 */
export function getCurrentTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Generates a non-guessable random token for public document verification URLs
 */
export function generateVerificationToken(): string {
  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(10);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    return `v_${hex}`;
  }
  return `v_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Converts a 0-based consecutive index (0..2599) into alphanumeric code (A00..Z99).
 * E.g.:
 * 0 -> A00, 1 -> A01 ... 99 -> A99
 * 100 -> B00 ... 199 -> B99
 * 2599 -> Z99
 * >= 2600 -> resets to A00
 */
export function indexToConsecutiveA00(index: number): string {
  const norm = ((index % 2600) + 2600) % 2600;
  const letterIndex = Math.floor(norm / 100); // 0..25
  const letter = String.fromCharCode(65 + letterIndex); // 'A'..'Z'
  const num = (norm % 100).toString().padStart(2, "0"); // '00'..'99'
  return `${letter}${num}`;
}

/**
 * Parses an alphanumeric code like "A00", "B15", "Z99" into its 0-based consecutive index (0..2599).
 * Returns -1 if invalid format.
 */
export function consecutiveA00ToIndex(code: string): number {
  if (!code) return -1;
  const match = code.trim().toUpperCase().match(/^([A-Z])(\d{2})$/);
  if (!match) return -1;
  const letterCode = match[1].charCodeAt(0) - 65; // 0..25
  const num = parseInt(match[2], 10); // 0..99
  if (letterCode < 0 || letterCode > 25 || isNaN(num) || num < 0 || num > 99) {
    return -1;
  }
  return letterCode * 100 + num;
}

/**
 * Extracts branch abbreviation for folio nomenclature:
 * C (Cuidarte) + XXXX (Sucursal ej. PACH, CDMX)
 */
export function resolveSucursalAbbreviation(
  sucursal?: { codigo?: string; nombre?: string; ciudad?: string } | null,
  fallbackName?: string
): string {
  if (sucursal?.codigo && sucursal.codigo.trim().length > 0) {
    return sucursal.codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  const name = (sucursal?.nombre || sucursal?.ciudad || fallbackName || "Pachuca").toUpperCase();
  if (name.includes("PACHUCA")) return "PACH";
  if (name.includes("CIUDAD DE MEXICO") || name.includes("CDMX") || name.includes("MÉXICO") || name.includes("MEXICO")) return "CDMX";
  if (name.includes("QUERETARO") || name.includes("QUERÉTARO") || name.includes("QRO")) return "QRO";
  if (name.includes("GUADALAJARA") || name.includes("GDL")) return "GDL";
  if (name.includes("MONTERREY") || name.includes("MTY")) return "MTY";
  if (name.includes("PUEBLA") || name.includes("PUE")) return "PUE";
  if (name.includes("CUERNAVACA") || name.includes("CUE")) return "CUE";

  const clean = name.replace(/^CUIDARTE\s*/i, "").replace(/[^A-Z0-9]/g, "");
  return (clean.slice(0, 4) || "PACH").toUpperCase();
}

/**
 * Generates official Caratula / Cotización folio according to the official nomenclature:
 * CXXXX0000A00:
 * - C: Cuidarte
 * - XXXX: Abreviación de la sucursal (ej. PACHUCA-PACH, CIUDAD DE MÉXICO-CDMX)
 * - 00: Mes (01-12)
 * - 00: Año (2 dígitos, ej. 26)
 * - A00: Folio consecutivo de A00 hasta Z99 y se reinicia
 */
export function getNextCaratulaFolioNomenclature({
  sucursal,
  sucursalNombre,
  caratulas = [],
  date = new Date(),
  tipoDocumento = "Caratula",
}: {
  sucursal?: { codigo?: string; nombre?: string; ciudad?: string } | null;
  sucursalNombre?: string;
  caratulas?: { folio?: string }[];
  date?: Date;
  tipoDocumento?: "Caratula" | "Cotización";
}): string {
  const abrev = resolveSucursalAbbreviation(sucursal, sucursalNombre);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const prefix = `C${abrev}${month}${year}`;

  // Match all existing folios with this prefix + 3-char consecutive
  const pattern = new RegExp(`^${prefix}([A-Z]\\d{2})$`, "i");
  let maxIdx = -1;

  caratulas.forEach((c) => {
    if (!c.folio) return;
    const clean = c.folio.trim().toUpperCase();
    const match = clean.match(pattern);
    if (match) {
      const idx = consecutiveA00ToIndex(match[1]);
      if (idx > maxIdx) {
        maxIdx = idx;
      }
    }
  });

  // If no folios exist yet in current month for this branch, check highest consecutive from any month
  // so the consecutive A00..Z99 counter continues sequentially and resets only after Z99
  if (maxIdx < 0) {
    const branchPattern = new RegExp(`^C${abrev}\\d{4}([A-Z]\\d{2})$`, "i");
    caratulas.forEach((c) => {
      if (!c.folio) return;
      const clean = c.folio.trim().toUpperCase();
      const match = clean.match(branchPattern);
      if (match) {
        const idx = consecutiveA00ToIndex(match[1]);
        if (idx > maxIdx) {
          maxIdx = idx;
        }
      }
    });
  }

  const nextIdx = maxIdx >= 0 ? (maxIdx + 1) % 2600 : 0;
  const consecutive = indexToConsecutiveA00(nextIdx);
  return `${prefix}${consecutive}`;
}

/**
 * Checks if a caratula/cotizacion folio matches the official Caratula format:
 * - New official nomenclature: CXXXX0000A00 (e.g. CPACH1026A00, CCDMX1026A00)
 * - Legacy: CPSEA + digits (e.g. CPSEA000, CPSEA170)
 */
export function isCurrentCaratulaFolio(folio: string): boolean {
  const clean = (folio || "").trim().toUpperCase();
  return /^C[A-Z0-9]{2,6}\d{4}[A-Z]\d{2}$/i.test(clean) || /^CPSEA\d+/i.test(clean);
}

/**
 * Checks if a cotizacion folio matches the official Cotizacion format:
 * - New official nomenclature: CXXXX0000A00 or COTXXXX0000A00
 * - Legacy: CPCOTA + digits (e.g. CPCOTA000, CPCOTA173)
 */
export function isCurrentCotizacionFolio(folio: string): boolean {
  const clean = (folio || "").trim().toUpperCase();
  return (
    /^COT[A-Z0-9]{2,6}\d{4}[A-Z]\d{2}$/i.test(clean) ||
    /^C[A-Z0-9]{2,6}\d{4}[A-Z]\d{2}$/i.test(clean) ||
    /^CPCOTA\d+/i.test(clean)
  );
}

/**
 * Checks if a client ID matches the current Client format: CLI-A + digits (e.g. CLI-A000, CLI-A170)
 */
export function isCurrentClientId(id: string): boolean {
  return /^CLI-A\d+/i.test((id || "").trim());
}

/**
 * Extracts digits from a string or returns -1
 */
export function extractDigits(str: string): number {
  if (!str) return -1;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : -1;
}

/**
 * Universal comparator for Caratulas & Cotizaciones:
 * - Current formats (CPSEA for Caratulas, CPCOTA for Cotizaciones) are placed FIRST,
 *   ordered from most recent (highest number) to oldest (lowest number).
 * - Legacy or different formats (pre-system implementation) are placed AT THE END,
 *   ordered descending among themselves.
 */
export function compareCaratulas(
  a: { folio?: string; tipoDocumento?: string; timestamp?: string },
  b: { folio?: string; tipoDocumento?: string; timestamp?: string }
): number {
  const folioA = (a.folio || "").trim().toUpperCase();
  const folioB = (b.folio || "").trim().toUpperCase();

  const isCurrA = isCurrentCaratulaFolio(folioA) || isCurrentCotizacionFolio(folioA);
  const isCurrB = isCurrentCaratulaFolio(folioB) || isCurrentCotizacionFolio(folioB);

  // 1. Current format items always precede legacy format items
  if (isCurrA && !isCurrB) return -1;
  if (!isCurrA && isCurrB) return 1;

  // 2. Both are current format: sort descending by numeric sequence (highest/most recent first)
  if (isCurrA && isCurrB) {
    const numA = extractDigits(folioA);
    const numB = extractDigits(folioB);
    if (numA !== numB && numA >= 0 && numB >= 0) {
      return numB - numA;
    }
    return folioB.localeCompare(folioA);
  }

  // 3. Both are legacy/different format: placed at the end, sorted descending
  const numA = extractDigits(folioA);
  const numB = extractDigits(folioB);
  if (numA >= 0 && numB >= 0 && numA !== numB) {
    return numB - numA;
  }
  if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
    return b.timestamp.localeCompare(a.timestamp);
  }
  return folioB.localeCompare(folioA);
}

/**
 * Universal comparator specifically for Cotizaciones:
 * - Current format (CPCOTA000) placed FIRST, ordered from most recent (highest number) to oldest.
 * - Legacy format quotes placed AT THE END.
 */
export function compareCotizaciones(
  a: { folio?: string; timestamp?: string },
  b: { folio?: string; timestamp?: string }
): number {
  const folioA = (a.folio || "").trim().toUpperCase();
  const folioB = (b.folio || "").trim().toUpperCase();

  const isCurrA = isCurrentCotizacionFolio(folioA);
  const isCurrB = isCurrentCotizacionFolio(folioB);

  if (isCurrA && !isCurrB) return -1;
  if (!isCurrA && isCurrB) return 1;

  if (isCurrA && isCurrB) {
    const numA = extractDigits(folioA);
    const numB = extractDigits(folioB);
    if (numA !== numB && numA >= 0 && numB >= 0) {
      return numB - numA;
    }
    return folioB.localeCompare(folioA);
  }

  const numA = extractDigits(folioA);
  const numB = extractDigits(folioB);
  if (numA >= 0 && numB >= 0 && numA !== numB) {
    return numB - numA;
  }
  if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
    return b.timestamp.localeCompare(a.timestamp);
  }
  return folioB.localeCompare(folioA);
}

/**
 * Universal comparator for Clientes:
 * - Current format (CLI-A000) placed FIRST, ordered from most recent (highest number) to oldest (lowest number).
 * - Legacy format client IDs (CLI-001, etc.) placed AT THE END, ordered descending.
 */
export function compareClients(
  a: { id?: string; timestamp?: string; nombreCompletoCliente?: string },
  b: { id?: string; timestamp?: string; nombreCompletoCliente?: string }
): number {
  const idA = (a.id || "").trim().toUpperCase();
  const idB = (b.id || "").trim().toUpperCase();

  const isCurrA = isCurrentClientId(idA);
  const isCurrB = isCurrentClientId(idB);

  // 1. Current format clients always precede legacy format clients
  if (isCurrA && !isCurrB) return -1;
  if (!isCurrA && isCurrB) return 1;

  // 2. Both are current format (CLI-A...): sort descending by number
  if (isCurrA && isCurrB) {
    const numA = extractDigits(idA);
    const numB = extractDigits(idB);
    if (numA !== numB && numA >= 0 && numB >= 0) {
      return numB - numA; // Descending: CLI-A175, CLI-A174, CLI-A170...
    }
    return idB.localeCompare(idA);
  }

  // 3. Both are legacy formats: placed at the end, sorted descending
  const numA = extractDigits(idA);
  const numB = extractDigits(idB);
  if (numA >= 0 && numB >= 0 && numA !== numB) {
    return numB - numA;
  }
  if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
    return b.timestamp.localeCompare(a.timestamp);
  }
  return idB.localeCompare(idA);
}

/**
 * Retrieves or computes a stable verification token for a given Caratula
 */
export function getVerificationToken(caratula: { verificationToken?: string; folio?: string; timestamp?: string }): string {
  if (caratula.verificationToken && caratula.verificationToken.trim().length > 0) {
    return caratula.verificationToken;
  }
  // Deterministic fallback for legacy items without a saved verificationToken
  let hash = 0;
  const str = `cuidarte_v2_salt_${caratula.folio || ""}_${caratula.timestamp || ""}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const folioSuffix = (caratula.folio || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `v_${Math.abs(hash).toString(36)}${folioSuffix}`;
}


