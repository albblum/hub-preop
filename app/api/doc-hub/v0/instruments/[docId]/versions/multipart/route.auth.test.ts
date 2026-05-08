import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  appendMultipartInstrumentVersion: vi.fn(),
}));

vi.mock("@/lib/doc-hub-facade", () => ({
  resolveInstrumentDetail: vi.fn(),
  instrumentDetailToDocHubShape: vi.fn((d: { id: string; idrRef: string }) => ({
    ...d,
    docId: d.idrRef,
    instrumentId: d.id,
  })),
}));

import { auth } from "@/auth";
import { appendMultipartInstrumentVersion } from "@/lib/instrument-service";
import { resolveInstrumentDetail } from "@/lib/doc-hub-facade";
import { POST } from "./route";

describe("POST /api/doc-hub/v0/instruments/[docId]/versions/multipart", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(resolveInstrumentDetail).mockReset();
    vi.mocked(appendMultipartInstrumentVersion).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/doc-hub/v0/instruments/idr%3AX/versions/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodiesByPartId: { p1: "# x" } }),
      }),
      { params: Promise.resolve({ docId: "idr:X" }) },
    );
    expect(res.status).toBe(401);
    expect(resolveInstrumentDetail).not.toHaveBeenCalled();
  });

  it("returns 403 when role cannot append", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["viewer_registered"] } });
    const res = await POST(
      new Request("http://localhost/api/doc-hub/v0/instruments/cuid1/versions/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodiesByPartId: { p1: "# x" } }),
      }),
      { params: Promise.resolve({ docId: "cuid1" }) },
    );
    expect(res.status).toBe(403);
    expect(resolveInstrumentDetail).not.toHaveBeenCalled();
  });

  it("returns 404 when doc not resolved", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["registrar"] } });
    vi.mocked(resolveInstrumentDetail).mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/doc-hub/v0/instruments/missing/versions/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodiesByPartId: { p1: "# x" } }),
      }),
      { params: Promise.resolve({ docId: "missing" }) },
    );
    expect(res.status).toBe(404);
    expect(appendMultipartInstrumentVersion).not.toHaveBeenCalled();
  });

  it("returns 200 and DocHub-shaped body when append succeeds", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["registrar"] } });
    vi.mocked(resolveInstrumentDetail).mockResolvedValue({
      id: "inst-cuid",
      idrRef: "idr:HUB-INSTR-00000001",
    } as never);
    vi.mocked(appendMultipartInstrumentVersion).mockResolvedValue({
      id: "inst-cuid",
      idrRef: "idr:HUB-INSTR-00000001",
      currentVersion: 2,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/doc-hub/v0/instruments/idr%3AHUB/versions/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodiesByPartId: { partA: "# a" },
          revisionNote: "via facade",
        }),
      }),
      { params: Promise.resolve({ docId: "idr:HUB-INSTR-00000001" }) },
    );

    expect(res.status).toBe(200);
    expect(appendMultipartInstrumentVersion).toHaveBeenCalledWith({
      instrumentId: "inst-cuid",
      bodiesByPartId: { partA: "# a" },
      revisionNote: "via facade",
    });
    const json = (await res.json()) as { docId: string; instrumentId: string };
    expect(json.docId).toBe("idr:HUB-INSTR-00000001");
    expect(json.instrumentId).toBe("inst-cuid");
  });
});
