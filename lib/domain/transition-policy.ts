import { assertTransitionAllowed, DomainError, isTransitionAllowed } from "./transitions";
import { isParentDerivationValid } from "./derivation";

const DERIVATION_GATE_STATUSES = new Set(["in-force", "foundational-provisional"]);

export type ResolveTransitionResult = {
  toStatus: string;
  note?: string;
};

/**
 * Applies derivation gate: for layer > 0, attempts to enter in-force or foundational-provisional
 * without valid parent are redirected to derivation-pending when that transition is allowed from the
 * current status; otherwise a domain error is thrown (e.g. draft cannot jump to derivation-pending).
 */
export function resolveTransitionTarget(input: {
  fromStatus: string;
  requestedTo: string;
  layer: number;
  parent: { layer: number } | null;
}): ResolveTransitionResult {
  const { fromStatus, requestedTo, layer, parent } = input;
  const parentOk = isParentDerivationValid(layer, parent);

  if (
    layer > 0 &&
    !parentOk &&
    DERIVATION_GATE_STATUSES.has(requestedTo)
  ) {
    if (!isTransitionAllowed(fromStatus, "derivation-pending")) {
      throw new DomainError(
        "Cannot enter foundational-provisional or in-force without valid superior-layer derivation. Link parentInstrumentId (parent.layer < child.layer), or move through statuses allowed by the transition matrix (e.g. draft → under-review first).",
      );
    }
    return {
      toStatus: "derivation-pending",
      note:
        "MVP derivation gate: superior-layer parent missing or invalid (parent.layer must be < child.layer). Status set to derivation-pending.",
    };
  }

  assertTransitionAllowed(fromStatus, requestedTo);
  return { toStatus: requestedTo };
}
