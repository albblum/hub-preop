import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addInstrumentCompositionPart, getInstrumentById } from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { addInstrumentPartBodySchema } from "@/lib/validation/instrument";
import { canAppendContent } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

type RouteContext = { params: Promise<{ id: string }> };

/** ADR 0008 — add SECTION/ANNEX Part + composition row (new instrument revision). */
export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canAppendContent(session.user.roles)) {
    return jsonForbidden("Insufficient role to add instrument parts");
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = addInstrumentPartBodySchema.safeParse(body);
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
    const updated = await addInstrumentCompositionPart({
      instrumentId: id,
      partKind: parsed.data.partKind,
      initialMarkdown: parsed.data.initialMarkdown,
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
