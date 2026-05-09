export type {
  AuthorityActionType,
  AuthorityActorContext,
  AuthorityContext,
  AuthorityDecision,
  AuthorityEvidence,
  AuthorityInstrumentContext,
  AuthorityResolutionMode,
  AuthoritySource,
} from "@/lib/authority/types";
export { resolveAuthorityForAction } from "@/lib/authority/resolve-authority";
export {
  resolveActorAuthorityAny,
  resolveActorAuthorityForCommittee,
  type ActorAuthoritySignal,
  type AuthorityQuality,
} from "@/lib/authority/instrument-membership";
