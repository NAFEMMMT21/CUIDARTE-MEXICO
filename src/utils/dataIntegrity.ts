import {
  SystemUser,
  StaffMember,
  Caratula,
  Client,
  CalendarEvent,
  ExpedienteEntry,
  GuardiaShiftRecord,
  ScheduledShiftItem,
  AbonoTicket,
} from "../types";
import {
  extractClientNumber,
  getTestCaratulaFolio,
  isTestCaratulaFolio,
  getCurrentTimestamp,
} from "./formatters";
import { isCaratulaFolioDeleted } from "./deletedFolios";

/**
 * Normalizes an identifier string for case and whitespace insensitive comparison.
 */
export function normalizeIdentifier(val?: string): string {
  if (!val) return "";
  return val.trim().toLowerCase();
}

/**
 * Deduplicates System Users:
 * - Guarantees 100% uniqueness by username (`ux`) and by `id`.
 * - Preserves SuperAdmin ("Nestor Moedano") and highest privilege accounts.
 * - Discards redundant or duplicate accounts.
 */
export function deduplicateSystemUsers(users: SystemUser[]): SystemUser[] {
  if (!Array.isArray(users) || users.length === 0) return [];

  const seenUx = new Map<string, SystemUser>();
  const seenId = new Set<string>();

  // Process SuperAdmins first
  const sorted = [...users].sort((a, b) => {
    if (a.isSuperAdmin || normalizeIdentifier(a.ux) === "nestor moedano") return -1;
    if (b.isSuperAdmin || normalizeIdentifier(b.ux) === "nestor moedano") return 1;
    return 0;
  });

  const result: SystemUser[] = [];

  for (const user of sorted) {
    if (!user || !user.ux) continue;

    const normUx = normalizeIdentifier(user.ux);
    const userId = user.id || `usr-${normUx}`;

    // If ID already seen or UX already seen, skip duplicate
    if (seenId.has(userId) || seenUx.has(normUx)) {
      continue;
    }

    seenUx.set(normUx, user);
    seenId.add(userId);
    result.push({
      ...user,
      id: userId,
      ux: user.ux.trim(),
    });
  }

  return result;
}

/**
 * Deduplicates Staff Members (Socios y Empleados):
 * - Guarantees 100% uniqueness by staff `id` and `noSocio`.
 * - Prevents repeated socio numbers or repeated employee credentials.
 */
export function deduplicateStaffMembers(staffList: StaffMember[]): StaffMember[] {
  if (!Array.isArray(staffList) || staffList.length === 0) return [];

  const seenId = new Set<string>();
  const seenNoSocio = new Set<string>();
  const result: StaffMember[] = [];

  for (const staff of staffList) {
    if (!staff) continue;

    const normId = normalizeIdentifier(staff.id);
    const normNoSocio = normalizeIdentifier(staff.noSocio);

    if (normId && seenId.has(normId)) {
      continue;
    }
    if (normNoSocio && seenNoSocio.has(normNoSocio)) {
      continue;
    }

    if (normId) seenId.add(normId);
    if (normNoSocio) seenNoSocio.add(normNoSocio);

    result.push(staff);
  }

  return result;
}

/**
 * Deduplicates Carátulas:
 * - Guarantees 100% uniqueness strictly by `folio` (Carátula ID).
 * - CRITICAL: Clients can legitimately have MULTIPLE carátulas (renewals, different periods,
 *   different services, multiple contracts) under the same client name or client ID.
 *   DO NOT filter, deduplicate, or group carátulas by client `id` or `nombreCompletoCliente`!
 */
export function deduplicateCaratulas(caratulas: Caratula[]): Caratula[] {
  if (!Array.isArray(caratulas) || caratulas.length === 0) return [];

  const seenFolio = new Set<string>();
  const result: Caratula[] = [];

  for (const item of caratulas) {
    if (!item) continue;

    // A carátula's ONLY primary unique key is its `folio` (e.g. "CPSEA000", "CPCOTA001", "00101").
    // We intentionally ignore client ID (`item.id`) or client name (`item.nombreCompletoCliente`)
    // so that clients can have multiple carátulas without any being discarded.
    const rawFolio = item.folio || (item as any).caratulaFolio;
    const normFolio = normalizeIdentifier(rawFolio);

    if (normFolio) {
      if (seenFolio.has(normFolio)) {
        // Same exact folio exists: merge non-destructively, keeping richest data
        const existingIdx = result.findIndex((c) => normalizeIdentifier(c.folio || (c as any).caratulaFolio) === normFolio);
        if (existingIdx >= 0) {
          const existing = result[existingIdx];
          const existingShifts = Array.isArray(existing.guardiasProgramadas) ? existing.guardiasProgramadas : [];
          const itemShifts = Array.isArray(item.guardiasProgramadas) ? item.guardiasProgramadas : [];
          const bestShifts = itemShifts.length >= existingShifts.length ? itemShifts : existingShifts;
          result[existingIdx] = {
            ...existing,
            ...item,
            guardiasProgramadas: bestShifts,
            total: Math.max(existing.total || 0, item.total || 0),
            pagado: Math.max(existing.pagado || 0, item.pagado || 0),
            pendiente: item.pendiente !== undefined ? item.pendiente : existing.pendiente,
            servicios: (item.servicios && item.servicios.length > 0) ? item.servicios : existing.servicios,
          };
        }
        continue;
      }
      seenFolio.add(normFolio);
    }

    result.push(item);
  }

  return result;
}

/**
 * Deduplicates Clients:
 * - Guarantees 100% uniqueness by client `id`.
 * - Merges duplicate records to preserve documents, contacts, and latest updates.
 */
export function deduplicateClients(clients: Client[]): Client[] {
  if (!Array.isArray(clients) || clients.length === 0) return [];

  const clientMap = new Map<string, Client>();

  for (const c of clients) {
    if (!c || !c.id) continue;
    const normId = normalizeIdentifier(c.id);
    const existing = clientMap.get(normId);

    if (!existing) {
      clientMap.set(normId, { ...c, id: c.id.trim() });
    } else {
      // Merge records, preserving the richest and most recent information
      const mergedDocs = [
        ...(Array.isArray(existing.documentos) ? existing.documentos : []),
        ...(Array.isArray(c.documentos) ? c.documentos : []),
      ];
      // Deduplicate documents by ID or name
      const seenDocKeys = new Set<string>();
      const uniqueDocs = mergedDocs.filter((d) => {
        const docKey = normalizeIdentifier(d.id || d.nombre || d.tipo);
        if (!docKey || seenDocKeys.has(docKey)) return false;
        seenDocKeys.add(docKey);
        return true;
      });

      clientMap.set(normId, {
        ...existing,
        ...c,
        id: existing.id || c.id.trim(),
        nombreCompletoCliente: c.nombreCompletoCliente?.trim() || existing.nombreCompletoCliente?.trim() || "",
        nombreCompletoRS: c.nombreCompletoRS?.trim() || existing.nombreCompletoRS?.trim() || "",
        numeroContacto: c.numeroContacto?.trim() || existing.numeroContacto?.trim() || "",
        correo: c.correo?.trim() || existing.correo?.trim() || "",
        direccionServicio: c.direccionServicio?.trim() || existing.direccionServicio?.trim() || "",
        diagnostico: c.diagnostico?.trim() || existing.diagnostico?.trim() || "",
        especificaciones: c.especificaciones?.trim() || existing.especificaciones?.trim() || "",
        contratoUrl: c.contratoUrl || existing.contratoUrl || "",
        contratoNombre: c.contratoNombre || existing.contratoNombre || "",
        documentos: uniqueDocs,
      });
    }
  }

  return Array.from(clientMap.values());
}

/**
 * Deduplicates Calendar Events:
 * - Guarantees 100% uniqueness by event `id` and `folioGuardia`.
 * - Prioritizes and merges newer event updates rather than discarding them.
 */
export function deduplicateCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  if (!Array.isArray(events) || events.length === 0) return [];

  const result: CalendarEvent[] = [];
  const idMap = new Map<string, number>();

  for (let i = 0; i < events.length; i++) {
    const raw = events[i];
    if (!raw) continue;

    // Ensure valid event object with id and folioGuardia populated
    const ev: CalendarEvent = { ...raw };
    if (!ev.id && ev.folioGuardia) {
      ev.id = ev.folioGuardia;
    } else if (!ev.folioGuardia && ev.id && ev.id.toUpperCase().startsWith("GACP")) {
      ev.folioGuardia = ev.id;
    } else if (!ev.id && !ev.folioGuardia) {
      ev.id = `shift-${i}-${Date.now()}`;
    }

    const normId = normalizeIdentifier(ev.id);
    const normFolio = normalizeIdentifier(ev.folioGuardia);

    let existingIdx = -1;
    if (normFolio && idMap.has(`folio:${normFolio}`)) {
      existingIdx = idMap.get(`folio:${normFolio}`)!;
    } else if (normId && idMap.has(`id:${normId}`)) {
      existingIdx = idMap.get(`id:${normId}`)!;
    }

    if (existingIdx >= 0) {
      // Merge with latest event properties taking precedence
      result[existingIdx] = {
        ...result[existingIdx],
        ...ev,
        id: ev.id || result[existingIdx].id,
        folioGuardia: ev.folioGuardia || result[existingIdx].folioGuardia,
        caratulaFolio: ev.caratulaFolio || result[existingIdx].caratulaFolio,
        clientId: ev.clientId || result[existingIdx].clientId,
      };
      if (normId) idMap.set(`id:${normId}`, existingIdx);
      if (normFolio) idMap.set(`folio:${normFolio}`, existingIdx);
    } else {
      const newIdx = result.length;
      result.push(ev);
      if (normId) idMap.set(`id:${normId}`, newIdx);
      if (normFolio) idMap.set(`folio:${normFolio}`, newIdx);
    }
  }

  return result;
}

/**
 * Deduplicates Clinical Expediente Entries:
 */
export function deduplicateExpedienteEntries(entries: ExpedienteEntry[]): ExpedienteEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const seenId = new Set<string>();
  const result: ExpedienteEntry[] = [];

  for (const e of entries) {
    if (!e || !e.id) continue;
    const normId = normalizeIdentifier(e.id);
    if (seenId.has(normId)) continue;

    seenId.add(normId);
    result.push(e);
  }

  return result;
}

/**
 * Deduplicates Guardia Shift Records:
 */
export function deduplicateGuardias(guardias: GuardiaShiftRecord[]): GuardiaShiftRecord[] {
  if (!Array.isArray(guardias) || guardias.length === 0) return [];

  const seenId = new Set<string>();
  const result: GuardiaShiftRecord[] = [];

  for (const g of guardias) {
    if (!g || !g.id) continue;
    const normId = normalizeIdentifier(g.id);

    if (seenId.has(normId)) continue;

    seenId.add(normId);
    result.push(g);
  }

  return result;
}

/**
 * Creates an official Carátula de Prueba for a given client with assigned guardias.
 * Folio format: Client number + 01 (e.g. 00101, 00501, 01001).
 */
export function createTestCaratulaForClient(
  client: Client,
  testFolio: string,
  initialShifts: CalendarEvent[] = []
): Caratula {
  const shiftsCount = Math.max(initialShifts.length, 1);
  const unitPrice = 750;
  const unitCost = 500;
  const subtotal = shiftsCount * unitPrice;

  const scheduledShifts: ScheduledShiftItem[] = initialShifts.map((ev) => ({
    id: ev.id,
    folioGuardia: ev.folioGuardia || ev.id,
    fecha: ev.fechaInicio ? ev.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10),
    horaInicio: ev.fechaInicio?.split("T")[1]?.slice(0, 5) || "08:00",
    horaFin: ev.fechaFin?.split("T")[1]?.slice(0, 5) || "20:00",
    fechaFinCalculada: ev.fechaFin ? ev.fechaFin.split("T")[0] : (ev.fechaInicio ? ev.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10)),
    preset: "12h_dia",
    tipoServicio: ev.tipoServicio || "Guardia de Enfermería",
    personalAsignado: ev.personalAsignado || "Por asignar",
    staffId: ev.staffId,
    staffNoSocio: ev.staffNoSocio,
    staffFoto: ev.staffFoto,
    costoHonorarios: ev.costoHonorarios !== undefined ? ev.costoHonorarios : unitCost,
    honorarioPagado: ev.honorarioPagado,
    pagoHonorarioId: ev.pagoHonorarioId,
    fechaPagoHonorario: ev.fechaPagoHonorario,
    montoPagadoHonorario: ev.montoPagadoHonorario,
  }));

  const startDates = initialShifts.map((s) => s.fechaInicio).filter(Boolean).sort();
  const endDates = initialShifts.map((s) => s.fechaFin).filter(Boolean).sort();

  return {
    folio: testFolio,
    id: client.id,
    timestamp: getCurrentTimestamp(),
    tipoDocumento: "Caratula",
    nombreCompletoCliente: client.nombreCompletoCliente || "Cliente Cuidarte",
    numeroContacto: client.numeroContacto || "",
    numeroContacto2: client.numeroContacto2 || "",
    numeroContacto3: client.numeroContacto3 || "",
    correo: client.correo || "",
    direccionServicio: client.direccionServicio || "Pachuca, Hidalgo",
    nombreCompletoRS: client.nombreCompletoRS || client.nombreCompletoCliente || "Paciente",
    edad: client.edad || "",
    diagnostico: client.diagnostico || "Atención General",
    especificaciones: "Carátula de prueba asignada automáticamente para control y trazabilidad de guardias.",
    servicios: [
      {
        servicio: "Guardia de Enfermería (Carátula de Prueba)",
        cantidad: shiftsCount,
        precioU: unitPrice,
        precioTot: subtotal,
        costoU: unitCost,
      },
    ],
    subtotal: subtotal,
    descuento: 0,
    total: subtotal,
    pagado: 0,
    pendiente: subtotal,
    inicio: startDates[0] ? startDates[0].replace("T", " ") : `${new Date().toISOString().slice(0, 10)} 08:00`,
    fin: endDates[endDates.length - 1] ? endDates[endDates.length - 1].replace("T", " ") : `${new Date().toISOString().slice(0, 10)} 20:00`,
    guardiasProgramadas: scheduledShifts,
  };
}

/**
 * Checks all guardias (calendar events) and guarantees that every single guardia
 * is assigned to a carátula.
 * If any guardia lacks a carátula (empty, 'sin asociar', etc.), it is linked to
 * the test carátula for its client (Client Number + 01).
 * If the test carátula does not exist, it is generated and inserted into caratulas.
 */
export function reconcileUnassignedGuardias(
  events: CalendarEvent[],
  clients: Client[],
  caratulas: Caratula[]
): {
  updatedEvents: CalendarEvent[];
  updatedCaratulas: Caratula[];
  unassignedFound: number;
  newTestCaratulasCreated: string[];
  reconciledCount: number;
} {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      updatedEvents: events || [],
      updatedCaratulas: caratulas || [],
      unassignedFound: 0,
      newTestCaratulasCreated: [],
      reconciledCount: 0,
    };
  }

  // Find all unassigned events or events with non-existent caratula
  const unassigned = events.filter((ev) => {
    if (!ev.caratulaFolio || ev.caratulaFolio.trim() === "") return true;
    const cleanFolio = ev.caratulaFolio.trim().toLowerCase();
    if (cleanFolio === "sin asociar" || cleanFolio === "sin caratula" || cleanFolio === "sin carátula") return true;
    return false;
  });

  if (unassigned.length === 0) {
    return {
      updatedEvents: events,
      updatedCaratulas: caratulas,
      unassignedFound: 0,
      newTestCaratulasCreated: [],
      reconciledCount: 0,
    };
  }

  const updatedEvents = events.map((ev) => {
    const cleanFolio = (ev.caratulaFolio || "").trim().toLowerCase();
    const isMissing = !cleanFolio || cleanFolio === "sin asociar" || cleanFolio === "sin caratula" || cleanFolio === "sin carátula";
    if (isMissing) {
      const testFolio = getTestCaratulaFolio(ev.clientId);
      return {
        ...ev,
        caratulaFolio: testFolio,
      };
    }
    return ev;
  });

  // Group events by test folio
  const testFoliosNeeded = new Map<string, { clientId: string; events: CalendarEvent[] }>();
  for (const ev of updatedEvents) {
    const tf = ev.caratulaFolio!;
    if (isTestCaratulaFolio(tf)) {
      if (!testFoliosNeeded.has(tf)) {
        testFoliosNeeded.set(tf, { clientId: ev.clientId, events: [] });
      }
      testFoliosNeeded.get(tf)!.events.push(ev);
    }
  }

  let updatedCaratulas = [...caratulas];
  const newTestCaratulasCreated: string[] = [];

  testFoliosNeeded.forEach(({ clientId, events: shiftEvents }, testFolio) => {
    const existingIdx = updatedCaratulas.findIndex(
      (c) => c.folio.trim().toLowerCase() === testFolio.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      const existingCar = updatedCaratulas[existingIdx];
      const existingShifts = existingCar.guardiasProgramadas || [];
      const mergedShifts = [...existingShifts];

      for (const ev of shiftEvents) {
        const sIdx = mergedShifts.findIndex(
          (s) => (ev.folioGuardia && s.folioGuardia === ev.folioGuardia) || s.id === ev.id
        );
        if (sIdx < 0) {
          mergedShifts.push({
            id: ev.id,
            folioGuardia: ev.folioGuardia || ev.id,
            fecha: ev.fechaInicio ? ev.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10),
            horaInicio: ev.fechaInicio?.split("T")[1]?.slice(0, 5) || "08:00",
            horaFin: ev.fechaFin?.split("T")[1]?.slice(0, 5) || "20:00",
            fechaFinCalculada: ev.fechaFin ? ev.fechaFin.split("T")[0] : (ev.fechaInicio ? ev.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10)),
            preset: "12h_dia",
            tipoServicio: ev.tipoServicio || "Guardia de Enfermería",
            personalAsignado: ev.personalAsignado || "Por asignar",
            staffId: ev.staffId,
            staffNoSocio: ev.staffNoSocio,
            staffFoto: ev.staffFoto,
            costoHonorarios: ev.costoHonorarios !== undefined ? ev.costoHonorarios : 500,
            honorarioPagado: ev.honorarioPagado,
            pagoHonorarioId: ev.pagoHonorarioId,
            fechaPagoHonorario: ev.fechaPagoHonorario,
            montoPagadoHonorario: ev.montoPagadoHonorario,
          });
        }
      }

      updatedCaratulas[existingIdx] = {
        ...existingCar,
        guardiasProgramadas: mergedShifts,
      };
    } else {
      const matchedClient = clients.find((c) => c.id === clientId) || clients[0] || {
        id: clientId || "CLI-001",
        nombreCompletoCliente: "Cliente Cuidarte",
      };
      const newTestCar = createTestCaratulaForClient(matchedClient as Client, testFolio, shiftEvents);
      updatedCaratulas.unshift(newTestCar);
      newTestCaratulasCreated.push(testFolio);
    }
  });

  return {
    updatedEvents,
    updatedCaratulas,
    unassignedFound: unassigned.length,
    newTestCaratulasCreated,
    reconciledCount: unassigned.length,
  };
}

/**
 * Restores and guarantees that any carátula referenced in calendar events or abono tickets
 * that might be missing from the carátulas list is safely reconstructed and restored.
 * Crucially respects multiple carátulas per client.
 */
export function restoreMissingCaratulasFromEventsAndAbonos(
  caratulas: Caratula[],
  events: CalendarEvent[],
  abonos: AbonoTicket[],
  clients: Client[]
): { restoredCaratulas: Caratula[]; restoredCount: number } {
  const currentFolios = new Set(
    (caratulas || [])
      .map((c) => normalizeIdentifier(c.folio || (c as any).caratulaFolio))
      .filter(Boolean)
  );
  const newCaratulas: Caratula[] = [...(caratulas || [])];
  let restoredCount = 0;

  // Group events by caratulaFolio
  const eventsByFolio = new Map<string, CalendarEvent[]>();
  for (const ev of events || []) {
    const rawFolio = ev.caratulaFolio?.trim();
    if (!rawFolio) continue;
    const cleanFolio = rawFolio.toLowerCase();
    if (cleanFolio === "sin asociar" || cleanFolio === "sin caratula" || cleanFolio === "sin carátula") continue;
    const norm = normalizeIdentifier(rawFolio);
    if (!eventsByFolio.has(norm)) {
      eventsByFolio.set(norm, []);
    }
    eventsByFolio.get(norm)!.push(ev);
  }

  // Group abonos by caratulaFolio
  const abonosByFolio = new Map<string, AbonoTicket[]>();
  for (const ab of abonos || []) {
    const rawFolio = ab.caratulaFolio?.trim();
    if (!rawFolio) continue;
    const norm = normalizeIdentifier(rawFolio);
    if (!abonosByFolio.has(norm)) {
      abonosByFolio.set(norm, []);
    }
    abonosByFolio.get(norm)!.push(ab);
  }

  // Check each folio found in events or abonos
  const allReferencedFolios = new Set([...eventsByFolio.keys(), ...abonosByFolio.keys()]);
  for (const normFolio of allReferencedFolios) {
    if (currentFolios.has(normFolio)) continue;
    if (isCaratulaFolioDeleted(normFolio)) continue;

    const relatedEvents = eventsByFolio.get(normFolio) || [];
    const relatedAbonos = abonosByFolio.get(normFolio) || [];

    const firstEv = relatedEvents[0];
    const firstAb = relatedAbonos[0];

    const displayFolio = firstEv?.caratulaFolio || firstAb?.caratulaFolio || normFolio.toUpperCase();
    const clientId = firstEv?.clientId || "CLI-001";
    const clientNombre = firstEv?.clientNombre || firstAb?.clienteNombre || "Cliente Cuidarte";
    const matchedClient = (clients || []).find(
      (c) =>
        c.id === clientId ||
        normalizeIdentifier(c.nombreCompletoCliente) === normalizeIdentifier(clientNombre)
    );

    const totalAbonado = relatedAbonos.reduce((sum, a) => sum + (a.montoAbonado || 0), 0);
    const shiftsCount = Math.max(relatedEvents.length, 1);
    const unitPrice = 750;
    const unitCost = 500;
    const subtotal = shiftsCount * unitPrice;
    const totalAmount = Math.max(firstAb?.totalCaratula || 0, subtotal);

    const scheduledShifts: ScheduledShiftItem[] = relatedEvents.map((ev) => ({
      id: ev.id,
      folioGuardia: ev.folioGuardia || ev.id,
      fecha: ev.fechaInicio ? ev.fechaInicio.split("T")[0] : new Date().toISOString().slice(0, 10),
      horaInicio: ev.fechaInicio?.split("T")[1]?.slice(0, 5) || "08:00",
      horaFin: ev.fechaFin?.split("T")[1]?.slice(0, 5) || "20:00",
      fechaFinCalculada: ev.fechaFin
        ? ev.fechaFin.split("T")[0]
        : ev.fechaInicio
        ? ev.fechaInicio.split("T")[0]
        : new Date().toISOString().slice(0, 10),
      preset: "12h_dia",
      tipoServicio: ev.tipoServicio || "Guardia de Enfermería",
      personalAsignado: ev.personalAsignado || "Por asignar",
      staffId: ev.staffId,
      staffNoSocio: ev.staffNoSocio,
      staffFoto: ev.staffFoto,
      costoHonorarios: ev.costoHonorarios !== undefined ? ev.costoHonorarios : unitCost,
      honorarioPagado: ev.honorarioPagado,
      pagoHonorarioId: ev.pagoHonorarioId,
      fechaPagoHonorario: ev.fechaPagoHonorario,
      montoPagadoHonorario: ev.montoPagadoHonorario,
    }));

    const restoredCaratula: Caratula = {
      folio: displayFolio,
      id: matchedClient?.id || clientId,
      timestamp: firstAb?.fecha || firstEv?.timestamp || getCurrentTimestamp(),
      tipoDocumento: displayFolio.toUpperCase().startsWith("CPCOT") ? "Cotización" : "Caratula",
      nombreCompletoCliente: matchedClient?.nombreCompletoCliente || clientNombre,
      numeroContacto: matchedClient?.numeroContacto || "",
      numeroContacto2: matchedClient?.numeroContacto2 || "",
      numeroContacto3: matchedClient?.numeroContacto3 || "",
      correo: matchedClient?.correo || "",
      direccionServicio: matchedClient?.direccionServicio || "Pachuca, Hidalgo",
      nombreCompletoRS: matchedClient?.nombreCompletoRS || clientNombre,
      edad: matchedClient?.edad || "",
      diagnostico: matchedClient?.diagnostico || "Atención General",
      especificaciones: "Carátula restaurada automáticamente para garantizar integridad de turnos y pagos.",
      servicios: [
        {
          servicio: firstEv?.tipoServicio || "Guardia de Enfermería",
          cantidad: shiftsCount,
          precioU: unitPrice,
          precioTot: totalAmount,
          costoU: unitCost,
        },
      ],
      subtotal: totalAmount,
      descuento: 0,
      total: totalAmount,
      pagado: totalAbonado,
      pendiente: Math.max(0, totalAmount - totalAbonado),
      inicio:
        relatedEvents[0]?.fechaInicio?.replace("T", " ") ||
        `${new Date().toISOString().slice(0, 10)} 08:00`,
      fin:
        relatedEvents[relatedEvents.length - 1]?.fechaFin?.replace("T", " ") ||
        `${new Date().toISOString().slice(0, 10)} 20:00`,
      guardiasProgramadas: scheduledShifts,
    };

    newCaratulas.push(restoredCaratula);
    currentFolios.add(normFolio);
    restoredCount++;
  }

  return {
    restoredCaratulas: newCaratulas,
    restoredCount,
  };
}

