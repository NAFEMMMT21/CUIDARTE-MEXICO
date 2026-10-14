/**
 * Utility for Sequential Control Folios of Scheduled Shifts (Guardias Agendadas)
 * 
 * Format: GACP + [YY] + [Serie Letter A-Z] + [0000-9999]
 * Meaning:
 *  - G: GUARDIA
 *  - A: AGENDADA
 *  - CP: CUIDARTE PACHUCA
 *  - 26: AÑO (2026)
 *  - A0000 a Z9999: NÚMERO DE SERIE INICIAL A FINAL (Base actual: A2108)
 */

export const BASE_GUARDIA_YEAR = "26";
export const STARTING_GUARDIA_SERIAL_INDEX = 2108; // Base inicial: A2108

/**
 * Converts a numeric sequential index (e.g. 2108, 10005) into a formatted folio:
 * 2108 -> "GACP26A2108"
 * 10000 -> "GACP26B0000"
 */
export function formatGuardiaFolio(serialIndex: number, year: string = BASE_GUARDIA_YEAR): string {
  const safeIndex = Math.max(0, Math.floor(serialIndex));
  const letterCode = Math.min(25, Math.floor(safeIndex / 10000));
  const letterChar = String.fromCharCode(65 + letterCode); // A = 65, B = 66, ..., Z = 90
  const numPart = String(safeIndex % 10000).padStart(4, "0");
  return `GACP${year}${letterChar}${numPart}`;
}

/**
 * Parses a folio string like "GACP26A2108" or "GACP26B0012" to extract its numeric index.
 * Returns null if not matching the standard pattern.
 */
export function parseGuardiaFolioIndex(folio?: string | null): number | null {
  if (!folio || typeof folio !== "string") return null;
  const cleaned = folio.trim().toUpperCase();

  // Match GACP26A2108 or GACPA2108 or GACP-26-A2108
  const match = cleaned.match(/^GACP(?:-?(\d{2})-?)?([A-Z])(\d{4})$/);
  if (!match) return null;

  const letter = match[2];
  const numStr = match[3];

  const letterIndex = letter.charCodeAt(0) - 65; // 0 for A, 1 for B...
  if (letterIndex < 0 || letterIndex > 25) return null;

  const num = parseInt(numStr, 10);
  if (isNaN(num)) return null;

  return letterIndex * 10000 + num;
}

/**
 * Validates if a string is a valid Guardia Folio format.
 */
export function isValidGuardiaFolio(folio?: string | null): boolean {
  return parseGuardiaFolioIndex(folio) !== null;
}

/**
 * Finds the highest assigned Guardia folio index across all sources (events, caratulas, shifts).
 * Defaults to STARTING_GUARDIA_SERIAL_INDEX - 1 (2107) so the first assigned is 2108 (A2108).
 */
export function getMaxGuardiaIndex(
  sources: Array<{ folioGuardia?: string; id?: string; [key: string]: any } | string | null | undefined>
): number {
  let maxIndex = STARTING_GUARDIA_SERIAL_INDEX - 1; // 2107

  for (const item of sources) {
    if (!item) continue;
    if (typeof item === "string") {
      const idx = parseGuardiaFolioIndex(item);
      if (idx !== null && idx > maxIndex) {
        maxIndex = idx;
      }
    } else {
      if (item.folioGuardia) {
        const idx = parseGuardiaFolioIndex(item.folioGuardia);
        if (idx !== null && idx > maxIndex) {
          maxIndex = idx;
        }
      }
      if (item.id && typeof item.id === "string" && item.id.startsWith("GACP")) {
        const idx = parseGuardiaFolioIndex(item.id);
        if (idx !== null && idx > maxIndex) {
          maxIndex = idx;
        }
      }
    }
  }

  return maxIndex;
}

/**
 * Generates a batch of N unique sequential folios starting from the next available index.
 */
export function generateGuardiaFoliosBatch(
  count: number,
  existingSources: Array<any> = [],
  year: string = BASE_GUARDIA_YEAR
): string[] {
  if (count <= 0) return [];
  const maxIdx = getMaxGuardiaIndex(existingSources);
  const result: string[] = [];

  for (let i = 1; i <= count; i++) {
    result.push(formatGuardiaFolio(maxIdx + i, year));
  }

  return result;
}

/**
 * Gets the next single Guardia Folio available.
 */
export function getNextGuardiaFolio(
  existingSources: Array<any> = [],
  year: string = BASE_GUARDIA_YEAR
): string {
  const [folio] = generateGuardiaFoliosBatch(1, existingSources, year);
  return folio || formatGuardiaFolio(STARTING_GUARDIA_SERIAL_INDEX, year);
}

/**
 * Formats a Guardia Folio into a structured breakdown for badges and tooltips.
 */
export function breakdownGuardiaFolio(folio: string): {
  isValid: boolean;
  prefix: string;
  year: string;
  serie: string;
  numero: string;
  label: string;
} {
  const match = (folio || "").trim().toUpperCase().match(/^GACP(?:-?(\d{2})-?)?([A-Z])(\d{4})$/);
  if (!match) {
    return {
      isValid: false,
      prefix: "GACP",
      year: "26",
      serie: "A",
      numero: "0000",
      label: folio || "Sin Folio",
    };
  }

  return {
    isValid: true,
    prefix: "GACP",
    year: match[1] || "26",
    serie: match[2],
    numero: match[3],
    label: `Guardia Agendada Serie ${match[2]} #${match[3]} (${match[1] || "26"})`,
  };
}

/**
 * Checks whether two shift representations correspond to the same underlying guardia.
 * Supports cross-matching by folioGuardia, ID, and datetime slot.
 */
export function isSameGuardia(
  a: {
    id?: string;
    folioGuardia?: string;
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
    tipoServicio?: string;
    personalAsignado?: string;
    staffId?: string;
    staffNoSocio?: string;
    fechaInicio?: string;
    caratulaFolio?: string;
    clientId?: string;
    [key: string]: any;
  },
  b: {
    id?: string;
    folioGuardia?: string;
    fecha?: string;
    horaInicio?: string;
    horaFin?: string;
    tipoServicio?: string;
    personalAsignado?: string;
    staffId?: string;
    staffNoSocio?: string;
    fechaInicio?: string;
    caratulaFolio?: string;
    clientId?: string;
    [key: string]: any;
  }
): boolean {
  if (!a || !b) return false;

  const aId = (a.id || "").trim();
  const bId = (b.id || "").trim();
  const aFolio = (a.folioGuardia || "").trim().toUpperCase();
  const bFolio = (b.folioGuardia || "").trim().toUpperCase();

  // 1. Direct FolioGuardia match (if non-empty)
  if (aFolio && bFolio && aFolio === bFolio) return true;

  // 2. Direct ID match (if non-empty)
  if (aId && bId && aId === bId) return true;

  // 3. Cross FolioGuardia & ID match
  if (aFolio && bId && aFolio === bId.toUpperCase()) return true;
  if (aId && bFolio && aId.toUpperCase() === bFolio) return true;

  // If BOTH have valid, distinct guardia folios, they can NEVER be the same guardia
  if (aFolio && bFolio && isValidGuardiaFolio(aFolio) && isValidGuardiaFolio(bFolio) && aFolio !== bFolio) {
    return false;
  }

  // Cross-boundary safety: shifts belonging to DIFFERENT carátulas are never the same guardia
  const aCaratula = (a.caratulaFolio || "").trim().toLowerCase();
  const bCaratula = (b.caratulaFolio || "").trim().toLowerCase();
  if (aCaratula && bCaratula && aCaratula !== bCaratula) {
    return false;
  }

  // Cross-boundary safety: shifts belonging to DIFFERENT clients are never the same guardia
  const aClient = (a.clientId || "").trim().toLowerCase();
  const bClient = (b.clientId || "").trim().toLowerCase();
  if (aClient && bClient && aClient !== bClient) {
    return false;
  }

  // 4. Date & Time match ONLY within the same context (same carátula or same client)
  const aDate = a.fecha || (a.fechaInicio ? a.fechaInicio.split("T")[0] : "");
  const bDate = b.fecha || (b.fechaInicio ? b.fechaInicio.split("T")[0] : "");
  const aTime = a.horaInicio ? a.horaInicio.slice(0, 5) : (a.fechaInicio ? a.fechaInicio.split("T")[1]?.slice(0, 5) : "");
  const bTime = b.horaInicio ? b.horaInicio.slice(0, 5) : (b.fechaInicio ? b.fechaInicio.split("T")[1]?.slice(0, 5) : "");

  // Require matching date & time, AND require at least a common carátula or client context
  if (aDate && bDate && aDate === bDate && aTime && bTime && aTime === bTime && (aCaratula || aClient)) {
    const aStaff = (a.staffId || a.staffNoSocio || a.personalAsignado || "").trim().toLowerCase();
    const bStaff = (b.staffId || b.staffNoSocio || b.personalAsignado || "").trim().toLowerCase();
    const aHasStaff = aStaff && !aStaff.includes("por asignar") && !aStaff.includes("sin asignar");
    const bHasStaff = bStaff && !bStaff.includes("por asignar") && !bStaff.includes("sin asignar");

    // If both specify staff and they are completely different, they are two separate nurses on the same shift
    if (aHasStaff && bHasStaff && aStaff !== bStaff && !aStaff.includes(bStaff) && !bStaff.includes(aStaff)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Deduplicates an array of shifts, consolidating payment data and keeping the most complete record.
 */
export function deduplicateShiftsList<T extends { [key: string]: any }>(shifts: T[]): T[] {
  if (!Array.isArray(shifts) || shifts.length <= 1) return shifts || [];

  const result: T[] = [];

  for (const shift of shifts) {
    const existingIdx = result.findIndex((existing) => isSameGuardia(existing, shift));
    if (existingIdx >= 0) {
      const existing = result[existingIdx];
      const isPaid = Boolean(existing.honorarioPagado || shift.honorarioPagado);
      const folio =
        (existing.folioGuardia && isValidGuardiaFolio(existing.folioGuardia))
          ? existing.folioGuardia
          : (shift.folioGuardia && isValidGuardiaFolio(shift.folioGuardia))
          ? shift.folioGuardia
          : existing.folioGuardia || shift.folioGuardia || existing.id || shift.id;

      result[existingIdx] = {
        ...existing,
        ...shift,
        id: folio || existing.id || shift.id,
        folioGuardia: folio,
        honorarioPagado: isPaid,
        pagoHonorarioId: existing.pagoHonorarioId || shift.pagoHonorarioId,
        fechaPagoHonorario: existing.fechaPagoHonorario || shift.fechaPagoHonorario,
        montoPagadoHonorario: existing.montoPagadoHonorario || shift.montoPagadoHonorario,
        costoHonorarios:
          typeof shift.costoHonorarios === "number" && shift.costoHonorarios > 0
            ? shift.costoHonorarios
            : existing.costoHonorarios,
      };
    } else {
      result.push({ ...shift });
    }
  }

  return result;
}
