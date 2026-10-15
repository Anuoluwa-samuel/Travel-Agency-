/**
 * Accepts only same-origin relative paths for post-login redirects, preventing open
 * redirects via `?next=https://evil.example` or protocol-relative `//evil.example`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://orbis.local");
    if (url.origin !== "http://orbis.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
