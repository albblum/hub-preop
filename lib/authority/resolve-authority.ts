import { canTransition, hasActiveCommitteeMembershipClaims } from "@/lib/rbac";
import type { AuthorityContext, AuthorityDecision } from "@/lib/authority/types";

const NORMATIVE_BASE_REFS = ["ADR-0014", "MVP_RBAC_ADAPTER_V1"];

function decideTransition(context: AuthorityContext): AuthorityDecision {
  const allowed = canTransition(context.actor.roles, context.actor.memberships);
  return {
    allowed,
    reasonCode: allowed ? "ROLE_TRANSITION_ALLOWED" : "ROLE_TRANSITION_DENIED",
    authoritySource: "role_based",
    normativeRefs: [...NORMATIVE_BASE_REFS, "RBAC_CAN_TRANSITION"],
  };
}

function decideCommitteeAction(context: AuthorityContext): AuthorityDecision {
  const committeeId = context.instrument.committeeId ?? null;
  if (!committeeId) {
    return {
      allowed: false,
      reasonCode: "INSTRUMENT_COMMITTEE_REQUIRED",
      authoritySource: "role_based",
      normativeRefs: [...NORMATIVE_BASE_REFS, "COMMITTEE_SCOPE_REQUIRED"],
    };
  }

  const isSupervisorRole =
    context.actor.roles.includes("admin") || context.actor.roles.includes("registrar");
  const hasMatchingMembership = context.actor.memberships.some(
    (membership) => membership.committeeId === committeeId,
  );

  const allowed = isSupervisorRole || hasMatchingMembership;
  const authoritySource = hasMatchingMembership && !isSupervisorRole ? "hybrid" : "role_based";

  return {
    allowed,
    reasonCode: allowed ? "COMMITTEE_ACTION_ALLOWED" : "COMMITTEE_ACTION_DENIED",
    authoritySource,
    normativeRefs: [
      ...NORMATIVE_BASE_REFS,
      hasActiveCommitteeMembershipClaims(context.actor.memberships)
        ? "RBAC_COMMITTEE_MEMBERSHIP_ACTIVE"
        : "RBAC_COMMITTEE_SUPERVISION_ROLE",
    ],
  };
}

export function resolveAuthorityForAction(context: AuthorityContext): AuthorityDecision {
  switch (context.actionType) {
    case "transition":
      return decideTransition(context);
    case "committee_consultation_open":
    case "committee_deliberation":
    case "committee_formal_approval":
      return decideCommitteeAction(context);
    default: {
      const exhaustive: never = context.actionType;
      return exhaustive;
    }
  }
}
