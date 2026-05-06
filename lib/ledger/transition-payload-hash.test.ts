import { describe, expect, it } from "vitest";
import { computeTransitionPayloadHash } from "./transition-payload-hash";

describe("computeTransitionPayloadHash", () => {
  it("is stable for the same inputs", () => {
    const at = new Date("2026-05-04T12:00:00.000Z");
    const a = computeTransitionPayloadHash({
      id: "evt_1",
      fromStatus: "draft",
      toStatus: "under-review",
      at,
    });
    const b = computeTransitionPayloadHash({
      id: "evt_1",
      fromStatus: "draft",
      toStatus: "under-review",
      at,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs when event id differs", () => {
    const at = new Date("2026-05-04T12:00:00.000Z");
    const a = computeTransitionPayloadHash({
      id: "evt_1",
      fromStatus: "draft",
      toStatus: "under-review",
      at,
    });
    const b = computeTransitionPayloadHash({
      id: "evt_2",
      fromStatus: "draft",
      toStatus: "under-review",
      at,
    });
    expect(a).not.toBe(b);
  });
});
