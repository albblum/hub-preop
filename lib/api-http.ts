import { NextResponse } from "next/server";

export function jsonUnauthorized() {
  return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
}

export function jsonForbidden(message = "Forbidden") {
  return NextResponse.json({ error: message, code: "FORBIDDEN" }, { status: 403 });
}
