import { computeContentHash } from "./content-hash";

export const INITIAL_STATUS_AT = "draft";

export type TransitionEventLike = { id: string; at: Date; toStatus: string };
export type VersionLike = { version: number; createdAt: Date };

/**
 * Tie-break when two events share the same timestamp: lexicographic event id descending
 * (deterministic, stable ordering).
 */
export function resolveStatusAt(events: TransitionEventLike[], at: Date): string {
  const tAt = at.getTime();
  const relevant = events.filter((e) => e.at.getTime() <= tAt);
  if (relevant.length === 0) {
    return INITIAL_STATUS_AT;
  }
  relevant.sort((a, b) => {
    const dt = b.at.getTime() - a.at.getTime();
    if (dt !== 0) return dt;
    return b.id.localeCompare(a.id);
  });
  return relevant[0]!.toStatus;
}

export function pickVersionAt<T extends VersionLike>(versions: T[], at: Date): T | null {
  const tAt = at.getTime();
  const eligible = versions.filter((v) => v.createdAt.getTime() <= tAt);
  if (eligible.length === 0) {
    return null;
  }
  return eligible.reduce((best, v) => (v.version > best.version ? v : best));
}

/** Offline sequential chain check for ordered versions of one instrument. */
export function verifyVersionChain(orderedVersions: Array<{ contentHash: string; previousContentHash: string | null }>): boolean {
  for (let i = 0; i < orderedVersions.length; i++) {
    const v = orderedVersions[i]!;
    if (i === 0) {
      if (v.previousContentHash !== null) return false;
    } else {
      const prev = orderedVersions[i - 1]!;
      if (v.previousContentHash !== prev.contentHash) return false;
    }
  }
  return true;
}

export function verifyHashesMatchContent(
  rows: Array<{ version: number; content: string; contentHash: string }>,
): boolean {
  return rows.every((r) => computeContentHash(r.version, r.content) === r.contentHash);
}
