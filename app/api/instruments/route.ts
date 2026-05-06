import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createInstrument,
  getInstrumentById,
  getInstrumentByIdrRef,
  listInstruments,
} from "@/lib/instrument-service";
import { handleDomainError, handleIntegrityError } from "@/lib/api-instrument";
import { createInstrumentBodySchema } from "@/lib/validation/instrument";
import { canCreateInstrument, canViewOperationalQueues } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

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

  const idrRef = url.searchParams.get("idrRef");
  if (idrRef) {
    const d = await getInstrumentByIdrRef(idrRef);
    if (!d) {
      return NextResponse.json({ error: "Instrument not found" }, { status: 404 });
    }
    return NextResponse.json(d);
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50") || 50));
  const skip = (page - 1) * pageSize;

  const { items, total, take } = await listInstruments({
    skip,
    take: pageSize,
    status: statusFilter ?? undefined,
  });
  return NextResponse.json({
    items,
    page,
    pageSize: take,
    total,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canCreateInstrument(session.user.roles)) {
    return jsonForbidden("Insufficient role to create instruments");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createInstrumentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const created = await createInstrument({
      title: parsed.data.title,
      layer: parsed.data.layer,
      draftingAuthority: parsed.data.draftingAuthority,
      content: parsed.data.content,
      parentInstrumentId: parsed.data.parentInstrumentId,
    });
    const full = await getInstrumentById(created.id);
    return NextResponse.json(full ?? created, { status: 201 });
  } catch (e) {
    const ir = handleIntegrityError(e);
    if (ir) return ir;
    const r = handleDomainError(e);
    if (r) return r;
    throw e;
  }
}
