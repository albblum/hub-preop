import { describe, expect, it } from "vitest";
import {
  PART_KIND_MONOLITH_BODY,
  isMvpMonolithCompositionOrder,
} from "@/lib/part-composition";

describe("part composition MVP helpers", () => {
  it("uses documented monolith body kind", () => {
    expect(PART_KIND_MONOLITH_BODY).toBe("MONOLITH_BODY");
  });

  it("accepts single position 1 as MVP monolith composition", () => {
    expect(isMvpMonolithCompositionOrder([1])).toBe(true);
  });

  it("rejects empty or multi-part orders", () => {
    expect(isMvpMonolithCompositionOrder([])).toBe(false);
    expect(isMvpMonolithCompositionOrder([1, 2])).toBe(false);
    expect(isMvpMonolithCompositionOrder([2])).toBe(false);
  });
});
