import type { LedgerEntry } from "@prisma/client";
import {
  getInstrumentById,
  getInstrumentByIdrRef,
  type InstrumentDetail,
} from "@/lib/instrument-service";

/**
 * DocHUB-shaped read facade (ADR 0005).
 * Path/query `{doc_id}` accepts internal instrument **id** (cuid) or canonical **idrRef**.
 */
export async function resolveInstrumentDetail(docIdParam: string): Promise<InstrumentDetail | null> {
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

export function instrumentDetailToDocHubShape(detail: InstrumentDetail) {
  const base = withDocHubIdentifiers(detail);
  return {
    ...base,
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
