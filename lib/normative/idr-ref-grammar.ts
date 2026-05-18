/**
 * idrRef semantic path grammar (ADR 0014 §1.2–§1.3).
 */

const TYPE_PREFIXES = ["c", "o", "i", "f", "p", "r"] as const;
export type IdrRefTypePrefix = (typeof TYPE_PREFIXES)[number];

function isTypePrefix(x: string): x is IdrRefTypePrefix {
  return (TYPE_PREFIXES as readonly string[]).includes(x);
}

export type IdrRefSegments = {
  typePrefix: IdrRefTypePrefix;
  documentCode: string;
  /** Section position code without leading `s` (e.g. `0` → `:s0`). */
  section?: string;
  /** Article id after `art.` (e.g. `I`, `en`, `15`). */
  article?: string;
  /** Paragraph id after `§` (e.g. `1`, `2`, `5-A`). */
  paragraph?: string;
  /** Clause id after `:cl:` (e.g. `1`, `a`). */
  clause?: string;
  /** Annex code — mutually exclusive with section…clause in this phase. */
  annex?: string;
};

export type IdrRefGrammarErrorCode =
  | "INVALID_NAMESPACE"
  | "INVALID_TYPE_PREFIX"
  | "INVALID_DOCUMENT_CODE"
  | "INVALID_ANNEX"
  | "INVALID_SECTION"
  | "INVALID_ARTICLE"
  | "INVALID_PARAGRAPH"
  | "INVALID_CLAUSE"
  | "HIERARCHY_GAP"
  | "TRAILING_SEGMENTS"
  | "ANNEX_WITH_HIERARCHY"
  | "EMPTY_INPUT";

export class IdrRefGrammarError extends Error {
  readonly code: IdrRefGrammarErrorCode;

  constructor(code: IdrRefGrammarErrorCode, message: string) {
    super(message);
    this.name = "IdrRefGrammarError";
    this.code = code;
  }
}

/** Segment codes (section, article, paragraph, clause) — lowercase only (Pilot Fase 3). */
const CODE_LOWER = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$|^[a-z0-9]$/;

function assertLowerCode(label: string, value: string, code: IdrRefGrammarErrorCode): void {
  if (!CODE_LOWER.test(value)) {
    throw new IdrRefGrammarError(code, `${label} has invalid characters or shape: ${JSON.stringify(value)}`);
  }
}

function assertHierarchyCode(label: string, value: string, code: IdrRefGrammarErrorCode): void {
  assertLowerCode(label, value, code);
}

/**
 * Builds canonical idrRef string from structured segments.
 */
export function composeIdrRef(segments: IdrRefSegments): string {
  const { typePrefix, documentCode } = segments;
  if (!isTypePrefix(typePrefix)) {
    throw new IdrRefGrammarError("INVALID_TYPE_PREFIX", `Unknown type prefix: ${typePrefix}`);
  }
  assertLowerCode("documentCode", documentCode, "INVALID_DOCUMENT_CODE");

  if (segments.annex !== undefined) {
    if (
      segments.section !== undefined ||
      segments.article !== undefined ||
      segments.paragraph !== undefined ||
      segments.clause !== undefined
    ) {
      throw new IdrRefGrammarError(
        "ANNEX_WITH_HIERARCHY",
        "Annex path cannot combine with section/article/paragraph/clause segments",
      );
    }
    assertLowerCode("annex", segments.annex, "INVALID_ANNEX");
    return `idr:${typePrefix}:${documentCode}:annex:${segments.annex}`;
  }

  const hasS = segments.section !== undefined;
  const hasArt = segments.article !== undefined;
  const hasPar = segments.paragraph !== undefined;
  const hasCl = segments.clause !== undefined;

  if (hasCl && (!hasS || !hasArt || !hasPar)) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Clause requires section, article, and paragraph");
  }
  if (hasPar && (!hasS || !hasArt)) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Paragraph requires section and article");
  }
  if (hasArt && !hasS) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Article requires section");
  }

  let path = `idr:${typePrefix}:${documentCode}`;
  if (segments.section !== undefined) {
    assertHierarchyCode("section", segments.section, "INVALID_SECTION");
    path += `:s${segments.section}`;
  }
  if (segments.article !== undefined) {
    assertHierarchyCode("article", segments.article, "INVALID_ARTICLE");
    path += `:art.${segments.article}`;
  }
  if (segments.paragraph !== undefined) {
    assertHierarchyCode("paragraph", segments.paragraph, "INVALID_PARAGRAPH");
    path += `:§${segments.paragraph}`;
  }
  if (segments.clause !== undefined) {
    assertHierarchyCode("clause", segments.clause, "INVALID_CLAUSE");
    path += `:cl:${segments.clause}`;
  }
  return path;
}

function parseHierarchyAfterDoc(parts: string[], startIdx: number): Omit<IdrRefSegments, "typePrefix" | "documentCode"> {
  let i = startIdx;
  let section: string | undefined;
  let article: string | undefined;
  let paragraph: string | undefined;
  let clause: string | undefined;

  const expectSection = (): void => {
    const seg = parts[i];
    if (!seg?.startsWith("s") || seg.length < 2) {
      throw new IdrRefGrammarError("INVALID_SECTION", `Expected :s… segment, got ${JSON.stringify(seg)}`);
    }
    const code = seg.slice(1);
    assertHierarchyCode("section", code, "INVALID_SECTION");
    section = code;
    i += 1;
  };

  const expectArticle = (): void => {
    const seg = parts[i];
    if (!seg?.startsWith("art.")) {
      throw new IdrRefGrammarError("INVALID_ARTICLE", `Expected :art.… segment, got ${JSON.stringify(seg)}`);
    }
    const code = seg.slice("art.".length);
    assertHierarchyCode("article", code, "INVALID_ARTICLE");
    article = code;
    i += 1;
  };

  const expectParagraph = (): void => {
    const seg = parts[i];
    if (!seg?.startsWith("§")) {
      throw new IdrRefGrammarError("INVALID_PARAGRAPH", `Expected :§… segment, got ${JSON.stringify(seg)}`);
    }
    const code = seg.slice(1);
    assertHierarchyCode("paragraph", code, "INVALID_PARAGRAPH");
    paragraph = code;
    i += 1;
  };

  const expectClause = (): void => {
    if (parts[i] !== "cl") {
      throw new IdrRefGrammarError("INVALID_CLAUSE", `Expected :cl:… marker, got ${JSON.stringify(parts[i])}`);
    }
    i += 1;
    const rest = parts[i];
    if (rest === undefined) {
      throw new IdrRefGrammarError("INVALID_CLAUSE", "Missing clause id after :cl:");
    }
    assertHierarchyCode("clause", rest, "INVALID_CLAUSE");
    clause = rest;
    i += 1;
  };

  if (i < parts.length) {
    expectSection();
  }
  if (i < parts.length) {
    expectArticle();
  }
  if (i < parts.length) {
    expectParagraph();
  }
  if (i < parts.length) {
    expectClause();
  }

  if (i < parts.length) {
    throw new IdrRefGrammarError("TRAILING_SEGMENTS", `Unexpected trailing segments: ${parts.slice(i).join(":")}`);
  }

  const hasS = section !== undefined;
  const hasArt = article !== undefined;
  const hasPar = paragraph !== undefined;
  const hasCl = clause !== undefined;

  if (hasCl && (!hasS || !hasArt || !hasPar)) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Clause path requires section, article, and paragraph");
  }
  if (hasPar && (!hasS || !hasArt)) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Paragraph requires section and article");
  }
  if (hasArt && !hasS) {
    throw new IdrRefGrammarError("HIERARCHY_GAP", "Article requires section");
  }

  return { section, article, paragraph, clause };
}

/**
 * Parses canonical idrRef into structured segments.
 */
export function parseIdrRef(ref: string): IdrRefSegments {
  if (!ref || ref.trim() === "") {
    throw new IdrRefGrammarError("EMPTY_INPUT", "idrRef is empty");
  }
  if (!ref.startsWith("idr:")) {
    throw new IdrRefGrammarError("INVALID_NAMESPACE", 'idrRef must start with "idr:"');
  }

  const parts = ref.split(":");
  if (parts.length < 3 || parts[0] !== "idr") {
    throw new IdrRefGrammarError("INVALID_NAMESPACE", "Malformed idrRef namespace");
  }

  const typePrefix = parts[1];
  if (!typePrefix || !isTypePrefix(typePrefix)) {
    throw new IdrRefGrammarError("INVALID_TYPE_PREFIX", `Invalid type prefix: ${JSON.stringify(typePrefix)}`);
  }

  const documentCode = parts[2];
  if (!documentCode) {
    throw new IdrRefGrammarError("INVALID_DOCUMENT_CODE", "Missing document code");
  }
  assertLowerCode("documentCode", documentCode, "INVALID_DOCUMENT_CODE");

  if (parts[3] === "annex") {
    const annex = parts[4];
    if (annex === undefined || annex === "") {
      throw new IdrRefGrammarError("INVALID_ANNEX", "Missing annex code");
    }
    if (parts.length > 5) {
      throw new IdrRefGrammarError("TRAILING_SEGMENTS", "Unexpected segments after annex path");
    }
    assertLowerCode("annex", annex, "INVALID_ANNEX");
    return { typePrefix, documentCode, annex };
  }

  const rest = parseHierarchyAfterDoc(parts, 3);
  return { typePrefix, documentCode, ...rest };
}

export type ValidateIdrRefOk = { ok: true };
export type ValidateIdrRefFail = { ok: false; reason: string; code?: IdrRefGrammarErrorCode };
export type ValidateIdrRefResult = ValidateIdrRefOk | ValidateIdrRefFail;

export function validateIdrRef(ref: string): ValidateIdrRefResult {
  try {
    parseIdrRef(ref);
    return { ok: true };
  } catch (e) {
    if (e instanceof IdrRefGrammarError) {
      return { ok: false, reason: e.message, code: e.code };
    }
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
