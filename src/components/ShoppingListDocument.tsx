import React from "react";
import { InventoryItem, Client, Caratula, KardexRecord, KardexMedication } from "../types";
import { CuidarteLogo } from "./CuidarteLogo";
import { calculateStockAndTreatmentStatus } from "../utils/medicationStockUtils";
import { ShoppingBag, AlertTriangle, CheckCircle2, Phone, Mail, Globe } from "lucide-react";

interface ShoppingListDocumentProps {
  items: InventoryItem[];
  client?: Client;
  caratula?: Caratula;
  kardexRecords?: KardexRecord[];
  documentRef?: React.RefObject<HTMLDivElement | null>;
}

export const ShoppingListDocument: React.FC<ShoppingListDocumentProps> = ({
  items = [],
  client,
  caratula,
  kardexRecords = [],
  documentRef,
}) => {
  const patientName =
    client?.nombreCompletoRS ||
    caratula?.nombreCompletoRS ||
    client?.nombreCompletoCliente ||
    caratula?.nombreCompletoCliente ||
    "Receptor de Servicio";

  const clientId = client?.id || caratula?.id || "CLI-000";
  const contactPhone = client?.numeroContacto || caratula?.numeroContacto || "771 454 0072";

  // Helper to find associated kardex medication
  const getKardexMedForItem = (item: InventoryItem): KardexMedication | undefined => {
    for (const k of kardexRecords) {
      if (k.medicamentos) {
        const found = k.medicamentos.find(
          (m) =>
            m.id === item.kardexMedicationId ||
            m.nombreMedicamento.trim().toLowerCase() === item.nombre.trim().toLowerCase()
        );
        if (found) return found;
      }
    }
    return undefined;
  };

  return (
    <div
      ref={documentRef}
      id="shopping-list-official-document"
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
        <span className="font-bold tracking-wider text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
          LISTA DE REABASTECIMIENTO Y COMPRAS
        </span>
      </div>

      {/* Brand Header */}
      <div className="flex justify-center mb-3">
        <CuidarteLogo
          size="lg"
          showTagline={true}
          variant="document"
          sucursalId={client?.sucursalId || caratula?.sucursalId}
          sucursalNombre={client?.sucursalNombre || caratula?.sucursalNombre}
        />
      </div>

      {/* Document Title Header */}
      <div className="text-center my-3 border-t-2 border-b-2 border-slate-900 py-2.5 bg-amber-50/50">
        <h1 className="text-base font-black uppercase tracking-widest text-slate-900">
          LISTA OFICIAL DE COMPRAS Y REABASTECIMIENTO
        </h1>
        <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
          INSUMOS MÉDICOS, MEDICAMENTOS Y ARTÍCULOS DE CUIDADO REQUERIDOS
        </p>
      </div>

      {/* Patient & Request Data Box */}
      <div className="border border-slate-800 mb-4 bg-white rounded-xs overflow-hidden">
        <div className="bg-slate-900 text-white font-bold text-center py-1 text-[11px] uppercase tracking-wider">
          DATOS DEL RECEPTOR DE SERVICIO Y SOLICITUD
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

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Titular / Familiar Responsable</span>
            <span className="font-semibold text-slate-800">
              {client?.nombreCompletoCliente || caratula?.nombreCompletoCliente || "Familiar Responsable"}
            </span>
          </div>

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Teléfono de Contacto</span>
            <span className="font-mono font-semibold text-slate-800">{contactPhone}</span>
          </div>

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Total de Artículos por Adquirir</span>
            <span className="font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              {items.length} artículo(s)
            </span>
          </div>
        </div>
      </div>

      {/* Summary Alert Notice */}
      <div className="bg-amber-50 border-2 border-amber-400 p-3 mb-4 rounded text-[11px] text-amber-950 flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-black uppercase tracking-wide text-amber-900 block">
            AVISO IMPORTANTE DE ABASTECIMIENTO CONTINUO:
          </span>
          <p className="text-slate-800 mt-0.5 leading-relaxed">
            Las cantidades sugeridas han sido calculadas con base en la indicación médica prescrita en el Kárdex para cubrir la totalidad del tratamiento o el consumo proyectado para 30 días de servicio continuo.
          </p>
        </div>
      </div>

      {/* ITEMS TO PURCHASE TABLE */}
      <div className="mb-5">
        <div className="bg-slate-900 text-white font-bold px-3 py-1.5 text-[11px] uppercase tracking-wide flex items-center justify-between rounded-t">
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span>DETALLE DE INSUMOS Y MEDICAMENTOS POR RESURTIR ({items.length})</span>
          </span>
          <span className="text-[10px] font-normal text-amber-300 font-mono">Control de Inventario Domiciliario</span>
        </div>

        {items.length === 0 ? (
          <div className="border border-t-0 border-slate-300 p-6 text-center text-slate-500 italic bg-slate-50">
            No hay insumos o medicamentos con necesidad de resurtido actualmente.
          </div>
        ) : (
          <table className="w-full text-[10.5px] border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold text-center border-b border-slate-400">
                <th className="border border-slate-400 p-1.5 w-7">#</th>
                <th className="border border-slate-400 p-1.5 text-left">INSUMO / MEDICAMENTO</th>
                <th className="border border-slate-400 p-1.5 w-24">CATEGORÍA</th>
                <th className="border border-slate-400 p-1.5 text-center w-28">CONSUMO DIARIO</th>
                <th className="border border-slate-400 p-1.5 text-center w-28">STOCK EN CASA</th>
                <th className="border border-slate-400 p-1.5 text-center w-36 bg-amber-100 text-amber-950 font-black">
                  CANTIDAD A COMPRAR
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const med = getKardexMedForItem(item);
                const status = calculateStockAndTreatmentStatus({
                  ...item,
                  dosis: med?.dosis || (item.dosisPorToma ? `${item.dosisPorToma} dosis` : undefined),
                  dosisPorToma: med?.dosisPorToma !== undefined && med.dosisPorToma > 0 ? med.dosisPorToma : item.dosisPorToma,
                  vecesAlDia: med?.vecesAlDia !== undefined && med.vecesAlDia > 0 ? med.vecesAlDia : (item.vecesAlDia || item.dosesPerDay),
                  horario: med?.horario,
                  frecuencia: med?.frecuencia,
                  frecuenciaKardex: item.frecuenciaKardex || (med ? `${med.dosis || ''} - ${med.horario || med.frecuencia || ''}` : undefined),
                  fechaInicioTratamiento: med?.fechaInicioTratamiento,
                  fechaFinTratamiento: item.fechaFinTratamiento || med?.fechaFinTratamiento,
                  duracionDias: item.duracionDiasTratamiento || med?.duracionDias,
                  duracionDiasTratamiento: item.duracionDiasTratamiento || med?.duracionDias,
                  tipoTratamiento: item.tipoTratamiento || med?.tipoTratamiento,
                  diasAlertaResurtido: item.daysThresholdAlert || med?.diasAlertaResurtido,
                  estado: med?.estado || "Activo",
                });

                return (
                  <tr key={item.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                    <td className="border border-slate-400 p-1.5 text-center font-bold font-mono text-slate-600">
                      {idx + 1}
                    </td>

                    <td className="border border-slate-400 p-1.5">
                      <span className="font-black text-slate-900 block text-[11px]">{item.nombre}</span>
                      {item.notas && (
                        <span className="text-[9.5px] text-slate-600 italic block mt-0.5">
                          Nota: {item.notas}
                        </span>
                      )}
                      {med?.indicaciones && (
                        <span className="text-[9.5px] text-emerald-700 font-medium block">
                          Indicación: {med.indicaciones}
                        </span>
                      )}
                    </td>

                    <td className="border border-slate-400 p-1.5 text-center">
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300 font-medium text-[9.5px]">
                        {item.categoria}
                      </span>
                    </td>

                    <td className="border border-slate-400 p-1.5 text-center text-slate-700">
                      {item.controlTipo === "Con Control de Inventario" || item.controlTipo === "Con Control Kardex/Conteo" ? (
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {status.dailyConsumptionUnits} {item.unidadMedida}/día
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            ({status.vecesAlDia} tomas/día)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9.5px] text-slate-500 italic">Uso a demanda</span>
                      )}
                    </td>

                    <td className="border border-slate-400 p-1.5 text-center">
                      <span className="font-black text-rose-700 font-mono text-xs block">
                        {item.stockActual} {item.unidadMedida}
                      </span>
                      {status.daysOfStock > 0 ? (
                        <span className="text-[9px] text-slate-500 block">
                          Rinde para ~{status.autonomyFormattedText}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-rose-600 block uppercase">
                          Agotado / 0 días
                        </span>
                      )}
                    </td>

                    <td className="border border-slate-400 p-1.5 text-center bg-amber-50/80">
                      <div className="inline-block bg-amber-400/30 border border-amber-500 px-2.5 py-1 rounded">
                        <span className="font-black text-slate-950 font-mono text-sm block">
                          {status.suggestedPurchaseQty} {item.unidadMedida}
                        </span>
                        <span className="text-[8.5px] text-amber-900 font-bold block uppercase tracking-tight">
                          {status.hasEndDate ? `Para concluir (${status.remainingDaysTreatment}d)` : "Para 1 mes (30d)"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Instructions & Recommendations Box */}
      <div className="mb-6 border border-slate-300 rounded p-3 bg-slate-50 text-[10.5px] space-y-1.5">
        <span className="font-bold uppercase text-slate-900 block">RECOMENDACIONES PARA LA COMPRA Y ENTREGA:</span>
        <ul className="list-disc list-inside space-y-1 text-slate-700">
          <li>Favor de verificar que las presentaciones y concentraciones coincidan exactamente con la indicación del médico tratante.</li>
          <li>Revisar fecha de caducidad vigente y que los empaques se encuentren íntegros y sellados de fábrica.</li>
          <li>Al momento de la entrega en domicilio, entregar directamente al personal de enfermería en turno para su registro en el inventario.</li>
          <li>Puede enviar foto del ticket o medicamento vía WhatsApp al personal autorizado de {client?.sucursalNombre || caratula?.sucursalNombre || "Cuidarte México"}.</li>
        </ul>
      </div>

      {/* Signatures & Reception Section */}
      <div className="mt-8 pt-4 border-t-2 border-slate-800">
        <div className="grid grid-cols-2 gap-12 text-center text-[10.5px]">
          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma del Personal Solicitante</span>
            </div>
            <p className="font-black uppercase text-slate-900">PERSONAL DE ENFERMERÍA EN TURNO</p>
            <p className="text-[9.5px] text-slate-600">{client?.sucursalNombre || caratula?.sucursalNombre || "Cuidarte México"} - Control Farmacológico</p>
          </div>

          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma de Entrega / Recibido</span>
            </div>
            <p className="font-black uppercase text-slate-900">FAMILIAR RESPONSABLE / COMPRADOR</p>
            <p className="text-[9.5px] text-slate-600">Acuse de Recepción de Lista de Compras</p>
          </div>
        </div>
      </div>

      {/* Institutional Legal & Contact Footer */}
      <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          {(client?.sucursalNombre || caratula?.sucursalNombre || "Cuidarte México").toUpperCase()} • Cuidado Integral, Confianza Total • Tel. 771 454 0072 • Urgencias: 771 454 0072 Ext. 911
        </p>
        <p className="text-slate-400">
          www.cuidartemexico.com • Sistema de Control de Insumos y Medicación Domiciliaria.
        </p>
      </div>
    </div>
  );
};
