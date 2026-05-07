import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  transitionMonolithToMultipartProfile: vi.fn(),
  isMonolithToMultipartTransitionEnabled: vi.fn(),
}));

import { auth } from "@/auth";
import {
  isMonolithToMultipartTransitionEnabled,
  transitionMonolithToMultipartProfile,
} from "@/lib/instrument-service";
import { POST } from "./route";

describe("POST /api/instruments/[id]/transition-to-multipart authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(transitionMonolithToMultipartProfile).mockReset();
    vi.mocked(isMonolithToMultipartTransitionEnabled).mockReset();
    vi.mocked(isMonolithToMultipartTransitionEnabled).mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/transition-to-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(401);
    expect(transitionMonolithToMultipartProfile).not.toHaveBeenCalled();
  });

  it("returns 403 when viewer_registered", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["viewer_registered"] },
    });

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/transition-to-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(403);
    expect(transitionMonolithToMultipartProfile).not.toHaveBeenCalled();
  });

  it("returns 403 when feature flag is off", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });
    vi.mocked(isMonolithToMultipartTransitionEnabled).mockReturnValue(false);

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/transition-to-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TRANSITION_DISABLED");
    expect(transitionMonolithToMultipartProfile).not.toHaveBeenCalled();
  });

  it("returns 200 when registrar and flag on", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    vi.mocked(transitionMonolithToMultipartProfile).mockResolvedValue({
      dryRun: true,
      report: {
        instrumentId: "inst1",
        currentVersionRecordId: "ver1",
        monolithPartId: "p1",
        contentLength: 3,
        contentHash: "abc",
      },
    });

    const res = await POST(
      new Request("http://localhost/api/instruments/inst1/transition-to-multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      }),
      { params: Promise.resolve({ id: "inst1" }) },
    );

    expect(res.status).toBe(200);
    expect(transitionMonolithToMultipartProfile).toHaveBeenCalledWith({
      instrumentId: "inst1",
      dryRun: true,
    });
  });
});
