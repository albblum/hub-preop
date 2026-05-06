import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInstrumentCompositionView } from "@/lib/part-composition";
import { resolveInstrumentDetail } from "@/lib/doc-hub-facade";

type RouteContext = { params: Promise<{ docId: string }> };

/** DocHUB SS 9 — `GET /instruments/{doc_id}/composition` (facade). */
export async function GET(_request: Request, context: RouteContext) {
  const { docId } = await context.params;
  const detail = await resolveInstrumentDetail(docId);
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }

  const view = await getInstrumentCompositionView(prisma, detail.id);
  if (!view) {
    return NextResponse.json({ error: "Composition not found" }, { status: 404 });
  }

  return NextResponse.json({
    docId: detail.idrRef,
    idrRef: detail.idrRef,
    instrumentId: detail.id,
    parts: view.parts.map((p) => ({
      position: p.position,
      partId: p.partId,
      partKind: p.partKind,
      partStatus: p.partStatus,
      instrumentVersionId: p.instrumentVersionId,
    })),
  });
}
