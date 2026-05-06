import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  getAsOfByVersionNumber: vi.fn(),
  getAsOfByTimestamp: vi.fn(),
}));

import { auth } from "@/auth";
import { getAsOfByVersionNumber } from "@/lib/instrument-service";
import { GET } from "./route";

describe("GET /api/instruments/[id]/as-of authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(getAsOfByVersionNumber).mockReset();
  });

  it("returns 403 for anonymous users requesting mode=registered", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/instruments/inst1/as-of?version=1&mode=registered"),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(403);
  });

  it("returns 200 for viewer_registered requesting mode=registered (no redaction for layer<=4)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["viewer_registered"] },
    });

    vi.mocked(getAsOfByVersionNumber).mockResolvedValue({
      instrument: {
        id: "inst1",
        idrRef: "idr:TEST",
        title: "Test",
        layer: 3,
        parentInstrumentId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      statusAt: "under-review",
      version: {
        id: "ver1",
        instrumentId: "inst1",
        version: 1,
        content: "SECRET",
        contentHash: "hash",
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        currentHeadFor: null,
      },
      transitionEventsAtOrBefore: [],
    });

    const res = await GET(
      new Request("http://localhost/api/instruments/inst1/as-of?version=1&mode=registered"),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: { content: string } };
    expect(body.version.content).toBe("SECRET");
  });
});

