import React from "react";
import { KardexRecord, KardexMedication, Client, Caratula } from "../types";
import { CuidarteLogo } from "./CuidarteLogo";
import { Pill, AlertTriangle, Clock, CheckCircle2, Shield, Heart } from "lucide-react";

interface KardexDocumentProps {
  kardexRecord?: KardexRecord | null;
  client?: Client;
  caratula?: Caratula;
  documentRef?: React.RefObject<HTMLDivElement | null>;
  sucursalId?: string;
  sucursalNombre?: string;
}

export const KardexDocument: React.FC<KardexDocumentProps> = ({
  kardexRecord,
  client,
  caratula,
  documentRef,
  sucursalId,
  sucursalNombre,
}) => {
  const patientName =
    client?.nombreCompletoRS ||
    caratula?.nombreCompletoRS ||
    client?.nombreCompletoCliente ||
    caratula?.nombreCompletoCliente ||
    kardexRecord?.patientName ||
    "Receptor de Servicio";

  const clientId = client?.id || caratula?.id || kardexRecord?.clientId || "CLI-000";
  const diagnostico =
    client?.diagnostico ||
    caratula?.diagnostico ||
    "Atención Domiciliaria Integrativa y Cuidados de Enfermería";

  const alergias = kardexRecord?.alergias || "Sin alergias declaradas";
  const notasGenerales = kardexRecord?.notasGenerales || "";

  const medications: KardexMedication[] = kardexRecord?.medicamentos || [];
  const activeMeds = medications.filter((m) => m.estado === "Activo");
  const inactiveMeds = medications.filter((m) => m.estado === "Suspendido" || m.estado === "Completado");

  // Build Chronological takes list
  const timeMap = new Map<string, { med: KardexMedication; via: string; dosis: string }[]>();
  activeMeds.forEach((med) => {
    const rawTimes = (med.horario || "").split(/[-–,/]+/).map((s) => s.trim()).filter(Boolean);
    const validTimes = rawTimes.filter((t) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));
    const finalTimes = validTimes.length > 0 ? validTimes : ["08:00"];

    finalTimes.forEach((time) => {
      const [hStr, mStr] = time.split(":");
      const normalizedTime = `${hStr.padStart(2, "0")}:${(mStr || "00").padStart(2, "0")}`;
      if (!timeMap.has(normalizedTime)) {
        timeMap.set(normalizedTime, []);
      }
      timeMap.get(normalizedTime)!.push({
        med,
        via: med.via || "Oral",
        dosis: med.dosis || "1 dosis",
      });
    });
  });

  const sortedScheduleTimes = Array.from(timeMap.keys()).sort();

  return (
    <div
      ref={documentRef}
      id="kardex-official-document"
      className="bg-white text-slate-900 p-4 sm:p-8 max-w-[850px] mx-auto shadow-2xl border border-slate-200 text-xs font-sans print:shadow-none print:p-3 print:border-none print:max-w-none print:w-full select-none rounded-xl sm:rounded-2xl"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* Top Header metadata */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 mb-2 border-b border-slate-200 pb-1.5 font-mono">
        <span className="flex items-center gap-1">
          <span>EMISIÓN:</span>
          <strong>{new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</strong>
          <span>•</span>
          <span>{new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>
        </span>
        <span className="font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          CONTROL KÁRDEX DE MEDICACIÓN
        </span>
      </div>

      {/* Brand Header */}
      <div className="flex justify-center mb-3">
        <CuidarteLogo
          size="lg"
          showTagline={true}
          variant="document"
          sucursalId={sucursalId || client?.sucursalId || caratula?.sucursalId}
          sucursalNombre={sucursalNombre || client?.sucursalNombre || caratula?.sucursalNombre}
        />
      </div>

      {/* Document Title Header */}
      <div className="text-center my-3 border-t-2 border-b-2 border-slate-900 py-2.5 bg-slate-50">
        <h1 className="text-base font-black uppercase tracking-widest text-slate-900">
          KÁRDEX DE MEDICACIÓN Y CUIDADOS DE ENFERMERÍA
        </h1>
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          HOJA OFICIAL DE ADMINISTRACIÓN, HORARIOS Y CONTROL FARMACOLÓGICO DOMICILIARIO
        </p>
      </div>

      {/* Patient & Service Data Box */}
      <div className="border border-slate-800 mb-4 bg-white rounded-xs overflow-hidden">
        <div className="bg-slate-900 text-white font-bold text-center py-1 text-[11px] uppercase tracking-wider">
          DATOS DEL RECEPTOR DE SERVICIO Y ESPECIFICACIONES DE ATENCIÓN
        </div>
        <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-[11px]">
          <div className="col-span-2">
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Receptor de Servicio</span>
            <span className="font-black text-sm text-slate-900 uppercase">{patientName}</span>
          </div>

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">ID Expediente / Cliente</span>
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
              {clientId}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-2">
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Diagnóstico Principal</span>
            <span className="font-semibold text-slate-800">{diagnostico}</span>
          </div>

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Médico Tratante / Titular</span>
            <span className="font-semibold text-slate-800">
              {client?.medicoTratante || client?.nombreCompletoCliente || "Atención Domiciliaria Cuidarte"}
            </span>
          </div>
        </div>

        {/* Highlighted Allergies Warning Banner */}
        <div className="bg-rose-50 border-t border-rose-200 px-3.5 py-2 flex items-center gap-2 text-rose-950 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold uppercase tracking-wider text-rose-800 mr-1.5">ALERGIAS DECLARADAS:</span>
            <span className="font-black text-rose-900 bg-white px-2 py-0.5 rounded border border-rose-300 shadow-xs">
              {alergias}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: MEDICAMENTOS ACTIVOS PROGRAMADOS */}
      <div className="mb-5">
        <div className="bg-emerald-800 text-white font-bold px-3 py-1.5 text-[11px] uppercase tracking-wide flex items-center justify-between rounded-t">
          <span className="flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" />
            <span>1. MEDICAMENTOS ACTIVOS Y TRATAMIENTOS PROGRAMADOS ({activeMeds.length})</span>
          </span>
          <span className="text-[10px] font-normal opacity-90">Verificación y cumplimiento estricto</span>
        </div>

        {activeMeds.length === 0 ? (
          <div className="border border-t-0 border-slate-300 p-6 text-center text-slate-500 italic bg-slate-50">
            No existen medicamentos activos registrados en este momento para el receptor de servicio.
          </div>
        ) : (
          <table className="w-full text-[10.5px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-400">
                <th className="border border-slate-400 p-1.5 w-7">#</th>
                <th className="border border-slate-400 p-1.5 text-left">MEDICAMENTO / PRESENTACIÓN</th>
                <th className="border border-slate-400 p-1.5 w-16">VÍA</th>
                <th className="border border-slate-400 p-1.5 w-20">DOSIS</th>
                <th className="border border-slate-400 p-1.5 text-left w-36">FRECUENCIA Y HORARIOS</th>
                <th className="border border-slate-400 p-1.5 text-left">DURACIÓN / INDICACIONES</th>
              </tr>
            </thead>
            <tbody>
              {activeMeds.map((med, idx) => (
                <tr key={med.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                  <td className="border border-slate-400 p-1.5 text-center font-bold font-mono text-slate-600">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-400 p-1.5">
                    <span className="font-black text-slate-900 block text-[11px]">{med.nombreMedicamento}</span>
                    {med.indicaciones && (
                      <span className="text-[9.5px] text-slate-600 italic block">{med.indicaciones}</span>
                    )}
                  </td>
                  <td className="border border-slate-400 p-1.5 text-center font-semibold text-slate-800">
                    {med.via || "Oral"}
                  </td>
                  <td className="border border-slate-400 p-1.5 text-center font-bold text-emerald-900">
                    {med.dosis || "1 toma"}
                  </td>
                  <td className="border border-slate-400 p-1.5 font-semibold text-slate-900">
                    <span className="text-[10px] text-slate-500 block">{med.frecuencia || "Programado"}</span>
                    <span className="font-mono font-bold text-emerald-700 block bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 mt-0.5">
                      {med.horario || "08:00"}
                    </span>
                  </td>
                  <td className="border border-slate-400 p-1.5 text-[10px] text-slate-700">
                    {med.tipoTratamiento === "FinDefinido" ? (
                      <div>
                        <span className="font-bold text-slate-900">Por {med.duracionDias || 7} días</span>
                        {med.fechaFinTratamiento && (
                          <span className="block text-[9px] text-slate-500">Concluye: {med.fechaFinTratamiento}</span>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-600">Tratamiento Continuo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* SECTION 2: CRONOGRAMA DE HORARIOS DIARIOS (MATRIZ 24 HORAS) */}
      {sortedScheduleTimes.length > 0 && (
        <div className="mb-5">
          <div className="bg-slate-800 text-white font-bold px-3 py-1.5 text-[11px] uppercase tracking-wide flex items-center justify-between rounded-t">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>2. CRONOGRAMA DE HORARIOS DIARIOS (DISTRIBUCIÓN 24 HORAS)</span>
            </span>
          </div>

          <div className="border border-t-0 border-slate-400 p-3 bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {sortedScheduleTimes.map((time) => {
                const takes = timeMap.get(time) || [];
                return (
                  <div key={time} className="bg-slate-50 border border-slate-300 rounded p-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                      <span className="font-mono font-black text-xs text-slate-900 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        {time} hrs
                      </span>
                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 rounded">
                        {takes.length} toma{takes.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {takes.map((t, i) => (
                        <li key={i} className="text-[10px] text-slate-800 leading-tight">
                          <strong className="text-slate-900">• {t.med.nombreMedicamento}</strong>
                          <span className="text-slate-500 text-[9px] block ml-2">
                            ({t.dosis} - {t.via})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MEDICAMENTOS CONCLUIDOS O SUSPENDIDOS (SI EXISTEN) */}
      {inactiveMeds.length > 0 && (
        <div className="mb-5">
          <div className="bg-slate-700 text-white font-bold px-3 py-1 text-[10.5px] uppercase tracking-wide rounded-t">
            3. MEDICAMENTOS SUSPENDIDOS O CONCLUIDOS ({inactiveMeds.length})
          </div>
          <table className="w-full text-[10px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="border border-slate-300 p-1 text-left">MEDICAMENTO</th>
                <th className="border border-slate-300 p-1 w-20 text-center">DOSIS</th>
                <th className="border border-slate-300 p-1 w-28 text-center">ESTADO</th>
                <th className="border border-slate-300 p-1 text-left">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody>
              {inactiveMeds.map((med, idx) => (
                <tr key={med.id || idx} className="bg-white text-slate-600">
                  <td className="border border-slate-300 p-1 font-semibold">{med.nombreMedicamento}</td>
                  <td className="border border-slate-300 p-1 text-center">{med.dosis || "-"}</td>
                  <td className="border border-slate-300 p-1 text-center font-bold text-slate-700">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                      {med.estado}
                    </span>
                  </td>
                  <td className="border border-slate-300 p-1 text-[9.5px] italic">
                    {med.indicaciones || "Tratamiento finalizado o retirado por orden médica"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* General Notes if present */}
      {notasGenerales && (
        <div className="mb-5 border border-slate-300 rounded p-3 bg-amber-50/50 text-[10.5px]">
          <span className="font-bold uppercase text-amber-900 block mb-1">Notas de Enfermería y Observaciones Generales:</span>
          <p className="text-slate-800 leading-relaxed">{notasGenerales}</p>
        </div>
      )}

      {/* Signatures & Validation Section */}
      <div className="mt-8 pt-4 border-t-2 border-slate-800">
        <div className="grid grid-cols-2 gap-12 text-center text-[10.5px]">
          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma y Cédula Profesional</span>
            </div>
            <p className="font-black uppercase text-slate-900">PERSONAL DE ENFERMERÍA EN TURNO</p>
            <p className="text-[9.5px] text-slate-600">{sucursalNombre || client?.sucursalNombre || caratula?.sucursalNombre || "Cuidarte México"} - Cuidados Integrales</p>
          </div>

          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma de Enterado / Conformidad</span>
            </div>
            <p className="font-black uppercase text-slate-900">RECEPTOR / TITULAR RESPONSABLE</p>
            <p className="text-[9.5px] text-slate-600">Conformidad con el Plan de Medicación</p>
          </div>
        </div>
      </div>

      {/* Institutional Legal & Contact Footer */}
      <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          {(sucursalNombre || client?.sucursalNombre || caratula?.sucursalNombre || "Cuidarte México").toUpperCase()} • Cuidado Integral, Confianza Total • Tel. 771 454 0072 • Urgencias: 771 454 0072 Ext. 911
        </p>
        <p className="text-slate-400">
          www.cuidartemexico.com • Este documento es de carácter oficial y confidencial para la atención domiciliaria.
        </p>
      </div>
    </div>
  );
};
