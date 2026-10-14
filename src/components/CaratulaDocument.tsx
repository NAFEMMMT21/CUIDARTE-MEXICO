import React from "react";
import { Caratula } from "../types";
import { CuidarteLogo } from "./CuidarteLogo";
import { formatCurrency, getVerificationToken } from "../utils/formatters";

interface CaratulaDocumentProps {
  caratula: Caratula;
  documentRef?: React.RefObject<HTMLDivElement | null>;
}

const formatShiftPresetLabel = (preset?: string) => {
  switch (preset) {
    case "12h_dia":
      return "☀️ Diurna 12h";
    case "12h_noche":
      return "🌙 Nocturna 12h";
    case "24h":
      return "⏱️ 24 Horas";
    case "8h_mat":
      return "🌅 Matutina 8h";
    case "8h_vesp":
      return "🌆 Vespertina 8h";
    case "8h_noc":
      return "🌃 Nocturna 8h";
    default:
      return "⚙️ Especial";
  }
};

const formatShiftDateDisplay = (dateStr: string) => {
  if (!dateStr) return "-";
  let cleanDate = dateStr;
  if (cleanDate.includes("T")) {
    cleanDate = cleanDate.split("T")[0];
  }
  if (cleanDate.includes("-")) {
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month - 1, day);
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const dayName = dayNames[d.getDay()] || "";
        const dd = String(day).padStart(2, "0");
        const mm = String(month).padStart(2, "0");
        return `${dayName} ${dd}/${mm}/${year}`;
      }
    }
  }
  return dateStr;
};

export const CaratulaDocument: React.FC<CaratulaDocumentProps> = ({
  caratula,
  documentRef,
}) => {
  // Render all services dynamically without limiting to 4 items
  const rawServices = caratula.servicios || [];
  const validServices = rawServices.filter(
    (s) => (s.servicio && s.servicio.trim().length > 0) || (s.cantidad && s.cantidad > 0) || (s.precioU && s.precioU > 0)
  );
  const serviceLines = validServices.length > 0 ? validServices : rawServices.length > 0 ? rawServices : [{ servicio: "", cantidad: 0, precioU: 0, precioTot: 0 }];

  const guardiasAgendadasList = caratula.guardiasProgramadas || [];

  return (
    <div
      ref={documentRef}
      id="caratula-official-document"
      className="bg-white text-black p-4 sm:p-8 max-w-[850px] mx-auto shadow-2xl border border-slate-200 text-xs font-sans print:shadow-none print:p-4 print:border-none print:max-w-none print:w-full select-none rounded-xl sm:rounded-2xl"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      {/* Top Header metadata */}
      <div className="flex justify-between items-center text-[10px] text-gray-600 mb-2 border-b border-gray-100 pb-1">
        <span>-- {caratula.timestamp || new Date().toLocaleString()} --</span>
        <span className="font-mono font-bold tracking-wider">{caratula.folio}</span>
      </div>

      {/* Brand Header */}
      <div className="flex justify-center mb-3">
        <CuidarteLogo
          size="lg"
          showTagline={true}
          variant="document"
          sucursalId={caratula.sucursalId}
          sucursalNombre={caratula.sucursalNombre}
          isMultiSucursal={
            caratula.sucursalId === "all" ||
            caratula.sucursalNombre?.trim().toLowerCase() === "cuidarte méxico" ||
            caratula.sucursalNombre?.trim().toLowerCase() === "cuidarte mexico"
          }
        />
      </div>

      {/* Cancellation Notice */}
      {caratula.estado === "Cancelado" && (
        <div className="bg-rose-100 border-2 border-rose-600 p-3 mb-4 rounded-md text-center text-rose-900 font-sans">
          <div className="text-sm font-black uppercase tracking-wider text-rose-800">
            ⛔ DOCUMENTO DE SERVICIO CANCELADO / ANULADO
          </div>
          {caratula.fechaCancelacion && (
            <p className="text-[11px] font-mono mt-0.5">
              Fecha de Cancelación: <strong>{caratula.fechaCancelacion}</strong>
            </p>
          )}
          {caratula.motivoCancelacion && (
            <p className="text-[11px] italic mt-0.5">
              Motivo: "{caratula.motivoCancelacion}"
            </p>
          )}
        </div>
      )}

      {/* Title & Folio Box */}
      <div className="text-center my-3 border-t-2 border-b-2 border-gray-900 py-2 bg-gray-50/50">
        <h1 className="text-base font-extrabold uppercase tracking-widest text-slate-900">
          {caratula.tipoDocumento === "Cotización" ? "COTIZACIÓN OFICIAL DE ASISTENCIA Y GESTIÓN" : "CARATULA DE SERVICIO"}
        </h1>
        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
          {caratula.tipoDocumento === "Cotización" ? "FOLIO DE COTIZACIÓN" : "FOLIO DE SERVICIO/CONTRATO"}
        </p>
        <div className="text-3xl font-black text-red-600 tracking-wider my-1 font-mono">
          {caratula.folio}
        </div>
        {caratula.tipoDocumento === "Cotización" && (
          <div className="mt-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10.5px] font-bold py-1 px-3 inline-block rounded-md">
            ⏱️ Cotización válida por 7 días hábiles a partir de su expedición
            {caratula.validezCotizacion && ` (Vence: ${caratula.validezCotizacion})`}
          </div>
        )}
      </div>

      {/* Client ID */}
      <div className="mb-3 font-bold text-[11px] px-1">
        ID CLIENTE: <span className="font-mono text-slate-800">{caratula.id || "CLI-000"}</span>
      </div>

      {caratula.tipoDocumento === "Cotización" ? (
        /* COTIZACIÓN CLIENT DATA BOX */
        <div className="border border-gray-800 mb-4 bg-white text-[11px]">
          <div className="bg-gray-100 font-bold text-center py-1 border-b border-gray-800 uppercase tracking-tight text-gray-900">
            DATOS DEL CLIENTE Y PACIENTE
          </div>
          <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <span className="font-bold">NOMBRE DEL CLIENTE: </span>
              <span className="uppercase">{caratula.nombreCompletoCliente || "-"}</span>
            </div>
            <div>
              <span className="font-bold">TELÉFONO DE CONTACTO: </span>
              <span>{caratula.numeroContacto || "-"}</span>
            </div>
            <div>
              <span className="font-bold">EDAD DEL PACIENTE: </span>
              <span>{caratula.edad ? `${caratula.edad} AÑOS` : "-"}</span>
            </div>
            <div>
              <span className="font-bold">DIAGNÓSTICO DEL PACIENTE: </span>
              <span className="capitalize">{caratula.diagnostico || "-"}</span>
            </div>
            <div className="col-span-2 pt-1 border-t border-gray-200">
              <span className="font-bold block text-[10px] text-gray-700 uppercase">
                ESPECIFICACIONES:
              </span>
              <span className="text-[10.5px] leading-snug">{caratula.especificaciones || "-"}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Two Column Table: Client vs Receptor */
        <div className="grid grid-cols-2 gap-0 border border-gray-800 mb-4 bg-white text-[11px]">
          {/* Left Column: DATOS DE "EL CLIENTE" */}
          <div className="border-r border-gray-800 flex flex-col justify-between">
            <div className="bg-gray-100 font-bold text-center py-1 border-b border-gray-800 uppercase tracking-tight text-gray-900">
              DATOS DE "EL CLIENTE"
            </div>
            <div className="bg-gray-50 font-bold text-center py-0.5 border-b border-gray-800 text-[10px] uppercase text-gray-700">
              DATOS DE CONTACTO
            </div>
            <div className="p-2 space-y-1">
              <div>
                <span className="font-bold">NOMBRE: </span>
                <span className="uppercase">{caratula.nombreCompletoCliente || "-"}</span>
              </div>
              <div>
                <span className="font-bold">TELEFONO: </span>
                <span>{caratula.numeroContacto || "-"}</span>
              </div>
              <div>
                <span className="font-bold">TELEFONO 2: </span>
                <span>{caratula.numeroContacto2 || "-"}</span>
              </div>
              <div>
                <span className="font-bold">TELEFONO 3: </span>
                <span>{caratula.numeroContacto3 || "-"}</span>
              </div>
              <div className="break-all">
                <span className="font-bold">CORREO: </span>
                <span className="text-blue-900">{caratula.correo || "-"}</span>
              </div>
              <div className="pt-1 mt-1 border-t border-gray-200">
                <span className="font-bold block text-[10px] text-gray-700 uppercase">
                  DIRECCION DONDE SE REALIZA EL SERVICIO:
                </span>
                <span className="uppercase text-[10.5px] leading-snug">
                  {caratula.direccionServicio || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: DATOS DE "EL RECEPTOR DE SERVICO" */}
          <div className="flex flex-col justify-between">
            <div className="bg-gray-100 font-bold text-center py-1 border-b border-gray-800 uppercase tracking-tight text-gray-900">
              DATOS DE "EL RECEPTOR DE SERVICO"
            </div>
            <div className="p-2 space-y-1">
              <div>
                <span className="font-bold">NOMBRE: </span>
                <span className="uppercase">{caratula.nombreCompletoRS || "-"}</span>
              </div>
              <div>
                <span className="font-bold">EDAD: </span>
                <span>{caratula.edad ? `${caratula.edad} AÑOS` : "-"}</span>
              </div>
              <div className="pt-1">
                <span className="font-bold block text-[10px] text-gray-700 uppercase">
                  DIAGNOSTICO:
                </span>
                <span className="capitalize text-[10.5px] leading-snug">
                  {caratula.diagnostico || "-"}
                </span>
              </div>
              <div className="pt-1 mt-1 border-t border-gray-200">
                <span className="font-bold block text-[10px] text-gray-700 uppercase">
                  ESPECIFICACIONES:
                </span>
                <span className="text-[10.5px] leading-snug">
                  {caratula.especificaciones || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETALLES DEL SERVICIO Table (FOR BOTH CARÁTULA AND COTIZACIÓN) */}
      <div className="border border-gray-800 mb-4 bg-white">
        <div className="bg-gray-100 font-bold text-center py-1 border-b border-gray-800 uppercase text-[11px] tracking-wider text-gray-900">
          DETALLES DEL SERVICIO
        </div>

        {/* Table Header Row with Column Titles */}
        <div className="grid grid-cols-12 items-center bg-gray-200 border-b border-gray-800 text-[10px] font-extrabold uppercase text-gray-900 py-1 font-sans">
          <div className="col-span-6 px-2.5">SERVICIO / CONCEPTO</div>
          <div className="col-span-2 border-l border-r border-gray-800 text-center px-1">CANT.</div>
          <div className="col-span-2 border-r border-gray-800 text-right px-2">PRECIO U.</div>
          <div className="col-span-2 text-right px-2">IMPORTE</div>
        </div>

        {/* Table Service Rows */}
        <div className="divide-y divide-gray-800 text-[10.5px]">
          {serviceLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-12 items-center min-h-[26px]">
              <div className="col-span-6 px-2.5 py-1 font-semibold text-gray-900 truncate uppercase">
                {line.servicio || ""}
              </div>
              <div className="col-span-2 border-l border-r border-gray-800 px-1 py-1 text-center font-bold">
                {line.cantidad > 0 ? line.cantidad : ""}
              </div>
              <div className="col-span-2 border-r border-gray-800 px-2 py-1 text-right font-mono">
                {line.precioU > 0 ? formatCurrency(line.precioU) : "$0.00"}
              </div>
              <div className="col-span-2 px-2 py-1 text-right font-mono font-bold">
                {line.precioTot > 0 ? formatCurrency(line.precioTot) : "$0.00"}
              </div>
            </div>
          ))}
        </div>

        {/* Free text Service Details section */}
        {caratula.detallesServicio && (
          <div className="border-t border-gray-800 p-2.5 bg-gray-50/70 text-[10.5px]">
            <span className="font-bold text-gray-900 block uppercase mb-1">
              DETALLES Y ESPECIFICACIONES DEL SERVICIO:
            </span>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-800 font-sans">
              {caratula.detallesServicio}
            </p>
          </div>
        )}
      </div>

      {/* NOTES AND CONDITIONS BOX (IF SPECIFIED) */}
      {caratula.detallesCotizacionText && (
        <div className="border border-gray-800 mb-4 bg-white">
          <div className="bg-gray-800 text-white font-bold text-center py-1 border-b border-gray-800 uppercase text-[10.5px] tracking-wider">
            {caratula.tipoDocumento === "Cotización"
              ? "NOTAS Y CONDICIONES DE LA COTIZACIÓN"
              : "NOTAS Y CONDICIONES ADICIONALES DEL SERVICIO"}
          </div>
          <div className="p-3 text-[10.5px] text-slate-800 leading-relaxed font-sans whitespace-pre-wrap bg-gray-50/50">
            {caratula.detallesCotizacionText}
          </div>
        </div>
      )}

      {/* SCHEDULED SHIFTS SCHEDULE TABLE (ONLY FOR CARATULAS DE SERVICIO - NOT ON QUOTES) */}
      {caratula.tipoDocumento !== "Cotización" && (
        <div className="border border-gray-800 mb-4 bg-white text-[10.5px]">
          <div className="bg-gray-900 text-white font-bold text-center py-1.5 border-b border-gray-800 uppercase text-[11px] tracking-wider flex items-center justify-center gap-2">
            <span>📅</span>
            <span>
              {guardiasAgendadasList.length > 0
                ? `PROGRAMACIÓN Y CALENDARIO DE GUARDIAS (${guardiasAgendadasList.length} ${guardiasAgendadasList.length === 1 ? "GUARDIA AGENDADA" : "GUARDIAS AGENDADAS"})`
                : "PROGRAMACIÓN Y CALENDARIO DE GUARDIAS"}
            </span>
          </div>

          {guardiasAgendadasList.length > 0 ? (
            <div>
              {/* Table headers */}
              <div className="grid grid-cols-12 bg-gray-200 border-b border-gray-800 py-1 text-[9.5px] font-black uppercase text-gray-900 text-center font-sans">
                <div className="col-span-1 border-r border-gray-400">#</div>
                <div className="col-span-2 border-r border-gray-400 px-0.5">FOLIO GUARDIA</div>
                <div className="col-span-2 border-r border-gray-400 px-1">FECHA</div>
                <div className="col-span-3 border-r border-gray-400 px-1">HORARIO</div>
                <div className="col-span-2 border-r border-gray-400 px-1">MODALIDAD</div>
                <div className="col-span-2 px-1 text-left">PERSONAL</div>
              </div>

              {/* Table rows */}
              <div className="divide-y divide-gray-300">
                {guardiasAgendadasList.map((shift, idx) => (
                  <div
                    key={shift.id || idx}
                    className="grid grid-cols-12 py-1.5 items-center text-[9.5px] text-center hover:bg-gray-50 transition"
                  >
                    <div className="col-span-1 border-r border-gray-300 font-bold font-mono text-slate-800">
                      {idx + 1}
                    </div>
                    <div className="col-span-2 border-r border-gray-300 font-mono font-bold text-indigo-900 px-0.5 text-[9px]">
                      {shift.folioGuardia || "-"}
                    </div>
                    <div className="col-span-2 border-r border-gray-300 font-mono font-bold text-slate-900 px-0.5 text-[9px]">
                      {formatShiftDateDisplay(shift.fecha)}
                    </div>
                    <div className="col-span-3 border-r border-gray-300 font-mono text-slate-800 px-1 text-[9px]">
                      <span className="font-bold">{shift.horaInicio} - {shift.horaFin}</span>
                      {shift.fechaFinCalculada && shift.fechaFinCalculada !== shift.fecha && (
                        <span className="block text-[8px] text-slate-500 font-sans">
                          (Fin: {formatShiftDateDisplay(shift.fechaFinCalculada)})
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 border-r border-gray-300 font-semibold text-slate-800 px-1 text-[9px]">
                      {formatShiftPresetLabel(shift.preset)}
                    </div>
                    <div className="col-span-2 px-1 text-left font-medium truncate text-slate-900 text-[9px]">
                      {shift.personalAsignado || "Por asignar"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional vigencia note if there are remaining unscheduled shifts AND vigencia is enabled */}
              {Boolean(caratula.modalidadVigencia) && caratula.guardiasPendientesPorAgendar && caratula.guardiasPendientesPorAgendar > 0 ? (
                <div className="bg-sky-50 border-t border-sky-300 p-2 text-[10px] text-sky-900 flex items-center justify-between">
                  <span className="font-bold">
                    ⏱️ Guardias adicionales disponibles por agendar bajo vigencia:
                  </span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-sky-300">
                    {caratula.guardiasPendientesPorAgendar} {caratula.guardiasPendientesPorAgendar === 1 ? "guardia disponible" : "guardias disponibles"} {caratula.fechaVigenciaFin ? `(Válido hasta ${caratula.fechaVigenciaFin})` : ""}
                  </span>
                </div>
              ) : null}
            </div>
          ) : caratula.modalidadVigencia ? (
            <div className="p-3 bg-sky-50/60 text-center text-sky-950 space-y-1">
              <div className="font-bold text-[11px] uppercase">
                ⏱️ Modalidad de Guardias Abiertas (Por Agendar a Demanda)
              </div>
              <p className="text-[10px] text-slate-700 max-w-xl mx-auto">
                Las {caratula.guardiasTotalContratadas ?? caratula.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0)} guardias contratadas se programarán a conveniencia y solicitud del cliente dentro del período de vigencia establecido{caratula.fechaVigenciaFin ? ` (hasta el ${caratula.fechaVigenciaFin})` : ""}.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 text-center text-gray-700 space-y-1">
              <div className="font-bold text-[10.5px] uppercase text-gray-800">
                📅 Fechas y Horarios del Servicio
              </div>
              <p className="text-[10px] text-gray-600 max-w-xl mx-auto">
                Inicio: <span className="font-mono font-bold text-gray-900">{caratula.inicio || "Por definir"}</span> | Término: <span className="font-mono font-bold text-gray-900">{caratula.fin || "Por definir"}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* FINANCIAL RESUME & VIGENCIA FOR COTIZACIÓN */}
      {caratula.tipoDocumento === "Cotización" ? (
        <div className="border border-gray-800 mb-4 bg-white text-[10.5px]">
          <div className="bg-amber-100 font-bold text-center py-1 border-b border-gray-800 uppercase text-[11px] tracking-wider text-amber-950">
            RESUMEN FINANCIERO Y VIGENCIA DE LA COTIZACIÓN
          </div>
          <div className="p-3 space-y-2.5">
            {/* Vigencia Box for Quote */}
            <div className="bg-amber-50 border border-amber-300 rounded p-2.5 space-y-1 text-[10.5px]">
              <div className="flex items-center justify-between border-b border-amber-200 pb-1">
                <span className="font-extrabold text-amber-950 uppercase flex items-center gap-1.5">
                  <span>⏱️</span> VIGENCIA DE LA COTIZACIÓN
                </span>
                <span className="font-mono font-bold text-amber-900 text-[10.5px] bg-amber-200/80 px-2.5 py-0.5 rounded border border-amber-400">
                  {caratula.validezCotizacion ? `VÁLIDA HASTA EL: ${caratula.validezCotizacion}` : "VÁLIDA POR 7 DÍAS"}
                </span>
              </div>
              <p className="text-[10px] text-amber-900 leading-snug pt-0.5">
                Esta cotización tiene una vigencia establecida para la reserva y formalización del servicio. Los precios cotizados y la disponibilidad de personal de enfermería se garantizan dentro de este período. La programación definitiva de turnos y fechas se acordará al momento de contratar.
              </p>
            </div>

            {/* Financial Summary Box */}
            <div className="bg-gray-50 p-2.5 rounded border border-gray-300 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between items-center text-gray-800">
                <span className="font-bold font-sans">SUBTOTAL SERVICIOS:</span>
                <span>{formatCurrency(caratula.subtotal || 0)}</span>
              </div>
              
              {caratula.descuento > 0 && (
                <div className="flex justify-between items-center text-amber-900 font-bold">
                  <span className="font-sans">DESCUENTO PROPUESTO:</span>
                  <span>- {formatCurrency(caratula.descuento)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-900 font-black text-xs pt-1 border-t border-gray-300">
                <span className="font-sans">TOTAL COTIZADO:</span>
                <span className="text-amber-900 font-black text-sm">{formatCurrency(caratula.total || 0)}</span>
              </div>
            </div>

            <div className="pt-1 text-[9.5px] text-gray-600">
              * Para autorizar esta cotización y formalizar su carátula de servicio oficial, favor de comunicarse a nuestras líneas de atención.
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD CARÁTULA CONDITIONS & FINANCIAL RESUME BLOCK */
        <div className="border border-gray-800 mb-4 bg-white text-[10.5px]">
          <div className="bg-gray-100 font-bold text-center py-1 border-b border-gray-800 uppercase text-[11px] tracking-wider text-gray-900">
            RESUMEN FINANCIERO Y CONDICIONES DEL SERVICIO
          </div>
          <div className="p-3 space-y-2.5">
            {/* Standard or Vigencia Service Period */}
            {Boolean(caratula.modalidadVigencia) && (
              <div className="bg-sky-50/70 border border-sky-300 rounded p-2.5 space-y-1.5 text-[10.5px]">
                <div className="flex items-center justify-between border-b border-sky-200 pb-1">
                  <span className="font-extrabold text-sky-950 uppercase flex items-center gap-1">
                    <span>⏱️</span> VIGENCIA DE USO PARA GUARDIAS CONTRATADAS
                  </span>
                  {caratula.diasVigencia && (
                    <span className="font-mono font-bold text-sky-800 text-[10px] bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
                      {caratula.diasVigencia} DÍAS NATURALES
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <span className="font-bold text-gray-700 block uppercase">INICIO DE VIGENCIA:</span>
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {caratula.fechaVigenciaInicio || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-700 block uppercase">FECHA LÍMITE DE USO (VIGENCIA):</span>
                    <span className="font-mono text-xs font-black text-sky-900">
                      {caratula.fechaVigenciaFin || "-"}
                    </span>
                  </div>
                </div>

                {/* Guardias Summary Counter */}
                <div className="grid grid-cols-3 gap-2 bg-white p-1.5 rounded border border-sky-200 text-center font-mono text-[10px]">
                  <div>
                    <span className="text-gray-500 font-sans block text-[9px] uppercase font-bold">Total Contratadas</span>
                    <span className="font-black text-slate-900 text-xs">
                      {caratula.guardiasTotalContratadas ?? caratula.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans block text-[9px] uppercase font-bold">Agendadas en Calendario</span>
                    <span className="font-bold text-sky-700 text-xs">
                      {caratula.guardiasAgendadas ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-sans block text-[9px] uppercase font-bold">Disponibles / A Demanda</span>
                    <span className="font-bold text-emerald-700 text-xs">
                      {caratula.guardiasPendientesPorAgendar ?? (caratula.guardiasTotalContratadas ?? 0) - (caratula.guardiasAgendadas ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="text-[9.5px] text-sky-900 leading-tight">
                  {caratula.notasVigencia ||
                    "El cliente puede agendar sus guardias a conveniencia dentro del período de vigencia establecido, solicitándolas con anticipación sujeta a disponibilidad operativa."}
                </div>
              </div>
            )}

            {/* Financial Summary Box */}
            <div className="bg-gray-50 p-2.5 rounded border border-gray-300 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between items-center text-gray-800">
                <span className="font-bold font-sans">SUBTOTAL SERVICIOS:</span>
                <span>{formatCurrency(caratula.subtotal || 0)}</span>
              </div>
              
              {caratula.descuento > 0 && (
                <div className="flex justify-between items-center text-amber-900 font-bold">
                  <span className="font-sans">DESCUENTO APLICADO:</span>
                  <span>- {formatCurrency(caratula.descuento)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-gray-900 font-black text-xs pt-1 border-t border-gray-300">
                <span className="font-sans">TOTAL NETO DEL SERVICIO:</span>
                <span>{formatCurrency(caratula.total || 0)}</span>
              </div>

              {(caratula.pagado > 0 || caratula.pendiente > 0) && (
                <>
                  <div className="flex justify-between items-center text-emerald-800 pt-1 border-t border-gray-200">
                    <span className="font-bold font-sans">MONTO PAGADO / ABONADO:</span>
                    <span className="font-bold">{formatCurrency(caratula.pagado || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-red-700">
                    <span className="font-bold font-sans">PENDIENTE DE PAGO:</span>
                    <span className="font-black">{formatCurrency(caratula.pendiente >= 0 ? caratula.pendiente : 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-1 text-[9.5px]">
              <span className="font-bold text-gray-800 uppercase">
                PUEDE CONSULTAR EL CONTRATO DE SERVICIO EN:{" "}
              </span>
              <span className="text-blue-800 underline break-all">
                {caratula.contratoLink || "www.cuidartemexico.com/contrato"}
              </span>
            </div>
          </div>

          {/* T&C Row across bottom */}
          <div className="border-t border-gray-800 p-1.5 text-[9.5px] bg-gray-50 flex items-center justify-between">
            <div>
              <span className="font-bold text-gray-800 uppercase">
                CONSULTAR TÉRMINOS Y CONDICIONES EN:{" "}
              </span>
              <span className="text-blue-800 underline break-all">
                {caratula.tycLink || "www.cuidartemexico.com/terminos-y-condiciones"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legal Disclaimer Box */}
      <div className="border border-gray-300 p-2 text-[8.5px] leading-tight text-gray-700 text-justify mb-4 bg-gray-50">
        Para garantizar una atención segura y adecuada, es indispensable que antes de solicitar o confirmar el servicio proporcione toda la información relevante sobre el paciente, incluyendo diagnósticos, alergias, tratamientos, condiciones médicas, enfermedades preexistentes o cualquier dato que el personal de Cuidarte México ({caratula.sucursalNombre || "Sucursal"}) deba conocer para realizar su labor correctamente y con diligencia. La falta de información o la entrega incompleta de datos puede afectar la calidad del servicio y exime de toda responsabilidad a Cuidarte México y a su personal ante cualquier complicación o incidente derivado de dicha omisión.
      </div>

      {/* Footer Contact Info */}
      <div className="flex justify-between items-center text-[10px] font-bold text-gray-800 border-t border-gray-300 pt-2 px-1">
        <span>www.cuidartemexico.com</span>
        <span>771 454 0072</span>
        <span>URGENCIAS: 771 454 0072 EXT. 911</span>
      </div>
    </div>
  );
};
