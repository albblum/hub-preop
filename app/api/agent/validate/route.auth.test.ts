import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { POST } from "./route";

describe("POST /api/agent/validate", () => {
  const validBody = {
    content: "# Title\n\nParagraph.",
    idrRef: "idr:test-1",
  };

  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer_registered", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["viewer_registered"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty after trim", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "   \n\t  " }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 200 with stub checklist when registrar and AGENT_ENABLED=0", async () => {
    vi.stubEnv("AGENT_ENABLED", "0");
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.mode).toBe("stub");
    expect(json.ok).toBe(true);
    expect(typeof json.summary).toBe("string");
    expect(Array.isArray(json.checks)).toBe(true);
    expect((json.checks as { id: string }[]).length).toBeGreaterThan(0);
    expect(json.disclaimer).toMatch(/validação jurídica/i);
  });

  it("returns 200 with same stub shape when AGENT_ENABLED=1 (MVP)", async () => {
    vi.stubEnv("AGENT_ENABLED", "1");
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["admin"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "x".repeat(900) }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.mode).toBe("stub");
    expect(json.ok).toBe(false);
    const checks = json.checks as { id: string; passed: boolean }[];
    const heading = checks.find((c) => c.id === "content.heading_when_long");
    expect(heading?.passed).toBe(false);
  });

  it("flags merge conflict markers", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { roles: ["registrar"] },
    });

    const res = await POST(
      new Request("http://localhost/api/agent/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "# ok\n\n<<<<<<< HEAD\n",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; checks: { id: string; passed: boolean }[] };
    expect(json.ok).toBe(false);
    expect(json.checks.find((c) => c.id === "content.no_merge_conflict_markers")?.passed).toBe(
      false,
    );
  });
});
