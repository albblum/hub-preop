import { NextResponse } from "next/server";
import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { subscriberCorsHeaders } from "@/lib/public-subscriber-cors";
import { safeInternalPath } from "@/lib/safe-internal-path";
import { landingLoginBodySchema } from "@/lib/validation/landing-login";

function hasAllowOrigin(headers: HeadersInit): boolean {
  const h = headers as Record<string, string | undefined>;
  return Boolean(h["Access-Control-Allow-Origin"]);
}

function jsonWithCors(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: subscriberCorsHeaders(request) });
}

/** CORS preflight for landing → Hub member login (credentials + session cookie). */
export async function OPTIONS(request: Request) {
  const headers = subscriberCorsHeaders(request);
  if (!hasAllowOrigin(headers)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

/**
 * Establishes a Hub session from the public landing (cross-origin fetch with credentials).
 * Allowed `Origin` values are the same as `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS`.
 */
export async function POST(request: Request) {
  const cors = subscriberCorsHeaders(request);
  if (request.headers.get("origin") && !hasAllowOrigin(cors)) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors(request, { error: "Invalid JSON body." }, 400);
  }

  const parsed = landingLoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonWithCors(
      request,
      { error: "Validation failed", issues: parsed.error.flatten() },
      400,
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const { password } = parsed.data;
  const next = safeInternalPath(parsed.data.next ?? null, "/ops");
  const recognitionPath = `/recognition?next=${encodeURIComponent(next)}`;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: recognitionPath,
    });
  } catch (e) {
    if (e instanceof CredentialsSignin) {
      return jsonWithCors(request, { error: "Invalid email or password." }, 401);
    }
    throw e;
  }

  return jsonWithCors(request, { ok: true, hubContinuePath: recognitionPath });
}
