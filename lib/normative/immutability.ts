import type { NormativeTx } from "./types";

export class ClauseImmutableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClauseImmutableError";
  }
}

/**
 * Blocks structural edits to a clause after publication (`publishedAt`).
 * Does **not** apply to {@link appendClauseVersion} — published clauses accept new versions (ADR 0015 §2.2).
 */
export async function assertClauseNotPublished(tx: NormativeTx, clauseId: string): Promise<void> {
  const row = await tx.normativeClause.findUnique({
    where: { id: clauseId },
    select: { publishedAt: true },
  });
  if (row?.publishedAt) {
    throw new ClauseImmutableError(
      "NormativeClause is published; structural identity (idrRef, position, codes) is immutable",
    );
  }
}

/**
 * Fails when the version participates in an aggregated instrument revision.
 * `LedgerEntry.payloadHash` remains instrument-scoped (ADR 0002); clause-level ledger coupling is not modelled yet.
 */
export async function assertClauseVersionNotReferenced(tx: NormativeTx, clauseVersionId: string): Promise<void> {
  const link = await tx.instrumentRevisionClauseVersion.findFirst({
    where: { clauseVersionId },
  });
  if (link) {
    throw new ClauseImmutableError(
      "ClauseVersion is frozen because it is indexed on an InstrumentRevision; do not UPDATE body",
    );
  }
}

export async function assertSectionStructureMutable(tx: NormativeTx, sectionId: string): Promise<void> {
  const row = await tx.normativeSection.findUnique({
    where: { id: sectionId },
    select: { publishedAt: true },
  });
  if (row?.publishedAt) {
    throw new ClauseImmutableError("NormativeSection is published; structural reordering is blocked");
  }
}

/**
 * Domain guard before a direct `ClauseVersion.body` UPDATE: revision-linked versions are immutable.
 * Also blocks updates on any version of a **published** clause (append-only path remains valid).
 */
export async function assertClauseVersionDirectBodyUpdateForbidden(
  tx: NormativeTx,
  clauseVersionId: string,
): Promise<void> {
  await assertClauseVersionNotReferenced(tx, clauseVersionId);
  const row = await tx.clauseVersion.findUnique({
    where: { id: clauseVersionId },
    select: {
      clause: { select: { publishedAt: true } },
    },
  });
  if (row?.clause.publishedAt) {
    throw new ClauseImmutableError(
      "ClauseVersion.body cannot be updated in place after clause publication; use appendClauseVersion",
    );
  }
}
