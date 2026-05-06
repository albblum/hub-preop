import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listInstruments } from "@/lib/instrument-service";
import { withDocHubIdentifiers } from "@/lib/doc-hub-facade";
import { canViewOperationalQueues } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

/**
 * DocHUB SS 9 — `GET /instruments` (facade).
 * Query: `layer`, `status`, `page`, `pageSize` (aligned with hub list capabilities).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  if (statusFilter) {
    const session = await auth();
    if (!session?.user) {
      return jsonUnauthorized();
    }
    if (!canViewOperationalQueues(session.user.roles)) {
      return jsonForbidden("Insufficient role for filtered instrument lists");
    }
  }

  const layerRaw = url.searchParams.get("layer");
  let layer: number | undefined;
  if (layerRaw !== null && layerRaw !== "") {
    const session = await auth();
    if (!session?.user) {
      return jsonUnauthorized();
    }
    if (!canViewOperationalQueues(session.user.roles)) {
      return jsonForbidden("Insufficient role for layer filter");
    }
    const n = Number(layerRaw);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: "Invalid layer (non-negative integer)" }, { status: 400 });
    }
    layer = n;
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50") || 50));
  const skip = (page - 1) * pageSize;

  const { items, total, take } = await listInstruments({
    skip,
    take: pageSize,
    status: statusFilter ?? undefined,
    layer,
  });

  return NextResponse.json({
    items: items.map((row) => withDocHubIdentifiers(row)),
    page,
    pageSize: take,
    total,
  });
}
