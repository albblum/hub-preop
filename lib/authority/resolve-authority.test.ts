import { describe, expect, it } from "vitest";
import { resolveAuthorityForAction } from "@/lib/authority";

const TIMESTAMP = new Date("2026-05-09T00:00:00.000Z");

describe("resolveAuthorityForAction", () => {
  const baseContext = {
    actor: {
      id: "u1",
      roles: [] as Array<"admin" | "registrar" | "reviewer" | "viewer_public" | "viewer_registered">,
      memberships: [],
    },
    instrument: { id: "inst-1", committeeId: "committee-1" },
    timestamp: TIMESTAMP,
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
    expect(allowed.resolutionMode).toBe("role_fallback");
    expect(allowed.authoritySource).toBe("role_based");
    expect(denied.allowed).toBe(false);
    expect(denied.reasonCode).toBe("ROLE_TRANSITION_DENIED");
    expect(denied.resolutionMode).toBe("role_fallback");
  });

  it("labels transition as hybrid_fallback when only membership grants the right", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actor: {
        ...baseContext.actor,
        roles: ["viewer_registered"],
        memberships: [
          {
            committeeId: "committee-7",
            code: "C#07",
            startedAt: "2026-01-01T00:00:00.000Z",
            authorityInstrumentId: "inst-nomeacao-A",
          },
        ],
      },
      actionType: "transition",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("ROLE_TRANSITION_ALLOWED");
    // IBA-0/D3: transition nunca sobe a instrument_first.
    expect(decision.resolutionMode).toBe("hybrid_fallback");
    expect(decision.authoritySource).toBe("hybrid");
    expect(decision.authorityEvidence).toEqual({
      committeeId: "committee-7",
      authorityInstrumentId: null,
    });
  });

  it("allows committee action for matching active membership (membership_only)", () => {
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
    expect(decision.resolutionMode).toBe("hybrid_fallback");
    expect(decision.authoritySource).toBe("hybrid");
    expect(decision.authorityEvidence).toEqual({
      committeeId: "committee-1",
      authorityInstrumentId: null,
    });
  });

  it("promotes committee action to instrument_first when membership has authorityInstrumentId", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actor: {
        ...baseContext.actor,
        memberships: [
          {
            committeeId: "committee-1",
            code: "C#01",
            startedAt: "2026-01-01T00:00:00.000Z",
            authorityInstrumentId: "inst-nomeacao-PRC-1",
          },
        ],
      },
      actionType: "committee_deliberation",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("COMMITTEE_ACTION_ALLOWED");
    expect(decision.resolutionMode).toBe("instrument_first");
    expect(decision.authoritySource).toBe("instrument_based");
    expect(decision.authorityEvidence).toEqual({
      committeeId: "committee-1",
      authorityInstrumentId: "inst-nomeacao-PRC-1",
    });
  });

  it("labels supervisor-driven committee grants as role_fallback", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actor: {
        ...baseContext.actor,
        roles: ["registrar"],
        memberships: [],
      },
      actionType: "committee_consultation_open",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe("COMMITTEE_ACTION_ALLOWED");
    expect(decision.resolutionMode).toBe("role_fallback");
    expect(decision.authoritySource).toBe("role_based");
    expect(decision.authorityEvidence).toBeUndefined();
  });

  it("denies committee action when instrument has no committee", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actionType: "committee_deliberation",
      instrument: { id: "inst-1", committeeId: null },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("INSTRUMENT_COMMITTEE_REQUIRED");
    expect(decision.resolutionMode).toBe("role_fallback");
  });

  it("denies committee action with role_fallback when no membership matches and not supervisor", () => {
    const decision = resolveAuthorityForAction({
      ...baseContext,
      actor: {
        ...baseContext.actor,
        roles: ["reviewer"],
        memberships: [
          {
            committeeId: "committee-other",
            code: "C#02",
            startedAt: "2026-01-01T00:00:00.000Z",
            authorityInstrumentId: "inst-X",
          },
        ],
      },
      actionType: "committee_formal_approval",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("COMMITTEE_ACTION_DENIED");
    expect(decision.resolutionMode).toBe("role_fallback");
    expect(decision.authorityEvidence).toEqual({ committeeId: "committee-1" });
  });
});
