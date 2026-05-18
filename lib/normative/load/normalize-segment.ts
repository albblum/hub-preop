/**
 * Pilot Fase 3: all hierarchical segment codes are lowercase before composeIdrRef / persist.
 */
export function normalizeSegmentCode(s: string): string {
  return s.trim().toLowerCase();
}

/** Normalizes paragraph marker from source (§2.0 → 2, §5-A → 5-a). */
export function normalizeParagraphCode(raw: string): string {
  let code = raw.trim().toLowerCase();
  if (code.endsWith(".0")) {
    code = code.slice(0, -2);
  }
  return code;
}
