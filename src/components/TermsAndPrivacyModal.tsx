import React, { useState, useEffect } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import {
  ShieldCheck,
  FileText,
  Lock,
  X,
  CheckCircle2,
  Phone,
  Mail,
  Globe,
  Scale,
  AlertCircle,
  UserCheck,
  HeartHandshake,
  Stethoscope,
  Briefcase,
  Building2,
  FileBadge,
  ShieldAlert
} from "lucide-react";

export type LegalUserType = "personal" | "cliente";

export interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "terminos" | "privacidad";
  userType?: LegalUserType;
  verifiedUser?: { username: string; nombre?: string; role: string; clientId?: string } | null;
  requireAcceptance?: boolean;
  onAccept?: () => void;
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  initialTab = "terminos",
  userType = "personal",
  verifiedUser = null,
  requireAcceptance = false,
  onAccept,
}) => {
  const [activeTab, setActiveTab] = useState<"terminos" | "privacidad">(initialTab);
  // Applicable profile is strictly locked to the user type; users cannot switch to another profile
  const applicableProfile: LegalUserType = userType === "cliente" ? "cliente" : "personal";
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      setHasAgreed(false);
    }
  }, [isOpen]);

  // Lock background body scroll while legal modal is displayed
  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              applicableProfile === "personal"
                ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            }`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full border ${
                  applicableProfile === "personal"
                    ? "bg-sky-500/20 text-sky-300 border-sky-400/30"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                }`}>
                  Marco Legal, Deontológico y Normativo
                </span>
                {verifiedUser && (
                  <span className="text-[10px] uppercase font-black tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Usuario Verificado</span>
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                Términos y Condiciones & Aviso de Privacidad
              </h3>
              <p className="text-xs text-slate-400">
                {verifiedUser ? (
                  <span>
                    Acceso autorizado para: <strong className="text-white">{verifiedUser.nombre || verifiedUser.username}</strong> ({verifiedUser.role === "client" ? "Cliente / Familiar" : `Personal Cuidarte - ${verifiedUser.role}`})
                  </span>
                ) : (
                  "CUIDARTE MÉXICO • Soluciones de asistencia y gestión para el bienestar familiar"
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Banner de Perfil Legal Aplicable (Exclusivo para el usuario activo) */}
        <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-sky-400" />
              <span>Perfil Legal Aplicable:</span>
            </span>

            {applicableProfile === "personal" ? (
              <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-sky-400" />
                <span>Personal de Cuidarte (Socios, Enfermería y Administrativo)</span>
              </span>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-xl font-black text-xs flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                <span>Clientes, Pacientes y Familiares Receptores</span>
              </span>
            )}
          </div>

          {verifiedUser && (
            <span className="text-[11px] text-slate-300 font-medium">
              {applicableProfile === "personal" ? "Colaborador: " : "Titular: "}
              <strong className="text-white">{verifiedUser.nombre || verifiedUser.username}</strong>
            </span>
          )}
        </div>

        {/* Tab Navigation (Términos vs Privacidad para el perfil aplicable) */}
        <div className="flex border-b border-slate-200 bg-slate-100/90 p-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("terminos")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
              activeTab === "terminos"
                ? applicableProfile === "personal"
                  ? "bg-white text-sky-900 shadow-sm border border-slate-200"
                  : "bg-white text-emerald-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <FileText className={`w-4 h-4 ${applicableProfile === "personal" ? "text-sky-600" : "text-emerald-600"}`} />
            <span>
              📄 Términos y Condiciones {applicableProfile === "personal" ? "(Personal y Deontológico)" : "(Servicio a Clientes)"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("privacidad")}
            className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
              activeTab === "privacidad"
                ? applicableProfile === "personal"
                  ? "bg-white text-sky-900 shadow-sm border border-slate-200"
                  : "bg-white text-emerald-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Lock className={`w-4 h-4 ${applicableProfile === "personal" ? "text-sky-600" : "text-emerald-600"}`} />
            <span>
              🔐 Aviso de Privacidad {applicableProfile === "personal" ? "(Laboral y Colaboradores)" : "(Integral Clientes)"}
            </span>
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed flex-1 bg-slate-50/50">
          {/* ========================================================================= */}
          {/* PERFIL: PERSONAL DE CUIDARTE PACHUCA (SOCIOS, ENFERMERÍA, ADMINISTRATIVO) */}
          {/* ========================================================================= */}
          {applicableProfile === "personal" && activeTab === "terminos" && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl flex items-start gap-3 text-sky-950">
                <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-black block uppercase tracking-wider text-[11px] text-sky-800">
                    TÉRMINOS, CONDICIONES Y CÓDIGO DE ÉTICA PARA EL PERSONAL DE CUIDARTE PACHUCA
                  </span>
                  <p>
                    Aplicable a todo socio operativo, profesional de enfermería, cuidador, técnico de atención y personal administrativo. El acceso con credenciales oficiales al sistema implica la aceptación incondicional del presente reglamento.
                  </p>
                </div>
              </div>

              {/* I. ÁMBITO DE APLICACIÓN, MEMBRESÍA AL CLUB DE SOCIOS CUIDARTE PACHUCA Y NO RELACIÓN LABORAL */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-sky-100 pb-2">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">I</span>
                    MEMBRESÍA AL CLUB DE SOCIOS CUIDARTE PACHUCA Y AUSENCIA DE RELACIÓN LABORAL
                  </h4>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300">
                    Régimen de Membresía Independiente
                  </span>
                </div>

                <div className="p-3.5 bg-sky-50/80 rounded-xl border border-sky-200 text-sky-950 text-xs leading-relaxed space-y-2">
                  <p className="font-bold text-sky-900">
                    📌 A los socios se les asignan y ofertan servicios y guardias exclusivamente en virtud de su suscripción de membresía activa al "Club de Socios Cuidarte Pachuca".
                  </p>
                  <p>
                    Los socios <strong>no son empleados</strong> de Cuidarte Pachuca. Son socios y profesionales independientes que adquieren y mantienen una membresía para poder recibir ofertas de guardias y servicios de atención clínica domiciliaria u hospitalaria para cubrir libremente.
                  </p>
                  <p className="font-semibold text-rose-900 bg-rose-50 p-2 rounded-lg border border-rose-200">
                    ⚖️ Al no existir una relación laboral o patronal de subordinación, el estatus de socio <strong>no genera derechos de empleado</strong> ni prestaciones laborales, tratándose de una contraprestación por honorarios/compensaciones pactadas por cada guardia o servicio cubierto.
                  </p>
                </div>

                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <span className="font-black text-slate-900 block uppercase tracking-wider text-[11px]">
                    Requisitos de Permanencia y Renovación de la Membresía:
                  </span>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                    <li>
                      <strong>Cumplimiento del Reglamento Interno:</strong> Para poder conservar y renovar periódicamente su membresía, el socio debe cumplir íntegramente con el Reglamento de Socio, los procedimientos internos operativos y las políticas deontológicas de Cuidarte Pachuca.
                    </li>
                    <li>
                      <strong>Perfil y Credenciales Vigentes:</strong> Como miembro activo del Club de Socios Cuidarte Pachuca, es obligatorio satisfacer el perfil profesional requerido (título, cédula profesional o constancia técnica acreditada, expediente digital verificado y capacitación continua).
                    </li>
                    <li>
                      <strong>Reglas y Protocolos Clínicos:</strong> Apego irrestricto a los protocolos de bioseguridad, puntualidad, registro obligatorio en kárdex/bitácora, administración segura de fármacos y entrega-recepción formal de guardia.
                    </li>
                    <li>
                      <strong>Facultad de No Renovación:</strong> El incumplimiento a las reglas del club, faltas éticas, abandono injustificado de servicios o quejas fundadas de clientes facultará la suspensión temporal o la no renovación definitiva de la membresía del socio, perdiendo el acceso a la oferta de guardias.
                    </li>
                  </ul>
                </div>
              </div>

              {/* II. CÓDIGO DE ÉTICA, DEONTOLOGÍA Y SECRETO PROFESIONAL */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">II</span>
                  CÓDIGO DE ÉTICA, DEONTOLOGÍA Y SECRETO PROFESIONAL CLÍNICO
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  En cumplimiento con la <strong>NOM-004-SSA3-2012</strong> (Del expediente clínico), la <strong>NOM-019-SSA3-2013</strong> (Para la práctica de enfermería en el Sistema Nacional de Salud) y la legislación sanitaria mexicana vigente:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5">
                  <li>
                    <strong>Secreto Profesional Absoluto:</strong> El colaborador se obliga a guardar confidencialidad estricta y perpetua sobre los diagnósticos, evolución médica, patologías, dinámicas familiares y cualquier dato sensible al que tenga acceso durante el desempeño de sus labores.
                  </li>
                  <li>
                    <strong>Prohibición de Registro Fotográfico/Audiovisual no Autorizado:</strong> Queda terminantemente prohibido fotografiar o grabar al paciente, sus instalaciones domiciliarias o documentación clínica sin consentimiento previo por escrito y autorización expresa de la Dirección.
                  </li>
                  <li>
                    <strong>Trato Digno y Humanizado:</strong> El paciente debe ser atendido en todo momento con respeto irrestricto a sus derechos humanos, pudor, autonomía y valores éticos.
                  </li>
                </ul>
              </div>

              {/* III. DILIGENCIA EN KÁRDEX Y ADMINISTRACIÓN DE MEDICAMENTOS */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">III</span>
                  DILIGENCIA CLÍNICA, REGLA DE LOS 10 CORRECTOS Y KÁRDEX DIGITAL
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Todo socio y enfermero responsable de ministrar medicamentos en el domicilio debe aplicar obligatoriamente la regla de seguridad clínica:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  <li><strong>1.</strong> Paciente correcto.</li>
                  <li><strong>2.</strong> Medicamento correcto prescrito por médico tratante con receta vigente.</li>
                  <li><strong>3.</strong> Dosis exacta y dilución correspondiente.</li>
                  <li><strong>4.</strong> Vía de administración correcta.</li>
                  <li><strong>5.</strong> Horario e intervalo prescrito.</li>
                  <li><strong>6.</strong> Registro digital inmediato en la bitácora / Kárdex de Cuidarte Pachuca.</li>
                  <li><strong>7.</strong> Verificación de fecha de caducidad e integridad del fármaco.</li>
                </ul>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs font-medium mt-2 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    La falsificación de registros clínicos, la omisión deliberada de ministración o el registro de tomas no efectuadas constituye una falta grave que causará la baja inmediata y la notificación a las autoridades sanitarias y penales correspondientes.
                  </span>
                </div>
              </div>

              {/* IV. PROTOCOLO DE GUARDIAS, PUNTUALIDAD Y ENTREGA DE TURNO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">IV</span>
                  PROTOCOLOS DE GUARDIA, PUNTUALIDAD Y ENTREGA DE TURNO
                </h4>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5">
                  <li>
                    <strong>Puntualidad:</strong> Presentarse con al menos 10 minutos de anticipación al horario asignado para recibir el turno debidamente uniformado y con equipo de trabajo completo.
                  </li>
                  <li>
                    <strong>Prohibición de Abandono de Servicio:</strong> El personal no podrá retirarse del servicio bajo ninguna circunstancia hasta que el relevo asignado se encuentre físicamente en el domicilio y se haya completado el protocolo de entrega-recepción y firma de bitácora.
                  </li>
                  <li>
                    <strong>Notificación de Incidencias:</strong> Cualquier alteración en signos vitales, deterioro del paciente, caída o eventualidad médica debe ser reportada inmediatamente a la Coordinación Operativa y a los familiares responsables.
                  </li>
                </ul>
              </div>

              {/* V. CONFIDENCIALIDAD COMERCIAL Y NO COMPETENCIA (NDA) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">V</span>
                  CONFIDENCIALIDAD COMERCIAL Y NO DIVULGACIÓN (NDA)
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  El directorio de clientes, números de contacto, tabuladores de cobro, contratos y estrategias logísticas de Cuidarte Pachuca constituyen secretos comerciales protegidos por la <strong>Ley Federal de Protección a la Propiedad Industrial</strong>.
                </p>
                <p className="text-slate-600 text-xs leading-relaxed font-semibold text-rose-900">
                  Queda estrictamente prohibido a los socios y empleados convenir acuerdos particulares, ofrecer servicios de cuidado de forma directa o desviar clientes asignados por la agencia, bajo pena de rescisión contractual y demanda por daños y perjuicios comerciales.
                </p>
              </div>

              {/* VI. CREDENCIAL OFICIAL Y USO DE PLATAFORMA DIGITAL */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">VI</span>
                  CREDENCIAL INSTITUCIONAL Y USO DE LA PLATAFORMA
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  La credencial con código QR y folio oficial expedida por Cuidarte Pachuca debe portarse en lugar visible durante toda la guardia. Las credenciales de acceso al sistema informático son personales, intransferibles y monitoreadas mediante registros de auditoría digital.
                </p>
              </div>

              {/* VII. LEGISLACIÓN Y JURISDICCIÓN */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">VII</span>
                  JURISDICCIÓN Y TRIBUNALES COMPETENTES
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Para dirimir controversias sobre la interpretación o cumplimiento de estos términos, las partes se someten a las leyes aplicables en los Estados Unidos Mexicanos y a los tribunales de Pachuca de Soto, Estado de Hidalgo.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* AVISO DE PRIVACIDAD PARA EL PERSONAL DE CUIDARTE PACHUCA */}
          {/* ========================================================================= */}
          {applicableProfile === "personal" && activeTab === "privacidad" && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl flex items-start gap-3 text-sky-950">
                <Lock className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-black block uppercase tracking-wider text-[11px] text-sky-800">
                    AVISO DE PRIVACIDAD INTEGRAL PARA PERSONAL Y SOCIOS OPERATIVOS
                  </span>
                  <p>
                    Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).
                  </p>
                </div>
              </div>

              {/* 1. RESPONSABLE DEL TRATAMIENTO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">1</span>
                  RESPONSABLE DEL TRATAMIENTO DE DATOS PERSONALES
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  <strong>Cuidarte Pachuca</strong>, con domicilio operativo en Pachuca de Soto, Hidalgo, México, es el Responsable del tratamiento, resguardo y protección de sus datos personales.
                </p>
              </div>

              {/* 2. DATOS RECABADOS */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">2</span>
                  DATOS PERSONALES Y PROFESIONALES RECABADOS
                </h4>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5">
                  <li><strong>Datos de Identificación:</strong> Nombre completo, fotografía oficial, CURP, RFC, fecha de nacimiento, firma autógrafa y digital.</li>
                  <li><strong>Datos de Contacto:</strong> Domicilio particular, teléfono móvil, correo electrónico y contacto de emergencia.</li>
                  <li><strong>Datos Académicos y de Acreditación:</strong> Título profesional, cédula profesional, certificados de estudio, constancias de cursos de soporte vital y especialidades de enfermería.</li>
                  <li><strong>Datos Laborales y Operativos:</strong> Número de socio/empleado, puesto, historial de asistencias, evaluaciones de desempeño, bitácoras de guardias y geolocalización al registrar entrada/salida.</li>
                  <li><strong>Datos Financieros:</strong> Cuenta bancaria / CLABE interbancaria exclusivamente para el pago y dispersión de honorarios o sueldos.</li>
                </ul>
              </div>

              {/* 3. FINALIDADES DEL TRATAMIENTO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">3</span>
                  FINALIDADES DEL TRATAMIENTO
                </h4>
                <p className="text-slate-600 text-xs font-semibold text-slate-900">Finalidades Primarias (Necesarias para la relación):</p>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  <li>Validación de identidad, perfil clínico y emisión de la credencial oficial institucional.</li>
                  <li>Asignación logística de guardias, servicios de enfermería y atención de urgencias.</li>
                  <li>Dispersión puntual de pagos y honorarios profesionales.</li>
                  <li>Monitoreo de calidad en la atención al paciente y cumplimiento de turnos.</li>
                  <li>Gestión de acceso a la plataforma digital y herramientas de registro clínico (Kárdex/Expediente).</li>
                </ul>
              </div>

              {/* 4. TRANSFERENCIAS DE DATOS Y VERIFICACIÓN OFICIAL */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">4</span>
                  TRANSFERENCIAS Y VERIFICACIÓN PÚBLICA DE CREDENCIAL
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Para otorgar certeza y seguridad a los pacientes y sus familias en los domicilios, Cuidarte Pachuca pone a disposición el portal público de verificación mediante código QR, donde se despliega únicamente: <em>Nombre completo, fotografía, grado/puesto, número de socio y estatus de vigencia institucional</em>. No se transfieren datos privados adicionales sin su consentimiento.
                </p>
              </div>

              {/* 5. DERECHOS ARCO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px] font-black font-mono">5</span>
                  EJERCICIO DE DERECHOS ARCO (ACCESO, RECTIFICACIÓN, CANCELACIÓN, OPOSICIÓN)
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Usted tiene derecho a conocer qué datos personales tenemos, para qué los utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de su información (Rectificación), su eliminación de nuestros registros (Cancelación) oponerse al uso de los mismos (Oposición).
                </p>
                <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-1 text-slate-800">
                  <p><strong>Medios de contacto oficiales para Derechos ARCO:</strong></p>
                  <p>📧 Correo: <a href="mailto:hola@cuidartemexico.com" className="text-sky-600 font-bold hover:underline">hola@cuidartemexico.com</a></p>
                  <p>📱 WhatsApp de Dirección: <span className="font-bold">7714540072</span></p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PERFIL: CLIENTES Y FAMILIARES (TÉRMINOS Y CONDICIONES) */}
          {/* ========================================================================= */}
          {applicableProfile === "cliente" && activeTab === "terminos" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-emerald-950">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-black block uppercase tracking-wider text-[11px] text-emerald-800">
                    TÉRMINOS Y CONDICIONES DE SERVICIO — CLIENTES Y RECEPTORES
                  </span>
                  <p>
                    Regula la contratación, provisión y seguimiento de servicios de cuidado y enfermería domiciliaria con Cuidarte Pachuca.
                  </p>
                </div>
              </div>

              {/* I. IDENTIDAD Y OBJETO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">I</span>
                  IDENTIDAD DEL PRESTADOR Y OBJETO CONTRACTUAL
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Cuidarte Pachuca provee servicios de gestión, coordinación y asignación de personal calificado de enfermería y cuidado integral domiciliario conforme a la Carátula de Servicio y requerimientos específicos del paciente.
                </p>
              </div>

              {/* II. ASIGNACIÓN DE PERSONAL Y CARÁTULA DE SERVICIO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">II</span>
                  ASIGNACIÓN DE PERSONAL Y CARÁTULA DE SERVICIO
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Todo servicio se formaliza mediante la emisión de una Carátula de Servicio foliada con código de verificación QR, detallando fechas, turnos (8h, 12h, 24h), personal asignado y honorarios convenidos. El cliente puede verificar en tiempo real la identidad y vigencia del personal en su domicilio.
                </p>
              </div>

              {/* III. PROTOCOLOS CLÍNICOS Y CONSENTIMIENTO INFORMADO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">III</span>
                  PROTOCOLOS CLÍNICOS Y MINISTRACIÓN DE MEDICAMENTOS
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  El personal de enfermería suministrará medicamentos exclusivamente bajo prescripción médica escrita expedida por el médico tratante del paciente. El cliente se compromete a proveer los insumos, materiales y medicamentos requeridos para la correcta atención.
                </p>
              </div>

              {/* IV. POLÍTICAS DE PAGO, ABONOS Y CANCELACIONES */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">IV</span>
                  POLÍTICAS DE PAGO, ABONOS Y CANCELACIÓN DE TURNOS
                </h4>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  <li>Los servicios se cubren conforme a los plazos pactados en la carátula mediante transferencia, abono en efectivo con ticket foliado o terminal bancaria.</li>
                  <li>Cancelaciones o modificaciones de guardia deben notificarse con un mínimo de 12 horas de anticipación a la Coordinación de Cuidarte Pachuca para evitar cargos por turno programado.</li>
                </ul>
              </div>

              {/* V. AMBIENTE SEGURO Y TRATO DIGNO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">V</span>
                  AMBIENTE SEGURO Y TRATO RESPETUOSO
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  El cliente y sus familiares se obligan a brindar un trato digno, respetuoso y libre de discriminación o violencia al personal asignado, así como instalaciones seguras para el adecuado desarrollo del servicio.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PERFIL: CLIENTES Y FAMILIARES (AVISO DE PRIVACIDAD INTEGRAL) */}
          {/* ========================================================================= */}
          {applicableProfile === "cliente" && activeTab === "privacidad" && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-emerald-950">
                <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-black block uppercase tracking-wider text-[11px] text-emerald-800">
                    AVISO DE PRIVACIDAD INTEGRAL PARA CLIENTES Y RECEPTORES
                  </span>
                  <p>
                    Protección reforzada de datos personales y datos sensibles de salud conforme a la legislación mexicana.
                  </p>
                </div>
              </div>

              {/* 1. DATOS SENSIBLES DE SALUD */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">1</span>
                  DATOS RECABADOS Y DATOS SENSIBLES DE SALUD
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Recabamos datos de identificación y contacto del contratante, así como <strong>Datos Sensibles de Salud del Paciente</strong>: diagnóstico clínico, padecimientos previos, alergias, signos vitales, prescripciones médicas, balance de líquidos y kárdex de medicación.
                </p>
              </div>

              {/* 2. FINALIDAD EXCLUSIVA */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">2</span>
                  FINALIDADES DEL TRATAMIENTO
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Sus datos sensibles son tratados con las más altas medidas de seguridad informática y física exclusivamente para:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  <li>Planificar, coordinar y proveer la atención clínica y de cuidados domiciliarios.</li>
                  <li>Supervisión médica y seguimiento de la evolución del paciente.</li>
                  <li>Facturación, emisión de recibos de pago y aclaraciones operativas.</li>
                </ul>
              </div>

              {/* 3. DERECHOS ARCO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">3</span>
                  DERECHOS ARCO Y ATENCIÓN A CLIENTES
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Puede ejercer sus derechos de Acceso, Rectificación, Cancelación u Oposición escribiendo a:
                </p>
                <div className="p-3 bg-slate-100 rounded-xl text-xs space-y-1 text-slate-800">
                  <p>📧 Correo: <a href="mailto:hola@cuidartemexico.com" className="text-emerald-600 font-bold hover:underline">hola@cuidartemexico.com</a></p>
                  <p>📱 WhatsApp de Atención: <span className="font-bold">7714540072</span></p>
                  <p>🌐 Sitio Web Oficial: <a href="https://www.cuidartemexico.com" target="_blank" rel="noreferrer" className="text-sky-600 underline">www.cuidartemexico.com</a></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 shrink-0">
          {requireAcceptance ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none bg-white p-3 rounded-xl border border-slate-300 shadow-xs flex-1">
                <input
                  type="checkbox"
                  id="modal-legal-acceptance-check"
                  checked={hasAgreed}
                  onChange={(e) => setHasAgreed(e.target.checked)}
                  className="w-4 h-4 text-sky-600 bg-white border-slate-300 rounded focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                />
                <span className="text-xs text-slate-800 font-bold leading-tight">
                  He leído, comprendo y acepto los Términos y Condiciones y el Aviso de Privacidad de Cuidarte Pachuca para mi cuenta.
                </span>
              </label>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!hasAgreed}
                  onClick={() => {
                    if (hasAgreed && onAccept) {
                      onAccept();
                    }
                  }}
                  className={`px-6 py-2.5 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 ${
                    hasAgreed
                      ? applicableProfile === "personal"
                        ? "bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-sky-600/30 cursor-pointer"
                        : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/30 cursor-pointer"
                      : "bg-slate-400 cursor-not-allowed opacity-60 shadow-none"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aceptar y Entrar al Sistema</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 hidden sm:block">
                Última actualización legal: <strong>Agosto 2026</strong> • Pachuca de Soto, Hgo.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-md"
              >
                Entendido y Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
