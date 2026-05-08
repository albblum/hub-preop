import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appendInstrumentVersion } from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { updateContentBodySchema } from "@/lib/validation/instrument";
import { canAppendContent } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }

  const { id } = await context.params;

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

  const parsed = updateContentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await appendInstrumentVersion({
      instrumentId: id,
      content: parsed.data.content,
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
