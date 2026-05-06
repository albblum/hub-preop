import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listLedgerEntries } from "@/lib/instrument-service";
import { ledgerEntryToDocHub, resolveInstrumentDetail } from "@/lib/doc-hub-facade";
import { canViewOperationalQueues } from "@/lib/rbac";
import { jsonForbidden } from "@/lib/api-http";

/**
 * DocHUB SS 9 — `GET /ledger/entries?doc_id=` (facade).
 * Accepts `doc_id` or `docId` (same value: cuid or `idrRef`).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!canViewOperationalQueues(session?.user?.roles)) {
    return jsonForbidden("Ledger requires registrar, reviewer, or admin session");
  }

  const url = new URL(request.url);
  const docKey = url.searchParams.get("doc_id") ?? url.searchParams.get("docId");
  if (!docKey?.trim()) {
    return NextResponse.json(
      { error: "Query doc_id (or docId) is required", code: "MISSING_DOC_ID" },
      { status: 400 },
    );
  }

  const detail = await resolveInstrumentDetail(docKey.trim());
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  const entries = await listLedgerEntries(detail.id);
  return NextResponse.json({
    docId: detail.idrRef,
    idrRef: detail.idrRef,
    instrumentId: detail.id,
    count: entries.length,
    entries: entries.map(ledgerEntryToDocHub),
  });
}
