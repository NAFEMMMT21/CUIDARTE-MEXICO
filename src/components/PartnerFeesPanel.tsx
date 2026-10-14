import React, { useState, useMemo } from "react";
import {
  StaffMember,
  UserSession,
  Caratula,
  CalendarEvent,
  Expense,
  GuardiaShiftRecord,
} from "../types";
import {
  DollarSign,
  Coins,
  Wallet,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileSignature,
  FileCheck,
  ChevronRight,
  Filter,
  ExternalLink,
  Info,
  BadgeCheck,
} from "lucide-react";

interface PartnerFeesPanelProps {
  myStaffMember: StaffMember;
  userSession: UserSession;
  caratulas: Caratula[];
  allNurseEvents: CalendarEvent[];
  expenses: Expense[];
  guardiaRecords?: GuardiaShiftRecord[];
  onOpenTermsModal?: () => void;
}

const formatCurrency = (val: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(val || 0);

export const PartnerFeesPanel: React.FC<PartnerFeesPanelProps> = ({
  myStaffMember,
  userSession,
  caratulas = [],
  allNurseEvents = [],
  expenses = [],
  guardiaRecords = [],
  onOpenTermsModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"guardias" | "pagos">("guardias");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendientes" | "liquidados">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  const normalizeStr = (str?: string) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const extractDigits = (str?: string) => (str || "").replace(/\D/g, "");

  // Staff identification tokens for fee and payment matching
  const nurseTokens = useMemo(() => {
    return [
      myStaffMember.id?.toLowerCase().trim(),
      myStaffMember.noSocio?.toLowerCase().trim(),
      extractDigits(myStaffMember.noSocio),
      userSession.nurseId?.toLowerCase().trim(),
      extractDigits(userSession.nurseId),
      userSession.username?.toLowerCase().trim(),
      extractDigits(userSession.username),
      normalizeStr(myStaffMember.nombre),
      normalizeStr(myStaffMember.apellidos),
      normalizeStr(`${myStaffMember.nombre} ${myStaffMember.apellidos}`),
      normalizeStr(userSession.nombre),
    ].filter((t): t is string => Boolean(t && t.length >= 2));
  }, [myStaffMember, userSession]);

  // Aggregate all assigned guardias for this partner
  const partnerGuardias = useMemo(() => {
    const shiftMap = new Map<
      string,
      {
        id: string;
        folioGuardia: string;
        caratulaFolio: string;
        clientNombre: string;
        clientId: string;
        tipoServicio: string;
        fecha: string;
        horaInicio: string;
        horaFin: string;
        costoHonorarios: number;
        estado: string;
        checadaRealizada: boolean;
        source: "calendar" | "caratula";
      }
    >();

    // 1. From allNurseEvents
    allNurseEvents.forEach((ev) => {
      const folio = ev.folioGuardia || ev.id;
      const datePart = ev.fechaInicio ? ev.fechaInicio.split("T")[0] : "";
      const timeStart = ev.fechaInicio ? ev.fechaInicio.split("T")[1]?.slice(0, 5) || "08:00" : "08:00";
      const timeEnd = ev.fechaFin ? ev.fechaFin.split("T")[1]?.slice(0, 5) || "20:00" : "20:00";

      // Check if there is a real checador record for this shift
      const hasChecada = guardiaRecords.some(
        (g) =>
          g.folioGuardia === folio ||
          (g.fechaInicio && g.fechaInicio.startsWith(datePart) && g.caratulaFolio === ev.caratulaFolio)
      );

      shiftMap.set(folio, {
        id: ev.id,
        folioGuardia: folio,
        caratulaFolio: ev.caratulaFolio || "",
        clientNombre: ev.clientNombre || "Receptor de Servicios Cuidarte",
        clientId: ev.clientId || "",
        tipoServicio: ev.tipoServicio || "Guardia de Enfermería",
        fecha: datePart,
        horaInicio: timeStart,
        horaFin: timeEnd,
        costoHonorarios: typeof ev.costoHonorarios === "number" ? ev.costoHonorarios : 0,
        estado: ev.estado || "Programado",
        checadaRealizada: hasChecada,
        source: "calendar",
      });
    });

    // 2. From caratulas.guardiasProgramadas
    caratulas.forEach((c) => {
      (c.guardiasProgramadas || []).forEach((g) => {
        const isAssigned =
          (g.staffId && (g.staffId === myStaffMember.id || g.staffId === userSession.nurseId)) ||
          (g.staffNoSocio && g.staffNoSocio === myStaffMember.noSocio) ||
          nurseTokens.some((tok) => (g.personalAsignado || "").toLowerCase().includes(tok));

        if (!isAssigned) return;

        const folio = g.folioGuardia || g.id;
        const existing = shiftMap.get(folio);

        const hasChecada = guardiaRecords.some(
          (gr) =>
            gr.folioGuardia === folio ||
            (gr.fechaInicio && gr.fechaInicio.startsWith(g.fecha) && gr.caratulaFolio === c.folio)
        );

        if (!existing) {
          shiftMap.set(folio, {
            id: g.id,
            folioGuardia: folio,
            caratulaFolio: c.folio,
            clientNombre: c.nombreCompletoCliente || "Receptor de Servicios Cuidarte",
            clientId: c.id || "",
            tipoServicio: g.tipoServicio || c.servicios?.[0]?.servicio || "Guardia de Enfermería",
            fecha: g.fecha || "",
            horaInicio: g.horaInicio || "08:00",
            horaFin: g.horaFin || "20:00",
            costoHonorarios: typeof g.costoHonorarios === "number" ? g.costoHonorarios : 0,
            estado: "Programado",
            checadaRealizada: hasChecada,
            source: "caratula",
          });
        } else {
          // Enrich missing caratula or fees if caratula has them
          if (!existing.caratulaFolio && c.folio) existing.caratulaFolio = c.folio;
          if ((!existing.costoHonorarios || existing.costoHonorarios === 0) && typeof g.costoHonorarios === "number") {
            existing.costoHonorarios = g.costoHonorarios;
          }
          if (hasChecada) existing.checadaRealizada = true;
        }
      });
    });

    return Array.from(shiftMap.values()).sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [allNurseEvents, caratulas, myStaffMember, userSession.nurseId, nurseTokens, guardiaRecords]);

  // Aggregate payments / expenses directed to this partner
  const partnerPayments = useMemo(() => {
    const nurseCaratulaFolios = partnerGuardias.map((g) => g.caratulaFolio).filter(Boolean);

    return expenses
      .filter((e) => {
        if (e.estado === "Cancelado") return false;

        const isFeeCategory =
          e.categoria === "Honorarios Enfermería" ||
          e.categoria === "Nómina y Personal" ||
          e.categoria === "Otros Operativos";

        if (!isFeeCategory) return false;

        const expStaffId = ((e as any).staffId || "").toLowerCase();
        const expStaffNoSocio = ((e as any).staffNoSocio || "").toLowerCase();
        const expConcept = (e.concepto || "").toLowerCase();
        const expNotas = (e.notas || "").toLowerCase();
        const fullExpText = `${expStaffId} ${expStaffNoSocio} ${expConcept} ${expNotas}`;

        // Direct match with staff tokens
        const matchesNurse = nurseTokens.some((tok) => fullExpText.includes(tok));
        if (matchesNurse) return true;

        // Association by caratula where this partner served AND mentions fees or partner
        if (e.caratulaFolio && nurseCaratulaFolios.includes(e.caratulaFolio)) {
          if (
            expConcept.includes("honorario") ||
            expConcept.includes("enferm") ||
            expConcept.includes("turno") ||
            expConcept.includes("guardia")
          ) {
            return true;
          }
        }

        return false;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [expenses, nurseTokens, partnerGuardias]);

  // Financial Summary Totals
  const totalDevengado = useMemo(() => {
    return partnerGuardias.reduce((sum, g) => sum + (g.costoHonorarios || 0), 0);
  }, [partnerGuardias]);

  const totalPagado = useMemo(() => {
    return partnerPayments.reduce((sum, p) => sum + (p.monto || 0), 0);
  }, [partnerPayments]);

  const totalPendiente = Math.max(0, totalDevengado - totalPagado);

  // Filtered lists based on search & filter
  const filteredGuardias = useMemo(() => {
    return partnerGuardias.filter((g) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        g.folioGuardia.toLowerCase().includes(q) ||
        g.caratulaFolio.toLowerCase().includes(q) ||
        g.clientNombre.toLowerCase().includes(q) ||
        g.tipoServicio.toLowerCase().includes(q) ||
        g.fecha.includes(q);

      return matchesSearch;
    });
  }, [partnerGuardias, searchTerm]);

  const filteredPayments = useMemo(() => {
    return partnerPayments.filter((p) => {
      const q = searchTerm.toLowerCase();
      return (
        !searchTerm ||
        p.id.toLowerCase().includes(q) ||
        p.caratulaFolio.toLowerCase().includes(q) ||
        p.concepto.toLowerCase().includes(q) ||
        p.timestamp.includes(q)
      );
    });
  }, [partnerPayments, searchTerm]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* BANNER INSTITUCIONAL: CLUB DE SOCIOS CUIDARTE MÉXICO */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase">
              <BadgeCheck className="w-4 h-4 text-emerald-400" />
              <span>Club de Socios Cuidarte México • Membresía Activa</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Desglose de Pagos y Liquidación de Honorarios
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Consulte de forma transparente el saldo pendiente por liquidar de sus honorarios acordados por las guardias cubiertas bajo su membresía.
            </p>
          </div>

          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-4 rounded-2xl shrink-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Identificación de Socio
            </span>
            <span className="text-lg font-mono font-black text-emerald-400">
              SOC-{myStaffMember.noSocio}
            </span>
            <span className="text-xs font-bold text-slate-200 mt-0.5">
              {myStaffMember.nombre} {myStaffMember.apellidos}
            </span>
            {onOpenTermsModal && (
              <button
                type="button"
                onClick={onOpenTermsModal}
                className="mt-2.5 text-[11px] text-sky-400 hover:text-sky-300 underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <FileSignature className="w-3.5 h-3.5" />
                <span>Ver Reglamento y Términos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI METRIC CARD: ÚNICAMENTE SALDO PENDIENTE POR LIQUIDAR */}
      <div className="w-full">
        <div
          className={`rounded-3xl p-6 sm:p-7 border shadow-sm transition ${
            totalPendiente > 0
              ? "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-white border-amber-300 ring-2 ring-amber-400/20"
              : "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white border-emerald-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Saldo Pendiente por Liquidar
              </span>
              <div
                className={`text-3xl sm:text-4xl lg:text-5xl font-black font-mono tracking-tight ${
                  totalPendiente > 0 ? "text-amber-950" : "text-emerald-900"
                }`}
              >
                {formatCurrency(totalPendiente)}
              </div>
              <div className="text-xs text-slate-600 font-semibold flex items-center gap-1.5 pt-1">
                {totalPendiente > 0 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Monto acumulado pendiente por transferir a favor del socio por guardias cubiertas</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Al corriente: sin adeudos ni honorarios pendientes por liquidar</span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div
                className={`p-4 rounded-2xl border ${
                  totalPendiente > 0
                    ? "bg-amber-100/80 text-amber-800 border-amber-300"
                    : "bg-emerald-100/80 text-emerald-800 border-emerald-300"
                }`}
              >
                <DollarSign className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RECUADRO INFORMATIVO DE MEMBRESÍA Y NO RELACIÓN LABORAL */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            <strong>Régimen de Membresía:</strong> Los honorarios reflejados corresponden a la contraprestación por servicios independientes asignados por su suscripción de membresía al Club de Socios Cuidarte México, rigiéndose bajo el reglamento y procedimientos internos de socio.
          </span>
        </div>
        {onOpenTermsModal && (
          <button
            type="button"
            onClick={onOpenTermsModal}
            className="text-emerald-700 font-bold hover:text-emerald-800 underline shrink-0 cursor-pointer"
          >
            Consultar Cláusulas de Socio
          </button>
        )}
      </div>

      {/* TABS DE DETALLE: GUARDIAS / HONORARIOS vs PAGOS RECIBIDOS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab("guardias")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === "guardias"
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Guardias y Honorarios Asignados ({partnerGuardias.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("pagos")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeSubTab === "pagos"
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Historial de Pagos Liquidados ({partnerPayments.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Buscar folio, carátula o fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 w-full sm:w-60"
            />
          </div>
        </div>

        {/* SUBTAB 1: GUARDIAS Y HONORARIOS POR CARÁTULA */}
        {activeSubTab === "guardias" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Listado de turnos asignados vinculados a una Carátula de Servicio</span>
            </div>

            {filteredGuardias.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-300" />
                <p>No se encontraron guardias asignadas con los criterios de búsqueda.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {filteredGuardias.map((g) => (
                  <div
                    key={g.id}
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          🛡️ {g.folioGuardia}
                        </span>

                        {g.caratulaFolio ? (
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Carátula: Folio {g.caratulaFolio}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            Sin Carátula vinculada
                          </span>
                        )}

                        {g.checadaRealizada ? (
                          <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Checada Registrada
                          </span>
                        ) : (
                          <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                            {g.estado}
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-slate-900 text-sm">
                        {g.clientNombre}
                      </div>

                      <div className="text-slate-500 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {g.fecha}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {g.horaInicio} - {g.horaFin}
                        </span>
                        <span className="text-slate-600 font-medium">
                          {g.tipoServicio}
                        </span>
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Honorarios Acordados
                      </span>
                      <span className="text-base font-black font-mono text-emerald-700">
                        {g.costoHonorarios > 0 ? formatCurrency(g.costoHonorarios) : "Por definir"}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Cuota neta por guardia
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: HISTORIAL DE PAGOS RECIBIDOS (CUÁNDO YA SE LE PAGÓ) */}
        {activeSubTab === "pagos" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Historial de pagos liquidados por la agencia con fecha, hora y comprobante</span>
            </div>

            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                <Wallet className="w-8 h-8 mx-auto text-slate-300" />
                <p>No se registran egresos ni liquidaciones efectuadas aún.</p>
                <p className="text-[10px] text-slate-400">
                  Tan pronto administración liquide un pago o transferencia a su nombre, aparecerá desglosado aquí.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {filteredPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {p.id}
                        </span>

                        {p.caratulaFolio && (
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Carátula: Folio {p.caratulaFolio}
                          </span>
                        )}

                        <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Liquidado / Pagado
                        </span>
                      </div>

                      <div className="font-bold text-slate-900 text-sm">
                        {p.concepto}
                      </div>

                      <div className="text-slate-500 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Fecha de Pago: {p.timestamp}
                        </span>
                        {p.registradoPor && (
                          <span className="text-slate-600">
                            Registrado por: {p.registradoPor}
                          </span>
                        )}
                        {p.notas && (
                          <span className="text-slate-500 italic">
                            Nota: {p.notas}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Monto Liquidado
                      </span>
                      <span className="text-base font-black font-mono text-sky-800">
                        {formatCurrency(p.monto)}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold">
                        Efectuado con éxito
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
