import React from "react";

interface BackgroundProps {
  className?: string;
  variant?: "front" | "back";
}

/**
 * Subtle dot grid background for Cuidarte credentials featuring security dots
 * in Cuidarte brand colors (#2b78c5 Blue & #6ca047 Green).
 */
export const CredentialGeometricBackground: React.FC<BackgroundProps> = ({
  className = "absolute inset-0 pointer-events-none z-0 overflow-hidden",
  variant = "front",
}) => {
  return (
    <div className={className}>
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 336 528"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={`dotGrid-${variant}`}
            x="0"
            y="0"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.1" fill="#2b78c5" opacity="0.18" />
            <circle cx="9" cy="9" r="1.1" fill="#6ca047" opacity="0.18" />
          </pattern>
        </defs>

        {/* Security Dot Grid Only */}
        <rect x="0" y="0" width="336" height="528" fill={`url(#dotGrid-${variant})`} />
      </svg>
    </div>
  );
};
