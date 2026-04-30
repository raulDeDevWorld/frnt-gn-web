"use client";

import { X, Info, CircleCheck, TriangleAlert } from "lucide-react";

function iconByType(type) {
  if (type === "success") return CircleCheck;
  if (type === "error") return TriangleAlert;
  return Info;
}

function toneByType(type) {
  if (type === "success") {
    return "border-emerald-400/35 bg-emerald-500/12 text-emerald-100";
  }
  if (type === "error") {
    return "border-red-400/35 bg-red-500/12 text-red-100";
  }
  return "border-cyan-400/35 bg-cyan-500/12 text-cyan-100";
}

export function ToastViewport({ toasts, onDismiss }) {
  if (!Array.isArray(toasts) || !toasts.length) return null;

  return (
    <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[120] w-[min(92vw,360px)] space-y-2">
      {toasts.map((toast) => {
        const Icon = iconByType(toast.type);
        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`rounded-xl border backdrop-blur px-3 py-2.5 shadow-[0_14px_28px_rgba(0,0,0,0.28)] ${toneByType(toast.type)}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-[12px] leading-relaxed flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="h-6 w-6 rounded-md hover:bg-white/10 inline-flex items-center justify-center shrink-0"
                aria-label="Cerrar notificacion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
