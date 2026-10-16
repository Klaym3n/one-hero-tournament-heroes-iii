const BASE = "http://local.invalid";

/**
 * Zwraca bezpieczną ścieżkę względną do przekierowania po logowaniu.
 * Odrzuca adresy zewnętrzne, także w formach typu "//evil.com" lub "/\evil.com".
 */
export function safeNext(next: string | null | undefined, fallback = "/konto"): string {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
