import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

export type AuthorityActionType =
  | "transition"
  | "committee_consultation_open"
  | "committee_deliberation"
  | "committee_formal_approval";

export type AuthorityActorContext = {
  id: string | null;
  roles: HubRole[];
  memberships: CommitteeMembershipClaim[];
};

export type AuthorityInstrumentContext = {
  id: string;
  committeeId?: string | null;
};

export type AuthorityContext = {
  actor: AuthorityActorContext;
  instrument: AuthorityInstrumentContext;
  actionType: AuthorityActionType;
  timestamp: Date;
};

export type AuthoritySource = "role_based" | "instrument_based" | "hybrid";

export type AuthorityDecision = {
  allowed: boolean;
  reasonCode: string;
  authoritySource: AuthoritySource;
  normativeRefs: string[];
};
