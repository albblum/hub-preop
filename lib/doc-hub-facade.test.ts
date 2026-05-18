import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/instrument-service", () => ({
  getInstrumentById: vi.fn(),
  getInstrumentByIdrRef: vi.fn(),
}));

vi.mock("@/lib/normative/resolve-idr-ref", () => ({
  resolveIdrRef: vi.fn(),
}));

vi.mock("@/lib/normative/read-v2-instrument", () => ({
  findInstrumentIdForClause: vi.fn(),
  loadResolvedClause: vi.fn(),
  loadV2SectionsSummary: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { getInstrumentById, getInstrumentByIdrRef } from "@/lib/instrument-service";
import { resolveIdrRef } from "@/lib/normative/resolve-idr-ref";
import {
  findInstrumentIdForClause,
  loadResolvedClause,
  loadV2SectionsSummary,
} from "@/lib/normative/read-v2-instrument";
import {
  ledgerEntryToDocHub,
  resolveInstrumentDetail,
  instrumentDetailToDocHubShape,
  withDocHubIdentifiers,
} from "@/lib/doc-hub-facade";

describe("resolveInstrumentDetail", () => {
  beforeEach(() => {
    vi.mocked(getInstrumentById).mockReset();
    vi.mocked(getInstrumentByIdrRef).mockReset();
    vi.mocked(resolveIdrRef).mockReset();
    vi.mocked(findInstrumentIdForClause).mockReset();
    vi.mocked(loadResolvedClause).mockReset();
  });

  it("returns by internal id and skips idr lookup", async () => {
    const row = { id: "cuid1", idrRef: "idr:HUB-INSTR-00000001" };
    vi.mocked(resolveIdrRef).mockResolvedValue(null);
    vi.mocked(getInstrumentById).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("cuid1");
    expect(out).toBe(row);
    expect(getInstrumentByIdrRef).not.toHaveBeenCalled();
  });

  it("resolves semantic instrument idr via registry", async () => {
    const row = { id: "inst-v2", idrRef: "idr:c:foundation" };
    vi.mocked(resolveIdrRef).mockResolvedValue({
      canonical: "idr:c:foundation",
      ownerKind: "instrument",
      ownerId: "inst-v2",
    });
    vi.mocked(getInstrumentById).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("idr:c:foundation");
    expect(out).toBe(row);
    expect(getInstrumentById).toHaveBeenCalledWith("inst-v2");
    expect(getInstrumentByIdrRef).not.toHaveBeenCalled();
  });

  it("falls back to idrRef when id misses", async () => {
    const row = { id: "cuid1", idrRef: "idr:HUB-INSTR-00000001" };
    vi.mocked(resolveIdrRef).mockResolvedValue(null);
    vi.mocked(getInstrumentById).mockResolvedValue(null);
    vi.mocked(getInstrumentByIdrRef).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("idr:HUB-INSTR-00000001");
    expect(out).toBe(row);
    expect(getInstrumentById).toHaveBeenCalledWith("idr:HUB-INSTR-00000001");
    expect(getInstrumentByIdrRef).toHaveBeenCalledWith("idr:HUB-INSTR-00000001");
  });

  it("resolves legacy alias to instrument via registry path", async () => {
    const row = { id: "inst-v2", idrRef: "idr:c:foundation" };
    vi.mocked(resolveIdrRef).mockResolvedValue({
      canonical: "idr:c:foundation",
      legacy: "idr:HUB-INSTR-00009001",
      ownerKind: "instrument",
      ownerId: "inst-v2",
    });
    vi.mocked(getInstrumentById).mockResolvedValue(row as never);
    const out = await resolveInstrumentDetail("idr:HUB-INSTR-00009001");
    expect(out).toBe(row);
    expect(getInstrumentById).toHaveBeenCalledWith("inst-v2");
  });

  it("attaches resolvedClause for clause-level idrRef", async () => {
    const row = { id: "inst-v2", idrRef: "idr:c:foundation" };
    vi.mocked(resolveIdrRef).mockResolvedValue({
      canonical: "idr:c:foundation:s0:art.en:§1:cl:1",
      ownerKind: "clause",
      ownerId: "clause-1",
    });
    vi.mocked(findInstrumentIdForClause).mockResolvedValue("inst-v2");
    vi.mocked(getInstrumentById).mockResolvedValue(row as never);
    vi.mocked(loadResolvedClause).mockResolvedValue({
      idrRef: "idr:c:foundation:s0:art.en:§1:cl:1",
      body: "Clause body",
      nonNormative: false,
    });
    const out = await resolveInstrumentDetail("idr:c:foundation:s0:art.en:§1:cl:1");
    expect(out?.resolvedClause).toEqual({
      idrRef: "idr:c:foundation:s0:art.en:§1:cl:1",
      body: "Clause body",
    });
  });
});

describe("instrumentDetailToDocHubShape", () => {
  beforeEach(() => {
    vi.mocked(loadV2SectionsSummary).mockReset();
  });

  it("includes v2 optional fields and sectionsSummary", async () => {
    vi.mocked(loadV2SectionsSummary).mockResolvedValue([
      { code: "s0", position: 0, nonNormative: false, migrationPhase: "pilot" },
    ]);
    const out = await instrumentDetailToDocHubShape({
      id: "x",
      idrRef: "idr:c:foundation",
      structuralProfile: "v2",
      semanticDocumentCode: "foundation",
      terminationDate: new Date("2026-12-31"),
      terminationRequiresExplicitAct: true,
      terminationAuthorizedBy: null,
      terminationConditions: [],
    } as never);
    expect(out.structuralProfile).toBe("v2");
    expect(out.semanticDocumentCode).toBe("foundation");
    expect(out.terminationDate).toBe("2026-12-31");
    expect(out.sectionsSummary).toHaveLength(1);
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
