import React from "react";
import { InventoryItem, Client, Caratula } from "../types";
import { CuidarteLogo } from "./CuidarteLogo";
import { calculateStockAndTreatmentStatus } from "../utils/medicationStockUtils";
import { Package, AlertTriangle, CheckCircle2, Shield, Calendar, Phone, Mail, Globe, Pill } from "lucide-react";

interface InventoryDocumentProps {
  items: InventoryItem[];
  client?: Client;
  caratula?: Caratula;
  documentRef?: React.RefObject<HTMLDivElement | null>;
}

export const InventoryDocument: React.FC<InventoryDocumentProps> = ({
  items = [],
  client,
  caratula,
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
  const diagnostico = client?.diagnostico || caratula?.diagnostico || "Atención Domiciliaria y Cuidados de Enfermería";

  // Item statistics
  const totalItems = items.length;
  const medItems = items.filter((i) => i.categoria === "Medicamento");
  const supplyItems = items.filter((i) => i.categoria !== "Medicamento");

  const lowStockCount = items.filter((item) => {
    if (item.controlTipo === "Sin Control de Inventario") return false;
    const calc = calculateStockAndTreatmentStatus(item);
    return calc.isLowStock || (item.stockActual || 0) <= 0;
  }).length;

  const normalStockCount = items.filter((item) => {
    if (item.controlTipo === "Sin Control de Inventario") return true;
    const calc = calculateStockAndTreatmentStatus(item);
    return !calc.isLowStock && (item.stockActual || 0) > 0;
  }).length;

  return (
    <div
      ref={documentRef}
      id="inventory-official-document"
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
          REPORTE OFICIAL DE INVENTARIO Y STOCK
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
      <div className="text-center my-3 border-t-2 border-b-2 border-slate-900 py-2.5 bg-slate-50">
        <h1 className="text-base font-black uppercase tracking-widest text-slate-900">
          HOJA DE INVENTARIO Y CONTROL DE INSUMOS
        </h1>
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          CONTROL DE MEDICAMENTOS, MATERIALES DE CURACIÓN Y ARTÍCULOS DE ATENCIÓN DOMICILIARIA
        </p>
      </div>

      {/* Patient & Service Data Box */}
      <div className="border border-slate-800 mb-4 bg-white rounded-xs overflow-hidden">
        <div className="bg-slate-900 text-white font-bold text-center py-1 text-[11px] uppercase tracking-wider">
          DATOS DEL RECEPTOR DE SERVICIO Y EXPEDIENTE
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

          <div className="col-span-2">
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Diagnóstico Principal</span>
            <span className="font-semibold text-slate-800">{diagnostico}</span>
          </div>

          <div>
            <span className="font-bold text-slate-500 block text-[10px] uppercase">Contacto / Responsable</span>
            <span className="font-semibold text-slate-800">
              {caratula?.nombreCompletoCliente || client?.nombreCompletoCliente || contactPhone}
            </span>
          </div>
        </div>
      </div>

      {/* Inventory KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-center">
        <div className="bg-slate-100 p-2 rounded border border-slate-300">
          <span className="text-[9px] uppercase font-bold text-slate-600 block">Total Ítems</span>
          <span className="text-base font-black text-slate-900 font-mono">{totalItems}</span>
        </div>
        <div className="bg-sky-50 p-2 rounded border border-sky-200">
          <span className="text-[9px] uppercase font-bold text-sky-800 block">Medicamentos</span>
          <span className="text-base font-black text-sky-900 font-mono">{medItems.length}</span>
        </div>
        <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
          <span className="text-[9px] uppercase font-bold text-emerald-800 block">Stock Suficiente</span>
          <span className="text-base font-black text-emerald-800 font-mono">{normalStockCount}</span>
        </div>
        <div className="bg-amber-50 p-2 rounded border border-amber-300">
          <span className="text-[9px] uppercase font-bold text-amber-900 block">Por Resurtir</span>
          <span className="text-base font-black text-amber-900 font-mono">{lowStockCount}</span>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="border border-slate-900 mb-6 overflow-hidden">
        <div className="bg-slate-900 text-white font-bold text-center py-1 text-[11px] uppercase tracking-wider">
          DETALLE DE INSUMOS Y MEDICAMENTOS EN DOMICILIO
        </div>

        <table className="w-full text-left border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-900 uppercase tracking-tight">
              <th className="py-2 px-2 border-r border-slate-400 w-8 text-center">#</th>
              <th className="py-2 px-2 border-r border-slate-400">Descripción / Medicamento</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center">Categoría</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center">Stock Actual</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center">Consumo / Día</th>
              <th className="py-2 px-2 border-r border-slate-400 text-center">Autonomía</th>
              <th className="py-2 px-2 text-center">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 font-medium italic">
                  No hay insumos ni medicamentos registrados en el inventario de este paciente.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const calc = calculateStockAndTreatmentStatus(item);
                const isLow = calc.isLowStock || (item.stockActual || 0) <= 0;

                return (
                  <tr
                    key={item.id || index}
                    className={`border-b border-slate-300 ${
                      index % 2 === 0 ? "bg-white" : "bg-slate-50"
                    } ${isLow ? "bg-amber-50/40" : ""}`}
                  >
                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-bold text-slate-600">
                      {index + 1}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300">
                      <div className="font-bold text-slate-900">{item.nombre}</div>
                      {item.frecuenciaKardex && (
                        <div className="text-[9.5px] text-sky-800 font-medium">
                          Posología: {item.frecuenciaKardex}
                        </div>
                      )}
                      {item.notas && (
                        <div className="text-[9px] text-slate-500 italic">
                          Nota: {item.notas}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center">
                      <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-[9.5px] font-semibold">
                        {item.categoria || "Insumo"}
                      </span>
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-bold">
                      {item.stockActual} {item.unidadMedida}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono text-slate-700">
                      {item.dosesPerDay && item.unitsPerDose
                        ? `${(item.dosesPerDay * item.unitsPerDose).toFixed(1)} / día`
                        : item.dosesPerDay
                        ? `${item.dosesPerDay} tomas/día`
                        : "-"}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono font-bold">
                      {calc.daysOfStock !== undefined && calc.daysOfStock < 999 ? (
                        <span className={calc.daysOfStock <= 3 ? "text-rose-700" : "text-slate-800"}>
                          {calc.daysOfStock.toFixed(1)} días
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    <td className="py-2 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold border ${
                          (item.stockActual || 0) <= 0
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : isLow
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {calc.badgeLabel || ((item.stockActual || 0) <= 0 ? "Agotado" : isLow ? "Stock Bajo" : "Suficiente")}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Institutional Signatures Section */}
      <div className="border border-slate-900 mb-4 bg-white rounded-xs overflow-hidden">
        <div className="bg-slate-900 text-white font-bold text-center py-1 text-[11px] uppercase tracking-wider">
          VALIDACIÓN Y CONSTANCIA DE CONTROL DE INSUMOS
        </div>
        <div className="p-4 grid grid-cols-2 gap-8 text-center text-[10px]">
          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma y Cédula Profesional</span>
            </div>
            <p className="font-black uppercase text-slate-900">PERSONAL DE ENFERMERÍA EN TURNO</p>
            <p className="text-[9.5px] text-slate-600">Cuidarte Pachuca - Cuidados Integrales</p>
          </div>

          <div>
            <div className="border-b border-slate-900 h-14 mb-1.5 flex items-end justify-center pb-1">
              <span className="font-mono text-[9px] text-slate-400 italic">Firma de Enterado / Familiar</span>
            </div>
            <p className="font-black uppercase text-slate-900">RECEPTOR / FAMILIAR RESPONSABLE</p>
            <p className="text-[9.5px] text-slate-600">Conformidad con el Estado de Insumos</p>
          </div>
        </div>
      </div>

      {/* Institutional Legal & Contact Footer */}
      <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
        <p className="font-semibold text-slate-700">
          CUIDARTE PACHUCA • Cuidado Integral, Confianza Total • Tel. 771 454 0072 • Urgencias: 771 454 0072 Ext. 911
        </p>
        <p className="text-slate-400">
          www.cuidartemexico.com • Este documento es de carácter oficial y confidencial para la atención domiciliaria.
        </p>
      </div>
    </div>
  );
};
