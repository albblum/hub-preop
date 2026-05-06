import type { CanonicalStatus } from "./canonical-status";
import { CANONICAL_STATUSES } from "./canonical-status";

/**
 * Canonical Part lifecycle strings persisted on `Part.partStatus` (ADR 0004).
 * Inspired by DocHUB §5.2; includes Hub extensions where DocHUB has no literal match.
 */
export const PART_STATUSES = [
  "DRAFT",
  "PROPOSED",
  "PROVISIONAL",
  "CONVALIDATED",
  "SUPERSEDED",
  "EXPIRED",
  "REJECTED",
  "SUSPENDED",
  "REVOKED",
  "DERIVATION_PENDING",
  "NORMALIZATION_PENDING",
] as const;

export type PartStatus = (typeof PART_STATUSES)[number];

const PART_SET = new Set<string>(PART_STATUSES);

export function isPartStatus(s: string): s is PartStatus {
  return PART_SET.has(s);
}

/**
 * Deterministic projection Instrument → MONOLITH_BODY Part status (ADR 0004).
 */
export function mapInstrumentStatusToPartStatus(instrumentStatus: string): PartStatus {
  if (!(CANONICAL_STATUSES as readonly string[]).includes(instrumentStatus)) {
    throw new Error(`Unknown instrument status for Part mapping: ${instrumentStatus}`);
  }
  const s = instrumentStatus as CanonicalStatus;
  switch (s) {
    case "draft":
      return "DRAFT";
    case "under-review":
      return "PROPOSED";
    case "foundational-provisional":
      return "PROVISIONAL";
    case "in-force":
      return "PROVISIONAL";
    case "amended":
      return "SUPERSEDED";
    case "suspended":
      return "SUSPENDED";
    case "revoked":
      return "REVOKED";
    case "derivation-pending":
      return "DERIVATION_PENDING";
    case "normalization-pending":
      return "NORMALIZATION_PENDING";
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}
