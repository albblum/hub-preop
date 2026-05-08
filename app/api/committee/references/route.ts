import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { externalReferenceBodySchema } from "@/lib/validation/committee";
import { handleDomainError } from "@/lib/api-instrument";
import { createExternalReference, listExternalReferences } from "@/lib/committee-references";

export async function GET() {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const items = await listExternalReferences(150);
  return NextResponse.json({ items });
}

/** Registar nova referência externa no repositório partilhado. */
export async function POST(request: Request) {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const parsed = externalReferenceBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validação falhou.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createExternalReference({
      kind: parsed.data.kind,
      title: parsed.data.title,
      origin: parsed.data.origin,
      stableId: parsed.data.stableId,
      accessedAt: parsed.data.accessedAt,
      status: parsed.data.status,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
