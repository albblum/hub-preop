import type { ClauseVersion } from "@prisma/client";
import { assertV2Instrument } from "@/lib/domain/v2-write-guards";
import { DomainError } from "@/lib/domain/transitions";
import { getInstrumentById, type InstrumentDetail } from "@/lib/instrument-service";
import { prisma } from "@/lib/prisma";
import { aggregateAndPersistInstrument } from "./aggregate-instrument";
import { appendClauseVersion } from "./clause-version";
import { findInstrumentIdForClause } from "./read-v2-instrument";

export type AppendClauseAndReaggregateInput = {
  instrumentId: string;
  clauseId: string;
  body: string;
  revisionNote?: string | null;
  createdBy?: string | null;
};

export type AppendClauseAndReaggregateResult = {
  clauseVersion: ClauseVersion;
  instrument: InstrumentDetail;
  aggregate: {
    revisionNumber: number;
    contentHash: string;
    skipped: boolean;
  };
};

/**
 * Editorial v2 write path: append immutable clause version, then derived aggregate.
 * Uses two sequential transactions (clause TX, then aggregate TX) — same contract as Passo 4 CLI.
 */
export async function appendClauseVersionAndReaggregate(
  input: AppendClauseAndReaggregateInput,
): Promise<AppendClauseAndReaggregateResult> {
  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
    select: { id: true, structuralProfile: true },
  });
  if (!inst) {
    throw new DomainError("Instrument not found", "INSTRUMENT_NOT_FOUND");
  }
  assertV2Instrument(inst.structuralProfile);

  const ownerInstrumentId = await findInstrumentIdForClause(prisma, input.clauseId);
  if (!ownerInstrumentId) {
    throw new DomainError("Clause not found", "CLAUSE_NOT_FOUND");
  }
  if (ownerInstrumentId !== input.instrumentId) {
    throw new DomainError(
      "Clause does not belong to this instrument",
      "CLAUSE_NOT_IN_INSTRUMENT",
    );
  }

  const clauseVersion = await prisma.$transaction((tx) =>
    appendClauseVersion(tx, {
      clauseId: input.clauseId,
      body: input.body,
      revisionNote: input.revisionNote,
      createdBy: input.createdBy,
    }),
  );

  const agg = await aggregateAndPersistInstrument(input.instrumentId, { force: false });

  const instrument = await getInstrumentById(input.instrumentId);
  if (!instrument) {
    throw new Error("Instrument disappeared after clause append");
  }

  return {
    clauseVersion,
    instrument,
    aggregate: {
      revisionNumber: agg.revisionNumber,
      contentHash: agg.contentHash,
      skipped: agg.skipped,
    },
  };
}
