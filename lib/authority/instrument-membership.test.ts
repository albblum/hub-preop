import { describe, expect, it } from "vitest";
import type { CommitteeMembershipClaim } from "@/lib/rbac";
import {
  resolveActorAuthorityAny,
  resolveActorAuthorityForCommittee,
} from "@/lib/authority/instrument-membership";

const NOW = new Date("2026-05-09T10:00:00.000Z");

function claim(partial: Partial<CommitteeMembershipClaim>): CommitteeMembershipClaim {
  return {
    committeeId: partial.committeeId ?? "committee-1",
    code: partial.code ?? "C#01",
    startedAt: partial.startedAt ?? "2026-01-01T00:00:00.000Z",
    authorityInstrumentId: partial.authorityInstrumentId ?? null,
  };
}

describe("resolveActorAuthorityForCommittee", () => {
  it("returns instrument_linked when matching membership has authorityInstrumentId", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [claim({ authorityInstrumentId: "inst-nomeacao-1" })],
      committeeId: "committee-1",
      timestamp: NOW,
    });
    expect(signal.quality).toBe("instrument_linked");
    expect(signal.committeeId).toBe("committee-1");
    expect(signal.authorityInstrumentId).toBe("inst-nomeacao-1");
  });

  it("prefers instrument_linked when both linked and unlinked memberships match", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [
        claim({}),
        claim({ authorityInstrumentId: "inst-nomeacao-2" }),
      ],
      committeeId: "committee-1",
      timestamp: NOW,
    });
    expect(signal.quality).toBe("instrument_linked");
    expect(signal.authorityInstrumentId).toBe("inst-nomeacao-2");
  });

  it("returns membership_only when matching membership has no authorityInstrumentId", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [claim({})],
      committeeId: "committee-1",
      timestamp: NOW,
    });
    expect(signal.quality).toBe("membership_only");
    expect(signal.committeeId).toBe("committee-1");
    expect(signal.authorityInstrumentId).toBeNull();
  });

  it("returns none when no membership matches the committee", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [
        claim({ committeeId: "committee-other", authorityInstrumentId: "inst-X" }),
      ],
      committeeId: "committee-1",
      timestamp: NOW,
    });
    expect(signal.quality).toBe("none");
    expect(signal.committeeId).toBe("committee-1");
    expect(signal.authorityInstrumentId).toBeNull();
  });

  it("returns none when committeeId is null (instrument without committee scope)", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [claim({ authorityInstrumentId: "inst-nomeacao-1" })],
      committeeId: null,
      timestamp: NOW,
    });
    expect(signal.quality).toBe("none");
    expect(signal.committeeId).toBeNull();
  });

  it("ignores memberships started after the evaluation timestamp", () => {
    const signal = resolveActorAuthorityForCommittee({
      memberships: [
        claim({
          authorityInstrumentId: "inst-nomeacao-1",
          startedAt: "2026-06-01T00:00:00.000Z",
        }),
      ],
      committeeId: "committee-1",
      timestamp: NOW,
    });
    expect(signal.quality).toBe("none");
  });
});

describe("resolveActorAuthorityAny", () => {
  it("returns membership_only for any active membership (transition path)", () => {
    const signal = resolveActorAuthorityAny({
      memberships: [claim({ authorityInstrumentId: "inst-X" })],
      timestamp: NOW,
    });
    expect(signal.quality).toBe("membership_only");
    expect(signal.committeeId).toBe("committee-1");
    expect(signal.authorityInstrumentId).toBeNull();
  });

  it("returns none when no membership is active at the timestamp", () => {
    const signal = resolveActorAuthorityAny({
      memberships: [
        claim({ startedAt: "2026-12-01T00:00:00.000Z" }),
      ],
      timestamp: NOW,
    });
    expect(signal.quality).toBe("none");
    expect(signal.committeeId).toBeNull();
  });

  it("returns none for empty memberships list", () => {
    const signal = resolveActorAuthorityAny({
      memberships: [],
      timestamp: NOW,
    });
    expect(signal.quality).toBe("none");
  });
});
