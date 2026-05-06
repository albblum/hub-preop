import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { stableStringify } from "@/lib/integrity/stable-json";
import { redactInstrumentContent, type ExportMode } from "@/lib/audit/export-redaction";

export const MAX_EXPORT_INSTRUMENTS = 500;

export type CreateAuditExportOptions = {
  mode: ExportMode;
  requestedBy: string | null;
  idrRefs?: string[];
  instrumentIds?: string[];
};

function hashManifestPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(payload), "utf8").digest("hex");
}

export async function createAuditExport(opts: CreateAuditExportOptions) {
  const hasFilter =
    (opts.idrRefs && opts.idrRefs.length > 0) ||
    (opts.instrumentIds && opts.instrumentIds.length > 0);

  const where = opts.instrumentIds?.length
    ? { id: { in: opts.instrumentIds } }
    : opts.idrRefs?.length
      ? { idrRef: { in: opts.idrRefs } }
      : {};

  const instruments = await prisma.instrument.findMany({
    where,
    take: MAX_EXPORT_INSTRUMENTS + 1,
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { orderBy: { version: "asc" } },
      events: { orderBy: { at: "asc" } },
    },
  });

  if (!hasFilter && instruments.length > MAX_EXPORT_INSTRUMENTS) {
    throw new Error(
      `Refusing unscoped export over ${MAX_EXPORT_INSTRUMENTS} instruments; narrow idrRefs/instrumentIds.`,
    );
  }

  if (instruments.length > MAX_EXPORT_INSTRUMENTS) {
    throw new Error(`Export limit exceeded (max ${MAX_EXPORT_INSTRUMENTS} instruments).`);
  }

  const createdAt = new Date().toISOString();
  const scope = {
    mode: opts.mode,
    idrRefs: opts.idrRefs ?? null,
    instrumentIds: opts.instrumentIds ?? null,
    instrumentCount: instruments.length,
  };

  const manifestForHash = {
    exportSchemaVersion: "1",
    createdAt,
    scope,
  };
  const contentHash = hashManifestPayload(manifestForHash);

  const record = await prisma.exportManifest.create({
    data: {
      scopeDescription: stableStringify(scope),
      requestedBy: opts.requestedBy,
      contentHash,
    },
  });

  const manifest = {
    ...manifestForHash,
    id: record.id,
    contentHash,
  };

  const data = instruments.map((inst) => ({
    idrRef: inst.idrRef,
    id: inst.id,
    title: inst.title,
    layer: inst.layer,
    status: inst.status,
    versions: inst.versions.map((v) => ({
      version: v.version,
      contentHash: v.contentHash,
      previousContentHash: v.previousContentHash,
      content: redactInstrumentContent(opts.mode, inst.layer, v.content),
      revisionNote: v.revisionNote,
      createdAt: v.createdAt.toISOString(),
    })),
    transitionEvents: inst.events.map((e) => ({
      id: e.id,
      at: e.at.toISOString(),
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      actorKind: e.actorKind,
      actorLabel: e.actorLabel,
      actorExternalId: e.actorExternalId,
      actor: e.actor,
      note: e.note,
    })),
  }));

  return {
    exportId: record.id,
    manifest,
    body: data,
    jsonl: data.map((row) => JSON.stringify(row)).join("\n"),
  };
}
