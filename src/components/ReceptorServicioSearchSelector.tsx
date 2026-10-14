import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, User, FileText, Check, ChevronDown, X, Phone, UserCheck } from "lucide-react";
import { Client, Caratula } from "../types";
import { deduplicateClients } from "../utils/dataIntegrity";

export interface ReceptorServicioSearchSelectorProps {
  clients: Client[];
  caratulas?: Caratula[];
  selectedClientId?: string;
  onSelectClient: (clientId: string) => void;
  label?: string;
  placeholder?: string;
  variant?: "header" | "card" | "compact" | "dark";
  className?: string;
  showAllOption?: boolean;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
}

export const ReceptorServicioSearchSelector: React.FC<ReceptorServicioSearchSelectorProps> = ({
  clients = [],
  caratulas = [],
  selectedClientId,
  onSelectClient,
  label = "Receptor de Servicio Activo",
  placeholder = "Buscar por Receptor de Servicio, Orden de Servicio o Responsable...",
  variant = "header",
  className = "",
  showAllOption = false,
  onSelectAll,
  isAllSelected = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find currently selected client & caratula
  const currentClient = useMemo(() => {
    return clients.find(
      (c) => c.id && selectedClientId && (c.id || "").toUpperCase() === (selectedClientId || "").toUpperCase()
    );
  }, [clients, selectedClientId]);

  const currentCaratula = useMemo(() => {
    return (caratulas || []).find(
      (cr) => cr.id && selectedClientId && (cr.id || "").toUpperCase() === (selectedClientId || "").toUpperCase()
    );
  }, [caratulas, selectedClientId]);

  const uniqueClients = useMemo(() => deduplicateClients(clients), [clients]);

  // Filter clients by:
  // 1. Nombre de Receptor de Servicio (RS)
  // 2. Orden de Servicio / Folio / ID
  // 3. Nombre de Responsable del Servicio (Cliente / Familiar / Contratante)
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return uniqueClients;
    const term = searchTerm.toLowerCase().trim();

    return uniqueClients.filter((c) => {
      const nombreRS = (c.nombreCompletoRS || "").toLowerCase();
      const nombreResponsable = (c.nombreCompletoCliente || "").toLowerCase();
      const idCli = (c.id || "").toLowerCase();
      const diag = (c.diagnostico || "").toLowerCase();
      const tel = (c.numeroContacto || "").toLowerCase();

      // Look up corresponding carátula for folio / orden de servicio
      const car = (caratulas || []).find(
        (cr) => cr.id && c.id && (cr.id || "").toUpperCase() === (c.id || "").toUpperCase()
      );
      const folio = (car?.folio || "").toLowerCase();
      const ordenServicio = (car?.id || "").toLowerCase();

      return (
        nombreRS.includes(term) ||
        nombreResponsable.includes(term) ||
        idCli.includes(term) ||
        folio.includes(term) ||
        ordenServicio.includes(term) ||
        diag.includes(term) ||
        tel.includes(term)
      );
    });
  }, [uniqueClients, caratulas, searchTerm]);

  const handleSelect = (clientId: string) => {
    onSelectClient(clientId);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const activeRSName = currentClient?.nombreCompletoRS || currentClient?.nombreCompletoCliente || (isAllSelected ? "Todos los Receptores" : "Seleccionar Receptor");
  const activeResponsable = currentClient?.nombreCompletoCliente || "";
  const activeFolio = currentCaratula?.folio || currentClient?.id || "";

  // Styles based on variant
  if (variant === "header") {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
          className="flex items-center gap-2 bg-slate-800/95 hover:bg-slate-800 border border-slate-700/90 text-white rounded-xl px-2.5 py-1.5 shadow-inner transition max-w-[280px] sm:max-w-[340px] md:max-w-[380px] text-left group"
          title="Buscar y seleccionar Receptor de Servicio, Orden de Servicio o Responsable"
        >
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-[10px] text-sky-400 font-bold uppercase tracking-wider">
              <span>Receptor de Servicio</span>
              {activeFolio && (
                <span className="text-slate-400 font-mono text-[9px] bg-slate-900 px-1 py-0.2 rounded">
                  {activeFolio}
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-slate-100 truncate">
              {activeRSName}
            </p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-sky-400" : ""}`} />
        </button>

        {/* Dropdown Popup */}
        {isOpen && (
          <div className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
            {/* Search Header */}
            <div className="p-3 bg-slate-800/90 border-b border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  Búsqueda de Receptor de Servicio
                </span>
                <span className="text-[10px] text-slate-400">
                  {filteredClients.length} encontrados
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Escriba nombre de <strong>Receptor de Servicio</strong>, <strong>Orden de Servicio / Folio</strong> o <strong>Responsable</strong>.
              </p>
            </div>

            {/* List of Receptores */}
            <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-800/40">
              {showAllOption && onSelectAll && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectAll();
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between ${
                    isAllSelected ? "bg-sky-600/30 border border-sky-500/50 text-white" : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <div>
                      <p className="font-bold text-xs">Todos los Receptores de Servicio</p>
                      <p className="text-[10px] text-slate-400">Ver vista global sin filtro</p>
                    </div>
                  </div>
                  {isAllSelected && <Check className="w-4 h-4 text-sky-400" />}
                </button>
              )}

              {filteredClients.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-1">
                  <p className="text-xs font-semibold">No se encontraron Receptores de Servicio</p>
                  <p className="text-[11px] text-slate-500">Intente con otro nombre, orden de servicio o responsable</p>
                </div>
              ) : (
                filteredClients.map((cli, idx) => {
                  const isSelected = !isAllSelected && cli.id && selectedClientId && (cli.id || "").toUpperCase() === (selectedClientId || "").toUpperCase();
                  const car = (caratulas || []).find(
                    (cr) => cr.id && cli.id && (cr.id || "").toUpperCase() === (cli.id || "").toUpperCase()
                  );
                  const rsName = cli.nombreCompletoRS || "Sin nombre de RS";
                  const respName = cli.nombreCompletoCliente || "Sin responsable registrado";
                  const folio = car?.folio || cli.id;

                  return (
                    <button
                      key={`rs-hdr-${cli.id || idx}-${idx}`}
                      type="button"
                      onClick={() => handleSelect(cli.id)}
                      className={`w-full text-left p-2.5 rounded-xl transition flex items-start justify-between gap-2 ${
                        isSelected
                          ? "bg-sky-950/80 border border-sky-500/60 text-white shadow-sm"
                          : "hover:bg-slate-800/80 text-slate-300 border border-transparent"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {/* Receptor de Servicio Header */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">
                            {folio}
                          </span>
                          <span className="font-extrabold text-xs text-white">
                            {rsName}
                          </span>
                        </div>

                        {/* Responsable de Servicio Subtitle */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-300 font-medium">
                          <span className="text-slate-400 text-[10px]">Responsable:</span>
                          <span className="text-sky-200 font-semibold">{respName}</span>
                        </div>

                        {/* Extra info: Diagnóstico o Teléfono */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                          {cli.diagnostico && (
                            <span className="truncate max-w-[200px]">🩺 {cli.diagnostico}</span>
                          )}
                          {cli.numeroContacto && (
                            <span className="font-mono text-slate-400">📞 {cli.numeroContacto}</span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 mt-1">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Card / Manager Banner Variant (Used inside Expediente, Kardex, Inventario, etc.)
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sky-400">
            <User className="w-3.5 h-3.5" />
            {label}
          </span>
          {currentClient && (
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {currentClient.id}
            </span>
          )}
        </label>
      )}

      {/* Selector Trigger Input-Like Button */}
      <div
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className="w-full bg-slate-900/90 hover:bg-slate-900 border border-slate-700/90 rounded-xl p-2.5 cursor-pointer shadow-inner transition flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-600/30 border border-sky-500/40 text-sky-300 flex items-center justify-center shrink-0 font-black text-xs">
            RS
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-extrabold text-xs sm:text-sm text-white truncate">
                {activeRSName}
              </p>
              {activeFolio && (
                <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.2 rounded border border-sky-500/30">
                  {activeFolio}
                </span>
              )}
            </div>
            {activeResponsable && (
              <p className="text-[11px] text-slate-400 truncate">
                Responsable del Servicio: <strong className="text-slate-200">{activeResponsable}</strong>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:inline text-[10px] font-bold text-sky-400 bg-sky-950 px-2 py-1 rounded-lg border border-sky-800/60">
            Buscar / Cambiar
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-sky-400" : ""}`} />
        </div>
      </div>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Search Header */}
          <div className="p-3.5 bg-slate-800 border-b border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                Buscar Receptor de Servicio
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredClients.length} disponibles
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-9 pr-8 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Puede buscar por <strong>Nombre del Receptor</strong>, <strong>Orden de Servicio / Folio</strong> o <strong>Nombre del Responsable</strong>.
            </p>
          </div>

          {/* List of Receptores */}
          <div className="max-h-[320px] overflow-y-auto p-2 space-y-1.5 divide-y divide-slate-800">
            {showAllOption && onSelectAll && (
              <button
                type="button"
                onClick={() => {
                  onSelectAll();
                  setIsOpen(false);
                }}
                className={`w-full text-left p-3 rounded-xl transition flex items-center justify-between ${
                  isAllSelected ? "bg-sky-600/30 border border-sky-500/50 text-white" : "hover:bg-slate-800 text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  <div>
                    <p className="font-bold text-xs">Todos los Receptores de Servicio</p>
                    <p className="text-[10px] text-slate-400">Mostrar información general sin filtrar por receptor</p>
                  </div>
                </div>
                {isAllSelected && <Check className="w-4 h-4 text-sky-400" />}
              </button>
            )}

            {filteredClients.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <p className="text-xs font-semibold">No se encontraron Receptores de Servicio</p>
                <p className="text-[11px] text-slate-500">Verifique el nombre del receptor, orden de servicio o responsable</p>
              </div>
            ) : (
              filteredClients.map((cli, idx) => {
                const isSelected = !isAllSelected && cli.id && selectedClientId && (cli.id || "").toUpperCase() === (selectedClientId || "").toUpperCase();
                const car = (caratulas || []).find(
                  (cr) => cr.id && cli.id && (cr.id || "").toUpperCase() === (cli.id || "").toUpperCase()
                );
                const rsName = cli.nombreCompletoRS || "Sin nombre de RS";
                const respName = cli.nombreCompletoCliente || "Sin responsable registrado";
                const folio = car?.folio || cli.id;

                return (
                  <button
                    key={`rs-full-${cli.id || idx}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(cli.id)}
                    className={`w-full text-left p-3 rounded-xl transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-sky-950/80 border border-sky-500/60 text-white shadow-sm"
                        : "hover:bg-slate-800 text-slate-300 border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-black bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-500/30">
                          {folio}
                        </span>
                        <span className="font-extrabold text-xs sm:text-sm text-white">
                          {rsName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-300">
                        <span className="text-slate-400 text-[11px]">Responsable del Servicio:</span>
                        <span className="text-sky-200 font-semibold">{respName}</span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5 flex-wrap">
                        {cli.diagnostico && (
                          <span className="truncate max-w-[260px]">🩺 Diagnóstico: {cli.diagnostico}</span>
                        )}
                        {cli.numeroContacto && (
                          <span className="font-mono text-slate-400">📞 {cli.numeroContacto}</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
