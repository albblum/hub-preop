import { createHash } from "node:crypto";

/** Deterministic hash for foundational instrument registration ledger rows. */
export function computeInstrumentRegistrationPayloadHash(input: {
  instrumentId: string;
  idrRef: string;
  instrumentVersionId: string;
  note: string;
  registeredAtIso: string;
}): string {
  const stable = `${input.instrumentId}|${input.idrRef}|${input.instrumentVersionId}|${input.note}|${input.registeredAtIso}`;
  return createHash("sha256").update(stable, "utf8").digest("hex");
}
