/**
 * Idempotent backfill: builds LedgerEntry rows for instruments that have none,
 * interleaving VERSION_RECORDED (per InstrumentVersion) and STATUS_TRANSITION
 * (per TransitionEvent) by timestamp — matches runtime ordering intent (Passo B).
 *
 * Usage: `npx tsx scripts/backfill-ledger.ts` (requires DATABASE_URL).
 */
import type { TransitionEvent } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { LEDGER_ENTRY_TYPES } from "../lib/ledger/entry-types";
import { computeTransitionPayloadHash } from "../lib/ledger/transition-payload-hash";

type Merged =
  | { kind: "version"; t: Date; versionId: string; contentHash: string; versionNum: number }
  | { kind: "transition"; t: Date; event: TransitionEvent };

async function backfillInstrument(instId: string, idrRef: string): Promise<number> {
  const existing = await prisma.ledgerEntry.count({ where: { instrumentId: instId } });
  if (existing > 0) {
    return 0;
  }

  const versions = await prisma.instrumentVersion.findMany({
    where: { instrumentId: instId },
    orderBy: { version: "asc" },
  });
  const events = await prisma.transitionEvent.findMany({
    where: { instrumentId: instId },
    orderBy: [{ at: "asc" }, { id: "asc" }],
  });

  const merged: Merged[] = [
    ...versions.map((v) => ({
      kind: "version" as const,
      t: v.createdAt,
      versionId: v.id,
      contentHash: v.contentHash,
      versionNum: v.version,
    })),
    ...events.map((e) => ({ kind: "transition" as const, t: e.at, event: e })),
  ];

  merged.sort((a, b) => {
    const ta = a.t.getTime();
    const tb = b.t.getTime();
    if (ta !== tb) return ta - tb;
    if (a.kind !== b.kind) return a.kind === "version" ? -1 : 1;
    if (a.kind === "version" && b.kind === "version") return a.versionNum - b.versionNum;
    if (a.kind === "transition" && b.kind === "transition") return a.event.id.localeCompare(b.event.id);
    return 0;
  });

  let seq = 0;
  let previousId: string | null = null;

  await prisma.$transaction(async (tx) => {
    for (const row of merged) {
      seq += 1;
      if (row.kind === "version") {
        const le = await tx.ledgerEntry.create({
          data: {
            instrumentId: instId,
            sequence: seq,
            previousEntryId: previousId,
            entryType: LEDGER_ENTRY_TYPES.VERSION_RECORDED,
            payloadHash: row.contentHash,
            idrRef,
            instrumentVersionId: row.versionId,
          },
        });
        previousId = le.id;
      } else {
        const payloadHash = computeTransitionPayloadHash({
          id: row.event.id,
          fromStatus: row.event.fromStatus,
          toStatus: row.event.toStatus,
          at: row.event.at,
        });
        const le = await tx.ledgerEntry.create({
          data: {
            instrumentId: instId,
            sequence: seq,
            previousEntryId: previousId,
            entryType: LEDGER_ENTRY_TYPES.STATUS_TRANSITION,
            payloadHash,
            idrRef,
            transitionEventId: row.event.id,
          },
        });
        previousId = le.id;
      }
    }
  });

  return merged.length;
}

async function main() {
  const instruments = await prisma.instrument.findMany({
    select: { id: true, idrRef: true },
    orderBy: { createdAt: "asc" },
  });

  let totalRows = 0;
  let instrumentsTouched = 0;

  for (const inst of instruments) {
    const n = await backfillInstrument(inst.id, inst.idrRef);
    if (n > 0) {
      instrumentsTouched += 1;
      totalRows += n;
      console.log(`${inst.idrRef}: +${n} ledger rows`);
    }
  }

  console.log(`Done. Instruments updated: ${instrumentsTouched}, ledger rows inserted: ${totalRows}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
