import type { LedgerEntry } from "@prisma/client";
import {
  getInstrumentById,
  getInstrumentByIdrRef,
  type InstrumentDetail,
} from "@/lib/instrument-service";
import {
  findInstrumentIdForClause,
  loadResolvedClause,
  loadV2SectionsSummary,
} from "@/lib/normative/read-v2-instrument";
import { resolveIdrRef } from "@/lib/normative/resolve-idr-ref";
import { prisma } from "@/lib/prisma";

/**
 * DocHUB-shaped read facade (ADR 0005).
 * Path/query `{doc_id}` accepts internal instrument **id** (cuid), canonical **idrRef**,
 * semantic `idr:c:*`, legacy `idr:HUB-INSTR-*` (alias), or clause-level idrRef.
 */
export async function resolveInstrumentDetail(docIdParam: string): Promise<InstrumentDetail | null> {
  const resolved = await resolveIdrRef(docIdParam);
  if (resolved) {
    if (resolved.ownerKind === "instrument") {
      return getInstrumentById(resolved.ownerId);
    }
    if (resolved.ownerKind === "clause") {
      const instrumentId = await findInstrumentIdForClause(prisma, resolved.ownerId);
      if (!instrumentId) return null;
      const detail = await getInstrumentById(instrumentId);
      if (!detail) return null;
      const clause = await loadResolvedClause(prisma, resolved.ownerId);
      if (!clause) return null;
      return {
        ...detail,
        resolvedClause: {
          idrRef: clause.idrRef,
          body: clause.body,
          nonNormative: clause.nonNormative || undefined,
        },
      };
    }
  }

  const byId = await getInstrumentById(docIdParam);
  if (byId) return byId;
  return getInstrumentByIdrRef(docIdParam);
}

/** MVP: `docId` mirrors institutional reference — same string as `idrRef` (ADR 0001 / 0005). */
export function withDocHubIdentifiers<T extends { id: string; idrRef: string }>(row: T): T & {
  docId: string;
  instrumentId: string;
} {
  return {
    ...row,
    docId: row.idrRef,
    instrumentId: row.id,
  };
}

export async function instrumentDetailToDocHubShape(detail: InstrumentDetail) {
  const base = withDocHubIdentifiers(detail);

  let sectionsSummary:
    | Array<{
        code: string;
        position: number;
        nonNormative: boolean;
        migrationPhase: string | null;
      }>
    | undefined;

  if (detail.structuralProfile === "v2") {
    sectionsSummary = await loadV2SectionsSummary(prisma, detail.id);
  }

  return {
    ...base,
    structuralProfile: detail.structuralProfile,
    semanticDocumentCode: detail.semanticDocumentCode ?? undefined,
    terminationDate: detail.terminationDate?.toISOString().slice(0, 10) ?? undefined,
    terminationRequiresExplicitAct: detail.terminationRequiresExplicitAct,
    terminationAuthorizedBy: detail.terminationAuthorizedBy ?? undefined,
    terminationConditions: detail.terminationConditions?.length
      ? detail.terminationConditions
      : undefined,
    sectionsSummary,
    resolvedClause: detail.resolvedClause,
    parent: detail.parent
      ? {
          ...detail.parent,
          docId: detail.parent.idrRef,
          instrumentId: detail.parent.id,
        }
      : null,
  };
}

export type LedgerEntryDocHub = ReturnType<typeof ledgerEntryToDocHub>;

export function ledgerEntryToDocHub(entry: LedgerEntry) {
  return {
    entryId: entry.id,
    sequence: entry.sequence,
    previousEntryId: entry.previousEntryId,
    entryType: entry.entryType,
    payloadHash: entry.payloadHash,
    docId: entry.idrRef,
    idrRef: entry.idrRef,
    instrumentId: entry.instrumentId,
    instrumentVersionId: entry.instrumentVersionId,
    transitionEventId: entry.transitionEventId,
    createdAt: entry.createdAt.toISOString(),
  };
}
