/**
 * Evaluador Clínico de Constantes y Signos Vitales
 * Basado en Guías Oficiales PALS (Pediatric Advanced Life Support), OMS y CENETEC
 * Segmentación estricta por grupo etario del Receptor de Servicio.
 */

export type VitalAgeGroup =
  | "recien_nacido" // 0–28 días
  | "lactante" // 1–12 meses
  | "preescolar" // 1–5 años
  | "escolar" // 6–12 años
  | "adolescente" // 12–18 años
  | "adulto" // 18–59 años
  | "adulto_mayor"; // >= 60 años

export type VitalStatusLevel = "normal" | "warning" | "danger" | "emergency";

export interface VitalEvaluation {
  label: string; // e.g. "Normal", "Óptimo", "Hipotensión", "Crisis Hipertensiva", etc.
  status: VitalStatusLevel;
  textColor: string;
  badgeClass: string;
  referenceRange: string;
  isEmergency?: boolean;
  shortNote?: string;
}

export interface AgeParsedInfo {
  group: VitalAgeGroup;
  groupLabel: string;
  ageYears: number;
  ageMonths: number;
  ageDays: number;
  rawText: string;
}

/**
 * Parsea el texto o número de edad registrado en el Cliente / Carátula / Expediente
 * detectando si son días, meses o años y asignando el grupo etario correspondiente.
 */
export function parseAgeGroup(rawEdad?: string | number | null): AgeParsedInfo {
  if (rawEdad === undefined || rawEdad === null || String(rawEdad).trim() === "") {
    return {
      group: "adulto",
      groupLabel: "Adulto (18–59 a)",
      ageYears: 35,
      ageMonths: 420,
      ageDays: 12775,
      rawText: "Adulto (Estándar)",
    };
  }

  const str = String(rawEdad).toLowerCase().trim();

  // Búsqueda por palabras clave clínicas directas
  if (str.includes("neonato") || str.includes("recien nacido") || str.includes("rn") || str.includes("reciente")) {
    return { group: "recien_nacido", groupLabel: "Recién Nacido (0–28 d)", ageYears: 0.05, ageMonths: 0.5, ageDays: 15, rawText: str };
  }
  if (str.includes("lactante") || str.includes("bebe") || str.includes("bebé")) {
    return { group: "lactante", groupLabel: "Lactante (1–12 m)", ageYears: 0.5, ageMonths: 6, ageDays: 180, rawText: str };
  }
  if (str.includes("preescolar")) {
    return { group: "preescolar", groupLabel: "Preescolar (1–5 a)", ageYears: 3, ageMonths: 36, ageDays: 1095, rawText: str };
  }
  if (str.includes("escolar")) {
    return { group: "escolar", groupLabel: "Escolar (6–12 a)", ageYears: 8, ageMonths: 96, ageDays: 2920, rawText: str };
  }
  if (str.includes("adolescente") || str.includes("teen")) {
    return { group: "adolescente", groupLabel: "Adolescente (12–18 a)", ageYears: 15, ageMonths: 180, ageDays: 5475, rawText: str };
  }
  if (str.includes("geriatrico") || str.includes("geriátrico") || str.includes("tercera edad") || str.includes("anciano") || str.includes("adulto mayor")) {
    return { group: "adulto_mayor", groupLabel: "Adulto Mayor (≥ 60 a)", ageYears: 70, ageMonths: 840, ageDays: 25550, rawText: str };
  }

  // Comprobar días
  const daysMatch = str.match(/(\d+)\s*(dia|dias|día|días|d)/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    if (days <= 28) {
      return { group: "recien_nacido", groupLabel: "Recién Nacido (0–28 d)", ageYears: days / 365, ageMonths: days / 30, ageDays: days, rawText: str };
    } else if (days <= 365) {
      return { group: "lactante", groupLabel: "Lactante (1–12 m)", ageYears: days / 365, ageMonths: Math.round(days / 30), ageDays: days, rawText: str };
    }
  }

  // Comprobar semanas
  const weeksMatch = str.match(/(\d+)\s*(sem|semana|semanas)/i);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1], 10);
    const days = weeks * 7;
    if (days <= 28) {
      return { group: "recien_nacido", groupLabel: "Recién Nacido (0–28 d)", ageYears: days / 365, ageMonths: days / 30, ageDays: days, rawText: str };
    } else if (days <= 365) {
      return { group: "lactante", groupLabel: "Lactante (1–12 m)", ageYears: days / 365, ageMonths: Math.round(days / 30), ageDays: days, rawText: str };
    }
  }

  // Comprobar meses
  const monthsMatch = str.match(/(\d+)\s*(mes|meses|m)/i);
  if (monthsMatch) {
    const months = parseInt(monthsMatch[1], 10);
    if (months < 1) {
      return { group: "recien_nacido", groupLabel: "Recién Nacido (0–28 d)", ageYears: months / 12, ageMonths: months, ageDays: months * 30, rawText: str };
    } else if (months <= 12) {
      return { group: "lactante", groupLabel: "Lactante (1–12 m)", ageYears: months / 12, ageMonths: months, ageDays: months * 30, rawText: str };
    } else if (months <= 60) {
      const y = Math.floor(months / 12);
      return { group: "preescolar", groupLabel: "Preescolar (1–5 a)", ageYears: y, ageMonths: months, ageDays: months * 30, rawText: str };
    }
  }

  // Extracción de número base de años
  const numberMatch = str.match(/(\d+(\.\d+)?)/);
  if (numberMatch) {
    const val = parseFloat(numberMatch[1]);
    if (val < 1) {
      return { group: "recien_nacido", groupLabel: "Recién Nacido (0–28 d)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    } else if (val >= 1 && val < 6) {
      return { group: "preescolar", groupLabel: "Preescolar (1–5 a)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    } else if (val >= 6 && val < 12) {
      return { group: "escolar", groupLabel: "Escolar (6–12 a)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    } else if (val >= 12 && val < 18) {
      return { group: "adolescente", groupLabel: "Adolescente (12–18 a)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    } else if (val >= 18 && val < 60) {
      return { group: "adulto", groupLabel: "Adulto (18–59 a)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    } else if (val >= 60) {
      return { group: "adulto_mayor", groupLabel: "Adulto Mayor (≥ 60 a)", ageYears: val, ageMonths: val * 12, ageDays: val * 365, rawText: str };
    }
  }

  return {
    group: "adulto",
    groupLabel: "Adulto (18–59 a)",
    ageYears: 35,
    ageMonths: 420,
    ageDays: 12775,
    rawText: str,
  };
}

/**
 * 1. EVALUACIÓN DE PRESIÓN ARTERIAL (mmHg)
 */
export function evaluatePresionArterial(
  pa?: string | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (!pa || pa.trim() === "" || pa === "-") {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "Variable x edad",
    };
  }

  const { group, ageYears } = parseAgeGroup(rawEdad);
  const parts = pa.replace(/[^\d/]/g, "").split("/");
  const sys = parseInt(parts[0], 10);
  const dia = parts[1] ? parseInt(parts[1], 10) : undefined;

  if (isNaN(sys)) {
    return {
      label: "Formato inválido",
      status: "warning",
      textColor: "text-slate-500",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      referenceRange: "Ej. 120/80",
    };
  }

  switch (group) {
    case "recien_nacido": {
      // Normal: 60–90 / 30–60
      // Hipotensión: Sistólica < 60
      // Hipertensión: Sistólica > 90
      // Emergencia: Sistólica < 50 (Shock) o > 100 con síntomas
      if (sys < 50 || sys > 100) {
        return {
          label: sys < 50 ? "Shock Hipotensivo (Emergencia)" : "Hipertensión Severa RN",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "60–90 / 30–60",
          shortNote: "PALS: Shock sistólica < 50 o > 100",
        };
      }
      if (sys < 60) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "60–90 / 30–60",
        };
      }
      if (sys > 90 || (dia !== undefined && dia > 60)) {
        return {
          label: "Hipertensión",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "60–90 / 30–60",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "60–90 / 30–60",
      };
    }

    case "lactante": {
      // Normal: 80–100 / 55–65
      // Hipotensión: Sistólica < 70
      // Hipertensión: Sistólica > 105
      // Emergencia: Sistólica < 60 (Shock) o > 120 sostenida
      if (sys < 60 || sys > 120) {
        return {
          label: sys < 60 ? "Shock Hipotensivo (Emergencia)" : "Emergencia Hipertensiva",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "80–100 / 55–65",
          shortNote: "PALS: Shock sistólica < 60 o > 120",
        };
      }
      if (sys < 70) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "80–100 / 55–65",
        };
      }
      if (sys > 105 || (dia !== undefined && dia > 65)) {
        return {
          label: "Hipertensión",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "80–100 / 55–65",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "80–100 / 55–65",
      };
    }

    case "preescolar": {
      // Normal: 90–110 / 55–70
      // PALS Hipotensión: < 70 + (2 x edad)
      // Hipertensión: > 115
      // Emergencia: Sistólica < 70 (Hipoperfusión) o > 125
      const palsMinSys = 70 + 2 * Math.max(1, Math.min(5, ageYears));
      if (sys < 70 || sys > 125) {
        return {
          label: sys < 70 ? "Hipoperfusión (Emergencia)" : "Emergencia Hipertensiva",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "90–110 / 55–70",
          shortNote: `PALS: Sistólica < 70 o > 125`,
        };
      }
      if (sys < palsMinSys) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "90–110 / 55–70",
          shortNote: `PALS mínimo: ${palsMinSys} mmHg`,
        };
      }
      if (sys > 115 || (dia !== undefined && dia > 70)) {
        return {
          label: "Hipertensión",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "90–110 / 55–70",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "90–110 / 55–70",
      };
    }

    case "escolar": {
      // Normal: 95–115 / 60–75
      // PALS Hipotensión: < 70 + (2 x edad)
      // Hipertensión: > 120
      // Emergencia: Sistólica < 80 o > 135/90
      const palsMinSys = 70 + 2 * Math.max(6, Math.min(12, ageYears));
      if (sys < 80 || sys > 135 || (dia !== undefined && dia > 90)) {
        return {
          label: sys < 80 ? "Shock Hipotensivo (Emergencia)" : "Crisis Hipertensiva",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "95–115 / 60–75",
        };
      }
      if (sys < palsMinSys) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "95–115 / 60–75",
          shortNote: `PALS mínimo: ${palsMinSys} mmHg`,
        };
      }
      if (sys > 120 || (dia !== undefined && dia > 75)) {
        return {
          label: "Hipertensión",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "95–115 / 60–75",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "95–115 / 60–75",
      };
    }

    case "adolescente": {
      // Normal: 100–120 / 65–80
      // Hipotensión: < 90
      // Hipertensión: >= 130/80
      // Emergencia: >= 160/100 o Sistólica < 80
      if (sys >= 160 || (dia !== undefined && dia >= 100) || sys < 80) {
        return {
          label: sys < 80 ? "Shock Hipotensivo (Emergencia)" : "Crisis Hipertensiva (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "100–120 / 65–80",
        };
      }
      if (sys < 90 || (dia !== undefined && dia < 60)) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "100–120 / 65–80",
        };
      }
      if (sys >= 130 || (dia !== undefined && dia >= 80)) {
        return {
          label: "Hipertensión",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "100–120 / 65–80",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "100–120 / 65–80",
      };
    }

    case "adulto": {
      // Normal: < 120 / < 80
      // Hipotensión: < 90/60
      // Hipertensión: >= 140/90 (120-139 / 80-89 Limítrofe)
      // Emergencia: Crisis >= 180/120 o Sistólica < 80 con shock
      if (sys >= 180 || (dia !== undefined && dia >= 120) || sys < 80) {
        return {
          label: sys < 80 ? "Shock Hipotensivo (Emergencia)" : "Crisis Hipertensiva (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "< 120 / < 80",
        };
      }
      if (sys < 90 || (dia !== undefined && dia < 60)) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "< 120 / < 80",
        };
      }
      if (sys >= 140 || (dia !== undefined && dia >= 90)) {
        return {
          label: "Hipertensión",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "< 120 / < 80",
        };
      }
      if (sys >= 120 || (dia !== undefined && dia >= 80)) {
        return {
          label: "Limítrofe / Pre-HTA",
          status: "warning",
          textColor: "text-amber-700 font-semibold",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
          referenceRange: "< 120 / < 80",
        };
      }
      return {
        label: "Óptimo / Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "< 120 / < 80",
      };
    }

    case "adulto_mayor":
    default: {
      // Normal: 120–139 / 70–89
      // Hipotensión: < 90/60
      // Hipertensión: >= 140/90
      // Emergencia: Crisis >= 180/120 o Sistólica < 80
      if (sys >= 180 || (dia !== undefined && dia >= 120) || sys < 80) {
        return {
          label: sys < 80 ? "Shock Hipotensivo (Emergencia)" : "Crisis Hipertensiva (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "120–139 / 70–89",
        };
      }
      if (sys < 90 || (dia !== undefined && dia < 60)) {
        return {
          label: "Hipotensión",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "120–139 / 70–89",
        };
      }
      if (sys >= 140 || (dia !== undefined && dia >= 90)) {
        return {
          label: "Hipertensión",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "120–139 / 70–89",
        };
      }
      if (sys < 120 || (dia !== undefined && dia < 70)) {
        return {
          label: "Normal Baja",
          status: "normal",
          textColor: "text-emerald-700 font-medium",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
          referenceRange: "120–139 / 70–89",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "120–139 / 70–89",
      };
    }
  }
}

/**
 * 2. EVALUACIÓN DE FRECUENCIA CARDÍACA (lpm)
 */
export function evaluateFrecuenciaCardiaca(
  fc?: number | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (fc === undefined || fc === null || fc <= 0 || isNaN(fc)) {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "Variable x edad",
    };
  }

  const { group } = parseAgeGroup(rawEdad);

  switch (group) {
    case "recien_nacido": {
      // Normal: 120–160
      // Bradicardia: < 100
      // Taquicardia: > 180
      // Emergencia: < 60 (Iniciar RCP neonatal) o > 220
      if (fc < 60) {
        return {
          label: "Bradicardia Crítica (Iniciar RCP)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "120–160 lpm",
        };
      }
      if (fc > 220) {
        return {
          label: "Taquicardia Severa (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "120–160 lpm",
        };
      }
      if (fc < 100) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "120–160 lpm",
        };
      }
      if (fc > 180) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "120–160 lpm",
        };
      }
      if (fc < 120 || fc > 160) {
        return {
          label: "Aceptable",
          status: "normal",
          textColor: "text-emerald-700 font-medium",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
          referenceRange: "120–160 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "120–160 lpm",
      };
    }

    case "lactante": {
      // Normal: 100–140
      // Bradicardia: < 90
      // Taquicardia: > 160
      // Emergencia: < 60 con mala perfusión (RCP) o > 200 (TPSV)
      if (fc < 60 || fc > 200) {
        return {
          label: fc < 60 ? "Bradicardia Severa (RCP)" : "Taquicardia Extrema (>200 TPSV)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "100–140 lpm",
        };
      }
      if (fc < 90) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "100–140 lpm",
        };
      }
      if (fc > 160) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "100–140 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "100–140 lpm",
      };
    }

    case "preescolar": {
      // Normal: 80–120
      // Bradicardia: < 70
      // Taquicardia: > 140
      // Emergencia: < 60 con compromiso o > 180
      if (fc < 60 || fc > 180) {
        return {
          label: fc < 60 ? "Bradicardia Severa (Emergencia)" : "Taquicardia Severa (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "80–120 lpm",
        };
      }
      if (fc < 70) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "80–120 lpm",
        };
      }
      if (fc > 140) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "80–120 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "80–120 lpm",
      };
    }

    case "escolar": {
      // Normal: 75–110
      // Bradicardia: < 60
      // Taquicardia: > 120
      // Emergencia: < 50 con mareo o > 160
      if (fc < 50 || fc > 160) {
        return {
          label: fc < 50 ? "Bradicardia Severa (Emergencia)" : "Taquicardia Severa (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "75–110 lpm",
        };
      }
      if (fc < 60) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "75–110 lpm",
        };
      }
      if (fc > 120) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "75–110 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "75–110 lpm",
      };
    }

    case "adolescente": {
      // Normal: 60–100
      // Bradicardia: < 50
      // Taquicardia: > 105
      // Emergencia: < 45 sintomática o > 150
      if (fc < 45 || fc > 150) {
        return {
          label: fc < 45 ? "Bradicardia Crítica (Emergencia)" : "Taquicardia Extrema (Emergencia)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "60–100 lpm",
        };
      }
      if (fc < 50) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "60–100 lpm",
        };
      }
      if (fc > 105) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "60–100 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "60–100 lpm",
      };
    }

    case "adulto": {
      // Normal: 60–100
      // Bradicardia: < 60
      // Taquicardia: > 100
      // Emergencia: < 40 o > 150 con compromiso circulatorio
      if (fc < 40 || fc > 150) {
        return {
          label: fc < 40 ? "Bradicardia Severa (<40 lpm)" : "Taquicardia Extrema (>150 lpm)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "60–100 lpm",
        };
      }
      if (fc < 60) {
        return {
          label: "Bradicardia",
          status: "warning",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "60–100 lpm",
        };
      }
      if (fc > 100) {
        return {
          label: "Taquicardia",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "60–100 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "60–100 lpm",
      };
    }

    case "adulto_mayor":
    default: {
      // Normal: 60–90
      // Bradicardia: < 50
      // Taquicardia: > 100
      // Emergencia: < 40 (bloqueo) o fibrilación rápida > 130
      if (fc < 40 || fc > 130) {
        return {
          label: fc < 40 ? "Bradicardia Crítica / Bloqueo" : "Taquicardia / FA Rápida (>130)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "60–90 lpm",
        };
      }
      if (fc < 50) {
        return {
          label: "Bradicardia",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "60–90 lpm",
        };
      }
      if (fc > 100) {
        return {
          label: "Taquicardia",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "60–90 lpm",
        };
      }
      if (fc > 90) {
        return {
          label: "Límite Alto",
          status: "warning",
          textColor: "text-amber-700 font-medium",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
          referenceRange: "60–90 lpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "60–90 lpm",
      };
    }
  }
}

/**
 * 3. EVALUACIÓN DE FRECUENCIA RESPIRATORIA (rpm)
 */
export function evaluateFrecuenciaRespiratoria(
  fr?: number | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (fr === undefined || fr === null || fr <= 0 || isNaN(fr)) {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "Variable x edad",
    };
  }

  const { group } = parseAgeGroup(rawEdad);

  switch (group) {
    case "recien_nacido": {
      // Normal: 40–60
      // Bradipnea: < 30
      // Taquipnea: > 60
      // Emergencia: < 20 (Paro inminente/Apnea) o > 80 con quejido
      if (fr < 20 || fr > 80) {
        return {
          label: fr < 20 ? "Apnea / Paro Inminente" : "Dificultad Respiratoria Severa (>80)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "40–60 rpm",
        };
      }
      if (fr < 30) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "40–60 rpm",
        };
      }
      if (fr > 60) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "40–60 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "40–60 rpm",
      };
    }

    case "lactante": {
      // Normal: 30–40
      // Bradipnea: < 24
      // Taquipnea: > 50
      // Emergencia: < 20 o > 60 con tiraje
      if (fr < 20 || fr > 60) {
        return {
          label: fr < 20 ? "Insuficiencia Respiratoria (<20)" : "Taquipnea Severa / Tiraje (>60)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "30–40 rpm",
        };
      }
      if (fr < 24) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "30–40 rpm",
        };
      }
      if (fr > 50) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "30–40 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "30–40 rpm",
      };
    }

    case "preescolar": {
      // Normal: 20–30
      // Bradipnea: < 16
      // Taquipnea: > 35
      // Emergencia: < 12 o > 45 con aleteo
      if (fr < 12 || fr > 45) {
        return {
          label: fr < 12 ? "Depresión Respiratoria (<12)" : "Distrés Respiratorio Severo (>45)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "20–30 rpm",
        };
      }
      if (fr < 16) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "20–30 rpm",
        };
      }
      if (fr > 35) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "20–30 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "20–30 rpm",
      };
    }

    case "escolar": {
      // Normal: 18–25
      // Bradipnea: < 14
      // Taquipnea: > 30
      // Emergencia: < 10 o > 40
      if (fr < 10 || fr > 40) {
        return {
          label: fr < 10 ? "Depresión Respiratoria (<10)" : "Distrés Respiratorio Severo (>40)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "18–25 rpm",
        };
      }
      if (fr < 14) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "18–25 rpm",
        };
      }
      if (fr > 30) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "18–25 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "18–25 rpm",
      };
    }

    case "adolescente": {
      // Normal: 12–20
      // Bradipnea: < 12
      // Taquipnea: > 22
      // Emergencia: < 8 o > 35 con agotamiento
      if (fr < 8 || fr > 35) {
        return {
          label: fr < 8 ? "Paro / Apnea Inminente" : "Agotamiento Respiratorio (>35)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "12–20 rpm",
        };
      }
      if (fr < 12) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "12–20 rpm",
        };
      }
      if (fr > 22) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "12–20 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "12–20 rpm",
      };
    }

    case "adulto": {
      // Normal: 12–20
      // Bradipnea: < 12
      // Taquipnea: > 20
      // Emergencia: < 8 (Paro respiratorio) o > 30 sostenida
      if (fr < 8 || fr > 30) {
        return {
          label: fr < 8 ? "Paro Respiratorio Inminente" : "Taquipnea Severa / Agotamiento (>30)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "12–20 rpm",
        };
      }
      if (fr < 12) {
        return {
          label: "Bradipnea",
          status: "warning",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "12–20 rpm",
        };
      }
      if (fr > 20) {
        return {
          label: "Taquipnea",
          status: "warning",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "12–20 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "12–20 rpm",
      };
    }

    case "adulto_mayor":
    default: {
      // Normal: 12–22
      // Bradipnea: < 10
      // Taquipnea: > 24
      // Emergencia: < 8 o > 28 con desorientación
      if (fr < 8 || fr > 28) {
        return {
          label: fr < 8 ? "Paro Respiratorio Inminente" : "Distrés / Acidosis Severa (>28)",
          status: "emergency",
          isEmergency: true,
          textColor: "text-red-700 font-black",
          badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
          referenceRange: "12–22 rpm",
        };
      }
      if (fr < 10) {
        return {
          label: "Bradipnea",
          status: "danger",
          textColor: "text-amber-700 font-bold",
          badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
          referenceRange: "12–22 rpm",
        };
      }
      if (fr > 24) {
        return {
          label: "Taquipnea",
          status: "danger",
          textColor: "text-rose-700 font-bold",
          badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
          referenceRange: "12–22 rpm",
        };
      }
      return {
        label: "Normal",
        status: "normal",
        textColor: "text-emerald-700 font-bold",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        referenceRange: "12–22 rpm",
      };
    }
  }
}

/**
 * 4. EVALUACIÓN DE GLUCOSA CAPILAR (mg/dL)
 * Ajustada a advertencias clínicas no diagnósticas ("Verificar Glucosa Alta / Baja")
 * considerando factores multivariables: ingesta reciente de alimentos, tipo de comida,
 * horas de ayuno y administración de medicamentos/insulina.
 */
export function evaluateGlucosa(
  glu?: number | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (glu === undefined || glu === null || glu <= 0 || isNaN(glu)) {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "70–140 mg/dL (Varía x alimentos)",
      shortNote: "Depende de ingesta reciente de alimentos y ayuno",
    };
  }

  const { group } = parseAgeGroup(rawEdad);

  if (group === "recien_nacido") {
    // Neonato (0-28 días)
    if (glu < 40) {
      return {
        label: "Verificar Glucosa Muy Baja (Urgente)",
        status: "emergency",
        isEmergency: true,
        textColor: "text-red-700 font-black",
        badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
        referenceRange: "45–90 mg/dL (RN)",
        shortNote: "Verificar toma reciente de leche/fórmula. Valorar hipoglucemia neonatal.",
      };
    }
    if (glu < 45) {
      return {
        label: "Verificar Glucosa Baja",
        status: "danger",
        textColor: "text-amber-700 font-bold",
        badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
        referenceRange: "45–90 mg/dL (RN)",
        shortNote: "Verificar horario de alimentación.",
      };
    }
    if (glu > 150) {
      return {
        label: "Verificar Glucosa Muy Alta",
        status: "danger",
        textColor: "text-rose-700 font-bold",
        badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
        referenceRange: "45–90 mg/dL (RN)",
        shortNote: "Verificar aporte calórico o soluciones parenterales.",
      };
    }
    if (glu > 100) {
      return {
        label: "Verificar Glucosa Alta",
        status: "warning",
        textColor: "text-amber-700 font-medium",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        referenceRange: "45–90 mg/dL (RN)",
        shortNote: "Verificar si la toma fue inmediatamente posterior a la alimentación.",
      };
    }
    return {
      label: "Normal / Aceptable",
      status: "normal",
      textColor: "text-emerald-700 font-bold",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      referenceRange: "45–90 mg/dL (RN)",
      shortNote: "Nivel adecuado para recién nacido.",
    };
  }

  // Lactante, Preescolar, Escolar, Adolescente, Adulto, Adulto Mayor
  // Se alerta de verificar alta o baja considerando que el valor varía ampliamente por alimentos (postprandial vs ayuno)
  if (glu < 54) {
    return {
      label: "Verificar Glucosa Muy Baja (Urgente)",
      status: "emergency",
      isEmergency: true,
      textColor: "text-red-700 font-black",
      badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
      referenceRange: "70–140 mg/dL (Varía x alimentos)",
      shortNote: "Verificar ayuno prolongado, dosis de insulina/medicamentos y síntomas.",
    };
  }

  if (glu < 70) {
    return {
      label: "Verificar Glucosa Baja",
      status: "danger",
      textColor: "text-amber-700 font-bold",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      referenceRange: "70–140 mg/dL (Varía x alimentos)",
      shortNote: "Verificar tiempo desde la última comida y toma de hipoglucemiantes.",
    };
  }

  if (glu > 250) {
    return {
      label: "Verificar Glucosa Muy Alta (Urgente)",
      status: "emergency",
      isEmergency: true,
      textColor: "text-red-700 font-black",
      badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
      referenceRange: "70–140 mg/dL (Varía x alimentos)",
      shortNote: "Verificar ingesta reciente de carbohidratos/azúcares y esquema de medicación.",
    };
  }

  if (glu > 140) {
    return {
      label: "Verificar Glucosa Alta",
      status: "warning",
      textColor: "text-amber-700 font-semibold",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      referenceRange: "70–140 mg/dL (Varía x alimentos)",
      shortNote: "Verificar si el paciente acaba de ingerir alimentos o tipo de comida consumida.",
    };
  }

  return {
    label: "Normal / Aceptable",
    status: "normal",
    textColor: "text-emerald-700 font-bold",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    referenceRange: "70–140 mg/dL (Varía x alimentos)",
    shortNote: "Rango habitual esperado (en ayuno o postprandial leve).",
  };
}

/**
 * 5. EVALUACIÓN DE TEMPERATURA CORPORAL (°C)
 * Transversal a todas las edades (con especificaciones en neonatos y adultos mayores)
 */
export function evaluateTemperatura(
  temp?: number | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (temp === undefined || temp === null || temp <= 0 || isNaN(temp)) {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "36.5–37.3 °C",
    };
  }

  const { group } = parseAgeGroup(rawEdad);

  // Hiperpirexia (Emergencia) >= 40.0 °C
  if (temp >= 40.0) {
    return {
      label: "Hiperpirexia (Emergencia)",
      status: "emergency",
      isEmergency: true,
      textColor: "text-red-700 font-black",
      badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
      referenceRange: "36.5–37.3 °C",
      shortNote: "Riesgo de convulsión febril / daño neurológico",
    };
  }

  // Hipotermia Severa (Emergencia): < 32.0 °C o en neonatos < 36.0 °C
  if (temp < 32.0 || (group === "recien_nacido" && temp < 36.0)) {
    return {
      label: "Hipotermia Severa (Emergencia)",
      status: "emergency",
      isEmergency: true,
      textColor: "text-red-700 font-black",
      badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
      referenceRange: group === "recien_nacido" ? "36.5–37.3 °C" : "36.5–37.3 °C",
    };
  }

  // Fiebre (Pirexia): 38.0 °C – 39.9 °C
  if (temp >= 38.0) {
    return {
      label: "Fiebre (Pirexia)",
      status: "danger",
      textColor: "text-rose-700 font-bold",
      badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
      referenceRange: "36.5–37.3 °C",
    };
  }

  // Febrícula: 37.5 °C – 37.9 °C
  if (temp >= 37.5) {
    return {
      label: "Febrícula",
      status: "warning",
      textColor: "text-amber-700 font-bold",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      referenceRange: "36.5–37.3 °C",
    };
  }

  // Hipotermia: < 35.0 °C (en ancianos normal desde 35.8 °C)
  if (temp < 35.0) {
    return {
      label: "Hipotermia",
      status: "danger",
      textColor: "text-sky-800 font-bold",
      badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
      referenceRange: group === "adulto_mayor" ? "35.8–37.3 °C" : "36.5–37.3 °C",
    };
  }

  if (group === "adulto_mayor" && temp >= 35.8 && temp < 36.5) {
    return {
      label: "Normal (Geriátrico)",
      status: "normal",
      textColor: "text-emerald-700 font-bold",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      referenceRange: "35.8–37.3 °C",
    };
  }

  if (temp < 36.5) {
    return {
      label: "Temperatura Baja",
      status: "warning",
      textColor: "text-sky-700 font-medium",
      badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
      referenceRange: "36.5–37.3 °C",
    };
  }

  return {
    label: "Normal",
    status: "normal",
    textColor: "text-emerald-700 font-bold",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    referenceRange: group === "adulto_mayor" ? "35.8–37.3 °C" : "36.5–37.3 °C",
  };
}

/**
 * 6. EVALUACIÓN DE SATURACIÓN DE OXÍGENO (SpO2 %)
 * Calibrada específicamente para la altitud de Pachuca de Soto, Hidalgo (2,450 m s. n. m.)
 * A esta altitud, el rango fisiológico normal de reposo es 90% – 95% (hasta 98% óptimo).
 * La hipoxemia leve se ubica en 86% – 89% y la hipoxemia severa en < 85%.
 */
export function evaluateSaturacionOxigeno(
  spo2?: number | null,
  rawEdad?: string | number | null
): VitalEvaluation {
  if (spo2 === undefined || spo2 === null || spo2 <= 0 || isNaN(spo2)) {
    return {
      label: "Sin registro",
      status: "normal",
      textColor: "text-slate-400",
      badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
      referenceRange: "90–95% (Pachuca 2,450 m)",
    };
  }

  const { group } = parseAgeGroup(rawEdad);

  // Recién nacido a 2,450 msnm
  if (group === "recien_nacido") {
    if (spo2 < 88) {
      return {
        label: "Hipoxemia Severa RN (Emergencia)",
        status: "emergency",
        isEmergency: true,
        textColor: "text-red-700 font-black",
        badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
        referenceRange: "91–95% (Pachuca)",
        shortNote: "RN < 88% en altitud requiere valoración urgente.",
      };
    }
    if (spo2 < 91) {
      return {
        label: "Hipoxemia Leve (Vigilar)",
        status: "warning",
        textColor: "text-amber-700 font-bold",
        badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
        referenceRange: "91–95% (Pachuca)",
        shortNote: "Vigilar patrón respiratorio del recién nacido.",
      };
    }
    return {
      label: "Normal (Altitud Pachuca)",
      status: "normal",
      textColor: "text-emerald-700 font-bold",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      referenceRange: "91–95% (Pachuca)",
      shortNote: "Saturación adecuada para recién nacido a 2,450 msnm.",
    };
  }

  // Niños, Adolescentes, Adultos y Adultos Mayores a 2,450 msnm (Pachuca)
  // Hipoxemia Severa (Emergencia en Altitud): < 85%
  if (spo2 < 85) {
    return {
      label: "Hipoxemia Severa (<85%)",
      status: "emergency",
      isEmergency: true,
      textColor: "text-red-700 font-black",
      badgeClass: "bg-red-100 text-red-800 border-red-400 ring-1 ring-red-400 animate-pulse",
      referenceRange: "90–95% (Pachuca 2,450 m)",
      shortNote: "Valor crítico para altitud de Pachuca (2,450 msnm). Requiere valoración médica y O2.",
    };
  }

  // Hipoxemia Leve / Moderada en Altitud: 85% – 89%
  if (spo2 < 90) {
    return {
      label: "Hipoxemia Leve (Vigilar)",
      status: "warning",
      textColor: "text-amber-700 font-bold",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      referenceRange: "90–95% (Pachuca 2,450 m)",
      shortNote: "En Pachuca (2,450 msnm), rango 86-89% requiere vigilancia de síntomas respiratorios.",
    };
  }

  // Rango Fisiológico Normal en Pachuca (2,450 msnm): 90% – 95%
  if (spo2 <= 95) {
    return {
      label: "Normal (Altitud Pachuca)",
      status: "normal",
      textColor: "text-emerald-700 font-bold",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      referenceRange: "90–95% (Pachuca 2,450 m)",
      shortNote: "Rango fisiológico estándar esperado para Pachuca (2,450 msnm).",
    };
  }

  // Óptimo / Excelente > 95%
  return {
    label: "Óptimo (>95%)",
    status: "normal",
    textColor: "text-emerald-700 font-bold",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    referenceRange: "90–95% (Pachuca 2,450 m)",
    shortNote: "Excelente oxigenación a 2,450 msnm.",
  };
}

/**
 * Evaluación integral de todos los signos vitales para un registro
 */
export function evaluateAllVitals(
  vitals?: {
    presionArterial?: string;
    frecuenciaCardiaca?: number;
    temperatura?: number;
    saturacionOxigeno?: number;
    glucosa?: number;
    frecuenciaRespiratoria?: number;
  },
  rawEdad?: string | number | null
) {
  const ageInfo = parseAgeGroup(rawEdad);
  return {
    ageInfo,
    presionArterial: evaluatePresionArterial(vitals?.presionArterial, rawEdad),
    frecuenciaCardiaca: evaluateFrecuenciaCardiaca(vitals?.frecuenciaCardiaca, rawEdad),
    temperatura: evaluateTemperatura(vitals?.temperatura, rawEdad),
    saturacionOxigeno: evaluateSaturacionOxigeno(vitals?.saturacionOxigeno, rawEdad),
    glucosa: evaluateGlucosa(vitals?.glucosa, rawEdad),
    frecuenciaRespiratoria: evaluateFrecuenciaRespiratoria(vitals?.frecuenciaRespiratoria, rawEdad),
  };
}
