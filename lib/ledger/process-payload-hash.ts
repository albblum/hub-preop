import { createHash } from "node:crypto";

/** Deterministic hash for committee process acts appended to the ledger. */
export function computeCommitteeProcessPayloadHash(input: {
  instrumentId: string;
  act: string;
  atIso: string;
  bodyJson: string;
}): string {
  const stable = `${input.instrumentId}|${input.act}|${input.atIso}|${input.bodyJson}`;
  return createHash("sha256").update(stable, "utf8").digest("hex");
}
