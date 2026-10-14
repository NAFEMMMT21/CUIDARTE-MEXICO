import { Caratula, AbonoTicket, Client } from "../types";
import { isTestCaratulaFolio } from "./formatters";

export interface ClientBalanceInfo {
  clientId?: string;
  clientNombre: string;
  totalContratado: number; // Suma de totales contratados de caratulas
  totalAbonado: number; // Suma de todos los tickets activos abonados por el cliente
  saldoPendienteTotal: number; // Deuda pendiente global del cliente (Math.max(0, totalContratado - totalAbonado))
  saldoAFavorTotal: number; // Saldo a favor global disponible del cliente (excedente libre en cuenta)
  caratulasCount: number;
  caratulasPendientesCount: number;
  isManualOverride?: boolean;
  saldoManualNotas?: string;
  detallesFolios: Array<{
    folio: string;
    total: number;
    pagadoDirecto: number;
    pendienteDirecto: number;
    saldoAFavorGenerado: number;
    estado?: string;
    isActivaOConDeuda: boolean;
  }>;
}

/**
 * Determines whether a carátula is ACTIVE or HAS PENDING DEBT.
 * A carátula is NOT active if it is finished/expired and fully paid (pendiente <= 0) or is a test carátula.
 */
export function isCaratulaActivaOConDeuda(c: Caratula): boolean {
  if (c.estado === "Cancelado" || c.tipoDocumento === "Cotización" || isTestCaratulaFolio(c.folio)) {
    return false;
  }

  // If there's still debt pending (> 0), it is active with debt regardless of date
  if ((c.pendiente || 0) > 0) {
    return true;
  }

  // If marked as Completed, it is no longer active
  if (c.estado === "Completado") {
    return false;
  }

  // Check end date (fin)
  if (c.fin) {
    const finDate = new Date(c.fin);
    if (!isNaN(finDate.getTime()) && finDate < new Date()) {
      // End date is in the past and debt is <= 0 -> finished/expired and paid
      return false;
    }
  }

  return true;
}

/**
 * Normalizes a client string for strict comparison.
 */
export function normalizeClientKey(nameOrId?: string): string {
  if (!nameOrId) return "";
  return nameOrId.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Validates whether a carátula belongs to a specific client.
 * Uses client full name as the primary authority to prevent accidental
 * cross-attribution when client IDs are defaulted or duplicated.
 */
export function matchCaratulaToClient(
  caratula: Caratula,
  client: { id?: string; nombreCompletoCliente?: string }
): boolean {
  if (caratula.estado === "Cancelado" || caratula.tipoDocumento === "Cotización") {
    return false;
  }
  const targetName = normalizeClientKey(client.nombreCompletoCliente);
  const caratulaName = normalizeClientKey(caratula.nombreCompletoCliente);
  const targetId = normalizeClientKey(client.id);
  const caratulaId = normalizeClientKey(caratula.id);

  // 1. If both have names, client full name match is the absolute authority!
  if (targetName && caratulaName) {
    if (targetName === caratulaName) return true;
    // Distinct names (e.g. "Ana Rosa" vs "Misael Carrillo Hernandez") MUST NEVER match,
    // even if they share an internal legacy ID!
    return false;
  }

  // 2. Fallback when name is missing on one side
  if (targetId && caratulaId && targetId === caratulaId) {
    return true;
  }

  // 3. Fallback when name was passed as ID or vice versa
  if (targetName && caratulaId && targetName === caratulaId) {
    return true;
  }

  return false;
}

/**
 * Validates whether an abono ticket belongs to a specific client.
 * Verifies that the client name on the ticket matches, or that the ticket's
 * carátula folio belongs to one of the client's verified carátulas.
 */
export function matchAbonoToClient(
  abono: AbonoTicket,
  client: { id?: string; nombreCompletoCliente?: string },
  clientCaratulaFolios: Set<string>
): boolean {
  if (abono.estado === "Cancelado") return false;

  const targetName = normalizeClientKey(client.nombreCompletoCliente);
  const abonoClientName = normalizeClientKey(abono.clienteNombre);
  const cleanFolio = (abono.caratulaFolio || "").trim().toUpperCase();

  // If the abono explicitly names a different client, it must NOT match
  if (targetName && abonoClientName && targetName !== abonoClientName) {
    return false;
  }

  // Exact client name match
  if (targetName && abonoClientName && targetName === abonoClientName) {
    return true;
  }

  // Folio match (ticket belongs to one of this client's carátulas)
  if (cleanFolio && clientCaratulaFolios.has(cleanFolio)) {
    return true;
  }

  return false;
}

/**
 * Calculates genuine deposited funds from abono tickets.
 * Excludes internal transfers (metodoPago === "Saldo a Favor") and deducts
 * applied credit to prevent double-counting customer money.
 */
export function calculateRealMoneyDeposited(abonos: AbonoTicket[]): number {
  return abonos.reduce((sum, a) => {
    if (a.estado === "Cancelado") return sum;
    // Internal credit usage is NOT new deposited money
    if (a.metodoPago === "Saldo a Favor") return sum;
    // Deduct any applied saldo a favor in hybrid payments
    const appliedCredit = a.saldoAFavorAplicado || 0;
    const netCash = Math.max(0, (a.montoAbonado || 0) - appliedCredit);
    return sum + netCash;
  }, 0);
}

/**
 * Automatically allocates a client's total payment pool across their carátulas.
 * Every ticket deposit increases the client's global pool.
 * Carátulas automatically pull from the client's balance in order.
 */
export function allocateClientPoolToCaratulas(
  caratulas: Caratula[],
  abonos: AbonoTicket[]
): Caratula[] {
  // Map of client normalized key -> list of non-cancelled carátulas
  const clientCaratulaMap = new Map<string, { clientName: string; clientId: string; caratulas: Caratula[] }>();

  // Process all carátulas and group by client's actual name (or ID if name is blank)
  caratulas.forEach((c) => {
    if (c.estado === "Cancelado" || c.tipoDocumento === "Cotización" || isTestCaratulaFolio(c.folio)) return;
    const clientName = (c.nombreCompletoCliente || "").trim();
    const clientId = (c.id || "").trim();
    const key = normalizeClientKey(clientName || clientId);
    if (!key) return;

    if (!clientCaratulaMap.has(key)) {
      clientCaratulaMap.set(key, { clientName, clientId, caratulas: [] });
    }
    clientCaratulaMap.get(key)!.caratulas.push(c);
  });

  // Result map for updated carátula by folio
  const updatedCaratulaMap = new Map<string, Caratula>();

  // Initialize updated map with default copy
  caratulas.forEach((c) => {
    updatedCaratulaMap.set(c.folio, { ...c });
  });

  // For each client, calculate total tickets pool and allocate to carátulas in order
  clientCaratulaMap.forEach(({ clientName, clientId, caratulas: cList }) => {
    // Collect all folios for this client
    const clientFolios = new Set(cList.map((c) => (c.folio || "").trim().toUpperCase()));

    // Get all valid non-cancelled abonos for this client
    const clientAbonos = abonos.filter((a) =>
      matchAbonoToClient(a, { id: clientId, nombreCompletoCliente: clientName }, clientFolios)
    );

    // Filter valid carátulas to allocate funds (exclude Cancelled, Quotes, and Test carátulas)
    // Sort strictly from OLDEST to NEWEST so older carátulas are paid off first
    const allocableCaratulas = cList
      .filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización" && !isTestCaratulaFolio(c.folio))
      .sort((a, b) => {
        const getTime = (item: Caratula) => {
          if (item.inicio) {
            const d = new Date(item.inicio.replace(" ", "T"));
            if (!isNaN(d.getTime())) return d.getTime();
          }
          if (item.timestamp) {
            const d = new Date(item.timestamp.replace(" ", "T"));
            if (!isNaN(d.getTime())) return d.getTime();
          }
          return 0;
        };

        const timeA = getTime(a);
        const timeB = getTime(b);

        if (timeA !== timeB) {
          return timeA - timeB; // Oldest first
        }

        return (a.folio || "").localeCompare(b.folio || "", undefined, { numeric: true });
      });

    // Client's total genuine money pool deposited
    const directCaratulaPagado = allocableCaratulas.reduce((sum, c) => sum + (c.pagado || 0), 0);
    const realTicketsSum = calculateRealMoneyDeposited(clientAbonos);
    // If the client has registered tickets, tickets are the strict single source of truth.
    // directCaratulaPagado is only a fallback for legacy records with zero registered tickets.
    const totalPaidPool = clientAbonos.length > 0 ? realTicketsSum : directCaratulaPagado;

    let remainingPool = totalPaidPool;

    allocableCaratulas.forEach((c) => {
      const totalReq = c.total || 0;
      const allocated = Math.min(totalReq, Math.max(0, remainingPool));
      remainingPool -= allocated;

      const updatedPagado = allocated;
      const updatedPendiente = Math.max(0, totalReq - allocated);

      updatedCaratulaMap.set(c.folio, {
        ...c,
        pagado: updatedPagado,
        pendiente: updatedPendiente,
      });
    });
  });

  return Array.from(updatedCaratulaMap.values());
}

/**
 * Calculates a client's global account balance across all their carátulas and abonos.
 * Total contratado and Total abonado use the client's global fund pool.
 */
export function calculateClientBalance(
  clientIdentifier: string | { id?: string; nombreCompletoCliente?: string },
  caratulas: Caratula[],
  abonos: AbonoTicket[],
  knownClients?: Client[]
): ClientBalanceInfo {
  // Resolve client target object
  let clientTarget: { id?: string; nombreCompletoCliente: string };

  if (typeof clientIdentifier === "object" && clientIdentifier !== null) {
    clientTarget = {
      id: clientIdentifier.id || "",
      nombreCompletoCliente: (clientIdentifier.nombreCompletoCliente || "").trim(),
    };
  } else {
    const rawStr = typeof clientIdentifier === "string" ? clientIdentifier.trim() : "";
    if (!rawStr) {
      return {
        clientId: "",
        clientNombre: "",
        totalContratado: 0,
        totalAbonado: 0,
        saldoPendienteTotal: 0,
        saldoAFavorTotal: 0,
        caratulasCount: 0,
        caratulasPendientesCount: 0,
        detallesFolios: [],
      };
    }

    // Check if rawStr matches an ID in knownClients
    const foundInClients = knownClients?.find(
      (c) => normalizeClientKey(c.id) === normalizeClientKey(rawStr)
    );

    if (foundInClients) {
      clientTarget = {
        id: foundInClients.id,
        nombreCompletoCliente: foundInClients.nombreCompletoCliente,
      };
    } else {
      // Check if rawStr is an ID matching carátulas
      const isLikelyId = rawStr.toUpperCase().startsWith("CLI-");
      if (isLikelyId) {
        const foundInCaratulas = caratulas.find(
          (c) => normalizeClientKey(c.id) === normalizeClientKey(rawStr)
        );
        clientTarget = {
          id: rawStr,
          nombreCompletoCliente: foundInCaratulas?.nombreCompletoCliente || "",
        };
      } else {
        // rawStr is the client name
        const foundInCaratulas = caratulas.find(
          (c) => normalizeClientKey(c.nombreCompletoCliente) === normalizeClientKey(rawStr)
        );
        clientTarget = {
          id: foundInCaratulas?.id || "",
          nombreCompletoCliente: rawStr,
        };
      }
    }
  }

  if (!clientTarget.nombreCompletoCliente && !clientTarget.id) {
    return {
      clientId: "",
      clientNombre: "",
      totalContratado: 0,
      totalAbonado: 0,
      saldoPendienteTotal: 0,
      saldoAFavorTotal: 0,
      caratulasCount: 0,
      caratulasPendientesCount: 0,
      detallesFolios: [],
    };
  }

  // All valid non-cancelled caratulas for this client (excluding test carátulas)
  const allClientCaratulas = caratulas.filter(
    (c) => matchCaratulaToClient(c, clientTarget) && !isTestCaratulaFolio(c.folio)
  );

  const clientFolios = new Set(allClientCaratulas.map((c) => (c.folio || "").trim().toUpperCase()));

  // All non-cancelled abonos for this client
  const allClientAbonos = abonos.filter((a) => matchAbonoToClient(a, clientTarget, clientFolios));

  // Client total genuine money deposited (excluding internal Saldo a Favor usage)
  const realTicketsSum = calculateRealMoneyDeposited(allClientAbonos);
  const directCaratulaPagado = allClientCaratulas.reduce((sum, c) => sum + (c.pagado || 0), 0);
  const totalAbonado = allClientAbonos.length > 0 ? realTicketsSum : directCaratulaPagado;

  // Active or pending-debt caratulas for this client
  const activeClientCaratulas = allClientCaratulas.filter(isCaratulaActivaOConDeuda);

  // Total Contratado (active/pending caratulas)
  const totalContratado = activeClientCaratulas.reduce((sum, c) => sum + (c.total || 0), 0);

  // Total Contratado across ALL valid caratulas (for global pool allocation)
  const totalContratadoHist = allClientCaratulas.reduce((sum, c) => sum + (c.total || 0), 0);

  // Global pending debt
  let saldoPendienteTotal = Math.max(0, totalContratadoHist - totalAbonado);

  // Client available credit (Saldo a favor = total paid - total required)
  let saldoAFavorTotal = Math.max(0, totalAbonado - totalContratadoHist);
  let isManualOverride = false;
  let saldoManualNotas: string | undefined = undefined;

  // Check manual overrides on matched client or target
  const matchedClient = knownClients?.find(
    (cl) =>
      (clientTarget.id && cl.id === clientTarget.id) ||
      (clientTarget.nombreCompletoCliente &&
        normalizeClientKey(cl.nombreCompletoCliente) === normalizeClientKey(clientTarget.nombreCompletoCliente))
  );

  const clientDataSource = matchedClient || (clientTarget as any);
  if (clientDataSource) {
    if (typeof clientDataSource.saldoAFavorManual === "number" && !isNaN(clientDataSource.saldoAFavorManual)) {
      saldoAFavorTotal = Math.max(0, clientDataSource.saldoAFavorManual);
      isManualOverride = true;
      saldoManualNotas = clientDataSource.saldoAjusteNotas;
    }
    if (typeof clientDataSource.saldoPendienteManual === "number" && !isNaN(clientDataSource.saldoPendienteManual)) {
      saldoPendienteTotal = Math.max(0, clientDataSource.saldoPendienteManual);
      isManualOverride = true;
      saldoManualNotas = clientDataSource.saldoAjusteNotas;
    }
  }

  // Compute allocated caratula details
  const updatedAllocated = allocateClientPoolToCaratulas(allClientCaratulas, allClientAbonos);

  let caratulasPendientesCount = 0;

  const detallesFolios = updatedAllocated.map((c) => {
    const isActiva = isCaratulaActivaOConDeuda(c);

    if (c.pendiente > 0) {
      caratulasPendientesCount++;
    }

    return {
      folio: c.folio,
      total: c.total,
      pagadoDirecto: c.pagado,
      pendienteDirecto: c.pendiente,
      saldoAFavorGenerado: 0,
      estado: c.estado,
      isActivaOConDeuda: isActiva,
    };
  });

  const matchedName = clientTarget.nombreCompletoCliente || allClientCaratulas[0]?.nombreCompletoCliente || "";
  const matchedId = clientTarget.id || allClientCaratulas[0]?.id || "";

  return {
    clientId: matchedId,
    clientNombre: matchedName,
    totalContratado,
    totalAbonado,
    saldoPendienteTotal,
    saldoAFavorTotal,
    caratulasCount: activeClientCaratulas.length,
    caratulasPendientesCount,
    isManualOverride,
    saldoManualNotas,
    detallesFolios,
  };
}

/**
 * Synchronizes all carátulas in Firestore with the calculated client pool allocations.
 * Checks if any carátula's pagado/pendiente differs and saves the updated carátula.
 */
/**
 * Calculates current week bounds (Monday to Sunday)
 */
export function getCurrentWeekBounds(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

export interface ClientWeeklyBalanceInfo {
  periodoTexto: string;
  mondayDate: Date;
  sundayDate: Date;
  caratulasSemanaYPendientes: Caratula[];
  caratulasPasadasPagadas: Caratula[];
  totalContratadoPeriodo: number;
  totalAbonadoPeriodo: number;
  saldoPendienteTotal: number;
  saldoAFavorTotal: number;
}

/**
 * Calculates client balance focused strictly on the current weekly period (Monday to Sunday).
 * Sums:
 * 1) Carátulas contracted in the current week (Monday to Sunday)
 * 2) Plus any carátulas with pending payment from previous periods.
 * Fully paid past carátulas are excluded from current week's total contracted and moved to past policies.
 */
export function calculateClientWeeklyBalance(
  myCaratulas: Caratula[],
  abonos: AbonoTicket[],
  referenceDate = new Date()
): ClientWeeklyBalanceInfo {
  const { monday, sunday } = getCurrentWeekBounds(referenceDate);

  const mondayMs = monday.getTime();
  const sundayMs = sunday.getTime();

  // Run global pool allocation first so pagado/pendiente are accurate
  const allocated = allocateClientPoolToCaratulas(myCaratulas, abonos);

  const caratulasSemanaYPendientes: Caratula[] = [];
  const caratulasPasadasPagadas: Caratula[] = [];

  allocated.forEach((c) => {
    if (c.estado === "Cancelado" || c.tipoDocumento === "Cotización" || isTestCaratulaFolio(c.folio)) return;

    let startTime = 0;
    if (c.inicio) {
      const d = new Date(c.inicio.replace(" ", "T"));
      if (!isNaN(d.getTime())) startTime = d.getTime();
    } else if (c.timestamp) {
      const d = new Date(c.timestamp.replace(" ", "T"));
      if (!isNaN(d.getTime())) startTime = d.getTime();
    }

    let endTime = startTime;
    if (c.fin) {
      const d = new Date(c.fin.replace(" ", "T"));
      if (!isNaN(d.getTime())) endTime = d.getTime();
    }

    const isInCurrentWeek =
      (startTime >= mondayMs && startTime <= sundayMs) ||
      (endTime >= mondayMs && startTime <= sundayMs);

    const hasPendingDebt = (c.pendiente || 0) > 0;

    if (isInCurrentWeek || hasPendingDebt) {
      caratulasSemanaYPendientes.push(c);
    } else {
      caratulasPasadasPagadas.push(c);
    }
  });

  // Sort current week/pending carátulas from oldest to newest
  caratulasSemanaYPendientes.sort((a, b) => {
    const timeA = new Date(a.inicio || a.timestamp || 0).getTime();
    const timeB = new Date(b.inicio || b.timestamp || 0).getTime();
    return timeA - timeB;
  });

  // Sort past paid carátulas newest to oldest for easy browsing
  caratulasPasadasPagadas.sort((a, b) => {
    const timeA = new Date(a.inicio || a.timestamp || 0).getTime();
    const timeB = new Date(b.inicio || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  const totalContratadoPeriodo = caratulasSemanaYPendientes.reduce((sum, c) => sum + (c.total || 0), 0);
  const totalAbonadoPeriodo = caratulasSemanaYPendientes.reduce((sum, c) => sum + (c.pagado || 0), 0);
  const saldoPendienteTotal = Math.max(0, totalContratadoPeriodo - totalAbonadoPeriodo);

  // Client global credit calculation
  const totalContratadoGlobal = allocated
    .filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización" && !isTestCaratulaFolio(c.folio))
    .reduce((sum, c) => sum + (c.total || 0), 0);
  const directCaratulaPagado = allocated
    .filter((c) => c.estado !== "Cancelado" && c.tipoDocumento !== "Cotización" && !isTestCaratulaFolio(c.folio))
    .reduce((sum, c) => sum + (c.pagado || 0), 0);
  const realTicketsSum = calculateRealMoneyDeposited(abonos);
  const totalAbonadoGlobal = abonos.length > 0 ? realTicketsSum : directCaratulaPagado;
  const saldoAFavorTotal = Math.max(0, totalAbonadoGlobal - totalContratadoGlobal);

  const formatD = (dateObj: Date) =>
    dateObj.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });

  const periodoTexto = `Periodo Semana: Lunes ${formatD(monday)} al Domingo ${formatD(sunday)}`;

  return {
    periodoTexto,
    mondayDate: monday,
    sundayDate: sunday,
    caratulasSemanaYPendientes,
    caratulasPasadasPagadas,
    totalContratadoPeriodo,
    totalAbonadoPeriodo,
    saldoPendienteTotal,
    saldoAFavorTotal,
  };
}

/**
 * Synchronizes calculated pool allocations across all carátulas in Firestore.
 */
export async function syncAllCaratulasWithClientPools(
  allCaratulas: Caratula[],
  abonos: AbonoTicket[],
  saveFn: (c: Caratula) => Promise<void>
) {
  const allocated = allocateClientPoolToCaratulas(allCaratulas, abonos);
  for (const c of allocated) {
    const orig = allCaratulas.find((o) => o.folio === c.folio);
    if (!orig || orig.pagado !== c.pagado || orig.pendiente !== c.pendiente || orig.estado !== c.estado) {
      await saveFn(c);
    }
  }
}


