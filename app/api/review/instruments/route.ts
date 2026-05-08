import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInstrumentByIdrRef } from "@/lib/instrument-service";
import { canViewOperationalQueues } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canViewOperationalQueues(session.user.roles, session.user.committeeMemberships)) {
    return jsonForbidden("Insufficient role for review reads");
  }

  const url = new URL(request.url);
  const idrRef = url.searchParams.get("idrRef");
  if (!idrRef) {
    return NextResponse.json({ error: "Missing idrRef query parameter" }, { status: 400 });
  }

  const detail = await getInstrumentByIdrRef(idrRef);
  if (!detail) {
    return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
