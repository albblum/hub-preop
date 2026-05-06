import { NextResponse } from "next/server";
import { instrumentDetailToDocHubShape, resolveInstrumentDetail } from "@/lib/doc-hub-facade";

type RouteContext = { params: Promise<{ docId: string }> };

/** DocHUB SS 9 — `GET /instruments/{doc_id}` (facade). `docId` path = cuid or `idrRef`. */
export async function GET(_request: Request, context: RouteContext) {
  const { docId } = await context.params;
  const detail = await resolveInstrumentDetail(docId);
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }
  return NextResponse.json(instrumentDetailToDocHubShape(detail));
}
