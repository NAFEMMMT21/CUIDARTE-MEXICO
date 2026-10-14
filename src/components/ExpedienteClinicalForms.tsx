import React from "react";
import { evaluateAllVitals } from "../utils/vitalsEvaluator";
import {
  LiquidBalanceData,
  WoundCareData,
  NutritionDietData,
  GeneralCareData,
  VitalsData,
} from "../types";
import {
  Droplets,
  Heart,
  Thermometer,
  Zap,
  Activity,
  Bandage,
  Utensils,
  Sparkles,
  BedDouble,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  Smile,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

// ==========================================
// 1. BALANCE DE LÍQUIDOS (FORMULARIO & TARJETA)
// ==========================================

export interface FluidBalanceFormProps {
  data: LiquidBalanceData;
  onChange: (updated: LiquidBalanceData) => void;
}

export const FluidBalanceForm: React.FC<FluidBalanceFormProps> = ({ data, onChange }) => {
  const updateField = (field: keyof LiquidBalanceData, value: any) => {
    const updated = { ...data, [field]: value };
    // Recalculate Totals
    const totalEntradas =
      (Number(updated.entradasOralMl) || 0) +
      (Number(updated.entradasIVMl) || 0) +
      (Number(updated.entradasSondaMl) || 0) +
      (Number(updated.entradasMedicamentosMl) || 0) +
      (Number(updated.entradasOtrasMl) || 0);

    const totalSalidas =
      (Number(updated.salidasOrinaMl) || 0) +
      (Number(updated.salidasVomitoMl) || 0) +
      (Number(updated.salidasDrenajesMl) || 0) +
      (Number(updated.salidasOtrasPerdidasMl) || 0);

    updated.totalEntradasMl = totalEntradas;
    updated.totalSalidasMl = totalSalidas;
    updated.balanceNetoMl = totalEntradas - totalSalidas;

    onChange(updated);
  };

  const totalEntradas =
    (Number(data.entradasOralMl) || 0) +
    (Number(data.entradasIVMl) || 0) +
    (Number(data.entradasSondaMl) || 0) +
    (Number(data.entradasMedicamentosMl) || 0) +
    (Number(data.entradasOtrasMl) || 0);

  const totalSalidas =
    (Number(data.salidasOrinaMl) || 0) +
    (Number(data.salidasVomitoMl) || 0) +
    (Number(data.salidasDrenajesMl) || 0) +
    (Number(data.salidasOtrasPerdidasMl) || 0);

  const balanceNeto = totalEntradas - totalSalidas;

  return (
    <div className="space-y-4">
      {/* Resumen Calculado en Vivo */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-sky-950 p-4 rounded-2xl border border-cyan-500/40 text-white shadow-md">
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-400 animate-pulse" />
            <span className="font-extrabold text-xs uppercase tracking-wider text-cyan-300">
              Balance Hídrico en Tiempo Real
            </span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${
              balanceNeto > 0
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                : balanceNeto < 0
                ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
            }`}
          >
            {balanceNeto > 0 ? `+${balanceNeto} ml (Positivo)` : balanceNeto < 0 ? `${balanceNeto} ml (Negativo)` : "0 ml (Neutro)"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-cyan-900/40 p-2 rounded-xl border border-cyan-500/30">
            <span className="text-[10px] text-cyan-200 uppercase font-bold block">Total Entradas</span>
            <span className="font-mono font-black text-sm text-cyan-300">+{totalEntradas} ml</span>
          </div>
          <div className="bg-amber-900/40 p-2 rounded-xl border border-amber-500/30">
            <span className="text-[10px] text-amber-200 uppercase font-bold block">Total Salidas</span>
            <span className="font-mono font-black text-sm text-amber-300">-{totalSalidas} ml</span>
          </div>
          <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-300 uppercase font-bold block">Balance Neto</span>
            <span
              className={`font-mono font-black text-sm ${
                balanceNeto > 0 ? "text-cyan-300" : balanceNeto < 0 ? "text-amber-300" : "text-emerald-300"
              }`}
            >
              {balanceNeto > 0 ? `+${balanceNeto}` : balanceNeto} ml
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SECCIÓN 1: ENTRADAS / INGRESOS */}
        <div className="bg-cyan-50/60 p-4 rounded-2xl border border-cyan-200/80 space-y-3">
          <div className="flex items-center gap-2 border-b border-cyan-200 pb-2 text-cyan-900">
            <ArrowDownCircle className="w-4 h-4 text-cyan-600 shrink-0" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider">Entradas / Ingresos (ml)</h4>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Vía Oral (ml) <span className="text-slate-400 font-normal">(Agua, caldos, jugos, gelatinas)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.entradasOralMl ?? ""}
                onChange={(e) => updateField("entradasOralMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Soluciones Intravenosas / Parenteral (ml) <span className="text-slate-400 font-normal">(Fisiológica, Hartmann, etc.)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.entradasIVMl ?? ""}
                onChange={(e) => updateField("entradasIVMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Sonda Enteral / Gastrostomía (ml) <span className="text-slate-400 font-normal">(Fórmulas, bolos)</span>
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.entradasSondaMl ?? ""}
                onChange={(e) => updateField("entradasSondaMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Medicamentos Diluidos / Infusiones (ml)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.entradasMedicamentosMl ?? ""}
                onChange={(e) => updateField("entradasMedicamentosMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Otras Entradas / Transfusiones (ml)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.entradasOtrasMl ?? ""}
                onChange={(e) => updateField("entradasOtrasMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Detalle / Tipo de Soluciones Infundidas
              </label>
              <input
                type="text"
                placeholder="Ej. Sol. Salina 0.9% 500ml a 21 gtt/min + 200ml agua VO"
                value={data.entradasDetalle || ""}
                onChange={(e) => updateField("entradasDetalle", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: SALIDAS / EGRESOS */}
        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
          <div className="flex items-center gap-2 border-b border-amber-200 pb-2 text-amber-900">
            <ArrowUpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider">Salidas / Egresos (ml)</h4>
          </div>

          <div className="space-y-2 text-xs">
            {/* Diuresis / Orina */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Orina / Diuresis (ml)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={data.salidasOrinaMl ?? ""}
                  onChange={(e) => updateField("salidasOrinaMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Aspecto Orina
                </label>
                <select
                  value={data.salidasOrinaAspecto || "Clara / Ambar Normal"}
                  onChange={(e) => updateField("salidasOrinaAspecto", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  <option value="Clara / Ambar Normal">Clara / Ámbar normal</option>
                  <option value="Colúrica / Concentrada">Colúrica / Concentrada</option>
                  <option value="Turbia / Sedimento">Turbia / Con Sedimento</option>
                  <option value="Hematúrica (Sangre)">Hematúrica (Sangre)</option>
                  <option value="Con Sonda Foley">Con Sonda Foley</option>
                  <option value="Espontánea en Cómodo/Pañal">En Cómodo / Pañal</option>
                </select>
              </div>
            </div>

            {/* Evacuaciones (Medición por Checkbox / Conteo según estándar clínico) */}
            <div className="bg-white p-3 rounded-xl border border-amber-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(data.huboEvacuacion || (data.numeroEvacuaciones && data.numeroEvacuaciones > 0) || data.salidasEvacuacionesRealizada)}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const updated = {
                        ...data,
                        huboEvacuacion: isChecked,
                        salidasEvacuacionesRealizada: isChecked,
                        numeroEvacuaciones: isChecked ? (data.numeroEvacuaciones && data.numeroEvacuaciones > 0 ? data.numeroEvacuaciones : 1) : 0,
                        salidasEvacuacionesAspecto: isChecked
                          ? (data.salidasEvacuacionesAspecto && data.salidasEvacuacionesAspecto !== "Sin evacuación en turno"
                              ? data.salidasEvacuacionesAspecto
                              : "Formada / Normal (Bristol 3-4)")
                          : "Sin evacuación en turno",
                        salidasEvacuacionesMl: undefined,
                      };
                      onChange(updated);
                    }}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <span className="font-bold text-[11px] text-slate-800">
                    Registrar Evacuación en Turno / Periodo
                  </span>
                </label>

                {(data.huboEvacuacion || (data.numeroEvacuaciones && data.numeroEvacuaciones > 0) || data.salidasEvacuacionesRealizada) && (
                  <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                    {data.numeroEvacuaciones || 1} Evacuación{(data.numeroEvacuaciones || 1) > 1 ? "es" : ""}
                  </span>
                )}
              </div>

              {(data.huboEvacuacion || (data.numeroEvacuaciones && data.numeroEvacuaciones > 0) || data.salidasEvacuacionesRealizada) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-100 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700">
                      Número de Evacuaciones:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={data.numeroEvacuaciones ?? 1}
                      onChange={(e) => updateField("numeroEvacuaciones", Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700">
                      Consistencia / Escala Bristol:
                    </label>
                    <select
                      value={data.salidasEvacuacionesAspecto || "Formada / Normal (Bristol 3-4)"}
                      onChange={(e) => updateField("salidasEvacuacionesAspecto", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium mt-0.5"
                    >
                      <option value="Formada / Normal (Bristol 3-4)">Formada / Normal (Bristol 3-4)</option>
                      <option value="Blanda / Pastosa (Bristol 5-6)">Blanda / Pastosa (Bristol 5-6)</option>
                      <option value="Líquida / Diarreica (Bristol 7)">Líquida / Diarreica (Bristol 7)</option>
                      <option value="Dura / Caprina (Bristol 1-2)">Dura / Caprina (Bristol 1-2)</option>
                      <option value="Melena (Heces oscuras)">Melena (Heces oscuras)</option>
                      <option value="Con moco / sangre visible">Con moco / sangre visible</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-500 italic">
                  Marque la casilla para registrar una evacuación en la bitácora (se contabiliza por número de evacuaciones, no en gramos/ml).
                </p>
              )}
            </div>

            {/* Emesis / Vómito */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Vómito / Emesis (ml)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={data.salidasVomitoMl ?? ""}
                  onChange={(e) => updateField("salidasVomitoMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Tipo de Vómito
                </label>
                <select
                  value={data.salidasVomitoAspecto || "Sin vómito"}
                  onChange={(e) => updateField("salidasVomitoAspecto", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-medium"
                >
                  <option value="Sin vómito">Sin vómito</option>
                  <option value="Contenido Alimenticio">Alimenticio</option>
                  <option value="Biliar / Verdoso">Biliar / Verdoso</option>
                  <option value="Porráceo / Oscuro">Porráceo / Oscuro</option>
                  <option value="Hemático (Hematemesis)">Hemático (Sangre)</option>
                  <option value="Gástrico claro">Gástrico claro</option>
                </select>
              </div>
            </div>

            {/* Drenajes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Drenajes / Sondas (ml)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={data.salidasDrenajesMl ?? ""}
                  onChange={(e) => updateField("salidasDrenajesMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">
                  Tipo y Aspecto de Drenaje
                </label>
                <input
                  type="text"
                  placeholder="Ej. Jackson Pratt serohemático, Sonda Levin"
                  value={data.salidasDrenajesTipo || ""}
                  onChange={(e) => updateField("salidasDrenajesTipo", e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Otras Pérdidas */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Pérdidas Insensibles / Diaforesis Profusa / Sangrado (ml)
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={data.salidasOtrasPerdidasMl ?? ""}
                onChange={(e) => updateField("salidasOtrasPerdidasMl", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700">
                Notas y Observaciones de Salidas
              </label>
              <input
                type="text"
                placeholder="Ej. Micción espontánea x3, diaforesis moderada en la noche..."
                value={data.salidasDetalle || ""}
                onChange={(e) => updateField("salidasDetalle", e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FluidBalanceCard: React.FC<{ data: LiquidBalanceData }> = ({ data }) => {
  const isPos = data.balanceNetoMl > 0;
  const isNeg = data.balanceNetoMl < 0;

  return (
    <div className="bg-gradient-to-br from-cyan-50/80 via-white to-sky-50/80 rounded-2xl p-4 border border-cyan-200/80 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-600 text-white rounded-xl">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-cyan-800 tracking-wider block">
              Control Estricto de Líquidos (Balance Hídrico)
            </span>
            <span className="text-xs font-black text-slate-900">
              Entradas: +{data.totalEntradasMl || 0} ml | Salidas: -{data.totalSalidasMl || 0} ml
            </span>
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs font-black font-mono border ${
            isPos
              ? "bg-cyan-100 text-cyan-800 border-cyan-300"
              : isNeg
              ? "bg-amber-100 text-amber-800 border-amber-300"
              : "bg-emerald-100 text-emerald-800 border-emerald-300"
          }`}
        >
          Balance Neto: {isPos ? `+${data.balanceNetoMl}` : data.balanceNetoMl} ml
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Entradas detail */}
        <div className="bg-white p-2.5 rounded-xl border border-cyan-100 space-y-1">
          <span className="font-extrabold text-[10px] uppercase text-cyan-900 block border-b border-cyan-50 pb-1">
            📥 Entradas (+{data.totalEntradasMl || 0} ml)
          </span>
          <div className="space-y-0.5 text-slate-700 text-[11px]">
            {(data.entradasOralMl ?? 0) > 0 && (
              <p>• Vía Oral: <strong>{data.entradasOralMl} ml</strong></p>
            )}
            {(data.entradasIVMl ?? 0) > 0 && (
              <p>• Vía Intravenosa / Parenteral: <strong>{data.entradasIVMl} ml</strong></p>
            )}
            {(data.entradasSondaMl ?? 0) > 0 && (
              <p>• Sonda Enteral / Gastrostomía: <strong>{data.entradasSondaMl} ml</strong></p>
            )}
            {(data.entradasMedicamentosMl ?? 0) > 0 && (
              <p>• Medicamentos / Infusiones: <strong>{data.entradasMedicamentosMl} ml</strong></p>
            )}
            {(data.entradasOtrasMl ?? 0) > 0 && (
              <p>• Otras Entradas: <strong>{data.entradasOtrasMl} ml</strong></p>
            )}
            {data.entradasDetalle && (
              <p className="text-[10px] text-cyan-800 italic mt-1 bg-cyan-50/60 p-1.5 rounded">
                Detalle: {data.entradasDetalle}
              </p>
            )}
          </div>
        </div>

        {/* Salidas detail */}
        <div className="bg-white p-2.5 rounded-xl border border-amber-100 space-y-1">
          <span className="font-extrabold text-[10px] uppercase text-amber-900 block border-b border-amber-50 pb-1">
            📤 Salidas (-{data.totalSalidasMl || 0} ml)
          </span>
          <div className="space-y-0.5 text-slate-700 text-[11px]">
            <p>
              • Orina / Diuresis: <strong>{data.salidasOrinaMl ?? 0} ml</strong>{" "}
              {data.salidasOrinaAspecto && (
                <span className="text-slate-500 font-medium">({data.salidasOrinaAspecto})</span>
              )}
            </p>
            {(Boolean(data.huboEvacuacion) || Boolean(data.salidasEvacuacionesRealizada) || (Number(data.numeroEvacuaciones) > 0) || Boolean(data.salidasEvacuacionesAspecto && data.salidasEvacuacionesAspecto !== "Sin evacuación en turno") || (Number(data.salidasEvacuacionesMl) > 0)) ? (
              <p className="bg-amber-50/80 p-1 rounded border border-amber-200/60 text-amber-950 font-medium">
                • <strong>Evacuaciones:</strong>{" "}
                <span className="font-bold text-amber-800">
                  {data.numeroEvacuaciones || 1} evacuación{(data.numeroEvacuaciones || 1) > 1 ? "es" : ""}
                </span>{" "}
                {data.salidasEvacuacionesAspecto && (
                  <span className="text-slate-600 font-normal">({data.salidasEvacuacionesAspecto})</span>
                )}
              </p>
            ) : (
              <p className="text-slate-400 text-[10.5px]">
                • Evacuaciones: <span className="italic">Sin evacuación en este reporte</span>
              </p>
            )}
            {(data.salidasVomitoMl ?? 0) > 0 && (
              <p>
                • Emesis / Vómito: <strong>{data.salidasVomitoMl} ml</strong>{" "}
                {data.salidasVomitoAspecto && (
                  <span className="text-slate-500 font-medium">({data.salidasVomitoAspecto})</span>
                )}
              </p>
            )}
            {(data.salidasDrenajesMl ?? 0) > 0 && (
              <p>
                • Drenajes: <strong>{data.salidasDrenajesMl} ml</strong>{" "}
                {data.salidasDrenajesTipo && (
                  <span className="text-slate-500 font-medium">({data.salidasDrenajesTipo})</span>
                )}
              </p>
            )}
            {(data.salidasOtrasPerdidasMl ?? 0) > 0 && (
              <p>• Otras Pérdidas: <strong>{data.salidasOtrasPerdidasMl} ml</strong></p>
            )}
            {data.salidasDetalle && (
              <p className="text-[10px] text-amber-800 italic mt-1 bg-amber-50/60 p-1.5 rounded">
                Detalle: {data.salidasDetalle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. CURACIÓN DE HERIDAS & VALORACIÓN DE PIEL
// ==========================================

export interface WoundCareFormProps {
  data: WoundCareData;
  onChange: (updated: WoundCareData) => void;
}

export const WoundCareForm: React.FC<WoundCareFormProps> = ({ data, onChange }) => {
  const updateField = (field: keyof WoundCareData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 space-y-3 text-xs">
      <div className="flex items-center gap-2 border-b border-rose-200 pb-2 text-rose-900">
        <Bandage className="w-4 h-4 text-rose-600 shrink-0" />
        <h4 className="font-extrabold text-xs uppercase tracking-wider">Curación de Herida & Valoración de Piel</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700">Tipo de Lesión / Procedimiento</label>
          <select
            value={data.tipoLesion || "Herida Quirúrgica"}
            onChange={(e) => updateField("tipoLesion", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="Herida Quirúrgica">Herida Quirúrgica</option>
            <option value="Úlcera por Presión (UPP)">Úlcera por Presión (UPP)</option>
            <option value="Lesión por Fricción / Cizallamiento">Lesión por Fricción</option>
            <option value="Pie Diabético">Pie Diabético</option>
            <option value="Quemadura">Quemadura</option>
            <option value="Retiro de Puntos / Suturas">Retiro de Puntos / Suturas</option>
            <option value="Curación de Catéter / CVC">Curación de Catéter / CVC</option>
            <option value="Otra Lesión">Otra Lesión Cutánea</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Localización Anatómica</label>
          <input
            type="text"
            placeholder="Ej. Región Sacra, Talón derecho, Abdomen línea media..."
            value={data.localizacion || ""}
            onChange={(e) => updateField("localizacion", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Estadio UPP / Grado de Afección</label>
          <select
            value={data.estadioUPP || "No aplica / Quirúrgica"}
            onChange={(e) => updateField("estadioUPP", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="No aplica / Quirúrgica">No aplica / Quirúrgica</option>
            <option value="Estadio I (Eritema que no palidece)">Estadio I (Eritema cutáneo intacto)</option>
            <option value="Estadio II (Pérdida parcial de grosor)">Estadio II (Flictena / Abrasión)</option>
            <option value="Estadio III (Pérdida total del grosor)">Estadio III (Tejido celular subcutáneo)</option>
            <option value="Estadio IV (Afectación muscular/ósea)">Estadio IV (Músculo / Hueso expuesto)</option>
            <option value="No clasificable (Lecho cubierto)">No clasificable (Esfacelo/Escara)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Aspecto del Lecho y Bordes</label>
          <select
            value={data.aspectoLecho || "Bordes Afrontados y Limpios"}
            onChange={(e) => updateField("aspectoLecho", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="Bordes Afrontados y Limpios">Bordes Afrontados y Limpios</option>
            <option value="Tejido de Granulación 100%">Granulación 100% (Rojo viable)</option>
            <option value="Con Tejido Esfacelado">Con Tejido Esfacelado (Amarillo)</option>
            <option value="Tejido Necrótico / Escara">Tejido Necrótico / Escara (Negro)</option>
            <option value="Eritematoso / Inflamatorio">Eritematoso / Inflamatorio</option>
            <option value="Macerado en bordes">Macerado en bordes</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Exudado</label>
          <select
            value={data.exudado || "Nulo / Escaso Seroso"}
            onChange={(e) => updateField("exudado", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="Nulo / Escaso Seroso">Nulo / Escaso Seroso</option>
            <option value="Moderado Seroso">Moderado Seroso</option>
            <option value="Abundante Serohemático">Abundante Serohemático</option>
            <option value="Purulento / Fétido">Purulento / Fétido (Signo infección)</option>
            <option value="Hemático">Hemático activo</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Antisépticos & Materiales Utilizados</label>
          <input
            type="text"
            placeholder="Ej. Solución Microdacyn, Clorhexidina 2%, Parche hidrocoloide..."
            value={data.materialesUtilizados || ""}
            onChange={(e) => updateField("materialesUtilizados", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900"
          />
        </div>
      </div>
    </div>
  );
};

export const WoundCareCard: React.FC<{ data: WoundCareData }> = ({ data }) => {
  return (
    <div className="bg-rose-50/70 rounded-2xl p-3.5 border border-rose-200 text-xs space-y-2">
      <div className="flex items-center justify-between border-b border-rose-200/80 pb-2">
        <div className="flex items-center gap-2">
          <Bandage className="w-4 h-4 text-rose-600" />
          <span className="font-extrabold text-rose-900 text-xs uppercase">
            Curación: {data.tipoLesion || "Herida"}
          </span>
        </div>
        {data.estadioUPP && data.estadioUPP !== "No aplica / Quirúrgica" && (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900">
            {data.estadioUPP}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 text-[11px]">
        {data.localizacion && (
          <p>• Localización: <strong className="text-slate-900">{data.localizacion}</strong></p>
        )}
        {data.aspectoLecho && (
          <p>• Lecho / Bordes: <strong className="text-slate-900">{data.aspectoLecho}</strong></p>
        )}
        {data.exudado && (
          <p>• Exudado: <strong className="text-slate-900">{data.exudado}</strong></p>
        )}
        {data.materialesUtilizados && (
          <p>• Materiales / Antiséptico: <strong className="text-slate-900">{data.materialesUtilizados}</strong></p>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. CONTROL DE DIETA & NUTRICIÓN
// ==========================================

export interface NutritionDietFormProps {
  data: NutritionDietData;
  onChange: (updated: NutritionDietData) => void;
}

export const NutritionDietForm: React.FC<NutritionDietFormProps> = ({ data, onChange }) => {
  const updateField = (field: keyof NutritionDietData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const currentPct = data.porcentajeAceptacion ?? 100;

  return (
    <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3 text-xs">
      <div className="flex items-center gap-2 border-b border-amber-200 pb-2 text-amber-900">
        <Utensils className="w-4 h-4 text-amber-600 shrink-0" />
        <h4 className="font-extrabold text-xs uppercase tracking-wider">Control de Dieta & Aceptación Nutricional</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-700">Tipo de Dieta</label>
          <select
            value={data.tipoDieta || "Dieta Normal / Completa"}
            onChange={(e) => updateField("tipoDieta", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="Dieta Normal / Completa">Dieta Normal / Completa</option>
            <option value="Dieta Blanda">Dieta Blanda</option>
            <option value="Dieta Líquida Clara">Dieta Líquida Clara</option>
            <option value="Dieta Líquida General">Dieta Líquida General</option>
            <option value="Papilla / Puré (Disfagia)">Papilla / Puré (Disfagia)</option>
            <option value="Hiposódica (Baja en sal)">Hiposódica (Baja en sal)</option>
            <option value="Diabética / Baja en Carbohidratos">Diabética / Baja en Azúcar</option>
            <option value="Astringente">Astringente</option>
            <option value="Nutrición Enteral por Sonda">Nutrición Enteral por Sonda (SNG/PEG)</option>
            <option value="Ayuno Indicado">Ayuno Indicado</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Vía de Administración</label>
          <select
            value={data.viaAlimentacion || "Vía Oral asistida"}
            onChange={(e) => updateField("viaAlimentacion", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
          >
            <option value="Vía Oral asistida">Vía Oral asistida</option>
            <option value="Vía Oral independiente">Vía Oral independiente</option>
            <option value="Sonda Nasogástrica (SNG)">Sonda Nasogástrica (SNG)</option>
            <option value="Gastrostomía (PEG)">Gastrostomía (PEG)</option>
          </select>
        </div>
      </div>

      {/* Porcentaje de Aceptación Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold text-slate-700">
            Porcentaje de Ingesta Aceptada: <strong className="text-amber-900">{currentPct}%</strong>
          </label>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              currentPct >= 75
                ? "bg-emerald-100 text-emerald-800"
                : currentPct >= 50
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
            }`}
          >
            {currentPct === 100 ? "Total (100%)" : currentPct === 75 ? "Aceptable (75%)" : currentPct === 50 ? "Regular (50%)" : currentPct === 25 ? "Mínima (25%)" : "Rechazo (0%)"}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[100, 75, 50, 25, 0].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => updateField("porcentajeAceptacion", pct)}
              className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
                currentPct === pct
                  ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-amber-100/50"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-700">Tolerancia Gástrica y Síntomas</label>
        <select
          value={data.tolerancia || "Buena tolerancia, sin náusea"}
          onChange={(e) => updateField("tolerancia", e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-medium text-slate-900"
        >
          <option value="Buena tolerancia, sin náusea">Buena tolerancia, sin complicaciones</option>
          <option value="Náusea postprandial">Náusea postprandial</option>
          <option value="Emesis / Vómito">Emesis / Vómito</option>
          <option value="Distensión abdominal / Meteorismo">Distensión abdominal / Meteorismo</option>
          <option value="Regurgitación / Pirosis">Regurgitación / Pirosis</option>
          <option value="Dificultad para deglutir (Disfagia)">Disfagia / Dificultad para deglutir</option>
        </select>
      </div>
    </div>
  );
};

export const NutritionDietCard: React.FC<{ data: NutritionDietData }> = ({ data }) => {
  const pct = data.porcentajeAceptacion ?? 100;
  return (
    <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-200 text-xs space-y-2">
      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
        <div className="flex items-center gap-2">
          <Utensils className="w-4 h-4 text-amber-600" />
          <span className="font-extrabold text-amber-900 text-xs uppercase">
            Dieta: {data.tipoDieta || "General"}
          </span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
            pct >= 75 ? "bg-emerald-100 text-emerald-800" : pct >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          Ingesta: {pct}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 text-[11px]">
        <p>• Vía: <strong className="text-slate-900">{data.viaAlimentacion || "Vía Oral"}</strong></p>
        <p>• Tolerancia: <strong className="text-slate-900">{data.tolerancia || "Buena tolerancia"}</strong></p>
      </div>
    </div>
  );
};

// ==========================================
// 4. CUIDADOS GENERALES, HIGIENE Y CONFORT
// ==========================================

export interface GeneralCareFormProps {
  data: GeneralCareData;
  onChange: (updated: GeneralCareData) => void;
}

export const GeneralCareForm: React.FC<GeneralCareFormProps> = ({ data, onChange }) => {
  const updateField = (field: keyof GeneralCareData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 space-y-3 text-xs">
      <div className="flex items-center gap-2 border-b border-indigo-200 pb-2 text-indigo-900">
        <BedDouble className="w-4 h-4 text-indigo-600 shrink-0" />
        <h4 className="font-extrabold text-xs uppercase tracking-wider">Cuidados de Enfermería, Higiene y Movilización</h4>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-bold text-slate-700">Higiene & Confort del Receptor</label>
          <input
            type="text"
            placeholder="Ej. Baño de esponja en cama, aseo bucal con clorhexidina, cambio de pañal x3, lavado de cabello..."
            value={data.higiene || ""}
            onChange={(e) => updateField("higiene", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Movilización & Cambios Posturales</label>
          <input
            type="text"
            placeholder="Ej. Cambios posturales cada 2 hrs (decúbito lateral der/izq), sedestación en sillón 1 hora, deambulación asistida..."
            value={data.movilizacion || ""}
            onChange={(e) => updateField("movilizacion", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700">Dispositivos Médicos & Terapia</label>
          <input
            type="text"
            placeholder="Ej. Fijación de sonda Foley revisada y permeable, cambio de apósito CVC, nebulización con salbutamol..."
            value={data.dispositivos || ""}
            onChange={(e) => updateField("dispositivos", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-900"
          />
        </div>
      </div>
    </div>
  );
};

export const GeneralCareCard: React.FC<{ data: GeneralCareData }> = ({ data }) => {
  return (
    <div className="bg-indigo-50/70 rounded-2xl p-3.5 border border-indigo-200 text-xs space-y-2">
      <div className="flex items-center gap-2 border-b border-indigo-200/80 pb-2">
        <BedDouble className="w-4 h-4 text-indigo-600" />
        <span className="font-extrabold text-indigo-900 text-xs uppercase">
          Cuidados de Enfermería & Confort
        </span>
      </div>

      <div className="space-y-1 text-slate-700 text-[11px]">
        {data.higiene && (
          <p>• <strong>Higiene:</strong> {data.higiene}</p>
        )}
        {data.movilizacion && (
          <p>• <strong>Movilización:</strong> {data.movilizacion}</p>
        )}
        {data.dispositivos && (
          <p>• <strong>Dispositivos/Terapia:</strong> {data.dispositivos}</p>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 5. SIGNOS VITALES & SOMATOMETRÍA EXTENDIDA
// ==========================================

export interface VitalsExtendedFormProps {
  data: VitalsData;
  onChange: (updated: VitalsData) => void;
  patientAge?: number | string;
}

export const VitalsExtendedForm: React.FC<VitalsExtendedFormProps> = ({ data, onChange, patientAge }) => {
  const updateField = (field: keyof VitalsData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const ev = evaluateAllVitals(data, patientAge);

  return (
    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 space-y-3">
      <div className="flex items-center justify-between border-b border-emerald-200 pb-2 text-emerald-900 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="font-extrabold text-xs uppercase tracking-wider">
            Signos Vitales, Dolor & Somatometría
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] bg-emerald-100/80 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            Altitud Pachuca (2,450 msnm)
          </span>
          <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
            {ev.ageInfo.groupLabel} {patientAge ? `(${patientAge})` : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        {/* P. Arterial */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">P. Arterial</label>
            <span className="text-[9px] text-slate-400">mmHg</span>
          </div>
          <input
            type="text"
            placeholder="120/80"
            value={data.presionArterial || ""}
            onChange={(e) => updateField("presionArterial", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {data.presionArterial ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.presionArterial.textColor}`}>
                {ev.presionArterial.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.presionArterial.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.presionArterial.referenceRange}</span>
          )}
        </div>

        {/* Frec. Cardíaca */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Frec. Cardíaca</label>
            <span className="text-[9px] text-slate-400">lpm</span>
          </div>
          <input
            type="number"
            placeholder="75"
            value={data.frecuenciaCardiaca || ""}
            onChange={(e) => updateField("frecuenciaCardiaca", parseFloat(e.target.value) || 0)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {Boolean(data.frecuenciaCardiaca) ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.frecuenciaCardiaca.textColor}`}>
                {ev.frecuenciaCardiaca.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.frecuenciaCardiaca.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.frecuenciaCardiaca.referenceRange}</span>
          )}
        </div>

        {/* Temperatura */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Temperatura</label>
            <span className="text-[9px] text-slate-400">°C</span>
          </div>
          <input
            type="number"
            step="0.1"
            placeholder="36.5"
            value={data.temperatura || ""}
            onChange={(e) => updateField("temperatura", parseFloat(e.target.value) || 0)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {data.temperatura !== undefined && data.temperatura !== null && data.temperatura > 0 ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.temperatura.textColor}`}>
                {ev.temperatura.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.temperatura.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.temperatura.referenceRange}</span>
          )}
        </div>

        {/* Sat. Oxígeno */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Sat. Oxígeno</label>
            <span className="text-[9px] text-slate-400">%</span>
          </div>
          <input
            type="number"
            placeholder="98"
            value={data.saturacionOxigeno || ""}
            onChange={(e) => updateField("saturacionOxigeno", parseFloat(e.target.value) || 0)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {data.saturacionOxigeno !== undefined && data.saturacionOxigeno !== null && data.saturacionOxigeno > 0 ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.saturacionOxigeno.textColor}`}>
                {ev.saturacionOxigeno.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.saturacionOxigeno.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.saturacionOxigeno.referenceRange}</span>
          )}
        </div>

        {/* Glucosa */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Glucosa Capilar</label>
            <span className="text-[9px] text-slate-400">mg/dL</span>
          </div>
          <input
            type="number"
            placeholder="95"
            value={data.glucosa || ""}
            onChange={(e) => updateField("glucosa", parseFloat(e.target.value) || 0)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {Boolean(data.glucosa) ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.glucosa.textColor}`}>
                {ev.glucosa.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.glucosa.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.glucosa.referenceRange}</span>
          )}
        </div>

        {/* Frec. Resp. */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase">Frec. Resp.</label>
            <span className="text-[9px] text-slate-400">rpm</span>
          </div>
          <input
            type="number"
            placeholder="16"
            value={data.frecuenciaRespiratoria || ""}
            onChange={(e) => updateField("frecuenciaRespiratoria", parseFloat(e.target.value) || 0)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-900"
          />
          {Boolean(data.frecuenciaRespiratoria) ? (
            <div className="flex items-center justify-between text-[9.5px]">
              <span className={`font-bold ${ev.frecuenciaRespiratoria.textColor}`}>
                {ev.frecuenciaRespiratoria.label}
              </span>
              <span className="text-slate-400 text-[8.5px]">{ev.frecuenciaRespiratoria.referenceRange}</span>
            </div>
          ) : (
            <span className="text-[9px] text-slate-400 block">Ref: {ev.frecuenciaRespiratoria.referenceRange}</span>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase">
            Dolor EVA (0 a 10)
          </label>
          <select
            value={data.dolorEscalaEva ?? 0}
            onChange={(e) => updateField("dolorEscalaEva", parseInt(e.target.value, 10))}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
          >
            <option value={0}>0 - Sin Dolor</option>
            <option value={1}>1 - Leve</option>
            <option value={2}>2 - Leve</option>
            <option value={3}>3 - Leve / Moderado</option>
            <option value={4}>4 - Moderado</option>
            <option value={5}>5 - Moderado</option>
            <option value={6}>6 - Moderado / Severo</option>
            <option value={7}>7 - Severo</option>
            <option value={8}>8 - Severo intenso</option>
            <option value={9}>9 - Muy severo</option>
            <option value={10}>10 - Máximo dolor</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase">Peso (kg)</label>
          <input
            type="number"
            step="0.1"
            placeholder="70"
            value={data.pesoKg || ""}
            onChange={(e) => updateField("pesoKg", parseFloat(e.target.value) || undefined)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase">Llenado Capilar</label>
          <input
            type="text"
            placeholder="< 2 seg"
            value={data.llenadoCapilar || ""}
            onChange={(e) => updateField("llenadoCapilar", e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-slate-900"
          />
        </div>
      </div>
    </div>
  );
};
