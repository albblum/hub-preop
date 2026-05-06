import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  getInstrumentByIdrRef: vi.fn(),
}));

import { auth } from "@/auth";
import { getInstrumentByIdrRef } from "@/lib/instrument-service";
import { GET } from "./route";

describe("GET /api/review/instruments authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(getInstrumentByIdrRef).mockReset();
  });

  it("returns 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/review/instruments?idrRef=idr%3AHUB-INSTR-1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 for reviewer role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["reviewer"] } });
    vi.mocked(getInstrumentByIdrRef).mockResolvedValue({ id: "1", idrRef: "idr:HUB-INSTR-1" });
    const res = await GET(
      new Request("http://localhost/api/review/instruments?idrRef=idr%3AHUB-INSTR-1"),
    );
    expect(res.status).toBe(200);
  });
});
