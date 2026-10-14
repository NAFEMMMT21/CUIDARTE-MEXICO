import { useEffect, useRef } from "react";
import { UserSession, CalendarEvent, KardexRecord, GuardiaShiftRecord, Client } from "../types";
import { evaluateNurseNotifications } from "../services/nurseNotificationEngine";
import { pushNotificationService } from "../services/pushNotificationService";

interface UseNurseNotificationEngineProps {
  userSession: UserSession | null;
  calendarEvents: CalendarEvent[];
  kardexRecords: KardexRecord[];
  guardiaRecords: GuardiaShiftRecord[];
  clients: Client[];
  activeGuardia?: GuardiaShiftRecord | null;
}

export function useNurseNotificationEngine({
  userSession,
  calendarEvents,
  kardexRecords,
  guardiaRecords,
  clients,
  activeGuardia,
}: UseNurseNotificationEngineProps) {
  const latestPropsRef = useRef({
    userSession,
    calendarEvents,
    kardexRecords,
    guardiaRecords,
    clients,
    activeGuardia,
  });

  useEffect(() => {
    latestPropsRef.current = {
      userSession,
      calendarEvents,
      kardexRecords,
      guardiaRecords,
      clients,
      activeGuardia,
    };
  }, [userSession, calendarEvents, kardexRecords, guardiaRecords, clients, activeGuardia]);

  // Keep screen wake lock active if nurse is on an active shift to prevent mobile OS sleep
  useEffect(() => {
    if (activeGuardia && activeGuardia.estatus === "En Curso") {
      pushNotificationService.acquireWakeLock().catch(() => {});
    } else {
      pushNotificationService.releaseWakeLock();
    }
    return () => {
      pushNotificationService.releaseWakeLock();
    };
  }, [activeGuardia?.id, activeGuardia?.estatus]);

  useEffect(() => {
    if (!userSession || userSession.role !== "nurse") {
      return;
    }

    // Run immediately on mount or user session change
    evaluateNurseNotifications(latestPropsRef.current as any);

    // Periodic evaluation every 10 seconds
    const interval = setInterval(() => {
      if (latestPropsRef.current.userSession?.role === "nurse") {
        evaluateNurseNotifications(latestPropsRef.current as any);
      }
    }, 10000);

    // Run immediately upon waking up, switching back to tab, or unlocking screen
    const handleWakeOrFocus = () => {
      if (latestPropsRef.current.userSession?.role === "nurse") {
        evaluateNurseNotifications(latestPropsRef.current as any);
      }
    };

    document.addEventListener("visibilitychange", handleWakeOrFocus);
    window.addEventListener("focus", handleWakeOrFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleWakeOrFocus);
      window.removeEventListener("focus", handleWakeOrFocus);
    };
  }, [userSession?.username, userSession?.nurseId, userSession?.role]);

  // Reactive trigger on data updates
  useEffect(() => {
    if (userSession && userSession.role === "nurse") {
      evaluateNurseNotifications({
        userSession,
        calendarEvents,
        kardexRecords,
        guardiaRecords,
        clients,
        activeGuardia,
      });
    }
  }, [calendarEvents, kardexRecords, guardiaRecords, activeGuardia]);
}
