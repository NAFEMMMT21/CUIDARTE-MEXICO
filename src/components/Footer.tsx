import React, { useState } from "react";
import { Phone, Mail, Globe, AlertCircle, Heart, ShieldCheck, Lock, FileText } from "lucide-react";
import { TermsAndPrivacyModal, LegalUserType } from "./TermsAndPrivacyModal";

interface FooterProps {
  className?: string;
  userType?: LegalUserType;
}

export const Footer: React.FC<FooterProps> = ({ className = "", userType = "personal" }) => {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [initialLegalTab, setInitialLegalTab] = useState<"terminos" | "privacidad">("terminos");

  const openLegalModal = (tab: "terminos" | "privacidad") => {
    setInitialLegalTab(tab);
    setLegalModalOpen(true);
  };

  return (
    <>
      <footer className={`bg-slate-900 text-slate-400 border-t border-slate-800 text-xs print:hidden ${className}`}>
        {/* Contact Channels Bar (Arriba del pie de página) */}
        <div className="border-b border-slate-800/80 bg-slate-950/70 py-4 px-4">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center md:justify-between gap-4 text-xs">
            {/* Web & Slogan */}
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <a
                href="https://www.cuidartemexico.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white hover:underline font-semibold tracking-wide transition-colors"
              >
                www.cuidartemexico.com
              </a>
              <span className="hidden sm:inline text-slate-600">|</span>
              <span className="hidden sm:inline text-slate-400 text-[11px]">
                Cuidado integral, confianza total
              </span>
            </div>

            {/* Phone Numbers & Urgencias */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              <a
                href="tel:7714540072"
                className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-300 font-mono font-bold transition-colors bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>771 454 0072</span>
              </a>

              <a
                href="tel:7714540072"
                className="flex items-center gap-1.5 text-rose-300 hover:text-rose-200 font-mono font-black transition-colors bg-rose-950/40 px-3 py-1.5 rounded-xl border border-rose-800/60 shadow-xs"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                <span>URGENCIAS: 771 454 0072 EXT. 911</span>
              </a>

              <a
                href="mailto:hola@cuidartemexico.com"
                className="hidden lg:flex items-center gap-1.5 text-slate-300 hover:text-sky-300 transition-colors bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>hola@cuidartemexico.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Main Copyright & Credits Line */}
        <div className="py-4 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <p className="text-slate-400">
                © {new Date().getFullYear()} <strong className="text-slate-200">Cuidarte México</strong> - Todos los derechos reservados.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>•</span>
                <button
                  type="button"
                  onClick={() => openLegalModal("terminos")}
                  className="hover:text-sky-400 font-semibold transition cursor-pointer flex items-center gap-1"
                  title={`Ver Términos y Condiciones aplicables para ${userType === "cliente" ? "Clientes y Pacientes" : "Personal Clínico y Operativo"}`}
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>Términos y Condiciones</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({userType === "cliente" ? "Servicio al Paciente" : "Personal Clínico"})
                  </span>
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => openLegalModal("privacidad")}
                  className="hover:text-emerald-400 font-semibold transition cursor-pointer flex items-center gap-1"
                  title={`Ver Aviso de Privacidad aplicable para ${userType === "cliente" ? "Clientes y Pacientes" : "Personal y Colaboradores"}`}
                >
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aviso de Privacidad</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({userType === "cliente" ? "Clientes" : "Colaboradores"})
                  </span>
                </button>
              </div>
            </div>
            <p className="font-mono text-slate-500 flex items-center justify-center gap-1 text-[11px]">
              <span>SICCUM • Sistema de Control de Cuidarte México</span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1">
                Desarrollado con  <Heart className="w-3 h-3 text-rose-500 inline fill-rose-500" /> por{" "}
                <a
                  href="https://enigmacreativo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-sky-400 font-semibold hover:underline transition-colors"
                >
                  Enigma Creativo
                </a>
              </span>
            </p>
          </div>
        </div>
      </footer>

      {/* Modal de Términos y Privacidad */}
      <TermsAndPrivacyModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={initialLegalTab}
        userType={userType}
      />
    </>
  );
};

