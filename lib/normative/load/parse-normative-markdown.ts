import { normalizeParagraphCode, normalizeSegmentCode } from "./normalize-segment";
import type { ParsedArticle, ParsedClause, ParsedLanguageBlock, ParsedParagraph } from "./types";

const PARAGRAPH_START =
  /^\s*§\s*(\d+(?:\.\d+)?)(?:\.0)?(?:\s*[-–]\s*([A-Za-z]))?\.?\s*(.*)$/;

const CLAUSE_LINE =
  /^\s*(?:\(([ivxlcdm]+)\)|(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xi{0,3}))\s*[.:]?\s*(.*)$/i;

const ROMAN_TO_NUM: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
  ix: "9",
  x: "10",
};

function clauseCodeFromMarker(marker: string): string {
  const m = marker.toLowerCase().replace(/[()]/g, "");
  if (/^\d+$/.test(m)) return m;
  return ROMAN_TO_NUM[m] ?? normalizeSegmentCode(m);
}

function parseParagraphBody(lines: string[]): ParsedParagraph | null {
  const first = lines[0];
  if (!first) return null;
  const match = PARAGRAPH_START.exec(first);
  if (!match) return null;

  const paragraphCode = normalizeParagraphCode(
    match[2] ? `${match[1]}-${match[2]}` : match[1],
  );
  const restLines = [...lines];
  if (match[3]?.trim()) {
    restLines[0] = match[3];
  } else {
    restLines.shift();
  }

  const clauses: ParsedClause[] = [];
  let current: { code: string; parts: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.parts.join("\n").trim();
    if (body) {
      clauses.push({ clauseCode: current.code, body });
    }
    current = null;
  };

  for (const line of restLines) {
    const cm = CLAUSE_LINE.exec(line);
    if (cm) {
      flush();
      const marker = cm[1] ?? cm[2];
      current = { code: clauseCodeFromMarker(marker), parts: [] };
      if (cm[3]?.trim()) current.parts.push(cm[3].trim());
      continue;
    }
    if (current) {
      current.parts.push(line);
    } else if (line.trim()) {
      if (!current) {
        current = { code: "1", parts: [line] };
      }
    }
  }
  flush();

  if (clauses.length === 0) {
    const body = restLines.join("\n").trim();
    if (body) clauses.push({ clauseCode: "1", body });
  }

  return { paragraphCode, clauses };
}

function splitLanguageBlocks(content: string): ParsedLanguageBlock[] {
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];

  const enHeader = /^##\s*English\s*$/im;
  const ptHeader = /^##\s*(?:Portuguese|Português)\s*$/im;

  if (enHeader.test(trimmed) || ptHeader.test(trimmed)) {
    const blocks: ParsedLanguageBlock[] = [];
    const enMatch = trimmed.match(/##\s*English\s*([\s\S]*?)(?=##\s*(?:Portuguese|Português)|$)/i);
    const ptMatch = trimmed.match(/##\s*(?:Portuguese|Português)\s*([\s\S]*?)$/i);
    if (enMatch?.[1]?.trim()) {
      blocks.push({ articleCode: "en", paragraphs: extractParagraphs(enMatch[1]) });
    }
    if (ptMatch?.[1]?.trim()) {
      blocks.push({ articleCode: "pt", paragraphs: extractParagraphs(ptMatch[1]) });
    }
    return blocks;
  }

  const ptArticleMarker = /\n#{2,4}\s*ARTIGO\b/i;
  const ptIdx = trimmed.search(ptArticleMarker);
  if (ptIdx >= 0) {
    const enPart = trimmed.slice(0, ptIdx).trim();
    const ptPart = trimmed.slice(ptIdx).replace(/^#{2,4}\s*ARTIGO[^\n]*\n/i, "").trim();
    const blocks: ParsedLanguageBlock[] = [];
    if (enPart) blocks.push({ articleCode: "en", paragraphs: extractParagraphs(enPart) });
    if (ptPart) blocks.push({ articleCode: "pt", paragraphs: extractParagraphs(ptPart) });
    return blocks;
  }

  const parts = trimmed.split(/\n---\n/);
  if (parts.length >= 2) {
    return [
      { articleCode: "en", paragraphs: extractParagraphs(parts[0]) },
      { articleCode: "pt", paragraphs: extractParagraphs(parts.slice(1).join("\n---\n")) },
    ];
  }

  return [{ articleCode: "en", paragraphs: extractParagraphs(trimmed) }];
}

function extractParagraphs(block: string): ParsedParagraph[] {
  const cleaned = block
    .replace(/^#{1,6}\s+[^\n]+\n/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();

  const lines = cleaned.split("\n");
  const chunks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (PARAGRAPH_START.test(line) && current.length > 0) {
      chunks.push(current);
      current = [line];
    } else if (PARAGRAPH_START.test(line)) {
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current);

  const paragraphs: ParsedParagraph[] = [];
  for (const chunk of chunks) {
    const p = parseParagraphBody(chunk);
    if (p && p.clauses.length > 0) paragraphs.push(p);
  }
  return paragraphs;
}

/**
 * Parses bilingual normative markdown into articles (art.en / art.pt) with paragraphs and clauses.
 */
export function parseNormativeMarkdown(content: string): ParsedArticle[] {
  const blocks = splitLanguageBlocks(content);
  return blocks.map((b) => ({
    articleCode: normalizeSegmentCode(b.articleCode),
    paragraphs: b.paragraphs.map((p) => ({
      paragraphCode: normalizeSegmentCode(p.paragraphCode),
      clauses: p.clauses.map((c) => ({
        clauseCode: normalizeSegmentCode(c.clauseCode),
        body: c.body.trim(),
      })),
    })),
  }));
}

/**
 * Gate 3.7: PREAMBLE PT §6 must not contain corrupt markers (e.g. stray ```).
 */
export function assertPreamblePtSection6Valid(content: string): void {
  const parts = content.split(/\n---\n/);
  if (parts.length < 2) {
    throw new Error("PREAMBLE PT block not found — cannot validate §6");
  }
  const rawPt = parts.slice(1).join("\n---\n");

  if (/```/.test(rawPt)) {
    throw new Error(
      "PREAMBLE PT §6 gate failed: corrupt markdown (stray ```) in Portuguese block — escalate to Pilot",
    );
  }

  const ptBlock = splitLanguageBlocks(content).find((b) => b.articleCode === "pt");
  if (!ptBlock) {
    throw new Error("PREAMBLE PT block not found — cannot validate §6");
  }

  const s6 = ptBlock.paragraphs.find((p) => p.paragraphCode === "6");
  if (!s6) {
    throw new Error("PREAMBLE PT §6 not found — cannot load until PO validates source");
  }
  if (s6.clauses.length < 5) {
    throw new Error(
      `PREAMBLE PT §6 gate failed: expected at least 5 sub-clauses (i–v), got ${s6.clauses.length}`,
    );
  }
}

/** Splits preop file into EN normative, PT normative, and change-log tail. */
export function splitPreopCorpus(content: string): {
  enNormative: string;
  ptNormative: string;
  changeLog: string;
} {
  const changeLogIdx = content.search(/\nChange Log Entry\b/i);
  const enNormative =
    changeLogIdx >= 0 ? content.slice(0, changeLogIdx) : content.split(/\n---\n/)[0] ?? content;

  const ptMarker = content.search(/\nPT-BR\s*\n/i);
  const ptEnd = changeLogIdx >= 0 ? changeLogIdx : content.length;
  let ptNormative = "";
  if (ptMarker >= 0) {
    const afterPt = content.slice(ptMarker).replace(/^[\s\S]*?PT-BR\s*\n/i, "");
    const ptChangeIdx = afterPt.search(/\nChange Log Entry\b/i);
    ptNormative = ptChangeIdx >= 0 ? afterPt.slice(0, ptChangeIdx) : afterPt.slice(0, ptEnd - ptMarker);
  }

  const changeLog =
    changeLogIdx >= 0
      ? content.slice(changeLogIdx)
      : "";

  return {
    enNormative: enNormative.trim(),
    ptNormative: ptNormative.trim(),
    changeLog: changeLog.trim(),
  };
}

/** Change log blocks: one §1 / cl:1 per language article. */
export function parseChangeLogSection(content: string): ParsedArticle[] {
  const enPart = content.split(/\nPT-BR\b/i)[0] ?? content;
  const ptPart = content.includes("PT-BR") ? content.split(/\nPT-BR\b/i)[1] : "";

  const toArticle = (block: string, articleCode: string): ParsedArticle => {
    const body = block.replace(/Change Log Entry[\s\S]*?Phase:[^\n]*\n?/i, "").trim();
    const ratIdx = body.search(/\nRatified by\b/i);
    const main = ratIdx >= 0 ? body.slice(0, ratIdx).trim() : body;
    const rat = ratIdx >= 0 ? body.slice(ratIdx).trim() : "";

    const paragraphs: ParsedParagraph[] = [];
    if (main) {
      paragraphs.push({
        paragraphCode: "1",
        clauses: [{ clauseCode: "1", body: main }],
      });
    }
    if (rat) {
      paragraphs.push({
        paragraphCode: "2",
        clauses: [{ clauseCode: "1", body: rat }],
      });
    }
    if (paragraphs.length === 0 && block.trim()) {
      paragraphs.push({
        paragraphCode: "1",
        clauses: [{ clauseCode: "1", body: block.trim() }],
      });
    }
    return { articleCode, paragraphs };
  };

  const articles: ParsedArticle[] = [];
  if (enPart.trim()) articles.push(toArticle(enPart, "en"));
  if (ptPart?.trim()) articles.push(toArticle(ptPart, "pt"));
  return articles;
}
