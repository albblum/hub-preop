import type { InstrumentVersion, Prisma, PrismaClient } from "@prisma/client";
import { mapInstrumentStatusToPartStatus } from "@/lib/domain/part-status";

type Tx = Prisma.TransactionClient;

/** Monolithic body Part — single normative blob per `InstrumentVersion` (ADR 0003 / DocHUB monolith profile). */
export const PART_KIND_MONOLITH_BODY = "MONOLITH_BODY" as const;
/** Multi-Part editorial kinds (ADR 0008); never mixed with MONOLITH_BODY in the same composition. */
export const PART_KIND_SECTION = "SECTION" as const;
export const PART_KIND_ANNEX = "ANNEX" as const;

const MONOLITH_POSITION = 1;
const MONOLITH_ORDINAL = 1;

/** True when ordered positions match MVP monolith: a single part at index 1. */
export function isMvpMonolithCompositionOrder(positions: number[]): boolean {
  return positions.length === 1 && positions[0] === MONOLITH_POSITION;
}

/** ADR 0008 — deterministic aggregate body from ordered segment Markdown (multi-Part profile only). */
export function assembleInstrumentMarkdown(orderedMarkdownBodies: string[]): string {
  return orderedMarkdownBodies.join("\n\n");
}

/** Positions must be exactly `1..segments.length` (contiguous). */
export function validateMultipartSegmentPositions(
  segments: { position: number }[],
): { ok: true } | { ok: false; message: string } {
  if (segments.length === 0) {
    return { ok: false, message: "segments must not be empty" };
  }
  const sorted = [...segments].map((s) => s.position).sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      return { ok: false, message: "segment positions must be contiguous starting at 1" };
    }
  }
  return { ok: true };
}

/** Single MONOLITH_BODY at position 1 — monolith profile (ADR 0003 / 0008). */
export async function isMonolithCompositionProfile(
  db: Tx | PrismaClient,
  instrumentId: string,
): Promise<boolean> {
  const entries = await db.compositionEntry.findMany({
    where: { instrumentId },
    include: { part: { select: { partKind: true } } },
    orderBy: { position: "asc" },
  });
  if (entries.length === 1 && entries[0].part.partKind === PART_KIND_MONOLITH_BODY) {
    return true;
  }
  /** Missing CompositionEntry rows (legacy / partial migration): infer from Part rows only. */
  if (entries.length === 0) {
    const parts = await db.part.findMany({ where: { instrumentId } });
    /** No Part Store rows yet — treat as monolith so append + sync can heal (Passo C). */
    if (parts.length === 0) {
      return true;
    }
    return parts.length === 1 && parts[0].partKind === PART_KIND_MONOLITH_BODY;
  }
  return false;
}

/**
 * Maintains MVP invariants: one MONOLITH_BODY Part per instrument, one PartVersion per
 * `InstrumentVersion`, one composition row at position 1. Idempotent for a given `instrumentVersionId`.
 * Does not duplicate `InstrumentVersion.content`; `markdownBody` stays null; `contentHash` mirrors the version row.
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
    where: {
      instrumentVersionId_partId: {
        instrumentVersionId: instrumentVersion.id,
        partId: part.id,
      },
    },
    create: {
      partId: part.id,
      instrumentVersionId: instrumentVersion.id,
      contentHash: instrumentVersion.contentHash,
      ordinal: MONOLITH_ORDINAL,
      markdownBody: null,
    },
    update: {
      partId: part.id,
      contentHash: instrumentVersion.contentHash,
      ordinal: MONOLITH_ORDINAL,
      markdownBody: null,
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

/**
 * Writes one `PartVersion` per composition row for a multi-Part instrument revision (ADR 0008).
 * Preconditions: composition must not contain `MONOLITH_BODY`.
 */
export async function syncMultipartPartVersionsForInstrumentVersion(
  tx: Tx,
  params: {
    instrumentId: string;
    instrumentVersion: Pick<InstrumentVersion, "id" | "contentHash">;
    instrumentStatus: string;
    partMarkdownByPartId: Map<string, string>;
  },
): Promise<void> {
  const entries = await tx.compositionEntry.findMany({
    where: { instrumentId: params.instrumentId },
    orderBy: { position: "asc" },
    include: { part: { select: { partKind: true } } },
  });

  for (const e of entries) {
    if (e.part.partKind === PART_KIND_MONOLITH_BODY) {
      throw new Error("multipart sync: MONOLITH_BODY must not appear in composition (ADR 0008)");
    }
  }

  const partStatus = mapInstrumentStatusToPartStatus(params.instrumentStatus);
  await tx.part.updateMany({
    where: { id: { in: entries.map((e) => e.partId) } },
    data: { partStatus },
  });

  for (const e of entries) {
    const md = params.partMarkdownByPartId.get(e.partId);
    if (md === undefined) {
      throw new Error(`multipart sync: missing markdown for part ${e.partId}`);
    }
    await tx.partVersion.upsert({
      where: {
        instrumentVersionId_partId: {
          instrumentVersionId: params.instrumentVersion.id,
          partId: e.partId,
        },
      },
      create: {
        partId: e.partId,
        instrumentVersionId: params.instrumentVersion.id,
        contentHash: params.instrumentVersion.contentHash,
        ordinal: e.position,
        markdownBody: md,
      },
      update: {
        contentHash: params.instrumentVersion.contentHash,
        ordinal: e.position,
        markdownBody: md,
      },
    });
  }
}

export type CompositionPartRow = {
  position: number;
  partId: string;
  partKind: string;
  /** DocHUB-shaped Part lifecycle (ADR 0004). */
  partStatus: string;
  /** `InstrumentVersion.id` when this Part has a `PartVersion` row for the instrument head. */
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
