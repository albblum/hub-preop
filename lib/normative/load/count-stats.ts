import type { ParsedArticle } from "./types";
import type { LoadStats } from "./persist-v2-tree";

export function countParsedArticles(articles: ParsedArticle[]): Omit<LoadStats, "sampleIdrRefs" | "registryEntries"> {
  let articlesN = 0;
  let paragraphs = 0;
  let clauses = 0;
  for (const a of articles) {
    articlesN += 1;
    for (const p of a.paragraphs) {
      paragraphs += 1;
      clauses += p.clauses.length;
    }
  }
  return { sections: 0, articles: articlesN, paragraphs, clauses };
}

export function mergeStats(...parts: Partial<LoadStats>[]): LoadStats {
  const base: LoadStats = {
    sections: 0,
    articles: 0,
    paragraphs: 0,
    clauses: 0,
    registryEntries: 0,
    sampleIdrRefs: [],
  };
  for (const p of parts) {
    base.sections += p.sections ?? 0;
    base.articles += p.articles ?? 0;
    base.paragraphs += p.paragraphs ?? 0;
    base.clauses += p.clauses ?? 0;
    base.registryEntries += p.registryEntries ?? 0;
    if (p.sampleIdrRefs?.length) {
      base.sampleIdrRefs.push(...p.sampleIdrRefs.slice(0, 8 - base.sampleIdrRefs.length));
    }
  }
  return base;
}
