import { NextResponse } from "next/server";

const DEPRECATED = {
  message:
    "instrument-stubs API was removed in Phase 3 (Core Registry). Use GET /api/instruments/[id] or GET /api/instruments?idrRef=...",
  migration:
    "See Fase3_Core_Registry_MVP.md — Core Registry uses idr:ref and cuid `id`.",
};

/** @deprecated Phase 3 — use `/api/instruments/:id` */
export async function GET() {
  return NextResponse.json(DEPRECATED, { status: 410 });
}
