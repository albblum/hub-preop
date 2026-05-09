import { describe, expect, it } from "vitest";
import { resolveAuthorityForAction } from "@/lib/authority";

describe("resolveAuthorityForAction", () => {
  const baseContext = {
    actor: {
      id: "u1",
      roles: [] as Array<"admin" | "registrar" | "reviewer" | "viewer_public" | "viewer_registered">,
      memberships: [],
    },
    instrument: { id: "inst-1", committeeId: "committee-1" },
    timestamp: new Date("2026-05-09T00:00:00.000Z"),
  };

  it("keeps transition decision compatible with RBAC canTransition", () => {
    const allowed = resolveAuthorityForAction({
      ...baseContext,
      actor: { ...baseContext.actor, roles: ["reviewer"] },
      actionType: "transition",
    });
    const denied = resolveAuthorityForAction({
      ...baseContext,
      actor: { ...baseContext.actor, roles: ["viewer_registered"] },
      actionType: "transition",
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.reasonCode).toBe("ROLE_TRANSITION_ALLOWED");
    expect(denied.allowed).toBe(false);
    expect(denied.reasonCode).toBe("ROLE_TRANSITION_DENIED");
  });

  it("allows committee action for matching active membership", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actor: {
        ...baseContext.actor,
        memberships: [
          {
            committeeId: "committee-1",
            code: "C#01",
            startedAt: "2026-01-01T00:00:00.000Z",
            authorityInstrumentId: null,
          },
        ],
      },
      actionType: "committee_formal_approval",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("COMMITTEE_ACTION_ALLOWED");
  });

  it("denies committee action when instrument has no committee", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actionType: "committee_deliberation",
      instrument: { id: "inst-1", committeeId: null },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("INSTRUMENT_COMMITTEE_REQUIRED");
  });
});
