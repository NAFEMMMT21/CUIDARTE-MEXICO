import React, { useState } from "react";
import { StaffMember } from "../types";
import { CuidarteLogo } from "./CuidarteLogo";
import { CuidarteIsotipo } from "./CuidarteIsotipo";
import { CredentialGeometricBackground } from "./CredentialGeometricBackground";
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  BadgeCheck,
  AlertTriangle,
  Briefcase,
  Layers,
} from "lucide-react";
import { getStaffVerificationCode } from "../utils/staffVerification";

interface StaffCredentialCardProps {
  staff: StaffMember;
  showActions?: boolean;
  canPrint?: boolean;
  onClose?: () => void;
}

export const StaffCredentialCard: React.FC<StaffCredentialCardProps> = ({
  staff,
  showActions = true,
  canPrint = true,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<"front" | "back">("front");
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // High quality default SVG photo fallback
  const defaultPhoto =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160' fill='%231e293b'><rect width='120' height='160' fill='%23f1f5f9'/><circle cx='60' cy='60' r='32' fill='%2394a3b8'/><path d='M10 150 C10 105, 110 105, 110 150 Z' fill='%2394a3b8'/></svg>";

  const photoToDisplay = staff.fotoUrl && staff.fotoUrl.trim() !== "" ? staff.fotoUrl : defaultPhoto;

  const empNumber = staff.noSocio ? staff.noSocio.replace(/\D/g, "") || "25001" : "25001";
  const folioDisplay = staff.folioUrgencias || `01${empNumber}`;
  const verifCode = getStaffVerificationCode(staff);

  const isEmpleado = staff.tipoContrato?.toLowerCase().includes("empleado");
  const socioLabel = isEmpleado ? "NO. DE EMPLEADO" : "NO. DE SOCIO";
  const statusUpper = (staff.estatus || "Activo").toUpperCase();
  const isBaja = statusUpper === "BAJA";
  const isInactivo = statusUpper === "INACTIVO";

  const puestoLower = (staff.puestoTipoPersonal || "").toLowerCase();
  const badgeLower = (staff.badgePrincipal || "").toLowerCase();
  const gradoLower = (staff.gradoTitulo || "").toLowerCase();

  const isVentas =
    puestoLower.includes("ventas") ||
    puestoLower.includes("comercial") ||
    badgeLower.includes("ventas") ||
    gradoLower.includes("ventas");

  const isAtencionClientes =
    puestoLower.includes("atenci") ||
    badgeLower.includes("atenci") ||
    gradoLower.includes("atenci");

  // Determine credential profile modality authorized from administration
  const isDualProfile = staff.tipoCredencial === "ambos";
  const isExclusivelyAdmin =
    staff.tipoCredencial === "administrativo" ||
    (staff.isAdministrativo && staff.tipoCredencial !== "atencion" && staff.tipoCredencial !== "ambos");

  const initialModalidad: "atencion" | "administrativo" = isExclusivelyAdmin
    ? "administrativo"
    : "atencion";

  const [modalidad, setModalidad] = useState<"atencion" | "administrativo">(initialModalidad);

  // Strict enforcement: if staff does not have dual profile assigned, locked to their single accredited profile
  const effectiveModalidad: "atencion" | "administrativo" = isDualProfile
    ? modalidad
    : isExclusivelyAdmin
    ? "administrativo"
    : "atencion";

  const isAdministrativo = effectiveModalidad === "administrativo";

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Side Toggle & Actions Bar */}
      {showActions && (
        <div className="flex flex-col gap-2.5 w-full max-w-md bg-slate-900 border border-slate-800 p-3 rounded-2xl print:hidden shadow-xl">
          {/* Top row: Modalidad selector switch OR Single Accredited Badge */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Modalidad de Credencial:</span>
            </span>

            {isDualProfile ? (
              // DUAL PROFILES: Explicitly authorized by Administrator -> allow toggle
              <div className="flex items-center gap-1.5">
                <div className="inline-flex bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalidad("atencion")}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                      effectiveModalidad === "atencion"
                        ? "bg-sky-500 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Credencial Oficial de Personal de Atención a Urgencias / Clínico"
                  >
                    Atención
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalidad("administrativo")}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                      effectiveModalidad === "administrativo"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Credencial Corporativa Administrativa"
                  >
                    Corporativa
                  </button>
                </div>
                <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-600/40">
                  Dual
                </span>
              </div>
            ) : isExclusivelyAdmin ? (
              // SINGLE PROFILE: Corporativo Administrativo accredited from administration
              <span className="px-2.5 py-1 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-[10px] font-black flex items-center gap-1.5 shadow-xs">
                <Briefcase className="w-3 h-3 text-indigo-400" />
                <span>Perfil: Corporativo</span>
              </span>
            ) : (
              // SINGLE PROFILE: Personal de Atención accredited from administration
              <span className="px-2.5 py-1 rounded-xl bg-sky-950/80 border border-sky-700/60 text-sky-200 text-[10px] font-black flex items-center gap-1.5 shadow-xs">
                <ShieldCheck className="w-3 h-3 text-sky-400" />
                <span>Perfil: Atención</span>
              </span>
            )}
          </div>

          {/* Bottom row: Sides, Print, Status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveSide("front")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  activeSide === "front"
                    ? "bg-sky-500 text-white shadow-md shadow-sky-900/30"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <span>Anverso</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSide("back")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  activeSide === "back"
                    ? "bg-sky-500 text-white shadow-md shadow-sky-900/30"
                    : "bg-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                <span>Reverso</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Live Status Button */}
              <button
                type="button"
                onClick={() => setShowVerificationModal(true)}
                className="px-2.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 font-bold text-xs rounded-xl transition flex items-center gap-1"
                title="Verificar estatus en plataforma"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Estatus</span>
              </button>

              {/* Print button ONLY for Admin */}
              {canPrint && (
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl transition flex items-center gap-1 shadow-md shadow-sky-950/30"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
              )}

              {/* Optional Close Button */}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  title="Cerrar credencial"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Credential Card Frame */}
      <div className="credential-print-container flex flex-col items-center justify-center p-2">
        {/* ========================================== */}
        {/* ESTATUS DE BAJA: QUITAR CREDENCIAL Y MOSTRAR ALERTA */}
        {/* ========================================== */}
        {isBaja ? (
          <div className="w-[336px] min-h-[360px] p-6 bg-rose-950 border-2 border-rose-600 rounded-[24px] text-white flex flex-col items-center justify-center text-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="p-3 bg-rose-600/20 rounded-full border border-rose-500/40 text-rose-400">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <span className="text-[10px] font-mono font-bold text-rose-300 uppercase tracking-widest bg-rose-900/80 px-2.5 py-1 rounded-full border border-rose-500/40">
              ESTATUS: BAJA DE SISTEMA
            </span>
            <h3 className="text-base font-black uppercase text-rose-100 tracking-tight leading-snug">
              SOCIO NO VINCULADO A {staff.sucursalNombre ? staff.sucursalNombre.toUpperCase() : "CUIDARTE MÉXICO"}
            </h3>
            <p className="text-xs font-extrabold text-white bg-rose-900/90 p-3.5 rounded-2xl border border-rose-500/50 leading-relaxed uppercase shadow-lg">
              NO AUTORIZADO A CUBRIR GUARDIAS. REPORTAR AL 7714540072
            </p>
            <span className="text-[10px] text-rose-300 font-mono">
              REGISTRO: {staff.nombre} {staff.apellidos} ({socioLabel}: {empNumber})
            </span>
          </div>
        ) : (
          <>
            {/* ========================================== */}
            {/* FRONT SIDE (ANVERSO) - HIGH-SECURITY DESIGN */}
            {/* ========================================== */}
            {activeSide === "front" && (
              <div
                className="w-[336px] h-[528px] bg-white rounded-[24px] shadow-2xl border-2 border-slate-300 overflow-hidden relative flex flex-col justify-between text-slate-900 select-none print:shadow-none print:m-0 print:border"
                style={{
                  fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                }}
              >
                {/* OVERLAY SI ESTÁ INACTIVO */}
                {isInactivo && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-5 text-center space-y-3 rounded-[24px]">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 shadow-lg">
                      <AlertTriangle className="w-10 h-10" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-widest bg-amber-950/90 px-3 py-1 rounded-full border border-amber-500/40">
                      ESTATUS: INACTIVO
                    </span>
                    <p className="text-xs font-black text-amber-100 bg-amber-900/90 p-3.5 rounded-2xl border border-amber-500/60 leading-relaxed uppercase shadow-xl">
                      SOCIO SIN SERVICIO ASIGNADO, NO AUTORIZADO A CUBRIR GUARDIA. REPORTAR AL 7714540072
                    </p>
                    <span className="text-[10px] text-slate-300 font-mono">
                      {staff.nombre} {staff.apellidos} ({socioLabel}: {empNumber})
                    </span>
                  </div>
                )}

                {/* Inner Content with blur when Inactivo */}
                <div className={`w-full h-full flex flex-col justify-between ${isInactivo ? "filter blur-sm opacity-40" : ""}`}>
                  {/* Top Navy Header Banner with Gold Trim */}
                  <div className="bg-[#0b192c] text-white pt-3 pb-2.5 px-3 relative border-b-2 border-amber-400 shadow-sm flex flex-col items-center justify-center shrink-0">
                    <div className="absolute top-1 left-2 opacity-20 pointer-events-none">
                      <BadgeCheck className="w-10 h-10 text-amber-300" />
                    </div>
                    <div className="absolute top-1.5 right-2 flex items-center gap-1 text-[7px] font-mono text-amber-300/80 border border-amber-400/30 px-1 py-0.5 rounded bg-slate-950/40">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>OFICIAL</span>
                    </div>

                    {/* Logo Header */}
                    <div className="scale-95">
                      <CuidarteLogo size="sm" showTagline={false} variant="white" />
                    </div>
                    <span className="text-[7.5px] font-black tracking-widest uppercase text-amber-300/90 mt-0.5 font-mono">
                      {isAdministrativo
                        ? "CREDENCIAL DE IDENTIFICACIÓN CORPORATIVA"
                        : "CREDENCIAL DE ADSCRIPCIÓN CENTRAL"}
                    </span>
                  </div>

                  {/* Security Dot Pattern Background */}
                  <CredentialGeometricBackground variant="front" />

                  {/* Main Content Body */}
                  <div className="relative z-10 px-3.5 py-2.5 flex flex-col justify-between flex-1">
                    
                    {/* Photo & Primary Details Grid */}
                    <div className="grid grid-cols-12 gap-2.5 items-start">
                      
                      {/* Left 7 Columns: Staff Details */}
                      <div className="col-span-7 space-y-2 pr-0.5">
                        <div>
                          <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-0.5">
                            Nombre(s):
                          </span>
                          <h3 className="text-[12px] font-black text-slate-900 uppercase leading-tight tracking-tight">
                            {staff.nombre}
                          </h3>
                        </div>

                        <div>
                          <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-0.5">
                            Apellidos:
                          </span>
                          <div className="bg-[#0b192c] text-white px-2 py-1 rounded-lg shadow-sm border border-slate-800">
                            <h4 className="text-[11.5px] font-black uppercase tracking-wide leading-tight break-words">
                              {staff.apellidos}
                            </h4>
                          </div>
                        </div>

                        <div>
                          <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-0.5">
                            Grado / Título:
                          </span>
                          <span className="text-[9px] font-extrabold text-slate-900 uppercase leading-tight block">
                            {staff.gradoTitulo || (isAdministrativo ? "LIC. EN ADMINISTRACIÓN" : "LICENCIADO EN ENFERMERÍA")}
                          </span>
                        </div>

                        <div>
                          <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-0.5">
                            Puesto / Cargo:
                          </span>
                          <span className="text-[11px] font-black text-[#0b192c] uppercase block leading-tight">
                            {staff.puestoTipoPersonal || (isVentas ? "VENTAS / ASESOR COMERCIAL" : isAtencionClientes ? "ATENCIÓN A CLIENTES" : isAdministrativo ? "ADMINISTRATIVO OPERATIVO" : "ENFERMERÍA")}
                          </span>
                        </div>

                        <div>
                          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-0.5">
                            Adscripción:
                          </span>
                          <p className="text-[8px] font-extrabold text-slate-800 uppercase leading-tight line-clamp-2">
                            {staff.areaAdscripcion || (isAdministrativo ? `DIRECCIÓN CORPORATIVA - ${staff.sucursalNombre || "CUIDARTE MÉXICO"}` : `DIRECCIÓN REGIONAL - ${staff.sucursalNombre || "CUIDARTE MÉXICO"}`)}
                          </p>
                        </div>
                      </div>

                      {/* Right 5 Columns: Photo Frame & Employee ID */}
                      <div className="col-span-5 flex flex-col items-center">
                        <div className="w-[115px] h-[138px] rounded-2xl overflow-hidden border-2 border-[#0b192c] ring-2 ring-amber-400/60 shadow-lg bg-slate-100 relative shrink-0">
                          <img
                            src={photoToDisplay}
                            alt={staff.nombre}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = defaultPhoto;
                            }}
                            className="w-full h-full object-cover object-center"
                          />
                          {/* Security Stamp Indicator */}
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-0.5 shadow-md border border-emerald-400/50">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>OFICIAL</span>
                          </div>
                        </div>

                        <div className="mt-1.5 text-center bg-slate-100 border border-slate-200 px-2 py-1 rounded-xl w-full">
                          <span className="text-[7px] font-black text-slate-500 uppercase block leading-none">
                            {socioLabel}
                          </span>
                          <span className="text-[13.5px] font-black text-[#0b192c] font-mono tracking-wider leading-tight block">
                            {empNumber}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Urgency Banner & Verification Strip */}
                    <div className="mt-1.5 space-y-1.5">
                      {/* Badge Ribbon */}
                      {staff.esSocioOperativo ? (
                        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-2 border-red-400 text-white p-1.5 rounded-xl shadow-md text-center flex flex-col justify-center items-center">
                          <span className="text-[7.5px] font-black uppercase tracking-widest block leading-none text-amber-200 mb-0.5">
                            🚨 SOCIO OPERATIVO AUTORIZADO
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-tight block leading-none text-white">
                            ATENCIÓN DE URGENCIAS
                          </span>
                        </div>
                      ) : isAdministrativo ? (
                        <div className="bg-gradient-to-r from-slate-900 via-sky-900 to-slate-900 border border-sky-500/60 text-white p-1.5 rounded-xl shadow-xs text-center flex flex-col justify-center items-center">
                          <span className="text-[7.5px] font-black uppercase tracking-widest block leading-none text-sky-300 mb-0.5">
                            {staff.badgePrincipal || "CREDENCIAL CORPORATIVA"}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-tight block leading-none text-white">
                            {isVentas
                              ? "VENTAS Y ASESORÍA COMERCIAL"
                              : isAtencionClientes
                              ? "ATENCIÓN A CLIENTES Y SERVICIOS"
                              : "COORDINACIÓN Y GESTIÓN CORPORATIVA"}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 border border-amber-500 text-[#991b1b] p-1.5 rounded-xl shadow-xs text-center flex flex-col justify-center items-center">
                          <span className="text-[7.5px] font-black uppercase tracking-widest block leading-none text-slate-950 mb-0.5">
                            {staff.badgePrincipal || "PERSONAL DE ATENCIÓN"}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-tight block leading-none text-[#b91c1c]">
                            A URGENCIAS Y CUIDADOS GENERALES
                          </span>
                        </div>
                      )}

                      {/* 5-Character Verification Code Box */}
                      <div className="bg-sky-50/90 border border-sky-200/90 rounded-xl px-2 py-1 flex items-center justify-between shadow-xs">
                        <div>
                          <span className="text-[6.5px] font-black text-slate-500 uppercase block leading-none">
                            CÓDIGO DE VERIFICACIÓN (5 CARACTERES):
                          </span>
                          <span className="text-[11.5px] font-mono font-black text-sky-950 tracking-[0.2em] leading-tight block">
                            {verifCode}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[6.5px] font-extrabold text-slate-500 uppercase block leading-none">
                            EXPIRACIÓN:
                          </span>
                          <span className="text-[9px] font-black text-[#0b192c] font-mono block">
                            {staff.fechaExpiracion || "21/08/2030"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* High-Security 1D Barcode Footer */}
                    <div className="pt-1.5 border-t-2 border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <div className="flex items-end gap-[1.5px] h-5 bg-white px-2 py-0.5 rounded">
                        {[2, 1, 4, 1, 3, 2, 5, 1, 4, 2, 3, 5, 2, 4, 1, 3, 2, 5, 1, 4, 2, 3, 4, 1, 5, 2].map((w, i) => (
                          <div
                            key={i}
                            className="bg-slate-900"
                            style={{
                              width: `${(w % 3) + 1.2}px`,
                              height: "100%",
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[9.5px] font-mono font-black text-[#0b192c] tracking-widest mt-0.5">
                        {folioDisplay}
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================== */}
        {/* BACK SIDE (REVERSO) - HIGH-SECURITY DESIGN */}
        {/* ========================================== */}
        {!isBaja && activeSide === "back" && (
          <div
            className="w-[336px] h-[528px] bg-white rounded-[24px] shadow-2xl border-2 border-slate-300 overflow-hidden relative flex flex-col justify-between text-slate-900 select-none print:shadow-none print:m-0 print:border"
            style={{
              fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
          >
            {/* OVERLAY SI ESTÁ INACTIVO */}
            {isInactivo && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-5 text-center space-y-3 rounded-[24px]">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 shadow-lg">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-widest bg-amber-950/90 px-3 py-1 rounded-full border border-amber-500/40">
                  ESTATUS: INACTIVO
                </span>
                <p className="text-xs font-black text-amber-100 bg-amber-900/90 p-3.5 rounded-2xl border border-amber-500/60 leading-relaxed uppercase shadow-xl">
                  SOCIO SIN SERVICIO ASIGNADO, NO AUTORIZADO A CUBRIR GUARDIA. REPORTAR AL 7714540072
                </p>
                <span className="text-[10px] text-slate-300 font-mono">
                  {staff.nombre} {staff.apellidos} ({socioLabel}: {empNumber})
                </span>
              </div>
            )}

            <div className={`w-full h-full flex flex-col justify-between ${isInactivo ? "filter blur-sm opacity-40" : ""}`}>
              {/* Top Navy Header */}
              <div className="bg-[#0b192c] text-white pt-3 pb-2.5 px-3 relative border-b-2 border-amber-400 shadow-sm flex flex-col items-center justify-center shrink-0">
                <div className="scale-95">
                  <CuidarteLogo size="sm" showTagline={false} variant="white" />
                </div>
              </div>

              {/* Security Dot Pattern Background */}
              <CredentialGeometricBackground variant="back" />

              {/* Content Layer */}
              <div className="relative z-10 px-4 py-3 flex flex-col h-full justify-between flex-1">
                {/* Banner Header */}
                {isAdministrativo ? (
                  <div className="bg-gradient-to-r from-slate-900 via-sky-900 to-slate-900 border border-sky-500/60 text-white py-1.5 px-3 rounded-xl shadow-xs text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider block leading-none text-sky-300">
                      {isVentas
                        ? "PERSONAL DE VENTAS Y ASESORÍA COMERCIAL"
                        : isAtencionClientes
                        ? "PERSONAL DE ATENCIÓN A CLIENTES Y SERVICIOS"
                        : "PERSONAL ADMINISTRATIVO Y DE GESTIÓN"}
                    </span>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 border border-amber-500 text-[#991b1b] py-1.5 px-3 rounded-xl shadow-xs text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider block leading-none">
                      PERSONAL DE ATENCIÓN A URGENCIAS
                    </span>
                  </div>
                )}

                {/* Official Authorization Legal Notice */}
                <div className="space-y-2.5 text-[10px] leading-relaxed text-slate-800 text-justify my-auto bg-slate-50/85 p-3 rounded-2xl border border-slate-200 shadow-xs">
                  {isAdministrativo ? (
                    <>
                      <p className="font-normal text-slate-800">
                        La presente credencial acredita al titular como colaborador de{" "}
                        <strong className="font-black not-italic text-slate-950 uppercase">
                          {staff.sucursalNombre || "Cuidarte México"}
                        </strong>
                        , facultado para el desarrollo de funciones corporativas, asesoría comercial, contratación, seguimiento institucional, coordinación administrativa y atención a clientes de los servicios de asistencia y cuidados.
                      </p>

                      <p className="font-normal text-[8.5px] text-slate-600 border-t border-slate-200 pt-1.5 leading-snug">
                        Documento oficial corporativo e intransferible. La vigencia y validez de esta identificación está sujeta a la relación laboral o contractual activa con la institución.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-normal italic">
                        El portador de esta credencial se identifica como{" "}
                        <strong className="font-black not-italic text-slate-950 uppercase">
                          personal operativo de atención de urgencias y cuidados generales
                        </strong>
                        , adscrito a <strong className="font-black not-italic text-slate-950 uppercase">{staff.sucursalNombre || "Cuidarte México"}</strong>
                        , encontrándose debidamente facultado para funciones asistenciales domiciliarias e institucionales.
                      </p>

                      <p className="font-normal italic">
                        Se solicita atentamente a las autoridades competentes y personal de salud brindar las facilidades necesarias para el correcto desempeño de sus atribuciones.
                      </p>
                    </>
                  )}
                </div>

                {/* Bottom Authorization & Contact Info */}
                <div className="space-y-2 text-center border-t-2 border-slate-200 pt-2 shrink-0">
                  {/* Barcode */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-end gap-[1.5px] h-5 bg-white px-2">
                      {[2, 4, 1, 3, 5, 2, 6, 1, 4, 2, 5, 3, 1, 4, 6, 2, 3, 5, 1, 4, 2, 6].map((w, i) => (
                        <div
                          key={i}
                          className="bg-slate-900"
                          style={{
                            width: `${(w % 3) + 1.2}px`,
                            height: "100%",
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[9.5px] font-mono font-black text-slate-900 tracking-wider mt-0.5">
                      {folioDisplay}
                    </span>
                  </div>

                  {/* Authorization Stamp Label */}
                  <div className="text-[8px] font-extrabold text-slate-600 uppercase tracking-tight leading-tight">
                    AUTORIZACIÓN DIRECCIÓN GENERAL
                    <br />
                    CUIDARTE MÉXICO {staff.sucursalNombre && staff.sucursalNombre.toLowerCase() !== "cuidarte méxico" ? `• ${staff.sucursalNombre.toUpperCase()}` : ""}
                  </div>

                  {/* Contact Information */}
                  <div className="text-[9px] font-bold text-slate-800 space-y-0.5 pt-0.5">
                    <p className="font-mono font-black text-[#0b192c]">
                      771 454 0072 EXT. 101
                    </p>
                    <p className="text-sky-700">hola@cuidartemexico.com</p>
                    <p className="text-slate-600 font-semibold">www.cuidartemexico.com</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Online Estatus Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 relative text-white">
            <button
              type="button"
              onClick={() => setShowVerificationModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
              <CheckCircle2 className="w-6 h-6" />
              <span>REGISTRO OFICIAL VERIFICADO</span>
            </div>

            <div className="bg-emerald-950/60 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">CÓDIGO DE VERIFICACIÓN OFICIAL</span>
              <div className="text-xl font-mono font-black text-amber-300 tracking-[0.25em] bg-slate-950 py-1.5 px-3 rounded-lg border border-amber-500/40 inline-block shadow-lg">
                {verifCode}
              </div>
              <p className="text-xs font-black text-white uppercase">✓ INTEGRANTE ACTIVO Y VIGENTE</p>
              <p className="text-[11px] text-emerald-200">
                {isAdministrativo
                  ? isVentas
                    ? "Personal de Ventas y Asesoría Comercial Acreditado"
                    : isAtencionClientes
                    ? "Personal de Atención a Clientes y Servicios Acreditado"
                    : "Personal Administrativo y de Gestión Acreditado"
                  : "Personal Acreditado de Atención a Urgencias"}
              </p>
            </div>

            <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 font-semibold">Nombre del Integrante:</span>
                <span className="font-bold text-white uppercase">{staff.nombre} {staff.apellidos}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 font-semibold">Especialidad / Puesto:</span>
                <span className="font-bold text-sky-400 uppercase">{staff.gradoTitulo || staff.puestoTipoPersonal}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 font-semibold">No. de Empleado / Folio:</span>
                <span className="font-mono font-bold text-white">{empNumber}</span>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-semibold">Fecha de Expiración:</span>
                <span className="font-mono font-bold text-white">{staff.fechaExpiracion || "21/08/2030"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowVerificationModal(false)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
