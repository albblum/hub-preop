import type { HubRole } from "@prisma/client";
import type { ExportMode } from "@/lib/audit/export-redaction";

/** Active committee claims carried in session (resolved at sign-in from CommitteeMembership). */
export type CommitteeMembershipClaim = {
  committeeId: string;
  code: string;
  startedAt: string;
  authorityInstrumentId?: string | null;
};

export function hasActiveCommitteeMembershipClaims(
  claims: CommitteeMembershipClaim[] | undefined,
): boolean {
  return (claims?.length ?? 0) > 0;
}

/**
 * Central RBAC for the operational MVP (HubRole + can*).
 * Preserve a single extension locus: instrument-scoped authority and multi-actor / multi-step
 * transitions (Regime Fundacional §4.1 — PRC + SG as provisional pattern; see ADR 0012) are
 * **not** implemented here yet; see ADR 0012 before scattering role checks outside this module.
 */

const EXPORT_RANK: Record<ExportMode, number> = {
  public: 0,
  registered: 1,
  restricted: 2,
};

/** Highest export tier implied by role set and active committee membership (union). */
export function maxExportModeForRoles(
  roles: HubRole[],
  committeeMemberships?: CommitteeMembershipClaim[],
): ExportMode {
  if (roles.includes("admin") || roles.includes("registrar")) return "restricted";
  if (roles.includes("reviewer") || roles.includes("viewer_registered")) return "registered";
  if (hasActiveCommitteeMembershipClaims(committeeMemberships)) return "registered";
  return "public";
}

/**
 * Whether the caller may use the requested export redaction mode.
 * Unauthenticated callers may only use `public`.
 */
export function canUseExportMode(
  roles: HubRole[] | undefined,
  requested: ExportMode,
  committeeMemberships?: CommitteeMembershipClaim[],
): boolean {
  const effectiveRoles = roles ?? [];
  const max = maxExportModeForRoles(effectiveRoles, committeeMemberships);
  return EXPORT_RANK[requested] <= EXPORT_RANK[max];
}

const CREATE_ROLES: HubRole[] = ["admin", "registrar"];
const TRANSITION_ROLES: HubRole[] = ["admin", "registrar", "reviewer"];
const CONTENT_ROLES: HubRole[] = ["admin", "registrar"];

export function canCreateInstrument(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => CREATE_ROLES.includes(r));
}

export function canTransition(
  roles: HubRole[] | undefined,
  committeeMemberships?: CommitteeMembershipClaim[],
): boolean {
  if ((roles ?? []).some((r) => TRANSITION_ROLES.includes(r))) return true;
  if (hasActiveCommitteeMembershipClaims(committeeMemberships)) return true;
  return false;
}

export function canAppendContent(
  roles: HubRole[] | undefined,
  committeeMemberships?: CommitteeMembershipClaim[],
  instrumentCommitteeId?: string | null,
): boolean {
  if ((roles ?? []).some((r) => CONTENT_ROLES.includes(r))) return true;
  if (
    instrumentCommitteeId &&
    (committeeMemberships ?? []).some((m) => m.committeeId === instrumentCommitteeId)
  ) {
    return true;
  }
  return false;
}

/** Filtered lists / operational queues (e.g. normalization-pending). */
export function canViewOperationalQueues(
  roles: HubRole[] | undefined,
  committeeMemberships?: CommitteeMembershipClaim[],
): boolean {
  if ((roles ?? []).some((r) => TRANSITION_ROLES.includes(r))) return true;
  if (hasActiveCommitteeMembershipClaims(committeeMemberships)) return true;
  return false;
}
