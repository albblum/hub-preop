import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appendMultipartInstrumentVersion, getInstrumentById } from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { appendMultipartVersionBodySchema } from "@/lib/validation/instrument";
import { canAppendContent } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

type RouteContext = { params: Promise<{ id: string }> };

/** ADR 0008 — append version with per-Part markdown map (multi-part profile only). */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canAppendContent(session.user.roles)) {
    return jsonForbidden("Insufficient role to update content");
  }

  const { id } = await context.params;

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

  const inst = await getInstrumentById(id);
  if (!inst) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  try {
    const updated = await appendMultipartInstrumentVersion({
      instrumentId: id,
      bodiesByPartId: parsed.data.bodiesByPartId,
      revisionNote: parsed.data.revisionNote,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
