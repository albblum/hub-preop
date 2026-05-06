import type { Instrument, InstrumentVersion, Prisma, TransitionEvent } from "@prisma/client";
import { LEDGER_ENTRY_TYPES } from "./entry-types";
import { computeTransitionPayloadHash } from "./transition-payload-hash";

type Tx = Prisma.TransactionClient;

async function nextSequence(tx: Tx, instrumentId: string): Promise<{ seq: number; previousId: string | null }> {
  const last = await tx.ledgerEntry.findFirst({
    where: { instrumentId },
    orderBy: { sequence: "desc" },
    select: { id: true, sequence: true },
  });
  if (!last) {
    return { seq: 1, previousId: null };
  }
  return { seq: last.sequence + 1, previousId: last.id };
}

export async function appendVersionLedger(
  tx: Tx,
  params: {
    instrument: Pick<Instrument, "id" | "idrRef">;
    version: Pick<InstrumentVersion, "id" | "contentHash">;
  },
): Promise<void> {
  const { seq, previousId } = await nextSequence(tx, params.instrument.id);
  await tx.ledgerEntry.create({
    data: {
      instrumentId: params.instrument.id,
      sequence: seq,
      previousEntryId: previousId,
      entryType: LEDGER_ENTRY_TYPES.VERSION_RECORDED,
      payloadHash: params.version.contentHash,
      idrRef: params.instrument.idrRef,
      instrumentVersionId: params.version.id,
    },
  });
}

export async function appendTransitionLedger(
  tx: Tx,
  params: {
    instrument: Pick<Instrument, "id" | "idrRef">;
    event: TransitionEvent;
  },
): Promise<void> {
  const { seq, previousId } = await nextSequence(tx, params.instrument.id);
  const payloadHash = computeTransitionPayloadHash({
    id: params.event.id,
    fromStatus: params.event.fromStatus,
    toStatus: params.event.toStatus,
    at: params.event.at,
  });
  await tx.ledgerEntry.create({
    data: {
      instrumentId: params.instrument.id,
      sequence: seq,
      previousEntryId: previousId,
      entryType: LEDGER_ENTRY_TYPES.STATUS_TRANSITION,
      payloadHash,
      idrRef: params.instrument.idrRef,
      transitionEventId: params.event.id,
    },
  });
}
