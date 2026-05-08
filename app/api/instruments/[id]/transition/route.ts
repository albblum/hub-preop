import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActorFromRequest } from "@/lib/actor-from-request";
import { transitionInstrument } from "@/lib/instrument-service";
import { handleDomainError } from "@/lib/api-instrument";
import { transitionBodySchema } from "@/lib/validation/instrument";
import { canTransition } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canTransition(session.user.roles, session.user.committeeMemberships)) {
    return jsonForbidden("Insufficient role for transitions");
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = transitionBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const actor = resolveActorFromRequest(request, parsed.data, session);

  try {
    const updated = await transitionInstrument({
      instrumentId: id,
      toStatus: parsed.data.toStatus,
      actor: actor.legacyActorString,
      actorKind: actor.actorKind,
      actorLabel: actor.actorLabel,
      actorExternalId: actor.actorExternalId,
      note: parsed.data.note,
    });
    return NextResponse.json(updated);
  } catch (e) {
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
