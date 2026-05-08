import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { referenceStatusBodySchema } from "@/lib/validation/committee";
import { updateExternalReferenceStatus } from "@/lib/committee-references";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Actualização manual do estado da referência (ativa / desactualizada / revogada). */
export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = referenceStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validação falhou.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updated = await updateExternalReferenceStatus(id, parsed.data.status);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 });
  }
}

/** Removido: não expor DELETE; arquivar via estado quando necessário. */
export async function GET(_request: Request, context: RouteContext) {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const row = await prisma.externalReference.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Referência não encontrada." }, { status: 404 });
  }
  return NextResponse.json(row);
}
