import { describe, expect, it } from "vitest";
import {
  AGGREGATE_SEP,
  AGGREGATE_SECTION_HEADER_PREFIX,
  buildAggregateMarkdown,
} from "./aggregate-instrument";
import type { V2SectionAggregateNode } from "./read-v2-instrument";

function fixtureTree(): V2SectionAggregateNode[] {
  return [
    {
      code: "s0",
      position: 0,
      title: "Preamble",
      nonNormative: false,
      migrationPhase: "pilot",
      articles: [
        {
          position: 0,
          paragraphs: [
            {
              position: 0,
              clauses: [
                {
                  clauseId: "c1",
                  position: 0,
                  body: "Alpha",
                  clauseVersionId: "cv1",
                },
                {
                  clauseId: "c2",
                  position: 1,
                  body: "Beta",
                  clauseVersionId: "cv2",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: "s1",
      position: 1,
      title: "Intro",
      nonNormative: false,
      migrationPhase: "deferred",
      articles: [
        {
          position: 0,
          paragraphs: [
            {
              position: 0,
              clauses: [
                {
                  clauseId: "c-deferred",
                  position: 0,
                  body: "Should not appear",
                  clauseVersionId: "cv-deferred",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: "s2",
      position: 2,
      title: null,
      nonNormative: true,
      migrationPhase: "pilot",
      articles: [
        {
          position: 0,
          paragraphs: [
            {
              position: 0,
              clauses: [
                {
                  clauseId: "c3",
                  position: 0,
                  body: "Gamma",
                  clauseVersionId: "cv3",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      code: "s3",
      position: 3,
      title: "Empty",
      nonNormative: false,
      migrationPhase: "pilot",
      articles: [],
    },
  ];
}

describe("buildAggregateMarkdown", () => {
  it("orders by position, excludes deferred and empty sections, uses fixed separators", () => {
    const { content, clauseVersionIds } = buildAggregateMarkdown(fixtureTree());

    expect(clauseVersionIds).toEqual(["cv1", "cv2", "cv3"]);
    expect(content).not.toContain("Should not appear");
    expect(content).not.toContain("Empty");

    const s0Block = `${AGGREGATE_SECTION_HEADER_PREFIX}Preamble\n\nAlpha${AGGREGATE_SEP.betweenClauses}Beta`;
    const s2Block = `${AGGREGATE_SECTION_HEADER_PREFIX}s2\n\nGamma`;
    expect(content).toBe([s0Block, s2Block].join(AGGREGATE_SEP.betweenSections));
  });

  it("is reproducible for the same tree input", () => {
    const tree = fixtureTree();
    const a = buildAggregateMarkdown(tree);
    const b = buildAggregateMarkdown(tree);
    expect(a.content).toBe(b.content);
    expect(a.clauseVersionIds).toEqual(b.clauseVersionIds);
  });
});
