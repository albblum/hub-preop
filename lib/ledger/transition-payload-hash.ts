import { createHash } from "node:crypto";

/**
 * Deterministic hash for a transition row, used as ledger payloadHash (not a digital signature).
 */
export function computeTransitionPayloadHash(e: {
  id: string;
  fromStatus: string;
  toStatus: string;
  at: Date;
}): string {
  const stable = `${e.id}|${e.fromStatus}|${e.toStatus}|${e.at.toISOString()}`;
  return createHash("sha256").update(stable, "utf8").digest("hex");
}
