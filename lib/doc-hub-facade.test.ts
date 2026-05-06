import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/instrument-service", () => ({
  getInstrumentById: vi.fn(),
  getInstrumentByIdrRef: vi.fn(),
}));

import { getInstrumentById, getInstrumentByIdrRef } from "@/lib/instrument-service";
import {
  ledgerEntryToDocHub,
  resolveInstrumentDetail,
  withDocHubIdentifiers,
} from "@/lib/doc-hub-facade";

describe("resolveInstrumentDetail", () => {
  beforeEach(() => {
    vi.mocked(getInstrumentById).mockReset();
    vi.mocked(getInstrumentByIdrRef).mockReset();
  });

  it("returns by internal id and skips idr lookup", async () => {
    const row = { id: "cuid1", idrRef: "idr:HUB-INSTR-00000001" };
    vi.mocked(getInstrumentById).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("cuid1");
    expect(out).toBe(row);
    expect(getInstrumentByIdrRef).not.toHaveBeenCalled();
  });

  it("falls back to idrRef when id misses", async () => {
    const row = { id: "cuid1", idrRef: "idr:HUB-INSTR-00000001" };
    vi.mocked(getInstrumentById).mockResolvedValue(null);
    vi.mocked(getInstrumentByIdrRef).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("idr:HUB-INSTR-00000001");
    expect(out).toBe(row);
    expect(getInstrumentById).toHaveBeenCalledWith("idr:HUB-INSTR-00000001");
    expect(getInstrumentByIdrRef).toHaveBeenCalledWith("idr:HUB-INSTR-00000001");
  });
});

describe("withDocHubIdentifiers", () => {
  it("pairs docId and idrRef", () => {
    const out = withDocHubIdentifiers({
      id: "x",
      idrRef: "idr:HUB-INSTR-00000007",
      title: "t",
    });
    expect(out.docId).toBe("idr:HUB-INSTR-00000007");
    expect(out.idrRef).toBe("idr:HUB-INSTR-00000007");
    expect(out.instrumentId).toBe("x");
  });
});

describe("ledgerEntryToDocHub", () => {
  it("maps fields and ISO timestamp", () => {
    const d = new Date("2026-05-04T12:00:00.000Z");
    const out = ledgerEntryToDocHub({
      id: "le1",
      instrumentId: "inst",
      sequence: 1,
      previousEntryId: null,
      entryType: "VERSION_RECORDED",
      payloadHash: "abc",
      idrRef: "idr:HUB-INSTR-00000001",
      instrumentVersionId: "iv",
      transitionEventId: null,
      createdAt: d,
    } as never);
    expect(out.entryId).toBe("le1");
    expect(out.docId).toBe("idr:HUB-INSTR-00000001");
    expect(out.createdAt).toBe("2026-05-04T12:00:00.000Z");
  });
});
