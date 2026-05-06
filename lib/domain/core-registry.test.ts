import { describe, expect, it } from "vitest";
import { isParentDerivationValid } from "./derivation";
import { DomainError, isTransitionAllowed } from "./transitions";
import { resolveTransitionTarget } from "./transition-policy";

describe("derivation", () => {
  it("layer 0 allows no parent only", () => {
    expect(isParentDerivationValid(0, null)).toBe(true);
    expect(isParentDerivationValid(0, { layer: 1 })).toBe(false);
  });

  it("layer > 0 requires parent with strictly lower layer", () => {
    expect(isParentDerivationValid(2, null)).toBe(false);
    expect(isParentDerivationValid(2, { layer: 1 })).toBe(true);
    expect(isParentDerivationValid(2, { layer: 2 })).toBe(false);
    expect(isParentDerivationValid(2, { layer: 3 })).toBe(false);
  });
});

describe("status transitions (MVP matrix)", () => {
  it("allows draft -> under-review -> in-force chain segment", () => {
    expect(isTransitionAllowed("draft", "under-review")).toBe(true);
    expect(isTransitionAllowed("under-review", "in-force")).toBe(true);
  });

  it("disallows draft -> in-force directly", () => {
    expect(isTransitionAllowed("draft", "in-force")).toBe(false);
  });
});

describe("transition policy + derivation gate", () => {
  it("redirects under-review -> in-force to derivation-pending when parent is invalid (layer > 0)", () => {
    const r = resolveTransitionTarget({
      fromStatus: "under-review",
      requestedTo: "in-force",
      layer: 2,
      parent: null,
    });
    expect(r.toStatus).toBe("derivation-pending");
    expect(r.note).toBeDefined();
  });

  it("allows under-review -> in-force when parent layer is lower", () => {
    const r = resolveTransitionTarget({
      fromStatus: "under-review",
      requestedTo: "in-force",
      layer: 2,
      parent: { layer: 1 },
    });
    expect(r.toStatus).toBe("in-force");
  });

  it("throws when draft requests in-force with invalid parent (cannot land on derivation-pending from draft)", () => {
    expect(() =>
      resolveTransitionTarget({
        fromStatus: "draft",
        requestedTo: "in-force",
        layer: 2,
        parent: null,
      }),
    ).toThrow(DomainError);
  });
});
