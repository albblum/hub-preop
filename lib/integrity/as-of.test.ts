import { describe, expect, it } from "vitest";
import {
  pickVersionAt,
  resolveStatusAt,
  verifyHashesMatchContent,
  verifyVersionChain,
} from "./as-of";
import { computeContentHash } from "./content-hash";

describe("as-of helpers", () => {
  it("pickVersionAt selects latest version with createdAt <= at", () => {
    const d0 = new Date("2026-01-01T00:00:00.000Z");
    const d1 = new Date("2026-02-01T00:00:00.000Z");
    const d2 = new Date("2026-03-01T00:00:00.000Z");
    const versions = [
      { version: 1, createdAt: d0 },
      { version: 2, createdAt: d1 },
      { version: 3, createdAt: d2 },
    ];
    expect(pickVersionAt(versions, new Date("2026-01-15T00:00:00.000Z"))?.version).toBe(1);
    expect(pickVersionAt(versions, new Date("2026-02-15T00:00:00.000Z"))?.version).toBe(2);
    expect(pickVersionAt(versions, d2)?.version).toBe(3);
  });

  it("pickVersionAt returns null when at is before first version", () => {
    const d0 = new Date("2026-01-01T00:00:00.000Z");
    expect(pickVersionAt([{ version: 1, createdAt: d0 }], new Date("2025-12-01Z"))).toBeNull();
  });

  it("resolveStatusAt uses latest transition at or before instant", () => {
    const events = [
      { id: "a", at: new Date("2026-01-02T00:00:00.000Z"), toStatus: "under-review" },
      { id: "b", at: new Date("2026-01-03T00:00:00.000Z"), toStatus: "in-force" },
    ];
    expect(resolveStatusAt(events, new Date("2026-01-02T12:00:00.000Z"))).toBe("under-review");
    expect(resolveStatusAt(events, new Date("2026-01-03T00:00:00.000Z"))).toBe("in-force");
  });

  it("resolveStatusAt returns draft when no events apply", () => {
    expect(resolveStatusAt([], new Date())).toBe("draft");
  });

  it("verifyVersionChain validates linear hash linkage", () => {
    const v1 = { contentHash: "aaa", previousContentHash: null as string | null };
    const v2 = { contentHash: "bbb", previousContentHash: "aaa" };
    const v3 = { contentHash: "ccc", previousContentHash: "bbb" };
    expect(verifyVersionChain([v1, v2, v3])).toBe(true);
    expect(verifyVersionChain([{ ...v1, previousContentHash: "x" }, v2])).toBe(false);
  });

  it("verifyHashesMatchContent checks rows against canonical algorithm", () => {
    const rows = [
      { version: 1, content: "a", contentHash: computeContentHash(1, "a") },
      { version: 2, content: "b", contentHash: computeContentHash(2, "b") },
    ];
    expect(verifyHashesMatchContent(rows)).toBe(true);
    expect(verifyHashesMatchContent([{ ...rows[0]!, contentHash: "00" }])).toBe(false);
  });
});
