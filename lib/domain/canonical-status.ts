/** Canonical lifecycle statuses (Fase 1 Hub spec — subset enforced in MVP transitions). */
export const CANONICAL_STATUSES = [
  "draft",
  "under-review",
  "foundational-provisional",
  "in-force",
  "amended",
  "suspended",
  "revoked",
  "derivation-pending",
  "normalization-pending",
] as const;

export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

const SET = new Set<string>(CANONICAL_STATUSES);

export function isCanonicalStatus(s: string): s is CanonicalStatus {
  return SET.has(s);
}
