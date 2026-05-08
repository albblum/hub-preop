import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAsOfByTimestamp,
  getAsOfByVersionNumber,
} from "@/lib/instrument-service";
import { handleIntegrityError } from "@/lib/api-instrument";
import { canUseExportMode } from "@/lib/rbac";
import { defaultExportMode, redactInstrumentContent, type ExportMode } from "@/lib/audit/export-redaction";
import { jsonForbidden } from "@/lib/api-http";

type RouteContext = { params: Promise<{ id: string }> };

function parseMode(raw: string | null): ExportMode | null {
  const v = raw?.trim();
  if (!v) return "public";
  if (v === "public" || v === "registered" || v === "restricted") return v;
  return null;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get("mode")) ?? defaultExportMode(url.searchParams.get("mode"));
  const versionParam = url.searchParams.get("version");
  const atParam = url.searchParams.get("at");

  try {
    if (versionParam != null && atParam != null) {
      return NextResponse.json(
        { error: "Provide only one of version= or at=", code: "AMBIGUOUS_QUERY" },
        { status: 400 },
      );
    }

    const session = await auth();
    if (!canUseExportMode(session?.user?.roles, mode, session?.user?.committeeMemberships ?? [])) {
      return jsonForbidden("Requested mode not allowed for current role");
    }

    if (versionParam != null) {
      const n = Number.parseInt(versionParam, 10);
      if (!Number.isFinite(n) || n < 1) {
        return NextResponse.json({ error: "Invalid version", code: "BAD_VERSION" }, { status: 400 });
      }
      const row = await getAsOfByVersionNumber(id, n);
      if (!row) {
        return NextResponse.json({ error: "Version not found", code: "NOT_FOUND" }, { status: 404 });
      }
      return NextResponse.json({
        ...row,
        version: {
          ...row.version,
          content: redactInstrumentContent(mode, row.instrument.layer, row.version.content),
        },
      });
    }

    if (atParam != null) {
      const at = new Date(atParam);
      if (Number.isNaN(at.getTime())) {
        return NextResponse.json({ error: "Invalid at (ISO 8601)", code: "BAD_TIMESTAMP" }, { status: 400 });
      }
      const row = await getAsOfByTimestamp(id, at);
      if (!row) {
        return NextResponse.json(
          {
            error: "No instrument version exists at or before this timestamp",
            code: "NO_STATE_AT_TIMESTAMP",
          },
          { status: 404 },
        );
      }
      return NextResponse.json({
        ...row,
        version: {
          ...row.version,
          content: redactInstrumentContent(mode, row.instrument.layer, row.version.content),
        },
      });
    }

    return NextResponse.json(
      { error: "Query version=<n> or at=<ISO8601> is required", code: "MISSING_QUERY" },
      { status: 400 },
    );
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    throw e;
  }
}
