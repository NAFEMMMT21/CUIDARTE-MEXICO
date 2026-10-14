import React from "react";
import { AbonoTicket } from "../types";
import { formatCurrency } from "../utils/formatters";
import { CuidarteLogo } from "./CuidarteLogo";
import { CheckCircle2, ShieldCheck, Receipt, RefreshCw } from "lucide-react";

interface AbonoTicketDocumentProps {
  ticket: AbonoTicket;
  documentRef?: React.RefObject<HTMLDivElement>;
  onReactivate?: () => void;
}

export const AbonoTicketDocument: React.FC<AbonoTicketDocumentProps> = ({
  ticket,
  documentRef,
  onReactivate
}) => {
  return (
    <div
      ref={documentRef}
      id="ticket-official-document"
      className="bg-white text-slate-900 font-sans p-4 sm:p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md mx-auto space-y-5 print:p-4 print:shadow-none print:border-none print:max-w-full print:w-full"
    >
      {/* Header Banner */}
      <div className="text-center border-b border-dashed border-slate-300 pb-4 space-y-2">
        <div className="flex justify-center mb-2">
          <CuidarteLogo
            size="md"
            showTagline={true}
            variant="document"
            sucursalId={ticket.sucursalId}
            sucursalNombre={ticket.sucursalNombre}
          />
        </div>
        <p className="text-[10px] text-slate-500">
          {ticket.sucursalNombre || "Cuidarte"} • Tel. Atención: 771 454 0072 • www.cuidartemexico.com
        </p>

        <div className="pt-2">
          {ticket.estado === "Cancelado" ? (
            <span className="inline-block bg-rose-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-rose-800 shadow-md">
              ⛔ TICKET CANCELADO / ANULADO
            </span>
          ) : (
            <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-300">
              Comprobante Oficial de Abono
            </span>
          )}
        </div>
      </div>

      {ticket.estado === "Cancelado" && (
        <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded-xl text-xs space-y-2 text-rose-900">
          <div className="flex items-center justify-between gap-2">
            <div className="font-extrabold flex items-center gap-1.5 text-rose-700">
              <span>⚠️ Este comprobante de pago fue CANCELADO</span>
            </div>
            {onReactivate && (
              <button
                onClick={onReactivate}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-lg shadow-xs flex items-center gap-1 transition-colors print:hidden"
                title="Volver a activar este ticket"
              >
                <RefreshCw className="w-3 h-3" /> Reactivar Ticket
              </button>
            )}
          </div>
          {ticket.fechaCancelacion && (
            <p className="font-mono text-[11px]">
              Fecha de cancelación: <strong>{ticket.fechaCancelacion}</strong>
            </p>
          )}
          {ticket.motivoCancelacion && (
            <p className="text-[11px] italic">
              Motivo: "{ticket.motivoCancelacion}"
            </p>
          )}
          {ticket.canceladoPor && (
            <p className="text-[10px] text-rose-600">
              Cancelado por: {ticket.canceladoPor}
            </p>
          )}
        </div>
      )}

      {/* Ticket Meta details */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
        <div className="flex justify-between items-center text-slate-600">
          <span className="text-[11px] text-slate-500 uppercase font-sans font-bold">Folio Ticket:</span>
          <span className="font-extrabold text-slate-900 text-sm">{ticket.id}</span>
        </div>
        <div className="flex justify-between items-center text-slate-600">
          <span className="text-[11px] text-slate-500 uppercase font-sans font-bold">Folio Servicio:</span>
          <span className="font-extrabold text-red-600">{ticket.caratulaFolio}</span>
        </div>
        <div className="flex justify-between items-center text-slate-600">
          <span className="text-[11px] text-slate-500 uppercase font-sans font-bold">Fecha / Hora:</span>
          <span className="font-semibold text-slate-800">{ticket.fecha}</span>
        </div>
        {ticket.atendidoPor && (
          <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200">
            <span className="text-[11px] text-slate-500 uppercase font-sans font-bold">Atendió:</span>
            <span className="font-semibold text-slate-800">{ticket.atendidoPor}</span>
          </div>
        )}
      </div>

      {/* Client & Patient Info */}
      <div className="space-y-2 text-xs border-b border-slate-200 pb-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente / Contratante:</span>
          <p className="font-bold text-slate-900 text-sm">{ticket.clienteNombre}</p>
        </div>
        {ticket.receptorNombre && (
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Receptor del Servicio (Paciente):</span>
            <p className="font-semibold text-slate-700">{ticket.receptorNombre}</p>
          </div>
        )}
      </div>

      {/* Abono Main Highlight */}
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 text-center space-y-1 my-2">
        <span className="text-xs uppercase font-extrabold text-emerald-800 tracking-wider block">
          Monto Recibido en este Abono
        </span>
        <div className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
          {formatCurrency(ticket.montoAbonado)}
        </div>
        <div className="flex justify-center items-center gap-2 text-xs text-emerald-800 font-medium pt-1">
          <span className="bg-emerald-200/80 px-2.5 py-0.5 rounded-md font-bold">
            {ticket.metodoPago}
          </span>
          {ticket.referencia && (
            <span className="text-[11px] text-emerald-700 font-mono">
              Ref: {ticket.referencia}
            </span>
          )}
        </div>
      </div>

      {/* Account Balance Summary Breakdown */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5 text-sky-600" />
          Estado de Cuenta del Servicio ({ticket.caratulaFolio})
        </h4>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-slate-600">
            <span>Costo Total del Servicio:</span>
            <span className="font-bold text-slate-800">{formatCurrency(ticket.totalCaratula)}</span>
          </div>
          <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
            <span>(+) Abono Registrado en este Ticket:</span>
            <span>{formatCurrency(ticket.montoAbonado)}</span>
          </div>
          <div className="flex justify-between text-red-600 font-extrabold text-sm pt-1 border-t border-slate-200">
            <span>Saldo Pendiente del Servicio:</span>
            <span>{formatCurrency(ticket.pendienteRestante)}</span>
          </div>
        </div>
      </div>

      {/* Notes if present */}
      {ticket.notas && (
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 italic">
          <span className="font-bold not-italic text-slate-700">Notas: </span>
          {ticket.notas}
        </div>
      )}

      {/* Footer / Terms */}
      <div className="border-t border-dashed border-slate-300 pt-4 text-center space-y-2">
        <div className="flex justify-center items-center gap-1 text-emerald-600 font-bold text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>Pago Verificado y Registrado Correctamente</span>
        </div>

        <p className="text-[10px] text-slate-500 leading-tight">
          Conserve este comprobante para cualquier aclaración respecto a su servicio de cuidado integral.
          ¡Muchas gracias por su confianza en <strong>Cuidarte {ticket.sucursalNombre ? ticket.sucursalNombre.replace(/^Cuidarte\s+/i, "") : "México"}</strong>!
        </p>

        <div className="pt-2 flex justify-center items-center gap-1 text-[9px] text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Sello Digital de Autenticidad: {ticket.id}</span>
        </div>
      </div>
    </div>
  );
};
