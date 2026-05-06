import type { InstrumentVersion, Prisma, PrismaClient } from "@prisma/client";
import { mapInstrumentStatusToPartStatus } from "@/lib/domain/part-status";

type Tx = Prisma.TransactionClient;

/** Monolithic body Part — single normative blob per `InstrumentVersion` (ADR 0003 / DocHUB monolith profile). */
export const PART_KIND_MONOLITH_BODY = "MONOLITH_BODY" as const;

const MONOLITH_POSITION = 1;
const MONOLITH_ORDINAL = 1;

/** True when ordered positions match MVP monolith: a single part at index 1. */
export function isMvpMonolithCompositionOrder(positions: number[]): boolean {
  return positions.length === 1 && positions[0] === MONOLITH_POSITION;
}

/**
 * Maintains MVP invariants: one MONOLITH_BODY Part per instrument, one PartVersion per
 * `InstrumentVersion`, one composition row at position 1. Idempotent for a given `instrumentVersionId`.
 * Does not duplicate `InstrumentVersion.content`; `contentHash` mirrors the version row.
 */
export async function syncMonolithicPartForInstrumentVersion(
  tx: Tx,
  params: {
    instrumentId: string;
    instrumentVersion: Pick<InstrumentVersion, "id" | "contentHash">;
    /** Current `Instrument.status` after the version write (ADR 0004). */
    instrumentStatus: string;
  },
): Promise<void> {
  const { instrumentId, instrumentVersion, instrumentStatus } = params;
  const partStatus = mapInstrumentStatusToPartStatus(instrumentStatus);

  const part = await tx.part.upsert({
    where: {
      instrumentId_partKind: {
        instrumentId,
        partKind: PART_KIND_MONOLITH_BODY,
      },
    },
    create: {
      instrumentId,
      partKind: PART_KIND_MONOLITH_BODY,
      partStatus,
    },
    update: {
      partStatus,
    },
  });

  await tx.partVersion.upsert({
    where: { instrumentVersionId: instrumentVersion.id },
    create: {
      partId: part.id,
      instrumentVersionId: instrumentVersion.id,
      contentHash: instrumentVersion.contentHash,
      ordinal: MONOLITH_ORDINAL,
    },
    update: {
      partId: part.id,
      contentHash: instrumentVersion.contentHash,
      ordinal: MONOLITH_ORDINAL,
    },
  });

  await tx.compositionEntry.upsert({
    where: {
      instrumentId_position: {
        instrumentId,
        position: MONOLITH_POSITION,
      },
    },
    create: {
      instrumentId,
      partId: part.id,
      position: MONOLITH_POSITION,
    },
    update: {
      partId: part.id,
    },
  });
}

export type CompositionPartRow = {
  position: number;
  partId: string;
  partKind: string;
  /** DocHUB-shaped Part lifecycle (ADR 0004). */
  partStatus: string;
  /** `InstrumentVersion.id` for the monolith PartVersion aligned to the instrument head (null if invariant broken). */
  instrumentVersionId: string | null;
};

/**
 * Active composition: ordered parts with the `instrumentVersionId` visible at the instrument’s current head.
 */
export async function getInstrumentCompositionView(
  db: Prisma.TransactionClient | PrismaClient,
  instrumentId: string,
): Promise<{ instrumentId: string; parts: CompositionPartRow[] } | null> {
  const inst = await db.instrument.findUnique({
    where: { id: instrumentId },
    select: { id: true, currentVersionRecordId: true },
  });
  if (!inst) return null;

  const headId = inst.currentVersionRecordId;

  const entries = await db.compositionEntry.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    include: { part: { select: { id: true, partKind: true, partStatus: true } } },
  });

  let alignedPartIds = new Set<string>();
  if (headId) {
    const pvs = await db.partVersion.findMany({
      where: {
        instrumentVersionId: headId,
        part: { instrumentId },
      },
      select: { partId: true },
    });
    alignedPartIds = new Set(pvs.map((p) => p.partId));
  }

  const parts: CompositionPartRow[] = entries.map((e) => ({
    position: e.position,
    partId: e.partId,
    partKind: e.part.partKind,
    partStatus: e.part.partStatus,
    instrumentVersionId: headId && alignedPartIds.has(e.partId) ? headId : null,
  }));

  return { instrumentId: inst.id, parts };
}
