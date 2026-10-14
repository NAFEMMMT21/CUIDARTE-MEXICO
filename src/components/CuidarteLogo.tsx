import React, { useState } from "react";
import officialDocumentLogo from "../assets/images/cuidarte_emblem.png";
import headerLogo from "../assets/images/cuidarte_emblem.png";
import { CUIDARTE_LOGO_PREPROCESSED_BASE64 } from "../assets/logoBase64";
import { loadSucursales } from "../utils/storage";

export interface CuidarteLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean; // Controls whether "CUIDADO INTEGRAL, CONFIANZA TOTAL" is shown
  showDescriptor?: boolean; // Controls whether "Soluciones de asistencia y gestión para el bienestar familiar" is shown
  src?: string;
  variant?: "header" | "document" | "flat" | "white";
  imgStyle?: React.CSSProperties;
  imgClassName?: string;
  sucursalId?: string;
  sucursalNombre?: string;
  isMultiSucursal?: boolean;
  subtitle?: string; // Optional custom descriptor
  slogan?: string; // Optional custom slogan
}

export const OFFICIAL_LOGO_URL = officialDocumentLogo;
export const HEADER_LOGO_URL = headerLogo;

/**
 * Transforms string to Title Case (First letter capitalized, rest lowercase for each word)
 * e.g. "PACHUCA" -> "Pachuca", "CUIDARTE PACHUCA" -> "Pachuca", "CDMX" -> "CDMX"
 */
export const toTitleCaseWord = (str?: string): string => {
  if (!str) return "México";
  let clean = str.trim();
  if (/^cuidarte\s+/i.test(clean)) {
    clean = clean.replace(/^cuidarte\s+/i, "").trim();
  }
  const upper = clean.toUpperCase();
  if (
    upper === "ALL" ||
    upper === "TODAS" ||
    upper === "GENERAL" ||
    upper === "CORPORATIVO" ||
    upper === "NACIONAL"
  ) {
    return "México";
  }
  if (upper === "CDMX") return "CDMX";
  if (upper === "GDL") return "GDL";
  if (upper === "MTY") return "MTY";
  if (upper === "QRO") return "QRO";

  return clean
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Legacy backwards compatibility
 */
export const resolveDocumentBranchLine = (
  sucursalNombre?: string,
  isMultiSucursal?: boolean
): string => {
  if (isMultiSucursal) return "México";
  return toTitleCaseWord(sucursalNombre);
};

export const CuidarteLogo: React.FC<CuidarteLogoProps> = ({
  className = "",
  size = "md",
  src,
  variant,
  imgStyle,
  imgClassName = "",
  showTagline = true,
  showDescriptor,
  sucursalId,
  sucursalNombre,
  isMultiSucursal = false,
  subtitle,
  slogan = "CUIDADO INTEGRAL, CONFIANZA TOTAL",
}) => {
  const [hasError, setHasError] = useState(false);
  const cuidarteRef = React.useRef<HTMLSpanElement>(null);

  // Default calibrated widths of the word "Cuidarte" (Open Sans 800) per size
  const defaultCuidarteWidths = {
    sm: 65,
    md: 88,
    lg: 125,
    xl: 165,
  };

  const [cuidarteWidth, setCuidarteWidth] = React.useState<number>(defaultCuidarteWidths[size]);

  // Resolve branch name and potential custom logo configured for this branch
  let resolvedSucursalNombre = sucursalNombre;
  let branchCustomLogo: string | undefined = undefined;

  try {
    const branches = loadSucursales();
    // 1. Try finding branch by sucursalId
    let matched = sucursalId && sucursalId !== "all"
      ? branches.find((b) => b.id === sucursalId)
      : undefined;

    // 2. If not matched by id, try matching by name or city
    if (!matched && sucursalNombre) {
      const cleanTarget = sucursalNombre.trim().toLowerCase().replace(/^cuidarte\s+/i, "");
      matched = branches.find((b) => {
        const cleanB = b.nombre.trim().toLowerCase().replace(/^cuidarte\s+/i, "");
        const cleanCity = b.ciudad?.trim().toLowerCase();
        return cleanB === cleanTarget || cleanCity === cleanTarget || b.id === cleanTarget;
      });
    }

    if (matched) {
      resolvedSucursalNombre = matched.nombre;
      if (matched.logoUrl) {
        branchCustomLogo = matched.logoUrl;
      }
    }
  } catch {}

  const isMexicoGeneral =
    isMultiSucursal ||
    sucursalId === "all" ||
    resolvedSucursalNombre?.trim().toLowerCase() === "cuidarte méxico" ||
    resolvedSucursalNombre?.trim().toLowerCase() === "cuidarte mexico" ||
    resolvedSucursalNombre?.trim().toLowerCase() === "méxico" ||
    resolvedSucursalNombre?.trim().toLowerCase() === "mexico";

  const branchTitle = isMexicoGeneral ? "México" : toTitleCaseWord(resolvedSucursalNombre);

  // Dynamically measure line 1 width to ensure line 2 matches it edge-to-edge
  React.useLayoutEffect(() => {
    if (cuidarteRef.current) {
      const rect = cuidarteRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setCuidarteWidth(rect.width);
      }
    }
  }, [size, branchTitle]);

  const imgHeights = {
    sm: "h-8 sm:h-9",
    md: "h-11 sm:h-12",
    lg: "h-16 sm:h-20",
    xl: "h-24 sm:h-28",
  };

  const line1FontSizes = {
    sm: "text-sm sm:text-base",
    md: "text-lg sm:text-xl",
    lg: "text-2xl sm:text-3xl",
    xl: "text-3xl sm:text-4xl",
  };

  const line2FontSizes = {
    sm: "text-xs sm:text-sm",
    md: "text-base sm:text-lg",
    lg: "text-xl sm:text-2xl",
    xl: "text-2xl sm:text-3xl",
  };

  const sloganFontSizes = {
    sm: "text-[8.5px] sm:text-[9.5px]",
    md: "text-[10px] sm:text-[11px]",
    lg: "text-xs sm:text-sm",
    xl: "text-sm sm:text-base",
  };

  const descriptorFontSizes = {
    sm: "text-[7.5px] sm:text-[8.5px]",
    md: "text-[9px] sm:text-[10px]",
    lg: "text-[10.5px] sm:text-xs",
    xl: "text-xs sm:text-sm",
  };

  const textColor = variant === "white" ? "#ffffff" : "#12476e";
  const sloganColor = variant === "white" ? "#e0f2fe" : "#12476e";
  const descriptorColor = variant === "white" ? "#cbd5e1" : "#475569";

  const defaultAsset = variant === "header" ? headerLogo : officialDocumentLogo;

  const logoSrc = hasError
    ? CUIDARTE_LOGO_PREPROCESSED_BASE64
    : src || branchCustomLogo || defaultAsset;

  const shouldShowDescriptor =
    showDescriptor !== undefined
      ? showDescriptor
      : variant === "document" && showTagline;

  const branchChars = branchTitle.split("");

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      {/* Upper Row: Official Logo + 2-line Text (Cuidarte / [Sucursal]) */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <img
          src={logoSrc}
          alt={`Cuidarte ${branchTitle}`}
          className={`${imgHeights[size]} w-auto object-contain shrink-0 ${imgClassName}`}
          style={imgStyle}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onError={() => setHasError(true)}
        />
        <div
          className="flex flex-col justify-center text-left leading-none m-0 p-0"
          style={{
            fontFamily: "'Open Sans', Arial, sans-serif",
            gap: 0,
            lineHeight: 0.95,
          }}
        >
          {/* Line 1: Word "Cuidarte" (Base width reference) */}
          <span
            ref={cuidarteRef}
            className={`font-extrabold tracking-tight ${line1FontSizes[size]} m-0 p-0 leading-none select-none`}
            style={{
              color: textColor,
              fontFamily: "'Open Sans', Arial, sans-serif",
              fontWeight: 800,
              lineHeight: 0.95,
              display: "block",
              margin: 0,
              padding: 0,
            }}
          >
            Cuidarte
          </span>

          {/* Line 2: Sucursal Name with width strictly matching the width of "Cuidarte" */}
          <div
            className="flex items-center justify-between m-0 p-0 leading-none select-none"
            style={{
              width: cuidarteWidth ? `${cuidarteWidth}px` : "100%",
              maxWidth: cuidarteWidth ? `${cuidarteWidth}px` : "100%",
              minWidth: cuidarteWidth ? `${cuidarteWidth}px` : undefined,
              color: textColor,
              fontFamily: "'Open Sans', Arial, sans-serif",
              fontWeight: 800,
              lineHeight: 0.95,
              marginTop: 0,
              padding: 0,
            }}
            aria-label={branchTitle}
          >
            {branchChars.length > 1 ? (
              branchChars.map((char, idx) => (
                <span
                  key={idx}
                  className={`font-extrabold tracking-tight ${line2FontSizes[size]} m-0 p-0 leading-none`}
                  style={{
                    display: "inline-block",
                    lineHeight: 0.95,
                    color: textColor,
                    fontFamily: "'Open Sans', Arial, sans-serif",
                    fontWeight: 800,
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))
            ) : (
              <span
                className={`font-extrabold tracking-tight ${line2FontSizes[size]} m-0 p-0 leading-none w-full text-center`}
                style={{
                  color: textColor,
                  fontFamily: "'Open Sans', Arial, sans-serif",
                  fontWeight: 800,
                  lineHeight: 0.95,
                }}
              >
                {branchTitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Centered Slogan directly below the logo and the letters (en MAYÚSCULAS) */}
      {showTagline && (
        <div
          className={`w-full text-center font-extrabold tracking-wide mt-1 uppercase ${sloganFontSizes[size]}`}
          style={{
            fontFamily: "'Open Sans', Arial, sans-serif",
            color: sloganColor,
            fontWeight: 800,
          }}
        >
          {(slogan || "CUIDADO INTEGRAL, CONFIANZA TOTAL").toUpperCase()}
        </div>
      )}

      {/* Institutional Descriptor */}
      {shouldShowDescriptor && (
        <div
          className={`w-full text-center font-semibold tracking-normal mt-0.5 ${descriptorFontSizes[size]}`}
          style={{
            fontFamily: "'Open Sans', Arial, sans-serif",
            color: descriptorColor,
          }}
        >
          {subtitle || "Soluciones de asistencia y gestión para el bienestar familiar"}
        </div>
      )}
    </div>
  );
};
