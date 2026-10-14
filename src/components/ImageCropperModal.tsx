import React, { useState, useRef, useEffect } from "react";
import { useLockBodyScroll } from "../utils/useLockBodyScroll";
import { ZoomIn, ZoomOut, RotateCw, Move, Check, X, Upload, Camera, RefreshCw } from "lucide-react";

interface ImageCropperModalProps {
  initialImage?: string;
  onCropComplete: (croppedBase64: string) => void;
  onClose: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  initialImage,
  onCropComplete,
  onClose,
}) => {
  useLockBodyScroll(true);

  const [imageSrc, setImageSrc] = useState<string>(initialImage || "");
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert("La imagen excede 8MB. Por favor elija un archivo más pequeño.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      if (result) {
        setImageSrc(result);
        // Reset transform states
        setZoom(1);
        setPanX(0);
        setPanY(0);
        setRotation(0);
      }
    };
    reader.readAsDataURL(file);
  };

  // Dragging handlers for mouse / touch
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!imageSrc || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - panX,
      y: e.touches[0].clientY - panY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStart.x);
    setPanY(e.touches[0].clientY - dragStart.y);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Render crop to output Base64 (Target 300x400)
  const handleSaveCrop = () => {
    if (!imageSrc) {
      alert("Por favor seleccione una imagen antes de guardar.");
      return;
    }

    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      const targetWidth = 300;
      const targetHeight = 400;

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Fill background white
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();

      // Translate to canvas center
      ctx.translate(targetWidth / 2, targetHeight / 2);

      // Apply Pan (scale appropriately for canvas vs preview ratio)
      // Preview container is 210x280 (ratio 1.43 to 300x400)
      const scaleFactor = targetWidth / 210;
      ctx.translate(panX * scaleFactor, panY * scaleFactor);

      // Apply Rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale (Zoom & Aspect Fit)
      const baseScale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const totalScale = baseScale * zoom;

      ctx.scale(totalScale, totalScale);

      // Draw image centered
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      ctx.restore();

      // Compress to high-quality JPEG
      const base64Result = canvas.toDataURL("image/jpeg", 0.9);
      onCropComplete(base64Result);
    };

    img.onerror = () => {
      alert("No se pudo cargar la imagen seleccionada. Intente con otro archivo.");
    };
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <Camera className="w-5 h-5" />
            <span>Ajustar y Recortar Foto de Credencial (3:4)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* File Upload Selector */}
          <div className="flex items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="font-bold text-slate-300 truncate">
              {imageSrc ? "Imagen cargada. Ajuste posición y zoom:" : "Seleccione foto de su dispositivo:"}
            </span>
            <label className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition shrink-0 flex items-center gap-1.5 text-xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Cargar Foto</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Interactive Crop Stage */}
          <div className="flex flex-col items-center justify-center bg-slate-950 p-4 rounded-2xl border border-slate-800 relative">
            {imageSrc ? (
              <div
                className="w-[210px] h-[280px] bg-slate-900 border-2 border-sky-400 rounded-2xl overflow-hidden relative shadow-inner cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Image element transformed dynamically */}
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Ajuste"
                  className="absolute pointer-events-none transition-transform duration-75 max-w-none"
                  style={{
                    top: "50%",
                    left: "50%",
                    transform: `translate(-50%, -50%) translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${zoom})`,
                    transformOrigin: "center center",
                    maxHeight: "none",
                    maxWidth: "none",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                {/* Grid Overlay Guide */}
                <div className="absolute inset-0 border border-white/30 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-white/20" />
                  <div className="border-r border-white/20" />
                  <div />
                </div>

                {/* Helper overlay instruction */}
                <div className="absolute bottom-1 inset-x-0 text-center">
                  <span className="bg-slate-950/80 text-sky-300 text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                    Arrastre para centrar
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-[210px] h-[280px] bg-slate-900 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                <Camera className="w-10 h-10 text-slate-600" />
                <p className="text-xs font-bold text-slate-400">Sin Fotografía</p>
                <p className="text-[10px] text-slate-500">
                  Haga clic en "Cargar Foto" para seleccionar una imagen desde su dispositivo.
                </p>
              </div>
            )}
          </div>

          {/* Controls Bar: Zoom, Rotation, Reset */}
          {imageSrc && (
            <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between gap-3 text-slate-300">
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                  <span>Zoom:</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="font-mono text-xs font-bold w-10 text-right text-sky-400">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition flex items-center gap-1 text-[11px]"
                >
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rotar 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                    setRotation(0);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl transition flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Restablecer</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!imageSrc}
              onClick={handleSaveCrop}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-950/30"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar y Guardar Foto</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
