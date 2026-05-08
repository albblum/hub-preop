import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listLedgerEntries } from "@/lib/instrument-service";
import { canViewOperationalQueues } from "@/lib/rbac";
import { jsonForbidden } from "@/lib/api-http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (
    !canViewOperationalQueues(session?.user?.roles, session?.user?.committeeMemberships ?? [])
  ) {
    return jsonForbidden("Ledger requires registrar, reviewer, or admin session");
  }

  const { id } = await context.params;
  const entries = await listLedgerEntries(id);
  return NextResponse.json({
    instrumentId: id,
    count: entries.length,
    entries,
  });
}
