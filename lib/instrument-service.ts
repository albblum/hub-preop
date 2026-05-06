import type { ActorKind, Instrument, InstrumentVersion, LedgerEntry, TransitionEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isParentDerivationValid } from "@/lib/domain/derivation";
import { resolveTransitionTarget } from "@/lib/domain/transition-policy";
import { DomainError } from "@/lib/domain/transitions";
import { IntegrityViolationError } from "@/lib/domain/integrity";
import { isCanonicalStatus } from "@/lib/domain/canonical-status";
import { computeContentHash, verifyContentHash } from "@/lib/integrity/content-hash";
import { pickVersionAt, resolveStatusAt } from "@/lib/integrity/as-of";
import { appendTransitionLedger, appendVersionLedger } from "@/lib/ledger/append-ledger";
import { PART_KIND_MONOLITH_BODY, syncMonolithicPartForInstrumentVersion } from "@/lib/part-composition";
import { mapInstrumentStatusToPartStatus } from "@/lib/domain/part-status";

const INITIAL_STATUS = "draft";

function formatIdrRef(seq: number): string {
  return `idr:HUB-INSTR-${String(seq).padStart(8, "0")}`;
}

export async function allocateIdrRef(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "IdrSequence" ("key", "next")
      VALUES ('instrument', 0)
      ON CONFLICT ("key") DO NOTHING
    `;
    const rows = await tx.$queryRaw<Array<{ next: number }>>`
      UPDATE "IdrSequence"
      SET "next" = "next" + 1
      WHERE "key" = 'instrument'
      RETURNING "next"
    `;
    const n = rows[0]?.next;
    if (n === undefined) {
      throw new Error("idr:ref sequence allocation failed");
    }
    return formatIdrRef(n);
  });
}

export type CreateInstrumentInput = {
  title: string;
  layer: number;
  draftingAuthority?: string | null;
  content?: string | null;
  parentInstrumentId?: string | null;
};

export async function createInstrument(input: CreateInstrumentInput): Promise<Instrument> {
  const { title, layer, draftingAuthority, content, parentInstrumentId } = input;

  let parent: Instrument | null = null;
  if (parentInstrumentId) {
    parent = await prisma.instrument.findUnique({
      where: { id: parentInstrumentId },
    });
    if (!parent) {
      throw new DomainError(`Parent instrument not found: ${parentInstrumentId}`);
    }
  }

  if (!isParentDerivationValid(layer, parent)) {
    throw new DomainError(
      "Invalid derivation: layer 0 must have no parent; layer > 0 requires parent.layer < child.layer.",
    );
  }

  const idrRef = await allocateIdrRef();
  const body = content ?? "";
  const v1hash = computeContentHash(1, body);

  return prisma.$transaction(async (tx) => {
    const inst = await tx.instrument.create({
      data: {
        idrRef,
        title,
        layer,
        status: INITIAL_STATUS,
        draftingAuthority: draftingAuthority ?? null,
        currentVersion: 1,
        parentInstrumentId: parent?.id ?? null,
      },
    });

    const v1 = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: 1,
        content: body,
        contentHash: v1hash,
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: null,
      },
    });

    if (!verifyContentHash(v1)) {
      throw new IntegrityViolationError("Version 1 contentHash verification failed after insert");
    }

    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: v1,
      instrumentStatus: INITIAL_STATUS,
    });

    const updated = await tx.instrument.update({
      where: { id: inst.id },
      data: { currentVersionRecordId: v1.id },
    });

    await appendVersionLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      version: { id: v1.id, contentHash: v1.contentHash },
    });

    return updated;
  });
}

export type InstrumentDetail = Instrument & {
  currentVersionRecord: InstrumentVersion | null;
  parent: Pick<Instrument, "id" | "idrRef" | "layer" | "title" | "status"> | null;
  versions: Pick<
    InstrumentVersion,
    | "id"
    | "version"
    | "contentHash"
    | "previousContentHash"
    | "supersedesVersion"
    | "revisionNote"
    | "createdAt"
  >[];
  events: TransitionEvent[];
  /** MONOLITH_BODY Part(s); MVP expects at most one row (ADR 0004). */
  parts: { id: string; partKind: string; partStatus: string }[];
};

export async function getInstrumentById(id: string): Promise<InstrumentDetail | null> {
  const row = await prisma.instrument.findUnique({
    where: { id },
    include: {
      currentVersionRecord: true,
      parent: {
        select: { id: true, idrRef: true, layer: true, title: true, status: true },
      },
      versions: {
        select: {
          id: true,
          version: true,
          contentHash: true,
          previousContentHash: true,
          supersedesVersion: true,
          revisionNote: true,
          createdAt: true,
        },
        orderBy: { version: "asc" },
      },
      events: { orderBy: { at: "asc" } },
      parts: {
        where: { partKind: PART_KIND_MONOLITH_BODY },
        select: { id: true, partKind: true, partStatus: true },
        take: 1,
      },
    },
  });
  return row;
}

export async function getInstrumentByIdrRef(idrRef: string): Promise<InstrumentDetail | null> {
  const row = await prisma.instrument.findUnique({
    where: { idrRef },
    include: {
      currentVersionRecord: true,
      parent: {
        select: { id: true, idrRef: true, layer: true, title: true, status: true },
      },
      versions: {
        select: {
          id: true,
          version: true,
          contentHash: true,
          previousContentHash: true,
          supersedesVersion: true,
          revisionNote: true,
          createdAt: true,
        },
        orderBy: { version: "asc" },
      },
      events: { orderBy: { at: "asc" } },
      parts: {
        where: { partKind: PART_KIND_MONOLITH_BODY },
        select: { id: true, partKind: true, partStatus: true },
        take: 1,
      },
    },
  });
  return row;
}

export async function listInstruments(options?: {
  skip?: number;
  take?: number;
  status?: string;
  /** Layer filter (DocHUB SS 9 list instruments); omni when omitted. */
  layer?: number;
}) {
  const skip = options?.skip ?? 0;
  const take = Math.min(options?.take ?? 50, 100);
  const where: { status?: string; layer?: number } = {};
  if (options?.status) where.status = options.status;
  if (options?.layer !== undefined) where.layer = options.layer;
  const [items, total] = await prisma.$transaction([
    prisma.instrument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        idrRef: true,
        title: true,
        layer: true,
        status: true,
        draftingAuthority: true,
        currentVersion: true,
        parentInstrumentId: true,
        parent: { select: { idrRef: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.instrument.count({ where }),
  ]);
  return { items, total, skip, take };
}

function groupAllCount(row: { _count: unknown }): number {
  const c = row._count;
  if (typeof c === "number") return c;
  if (c && typeof c === "object" && "_all" in c && typeof (c as { _all: unknown })._all === "number") {
    return (c as { _all: number })._all;
  }
  return 0;
}

export async function instrumentAggregates(): Promise<{
  byLayer: Array<{ layer: number; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}> {
  const [byLayerRaw, byStatusRaw] = await prisma.$transaction([
    prisma.instrument.groupBy({
      by: ["layer"],
      _count: { _all: true },
      orderBy: { layer: "asc" },
    }),
    prisma.instrument.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
  ]);
  return {
    byLayer: byLayerRaw.map((r) => ({ layer: r.layer, count: groupAllCount(r) })),
    byStatus: byStatusRaw.map((r) => ({ status: r.status, count: groupAllCount(r) })),
  };
}

/** Append-only ledger slice for one instrument (sequence order). */
export async function listLedgerEntries(instrumentId: string): Promise<LedgerEntry[]> {
  return prisma.ledgerEntry.findMany({
    where: { instrumentId },
    orderBy: [{ sequence: "asc" }],
  });
}

export async function listRecentTransitionEvents(take: number) {
  const n = Math.min(Math.max(take, 1), 100);
  return prisma.transitionEvent.findMany({
    orderBy: [{ at: "desc" }, { id: "desc" }],
    take: n,
    include: {
      instrument: { select: { idrRef: true, title: true } },
    },
  });
}

export type TransitionInput = {
  instrumentId: string;
  toStatus: string;
  actor?: string | null;
  note?: string | null;
  actorKind?: ActorKind;
  actorLabel?: string | null;
  actorExternalId?: string | null;
};

export async function transitionInstrument(input: TransitionInput): Promise<InstrumentDetail> {
  const { instrumentId, actor, note } = input;
  if (!isCanonicalStatus(input.toStatus)) {
    throw new DomainError(`Unknown canonical status: ${input.toStatus}`);
  }

  const current = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: {
      id: true,
      idrRef: true,
      status: true,
      layer: true,
      parentInstrumentId: true,
      parent: { select: { layer: true } },
    },
  });

  if (!current) {
    throw new DomainError("Instrument not found");
  }

  const parentForPolicy =
    current.parentInstrumentId && current.parent != null
      ? { layer: current.parent.layer }
      : null;

  const resolved = resolveTransitionTarget({
    fromStatus: current.status,
    requestedTo: input.toStatus,
    layer: current.layer,
    parent: parentForPolicy,
  });

  const toStatus = resolved.toStatus;
  const gateNote = resolved.note;

  const actorKind = input.actorKind ?? (actor || input.actorLabel ? "human" : "system");
  const actorLabel = input.actorLabel ?? actor ?? null;

  await prisma.$transaction(async (tx) => {
    const ev = await tx.transitionEvent.create({
      data: {
        instrumentId: current.id,
        fromStatus: current.status,
        toStatus,
        actor: actorLabel,
        actorKind,
        actorLabel,
        actorExternalId: input.actorExternalId ?? null,
        note: [note, gateNote].filter(Boolean).join(" | ") || null,
      },
    });

    await tx.instrument.update({
      where: { id: current.id },
      data: { status: toStatus },
    });

    await appendTransitionLedger(tx, {
      instrument: { id: current.id, idrRef: current.idrRef },
      event: ev,
    });

    const partStatus = mapInstrumentStatusToPartStatus(toStatus);
    await tx.part.updateMany({
      where: {
        instrumentId: current.id,
        partKind: PART_KIND_MONOLITH_BODY,
      },
      data: { partStatus },
    });
  });

  const detail = await getInstrumentById(current.id);
  if (!detail) throw new Error("Instrument disappeared after transition");
  return detail;
}

export type AppendVersionInput = {
  instrumentId: string;
  content: string;
  revisionNote?: string | null;
};

export async function appendInstrumentVersion(
  input: AppendVersionInput,
): Promise<InstrumentDetail> {
  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
    include: { currentVersionRecord: true },
  });

  if (!inst?.currentVersionRecord) {
    throw new DomainError("Instrument not found or has no current version");
  }

  const nextVersion = inst.currentVersion + 1;
  const prevVersion = inst.currentVersion;
  const prevHash = inst.currentVersionRecord.contentHash;
  const newHash = computeContentHash(nextVersion, input.content);

  await prisma.$transaction(async (tx) => {
    const ver = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: nextVersion,
        content: input.content,
        contentHash: newHash,
        previousContentHash: prevHash,
        supersedesVersion: prevVersion,
        revisionNote: input.revisionNote ?? null,
      },
    });

    if (!verifyContentHash(ver)) {
      throw new IntegrityViolationError("New version contentHash verification failed after insert");
    }
    if (ver.previousContentHash !== prevHash) {
      throw new IntegrityViolationError("Version chain link does not match prior contentHash");
    }

    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: ver,
      instrumentStatus: inst.status,
    });

    await tx.instrument.update({
      where: { id: inst.id },
      data: {
        currentVersion: nextVersion,
        currentVersionRecordId: ver.id,
      },
    });

    await appendVersionLedger(tx, {
      instrument: { id: inst.id, idrRef: inst.idrRef },
      version: { id: ver.id, contentHash: ver.contentHash },
    });
  });

  const detail = await getInstrumentById(inst.id);
  if (!detail) throw new Error("Instrument disappeared after version append");
  return detail;
}

export type AsOfVersionResult = {
  instrument: Pick<
    Instrument,
    "id" | "idrRef" | "title" | "layer" | "parentInstrumentId" | "createdAt"
  >;
  statusAt: string;
  version: InstrumentVersion;
  transitionEventsAtOrBefore: Pick<
    TransitionEvent,
    "id" | "at" | "fromStatus" | "toStatus" | "actorKind" | "actorLabel" | "note"
  >[];
};

export async function getAsOfByVersionNumber(
  instrumentId: string,
  versionNum: number,
): Promise<AsOfVersionResult | null> {
  const inst = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: {
      id: true,
      idrRef: true,
      title: true,
      layer: true,
      parentInstrumentId: true,
      createdAt: true,
    },
  });
  if (!inst) return null;

  const ver = await prisma.instrumentVersion.findUnique({
    where: { instrumentId_version: { instrumentId, version: versionNum } },
  });
  if (!ver) return null;

  if (!verifyContentHash(ver)) {
    throw new IntegrityViolationError("Stored contentHash does not match content for this version");
  }

  const events = await prisma.transitionEvent.findMany({
    where: { instrumentId, at: { lte: ver.createdAt } },
    orderBy: [{ at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      at: true,
      fromStatus: true,
      toStatus: true,
      actorKind: true,
      actorLabel: true,
      note: true,
    },
  });

  const statusAt = resolveStatusAt(events, ver.createdAt);

  return {
    instrument: inst,
    statusAt,
    version: ver,
    transitionEventsAtOrBefore: events,
  };
}

export async function getAsOfByTimestamp(
  instrumentId: string,
  at: Date,
): Promise<AsOfVersionResult | null> {
  const inst = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: {
      id: true,
      idrRef: true,
      title: true,
      layer: true,
      parentInstrumentId: true,
      createdAt: true,
    },
  });
  if (!inst) return null;

  const versions = await prisma.instrumentVersion.findMany({
    where: { instrumentId },
    orderBy: { version: "asc" },
  });

  const picked = pickVersionAt(versions, at);
  if (!picked) {
    return null;
  }

  if (!verifyContentHash(picked)) {
    throw new IntegrityViolationError("Stored contentHash does not match content");
  }

  const events = await prisma.transitionEvent.findMany({
    where: { instrumentId, at: { lte: at } },
    orderBy: [{ at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      at: true,
      fromStatus: true,
      toStatus: true,
      actorKind: true,
      actorLabel: true,
      note: true,
    },
  });

  const statusAt = resolveStatusAt(events, at);

  return {
    instrument: inst,
    statusAt,
    version: picked,
    transitionEventsAtOrBefore: events,
  };
}
