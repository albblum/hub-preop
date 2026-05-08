import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { mayAccessCommitteeInstrument } from "@/lib/committee-access";
import { committeeOpenConsultation } from "@/lib/committee-acts";
import { resolveActorFromRequest } from "@/lib/actor-from-request";
import { openConsultationBodySchema } from "@/lib/validation/committee";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Abertura formal de consulta pública (acto institucional — registo no razão). */
export async function POST(request: Request, context: RouteContext) {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const head = await prisma.instrument.findUnique({
    where: { id },
    select: { committeeId: true },
  });
  if (!head) {
    return NextResponse.json({ error: "Instrumento não encontrado." }, { status: 404 });
  }
  if (!mayAccessCommitteeInstrument(gate.sessionLike, head.committeeId)) {
    return NextResponse.json({ error: "Sem acesso a este instrumento." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = openConsultationBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validação falhou.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const actor = resolveActorFromRequest(request, {}, gate.session);

  try {
    await committeeOpenConsultation({
      instrumentId: id,
      closesAt: parsed.data.closesAt,
      openingNote: parsed.data.openingNote,
      actorKind: actor.actorKind,
      actorLabel: actor.actorLabel,
      actorExternalId: actor.actorExternalId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
