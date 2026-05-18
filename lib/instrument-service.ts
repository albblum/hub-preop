import type {
  ActorKind,
  Instrument,
  InstrumentVersion,
  LedgerEntry,
  Prisma,
  PrismaClient,
  TransitionEvent,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isParentDerivationValid } from "@/lib/domain/derivation";
import { resolveTransitionTarget } from "@/lib/domain/transition-policy";
import { DomainError } from "@/lib/domain/transitions";
import { IntegrityViolationError } from "@/lib/domain/integrity";
import { isCanonicalStatus } from "@/lib/domain/canonical-status";
import { computeContentHash, verifyContentHash } from "@/lib/integrity/content-hash";
import { pickVersionAt, resolveStatusAt } from "@/lib/integrity/as-of";
import { appendTransitionLedger, appendVersionLedger } from "@/lib/ledger/append-ledger";
import {
  PART_KIND_ANNEX,
  PART_KIND_MONOLITH_BODY,
  PART_KIND_SECTION,
  assembleInstrumentMarkdown,
  isMonolithCompositionProfile,
  syncMonolithicPartForInstrumentVersion,
  syncMultipartPartVersionsForInstrumentVersion,
  validateMultipartSegmentPositions,
} from "@/lib/part-composition";
import { mapInstrumentStatusToPartStatus } from "@/lib/domain/part-status";
import {
  aggregateInstrumentReadFallback,
  isDerivedHead,
} from "@/lib/normative/aggregate-instrument";
import { assertV1WritePath } from "@/lib/domain/v2-write-guards";

const INITIAL_STATUS = "draft";

type DbClient = Prisma.TransactionClient | PrismaClient;

export type TransitionMonolithToMultipartDryRunResult = {
  dryRun: true;
  report: {
    instrumentId: string;
    currentVersionRecordId: string;
    monolithPartId: string;
    contentLength: number;
    contentHash: string;
  };
};

type MonolithTransitionContext = {
  instrument: Instrument & { currentVersionRecord: InstrumentVersion | null };
  head: InstrumentVersion;
  monolithPartId: string;
};

async function loadMonolithTransitionContext(
  db: DbClient,
  instrumentId: string,
): Promise<MonolithTransitionContext> {
  const instrument = await db.instrument.findUnique({
    where: { id: instrumentId },
    include: { currentVersionRecord: true },
  });
  if (!instrument) {
    throw new DomainError("Instrument not found", "INSTRUMENT_NOT_FOUND");
  }
  const head = instrument.currentVersionRecord;
  if (!head) {
    throw new DomainError(
      "Instrument has no current version",
      "NO_CURRENT_VERSION",
    );
  }
  if (!verifyContentHash(head)) {
    throw new IntegrityViolationError(
      "Stored contentHash does not match content for head version",
    );
  }

  const entries = await db.compositionEntry.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    include: { part: true },
  });
  const eligible =
    entries.length === 1 &&
    entries[0].position === 1 &&
    entries[0].part.partKind === PART_KIND_MONOLITH_BODY;

  if (!eligible) {
    const isMono = await isMonolithCompositionProfile(db, instrumentId);
    if (!isMono) {
      throw new DomainError(
        "Instrument is already on multi-part profile (ADR 0009)",
        "ALREADY_MULTIPART_PROFILE",
      );
    }
    throw new DomainError(
      "Instrument does not meet monolith transition preconditions (exactly one MONOLITH_BODY composition entry at position 1)",
      "MONOLITH_TRANSITION_PRECONDITION_FAILED",
    );
  }

  const monolithPartId = entries[0].partId;
  const monoPv = await db.partVersion.findUnique({
    where: {
      instrumentVersionId_partId: {
        instrumentVersionId: head.id,
        partId: monolithPartId,
      },
    },
  });
  if (!monoPv || monoPv.markdownBody !== null) {
    throw new DomainError(
      "Current head PartVersion for MONOLITH_BODY must exist with markdownBody null",
      "MONOLITH_TRANSITION_PRECONDITION_FAILED",
    );
  }

  return { instrument, head, monolithPartId };
}

/** ADR 0009 — controlled monolith → minimal multi-part (one SECTION at position 1). */
export async function transitionMonolithToMultipartProfile(input: {
  instrumentId: string;
  dryRun?: boolean;
}): Promise<InstrumentDetail | TransitionMonolithToMultipartDryRunResult> {
  const { instrumentId, dryRun } = input;

  const profileRow = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: { structuralProfile: true },
  });
  if (!profileRow) {
    throw new DomainError("Instrument not found", "INSTRUMENT_NOT_FOUND");
  }
  assertV1WritePath(profileRow.structuralProfile, "transitionMonolithToMultipart");

  const ctx = await loadMonolithTransitionContext(prisma, instrumentId);

  if (dryRun) {
    return {
      dryRun: true,
      report: {
        instrumentId: ctx.instrument.id,
        currentVersionRecordId: ctx.head.id,
        monolithPartId: ctx.monolithPartId,
        contentLength: ctx.head.content.length,
        contentHash: ctx.head.contentHash,
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    const inner = await loadMonolithTransitionContext(tx, instrumentId);
    const partStatus = mapInstrumentStatusToPartStatus(inner.instrument.status);

    const sectionPart = await tx.part.create({
      data: {
        instrumentId,
        partKind: PART_KIND_SECTION,
        partStatus,
      },
    });

    await tx.partVersion.create({
      data: {
        partId: sectionPart.id,
        instrumentVersionId: inner.head.id,
        contentHash: inner.head.contentHash,
        ordinal: 1,
        markdownBody: inner.head.content,
      },
    });

    await tx.compositionEntry.delete({
      where: {
        instrumentId_position: {
          instrumentId,
          position: 1,
        },
      },
    });

    await tx.compositionEntry.create({
      data: {
        instrumentId,
        partId: sectionPart.id,
        position: 1,
      },
    });

    await tx.partVersion.delete({
      where: {
        instrumentVersionId_partId: {
          instrumentVersionId: inner.head.id,
          partId: inner.monolithPartId,
        },
      },
    });
  });

  const detail = await getInstrumentById(instrumentId);
  if (!detail) {
    throw new Error("Instrument disappeared after transition");
  }
  return detail;
}

/** Feature flag for ADR 0009 transition (HTTP route and CLI gate). */
export function isMonolithToMultipartTransitionEnabled(): boolean {
  const v = process.env.TRANSITION_MONOLITH_TO_MULTIPART_ENABLED;
  if (v === undefined || v === "") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true";
}

function formatIdrRef(seq: number): string {
  return `idr:HUB-INSTR-${String(seq).padStart(8, "0")}`;
}

/** Legacy v1 instrument creation only — never call for structuralProfile v2. */
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
  documentType?: "constitutional" | "operational" | "institutional" | "generic";
  layer: number;
  draftingAuthority?: string | null;
  content?: string | null;
  parentInstrumentId?: string | null;
};

export async function createInstrument(input: CreateInstrumentInput): Promise<Instrument> {
  const { title, documentType, layer, draftingAuthority, content, parentInstrumentId } = input;

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
        documentType: documentType ?? "generic",
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

export type MultipartSegmentInput = {
  partKind: typeof PART_KIND_SECTION | typeof PART_KIND_ANNEX;
  position: number;
  markdownBody: string;
};

export type CreateMultipartInstrumentInput = {
  title: string;
  documentType?: "constitutional" | "operational" | "institutional" | "generic";
  layer: number;
  draftingAuthority?: string | null;
  parentInstrumentId?: string | null;
  segments: MultipartSegmentInput[];
};

/** ADR 0008 — new instrument with SECTION/ANNEX composition only (no MONOLITH_BODY). */
export async function createMultipartInstrument(
  input: CreateMultipartInstrumentInput,
): Promise<Instrument> {
  const { title, layer, draftingAuthority, parentInstrumentId, segments } = input;
  const { documentType } = input;

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

  const posCheck = validateMultipartSegmentPositions(segments);
  if (!posCheck.ok) {
    throw new DomainError(posCheck.message);
  }

  const kinds = segments.map((s) => s.partKind);
  if (new Set(kinds).size !== kinds.length) {
    throw new DomainError("Duplicate partKind in segments");
  }

  for (const s of segments) {
    if (s.partKind !== PART_KIND_SECTION && s.partKind !== PART_KIND_ANNEX) {
      throw new DomainError(`Invalid partKind for multi-part create: ${s.partKind}`);
    }
  }

  const idrRef = await allocateIdrRef();
  const ordered = [...segments].sort((a, b) => a.position - b.position);
  const aggregated = assembleInstrumentMarkdown(ordered.map((s) => s.markdownBody));
  const v1hash = computeContentHash(1, aggregated);

  return prisma.$transaction(async (tx) => {
    const inst = await tx.instrument.create({
      data: {
        idrRef,
        title,
        documentType: documentType ?? "generic",
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
        content: aggregated,
        contentHash: v1hash,
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: null,
      },
    });

    if (!verifyContentHash(v1)) {
      throw new IntegrityViolationError("Version 1 contentHash verification failed after insert");
    }

    const partStatus = mapInstrumentStatusToPartStatus(INITIAL_STATUS);
    for (const seg of ordered) {
      const part = await tx.part.create({
        data: {
          instrumentId: inst.id,
          partKind: seg.partKind,
          partStatus,
        },
      });
      await tx.compositionEntry.create({
        data: {
          instrumentId: inst.id,
          partId: part.id,
          position: seg.position,
        },
      });
      await tx.partVersion.create({
        data: {
          partId: part.id,
          instrumentVersionId: v1.id,
          contentHash: v1.contentHash,
          ordinal: seg.position,
          markdownBody: seg.markdownBody,
        },
      });
    }

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

async function getPartsOrderedByComposition(
  instrumentId: string,
): Promise<{ id: string; partKind: string; partStatus: string }[]> {
  const entries = await prisma.compositionEntry.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    include: { part: { select: { id: true, partKind: true, partStatus: true } } },
  });
  return entries.map((e) => ({
    id: e.part.id,
    partKind: e.part.partKind,
    partStatus: e.part.partStatus,
  }));
}

/** Per-part markdown for the instrument head revision (multi-part profile only; ADR 0008). */
async function getMultipartSegmentsForCurrentVersion(
  instrumentId: string,
  instrumentVersionId: string,
): Promise<
  Array<{ position: number; partId: string; partKind: string; markdownBody: string }>
> {
  const entries = await prisma.compositionEntry.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    include: { part: { select: { partKind: true } } },
  });
  const partIds = entries.map((e) => e.partId);
  const pvs = await prisma.partVersion.findMany({
    where: {
      instrumentVersionId,
      partId: { in: partIds },
    },
  });
  const mdByPart = new Map(pvs.map((pv) => [pv.partId, pv.markdownBody ?? ""]));
  return entries.map((e) => ({
    position: e.position,
    partId: e.partId,
    partKind: e.part.partKind,
    markdownBody: mdByPart.get(e.partId) ?? "",
  }));
}

async function attachCompositionDetailFields(
  row: {
    id: string;
    structuralProfile: Instrument["structuralProfile"];
    currentVersionRecord: InstrumentVersion | null;
  },
): Promise<{
  parts: { id: string; partKind: string; partStatus: string }[];
  compositionProfile: "monolith" | "multipart";
  multipartSegments?: Array<{
    position: number;
    partId: string;
    partKind: string;
    markdownBody: string;
  }>;
}> {
  if (row.structuralProfile === "v2") {
    return { parts: [], compositionProfile: "monolith" };
  }
  const parts = await getPartsOrderedByComposition(row.id);
  const isMono = await isMonolithCompositionProfile(prisma, row.id);
  const compositionProfile = isMono ? "monolith" : "multipart";
  let multipartSegments:
    | Array<{
        position: number;
        partId: string;
        partKind: string;
        markdownBody: string;
      }>
    | undefined;
  if (!isMono && row.currentVersionRecord) {
    multipartSegments = await getMultipartSegmentsForCurrentVersion(
      row.id,
      row.currentVersionRecord.id,
    );
  }
  return { parts, compositionProfile, multipartSegments };
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
  /** Parts in composition order (monolith or multi-part; ADR 0008). */
  parts: { id: string; partKind: string; partStatus: string }[];
  /** Discriminator for append API: monolith uses POST …/content; multipart uses POST …/versions/multipart. */
  compositionProfile: "monolith" | "multipart";
  /** Set when `compositionProfile === "multipart"` — ordered segments for the current head version. */
  multipartSegments?: Array<{
    position: number;
    partId: string;
    partKind: string;
    markdownBody: string;
  }>;
  /** Set when DocHUB resolves a clause-level idrRef (v2). */
  resolvedClause?: { idrRef: string; body: string; nonNormative?: boolean };
};

async function ensureV2DerivedHead(
  row: Instrument & { currentVersionRecord: InstrumentVersion | null },
): Promise<InstrumentVersion | null> {
  if (row.structuralProfile !== "v2") {
    return row.currentVersionRecord;
  }
  if (isDerivedHead(row.currentVersionRecord)) {
    return row.currentVersionRecord;
  }

  console.warn(
    `[instrument-service] v2 instrument ${row.idrRef} has no derived head; run scripts/aggregate-v2-instruments.ts — using on-read aggregate fallback`,
  );
  const fallback = await aggregateInstrumentReadFallback(row.id);
  const versionNum = row.currentVersionRecord?.version ?? fallback.versionNum;
  return {
    id: row.currentVersionRecord?.id ?? `fallback-${row.id}`,
    instrumentId: row.id,
    version: versionNum,
    content: fallback.content,
    contentHash: fallback.contentHash,
    previousContentHash: row.currentVersionRecord?.previousContentHash ?? null,
    supersedesVersion: row.currentVersionRecord?.supersedesVersion ?? null,
    revisionNote: row.currentVersionRecord?.revisionNote ?? null,
    contentSourceKind: "derived",
    createdAt: row.currentVersionRecord?.createdAt ?? new Date(0),
  };
}

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
    },
  });
  if (!row) return null;
  const head = await ensureV2DerivedHead(row);
  const extra = await attachCompositionDetailFields(row);
  return { ...row, currentVersionRecord: head, ...extra };
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
    },
  });
  if (!row) return null;
  const head = await ensureV2DerivedHead(row);
  const extra = await attachCompositionDetailFields(row);
  return { ...row, currentVersionRecord: head, ...extra };
}

export async function listInstruments(options?: {
  skip?: number;
  take?: number;
  status?: string;
  /** Layer filter (DocHUB SS 9 list instruments); omni when omitted. */
  layer?: number;
  /** Restrict to instruments owned by these committees (workspace). */
  committeeIds?: string[];
  /** Only rows with a comité assignado (espaço de trabalho). Ignored when `committeeIds` is non-empty. */
  onlyCommitteeAssigned?: boolean;
}) {
  const skip = options?.skip ?? 0;
  const take = Math.min(options?.take ?? 50, 100);
  const where: Prisma.InstrumentWhereInput = {};
  if (options?.status) where.status = options.status;
  if (options?.layer !== undefined) where.layer = options.layer;
  if (options?.committeeIds && options.committeeIds.length > 0) {
    where.committeeId = { in: options.committeeIds };
  } else if (options?.onlyCommitteeAssigned) {
    where.committeeId = { not: null };
  }
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
        committeeId: true,
        consultationClosesAt: true,
        consultationOpeningNote: true,
        parent: { select: { idrRef: true } },
        committee: { select: { id: true, code: true } },
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
      documentType: true,
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
    documentType: current.documentType,
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
      where: { instrumentId: current.id },
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

  if (!inst) {
    throw new DomainError("Instrument not found or has no current version");
  }

  assertV1WritePath(inst.structuralProfile, "appendInstrumentVersion");

  if (!inst.currentVersionRecord) {
    throw new DomainError("Instrument not found or has no current version");
  }

  if (!(await isMonolithCompositionProfile(prisma, inst.id))) {
    throw new DomainError(
      "Instrument uses multi-part profile; use POST /api/instruments/{id}/versions/multipart",
    );
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

export type AppendMultipartVersionInput = {
  instrumentId: string;
  bodiesByPartId: Record<string, string>;
  revisionNote?: string | null;
};

export async function appendMultipartInstrumentVersion(
  input: AppendMultipartVersionInput,
): Promise<InstrumentDetail> {
  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
    include: { currentVersionRecord: true },
  });

  if (!inst) {
    throw new DomainError("Instrument not found or has no current version");
  }

  assertV1WritePath(inst.structuralProfile, "appendMultipartInstrumentVersion");

  if (!inst.currentVersionRecord) {
    throw new DomainError("Instrument not found or has no current version");
  }

  if (await isMonolithCompositionProfile(prisma, inst.id)) {
    throw new DomainError(
      "Instrument uses monolithic profile; use POST /api/instruments/{id}/content",
    );
  }

  const entries = await prisma.compositionEntry.findMany({
    where: { instrumentId: inst.id },
    orderBy: { position: "asc" },
  });

  const partMarkdownByPartId = new Map<string, string>();
  const orderedBodies: string[] = [];
  for (const e of entries) {
    const body = input.bodiesByPartId[e.partId];
    if (body === undefined) {
      throw new DomainError(`Missing markdown for part ${e.partId}`);
    }
    partMarkdownByPartId.set(e.partId, body);
    orderedBodies.push(body);
  }

  const content = assembleInstrumentMarkdown(orderedBodies);
  const nextVersion = inst.currentVersion + 1;
  const prevVersion = inst.currentVersion;
  const prevHash = inst.currentVersionRecord.contentHash;
  const newHash = computeContentHash(nextVersion, content);

  await prisma.$transaction(async (tx) => {
    const ver = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: nextVersion,
        content,
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

    await syncMultipartPartVersionsForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: ver,
      instrumentStatus: inst.status,
      partMarkdownByPartId,
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
  if (!detail) throw new Error("Instrument disappeared after multipart version append");
  return detail;
}

export async function addInstrumentCompositionPart(input: {
  instrumentId: string;
  partKind: typeof PART_KIND_SECTION | typeof PART_KIND_ANNEX;
  initialMarkdown?: string | null;
}): Promise<InstrumentDetail> {
  if (await isMonolithCompositionProfile(prisma, input.instrumentId)) {
    throw new DomainError(
      "Cannot add composition parts to a monolithic instrument (ADR 0008)",
    );
  }

  const existingKind = await prisma.part.findUnique({
    where: {
      instrumentId_partKind: {
        instrumentId: input.instrumentId,
        partKind: input.partKind,
      },
    },
  });
  if (existingKind) {
    throw new DomainError(`Part kind ${input.partKind} already exists for this instrument`);
  }

  const inst = await prisma.instrument.findUnique({
    where: { id: input.instrumentId },
    include: { currentVersionRecord: true },
  });
  if (!inst?.currentVersionRecord) {
    throw new DomainError("Instrument not found or has no current version");
  }

  const head = inst.currentVersionRecord;
  const entries = await prisma.compositionEntry.findMany({
    where: { instrumentId: inst.id },
    orderBy: { position: "asc" },
  });
  const pvs = await prisma.partVersion.findMany({
    where: { instrumentVersionId: head.id },
  });
  const byPart = new Map<string, string>();
  for (const pv of pvs) {
    byPart.set(pv.partId, pv.markdownBody ?? "");
  }

  const nextPos = entries.length + 1;
  const initialMd = input.initialMarkdown ?? "";

  await prisma.$transaction(async (tx) => {
    const part = await tx.part.create({
      data: {
        instrumentId: inst.id,
        partKind: input.partKind,
        partStatus: mapInstrumentStatusToPartStatus(inst.status),
      },
    });
    await tx.compositionEntry.create({
      data: {
        instrumentId: inst.id,
        partId: part.id,
        position: nextPos,
      },
    });
    byPart.set(part.id, initialMd);

    const newEntries = await tx.compositionEntry.findMany({
      where: { instrumentId: inst.id },
      orderBy: { position: "asc" },
    });
    const orderedBodies = newEntries.map((e) => {
      const b = byPart.get(e.partId);
      if (b === undefined) {
        throw new IntegrityViolationError(`Missing assembled body for part ${e.partId}`);
      }
      return b;
    });
    const assembled = assembleInstrumentMarkdown(orderedBodies);
    const nextVersion = inst.currentVersion + 1;
    const prevHash = head.contentHash;
    const newHash = computeContentHash(nextVersion, assembled);

    const ver = await tx.instrumentVersion.create({
      data: {
        instrumentId: inst.id,
        version: nextVersion,
        content: assembled,
        contentHash: newHash,
        previousContentHash: prevHash,
        supersedesVersion: inst.currentVersion,
        revisionNote: `add part ${input.partKind}`,
      },
    });

    if (!verifyContentHash(ver)) {
      throw new IntegrityViolationError("New version contentHash verification failed after insert");
    }

    await syncMultipartPartVersionsForInstrumentVersion(tx, {
      instrumentId: inst.id,
      instrumentVersion: ver,
      instrumentStatus: inst.status,
      partMarkdownByPartId: byPart,
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
  if (!detail) throw new Error("Instrument disappeared after add part");
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
        documentType: true,
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
        documentType: true,
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
