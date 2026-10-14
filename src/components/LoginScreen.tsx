import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogIn,
  FileText,
  Shield,
  Stethoscope,
  HeartHandshake
} from "lucide-react";
import { CuidarteLogo } from "./CuidarteLogo";
import { validateCredentials, saveUserSession, UserSession } from "../services/auth";
import { logAuditEvent } from "../services/auditService";
import { TermsAndPrivacyModal, LegalUserType } from "./TermsAndPrivacyModal";

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [ux, setUx] = useState("");
  const [cx, setCx] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidatingAuto, setIsValidatingAuto] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Automatic credential verification states
  const [verifiedCandidate, setVerifiedCandidate] = useState<UserSession | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Modal inspection states (ONLY opened when user explicitly clicks on terms/privacy links)
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terminos" | "privacidad">("terminos");

  const validationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isCredentialsFilled = ux.trim().length > 0 && cx.trim().length > 0;
  const isCredentialsFormatValid = ux.trim().length >= 2 && cx.trim().length >= 3;

  // Real-time automatic background validation
  useEffect(() => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }

    // If input is cleared or too short, reset verified status immediately
    if (!isCredentialsFormatValid) {
      setVerifiedCandidate(null);
      setHasAcceptedTerms(false);
      setIsValidatingAuto(false);
      return;
    }

    setIsValidatingAuto(true);

    validationTimerRef.current = setTimeout(async () => {
      try {
        const result = await validateCredentials(ux.trim(), cx.trim());
        if (result.success && result.user) {
          setVerifiedCandidate(result.user);
          setErrorMsg(null);
        } else {
          setVerifiedCandidate(null);
          setHasAcceptedTerms(false);
        }
      } catch (err) {
        console.error("Auto validation error:", err);
        setVerifiedCandidate(null);
        setHasAcceptedTerms(false);
      } finally {
        setIsValidatingAuto(false);
      }
    }, 280);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [ux, cx, isCredentialsFormatValid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isCredentialsFilled) {
      setErrorMsg("Por favor ingresa tu usuario y contraseña.");
      return;
    }

    // If already verified and terms accepted, log in directly
    if (verifiedCandidate && hasAcceptedTerms) {
      const session = saveUserSession(verifiedCandidate);
      logAuditEvent({
        tipoAccion: "LOGIN_EXITOSO",
        descripcion: `Inicio de sesión exitoso: ${session.username} (${session.nombre || session.role})`,
        usuarioUx: session.username,
        usuarioNombre: session.nombre || session.username,
        rol: session.role,
        detalles: { role: session.role, ux: session.username },
      }).catch((e) => console.warn("[Audit] Login log error:", e));
      onLoginSuccess(session);
      return;
    }

    // If credentials are valid but terms not yet accepted
    if (verifiedCandidate && !hasAcceptedTerms) {
      setErrorMsg("Por favor marca la casilla de aceptación de Términos y Condiciones para continuar.");
      return;
    }

    // Otherwise, perform manual submit verification
    setLoading(true);
    try {
      const result = await validateCredentials(ux.trim(), cx.trim());
      if (result.success && result.user) {
        setVerifiedCandidate(result.user);
        setErrorMsg("Credenciales válidas. Por favor acepta los Términos y Condiciones para ingresar.");
      } else {
        logAuditEvent({
          tipoAccion: "LOGIN_FALLIDO",
          descripcion: `Intento de acceso fallido para el usuario: ${ux.trim()}`,
          usuarioUx: ux.trim(),
          usuarioNombre: "Desconocido",
          rol: "admin",
          detalles: { ux: ux.trim(), motivo: result.message || "Credenciales inválidas" },
        }).catch((e) => console.warn("[Audit] Login fail log error:", e));
        setErrorMsg(result.message || "Usuario o contraseña incorrectos. Verifica tus credenciales.");
        setVerifiedCandidate(null);
        setHasAcceptedTerms(false);
      }
    } catch (err) {
      setErrorMsg("Ocurrió un error al verificar el acceso. Intenta de nuevo.");
      console.error(err);
      setVerifiedCandidate(null);
      setHasAcceptedTerms(false);
    } finally {
      setLoading(false);
    }
  };

  const openLegalModal = (tab: "terminos" | "privacidad") => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  const handleModalAccept = () => {
    setHasAcceptedTerms(true);
    setIsLegalModalOpen(false);
  };

  // Determine legal user type from the verified account's actual role
  const legalUserType: LegalUserType =
    verifiedCandidate?.role === "client" ? "cliente" : "personal";

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Subtle Background Glow Accent */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative z-10 my-auto">
        {/* Top Decorative Banner */}
        <div className="bg-slate-900 px-6 py-7 text-center border-b border-slate-800 flex flex-col items-center">
          <div className="bg-white px-4 py-2 rounded-xl shadow-md border border-slate-200 mb-3">
            <CuidarteLogo
              size="md"
              showTagline={false}
              variant="header"
              sucursalNombre="Cuidarte México"
              isMultiSucursal={true}
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sistema de Control de Cuidarte México</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Iniciar Sesión</h1>
          <p className="text-xs text-slate-400 mt-1">
            Ingresa tu usuario y contraseña para acceder
          </p>
        </div>

        {/* Login Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Usuario</span>
              {isValidatingAuto && (
                <span className="text-[10px] text-sky-600 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando...
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={ux}
                onChange={(e) => {
                  setUx(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ingresa tu usuario"
                autoCapitalize="none"
                autoCorrect="off"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all font-medium ${
                  verifiedCandidate
                    ? "border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20"
                    : "border-slate-300 focus:ring-sky-500"
                }`}
              />
              {verifiedCandidate && (
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={cx}
                onChange={(e) => {
                  setCx(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all font-medium ${
                  verifiedCandidate
                    ? "border-emerald-400 focus:ring-emerald-500 bg-emerald-50/20"
                    : "border-slate-300 focus:ring-sky-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* CHECKBOX DE TÉRMINOS Y CONDICIONES:
              SE MANTIENE OCULTO INICIALMENTE Y SÓLO SE DESBLOQUEA/MUESTRA CUANDO LAS CREDENCIALES SON VÁLIDAS */}
          {verifiedCandidate && (
            <div className="p-3.5 rounded-xl bg-sky-50/90 border border-sky-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Casilla de aceptación no invasiva */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="accept-terms-live-checkbox"
                  checked={hasAcceptedTerms}
                  onChange={(e) => {
                    setHasAcceptedTerms(e.target.checked);
                    if (e.target.checked && errorMsg) setErrorMsg(null);
                  }}
                  className="w-4 h-4 mt-0.5 text-sky-600 bg-white border-slate-300 rounded focus:ring-sky-500 focus:ring-2 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-800 leading-snug">
                  He leído y acepto los{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openLegalModal("terminos");
                    }}
                    className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer"
                  >
                    Términos y Condiciones
                  </button>{" "}
                  y el{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openLegalModal("privacidad");
                    }}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                  >
                    Aviso de Privacidad
                  </button>{" "}
                  de Cuidarte México.
                </span>
              </label>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !verifiedCandidate || !hasAcceptedTerms}
            className={`w-full py-3 px-4 text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all mt-3 ${
              verifiedCandidate && hasAcceptedTerms
                ? "bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-sky-600/30 cursor-pointer"
                : "bg-slate-300 text-slate-500 hover:bg-slate-300 cursor-not-allowed opacity-75 shadow-none"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ingresando al sistema...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Ingresar al Sistema</span>
              </>
            )}
          </button>

          {/* Security Note */}
          <div className="pt-3 text-center text-[10px] text-slate-400 leading-relaxed border-t border-slate-100">
            Cuidarte México • Cuidado integral, confianza total
            <br />
            Acceso seguro | Desarrollado con ♥ by{" "}
            <a
              href="https://enigmacreativo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-sky-600 font-bold hover:underline transition-colors"
            >
              Enigma Creativo
            </a>.
          </div>
        </form>
      </div>

      {/* Modal de Términos y Condiciones & Aviso de Privacidad
          SÓLO se abre cuando el usuario hace clic expresamente en los enlaces "Términos y Condiciones" o "Aviso de Privacidad" */}
      {isLegalModalOpen && (
        <TermsAndPrivacyModal
          isOpen={isLegalModalOpen}
          onClose={() => setIsLegalModalOpen(false)}
          initialTab={legalModalTab}
          userType={legalUserType}
          verifiedUser={verifiedCandidate}
          requireAcceptance={true}
          onAccept={handleModalAccept}
        />
      )}
    </div>
  );
};

