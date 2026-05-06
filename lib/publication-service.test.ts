import { describe, expect, it } from "vitest";
import {
  getPublicDisplayLabel,
  isInstrumentPublicable,
  PUBLICABLE_STATUSES,
  buildPublicVersionIndex,
} from "@/lib/publication-service";

describe("publication policy", () => {
  it("PUBLICABLE_STATUSES matches ADR 0006", () => {
    expect([...PUBLICABLE_STATUSES].sort()).toEqual(["foundational-provisional", "in-force"].sort());
  });

  it("isInstrumentPublicable is true only for publicable statuses", () => {
    expect(isInstrumentPublicable("in-force")).toBe(true);
    expect(isInstrumentPublicable("foundational-provisional")).toBe(true);
    expect(isInstrumentPublicable("draft")).toBe(false);
    expect(isInstrumentPublicable("revoked")).toBe(false);
    expect(isInstrumentPublicable("under-review")).toBe(false);
  });
});

describe("getPublicDisplayLabel", () => {
  it("maps foundational-provisional to DocHUB-style provisional copy", () => {
    expect(getPublicDisplayLabel("foundational-provisional")).toBe(
      "Provisional — subject to ratification by the General Assembly",
    );
  });

  it("maps in-force to Ratified", () => {
    expect(getPublicDisplayLabel("in-force")).toBe("Ratified");
  });
});

describe("buildPublicVersionIndex", () => {
  it("uses query param for non-current versions and plain path for current", () => {
    const idr = "idr:HUB-INSTR-00000001";
    const enc = encodeURIComponent(idr);
    const idx = buildPublicVersionIndex(
      idr,
      [
        { version: 1, createdAt: new Date(), contentHash: "a" },
        { version: 2, createdAt: new Date(), contentHash: "b" },
      ],
      2,
    );
    const v2 = idx.find((e) => e.version === 2);
    const v1 = idx.find((e) => e.version === 1);
    expect(v2?.publicUrlPath).toBe(`/public/${enc}`);
    expect(v1?.publicUrlPath).toBe(`/public/${enc}?version=1`);
    expect(v2?.isCurrent).toBe(true);
    expect(v1?.isCurrent).toBe(false);
  });
});
