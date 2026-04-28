import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInstrumentStubSchema } from "@/lib/validation/instrument-stub";

export async function GET() {
  const items = await prisma.instrumentStub.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createInstrumentStubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { title, layer, status, content } = parsed.data;
  const created = await prisma.instrumentStub.create({
    data: {
      title,
      layer,
      status,
      content: content ?? null,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
