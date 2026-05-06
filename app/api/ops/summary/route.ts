import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  instrumentAggregates,
  listRecentTransitionEvents,
} from "@/lib/instrument-service";
import { jsonUnauthorized } from "@/lib/api-http";
import { canViewOperationalQueues } from "@/lib/rbac";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canViewOperationalQueues(session.user.roles)) {
    return NextResponse.json(
      { error: "Insufficient role for ops summary", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const [aggregates, recentEvents] = await Promise.all([
    instrumentAggregates(),
    listRecentTransitionEvents(20),
  ]);

  return NextResponse.json({ aggregates, recentEvents });
}
