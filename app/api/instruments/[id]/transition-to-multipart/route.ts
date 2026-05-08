import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isMonolithToMultipartTransitionEnabled,
  transitionMonolithToMultipartProfile,
} from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { transitionToMultipartBodySchema } from "@/lib/validation/instrument";
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
    return jsonForbidden("Insufficient role to transition instrument profile");
  }
  if (!isMonolithToMultipartTransitionEnabled()) {
    return NextResponse.json(
      {
        error: "Monolith to multi-part transition is disabled (set TRANSITION_MONOLITH_TO_MULTIPART_ENABLED=1)",
        code: "TRANSITION_DISABLED",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = transitionToMultipartBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await transitionMonolithToMultipartProfile({
      instrumentId: id,
      dryRun: parsed.data.dryRun,
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
