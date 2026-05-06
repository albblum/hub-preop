import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAuditExport } from "@/lib/audit/export-service";
import { defaultExportMode } from "@/lib/audit/export-redaction";
import { resolveRequestedBy } from "@/lib/actor-from-request";
import { auditExportBodySchema } from "@/lib/validation/instrument";
import { canUseExportMode } from "@/lib/rbac";
import { jsonForbidden } from "@/lib/api-http";

function parseCommaList(raw: string | null): string[] | undefined {
  if (!raw || raw.trim() === "") return undefined;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function GET(request: Request) {
  const session = await auth();
  const url = new URL(request.url);
  const mode = defaultExportMode(url.searchParams.get("mode"));
  if (!canUseExportMode(session?.user?.roles, mode)) {
    return jsonForbidden("Export mode not allowed for current role");
  }
  const idrRefs = parseCommaList(url.searchParams.get("idrRefs"));
  const instrumentIds = parseCommaList(url.searchParams.get("instrumentIds"));
  const requestedBy = resolveRequestedBy(request, url.searchParams.get("requestedBy"), session);

  try {
    const result = await createAuditExport({
      mode,
      requestedBy,
      idrRefs,
      instrumentIds,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    const status = msg.includes("limit") || msg.includes("Refusing") ? 400 : 500;
    return NextResponse.json({ error: msg, code: "EXPORT_FAILED" }, { status });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = auditExportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const mode = parsed.data.mode ?? "public";
  if (!canUseExportMode(session?.user?.roles, mode)) {
    return jsonForbidden("Export mode not allowed for current role");
  }
  const requestedBy = resolveRequestedBy(request, parsed.data.requestedBy ?? null, session);

  try {
    const result = await createAuditExport({
      mode,
      requestedBy,
      idrRefs: parsed.data.idrRefs,
      instrumentIds: parsed.data.instrumentIds,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    const status = msg.includes("limit") || msg.includes("Refusing") ? 400 : 500;
    return NextResponse.json({ error: msg, code: "EXPORT_FAILED" }, { status });
  }
}
