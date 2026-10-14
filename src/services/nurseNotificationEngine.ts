/**
 * Nurse Notification Engine for Cuidarte Pachuca
 * Continuously evaluates shifts and medication schedules to trigger proactive push notifications with sound.
 */

import { CalendarEvent, KardexRecord, GuardiaShiftRecord, Client, UserSession, KardexMedication } from "../types";
import { pushNotificationService } from "./pushNotificationService";

interface NotificationEngineState {
  lastKnownEventsSnapshot: Record<string, string>; // eventId -> hash
  isInitialized: boolean;
}

const engineState: NotificationEngineState = {
  lastKnownEventsSnapshot: {},
  isInitialized: false,
};

const normalizeStr = (str?: string) =>
  (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const extractDigits = (str?: string) => (str || "").replace(/\D/g, "");

/**
 * Checks if a calendar event is assigned to a specific nurse session
 */
export const isEventAssignedToNurse = (ev: CalendarEvent, userSession: UserSession): boolean => {
  const nid = userSession.nurseId || "";
  const un = userSession.username || "";
  const nm = userSession.nombre || "";

  const nurseTokens = [
    nid.toLowerCase().trim(),
    extractDigits(nid),
    un.toLowerCase().trim(),
    extractDigits(un),
    normalizeStr(nm),
  ].filter((t): t is string => Boolean(t && t.length >= 2));

  const pa = (ev.personalAsignado || "").toLowerCase();
  const sId = (ev.staffId || "").toLowerCase();
  const sNo = (ev.staffNoSocio || "").toLowerCase();
  const sNom = ((ev as any).staffNombre || "").toLowerCase();
  const allEvStaffText = `${pa} ${sId} ${sNo} ${sNom}`.toLowerCase();

  return nurseTokens.some((token) => allEvStaffText.includes(token));
};

/**
 * Extracts scheduled dose slots for today from a medication record
 */
export const getMedicationSlotsForToday = (med: KardexMedication): string[] => {
  if (med.estado !== "Activo") return [];

  // Exclude PRN / A Demanda from fixed time alarms
  const isADemanda =
    med.tipoFrecuencia === "ADemanda" ||
    (med.horario && (med.horario.toLowerCase().includes("demanda") || med.horario.toLowerCase().includes("prn")));
  if (isADemanda) return [];

  // Check if treatment ended
  if (med.fechaFinTratamiento) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (todayStr > med.fechaFinTratamiento) return [];
  }

  const rawHorario = med.horario || "";
  const slots = rawHorario.split(/[-–,/]+/).map((s) => s.trim()).filter(Boolean);

  const formattedSlots: string[] = [];
  slots.forEach((slot) => {
    const match = slot.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const formattedH = String(h).padStart(2, "0");
      const formattedM = String(m).padStart(2, "0");
      formattedSlots.push(`${formattedH}:${formattedM}`);
    }
  });

  if (formattedSlots.length > 0) {
    return Array.from(new Set(formattedSlots));
  }

  // Fallback: If no explicit slots are listed, infer from frecuencia (e.g., "Cada 8 horas")
  const freqLower = (med.frecuencia || "").toLowerCase();
  if (freqLower.includes("8") || (med.vecesAlDia && med.vecesAlDia === 3)) {
    return ["08:00", "16:00", "00:00"];
  }
  if (freqLower.includes("12") || (med.vecesAlDia && med.vecesAlDia === 2)) {
    return ["08:00", "20:00"];
  }
  if (freqLower.includes("6") || (med.vecesAlDia && med.vecesAlDia === 4)) {
    return ["06:00", "12:00", "18:00", "00:00"];
  }
  if (freqLower.includes("24") || (med.vecesAlDia && med.vecesAlDia === 1)) {
    return ["08:00"];
  }

  return [];
};

/**
 * Checks if a dose slot has already been administered today
 */
export const isSlotAdministeredToday = (med: KardexMedication, slotTime: string): boolean => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayIso = `${year}-${month}-${day}`;
  const todayDdmmyyyy = `${day}/${month}/${year}`;

  const isTodayDate = (str?: string) => {
    if (!str) return false;
    return str.startsWith(todayIso) || str.includes(todayDdmmyyyy) || str.includes(todayIso);
  };

  const logs = med.historialAdministracion || [];
  for (const log of logs) {
    if (isTodayDate(log.fechaHora)) {
      if (log.horarioProgramado && log.horarioProgramado.includes(slotTime)) {
        return true;
      }
      // If time slot matches approximately or logged within window
      if (log.tomaSlotId && log.tomaSlotId.includes(slotTime)) {
        return true;
      }
      if (log.fechaHora.includes(slotTime)) {
        return true;
      }
    }
  }

  // Also check single ultimaAdministracion fallback
  if (med.ultimaAdministracion && isTodayDate(med.ultimaAdministracion)) {
    if (med.ultimaAdministracion.includes(slotTime)) {
      return true;
    }
    // If only 1 dose per day and administered today
    if (getMedicationSlotsForToday(med).length <= 1) {
      return true;
    }
  }

  return false;
};

/**
 * Main evaluation tick executed periodically
 */
export const evaluateNurseNotifications = (params: {
  userSession: UserSession;
  calendarEvents: CalendarEvent[];
  kardexRecords: KardexRecord[];
  guardiaRecords: GuardiaShiftRecord[];
  clients: Client[];
  activeGuardia?: GuardiaShiftRecord | null;
}) => {
  const { userSession, calendarEvents, kardexRecords, clients, activeGuardia } = params;

  if (!userSession || userSession.role !== "nurse") {
    return;
  }

  const now = new Date();
  const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayIso = `${year}-${month}-${day}`;
  const todayDdmmyyyy = `${day}/${month}/${year}`;

  // Filter events strictly for this nurse
  const nurseEvents = calendarEvents.filter((ev) => isEventAssignedToNurse(ev, userSession));

  // =========================================================================
  // 1. ASIGNACIÓN DE NUEVA GUARDIA O CAMBIO EN SU CALENDARIO
  // =========================================================================
  const currentEventsMap: Record<string, string> = {};
  nurseEvents.forEach((ev) => {
    const hash = `${ev.titulo || ""}|${ev.fechaInicio || ""}|${ev.fechaFin || ""}|${ev.clientId || ""}|${ev.estado || ""}|${ev.personalAsignado || ""}|${ev.notas || ""}`;
    currentEventsMap[ev.id] = hash;
  });

  if (engineState.isInitialized) {
    nurseEvents.forEach((ev) => {
      const client = clients.find((c) => (c.id || "").toUpperCase() === (ev.clientId || "").toUpperCase());
      const clientName = client?.nombreCompletoCliente || client?.nombreCompletoRS || ev.clientNombre || "Receptor de servicio";
      const previousHash = engineState.lastKnownEventsSnapshot[ev.id];

      // A) New Shift Assigned
      if (!previousHash) {
        pushNotificationService.notify({
          category: "shift_new",
          title: "📅 Nueva guardia asignada en tu calendario",
          body: `Se te ha asignado la guardia "${ev.titulo || "Turno de enfermería"}" con ${clientName} (${ev.fechaInicio?.replace("T", " ") || "Horario programado"}).`,
          soundType: "new_shift",
          actionType: "open_calendar",
          actionPayload: {
            eventId: ev.id,
            clientId: ev.clientId,
            clientNombre: clientName,
          },
          dedupKey: `notif_shift_assigned_${ev.id}_${ev.fechaInicio || todayIso}`,
        });
      }
      // B) Shift Modified / Updated
      else if (previousHash !== currentEventsMap[ev.id]) {
        pushNotificationService.notify({
          category: "shift_change",
          title: "🔄 Cambio en tu calendario de guardia",
          body: `Se ha modificado la guardia "${ev.titulo || "Turno"}" con ${clientName}. Nuevo horario: ${ev.fechaInicio?.replace("T", " ") || "Revisa tu agenda"}.`,
          soundType: "shift_modified",
          actionType: "open_calendar",
          actionPayload: {
            eventId: ev.id,
            clientId: ev.clientId,
            clientNombre: clientName,
          },
          dedupKey: `notif_shift_mod_${ev.id}_${Date.now()}`,
        });
      }
    });
  }

  engineState.lastKnownEventsSnapshot = currentEventsMap;
  engineState.isInitialized = true;

  // =========================================================================
  // 2. MEDICAMENTOS: 5 MINUTOS ANTES Y RETRASOS / NO APLICADOS
  // =========================================================================
  // When active shift: evaluate the active patient's kardex.
  // Also evaluate assigned patients scheduled for today.
  const todayAssignedClientIds = Array.from(
    new Set([
      ...(activeGuardia?.clientId ? [activeGuardia.clientId.toUpperCase()] : []),
      ...nurseEvents
        .filter((ev) => {
          const fInicio = ev.fechaInicio || "";
          return fInicio.startsWith(todayIso) || fInicio.includes(todayDdmmyyyy);
        })
        .map((ev) => (ev.clientId || "").toUpperCase())
        .filter(Boolean),
    ])
  );

  const relevantKardexRecords = kardexRecords.filter((k) =>
    todayAssignedClientIds.includes((k.clientId || "").toUpperCase())
  );

  relevantKardexRecords.forEach((kardex) => {
    const client = clients.find((c) => (c.id || "").toUpperCase() === (kardex.clientId || "").toUpperCase());
    const clientName = client?.nombreCompletoCliente || client?.nombreCompletoRS || kardex.clientNombre || "Receptor de servicio";

    (kardex.medicamentos || []).forEach((med) => {
      if (med.estado !== "Activo") return;
      const slots = getMedicationSlotsForToday(med);

      slots.forEach((slot) => {
        const [slotHStr, slotMStr] = slot.split(":");
        const slotH = parseInt(slotHStr || "0", 10);
        const slotM = parseInt(slotMStr || "0", 10);
        const slotMinutesSinceMidnight = slotH * 60 + slotM;

        const diffMinutes = currentMinutesSinceMidnight - slotMinutesSinceMidnight;
        const isDoseGiven = isSlotAdministeredToday(med, slot);

        if (!isDoseGiven) {
          // A) 5 MINUTOS ANTES DE LA HORA (Ventana de 4 a 6 minutos antes)
          if (diffMinutes >= -6 && diffMinutes <= -4) {
            pushNotificationService.notify({
              category: "med_5min",
              title: `💊 Medicamento en 5 min: ${med.nombreMedicamento}`,
              body: `Dosis: ${med.dosis} (${med.via || "Vía indicada"}) para ${clientName}. Hora programada: ${slot} hrs. Prepara el suministro.`,
              soundType: "medication_5min",
              actionType: "open_kardex",
              actionPayload: {
                clientId: kardex.clientId,
                clientNombre: clientName,
                medId: med.id,
                medNombre: med.nombreMedicamento,
                horario: slot,
              },
              dedupKey: `notif_med_5m_${med.id}_${slot}_${todayIso}`,
            });
          }

          // B) MEDICAMENTO YA SE PASÓ Y NO LO HAN APLICADO (Ventana de 1 a 180 min después de la hora)
          if (diffMinutes >= 1 && diffMinutes <= 180) {
            pushNotificationService.notify({
              category: "med_overdue",
              title: `⚠️ Medicamento pendiente / no aplicado: ${med.nombreMedicamento}`,
              body: `La dosis de ${med.dosis} para ${clientName} debía administrarse a las ${slot} hrs y aún no ha sido registrada. Por favor verifica y registra en Kárdex.`,
              soundType: "medication_overdue",
              actionType: "open_kardex",
              actionPayload: {
                clientId: kardex.clientId,
                clientNombre: clientName,
                medId: med.id,
                medNombre: med.nombreMedicamento,
                horario: slot,
              },
              dedupKey: `notif_med_overdue_${med.id}_${slot}_${todayIso}`,
            });
          }
        }
      });
    });
  });

  // =========================================================================
  // 3. TURNO DE GUARDIA PRÓXIMO A INICIAR (Puntualidad e inicio de bitácora)
  // =========================================================================
  // Checks today's shifts scheduled to start in 15 to 30 minutes
  nurseEvents.forEach((ev) => {
    if (!ev.fechaInicio) return;
    const fInicio = ev.fechaInicio;
    const isToday = fInicio.startsWith(todayIso) || fInicio.includes(todayDdmmyyyy);
    if (!isToday) return;

    // Check if shift is already active
    const isShiftActive = activeGuardia && activeGuardia.estatus === "En Curso";
    if (isShiftActive) return;

    // Extract start time in minutes
    let startMinutes: number | null = null;
    if (fInicio.includes("T")) {
      const timePart = fInicio.split("T")[1];
      const [h, m] = timePart.split(":");
      startMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    } else {
      const match = fInicio.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        startMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
    }

    if (startMinutes !== null) {
      const diffToStart = startMinutes - currentMinutesSinceMidnight;
      // Trigger between 15 and 30 minutes before start time
      if (diffToStart >= 10 && diffToStart <= 30) {
        const client = clients.find((c) => (c.id || "").toUpperCase() === (ev.clientId || "").toUpperCase());
        const clientName = client?.nombreCompletoCliente || client?.nombreCompletoRS || ev.clientNombre || "Receptor de servicio";
        const horaStr = `${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}`;

        pushNotificationService.notify({
          category: "shift_start_soon",
          title: "⏰ Turno de guardia próximo a iniciar",
          body: `Tu guardia con ${clientName} inicia a las ${horaStr} hrs (${diffToStart} min restantes). Llega con puntualidad e inicia tu turno para habilitar la bitácora clínica.`,
          soundType: "shift_starting_soon",
          actionType: "start_guardia",
          actionPayload: {
            eventId: ev.id,
            clientId: ev.clientId,
            clientNombre: clientName,
            horario: horaStr,
          },
          dedupKey: `notif_shift_start_soon_${ev.id}_${todayIso}`,
        });
      }
    }
  });

  // =========================================================================
  // 4. TURNO DE GUARDIA 10 MINUTOS DESPUÉS DE VENCER SEGÚN HORARIO ASIGNADO
  // =========================================================================
  // Checks shifts where fechaFin has passed by 10 to 60 minutes and shift has not been closed
  nurseEvents.forEach((ev) => {
    if (!ev.fechaFin) return;
    const fFin = ev.fechaFin;
    const isToday = fFin.startsWith(todayIso) || fFin.includes(todayDdmmyyyy);
    if (!isToday) return;

    let endMinutes: number | null = null;
    if (fFin.includes("T")) {
      const timePart = fFin.split("T")[1];
      const [h, m] = timePart.split(":");
      endMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    } else {
      const match = fFin.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        endMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      }
    }

    if (endMinutes !== null) {
      const diffSinceEnd = currentMinutesSinceMidnight - endMinutes;
      // Trigger between 10 and 35 minutes after scheduled end time
      if (diffSinceEnd >= 10 && diffSinceEnd <= 35) {
        const client = clients.find((c) => (c.id || "").toUpperCase() === (ev.clientId || "").toUpperCase());
        const clientName = client?.nombreCompletoCliente || client?.nombreCompletoRS || ev.clientNombre || "Receptor de servicio";
        const horaFinStr = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

        pushNotificationService.notify({
          category: "shift_end_10min",
          title: "⏳ Horario de guardia cumplido (+10 min)",
          body: `Han transcurrido 10 minutos desde el horario de fin de tu guardia (${horaFinStr} hrs) con ${clientName}. Recuerda registrar las notas de entrega y finalizar turno en bitácora.`,
          soundType: "shift_ended_10min",
          actionType: "end_guardia",
          actionPayload: {
            eventId: ev.id,
            clientId: ev.clientId,
            clientNombre: clientName,
            horario: horaFinStr,
          },
          dedupKey: `notif_shift_end_10m_${ev.id}_${todayIso}`,
        });
      }
    }
  });
};
