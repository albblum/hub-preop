import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  transitionInstrument: vi.fn(),
}));

vi.mock("@/lib/authority", () => ({
  resolveAuthorityForAction: vi.fn(),
}));

import { auth } from "@/auth";
import { transitionInstrument } from "@/lib/instrument-service";
import { resolveAuthorityForAction } from "@/lib/authority";
import { POST } from "./route";

describe("POST /api/instruments/[id]/transition authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(transitionInstrument).mockReset();
    vi.mocked(resolveAuthorityForAction).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "under-review" }),
      }),
      { params: Promise.resolve({ id: "inst-1" }) },
    );

    expect(res.status).toBe(401);
    expect(transitionInstrument).not.toHaveBeenCalled();
  });

  it("returns 403 when authority resolver denies transition (role_fallback)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-1",
        roles: ["viewer_registered"],
        committeeMemberships: [],
      },
    } as never);
    vi.mocked(resolveAuthorityForAction).mockReturnValue({
      allowed: false,
      reasonCode: "ROLE_TRANSITION_DENIED",
      authoritySource: "role_based",
      normativeRefs: ["ADR-0014"],
      resolutionMode: "role_fallback",
    });

    const res = await POST(
      new Request("http://localhost/api/instruments/inst-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "under-review" }),
      }),
      { params: Promise.resolve({ id: "inst-1" }) },
    );

    expect(res.status).toBe(403);
    expect(transitionInstrument).not.toHaveBeenCalled();
  });

  it("allows transition under hybrid_fallback resolution mode", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-2",
        roles: ["viewer_registered"],
        committeeMemberships: [
          {
            committeeId: "committee-7",
            code: "C#07",
            startedAt: "2026-01-01T00:00:00.000Z",
            authorityInstrumentId: null,
          },
        ],
      },
    } as never);
    vi.mocked(resolveAuthorityForAction).mockReturnValue({
      allowed: true,
      reasonCode: "ROLE_TRANSITION_ALLOWED",
      authoritySource: "hybrid",
      normativeRefs: ["ADR-0014", "RBAC_COMMITTEE_MEMBERSHIP_ACTIVE"],
      resolutionMode: "hybrid_fallback",
      authorityEvidence: { committeeId: "committee-7", authorityInstrumentId: null },
    });
    vi.mocked(transitionInstrument).mockResolvedValue({} as never);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst-1/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: "under-review" }),
      }),
      { params: Promise.resolve({ id: "inst-1" }) },
    );

    expect(res.status).toBe(200);
    expect(transitionInstrument).toHaveBeenCalledOnce();
  });
});
