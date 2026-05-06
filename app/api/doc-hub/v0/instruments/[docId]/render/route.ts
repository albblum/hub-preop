import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveInstrumentDetail } from "@/lib/doc-hub-facade";
import { canUseExportMode } from "@/lib/rbac";
import { defaultExportMode, redactInstrumentContent, type ExportMode } from "@/lib/audit/export-redaction";
import { jsonForbidden } from "@/lib/api-http";

type RouteContext = { params: Promise<{ docId: string }> };

function parseMode(raw: string | null): ExportMode | null {
  const v = raw?.trim();
  if (!v) return "public";
  if (v === "public" || v === "registered" || v === "restricted") return v;
  return null;
}

/**
 * DocHUB SS 9 — `GET /instruments/{doc_id}/render` (facade).
 * Current head Markdown in JSON; redaction tiers match `/api/instruments/[id]/as-of` (`mode` query).
 */
export async function GET(request: Request, context: RouteContext) {
  const { docId } = await context.params;
  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get("mode")) ?? defaultExportMode(url.searchParams.get("mode"));

  const session = await auth();
  if (!canUseExportMode(session?.user?.roles, mode)) {
    return jsonForbidden("Requested mode not allowed for current role");
  }

  const detail = await resolveInstrumentDetail(docId);
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  const version = detail.currentVersionRecord;
  if (!version) {
    return NextResponse.json({ error: "No current version" }, { status: 404 });
  }

  const raw = version.content;
  const content = redactInstrumentContent(mode, detail.layer, raw);

  return NextResponse.json({
    docId: detail.idrRef,
    idrRef: detail.idrRef,
    instrumentId: detail.id,
    format: "markdown",
    mode,
    version: version.version,
    instrumentVersionId: version.id,
    contentHash: version.contentHash,
    content,
  });
}
