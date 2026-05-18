import { composeIdrRef } from "../idr-ref-grammar";
import { normalizeSegmentCode } from "./normalize-segment";

/** NormativeSection.code (`s0`) → idr path segment (`0`). */
export function sectionStorageCodeToSegment(code: string): string {
  const c = normalizeSegmentCode(code);
  return c.startsWith("s") ? c.slice(1) : c;
}

export function composeClauseIdrRef(input: {
  documentCode: string;
  /** Storage code (`s0`) or segment (`0`). */
  section: string;
  article: string;
  paragraph: string;
  clause: string;
}): string {
  return composeIdrRef({
    typePrefix: "c",
    documentCode: normalizeSegmentCode(input.documentCode),
    section: sectionStorageCodeToSegment(input.section),
    article: normalizeSegmentCode(input.article),
    paragraph: normalizeSegmentCode(input.paragraph),
    clause: normalizeSegmentCode(input.clause),
  });
}

export function composeDocumentIdrRef(documentCode: string): string {
  return composeIdrRef({
    typePrefix: "c",
    documentCode: normalizeSegmentCode(documentCode),
  });
}
