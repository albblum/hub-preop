import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { mayAccessCommitteeInstrument } from "@/lib/committee-access";
import { linkReferenceBodySchema } from "@/lib/validation/committee";
import { handleDomainError } from "@/lib/api-instrument";
import {
  linkExternalReferenceToInstrument,
  listExternalReferencesForInstrument,
} from "@/lib/committee-references";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
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

  const refs = await listExternalReferencesForInstrument(id);
  return NextResponse.json({ items: refs });
}

/** Vincular uma referência externa existente ao instrumento (repositório partilhado). */
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

  const parsed = linkReferenceBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validação falhou.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await linkExternalReferenceToInstrument({
      instrumentId: id,
      externalReferenceId: parsed.data.externalReferenceId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
