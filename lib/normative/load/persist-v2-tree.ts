import type { NormativeMigrationPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendClauseVersion } from "../clause-version";
import { registerIdrRef } from "../idr-ref-registry";
import type { NormativeTx } from "../types";
import { composeClauseIdrRef, composeDocumentIdrRef } from "./compose-clause-ref";
import type { ParsedArticle } from "./types";

export type LoadStats = {
  sections: number;
  articles: number;
  paragraphs: number;
  clauses: number;
  registryEntries: number;
  sampleIdrRefs: string[];
};

export type PersistSectionInput = {
  instrumentId: string;
  documentCode: string;
  sectionCode: string;
  position: number;
  title?: string;
  migrationPhase?: NormativeMigrationPhase;
  nonNormative?: boolean;
  articles?: ParsedArticle[];
};

async function persistArticles(
  tx: NormativeTx,
  input: {
    instrumentId: string;
    documentCode: string;
    sectionId: string;
    sectionCode: string;
    articles: ParsedArticle[];
    stats: LoadStats;
  },
): Promise<void> {
  for (let ai = 0; ai < input.articles.length; ai++) {
    const art = input.articles[ai];
    const article = await tx.normativeArticle.create({
      data: {
        sectionId: input.sectionId,
        position: ai,
        articleCode: art.articleCode,
      },
    });
    input.stats.articles += 1;

    for (let pi = 0; pi < art.paragraphs.length; pi++) {
      const par = art.paragraphs[pi];
      const paragraph = await tx.normativeParagraph.create({
        data: {
          articleId: article.id,
          position: pi,
          paragraphCode: par.paragraphCode,
        },
      });
      input.stats.paragraphs += 1;

      for (let ci = 0; ci < par.clauses.length; ci++) {
        const cl = par.clauses[ci];
        const idrRef = composeClauseIdrRef({
          documentCode: input.documentCode,
          section: input.sectionCode,
          article: art.articleCode,
          paragraph: par.paragraphCode,
          clause: cl.clauseCode,
        });

        const clause = await tx.normativeClause.create({
          data: {
            paragraphId: paragraph.id,
            position: ci,
            clauseCode: cl.clauseCode,
            idrRef,
          },
        });
        input.stats.clauses += 1;
        if (input.stats.sampleIdrRefs.length < 8) {
          input.stats.sampleIdrRefs.push(idrRef);
        }

        await registerIdrRef(tx, {
          idrRef,
          ownerKind: "clause",
          ownerId: clause.id,
        });
        input.stats.registryEntries += 1;

        await appendClauseVersion(tx, {
          clauseId: clause.id,
          body: cl.body,
          revisionNote: "pilot load v2 phase 3",
          createdBy: "load-v2-pilot",
        });
      }
    }
  }
}

export async function persistPilotSection(
  tx: NormativeTx,
  input: PersistSectionInput,
  stats: LoadStats,
): Promise<string> {
  const section = await tx.normativeSection.create({
    data: {
      instrumentId: input.instrumentId,
      position: input.position,
      code: input.sectionCode,
      title: input.title ?? null,
      migrationPhase: input.migrationPhase ?? null,
      nonNormative: input.nonNormative ?? false,
    },
  });
  stats.sections += 1;

  if (input.articles?.length) {
    await persistArticles(tx, {
      instrumentId: input.instrumentId,
      documentCode: input.documentCode,
      sectionId: section.id,
      sectionCode: input.sectionCode,
      articles: input.articles,
      stats,
    });
  }

  return section.id;
}

export async function findInstrumentByDocumentIdr(documentCode: string) {
  const idrRef = composeDocumentIdrRef(documentCode);
  return prisma.instrument.findUnique({ where: { idrRef } });
}

export async function assertInstrumentAbsent(documentCode: string): Promise<void> {
  const existing = await findInstrumentByDocumentIdr(documentCode);
  if (existing) {
    throw new Error(
      `Instrument ${composeDocumentIdrRef(documentCode)} already exists (id=${existing.id}). Delete manually or document re-run policy.`,
    );
  }
}
