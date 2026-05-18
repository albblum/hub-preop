import type { NormativeMigrationPhase } from "@prisma/client";
import type { NormativeTx } from "./types";

export type V2ClauseAggregateNode = {
  clauseId: string;
  position: number;
  body: string;
  clauseVersionId: string;
};

export type V2ParagraphAggregateNode = {
  position: number;
  clauses: V2ClauseAggregateNode[];
};

export type V2ArticleAggregateNode = {
  position: number;
  paragraphs: V2ParagraphAggregateNode[];
};

export type V2SectionAggregateNode = {
  code: string;
  position: number;
  title: string | null;
  nonNormative: boolean;
  migrationPhase: NormativeMigrationPhase | null;
  articles: V2ArticleAggregateNode[];
};

export type V2SectionSummary = {
  code: string;
  position: number;
  nonNormative: boolean;
  migrationPhase: NormativeMigrationPhase | null;
};

export async function loadV2SectionsSummary(
  db: NormativeTx,
  instrumentId: string,
): Promise<V2SectionSummary[]> {
  const rows = await db.normativeSection.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    select: {
      code: true,
      position: true,
      nonNormative: true,
      migrationPhase: true,
    },
  });
  return rows.map((r) => ({
    code: r.code,
    position: r.position,
    nonNormative: r.nonNormative,
    migrationPhase: r.migrationPhase,
  }));
}

/**
 * Loads the normative tree with current clause bodies for aggregation / read paths.
 */
export async function loadV2TreeForAggregate(
  db: NormativeTx,
  instrumentId: string,
): Promise<V2SectionAggregateNode[]> {
  const sections = await db.normativeSection.findMany({
    where: { instrumentId },
    orderBy: { position: "asc" },
    include: {
      articles: {
        orderBy: { position: "asc" },
        include: {
          paragraphs: {
            orderBy: { position: "asc" },
            include: {
              clauses: {
                orderBy: { position: "asc" },
                include: {
                  versions: {
                    where: { isCurrent: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return sections.map((section) => ({
    code: section.code,
    position: section.position,
    title: section.title,
    nonNormative: section.nonNormative,
    migrationPhase: section.migrationPhase,
    articles: section.articles.map((article) => ({
      position: article.position,
      paragraphs: article.paragraphs.map((paragraph) => ({
        position: paragraph.position,
        clauses: paragraph.clauses
          .map((clause) => {
            const current = clause.versions[0];
            if (!current?.body) return null;
            return {
              clauseId: clause.id,
              position: clause.position,
              body: current.body,
              clauseVersionId: current.id,
            };
          })
          .filter((c): c is V2ClauseAggregateNode => c !== null),
      })),
    })),
  }));
}

export async function findInstrumentIdForClause(
  db: NormativeTx,
  clauseId: string,
): Promise<string | null> {
  const row = await db.normativeClause.findUnique({
    where: { id: clauseId },
    select: {
      paragraph: {
        select: {
          article: {
            select: {
              section: { select: { instrumentId: true } },
            },
          },
        },
      },
    },
  });
  return row?.paragraph.article.section.instrumentId ?? null;
}

export async function loadResolvedClause(
  db: NormativeTx,
  clauseId: string,
): Promise<{ idrRef: string; body: string; nonNormative: boolean } | null> {
  const row = await db.normativeClause.findUnique({
    where: { id: clauseId },
    select: {
      idrRef: true,
      versions: { where: { isCurrent: true }, take: 1, select: { body: true } },
      paragraph: {
        select: {
          article: {
            select: {
              section: { select: { nonNormative: true } },
            },
          },
        },
      },
    },
  });
  const body = row?.versions[0]?.body;
  if (!row || body === undefined) return null;
  return {
    idrRef: row.idrRef,
    body,
    nonNormative: row.paragraph.article.section.nonNormative,
  };
}
