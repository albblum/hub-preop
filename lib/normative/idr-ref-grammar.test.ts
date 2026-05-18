import { describe, expect, it } from "vitest";
import {
  composeIdrRef,
  IdrRefGrammarError,
  parseIdrRef,
  validateIdrRef,
} from "./idr-ref-grammar";

describe("idr-ref-grammar", () => {
  it("round-trips ADR examples", () => {
    const samples = [
      "idr:c:foundation",
      "idr:c:foundation:s0:art.en:§1:cl:1",
      "idr:o:2.5:s5:art.15:§2:cl:1",
      "idr:c:foundation:annex:definitions",
    ];
    for (const s of samples) {
      expect(composeIdrRef(parseIdrRef(s))).toBe(s);
    }
  });

  it("composes art.en example from prompt", () => {
    expect(
      composeIdrRef({
        typePrefix: "c",
        documentCode: "foundation",
        section: "0",
        article: "en",
        paragraph: "5",
        clause: "1",
      }),
    ).toBe("idr:c:foundation:s0:art.en:§5:cl:1");
  });

  it("rejects hierarchy gap (clause without article/paragraph)", () => {
    expect(() => parseIdrRef("idr:c:foundation:cl:1")).toThrow(IdrRefGrammarError);
    expect(validateIdrRef("idr:c:foundation:cl:1").ok).toBe(false);
  });

  it("accepts lowercase paragraph suffix (§5-a)", () => {
    const ref = "idr:c:foundation:s2:art.en:§5-a:cl:1";
    expect(parseIdrRef(ref).paragraph).toBe("5-a");
    expect(composeIdrRef(parseIdrRef(ref))).toBe(ref);
  });

  it("rejects uppercase hierarchy segments (art.I)", () => {
    expect(validateIdrRef("idr:c:foundation:s0:art.I:§1:cl:1").ok).toBe(false);
  });

  it("rejects invalid characters in codes", () => {
    expect(validateIdrRef("idr:c:Bad_Code:s0").ok).toBe(false);
  });

  it("rejects annex combined with hierarchy in compose", () => {
    expect(() =>
      composeIdrRef({
        typePrefix: "c",
        documentCode: "foundation",
        annex: "x",
        section: "0",
      }),
    ).toThrow(IdrRefGrammarError);
  });
});
