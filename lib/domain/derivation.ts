/** Layer 0 is root; layers 1–5 require a parent with strictly lower layer (Fase 1 derivation rule). */
export function isParentDerivationValid(
  layer: number,
  parent: { layer: number } | null,
): boolean {
  if (layer === 0) {
    return parent === null;
  }
  if (!parent) {
    return false;
  }
  return parent.layer < layer;
}
