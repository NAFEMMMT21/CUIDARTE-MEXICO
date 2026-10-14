import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileText,
  Calendar,
  Building,
  User,
  Phone,
  MapPin,
  ExternalLink,
  Copy,
  ArrowLeft,
  Search,
  AlertTriangle,
  QrCode,
  DollarSign,
  CreditCard,
  Receipt,
  Clock,
  BadgeCheck,
  Award,
  Siren
} from "lucide-react";
import { Caratula, AbonoTicket, StaffMember } from "../types";
import { formatCurrency, getVerificationToken } from "../utils/formatters";
import { findStaffByKey, getStaffVerificationCode } from "../utils/staffVerification";
import { CuidarteLogo } from "./CuidarteLogo";
import { StaffCredentialCard } from "./StaffCredentialCard";
import { TermsAndPrivacyModal } from "./TermsAndPrivacyModal";

interface CaratulaVerificationPortalProps {
  folio?: string; // May be a token, folio, or staff verification code
  caratulas: Caratula[];
  staffMembers?: StaffMember[];
  abonos?: AbonoTicket[];
  onBack?: () => void;
  isAdminView?: boolean;
}

export const CaratulaVerificationPortal: React.FC<CaratulaVerificationPortalProps> = ({
  folio: initialKey = "",
  caratulas,
  staffMembers = [],
  abonos = [],
  onBack,
  isAdminView = false,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialKey);
  const [copied, setCopied] = useState(false);
  const [showFullCredentialCard, setShowFullCredentialCard] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [initialLegalTab, setInitialLegalTab] = useState<"terminos" | "privacidad">("terminos");

  const openLegalModal = (tab: "terminos" | "privacidad") => {
    setInitialLegalTab(tab);
    setLegalModalOpen(true);
  };

  // Target query key: If in admin view or interactive search (when initialKey is empty or changed), use searchQuery
  const targetKey = (isAdminView || !initialKey || searchQuery !== initialKey ? searchQuery : initialKey).trim();

  // First check if search matches a staff member:
  const matchedStaff = findStaffByKey(targetKey, staffMembers);

  // Find target carátula if no staff member matched:
  // If admin view, search can match either folio or verification token
  // If public view (!isAdminView), strictly match verification token to prevent folio enumeration
  const caratula = matchedStaff
    ? undefined
    : caratulas.find((c) => {
        const token = getVerificationToken(c).toLowerCase();
        const folio = (c.folio || "").trim().toLowerCase();
        const lowerKey = targetKey.toLowerCase();
        if (isAdminView) {
          return token === lowerKey || folio === lowerKey;
        }
        return token === lowerKey;
      });


  // Mask sensitive data for public verification view
  const maskName = (name: string) => {
    if (!name) return "Cliente Protegido";
    const parts = name.trim().split(" ");
    return parts
      .map((p) => (p.length > 2 ? p[0] + "***" + p[p.length - 1] : p[0] + "*"))
      .join(" ");
  };

  const maskPhone = (phone: string) => {
    if (!phone) return "***-***-****";
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 4) return "***-***-****";
    return `***-***-${clean.slice(-4)}`;
  };

  const maskAddress = (address: string) => {
    if (!address) return "Dirección protegida (Pachuca, Hgo.)";
    return "Pachuca de Soto / Zona Metrop. (Dirección exacta resguardada por LFPDPPP)";
  };

  const token = caratula ? getVerificationToken(caratula) : targetKey;
  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}?verify=${token}`
    : `https://www.cuidartemexico.com/?verify=${token}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center justify-center border border-slate-200" style={{ width: "115px", borderRadius: "10px", borderWidth: "1px" }}>
            <CuidarteLogo
              size="sm"
              showTagline={true}
              variant="header"
              sucursalId={caratula?.sucursalId}
              sucursalNombre={caratula?.sucursalNombre || "Cuidarte Pachuca"}
            />
          </div>
          <div className="hidden sm:block border-l border-slate-700 pl-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
              Portal Oficial de Verificación
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {caratula?.sucursalNombre || "Cuidarte México"} - Cuidado Integral
            </span>
          </div>
        </div>

        {isAdminView && onBack && (
          <button
            onClick={onBack}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>Volver al Panel</span>
          </button>
        )}
      </div>

      {/* Main Verification Card */}
      <div className="w-full max-w-3xl bg-slate-950/80 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Verification Status Header Banner */}
        {matchedStaff ? (
          (() => {
            const statusUpper = (matchedStaff.estatus || "Activo").toUpperCase();
            const isBaja = statusUpper === "BAJA";
            const isInactivo = statusUpper === "INACTIVO";
            const isEmpleado = matchedStaff.tipoContrato?.toLowerCase().includes("empleado");
            const socioLabel = isEmpleado ? "No. Empleado" : "No. Socio";

            if (isBaja) {
              return (
                <div className="bg-rose-950/90 border-b border-rose-800/80 p-6 sm:p-8 text-center space-y-3 relative overflow-hidden">
                  <div className="inline-flex items-center justify-center p-3.5 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/40 shadow-lg shadow-rose-950/50">
                    <AlertTriangle className="w-10 h-10" />
                  </div>

                  <div>
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-2">
                      ESTATUS EN SISTEMA: BAJA REGISTRADA
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {matchedStaff.nombre} {matchedStaff.apellidos}
                    </h1>
                    <div className="mt-3 bg-rose-900/90 text-rose-100 p-4 rounded-2xl border border-rose-500/60 max-w-xl mx-auto shadow-xl space-y-1">
                      <p className="text-xs sm:text-sm font-black uppercase tracking-wide leading-relaxed">
                        SOCIO NO VINCULADO A CUIDARTE PACHUCA, NO AUTORIZADO A CUBRIR GUARDIAS. REPORTAR AL 7714540072
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            if (isInactivo) {
              return (
                <div className="bg-amber-950/90 border-b border-amber-800/80 p-6 sm:p-8 text-center space-y-3 relative overflow-hidden">
                  <div className="inline-flex items-center justify-center p-3.5 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/40 shadow-lg shadow-amber-950/50">
                    <AlertTriangle className="w-10 h-10" />
                  </div>

                  <div>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-2">
                      ESTATUS EN SISTEMA: INACTIVO
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      {matchedStaff.nombre} {matchedStaff.apellidos}
                    </h1>
                    <div className="mt-3 bg-amber-900/90 text-amber-100 p-4 rounded-2xl border border-amber-500/60 max-w-xl mx-auto shadow-xl space-y-1">
                      <p className="text-xs sm:text-sm font-black uppercase tracking-wide leading-relaxed">
                        SOCIO SIN SERVICIO ASIGNADO, NO AUTORIZADO A CUBRIR GUARDIA. REPORTAR AL 7714540072
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-emerald-950/70 border-b border-emerald-800/60 p-6 sm:p-8 text-center space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                  <BadgeCheck className="w-48 h-48 text-emerald-400" />
                </div>

                <div className="inline-flex items-center justify-center p-3 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40 shadow-lg shadow-emerald-950/50 animate-pulse">
                  <ShieldCheck className="w-9 h-9" />
                </div>

                <div>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-2">
                    PERSONAL OFICIAL ACTIVO Y ACREDITADO
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {matchedStaff.nombre} {matchedStaff.apellidos}
                  </h1>
                  <p className="text-xs sm:text-sm text-emerald-200 max-w-lg mx-auto font-bold mt-1 uppercase">
                    {matchedStaff.gradoTitulo || matchedStaff.puestoTipoPersonal}
                  </p>
                </div>
              </div>
            );
          })()
        ) : caratula ? (
          caratula.estado === "Cancelado" ? (
            <div className="bg-rose-900/40 border-b border-rose-800/60 p-6 text-center space-y-2">
              <div className="inline-flex items-center justify-center p-3 bg-rose-500/20 text-rose-400 rounded-full mb-1 border border-rose-500/30">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-rose-200 tracking-tight">
                DOCUMENTO CANCELADO
              </h1>
              <p className="text-xs text-rose-300 max-w-md mx-auto">
                Este documento ({caratula.folio}) consta en los registros pero fue marcado como CANCELADO en los sistemas centrales.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-950/60 border-b border-emerald-800/60 p-6 sm:p-8 text-center space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <ShieldCheck className="w-48 h-48 text-emerald-400" />
              </div>

              <div className="inline-flex items-center justify-center p-3 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40 shadow-lg shadow-emerald-950/50 animate-pulse">
                <ShieldCheck className="w-9 h-9" />
              </div>

              <div>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-2">
                  OFICIAL Y AUTÉNTICO
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  CARÁTULA VERIFICADA - ORIGINAL
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200 max-w-lg mx-auto font-medium mt-1">
                  Documento validado exitosamente en el servidor central de Cuidarte Pachuca.
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="bg-amber-950/40 border-b border-amber-800/60 p-6 text-center space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-amber-500/20 text-amber-400 rounded-full mb-1 border border-amber-500/30">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-amber-200 tracking-tight">
              REGISTRO NO ENCONTRADO O NO VÁLIDO
            </h1>
            <p className="text-xs text-amber-300 max-w-md mx-auto">
              No se pudo verificar ningún personal o carátula oficial con la clave o código ingresado.
            </p>
          </div>
        )}

        {/* Search Input Bar (Shown in Admin view or general search) */}
        {(isAdminView || !initialKey) && (
          <div className="p-4 sm:p-6 bg-slate-900/60 border-b border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="flex flex-col sm:flex-row items-center gap-2 max-w-lg mx-auto"
            >
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Código de 5 dígitos (ej. X8K2P) o Nombre Completo..."
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs sm:text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 placeholder:font-sans placeholder:font-normal"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition min-h-[42px] shrink-0 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Verificar</span>
              </button>
            </form>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Ingrese el código alfanumérico de 5 caracteres de la credencial oficial o el nombre completo del personal.
            </p>
          </div>
        )}

         {/* STAFF MEMBER DETAILS VIEW */}
        {matchedStaff ? (
          (() => {
            const statusUpper = (matchedStaff.estatus || "Activo").toUpperCase();
            const isBaja = statusUpper === "BAJA";
            const isInactivo = statusUpper === "INACTIVO";
            const isEmpleado = matchedStaff.tipoContrato?.toLowerCase().includes("empleado");
            const socioLabel = isEmpleado ? "No. Empleado" : "No. Socio";

            return (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                  {/* Photo Frame - HIDE IF BAJA, BLUR IF INACTIVO */}
                  {!isBaja && (
                    <div className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-xl bg-slate-950 relative shrink-0">
                      <img
                        src={
                          matchedStaff.fotoUrl && matchedStaff.fotoUrl.trim() !== ""
                            ? matchedStaff.fotoUrl
                            : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='160' viewBox='0 0 120 160' fill='%231e293b'><rect width='120' height='160' fill='%23f1f5f9'/><circle cx='60' cy='60' r='32' fill='%2394a3b8'/><path d='M10 150 C10 105, 110 105, 110 150 Z' fill='%2394a3b8'/></svg>"
                        }
                        alt={matchedStaff.nombre}
                        className={`w-full h-full object-cover object-center ${isInactivo ? "filter blur-md opacity-40 select-none" : ""}`}
                      />
                      {isInactivo ? (
                        <div className="absolute top-1.5 right-1.5 bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-md">
                          <AlertTriangle className="w-3 h-3" />
                          <span>INACTIVO</span>
                        </div>
                      ) : (
                        <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ACTIVO</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 space-y-3 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 bg-amber-400 text-slate-950 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                      <Siren className="w-4 h-4 text-rose-700" />
                      <span>{matchedStaff.badgePrincipal || "PERSONAL DE ATENCIÓN A URGENCIAS"}</span>
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        {matchedStaff.nombre} {matchedStaff.apellidos}
                      </h2>
                      <p className="text-sm text-emerald-400 font-extrabold uppercase mt-0.5">
                        {matchedStaff.gradoTitulo || matchedStaff.puestoTipoPersonal}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">{socioLabel}</span>
                        <span className="font-bold text-white text-sm">{matchedStaff.noSocio}</span>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">Folio Urgencias</span>
                        <span className="font-bold text-amber-300 text-sm">{matchedStaff.folioUrgencias || `01${matchedStaff.noSocio}`}</span>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-[9px] text-slate-400 uppercase block font-sans font-bold">Vigencia</span>
                        <span className="font-bold text-emerald-400 text-sm">{matchedStaff.fechaExpiracion || "21/08/2030"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Certification Summary */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                  <h3 className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-400" />
                    <span>Dictamen de Autenticidad y Adscripción Central</span>
                  </h3>

                  <div className="space-y-2 text-slate-300 leading-relaxed">
                    <p>
                      • <strong className="text-white">Adscripción Oficial:</strong> {matchedStaff.areaAdscripcion || "DIRECCIÓN CENTRAL-PACHUCA Y REGIONAL ESTADO DE HIDALGO"}.
                    </p>
                    <p>
                      • <strong className="text-white">Código de Verificación (5 Caracteres):</strong>{" "}
                      <span className="font-mono text-amber-300 font-bold bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/40 text-sm tracking-widest">
                        {getStaffVerificationCode(matchedStaff)}
                      </span>
                    </p>
                    <p>
                      • <strong className="text-white">Folio Oficial de Registro:</strong>{" "}
                      <span className="font-mono text-emerald-300 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                        {matchedStaff.folioUrgencias || `01${matchedStaff.noSocio ? matchedStaff.noSocio.replace(/\D/g, "") : "25001"}`}
                      </span>
                    </p>
                    <p>
                      • <strong className="text-white">Estatus en Servidor Central:</strong>{" "}
                      {isBaja ? (
                        <span className="text-rose-400 font-bold uppercase">
                          BAJA REGISTRADA. SOCIO NO VINCULADO A CUIDARTE PACHUCA, NO AUTORIZADO A CUBRIR GUARDIAS. REPORTAR AL 7714540072.
                        </span>
                      ) : isInactivo ? (
                        <span className="text-amber-400 font-bold uppercase">
                          INACTIVO. SOCIO SIN SERVICIO ASIGNADO, NO AUTORIZADO A CUBRIR GUARDIA. REPORTAR AL 7714540072.
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold uppercase">
                          INTEGRANTE HABILITADO Y EN FUNCIONES. Autorizado para asistencia en salud domiciliaria, urgencias y cuidados generales.
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-slate-400">
                    <div className="flex items-center gap-2 text-[11px] bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>Verificación de Seguridad Oficial:</strong> Estatus de adscripción autenticado. Por protocolo de seguridad, la credencial impresa/digital sólo se expide administrativamente.
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 shrink-0">
                      <BadgeCheck className="w-4 h-4 text-emerald-400" />
                      <span>Sello Cryptográfico Verificado Cuidarte Pachuca</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : caratula ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Essential Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Folio Oficial
                </span>
                <span className="font-mono font-black text-emerald-400 text-base sm:text-lg">
                  {caratula.folio}
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Tipo Documento
                </span>
                <span className="font-bold text-white text-xs sm:text-sm">
                  {caratula.tipoDocumento || "Carátula de Servicio"}
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Fecha Emisión
                </span>
                <span className="font-mono text-slate-300 text-xs block">
                  {caratula.timestamp || "Registrado"}
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                  Estado Pago
                </span>
                <span
                  className={`font-bold text-xs ${
                    caratula.pendiente <= 0
                      ? "text-emerald-400"
                      : caratula.pagado > 0
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {caratula.pendiente <= 0
                    ? "Liquidado 100%"
                    : caratula.pagado > 0
                    ? "Con Abonos"
                    : "Pendiente"}
                </span>
              </div>
            </div>

            {/* Masked Sensitive Client Info Section */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h2 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Titular del Servicio (Datos Protegidos)
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-medium">
                  <Lock className="w-3 h-3" /> LFPDPPP Cumplimiento
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Cliente / Contratante:</span>
                  <span className="font-bold text-slate-200">
                    {maskName(caratula.nombreCompletoCliente)}
                  </span>
                </div>

                {caratula.nombreCompletoRS && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Receptor del Servicio:</span>
                    <span className="font-bold text-slate-200">
                      {maskName(caratula.nombreCompletoRS)}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-slate-500 block text-[10px]">Teléfono de Contacto:</span>
                  <span className="font-mono text-slate-300">
                    {maskPhone(caratula.numeroContacto)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Ubicación del Cuidado:</span>
                  <span className="text-slate-300">
                    {maskAddress(caratula.direccionServicio)}
                  </span>
                </div>
              </div>
            </div>

            {/* Contrated Services Summary */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Resumen de Servicios Contratados
              </h2>

              <div className="divide-y divide-slate-800/60">
                {caratula.servicios
                  .filter((s) => s.servicio && s.servicio.trim() !== "")
                  .map((s, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{s.servicio}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {s.cantidad} unidad(es) / turno(s)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-300">
                        {formatCurrency(s.precioTot)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Service Dates or Vigencia de Uso */}
              {Boolean(caratula.modalidadVigencia) ? (
                <div className="pt-2.5 border-t border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between text-xs bg-slate-950 p-2.5 rounded-xl border border-sky-500/30">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Modalidad Vigencia de Uso:</span>
                    </div>
                    <span className="font-mono text-white text-xs font-bold">
                      Válido hasta {caratula.fechaVigenciaFin || caratula.fin?.slice(0, 10)} {caratula.diasVigencia ? `(${caratula.diasVigencia} días)` : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans font-bold">Contratadas</span>
                      <span className="font-bold text-white text-xs">{caratula.guardiasTotalContratadas ?? caratula.servicios.reduce((acc, s) => acc + (s.cantidad || 0), 0)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans font-bold">Agendadas</span>
                      <span className="font-bold text-sky-400 text-xs">{caratula.guardiasAgendadas ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-sans font-bold">Por Agendar</span>
                      <span className="font-bold text-emerald-400 text-xs">{caratula.guardiasPendientesPorAgendar ?? (caratula.guardiasTotalContratadas ?? 0) - (caratula.guardiasAgendadas ?? 0)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                (caratula.inicio || caratula.fin) && (
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Periodo de Atención:</span>
                    </div>
                    <span className="font-mono text-white">
                      {caratula.inicio || "A convenir"} al {caratula.fin || "A convenir"}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Cronograma de Guardias Programadas / Fechas Asignadas */}
            {(() => {
              const shifts = (caratula.guardiasProgramadas && Array.isArray(caratula.guardiasProgramadas))
                ? caratula.guardiasProgramadas
                : [];

              if (shifts.length === 0) return null;

              return (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h2 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      Cronograma Oficial de Guardias Asignadas ({shifts.length})
                    </h2>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      {shifts.length} Guardias Programadas
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                          <th className="py-2 px-2 text-center w-8">#</th>
                          <th className="py-2 px-3">Fecha</th>
                          <th className="py-2 px-3">Horario</th>
                          <th className="py-2 px-3">Servicio</th>
                          <th className="py-2 px-3">Personal Asignado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {shifts.map((shift, idx) => (
                          <tr key={shift.id || idx} className="hover:bg-slate-800/30 transition">
                            <td className="py-2 px-2 text-center text-slate-500 font-bold">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-bold text-white">
                              {shift.fecha}
                            </td>
                            <td className="py-2 px-3 text-sky-300">
                              {shift.horaInicio} - {shift.horaFin}
                              {shift.fechaFinCalculada && shift.fechaFinCalculada !== shift.fecha && (
                                <span className="text-[9.5px] text-indigo-400 block font-sans">
                                  (+1 día {shift.fechaFinCalculada})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-300">
                              {shift.tipoServicio}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              {shift.personalAsignado && shift.personalAsignado !== "Por asignar" ? (
                                <span className="text-emerald-400 font-bold">
                                  {shift.personalAsignado}
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">Por asignar</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Payments & Account Balance Section (Estado de Cuenta y Pagos) */}
            {(() => {
              const caratulaAbonos = (abonos || []).filter(
                (a) => (a.caratulaFolio || "").trim().toUpperCase() === (caratula.folio || "").trim().toUpperCase() && !(a as any).cancelado
              );
              const totalPagado = caratula.pagado || 0;
              const totalPendiente = caratula.pendiente ?? Math.max(0, caratula.total - totalPagado);
              const isLiquidado = totalPendiente <= 0;

              // When balance reaches $0, reset the active counter to $0.00 instead of accumulating liquidated totals
              const displayAbonado = isLiquidado ? 0 : totalPagado;
              const progressPct = caratula.total > 0
                ? isLiquidado ? 100 : Math.min(100, Math.round((totalPagado / caratula.total) * 100))
                : 100;

              return (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h2 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Estado de Cuenta y Registro de Pagos
                    </h2>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      isLiquidado
                        ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
                        : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      {isLiquidado ? "SALDO $0.00 • LIQUIDADO" : `${progressPct}% Cubierto`}
                    </span>
                  </div>

                  {/* Liquidated banner notice */}
                  {isLiquidado && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center gap-3 text-emerald-200 text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="font-bold">Cuenta Totalmente Liquidada (Saldo $0.00)</p>
                        <p className="text-[11px] text-emerald-300/80">
                          Al haberse cubierto la totalidad del servicio, el contador de pagos activos se ha reiniciado.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Financial Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                        Monto Total
                      </span>
                      <span className="text-lg font-black text-white">
                        {formatCurrency(caratula.total)}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                        Abonado / Pagado
                      </span>
                      <span className="text-lg font-black text-emerald-400">
                        {formatCurrency(displayAbonado)}
                      </span>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block mb-1">
                        Saldo Pendiente
                      </span>
                      <span className={`text-lg font-black ${isLiquidado ? "text-emerald-400" : "text-amber-400"}`}>
                        {formatCurrency(0)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Detailed Payments / Abonos Table */}
                  <div className="pt-2 space-y-2">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                      Historial de Abonos Registrados
                    </h3>

                    {caratulaAbonos.length > 0 ? (
                      <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
                        {caratulaAbonos.map((abono, idx) => (
                          <div key={abono.id || idx} className="p-3 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-emerald-400">{abono.id}</span>
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                                  {abono.metodoPago}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{(abono as any).timestamp || (abono as any).fecha || "Registrado"}</span>
                                {abono.referencia && (
                                  <span className="text-slate-500">• Ref: {abono.referencia}</span>
                                )}
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <span className="text-xs font-black text-emerald-400 block">
                                +{formatCurrency(abono.montoAbonado)}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Restante: {formatCurrency(abono.pendienteRestante)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : totalPagado > 0 ? (
                      <div className="p-3 border border-slate-800 rounded-xl bg-slate-950/60 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-slate-300">Anticipo / Pago registrado en carátula</span>
                        </div>
                        <span className="font-bold text-emerald-400">+{formatCurrency(totalPagado)}</span>
                      </div>
                    ) : (
                      <div className="p-3 border border-slate-800 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500">
                        Aún no se registran abonos o pagos para este documento.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Totals Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
              <div className="text-center sm:text-left space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold block">
                  Monto Total Oficial Registrado
                </span>
                <span className="text-2xl font-black text-white">
                  {formatCurrency(caratula.total)}
                </span>
              </div>

              {/* Copy link button shown ONLY in Admin view */}
              {isAdminView && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition min-h-[42px]"
                  >
                    <Copy className="w-4 h-4 text-emerald-400" />
                    <span>{copied ? "¡Enlace Copiado!" : "Copiar Enlace de Verificación"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Official Footer Disclaimer */}
            <div className="text-center pt-2 space-y-2">
              <div className="inline-flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-mono bg-slate-900/60 px-3 py-1 rounded-full border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>VERIFICACIÓN DIGITAL CUIDARTE - {caratula.folio}</span>
              </div>
              <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
                Cuidarte Pachuca - Cuidado integral, confianza total. Si requiere validación adicional o emitir factura fiscal, comuníquese directamente con la administración oficial.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
            <p className="text-sm font-semibold text-slate-300">
              No se encontró ninguna carátula correspondiente al enlace o código proporcionado.
            </p>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 space-y-3 text-left shadow-lg">
              <p className="leading-relaxed">
                • Verifique que el enlace o clave ingresada coincida exactamente con la información provista en su documento original.
              </p>
              <p className="leading-relaxed">
                • <strong className="text-amber-400 font-bold">Aviso de Seguridad:</strong> Si no es posible validar su documento, su servicio o compra podría no ser una transacción oficial con Cuidarte Pachuca.
              </p>
              <div className="pt-3 border-t border-slate-800 text-center space-y-2">
                <p className="text-slate-300 font-medium text-[11px]">
                  Para confirmar la autenticidad de su compra o reportar alguna irregularidad, comuníquese directamente a nuestra línea oficial:
                </p>
                <a
                  href="tel:7714540072"
                  className="inline-flex items-center justify-center gap-2 text-emerald-400 font-mono font-black text-base hover:text-emerald-300 transition px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>7714540072</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Verification Portal Minimal Footer */}
      <div className="w-full max-w-3xl mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 space-y-1.5">
        <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => openLegalModal("terminos")}
            className="hover:text-sky-300 transition underline font-medium cursor-pointer"
          >
            Términos y Condiciones
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => openLegalModal("privacidad")}
            className="hover:text-emerald-300 transition underline font-medium cursor-pointer"
          >
            Aviso de Privacidad
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          © {new Date().getFullYear()} Cuidarte Pachuca • Cuidado Integral y Atención a la Salud
        </p>
      </div>

      {/* Modal de Términos y Privacidad */}
      <TermsAndPrivacyModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={initialLegalTab}
        userType="cliente"
      />
    </div>
  );
};

