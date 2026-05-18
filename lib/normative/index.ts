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

export {
  AGGREGATE_SEP,
  AGGREGATE_SECTION_HEADER_PREFIX,
  aggregateInstrument,
  aggregateAndPersistInstrument,
  aggregateInstrumentReadFallback,
  buildAggregateMarkdown,
  findInstrumentByIdOrIdrRef,
  isDerivedHead,
} from "./aggregate-instrument";
export type {
  AggregateInstrumentResult,
  AggregateAndPersistOptions,
  AggregateAndPersistResult,
} from "./aggregate-instrument";

export {
  loadV2SectionsSummary,
  loadV2TreeForAggregate,
  findInstrumentIdForClause,
  loadResolvedClause,
} from "./read-v2-instrument";
export type {
  V2SectionSummary,
  V2SectionAggregateNode,
  V2ArticleAggregateNode,
  V2ParagraphAggregateNode,
  V2ClauseAggregateNode,
} from "./read-v2-instrument";
