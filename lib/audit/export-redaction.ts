export type ExportMode = "public" | "registered" | "restricted";

/**
 * Simplified tier × export matrix (Fase 4 MVP).
 * - public: full body text only for layer ≤ 2; layers 3–5 redacted.
 * - registered: full body for layer ≤ 4; layer 5 redacted.
 * - restricted: full body for all layers (institutional export).
 */
export function redactInstrumentContent(mode: ExportMode, layer: number, content: string): string {
  if (mode === "restricted") {
    return content;
  }
  if (mode === "registered") {
    if (layer <= 4) return content;
    return "[REDACTED]";
  }
  // public — strictest default
  if (layer <= 2) return content;
  return "[REDACTED]";
}

export function defaultExportMode(raw: string | null): ExportMode {
  if (raw === "registered" || raw === "restricted") return raw;
  return "public";
}
