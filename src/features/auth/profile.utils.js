export function iso2ToFlagEmoji(code) {
  const upper = String(code || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";

  const A = 0x1f1e6;
  return String.fromCodePoint(A + (upper.charCodeAt(0) - 65), A + (upper.charCodeAt(1) - 65));
}

export function buildAliasSuggestion(user) {
  const emailPrefix = String(user?.email || "")
    .split("@")[0]
    .trim();
  const displayName = String(user?.displayName || "").trim();
  const source = emailPrefix || displayName || "usuario";
  const alias = source
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 24);

  if (alias.length >= 3) return alias;
  return `user${Math.random().toString(10).slice(2, 8)}`;
}
