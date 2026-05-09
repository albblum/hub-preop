import type { HubRole } from "@prisma/client";
import { canTransition, hasActiveCommitteeMembershipClaims } from "@/lib/rbac";
import {
  resolveActorAuthorityAny,
  resolveActorAuthorityForCommittee,
  type ActorAuthoritySignal,
} from "@/lib/authority/instrument-membership";
import type {
  AuthorityContext,
  AuthorityDecision,
  AuthorityEvidence,
  AuthorityResolutionMode,
  AuthoritySource,
} from "@/lib/authority/types";

const NORMATIVE_BASE_REFS = ["ADR-0014", "MVP_RBAC_ADAPTER_V1"];
const SUPERVISOR_ROLES: HubRole[] = ["admin", "registrar"];

function isSupervisor(roles: HubRole[]): boolean {
  return roles.some((r) => SUPERVISOR_ROLES.includes(r));
}

function evidenceFor(signal: ActorAuthoritySignal): AuthorityEvidence | undefined {
  if (signal.quality === "none") {
    return signal.committeeId ? { committeeId: signal.committeeId } : undefined;
  }
  return {
    committeeId: signal.committeeId,
    authorityInstrumentId: signal.authorityInstrumentId,
  };
}

function pickModeForGrant(args: {
  signal: ActorAuthoritySignal;
  supervisor: boolean;
}): { mode: AuthorityResolutionMode; source: AuthoritySource; normativeAdd: string } {
  if (args.signal.quality === "instrument_linked") {
    return {
      mode: "instrument_first",
      source: "instrument_based",
      normativeAdd: "INSTRUMENT_AUTHORITY_NOMINATION",
    };
  }
  if (args.signal.quality === "membership_only" && !args.supervisor) {
    return {
      mode: "hybrid_fallback",
      source: "hybrid",
      normativeAdd: "RBAC_COMMITTEE_MEMBERSHIP_ACTIVE",
    };
  }
  return {
    mode: "role_fallback",
    source: "role_based",
    normativeAdd: "RBAC_COMMITTEE_SUPERVISION_ROLE",
  };
}

function decideTransition(context: AuthorityContext): AuthorityDecision {
  const roleAllows = canTransition(context.actor.roles, []);
  const allowed = roleAllows || canTransition(context.actor.roles, context.actor.memberships);

  const signal =
    context.actor.id !== null
      ? resolveActorAuthorityAny({
          memberships: context.actor.memberships,
          timestamp: context.timestamp,
        })
      : { quality: "none" as const, committeeId: null, authorityInstrumentId: null };

  // IBA-0/D3: `transition` não é promovido a `instrument_first` (resolver não
  // consulta o head do instrumento para obter `committeeId`). O ramo
  // institucional só sobe para `hybrid_fallback` quando o RBAC sozinho não
  // bastaria e existe membership ativa.
  const grantedByMembershipOnly = allowed && !roleAllows && signal.quality !== "none";

  const mode: AuthorityResolutionMode = grantedByMembershipOnly
    ? "hybrid_fallback"
    : "role_fallback";
  const source: AuthoritySource = grantedByMembershipOnly ? "hybrid" : "role_based";
  const normativeAdd = grantedByMembershipOnly
    ? "RBAC_COMMITTEE_MEMBERSHIP_ACTIVE"
    : "RBAC_CAN_TRANSITION";

  const evidence = grantedByMembershipOnly ? evidenceFor(signal) : undefined;

  return {
    allowed,
    reasonCode: allowed ? "ROLE_TRANSITION_ALLOWED" : "ROLE_TRANSITION_DENIED",
    authoritySource: source,
    normativeRefs: [...NORMATIVE_BASE_REFS, normativeAdd],
    resolutionMode: mode,
    ...(evidence ? { authorityEvidence: evidence } : {}),
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
      resolutionMode: "role_fallback",
    };
  }

  const supervisor = isSupervisor(context.actor.roles);
  const signal =
    context.actor.id !== null
      ? resolveActorAuthorityForCommittee({
          memberships: context.actor.memberships,
          committeeId,
          timestamp: context.timestamp,
        })
      : { quality: "none" as const, committeeId, authorityInstrumentId: null };

  const allowed = supervisor || signal.quality !== "none";

  if (!allowed) {
    return {
      allowed: false,
      reasonCode: "COMMITTEE_ACTION_DENIED",
      authoritySource: "role_based",
      normativeRefs: [
        ...NORMATIVE_BASE_REFS,
        hasActiveCommitteeMembershipClaims(context.actor.memberships)
          ? "RBAC_COMMITTEE_MEMBERSHIP_ACTIVE"
          : "RBAC_COMMITTEE_SUPERVISION_ROLE",
      ],
      resolutionMode: "role_fallback",
      ...(signal.committeeId ? { authorityEvidence: { committeeId: signal.committeeId } } : {}),
    };
  }

  const picked = pickModeForGrant({ signal, supervisor });
  // `authorityEvidence` regista apenas o que efectivamente sustentou a decisão.
  // Em `role_fallback` (grant pelo papel de supervisor), não há evidência
  // institucional — o `committeeId` do instrumento alvo é escopo, não prova.
  const evidence = picked.mode === "role_fallback" ? undefined : evidenceFor(signal);

  return {
    allowed: true,
    reasonCode: "COMMITTEE_ACTION_ALLOWED",
    authoritySource: picked.source,
    normativeRefs: [...NORMATIVE_BASE_REFS, picked.normativeAdd],
    resolutionMode: picked.mode,
    ...(evidence ? { authorityEvidence: evidence } : {}),
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
