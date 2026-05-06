import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/audit/export-service", () => ({
  createAuditExport: vi.fn().mockResolvedValue({
    exportId: "test-export",
    manifest: { exportSchemaVersion: "1" },
    body: [],
    jsonl: "",
  }),
}));

import { auth } from "@/auth";
import { GET } from "./route";

describe("GET /api/audit/export authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
  });

  it("returns 403 for restricted mode without a session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/audit/export?mode=restricted"));
    expect(res.status).toBe(403);
  });

  it("returns 200 for public mode without a session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/audit/export?mode=public"));
    expect(res.status).toBe(200);
  });
});
