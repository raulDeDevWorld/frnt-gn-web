"use client";

import { useEffect, useRef } from "react";
import { Download, X } from "lucide-react";

export function MediaViewer({ fileUrl, fileType, fileName, onClose }) {
  const closeButtonRef = useRef(null);
  if (!fileUrl) return null;

  const isImage = String(fileType || "").startsWith("image/");
  const isVideo = String(fileType || "").startsWith("video/");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName || "archivo";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onEscape = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa de archivo"
    >
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between z-10">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
          aria-label="Cerrar vista previa"
        >
          <X />
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
          aria-label="Descargar archivo"
        >
          <Download />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center w-full h-full overflow-hidden" onClick={(event) => event.stopPropagation()}>
        {isImage ? <img src={fileUrl} alt={fileName || "archivo"} className="max-h-[85vh] object-contain rounded shadow-lg" /> : null}
        {isVideo ? <video src={fileUrl} controls autoPlay className="max-h-[85vh] object-contain rounded shadow-lg" /> : null}
        {!isImage && !isVideo ? (
          <div className="text-white p-6 bg-gray-800 rounded text-center">
            <p className="mb-2">Archivo: {fileName}</p>
            <button type="button" onClick={handleDownload} className="mt-4 px-4 py-2 bg-green-600 rounded text-white">
              Descargar
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
