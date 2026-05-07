import { describe, expect, it } from "vitest";
import {
  PART_KIND_MONOLITH_BODY,
  assembleInstrumentMarkdown,
  isMvpMonolithCompositionOrder,
  validateMultipartSegmentPositions,
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

  it("assembles markdown with stable \\n\\n separators (ADR 0008)", () => {
    expect(assembleInstrumentMarkdown(["a", "b"])).toBe("a\n\nb");
    expect(assembleInstrumentMarkdown(["x"])).toBe("x");
  });

  it("validates contiguous segment positions", () => {
    expect(validateMultipartSegmentPositions([]).ok).toBe(false);
    expect(validateMultipartSegmentPositions([{ position: 1 }]).ok).toBe(true);
    expect(
      validateMultipartSegmentPositions([
        { position: 2 },
        { position: 1 },
      ]).ok,
    ).toBe(true);
    expect(validateMultipartSegmentPositions([{ position: 2 }]).ok).toBe(false);
  });
});
