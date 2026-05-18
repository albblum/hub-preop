import { DomainError } from "@/lib/domain/transitions";
import { isLegacyHubInstrRef, validateIdrRef } from "@/lib/normative";

export const V2_CLAUSE_VERSION_ROUTE_HINT =
  "POST /api/instruments/{id}/clauses/{clauseId}/versions";

/** Rejects monolith / multipart / transition writes on structuralProfile v2. */
export function assertV1WritePath(
  structuralProfile: string,
  operation:
    | "appendInstrumentVersion"
    | "appendMultipartInstrumentVersion"
    | "transitionMonolithToMultipart",
): void {
  if (structuralProfile !== "v2") return;

  const message =
    operation === "transitionMonolithToMultipart"
      ? `v2 instruments cannot use monolith-to-multipart transition; use ${V2_CLAUSE_VERSION_ROUTE_HINT}`
      : `v2 instruments use clause-level append; use ${V2_CLAUSE_VERSION_ROUTE_HINT}`;

  throw new DomainError(message, "V2_WRITE_PATH_BLOCKED");
}

/** v2 document heads must use semantic idr:c:* (never legacy HUB-INSTR sequence). */
export function assertValidV2InstrumentIdrRef(idrRef: string): void {
  const parsed = validateIdrRef(idrRef);
  if (!parsed.ok) {
    throw new DomainError(
      `Invalid idrRef for v2 instrument: ${parsed.reason ?? "grammar check failed"}`,
      "INVALID_V2_IDR_REF",
    );
  }
  if (isLegacyHubInstrRef(idrRef)) {
    throw new DomainError(
      "structuralProfile v2 cannot use legacy idr:HUB-INSTR-* references",
      "INVALID_V2_IDR_REF",
    );
  }
}

export function assertV2Instrument(structuralProfile: string): void {
  if (structuralProfile !== "v2") {
    throw new DomainError(
      "Instrument is not a v2 normative tree; use POST /api/instruments/{id}/content or multipart for v1",
      "NOT_V2_INSTRUMENT",
    );
  }
}
