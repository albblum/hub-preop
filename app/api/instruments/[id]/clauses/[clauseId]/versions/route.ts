import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { appendClauseVersionAndReaggregate } from "@/lib/normative/append-clause-and-reaggregate";
import { canAppendContent } from "@/lib/rbac";
import { appendClauseVersionBodySchema } from "@/lib/validation/normative";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; clauseId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }

  const { id, clauseId } = await context.params;

  const inst = await prisma.instrument.findUnique({
    where: { id },
    select: { committeeId: true },
  });
  if (
    !canAppendContent(
      session.user.roles,
      session.user.committeeMemberships,
      inst?.committeeId ?? null,
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
      instrumentId: id,
      clauseId,
      body: parsed.data.body,
      revisionNote: parsed.data.revisionNote,
      createdBy,
    });
    return NextResponse.json(result);
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
