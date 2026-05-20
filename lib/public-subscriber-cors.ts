/**
 * Comma-separated list of origins allowed to call from the DocHub public landing in the browser (CORS):
 * - POST /api/public/subscribers
 * - POST /api/auth/landing-login (member credentials; sets Hub session cookies on success)
 * Example:
 * PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS=https://v0-idr-landing-page.vercel.app,http://localhost:3001
 */
export function parseSubscriberAllowedOrigins(): string[] {
  const raw = process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function subscriberCorsHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return {};

  const normalizedRequest = requestOrigin.replace(/\/$/, "");
  const allowed = parseSubscriberAllowedOrigins();
  if (!allowed.includes(normalizedRequest)) return {};

  return {
    "Access-Control-Allow-Origin": normalizedRequest,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}
