import { createHash } from "node:crypto";

/**
 * Canonical UTF-8 payload for SHA-256 content integrity (Phase 4).
 * Format: decimal version number, single LF, exact content string (no BOM normalization).
 */
export function canonicalVersionPayload(version: number, content: string): string {
  return `${version}\n${content}`;
}

export function computeContentHash(version: number, content: string): string {
  const payload = canonicalVersionPayload(version, content);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function verifyContentHash(row: {
  version: number;
  content: string;
  contentHash: string;
}): boolean {
  return computeContentHash(row.version, row.content) === row.contentHash;
}
