import { KardexMedication, KardexAdministrationLog, InventoryItem } from "../types";

/**
 * Checks if a formatted date string corresponds to a target Date in local time
 */
export const isDateMatching = (dateStr?: string, targetDate: Date = new Date()): boolean => {
  if (!dateStr) return false;
  const targetY = targetDate.getFullYear();
  const targetM = targetDate.getMonth();
  const targetD = targetDate.getDate();

  // Check DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return year === targetY && month === targetM && day === targetD;
  }

  // Check YYYY-MM-DD
  const yyyymmddMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    return year === targetY && month === targetM && day === targetD;
  }

  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.getFullYear() === targetY && parsed.getMonth() === targetM && parsed.getDate() === targetD;
  }

  return false;
};

/**
 * Checks if a formatted date string corresponds to TODAY in local time
 */
export const isDateToday = (dateStr?: string): boolean => {
  return isDateMatching(dateStr, new Date());
};

/**
 * Helper to check if a specific time slot (e.g. "08:00") of a medication has been administered on a specific DATE
 */
export const getSlotAdminLogForDate = (
  med: KardexMedication,
  timeStr: string,
  targetDate: Date = new Date()
): KardexAdministrationLog | null => {
  if (!med) return null;
  const dateLogs = (med.historialAdministracion || []).filter((log) => isDateMatching(log.fechaHora, targetDate));

  if (dateLogs.length === 0) {
    // Check fallback ultimaAdministracion ONLY if it matches date AND matches timeStr
    if (med.ultimaAdministracion && isDateMatching(med.ultimaAdministracion, targetDate)) {
      const match = med.ultimaAdministracion.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const logHHMM = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (logHHMM === timeStr) {
          return {
            id: 'LOG-ULTIMA',
            fechaHora: med.ultimaAdministracion,
            administradoPor: med.administradoPor || '',
            dosisAplicada: med.dosis,
            horarioProgramado: timeStr,
          };
        }
      }
    }
    return null;
  }

  // 1. Direct match on horarioProgramado
  const exactSlotLog = dateLogs.find(
    (log) => log.horarioProgramado === timeStr || (log as any).horarioToma === timeStr
  );
  if (exactSlotLog) return exactSlotLog;

  // 2. Check if notas contains explicit reference to this slot (e.g. "[Toma 08:00]" or "08:00 hrs")
  const notesMatch = dateLogs.find((log) => log.notas && log.notas.includes(timeStr));
  if (notesMatch) return notesMatch;

  // 3. Match by recorded hour/minute closest to timeStr
  const allSlots = extractTimeSlots(med.horario);
  if (allSlots.length <= 1) {
    // Only 1 slot in the entire day: the single log matches this slot
    return dateLogs[0];
  }

  const [slotH, slotM] = timeStr.split(':').map((n) => parseInt(n, 10));
  const slotMinutes = (slotH || 0) * 60 + (slotM || 0);

  for (const log of dateLogs) {
    if (log.horarioProgramado && log.horarioProgramado !== timeStr) {
      continue; // assigned to a different slot
    }
    const match = log.fechaHora.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
    if (match) {
      const lh = parseInt(match[1], 10);
      const lm = parseInt(match[2], 10);
      const logMinutes = lh * 60 + lm;

      // Find which slot in allSlots is closest to this log
      let closestSlot = allSlots[0];
      let minDiff = 99999;
      for (const s of allSlots) {
        const [sh, sm] = s.split(':').map((n) => parseInt(n, 10));
        const sMins = (sh || 0) * 60 + (sm || 0);
        const diff = Math.min(
          Math.abs(sMins - logMinutes),
          Math.abs(sMins + 1440 - logMinutes),
          Math.abs(sMins - 1440 - logMinutes)
        );
        if (diff < minDiff) {
          minDiff = diff;
          closestSlot = s;
        }
      }

      if (closestSlot === timeStr) {
        return log;
      }
    }
  }

  return null;
};

/**
 * Helper to check if a specific time slot (e.g. "08:00") of a medication has been administered TODAY
 */
export const getSlotAdminLogToday = (
  med: KardexMedication,
  timeStr: string
): KardexAdministrationLog | null => {
  return getSlotAdminLogForDate(med, timeStr, new Date());
};

/**
 * Returns true if a specific time slot (e.g. "08:00") of a medication has been administered (applied) on a specific DATE
 */
export const isSlotAdministeredForDate = (med: KardexMedication, timeStr: string, targetDate: Date = new Date()): boolean => {
  const log = getSlotAdminLogForDate(med, timeStr, targetDate);
  return Boolean(log && log.estadoAplicacion !== 'sin_aplicacion');
};

/**
 * Returns true if a specific time slot (e.g. "08:00") of a medication has been administered (applied) TODAY
 */
export const isSlotAdministeredToday = (med: KardexMedication, timeStr: string): boolean => {
  return isSlotAdministeredForDate(med, timeStr, new Date());
};

/**
 * Returns true if a specific time slot has been explicitly marked as "Sin Aplicación" / No ministrado on a specific DATE
 */
export const isSlotSinAplicacionForDate = (med: KardexMedication, timeStr: string, targetDate: Date = new Date()): boolean => {
  const log = getSlotAdminLogForDate(med, timeStr, targetDate);
  return Boolean(log && log.estadoAplicacion === 'sin_aplicacion');
};

/**
 * Returns true if a specific time slot has been explicitly marked as "Sin Aplicación" / No ministrado TODAY
 */
export const isSlotSinAplicacionToday = (med: KardexMedication, timeStr: string): boolean => {
  return isSlotSinAplicacionForDate(med, timeStr, new Date());
};

/**
 * Returns true if a specific time slot has ANY log recorded on a specific DATE (either applied or marked sin_aplicacion)
 */
export const isSlotLoggedForDate = (med: KardexMedication, timeStr: string, targetDate: Date = new Date()): boolean => {
  return Boolean(getSlotAdminLogForDate(med, timeStr, targetDate));
};

/**
 * Returns true if a specific time slot has ANY log recorded today (either applied or marked sin_aplicacion)
 */
export const isSlotLoggedToday = (med: KardexMedication, timeStr: string): boolean => {
  return isSlotLoggedForDate(med, timeStr, new Date());
};

/**
 * Calculates the progress of daily doses administered for a medication
 */
export const getMedicationDosesProgressToday = (med: KardexMedication) => {
  const slots = extractTimeSlots(med.horario);
  const totalSlots = slots.length > 0 ? slots.length : (med.vecesAlDia || 1);
  if (slots.length === 0) {
    const todayLogs = (med.historialAdministracion || []).filter((l) => isDateToday(l.fechaHora));
    const appliedLogs = todayLogs.filter((l) => l.estadoAplicacion !== 'sin_aplicacion');
    const sinAppLogs = todayLogs.filter((l) => l.estadoAplicacion === 'sin_aplicacion');
    const count = appliedLogs.length > 0 ? appliedLogs.length : (med.ultimaAdministracion && isDateToday(med.ultimaAdministracion) ? 1 : 0);
    return {
      totalSlots,
      administeredSlots: Math.min(count, totalSlots),
      administeredCount: Math.min(count, totalSlots),
      sinAplicacionCount: sinAppLogs.length,
      pendingSlots: Math.max(0, totalSlots - count - sinAppLogs.length),
      percent: Math.min(100, Math.round(((count + sinAppLogs.length) / totalSlots) * 100)),
      isAllDone: (count + sinAppLogs.length) >= totalSlots,
      slotsStatus: [] as Array<{ slot: string; administered: boolean; sinAplicacion: boolean; log: KardexAdministrationLog | null }>,
    };
  }

  const slotsStatus = slots.map((slot) => {
    const log = getSlotAdminLogToday(med, slot);
    const administered = Boolean(log && log.estadoAplicacion !== 'sin_aplicacion');
    const sinAplicacion = Boolean(log && log.estadoAplicacion === 'sin_aplicacion');
    return {
      slot,
      administered,
      sinAplicacion,
      log,
    };
  });
  const administeredCount = slotsStatus.filter((s) => s.administered).length;
  const sinAplicacionCount = slotsStatus.filter((s) => s.sinAplicacion).length;
  const processedCount = administeredCount + sinAplicacionCount;

  return {
    totalSlots: slots.length,
    administeredSlots: administeredCount,
    administeredCount: administeredCount,
    sinAplicacionCount,
    pendingSlots: Math.max(0, slots.length - processedCount),
    percent: Math.min(100, Math.round((processedCount / slots.length) * 100)),
    isAllDone: processedCount >= slots.length,
    slotsStatus,
  };
};

/**
 * Parses schedule string (e.g. "08:00 - 14:00 - 20:00", "09:00, 21:00", "Cada 8 horas", "00:00 - 04:00 - 08:00 - 12:00 - 16:00 - 20:00")
 * and extracts individual time slots in "HH:MM" format.
 */
export const extractTimeSlots = (horarioStr?: string): string[] => {
  if (!horarioStr) return [];
  const rawSlots = horarioStr.split(/[-–,/]+/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const slot of rawSlots) {
    const match = slot.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      result.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return result;
};

/**
 * Parses unit multiplier / quantity taken per dose from dosage or frequency string.
 * Examples:
 * - "2 dosis" -> 2
 * - "2 pastillas" -> 2
 * - "2 tabletas" -> 2
 * - "2 tabs" -> 2
 * - "2 cápsulas" -> 2
 * - "1/2 pastilla" -> 0.5
 * - "1.5 tabletas" -> 1.5
 * - "200 mcg" -> 1 (if no unit quantity specified)
 * - "2 pastillas cada 4 horas" -> 2
 */
export const parseUnitsPerDose = (dosisStr?: string, frecuenciaStr?: string): number => {
  const combined = `${dosisStr || ""} ${frecuenciaStr || ""}`.toLowerCase().trim();
  if (!combined) return 1;

  // Fractions: "1/2", "0.5", "media pastilla"
  if (combined.match(/\b(1\/2|0\.5|media)\b/i)) return 0.5;
  if (combined.match(/\b(1\/4|0\.25|un cuarto)\b/i)) return 0.25;

  // Patterns like "2 dosis", "2 pastillas", "2 tabletas", "2 tabs", "2 cápsulas", "2 comp", "2 ampollas", "2 sobres", "2 piezas", "2 unidades"
  const unitsMatch = combined.match(/(\d+(?:\.\d+)?)\s*(tab|comp|cáp|cap|amp|sob|parche|got|ml|gr|u\b|piez|fras|dosis|pastill|pildor|unid)/i);
  if (unitsMatch) {
    const qty = parseFloat(unitsMatch[1]);
    if (!isNaN(qty) && qty > 0) return qty;
  }

  // Pattern: "Tomar 2 cada 4 horas", "2 cada 4 horas", "Dosis: 2"
  const startNumberMatch = combined.match(/^(\d+(?:\.\d+)?)\b/);
  if (startNumberMatch) {
    const qty = parseFloat(startNumberMatch[1]);
    // Ignore high numbers that are milligram concentrations like "500 mg", "200 mcg", "100 ui"
    const hasConcentrationUnit = combined.includes("mg") || combined.includes("mcg") || combined.includes("ui") || combined.includes("g") || combined.includes("%");
    if (!isNaN(qty) && qty > 0 && (qty <= 20 || !hasConcentrationUnit)) {
      return qty;
    }
  }

  const perTakeMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:a la vez|por toma|cada toma)/i);
  if (perTakeMatch) {
    const qty = parseFloat(perTakeMatch[1]);
    if (!isNaN(qty) && qty > 0) return qty;
  }

  return 1;
};

/**
 * Calculates doses/takes per day from schedule or frequency string.
 * Examples:
 * - "Cada 4 horas", "c/4h", "c/4 hrs" -> 6 tomas/día (24/4 = 6)
 * - "Cada 6 horas", "c/6h", "c/6 hrs" -> 4 tomas/día (24/6 = 4)
 * - "Cada 8 horas", "c/8h", "c/8 hrs" -> 3 tomas/día (24/8 = 3)
 * - "Cada 12 horas", "c/12h", "c/12 hrs" -> 2 tomas/día (24/12 = 2)
 * - "Cada 24 horas", "1 vez al día", "diario", "c/24h" -> 1 toma/día
 * - "Cada 2 horas", "c/2h" -> 12 tomas/día (24/2 = 12)
 * - "Cada 1 hora", "cada hora" -> 24 tomas/día
 * - "00:00 - 04:00 - 08:00 - 12:00 - 16:00 - 20:00" -> 6 tomas/día
 * - "08:00, 20:00" -> 2 tomas/día
 */
export const calculateDosesPerDay = (freqOrHorario?: string): number => {
  if (!freqOrHorario) return 1;
  const timeSlots = extractTimeSlots(freqOrHorario);
  if (timeSlots.length > 0) return timeSlots.length;

  const lower = freqOrHorario.toLowerCase().trim();

  // Pattern "Cada X minutos" or "c/X min" or "c/Xm" or "X min" or "X minutos"
  const everyMinutesMatch = lower.match(/(?:cada|c\/|\/|q|^)\s*(\d{1,4})\s*(?:min|mins|minuto|minutos|m)\b/i);
  if (everyMinutesMatch) {
    const intervalMins = parseInt(everyMinutesMatch[1], 10);
    if (intervalMins > 0) {
      return Math.max(1, Math.min(96, Math.round((24 * 60) / intervalMins)));
    }
  }

  // Pattern "Cada X horas" or "c/X h" or "c/X hrs" or "c/Xhrs" or "/Xh" or "qXh"
  const everyHoursMatch = lower.match(/(?:cada|c\/|\/|q)\s*(\d{1,2})\s*(?:h|hr|hrs|hora|horas)?/i);
  if (everyHoursMatch) {
    const intervalHours = parseInt(everyHoursMatch[1], 10);
    if (intervalHours > 0 && intervalHours <= 24) {
      return Math.round(24 / intervalHours);
    }
    if (intervalHours === 48) return 0.5;
    if (intervalHours === 72) return 0.33;
  }

  // Standalone "X hrs" or "X horas" (e.g. "8 hrs", "12 horas", "6 hrs")
  const standAloneHoursMatch = lower.match(/^(\d{1,2})\s*(?:h|hr|hrs|horas)$/i);
  if (standAloneHoursMatch) {
    const intervalHours = parseInt(standAloneHoursMatch[1], 10);
    if (intervalHours > 0 && intervalHours <= 24) {
      return Math.round(24 / intervalHours);
    }
  }

  // Pattern "X veces al día" or "X al día" or "X tomas al día" or "X tomas/día"
  const timesPerDayMatch = lower.match(/(\d{1,2})\s*(?:veces|vez|v|tomas?|dosis)\s*(?:al|a el|por|\/)?\s*(?:d[ií]a|diario|jornada)/i);
  if (timesPerDayMatch) {
    const times = parseInt(timesPerDayMatch[1], 10);
    if (times > 0 && times <= 24) return times;
  }

  // Latin abbreviations commonly used in medical charts
  if (/\bq?id\b/i.test(lower) || lower.includes("qid") || lower.includes("4 veces")) return 4;
  if (/\btid\b/i.test(lower) || lower.includes("3 veces") || lower.includes("desayuno, comida y cena") || lower.includes("mañana, tarde y noche")) return 3;
  if (/\bbid\b/i.test(lower) || lower.includes("2 veces") || lower.includes("mañana y noche") || lower.includes("cada 12") || lower.includes("c/12") || lower.includes("12 hr") || lower.includes("12hr") || lower.includes("12 horas") || lower.includes("12h")) return 2;
  if (/\bqd\b/i.test(lower) || lower.includes("1 vez") || lower.includes("diario") || lower.includes("cada día") || lower.includes("cada 24") || lower.includes("c/24") || lower.includes("24 hr") || lower.includes("24hr") || lower.includes("24 horas") || lower.includes("24h") || lower.includes("en ayunas") || lower.includes("por la noche") || lower.includes("al acostarse")) return 1;

  // Specific interval heuristics
  if (lower.includes("cada 1 hora") || lower.includes("cada hora") || lower.includes("c/1h") || lower.includes("1 hr") || lower.includes("1 hora")) return 24;
  if (lower.includes("cada 2") || lower.includes("c/2") || lower.includes("2 hr") || lower.includes("2 horas") || lower.includes("12 veces") || lower.includes("2h")) return 12;
  if (lower.includes("cada 4") || lower.includes("c/4") || lower.includes("4 hr") || lower.includes("4hr") || lower.includes("4 horas") || lower.includes("6 veces") || lower.includes("4h")) return 6;
  if (lower.includes("cada 6") || lower.includes("c/6") || lower.includes("6 hr") || lower.includes("6hr") || lower.includes("6 horas") || lower.includes("4 veces") || lower.includes("6h")) return 4;
  if (lower.includes("cada 8") || lower.includes("c/8") || lower.includes("8 hr") || lower.includes("8hr") || lower.includes("8 horas") || lower.includes("3 veces") || lower.includes("8h")) return 3;

  return 1;
};

export const MEDICATION_PRESENTATIONS = [
  { value: "Tableta", label: "Tableta / Comprimido", unit: "Tabletas" },
  { value: "Cápsula", label: "Cápsula", unit: "Cápsulas" },
  { value: "Ampolleta", label: "Ampolleta / Vial Inyectable", unit: "Ampolletas" },
  { value: "Frasco", label: "Frasco / Solución / Suspensión", unit: "Frascos" },
  { value: "Crema", label: "Crema / Tubo / Pomada / Ungüento", unit: "Tubos" },
  { value: "Gotas", label: "Gotas / Gotero Oftálmico/Ótico", unit: "Frascos" },
  { value: "Parche", label: "Parche Transdérmico", unit: "Parches" },
  { value: "Pieza", label: "Pieza / Unidad / Material", unit: "Piezas" },
  { value: "ml", label: "Mililitros (ml)", unit: "ml" },
  { value: "mg", label: "Miligramos (mg)", unit: "mg" },
  { value: "Sobre", label: "Sobre / Polvo", unit: "Sobres" },
  { value: "Supositorio", label: "Supositorio / Óvulo", unit: "Piezas" },
  { value: "Inhalador", label: "Inhalador / Spray / Aerosol", unit: "Frascos" },
  { value: "Otro", label: "Otro / Personalizado", unit: "Unidades" },
];

export const FREQUENCY_PRESETS = [
  { intervalHours: 24, takesPerDay: 1, label: "Cada 24 horas (1 toma/día)", shortLabel: "c/24h (1x/día)", defaultSchedule: "08:00" },
  { intervalHours: 12, takesPerDay: 2, label: "Cada 12 horas (2 tomas/día)", shortLabel: "c/12h (2x/día)", defaultSchedule: "08:00 - 20:00" },
  { intervalHours: 8, takesPerDay: 3, label: "Cada 8 horas (3 tomas/día)", shortLabel: "c/8h (3x/día)", defaultSchedule: "08:00 - 16:00 - 00:00" },
  { intervalHours: 6, takesPerDay: 4, label: "Cada 6 horas (4 tomas/día)", shortLabel: "c/6h (4x/día)", defaultSchedule: "06:00 - 12:00 - 18:00 - 00:00" },
  { intervalHours: 4, takesPerDay: 6, label: "Cada 4 horas (6 tomas/día)", shortLabel: "c/4h (6x/día)", defaultSchedule: "08:00 - 12:00 - 16:00 - 20:00 - 00:00 - 04:00" },
  { intervalHours: 2, takesPerDay: 12, label: "Cada 2 horas (12 tomas/día)", shortLabel: "c/2h (12x/día)", defaultSchedule: "08:00 - 10:00 - 12:00 - 14:00 - 16:00 - 18:00 - 20:00 - 22:00 - 00:00 - 02:00 - 04:00 - 06:00" },
];

export interface StockCalculationResult {
  hasEndDate: boolean;
  isTreatmentFinished: boolean;
  remainingDaysTreatment: number;
  totalDosesNeededToFinish: number;
  dosesPerDay: number;
  unitsPerDose: number;
  isPRN?: boolean;
  // Explicit Base Variables as requested:
  dosisPorToma: number; // 1. Número de dosis por toma
  vecesAlDia: number; // 2. Frecuencia diaria (veces al día)
  diasTratamiento: number; // 3. Duración del tratamiento en días
  totalMedicamentoRequerido: number; // Fórmula: (dosis por toma) × (veces al día) × (días de tratamiento)
  formulaExplicativa: string; // Desglose legible de la fórmula
  dailyConsumptionUnits: number;
  dailyConsumptionText: string;
  rawDaysOfStock: number;
  daysOfStock: number;
  autonomyFormattedText: string;
  stockExhaustionDateStr: string;
  alertThresholdDays: number;
  isLowStock: boolean;
  suggestedPurchaseQty: number; // For finishing treatment or 1 month resupply
  purchaseReason: string;
  badgeLabel: string;
  badgeColor: string;
}

/**
 * Centralized computation for Medication and Inventory Stock calculations:
 * 1. Base Variables:
 *    - Dosis por toma (unidades por administración)
 *    - Veces al día (frecuencia diaria de tomas)
 *    - Duración del tratamiento en días
 * 2. Formula:
 *    Total Medicamento Requerido = (dosis por toma) × (veces al día) × (días de tratamiento)
 * 3. Calculates daily consumption: (dosisPorToma * vecesAlDia)
 * 4. Calculates autonomy: exact number of treatment days remaining before stock is exhausted
 * 5. Calculates estimated date of stock depletion
 * 6. Compares with Treatment End Date or provides 1-month resupply recommendation
 */
export const calculateStockAndTreatmentStatus = (
  itemOrMed: {
    stockActual?: number;
    dosis?: string;
    presentacion?: string;
    unidadMedida?: string;
    tipoFrecuencia?: 'HorarioFijo' | 'ADemanda';
    indicacionesUsoADemanda?: string;
    dosisPorToma?: number;
    vecesAlDia?: number;
    dosesPerDay?: number;
    frecuencia?: string;
    horario?: string;
    frecuenciaKardex?: string;
    fechaInicioTratamiento?: string;
    fechaFinTratamiento?: string;
    duracionDias?: number;
    duracionDiasTratamiento?: number;
    tipoTratamiento?: 'FinDefinido' | 'Indefinido' | 'ADemanda';
    daysThresholdAlert?: number;
    diasAlertaResurtido?: number;
    customStockMinimo?: number;
    marcadoStockBajoManual?: boolean;
    estado?: string;
  },
  currentStockParam?: number
): StockCalculationResult => {
  const stock = currentStockParam !== undefined ? currentStockParam : (itemOrMed.stockActual || 0);
  const unitLabel = itemOrMed.unidadMedida || (itemOrMed.presentacion ? `${itemOrMed.presentacion}s` : "Tabletas");
  
  const freqCombined = `${itemOrMed.frecuenciaKardex || ''} ${itemOrMed.frecuencia || ''} ${itemOrMed.horario || ''}`.toLowerCase();
  const isADemanda = Boolean(
    itemOrMed.tipoFrecuencia === 'ADemanda' ||
    itemOrMed.tipoTratamiento === 'ADemanda' ||
    freqCombined.includes('demanda') ||
    freqCombined.includes('prn') ||
    freqCombined.includes('sos') ||
    freqCombined.includes('según sea necesario') ||
    freqCombined.includes('segun sea necesario') ||
    freqCombined.includes('en caso de')
  );

  // Variable 1: Dosis por toma (unidades tomadas por evento)
  const dosisPorToma = itemOrMed.dosisPorToma !== undefined && itemOrMed.dosisPorToma > 0
    ? itemOrMed.dosisPorToma
    : parseUnitsPerDose(
        itemOrMed.dosis,
        itemOrMed.frecuenciaKardex || itemOrMed.frecuencia || itemOrMed.horario
      );

  // Variable 2: Frecuencia diaria / Veces al día
  const vecesAlDia = isADemanda
    ? 0
    : (itemOrMed.vecesAlDia !== undefined && itemOrMed.vecesAlDia > 0
        ? itemOrMed.vecesAlDia
        : Math.max(
            1,
            itemOrMed.dosesPerDay ||
            calculateDosesPerDay(itemOrMed.horario || itemOrMed.frecuencia || itemOrMed.frecuenciaKardex)
          ));

  const unitsPerDose = dosisPorToma;
  const dosesPerDay = vecesAlDia;

  const thresholdAlertDays = Math.max(
    1,
    itemOrMed.daysThresholdAlert || itemOrMed.diasAlertaResurtido || 5
  );

  // Special branch: PRN / A DEMANDA (No fixed daily consumption)
  if (isADemanda) {
    const minThreshold = itemOrMed.customStockMinimo !== undefined && itemOrMed.customStockMinimo > 0
      ? itemOrMed.customStockMinimo
      : 2; // Default alert if <= 2 units for PRN
    const isLow = stock <= minThreshold || Boolean(itemOrMed.marcadoStockBajoManual);
    const suggestedQty = isLow ? Math.max(5, (minThreshold * 3) - stock) : 0;
    const autonomyText = stock <= 0
      ? `0 ${unitLabel} (Agotado)`
      : `${stock} ${unitLabel} disponible(s) (A Demanda / PRN)`;

    return {
      hasEndDate: false,
      isTreatmentFinished: itemOrMed.estado === "Completado",
      remainingDaysTreatment: 0,
      totalDosesNeededToFinish: 0,
      dosesPerDay: 0,
      unitsPerDose: dosisPorToma,
      isPRN: true,
      dosisPorToma,
      vecesAlDia: 0,
      diasTratamiento: 0,
      totalMedicamentoRequerido: 0,
      formulaExplicativa: `Uso A Demanda / PRN (Sin horario fijo)`,
      dailyConsumptionUnits: 0,
      dailyConsumptionText: `Uso A Demanda / PRN (según necesidad del paciente)`,
      rawDaysOfStock: stock > 0 ? 999 : 0,
      daysOfStock: stock > 0 ? 999 : 0,
      autonomyFormattedText: autonomyText,
      stockExhaustionDateStr: stock > 0 ? "Según demanda" : "Agotado hoy",
      alertThresholdDays: thresholdAlertDays,
      isLowStock: isLow,
      suggestedPurchaseQty: suggestedQty,
      purchaseReason: isLow
        ? `Insumo/Medicamento a Demanda: Stock bajo (${stock} ${unitLabel}). Resurtir ~${suggestedQty} ${unitLabel} para reserva.`
        : `Insumo/Medicamento a Demanda: Stock suficiente (${stock} ${unitLabel}).`,
      badgeLabel: stock <= 0
        ? `Agotado (A Demanda)`
        : isLow
          ? `Por Comprar (${stock} ${unitLabel} restantes)`
          : `A Demanda (${stock} ${unitLabel})`,
      badgeColor: stock <= 0
        ? "bg-rose-100 text-rose-800 border-rose-200"
        : isLow
          ? "bg-amber-500 text-slate-950 border-amber-600"
          : "bg-teal-100 text-teal-800 border-teal-200",
    };
  }

  // Daily consumption = (dosis por toma) * (veces al día)
  const dailyConsumptionUnits = dosisPorToma * vecesAlDia;
  const dailyConsumptionText = `${dailyConsumptionUnits} ${unitLabel}/día (${vecesAlDia} tomas de ${dosisPorToma > 1 ? `${dosisPorToma} ${unitLabel}` : `1 ${unitLabel}`}/día)`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const fechaFin = itemOrMed.fechaFinTratamiento;
  const isExplicitIndefinite = itemOrMed.tipoTratamiento === 'Indefinido';
  const hasEndDate = Boolean(fechaFin) && !isExplicitIndefinite;

  let isTreatmentFinished = false;
  let remainingDaysTreatment = 0;
  let totalDosesNeededToFinish = 0;

  // Variable 3: Duración del tratamiento en días
  const configuredDurationDays = itemOrMed.duracionDias || itemOrMed.duracionDiasTratamiento || 0;

  if (itemOrMed.estado === "Completado") {
    isTreatmentFinished = true;
  } else if (hasEndDate && fechaFin) {
    if (todayStr > fechaFin) {
      isTreatmentFinished = true;
    } else {
      const parts = fechaFin.split("-").map(Number);
      let endTimestamp = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const diffMs = endTimestamp - today.getTime();
      // +1 to include today's full day of treatment
      remainingDaysTreatment = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
      totalDosesNeededToFinish = Math.ceil(remainingDaysTreatment * dailyConsumptionUnits);
    }
  }

  // Treatment duration to report: remaining days if active defined, else configured or 30 days
  const effectiveTreatmentDays = hasEndDate && remainingDaysTreatment > 0
    ? remainingDaysTreatment
    : (configuredDurationDays > 0 ? configuredDurationDays : 30);

  // Total required medication by formula: (dosis por toma) * (veces al día) * (días)
  const totalMedicamentoRequerido = Math.ceil(dosisPorToma * vecesAlDia * effectiveTreatmentDays);

  const formulaExplicativa = `(${dosisPorToma} ${dosisPorToma === 1 ? 'dosis' : 'dosis'}/toma) × (${vecesAlDia} ${vecesAlDia === 1 ? 'vez' : 'veces'}/día) × (${effectiveTreatmentDays} días) = ${totalMedicamentoRequerido} ${unitLabel}`;

  // Calculate exact days of stock remaining before exhaustion
  const rawDaysOfStock = dailyConsumptionUnits > 0 ? (stock / dailyConsumptionUnits) : 0;
  const daysOfStock = Math.round(rawDaysOfStock * 10) / 10;

  // Build human friendly autonomy description
  let autonomyFormattedText = "";
  if (stock <= 0) {
    autonomyFormattedText = "0 días (Agotado)";
  } else if (rawDaysOfStock < 1) {
    const hours = Math.max(1, Math.round(rawDaysOfStock * 24));
    autonomyFormattedText = `${rawDaysOfStock.toFixed(2)} días (~${hours} horas)`;
  } else if (rawDaysOfStock < 2) {
    const remainder = stock % dailyConsumptionUnits;
    if (remainder > 0) {
      autonomyFormattedText = `${rawDaysOfStock.toFixed(2)} días (1 día y ${remainder} ${unitLabel})`;
    } else {
      autonomyFormattedText = `${rawDaysOfStock.toFixed(1)} día(s)`;
    }
  } else {
    autonomyFormattedText = `${rawDaysOfStock.toFixed(1)} día(s)`;
  }

  // Calculate estimated date when current stock will be exhausted
  const exhaustionDate = new Date();
  exhaustionDate.setTime(Date.now() + rawDaysOfStock * 24 * 60 * 60 * 1000);
  const stockExhaustionDateStr = stock > 0
    ? exhaustionDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Agotado hoy";

  // If treatment already finished -> NEVER ask to buy again
  if (isTreatmentFinished) {
    return {
      hasEndDate: true,
      isTreatmentFinished: true,
      remainingDaysTreatment: 0,
      totalDosesNeededToFinish: 0,
      dosesPerDay: vecesAlDia,
      unitsPerDose: dosisPorToma,
      isPRN: false,
      dosisPorToma,
      vecesAlDia,
      diasTratamiento: 0,
      totalMedicamentoRequerido: 0,
      formulaExplicativa: `Tratamiento concluido (0 días pendientes)`,
      dailyConsumptionUnits,
      dailyConsumptionText,
      rawDaysOfStock,
      daysOfStock,
      autonomyFormattedText,
      stockExhaustionDateStr,
      alertThresholdDays: thresholdAlertDays,
      isLowStock: false,
      suggestedPurchaseQty: 0,
      purchaseReason: "Tratamiento concluido: no requiere compra ni resurtido",
      badgeLabel: "Tratamiento Concluido",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    };
  }

  // Treatment has active end date
  if (hasEndDate && remainingDaysTreatment > 0) {
    // If stock already covers the remaining doses for treatment completion
    if (stock >= totalDosesNeededToFinish) {
      return {
        hasEndDate: true,
        isTreatmentFinished: false,
        remainingDaysTreatment,
        totalDosesNeededToFinish,
        dosesPerDay: vecesAlDia,
        unitsPerDose: dosisPorToma,
        isPRN: false,
        dosisPorToma,
        vecesAlDia,
        diasTratamiento: remainingDaysTreatment,
        totalMedicamentoRequerido: totalDosesNeededToFinish,
        formulaExplicativa,
        dailyConsumptionUnits,
        dailyConsumptionText,
        rawDaysOfStock,
        daysOfStock,
        autonomyFormattedText,
        stockExhaustionDateStr,
        alertThresholdDays: thresholdAlertDays,
        isLowStock: false,
        suggestedPurchaseQty: 0,
        purchaseReason: `Stock suficiente (${stock} ${unitLabel}) para cubrir ${formulaExplicativa}`,
        badgeLabel: `Suficiente para terminar (${remainingDaysTreatment}d)`,
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    }

    // Stock is less than needed to finish treatment
    const missingDoses = totalDosesNeededToFinish - stock;
    const isLow = rawDaysOfStock <= thresholdAlertDays || Boolean(itemOrMed.marcadoStockBajoManual);

    return {
      hasEndDate: true,
      isTreatmentFinished: false,
      remainingDaysTreatment,
      totalDosesNeededToFinish,
      dosesPerDay: vecesAlDia,
      unitsPerDose: dosisPorToma,
      isPRN: false,
      dosisPorToma,
      vecesAlDia,
      diasTratamiento: remainingDaysTreatment,
      totalMedicamentoRequerido: totalDosesNeededToFinish,
      formulaExplicativa,
      dailyConsumptionUnits,
      dailyConsumptionText,
      rawDaysOfStock,
      daysOfStock,
      autonomyFormattedText,
      stockExhaustionDateStr,
      alertThresholdDays: thresholdAlertDays,
      isLowStock: isLow,
      suggestedPurchaseQty: missingDoses,
      purchaseReason: `Faltan ${missingDoses} ${unitLabel} para cubrir el tratamiento completo: ${formulaExplicativa}. Stock actual (${stock} ${unitLabel}) rinde para ${autonomyFormattedText}.`,
      badgeLabel: isLow ? `Por Comprar: Faltan ${missingDoses} para terminar` : `Stock para ${autonomyFormattedText} (Faltan ${missingDoses} fin trat.)`,
      badgeColor: isLow ? "bg-amber-500 text-slate-950 border-amber-600" : "bg-amber-100 text-amber-900 border-amber-300",
    };
  }

  // Indefinite / Chronic treatment -> Resupply for 1 month (30 days)
  const oneMonthDoses = Math.ceil(30 * dailyConsumptionUnits);
  const isLow = itemOrMed.customStockMinimo !== undefined && itemOrMed.customStockMinimo > 0
    ? stock <= itemOrMed.customStockMinimo
    : rawDaysOfStock <= thresholdAlertDays || Boolean(itemOrMed.marcadoStockBajoManual);

  const suggestedQty = Math.max(oneMonthDoses - stock, oneMonthDoses);

  return {
    hasEndDate: false,
    isTreatmentFinished: false,
    remainingDaysTreatment: 30,
    totalDosesNeededToFinish: oneMonthDoses,
    dosesPerDay: vecesAlDia,
    unitsPerDose: dosisPorToma,
    isPRN: false,
    dosisPorToma,
    vecesAlDia,
    diasTratamiento: 30,
    totalMedicamentoRequerido: oneMonthDoses,
    formulaExplicativa: `(${dosisPorToma} dosis/toma) × (${vecesAlDia} tomas/día) × (30 días de resurtido) = ${oneMonthDoses} ${unitLabel}`,
    dailyConsumptionUnits,
    dailyConsumptionText,
    rawDaysOfStock,
    daysOfStock,
    autonomyFormattedText,
    stockExhaustionDateStr,
    alertThresholdDays: thresholdAlertDays,
    isLowStock: isLow,
    suggestedPurchaseQty: suggestedQty,
    purchaseReason: `Tratamiento continuo/indefinido: Resurtir para 1 mes (${dosisPorToma} dosis/toma × ${vecesAlDia} tomas/día × 30 días = ${oneMonthDoses} ${unitLabel}). Stock actual rinde para ${autonomyFormattedText}.`,
    badgeLabel: isLow ? `Por Comprar: Resurtir 1 Mes (${suggestedQty} u.)` : `Stock para ${autonomyFormattedText} (Continuo)`,
    badgeColor: isLow ? "bg-amber-500 text-slate-950 border-amber-600" : "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
};

export type TakeUrgencyType =
  | 'administrado'
  | 'sin_aplicacion'
  | 'vencida'
  | 'inmediata'
  | 'proxima_inminente'
  | 'proxima_cercana'
  | 'futura';

export interface TakeUrgencyResult {
  urgency: TakeUrgencyType;
  urgencyLevel: TakeUrgencyType;
  diffMinutes: number;
  label: string;
  badgeLabel: string;
  closestTakeTime?: string;
  badgeClass: string;
  containerClass: string;
  glowClass: string;
  buttonClass: string;
  tagColor: string;
}

/**
 * Computes live urgency and color illumination for a scheduled intake time:
 * - Green: Dose already marked/given today
 * - Slate/Gray: Explicitly marked as "Sin aplicación" (no ministrado)
 * - Red (Pulsing): Time has passed (> 15 min ago) and dose was NOT registered (Overdue / Pendiente fuera de turno)
 * - Sapphire Blue (Vibrant): Immediate window (±15 min of current time) - Give now!
 * - Sky Blue / Cyan: Approaching imminent (15 - 60 min ahead)
 * - Amber / Yellow: Approaching soon (1 - 3 hours ahead)
 * - Neutral / Slate: Later in the day (> 3 hours ahead)
 */
export const getTakeScheduleUrgency = (
  timeStr: string,
  isGivenToday: boolean,
  now: Date = new Date(),
  isSinAplicacionToday: boolean = false
): TakeUrgencyResult => {
  if (isSinAplicacionToday) {
    return {
      urgency: 'sin_aplicacion',
      urgencyLevel: 'sin_aplicacion',
      diffMinutes: 0,
      label: '⚠️ Sin Aplicación (No Ministrado)',
      badgeLabel: '⚠️ Sin Aplicación (No Ministrado)',
      closestTakeTime: timeStr,
      badgeClass: 'bg-slate-700 text-white font-bold',
      containerClass: 'bg-slate-50/95 border-slate-300 ring-1 ring-slate-200 opacity-90',
      glowClass: 'border-l-4 border-l-slate-600',
      buttonClass: 'bg-slate-600 hover:bg-slate-700 text-white ring-1 ring-slate-300',
      tagColor: 'slate',
    };
  }

  if (isGivenToday) {
    return {
      urgency: 'administrado',
      urgencyLevel: 'administrado',
      diffMinutes: 0,
      label: '✓ Dosis Aplicada Hoy',
      badgeLabel: '✓ Dosis Aplicada Hoy',
      closestTakeTime: timeStr,
      badgeClass: 'bg-emerald-600 text-white font-bold',
      containerClass: 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/20',
      glowClass: 'border-l-4 border-l-emerald-600',
      buttonClass: 'bg-emerald-700 hover:bg-emerald-800 text-white ring-2 ring-emerald-300',
      tagColor: 'emerald',
    };
  }

  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return {
      urgency: 'futura',
      urgencyLevel: 'futura',
      diffMinutes: 999,
      label: `Programada (${timeStr})`,
      badgeLabel: `Programada (${timeStr})`,
      closestTakeTime: timeStr,
      badgeClass: 'bg-slate-200 text-slate-700',
      containerClass: 'bg-white border-slate-200',
      glowClass: '',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      tagColor: 'slate',
    };
  }

  const slotH = parseInt(match[1], 10);
  const slotM = parseInt(match[2], 10);
  const nowH = now.getHours();
  const nowM = now.getMinutes();

  const slotMinutes = slotH * 60 + slotM;
  const nowMinutes = nowH * 60 + nowM;
  const diffMinutes = slotMinutes - nowMinutes; // > 0: future, < 0: past

  // 1. OVERDUE: Time passed by more than 15 minutes and NOT marked
  if (diffMinutes < -15) {
    const elapsedMins = Math.abs(diffMinutes);
    const elapsedHrs = Math.floor(elapsedMins / 60);
    const remainderMins = elapsedMins % 60;
    const timePastStr = elapsedHrs > 0 ? `${elapsedHrs}h ${remainderMins}m` : `${elapsedMins} min`;

    return {
      urgency: 'vencida',
      urgencyLevel: 'vencida',
      diffMinutes,
      label: `🚨 HORA VENCIDA / TOMA ATRASADA (Hace ${timePastStr})`,
      badgeLabel: `🚨 Hora Vencida (Hace ${timePastStr})`,
      closestTakeTime: timeStr,
      badgeClass: 'bg-rose-600 text-white font-black animate-pulse shadow-md',
      containerClass: 'bg-rose-50/95 border-rose-500 ring-4 ring-rose-400/30 shadow-md',
      glowClass: 'border-l-4 border-l-rose-600 bg-rose-50/60 ring-2 ring-rose-400/30',
      buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white font-black animate-bounce shadow-md ring-2 ring-rose-300',
      tagColor: 'rose',
    };
  }

  // 2. IMMEDIATE WINDOW: ±15 minutes around the scheduled time
  if (diffMinutes >= -15 && diffMinutes <= 15) {
    return {
      urgency: 'inmediata',
      urgencyLevel: 'inmediata',
      diffMinutes,
      label: '⚡ HORA DE TOMA INMEDIATA (Aplicar Ahora)',
      badgeLabel: '⚡ Hora de Toma Inmediata',
      closestTakeTime: timeStr,
      badgeClass: 'bg-blue-600 text-white font-black shadow-md animate-pulse',
      containerClass: 'bg-blue-50/95 border-blue-500 ring-4 ring-blue-400/40 shadow-md',
      glowClass: 'border-l-4 border-l-blue-600 bg-blue-50/50 ring-2 ring-blue-400/30',
      buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md ring-2 ring-blue-300',
      tagColor: 'blue',
    };
  }

  // 3. IMMINENT APPROACH: 15 to 60 minutes ahead
  if (diffMinutes > 15 && diffMinutes <= 60) {
    return {
      urgency: 'proxima_inminente',
      urgencyLevel: 'proxima_inminente',
      diffMinutes,
      label: `⏱️ Próxima toma en ${diffMinutes} min (Preparar)`,
      badgeLabel: `⏱️ Toma en ${diffMinutes} min`,
      closestTakeTime: timeStr,
      badgeClass: 'bg-sky-600 text-white font-bold shadow-xs',
      containerClass: 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-300/30',
      glowClass: 'border-l-4 border-l-sky-500 ring-1 ring-sky-300/30',
      buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white font-bold',
      tagColor: 'sky',
    };
  }

  // 4. CLOSE APPROACH: 1 to 3 hours ahead (Amber / Yellow warm glow)
  if (diffMinutes > 60 && diffMinutes <= 180) {
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const timeRemainingStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

    return {
      urgency: 'proxima_cercana',
      urgencyLevel: 'proxima_cercana',
      diffMinutes,
      label: `⏳ Toma programada en ${timeRemainingStr}`,
      badgeLabel: `⏳ Toma en ${timeRemainingStr}`,
      closestTakeTime: timeStr,
      badgeClass: 'bg-amber-500 text-slate-950 font-black shadow-xs',
      containerClass: 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/30',
      glowClass: 'border-l-4 border-l-amber-500 ring-1 ring-amber-200',
      buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white font-bold',
      tagColor: 'amber',
    };
  }

  // 5. FUTURE: More than 3 hours ahead
  return {
    urgency: 'futura',
    urgencyLevel: 'futura',
    diffMinutes,
    label: `🕒 Toma de las ${timeStr} hrs`,
    badgeLabel: `🕒 Toma ${timeStr} hrs`,
    closestTakeTime: timeStr,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200 font-bold',
    containerClass: 'bg-white border-slate-200 hover:border-slate-300',
    glowClass: 'border-l-4 border-l-slate-300',
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    tagColor: 'slate',
  };
};

/**
 * Computes overall urgency status across all schedule slots of a medication
 */
export const getMedicationOverallUrgency = (
  med: KardexMedication,
  isGivenToday: boolean,
  now: Date = new Date()
): TakeUrgencyResult => {
  if (med.estado === "Completado" || med.estado === "Suspendido") {
    return {
      urgency: 'futura',
      urgencyLevel: 'futura',
      diffMinutes: 9999,
      label: med.estado === "Completado" ? 'Tratamiento Concluido' : 'Medicamento Suspendido',
      badgeLabel: med.estado === "Completado" ? 'Tratamiento Concluido' : 'Medicamento Suspendido',
      closestTakeTime: '',
      badgeClass: 'bg-slate-200 text-slate-700 font-bold',
      containerClass: 'bg-slate-50/80 border-slate-200 opacity-80',
      glowClass: '',
      buttonClass: 'bg-slate-600 text-white',
      tagColor: 'slate',
    };
  }

  const slots = extractTimeSlots(med.horario);
  if (slots.length === 0) {
    if (isGivenToday) {
      return getTakeScheduleUrgency("00:00", true, now);
    }
    return {
      urgency: 'futura',
      urgencyLevel: 'futura',
      diffMinutes: 9999,
      label: med.horario || 'Horario flexible',
      badgeLabel: med.horario || 'Horario flexible',
      closestTakeTime: '',
      badgeClass: 'bg-slate-100 text-slate-700',
      containerClass: 'bg-white border-slate-200',
      glowClass: '',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      tagColor: 'slate',
    };
  }

  const results = slots.map((slot) => {
    const isSlotGiven = isSlotAdministeredToday(med, slot);
    const isSlotSinApp = isSlotSinAplicacionToday(med, slot);
    return getTakeScheduleUrgency(slot, isSlotGiven, now, isSlotSinApp);
  });

  // Priority order: vencida (red) > inmediata (blue) > proxima_inminente (sky) > proxima_cercana (amber) > pending futura > sin_aplicacion > all administrado (green)
  const overdue = results.find((r) => r.urgency === 'vencida');
  if (overdue) return overdue;

  const immediate = results.find((r) => r.urgency === 'inmediata');
  if (immediate) return immediate;

  const imminent = results.find((r) => r.urgency === 'proxima_inminente');
  if (imminent) return imminent;

  const close = results.find((r) => r.urgency === 'proxima_cercana');
  if (close) return close;

  const pendingFutura = results.find((r) => r.urgency === 'futura');
  if (pendingFutura) return pendingFutura;

  const allProcessed = results.every((r) => r.urgency === 'administrado' || r.urgency === 'sin_aplicacion');
  if (allProcessed && results.length > 0) {
    return results[0];
  }

  return results[0] || getTakeScheduleUrgency("00:00", false, now);
};
