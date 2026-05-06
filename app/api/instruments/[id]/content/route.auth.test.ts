import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  appendInstrumentVersion: vi.fn(),
}));

import { auth } from "@/auth";
import { appendInstrumentVersion } from "@/lib/instrument-service";
import { POST } from "./route";

describe("POST /api/instruments/[id]/content authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(appendInstrumentVersion).mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# hi" }),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(401);
    expect(appendInstrumentVersion).not.toHaveBeenCalled();
  });

  it("returns 403 when viewer_registered cannot append", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["viewer_registered"] },
    });

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# hi" }),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(403);
    expect(appendInstrumentVersion).not.toHaveBeenCalled();
  });

  it("returns 200 when registrar appends", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    vi.mocked(appendInstrumentVersion).mockResolvedValue({
      id: "inst1",
      idrRef: "idr:HUB-INSTR-00000001",
      title: "T",
      currentVersion: 2,
    } as never);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "# updated", revisionNote: "note" }),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(200);
    expect(appendInstrumentVersion).toHaveBeenCalledWith({
      instrumentId: "inst1",
      content: "# updated",
      revisionNote: "note",
    });
  });
});
