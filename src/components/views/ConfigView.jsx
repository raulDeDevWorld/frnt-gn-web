"use client";

export function ConfigView({
  profileForm,
  profileError,
  profileSaving,
  onProfileChange,
  onSubmitProfile,
  onLogout,
}) {
  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-[#202c33] border border-black/5 dark:border-white/10 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Config</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Gestiona tu perfil y preferencias.</p>

      <form onSubmit={onSubmitProfile} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs text-gray-600 dark:text-gray-300">Display name</span>
          <input
            value={profileForm.displayName}
            onChange={(e) => onProfileChange("displayName", e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600 dark:text-gray-300">Alias</span>
          <input
            value={profileForm.alias}
            onChange={(e) => onProfileChange("alias", e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600 dark:text-gray-300">Idioma</span>
          <select
            value={profileForm.language}
            onChange={(e) => onProfileChange("language", e.target.value.toLowerCase())}
            className="h-10 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111b21] text-gray-900 dark:text-gray-100"
          >
            <option value="es">Espanol</option>
            <option value="en">Ingles</option>
            <option value="pt">Portugues</option>
          </select>
        </label>
        {profileError ? <p className="sm:col-span-2 text-sm text-red-600 dark:text-red-400">{profileError}</p> : null}
        <div className="sm:col-span-2 flex items-center gap-2">
          <button
            type="submit"
            disabled={profileSaving}
            className="h-10 px-4 rounded-md bg-[#00a884] text-white font-medium hover:bg-[#008f72] disabled:opacity-60"
          >
            {profileSaving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="h-10 px-4 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a3942]"
          >
            Cerrar sesion
          </button>
        </div>
      </form>
    </div>
  );
}
