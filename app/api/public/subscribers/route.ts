import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicSubscriberBodySchema } from "@/lib/validation/public-subscriber";
import { subscriberCorsHeaders } from "@/lib/public-subscriber-cors";

function jsonWithCors(
  request: Request,
  body: unknown,
  init: { status?: number } = {},
): NextResponse {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: subscriberCorsHeaders(request),
  });
}

function hasAllowOrigin(headers: HeadersInit): boolean {
  const h = headers as Record<string, string | undefined>;
  return Boolean(h["Access-Control-Allow-Origin"]);
}

/** CORS preflight for landing → Hub subscriber capture. */
export async function OPTIONS(request: Request) {
  const headers = subscriberCorsHeaders(request);
  if (!hasAllowOrigin(headers)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

/**
 * Public mailing-list signup (no session). Used by the DocHub landing page.
 * Idempotent on email: repeated signups return 200 with the same shape.
 */
export async function POST(request: Request) {
  const cors = subscriberCorsHeaders(request);
  if (request.headers.get("origin") && !hasAllowOrigin(cors)) {
    return NextResponse.json(
      { error: "Origin not allowed for public subscriber capture." },
      { status: 403, headers: cors },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors(request, { error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = publicSubscriberBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonWithCors(
      request,
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    await prisma.publicSubscriber.upsert({
      where: { email },
      create: {
        name: parsed.data.name,
        email,
      },
      update: {
        name: parsed.data.name,
      },
    });
    return jsonWithCors(request, { ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonWithCors(request, { error: "Could not save subscription." }, { status: 500 });
    }
    throw e;
  }
}
