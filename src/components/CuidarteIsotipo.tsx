import React from "react";

interface CuidarteIsotipoProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pure SVG Isotipo of Cuidarte Pachuca (Two embracing figures - Blue & Green)
 * Contains strictly NO text or letters, ideal for background watermarks.
 */
export const CuidarteIsotipo: React.FC<CuidarteIsotipoProps> = ({
  className = "w-64 h-64",
  style,
}) => {
  return (
    <svg
      viewBox="0 0 500 500"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      {/* Blue Head Circle */}
      <circle cx="172" cy="104" r="60" fill="#2b78c5" />

      {/* Green Head Circle */}
      <circle cx="355" cy="165" r="50" fill="#6ca047" />

      {/* Blue Body / Left Figure */}
      <path
        d="M 172 178 
           C 95 225 70 320 145 412 
           C 195 472 250 495 250 495 
           C 250 495 242 425 185 345 
           C 162 312 168 280 215 268 
           C 265 255 312 254 312 254 
           C 230 198 188 183 172 178 Z"
        fill="#2b78c5"
      />

      {/* Green Body / Right Figure */}
      <path
        d="M 355 225 
           C 398 262 425 330 380 410 
           C 338 480 265 495 265 495 
           C 265 495 322 438 335 358 
           C 344 308 318 288 268 288 
           C 215 288 187 302 187 302 
           C 252 338 310 328 355 225 Z"
        fill="#6ca047"
      />
    </svg>
  );
};
