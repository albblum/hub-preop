import { describe, expect, it } from "vitest";
import {
  assertPreamblePtSection6Valid,
  parseNormativeMarkdown,
  splitPreopCorpus,
} from "./parse-normative-markdown";
import { normalizeParagraphCode } from "./normalize-segment";
import { composeClauseIdrRef } from "./compose-clause-ref";

describe("parse-normative-markdown", () => {
  it("normalizes §5-A and §2.0 paragraph codes", () => {
    expect(normalizeParagraphCode("5-A")).toBe("5-a");
    expect(normalizeParagraphCode("2.0")).toBe("2");
  });

  it("parses single-body and alinea paragraphs", () => {
    const md = `
	§1 Body one.

	§2 Intro:
		(i) first;
		(ii) second.

---

	§1 Corpo um.
`;
    const articles = parseNormativeMarkdown(md);
    expect(articles).toHaveLength(2);
    expect(articles[0].paragraphs).toHaveLength(2);
    expect(articles[0].paragraphs[1].paragraphCode).toBe("2");
    expect(articles[0].paragraphs[1].clauses.length).toBeGreaterThanOrEqual(2);
    expect(articles[0].paragraphs[1].clauses[0].clauseCode).toBe("1");
  });

  it("composes lowercase idrRef for §5-a", () => {
    const ref = composeClauseIdrRef({
      documentCode: "foundation",
      section: "s2",
      article: "en",
      paragraph: "5-a",
      clause: "1",
    });
    expect(ref).toBe("idr:c:foundation:s2:art.en:§5-a:cl:1");
  });

  it("validates clean preamble PT §6", () => {
    const md = `
	§1 EN.

---

	§5 PT principles:
		i) one;
		ii) two;
		iii) three;
		iv) four;
		v) five;

	§6 Para esse fim:
		i) a;
		ii) b;
		iii) c;
		iv) d;
		v) e;

	§7 End.
`;
    expect(() => assertPreamblePtSection6Valid(md)).not.toThrow();
  });

  it("rejects preamble PT with stray code fence", () => {
    const md = "\t§1 EN.\n\n---\n\n" + "```\n§6 corrupt\n```\n";
    expect(() => assertPreamblePtSection6Valid(md)).toThrow(/```/);
  });

  it("splits preop corpus into EN, PT, and change log", () => {
    const md = `
	§1 EN text.

---

Change Log Entry
DocID: x
Registered date.
`;
    const parts = splitPreopCorpus(md);
    expect(parts.enNormative).toContain("§1");
    expect(parts.changeLog).toContain("Change Log");
  });
});
