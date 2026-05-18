import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { instrumentDetailToDocHubShape, resolveInstrumentDetail } from "@/lib/doc-hub-facade";
import { appendClauseVersionAndReaggregate } from "@/lib/normative/append-clause-and-reaggregate";
import { canAppendContent } from "@/lib/rbac";
import { appendClauseVersionBodySchema } from "@/lib/validation/normative";

type RouteContext = { params: Promise<{ docId: string; clauseId: string }> };

/**
 * DocHUB v0 — clause-level v2 append. Mirrors POST /api/instruments/[id]/clauses/[clauseId]/versions;
 * docId accepts cuid or idrRef.
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }

  const { docId, clauseId } = await context.params;
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

  const parsed = appendClauseVersionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const createdBy = session.user.email ?? session.user.id;

  try {
    const result = await appendClauseVersionAndReaggregate({
      instrumentId: detail.id,
      clauseId,
      body: parsed.data.body,
      revisionNote: parsed.data.revisionNote,
      createdBy,
    });
    return NextResponse.json({
      clauseVersion: result.clauseVersion,
      instrument: await instrumentDetailToDocHubShape(result.instrument),
      aggregate: result.aggregate,
    });
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
