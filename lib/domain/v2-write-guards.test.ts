import { describe, it, expect } from "vitest";
import { DomainError } from "@/lib/domain/transitions";
import {
  assertValidV2InstrumentIdrRef,
  assertV1WritePath,
  assertV2Instrument,
} from "./v2-write-guards";

describe("v2-write-guards", () => {
  it("assertV1WritePath allows v1", () => {
    expect(() => assertV1WritePath("v1", "appendInstrumentVersion")).not.toThrow();
  });

  it("assertV1WritePath rejects v2 append", () => {
    expect(() => assertV1WritePath("v2", "appendInstrumentVersion")).toThrow(DomainError);
    try {
      assertV1WritePath("v2", "appendInstrumentVersion");
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).domainCode).toBe("V2_WRITE_PATH_BLOCKED");
    }
  });

  it("assertValidV2InstrumentIdrRef accepts semantic document ref", () => {
    expect(() => assertValidV2InstrumentIdrRef("idr:c:foundation")).not.toThrow();
  });

  it("assertValidV2InstrumentIdrRef rejects HUB-INSTR for v2 profile", () => {
    expect(() => assertValidV2InstrumentIdrRef("idr:HUB-INSTR-00000001")).toThrow(DomainError);
    try {
      assertValidV2InstrumentIdrRef("idr:HUB-INSTR-00000001");
    } catch (e) {
      expect((e as DomainError).domainCode).toBe("INVALID_V2_IDR_REF");
    }
  });

  it("assertV2Instrument rejects v1", () => {
    expect(() => assertV2Instrument("v1")).toThrow(DomainError);
    try {
      assertV2Instrument("v1");
    } catch (e) {
      expect((e as DomainError).domainCode).toBe("NOT_V2_INSTRUMENT");
    }
  });
});
