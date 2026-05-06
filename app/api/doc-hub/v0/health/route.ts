import { NextResponse } from "next/server";

/** DocHUB facade liveness; does not ping the database (use `/api/health` for DB). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    facade: "doc-hub",
    version: "v0",
  });
}
