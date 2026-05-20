/**
 * Normalises a post-login navigation target to a same-origin relative path only
 * (prevents open redirects via absolute URLs or //host).
 */
export function safeInternalPath(raw: string | null, fallback: string): string {
  if (!raw || typeof raw !== "string") return fallback;
  let t = raw.trim();
  try {
    t = decodeURIComponent(t);
  } catch {
    return fallback;
  }
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("://") || t.includes("\\")) return fallback;
  if (t.includes("@")) return fallback;
  return t;
}
