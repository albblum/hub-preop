import type { CanonicalStatus } from "./canonical-status";

/** Allowed outgoing transitions by current status (Fase 1 functional architecture spec). */
const ALLOWED: Record<CanonicalStatus, readonly CanonicalStatus[]> = {
  draft: ["under-review", "foundational-provisional", "revoked"],
  "under-review": [
    "in-force",
    "foundational-provisional",
    "derivation-pending",
    "revoked",
  ],
  "foundational-provisional": ["under-review", "in-force", "amended", "revoked"],
  "in-force": ["amended", "suspended", "revoked"],
  amended: ["revoked"],
  suspended: ["in-force", "revoked"],
  revoked: [],
  "derivation-pending": ["under-review", "revoked"],
  "normalization-pending": ["in-force", "under-review", "revoked"],
};

export function isTransitionAllowed(from: string, to: string): boolean {
  const next = ALLOWED[from as CanonicalStatus];
  if (!next) return false;
  return (next as readonly string[]).includes(to);
}

export function assertTransitionAllowed(from: string, to: string): void {
  if (!isTransitionAllowed(from, to)) {
    throw new DomainError(
      `Transition not allowed: ${from} -> ${to}. See MVP transition matrix in Fase3_Core_Registry_MVP.md.`,
    );
  }
}

export class DomainError extends Error {
  readonly code = "DOMAIN_ERROR";
  /** Stable machine code for HTTP mapping (optional). */
  readonly domainCode?: string;
  constructor(message: string, domainCode?: string) {
    super(message);
    this.name = "DomainError";
    this.domainCode = domainCode;
  }
}
