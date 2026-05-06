import { describe, expect, it } from "vitest";
import { CANONICAL_STATUSES } from "./canonical-status";
import {
  mapInstrumentStatusToPartStatus,
  PART_STATUSES,
  isPartStatus,
} from "./part-status";

describe("mapInstrumentStatusToPartStatus (ADR 0004)", () => {
  it("maps each canonical instrument status deterministically", () => {
    expect(mapInstrumentStatusToPartStatus("draft")).toBe("DRAFT");
    expect(mapInstrumentStatusToPartStatus("under-review")).toBe("PROPOSED");
    expect(mapInstrumentStatusToPartStatus("foundational-provisional")).toBe("PROVISIONAL");
    expect(mapInstrumentStatusToPartStatus("in-force")).toBe("PROVISIONAL");
    expect(mapInstrumentStatusToPartStatus("amended")).toBe("SUPERSEDED");
    expect(mapInstrumentStatusToPartStatus("suspended")).toBe("SUSPENDED");
    expect(mapInstrumentStatusToPartStatus("revoked")).toBe("REVOKED");
    expect(mapInstrumentStatusToPartStatus("derivation-pending")).toBe("DERIVATION_PENDING");
    expect(mapInstrumentStatusToPartStatus("normalization-pending")).toBe("NORMALIZATION_PENDING");
  });

  it("covers every CANONICAL_STATUSES entry", () => {
    for (const s of CANONICAL_STATUSES) {
      const p = mapInstrumentStatusToPartStatus(s);
      expect(isPartStatus(p)).toBe(true);
    }
  });

  it("rejects unknown instrument status strings", () => {
    expect(() => mapInstrumentStatusToPartStatus("unknown")).toThrow(
      "Unknown instrument status for Part mapping",
    );
  });
});

describe("PART_STATUSES", () => {
  it("lists stable DocHUB-shaped and Hub extension values", () => {
    expect(PART_STATUSES.length).toBeGreaterThanOrEqual(10);
    expect(PART_STATUSES).toContain("PROVISIONAL");
    expect(PART_STATUSES).toContain("DERIVATION_PENDING");
  });
});
