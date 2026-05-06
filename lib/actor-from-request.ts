import type { ActorKind } from "@prisma/client";
import type { Session } from "next-auth";

export type ResolvedActor = {
  actorKind: ActorKind;
  actorLabel: string | null;
  actorExternalId: string | null;
  /** Legacy column value for TransitionEvent.actor */
  legacyActorString: string | null;
};

function parseActorKindHeader(s: string): ActorKind | null {
  const n = s.trim().toLowerCase().replace(/-/g, "_");
  if (n === "human") return "human";
  if (n === "system") return "system";
  if (n === "api_key") return "api_key";
  return null;
}

function parseActorKindBody(s: string | undefined | null): ActorKind | null {
  if (s == null || s === "") return null;
  return parseActorKindHeader(s);
}

/**
 * Resolves actor identity for transitions and audits.
 * When `session` is present (protected routes), identity comes from the authenticated user.
 * In development only, optional headers may override body fields when there is no session:
 * X-Actor-Kind, X-Actor-Label, X-Actor-External-Id.
 */
export function resolveActorFromRequest(
  request: Request,
  body: {
    actor?: string | null;
    actorKind?: string | null;
    actorLabel?: string | null;
    actorExternalId?: string | null;
  },
  session: Session | null,
): ResolvedActor {
  if (session?.user?.id) {
    const label = session.user.name ?? session.user.email ?? session.user.id;
    return {
      actorKind: "human",
      actorLabel: label,
      actorExternalId: session.user.id,
      legacyActorString: label,
    };
  }

  const isDev = process.env.NODE_ENV === "development";

  let actorLabel: string | null = body.actorLabel ?? body.actor ?? null;
  let actorKind: ActorKind =
    parseActorKindBody(body.actorKind) ?? (actorLabel ? "human" : "system");
  let actorExternalId: string | null = body.actorExternalId ?? null;

  if (isDev) {
    const hk =
      request.headers.get("x-actor-kind") ??
      request.headers.get("X-Actor-Kind");
    const hl =
      request.headers.get("x-actor-label") ??
      request.headers.get("X-Actor-Label");
    const he =
      request.headers.get("x-actor-external-id") ??
      request.headers.get("X-Actor-External-Id");
    if (hl !== null && hl !== "") {
      actorLabel = hl;
    }
    const parsedHeaderKind = hk ? parseActorKindHeader(hk) : null;
    if (parsedHeaderKind) {
      actorKind = parsedHeaderKind;
    }
    if (he !== null && he !== "") {
      actorExternalId = he;
    }
  }

  const legacyActorString = actorLabel;

  return {
    actorKind,
    actorLabel,
    actorExternalId,
    legacyActorString,
  };
}

export function resolveRequestedBy(
  request: Request,
  bodyRequestedBy?: string | null,
  session?: Session | null,
): string | null {
  if (session?.user?.email) return session.user.email;
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    const h =
      request.headers.get("x-actor-label") ??
      request.headers.get("X-Actor-Label");
    if (h) return h;
  }
  return bodyRequestedBy ?? null;
}
