import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActorFromRequest } from "@/lib/actor-from-request";
import { transitionInstrument } from "@/lib/instrument-service";
import { handleDomainError } from "@/lib/api-instrument";
import { transitionBodySchema } from "@/lib/validation/instrument";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { resolveAuthorityForAction } from "@/lib/authority";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  const { id } = await context.params;
  const authorityDecision = resolveAuthorityForAction({
    actor: {
      id: session.user.id,
      roles: session.user.roles ?? [],
      memberships: session.user.committeeMemberships ?? [],
    },
    instrument: { id },
    actionType: "transition",
    timestamp: new Date(),
  });
  if (!authorityDecision.allowed) {
    return jsonForbidden("Insufficient role for transitions");
  }

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
