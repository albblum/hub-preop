import { describe } from "vitest";
import { prisma } from "@/lib/prisma";

/** Skip entire suite when `SKIP_DB=1` (see `npm run test:no-db`). */
export const describeIfDb = process.env.SKIP_DB === "1" ? describe.skip : describe;

export type MinimalV2ClauseFixture = {
  instrumentId: string;
  clauseId: string;
  clauseIdrRef: string;
  documentIdrRef: string;
};

/**
 * Creates a minimal v2 instrument + normative chain ending in an empty clause (no ClauseVersion yet).
 * Caller should delete the instrument when done (cascades tree).
 */
export async function createMinimalV2ClauseFixture(suffix: string): Promise<MinimalV2ClauseFixture> {
  const docCode = `testnorm-${suffix}`;
  const documentIdrRef = `idr:c:${docCode}`;
  const clauseIdrRef = `idr:c:${docCode}:s0:art.en:§1:cl:1`;

  const inst = await prisma.instrument.create({
    data: {
      idrRef: documentIdrRef,
      title: `Normative test fixture ${suffix}`,
      documentType: "constitutional",
      layer: 0,
      status: "DRAFT",
      currentVersion: 1,
      structuralProfile: "v2",
      semanticDocumentCode: docCode,
    },
  });

  const section = await prisma.normativeSection.create({
    data: {
      instrumentId: inst.id,
      position: 0,
      code: "s0",
    },
  });

  const article = await prisma.normativeArticle.create({
    data: {
      sectionId: section.id,
      position: 0,
      articleCode: "en",
    },
  });

  const paragraph = await prisma.normativeParagraph.create({
    data: {
      articleId: article.id,
      position: 0,
      paragraphCode: "1",
    },
  });

  const clause = await prisma.normativeClause.create({
    data: {
      paragraphId: paragraph.id,
      position: 0,
      clauseCode: "1",
      idrRef: clauseIdrRef,
    },
  });

  return {
    instrumentId: inst.id,
    clauseId: clause.id,
    clauseIdrRef,
    documentIdrRef,
  };
}

export async function deleteInstrumentCascade(instrumentId: string): Promise<void> {
  await prisma.instrument.deleteMany({ where: { id: instrumentId } });
}

/** Alias requested in Phase 2 handoff (same as {@link deleteInstrumentCascade}). */
export const withCleanV2Tables = deleteInstrumentCascade;
