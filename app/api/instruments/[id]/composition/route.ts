import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInstrumentCompositionView } from "@/lib/part-composition";

type RouteContext = { params: Promise<{ id: string }> };

/** Same visibility model as `GET /api/instruments/[id]` — no extra RBAC gate. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const view = await getInstrumentCompositionView(prisma, id);
  if (!view) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }
  return NextResponse.json(view);
}
