import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appendMultipartInstrumentVersion } from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { appendMultipartVersionBodySchema } from "@/lib/validation/instrument";
import { canAppendContent } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { instrumentDetailToDocHubShape, resolveInstrumentDetail } from "@/lib/doc-hub-facade";

type RouteContext = { params: Promise<{ docId: string }> };

/**
 * DocHUB v0 — append multi-Part (ADR 0010). Mirrors POST /api/instruments/[id]/versions/multipart;
 * path accepts cuid or idrRef.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }

  const { docId } = await context.params;
  const detail = await resolveInstrumentDetail(docId);
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }
  if (
    !canAppendContent(
      session.user.roles,
      session.user.committeeMemberships,
      detail.committeeId ?? null,
    )
  ) {
    return jsonForbidden("Insufficient role to update content");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = appendMultipartVersionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await appendMultipartInstrumentVersion({
      instrumentId: detail.id,
      bodiesByPartId: parsed.data.bodiesByPartId,
      revisionNote: parsed.data.revisionNote,
    });
    return NextResponse.json(instrumentDetailToDocHubShape(updated));
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
