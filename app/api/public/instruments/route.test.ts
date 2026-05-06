import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/publication-service", () => ({
  listPublicCatalog: vi.fn(),
  getPublicInstrumentByIdrRef: vi.fn(),
}));

import { getPublicInstrumentByIdrRef, listPublicCatalog } from "@/lib/publication-service";
import { GET } from "./route";

describe("GET /api/public/instruments", () => {
  beforeEach(() => {
    vi.mocked(listPublicCatalog).mockReset();
    vi.mocked(getPublicInstrumentByIdrRef).mockReset();
  });

  it("returns public catalog list", async () => {
    vi.mocked(listPublicCatalog).mockResolvedValue([
      {
        idrRef: "idr:HUB-INSTR-1",
        title: "Public Instrument",
        layer: 2,
        status: "in-force",
        publicDisplayLabel: "Ratified",
        currentVersion: 1,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const res = await GET(new Request("http://localhost/api/public/instruments?limit=10"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; items: { publicDisplayLabel: string }[] };
    expect(body.total).toBe(1);
    expect(body.items[0].publicDisplayLabel).toBe("Ratified");
  });

  it("returns 404 for non-publicable idrRef", async () => {
    vi.mocked(getPublicInstrumentByIdrRef).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/public/instruments?idrRef=idr%3AHUB-INSTR-404"),
    );
    expect(res.status).toBe(404);
  });

  it("rejects invalid version query", async () => {
    const res = await GET(
      new Request("http://localhost/api/public/instruments?idrRef=idr%3AX&version=0"),
    );
    expect(res.status).toBe(400);
  });

  it("forwards version to getPublicInstrumentByIdrRef", async () => {
    vi.mocked(getPublicInstrumentByIdrRef).mockResolvedValue({ idrRef: "idr:1" } as Awaited<
      ReturnType<typeof getPublicInstrumentByIdrRef>
    >);
    const res = await GET(
      new Request("http://localhost/api/public/instruments?idrRef=idr%3A1&version=2"),
    );
    expect(res.status).toBe(200);
    expect(getPublicInstrumentByIdrRef).toHaveBeenCalledWith("idr:1", { version: 2 });
  });
});
