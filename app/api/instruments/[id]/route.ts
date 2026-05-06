import { NextResponse } from "next/server";
import { getInstrumentById } from "@/lib/instrument-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const item = await getInstrumentById(id);
  if (!item) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}
