"use client";

import { Languages, LogOut, Save, UserRound } from "lucide-react";

export function ConfigView({
  profileForm,
  profileError,
  profileSaving,
  onProfileChange,
  onSubmitProfile,
  onLogout,
}) {
  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#12252f_0%,#0f1b22_58%,#0d171d_100%)] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute -top-14 -right-12 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative flex items-start gap-4">
          <div className="h-14 w-14 shrink-0 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 text-cyan-200 inline-flex items-center justify-center">
            <UserRound className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/90">Configuracion de cuenta</p>
            <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-gray-100">Tu perfil y preferencias</h2>
            <p className="mt-2 text-sm text-[color:var(--text-soft)] max-w-xl">
              Actualiza como apareces en la app y el idioma de la interfaz. Los cambios se guardan para toda tu sesion.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmitProfile}
        className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-2)] p-4 sm:p-5 space-y-4"
      >
        <div className="rounded-xl border border-white/10 bg-[color:var(--surface-1)] p-4">
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-cyan-300" />
            <p className="text-sm font-medium text-gray-100">Identidad</p>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-[color:var(--text-soft)]">Display name</span>
              <input
                value={profileForm.displayName}
                onChange={(e) => onProfileChange("displayName", e.target.value)}
                className="h-10 px-3 rounded-lg border border-white/10 bg-[#0f171e] text-gray-100 outline-none focus:border-cyan-400/55"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[color:var(--text-soft)]">Alias</span>
              <input
                value={profileForm.alias}
                onChange={(e) => onProfileChange("alias", e.target.value)}
                className="h-10 px-3 rounded-lg border border-white/10 bg-[#0f171e] text-gray-100 outline-none focus:border-cyan-400/55"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[color:var(--surface-1)] p-4">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-emerald-300" />
            <p className="text-sm font-medium text-gray-100">Preferencias</p>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 sm:max-w-[240px]">
              <span className="text-xs text-[color:var(--text-soft)]">Idioma</span>
              <select
                value={profileForm.language}
                onChange={(e) => onProfileChange("language", e.target.value.toLowerCase())}
                className="h-10 px-3 rounded-lg border border-white/10 bg-[#0f171e] text-gray-100 outline-none focus:border-emerald-400/55"
              >
                <option value="es">Espanol</option>
                <option value="en">Ingles</option>
                <option value="pt">Portugues</option>
              </select>
            </label>
          </div>
        </div>

        {profileError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
            <p className="text-sm text-red-300">{profileError}</p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onLogout}
            className="h-10 px-4 rounded-lg border border-white/15 text-gray-200 hover:bg-white/5 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesion
          </button>
          <button
            type="submit"
            disabled={profileSaving}
            className="h-10 px-4 rounded-lg bg-[#00a884] text-white font-medium hover:bg-[#008f72] disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {profileSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
