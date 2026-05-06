import { describe, expect, it } from "vitest";
import {
  canonicalVersionPayload,
  computeContentHash,
  verifyContentHash,
} from "./content-hash";

describe("content hash (Phase 4)", () => {
  it("uses deterministic canonical UTF-8 payload version\\ncontent", () => {
    expect(canonicalVersionPayload(1, "hello")).toBe("1\nhello");
    expect(canonicalVersionPayload(42, "α")).toBe("42\nα");
  });

  it("computes SHA-256 hex matching Node crypto expectations", () => {
    const h = computeContentHash(1, "test");
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
    expect(computeContentHash(1, "test")).toBe(computeContentHash(1, "test"));
    expect(computeContentHash(1, "test")).not.toBe(computeContentHash(2, "test"));
  });

  it("verifyContentHash succeeds for consistent rows", () => {
    const content = "# Title\n";
    const version = 3;
    const contentHash = computeContentHash(version, content);
    expect(verifyContentHash({ version, content, contentHash })).toBe(true);
    expect(verifyContentHash({ version, content: content + "x", contentHash })).toBe(false);
  });
});
