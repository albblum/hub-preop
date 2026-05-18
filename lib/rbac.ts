import type { DocumentType, HubRole } from "@prisma/client";
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

/** Document types readable by provisional members (pre-operational corpus). */
const PROVISIONAL_CORPUS_DOCUMENT_TYPES: DocumentType[] = [
  "constitutional",
  "operational",
  "institutional",
];

/** Statuses treated as “active” for provisional corpus access (`in-force` ≡ operational active). */
const PROVISIONAL_CORPUS_STATUSES = new Set(["foundational-provisional", "in-force"]);

const TECHNICAL_ADMIN_ROLES: HubRole[] = ["admin", "registrar"];
const CREATE_ROLES: HubRole[] = TECHNICAL_ADMIN_ROLES;
const TRANSITION_ROLES: HubRole[] = ["admin", "registrar", "reviewer", "secretary_general"];
const CONTENT_ROLES: HubRole[] = TECHNICAL_ADMIN_ROLES;
const INSTITUTIONAL_ACT_ROLES: HubRole[] = ["secretary_general"];
const PROVISIONAL_MEMBER_ROLES: HubRole[] = ["provisional_member"];

export type AppendContentContext = {
  documentType?: DocumentType;
  /** Lifecycle status of the instrument (e.g. `under-review` during consultation). */
  instrumentStatus?: string;
};

/** Highest export tier implied by role set and active committee membership (union). */
export function maxExportModeForRoles(
  roles: HubRole[],
  committeeMemberships?: CommitteeMembershipClaim[],
): ExportMode {
  if (roles.some((r) => TECHNICAL_ADMIN_ROLES.includes(r) || r === "secretary_general")) {
    return "restricted";
  }
  if (
    roles.includes("reviewer") ||
    roles.includes("viewer_registered") ||
    roles.includes("provisional_member")
  ) {
    return "registered";
  }
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

export function canCreateInstrument(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => CREATE_ROLES.includes(r));
}

/** Secretary-General: emit institutional acts in DocHUB (not technical instrument creation). */
export function canIssueInstitutionalAct(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => INSTITUTIONAL_ACT_ROLES.includes(r));
}

/** Secretary-General: nominate, suspend, or revoke provisional members. */
export function canManageProvisionalMembers(roles: HubRole[] | undefined): boolean {
  return canIssueInstitutionalAct(roles);
}

/**
 * Secretary-General: encerrar `idr:c:preop-regime` via transição formal registada no ledger.
 * Enforcement of target instrument remains at the transition/command layer.
 */
export function canClosePreopRegimeByFormalAct(roles: HubRole[] | undefined): boolean {
  return canIssueInstitutionalAct(roles);
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
  context?: AppendContentContext,
): boolean {
  if ((roles ?? []).some((r) => CONTENT_ROLES.includes(r))) return true;
  if (
    (roles ?? []).some((r) => INSTITUTIONAL_ACT_ROLES.includes(r)) &&
    context?.documentType === "institutional"
  ) {
    return true;
  }
  if (
    (roles ?? []).some((r) => PROVISIONAL_MEMBER_ROLES.includes(r)) &&
    context?.instrumentStatus === "under-review"
  ) {
    return true;
  }
  if (
    instrumentCommitteeId &&
    (committeeMemberships ?? []).some((m) => m.committeeId === instrumentCommitteeId)
  ) {
    return true;
  }
  return false;
}

/** Provisional member: submeter contribuições a instrumentos em consulta. */
export function canSubmitConsultationContribution(
  roles: HubRole[] | undefined,
  instrumentStatus?: string,
): boolean {
  if (instrumentStatus !== "under-review") return false;
  return (roles ?? []).some((r) => PROVISIONAL_MEMBER_ROLES.includes(r));
}

/** Provisional member (and comité): participar em deliberações registadas no ledger. */
export function canParticipateInDeliberation(
  roles: HubRole[] | undefined,
  committeeMemberships?: CommitteeMembershipClaim[],
): boolean {
  if ((roles ?? []).some((r) => PROVISIONAL_MEMBER_ROLES.includes(r))) return true;
  return hasActiveCommitteeMembershipClaims(committeeMemberships);
}

/**
 * Provisional member: leitura de documentos constitutional / operational / institutional
 * com status `foundational-provisional` ou `in-force` (operational “active”).
 */
export function canViewInstitutionalCorpusDocument(
  roles: HubRole[] | undefined,
  params: { documentType: DocumentType; status: string },
): boolean {
  if (!(roles ?? []).some((r) => PROVISIONAL_MEMBER_ROLES.includes(r))) return false;
  if (!PROVISIONAL_CORPUS_DOCUMENT_TYPES.includes(params.documentType)) return false;
  return PROVISIONAL_CORPUS_STATUSES.has(params.status);
}

/** Filtered lists / operational queues (e.g. normalization-pending). */
export function canViewOperationalQueues(
  roles: HubRole[] | undefined,
  committeeMemberships?: CommitteeMembershipClaim[],
): boolean {
  if ((roles ?? []).some((r) => TRANSITION_ROLES.includes(r))) return true;
  if ((roles ?? []).some((r) => PROVISIONAL_MEMBER_ROLES.includes(r))) return true;
  if (hasActiveCommitteeMembershipClaims(committeeMemberships)) return true;
  return false;
}
