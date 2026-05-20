/**
 * Public marketing site (v0 landing). When set, "Home" / site entry links should target this URL
 * instead of the Hub technical root `/`.
 */
export function getPublicMarketingHomeUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}
