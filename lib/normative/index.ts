export {
  composeIdrRef,
  parseIdrRef,
  validateIdrRef,
  IdrRefGrammarError,
} from "./idr-ref-grammar";
export type {
  IdrRefSegments,
  IdrRefTypePrefix,
  IdrRefGrammarErrorCode,
  ValidateIdrRefResult,
} from "./idr-ref-grammar";

export {
  registerIdrRef,
  assertIdrRefAvailable,
  lookupOwner,
  IdrRefCollisionError,
} from "./idr-ref-registry";
export type { RegisterIdrRefInput } from "./idr-ref-registry";

export {
  resolveIdrRef,
  registerAlias,
  listAliasesByCanonical,
  isLegacyHubInstrRef,
} from "./resolve-idr-ref";
export type { ResolvedRef, ResolveIdrRefOptions, RegisterAliasInput } from "./resolve-idr-ref";

export { appendClauseVersion, getCurrentClauseVersion } from "./clause-version";
export type { AppendClauseVersionInput } from "./clause-version";

export {
  assertClauseNotPublished,
  assertClauseVersionNotReferenced,
  assertSectionStructureMutable,
  assertClauseVersionDirectBodyUpdateForbidden,
  ClauseImmutableError,
} from "./immutability";

export type { NormativeTx } from "./types";
