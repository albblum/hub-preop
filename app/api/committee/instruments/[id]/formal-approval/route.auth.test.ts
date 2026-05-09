import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/committee-api-session", () => ({
  requireComiteWorkspace: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authority", () => ({
  resolveAuthorityForAction: vi.fn(),
}));

vi.mock("@/lib/committee-acts", () => ({
  committeeFormalApproval: vi.fn(),
}));

import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { prisma } from "@/lib/prisma";
import { resolveAuthorityForAction } from "@/lib/authority";
import { committeeFormalApproval } from "@/lib/committee-acts";
import { POST } from "./route";

describe("POST /api/committee/instruments/[id]/formal-approval authorization", () => {
  beforeEach(() => {
    vi.mocked(requireComiteWorkspace).mockReset();
    vi.mocked(prisma.instrument.findUnique).mockReset();
    vi.mocked(resolveAuthorityForAction).mockReset();
    vi.mocked(committeeFormalApproval).mockReset();
  });

  it("returns 403 when authority resolver denies instrument action", async () => {
    vi.mocked(requireComiteWorkspace).mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "u1",
          roles: ["reviewer"],
          committeeMemberships: [],
        },
      },
      sessionLike: { user: { roles: ["reviewer"], committeeMemberships: [] } },
    } as never);
    vi.mocked(prisma.instrument.findUnique).mockResolvedValue({ committeeId: "committee-1" } as never);
    vi.mocked(resolveAuthorityForAction).mockReturnValue({
      allowed: false,
      reasonCode: "COMMITTEE_ACTION_DENIED",
      authoritySource: "role_based",
      normativeRefs: ["ADR-0014"],
      resolutionMode: "role_fallback",
    });

    const res = await POST(
      new Request("http://localhost/api/committee/instruments/inst-1/formal-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundationNote: "nota" }),
      }),
      { params: Promise.resolve({ id: "inst-1" }) },
    );

    expect(res.status).toBe(403);
    expect(committeeFormalApproval).not.toHaveBeenCalled();
  });

  it("forwards the full authorityDecision (instrument_first) snapshot to the act", async () => {
    vi.mocked(requireComiteWorkspace).mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "u1",
          roles: ["viewer_registered"],
          committeeMemberships: [
            {
              committeeId: "committee-1",
              code: "C#01",
              startedAt: "2026-01-01T00:00:00.000Z",
              authorityInstrumentId: "inst-nomeacao-A",
            },
          ],
        },
      },
      sessionLike: {
        user: {
          roles: ["viewer_registered"],
          committeeMemberships: [
            {
              committeeId: "committee-1",
              code: "C#01",
              startedAt: "2026-01-01T00:00:00.000Z",
              authorityInstrumentId: "inst-nomeacao-A",
            },
          ],
        },
      },
    } as never);
    vi.mocked(prisma.instrument.findUnique).mockResolvedValue({ committeeId: "committee-1" } as never);
    vi.mocked(resolveAuthorityForAction).mockReturnValue({
      allowed: true,
      reasonCode: "COMMITTEE_ACTION_ALLOWED",
      authoritySource: "instrument_based",
      normativeRefs: ["ADR-0014", "INSTRUMENT_AUTHORITY_NOMINATION"],
      resolutionMode: "instrument_first",
      authorityEvidence: {
        committeeId: "committee-1",
        authorityInstrumentId: "inst-nomeacao-A",
      },
    });
    vi.mocked(committeeFormalApproval).mockResolvedValue({} as never);

    const res = await POST(
      new Request("http://localhost/api/committee/instruments/inst-1/formal-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foundationNote: "nota" }),
      }),
      { params: Promise.resolve({ id: "inst-1" }) },
    );

    expect(res.status).toBe(200);
    expect(committeeFormalApproval).toHaveBeenCalledOnce();
    const call = vi.mocked(committeeFormalApproval).mock.calls[0]?.[0];
    expect(call?.authorityDecision).toMatchObject({
      reasonCode: "COMMITTEE_ACTION_ALLOWED",
      authoritySource: "instrument_based",
      resolutionMode: "instrument_first",
      authorityEvidence: {
        committeeId: "committee-1",
        authorityInstrumentId: "inst-nomeacao-A",
      },
    });
  });
});
