import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mayAccessComiteWorkspace, type SessionLike } from "@/lib/committee-access";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";

export async function requireComiteWorkspace(): Promise<
  | { ok: true; session: Session; sessionLike: SessionLike }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: jsonUnauthorized() };
  }
  const sessionLike: SessionLike = {
    user: {
      roles: session.user.roles ?? [],
      committeeMemberships: session.user.committeeMemberships ?? [],
    },
  };
  if (!mayAccessComiteWorkspace(sessionLike)) {
    return {
      ok: false,
      response: jsonForbidden("Sem acesso ao espaço de trabalho do comité."),
    };
  }
  return { ok: true, session, sessionLike };
}
