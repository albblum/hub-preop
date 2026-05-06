import { NextResponse } from "next/server";

const DEPRECATED = {
  message:
    "instrument-stubs API was removed in Phase 3 (Core Registry). Use POST/GET /api/instruments instead.",
  migration:
    "See AlblumZ deeds/IDR/02_Documentos/HUB_PREOP/Fase3_Core_Registry_MVP.md — Breaking change: InstrumentStub replaced by Instrument + InstrumentVersion + TransitionEvent.",
};

/** @deprecated Phase 3 — use `/api/instruments` */
export async function GET() {
  return NextResponse.json(DEPRECATED, {
    status: 410,
    headers: {
      Deprecation: "true",
    },
  });
}

/** @deprecated Phase 3 — use `POST /api/instruments` */
export async function POST() {
  return NextResponse.json(DEPRECATED, {
    status: 410,
    headers: {
      "Deprecation": "true",
    },
  });
}
