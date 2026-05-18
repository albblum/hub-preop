import type { Instrument, InstrumentVersion } from "@prisma/client";
import { computeContentHash } from "@/lib/integrity/content-hash";
import { appendVersionLedger } from "@/lib/ledger/append-ledger";
import { prisma } from "@/lib/prisma";
import type { NormativeTx } from "./types";
import {
  loadV2TreeForAggregate,
  type V2ArticleAggregateNode,
  type V2ParagraphAggregateNode,
  type V2SectionAggregateNode,
} from "./read-v2-instrument";

/** Markdown section headers use `## {title || code}` (ADR 0015 §2.3). */
export const AGGREGATE_SECTION_HEADER_PREFIX = "## ";

export const AGGREGATE_SEP = {
  betweenClauses: "\n\n",
  betweenParagraphs: "\n\n",
  betweenArticles: "\n\n---\n\n",
  betweenSections: "\n\n---\n\n",
} as const;

export type AggregateInstrumentResult = {
  content: string;
  contentHash: string;
  clauseVersionIds: string[];
  versionNum: number;
};

function sectionHasClauseBody(section: V2SectionAggregateNode): boolean {
  for (const article of section.articles) {
    for (const paragraph of article.paragraphs) {
      if (paragraph.clauses.length > 0) return true;
    }
  }
  return false;
}

function joinNonEmpty(parts: string[], sep: string): string {
  const filtered = parts.filter((p) => p.length > 0);
  return filtered.join(sep);
}

function aggregateParagraph(paragraph: V2ParagraphAggregateNode): string {
  const bodies = paragraph.clauses
    .sort((a, b) => a.position - b.position)
    .map((c) => c.body);
  return joinNonEmpty(bodies, AGGREGATE_SEP.betweenClauses);
}

function aggregateArticle(article: V2ArticleAggregateNode): string {
  const parts = article.paragraphs
    .sort((a, b) => a.position - b.position)
    .map(aggregateParagraph)
    .filter((p) => p.length > 0);
  return joinNonEmpty(parts, AGGREGATE_SEP.betweenParagraphs);
}

function aggregateSection(section: V2SectionAggregateNode): string {
  const header = `${AGGREGATE_SECTION_HEADER_PREFIX}${section.title?.trim() || section.code}`;
  const articleParts = section.articles
    .sort((a, b) => a.position - b.position)
    .map(aggregateArticle)
    .filter((a) => a.length > 0);
  const body = joinNonEmpty(articleParts, AGGREGATE_SEP.betweenArticles);
  if (!body.length) return "";
  return `${header}\n\n${body}`;
}

/**
 * Builds reproducible aggregate Markdown from a loaded v2 tree (ADR 0015 §2.3).
 */
export function buildAggregateMarkdown(
  sections: V2SectionAggregateNode[],
): { content: string; clauseVersionIds: string[] } {
  const clauseVersionIds: string[] = [];
  const sectionParts: string[] = [];

  const ordered = [...sections].sort((a, b) => a.position - b.position);
  for (const section of ordered) {
    if (section.migrationPhase === "deferred") continue;
    if (!sectionHasClauseBody(section)) continue;

    for (const article of section.articles) {
      for (const paragraph of article.paragraphs) {
        for (const clause of paragraph.clauses) {
          clauseVersionIds.push(clause.clauseVersionId);
        }
      }
    }

    const md = aggregateSection(section);
    if (md.length) sectionParts.push(md);
  }

  return {
    content: joinNonEmpty(sectionParts, AGGREGATE_SEP.betweenSections),
    clauseVersionIds,
  };
}

async function resolveNextVersionNum(
  db: NormativeTx,
  instrument: Pick<Instrument, "id" | "currentVersion">,
): Promise<number> {
  const derivedCount = await db.instrumentVersion.count({
    where: { instrumentId: instrument.id, contentSourceKind: "derived" },
  });
  if (derivedCount === 0) {
    return 1;
  }
  return instrument.currentVersion + 1;
}

export async function aggregateInstrument(
  db: NormativeTx,
  instrumentId: string,
): Promise<AggregateInstrumentResult> {
  const instrument = await db.instrument.findUnique({
    where: { id: instrumentId },
    select: { id: true, currentVersion: true, structuralProfile: true },
  });
  if (!instrument) {
    throw new Error(`Instrument not found: ${instrumentId}`);
  }
  if (instrument.structuralProfile !== "v2") {
    throw new Error(`aggregateInstrument requires structuralProfile=v2 (id=${instrumentId})`);
  }

  const tree = await loadV2TreeForAggregate(db, instrumentId);
  const { content, clauseVersionIds } = buildAggregateMarkdown(tree);
  const versionNum = await resolveNextVersionNum(db, instrument);
  const contentHash = computeContentHash(versionNum, content);

  return { content, contentHash, clauseVersionIds, versionNum };
}

export type AggregateAndPersistOptions = {
  force?: boolean;
  /** When true, append instrument version ledger entry (default false for pilot aggregate job). */
  appendLedger?: boolean;
};

export type AggregateAndPersistResult = AggregateInstrumentResult & {
  instrumentRevisionId: string;
  instrumentVersionId: string;
  revisionNumber: number;
  skipped: boolean;
};

export async function aggregateAndPersistInstrument(
  instrumentId: string,
  options?: AggregateAndPersistOptions,
): Promise<AggregateAndPersistResult> {
  const force = options?.force ?? false;

  return prisma.$transaction(async (tx) => {
    const agg = await aggregateInstrument(tx, instrumentId);

    if (!force) {
      const latestDerived = await tx.instrumentVersion.findFirst({
        where: { instrumentId, contentSourceKind: "derived" },
        orderBy: { version: "desc" },
      });
      if (latestDerived && latestDerived.content === agg.content) {
        return {
          ...agg,
          versionNum: latestDerived.version,
          contentHash: latestDerived.contentHash,
          instrumentRevisionId: "",
          instrumentVersionId: latestDerived.id,
          revisionNumber: 0,
          skipped: true,
        };
      }
    }

    const inst = await tx.instrument.findUniqueOrThrow({
      where: { id: instrumentId },
      include: { currentVersionRecord: true },
    });

    const lastRevision = await tx.instrumentRevision.findFirst({
      where: { instrumentId },
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    });
    const revisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

    const revision = await tx.instrumentRevision.create({
      data: {
        instrumentId,
        revisionNumber,
        aggregateContentHash: agg.contentHash,
      },
    });

    if (agg.clauseVersionIds.length > 0) {
      await tx.instrumentRevisionClauseVersion.createMany({
        data: agg.clauseVersionIds.map((clauseVersionId) => ({
          instrumentRevisionId: revision.id,
          clauseVersionId,
        })),
      });
    }

    const prevHash = inst.currentVersionRecord?.contentHash ?? null;
    const version = await tx.instrumentVersion.create({
      data: {
        instrumentId,
        version: agg.versionNum,
        content: agg.content,
        contentHash: agg.contentHash,
        previousContentHash: prevHash,
        supersedesVersion:
          inst.currentVersionRecord && inst.currentVersionRecord.contentSourceKind === "derived"
            ? inst.currentVersionRecord.version
            : null,
        revisionNote: `derived aggregate rev ${revisionNumber}`,
        contentSourceKind: "derived",
      },
    });

    await tx.instrument.update({
      where: { id: instrumentId },
      data: {
        currentVersion: agg.versionNum,
        currentVersionRecordId: version.id,
      },
    });

    if (options?.appendLedger) {
      await appendVersionLedger(tx, {
        instrument: { id: inst.id, idrRef: inst.idrRef },
        version: { id: version.id, contentHash: version.contentHash },
      });
    }

    return {
      ...agg,
      instrumentRevisionId: revision.id,
      instrumentVersionId: version.id,
      revisionNumber,
      skipped: false,
    };
  });
}

/** In-memory aggregate for v2 read fallback when derived head is missing. */
export async function aggregateInstrumentReadFallback(
  instrumentId: string,
): Promise<Pick<AggregateInstrumentResult, "content" | "contentHash" | "versionNum">> {
  const agg = await aggregateInstrument(prisma, instrumentId);
  return {
    content: agg.content,
    contentHash: agg.contentHash,
    versionNum: agg.versionNum,
  };
}

export async function findInstrumentByIdOrIdrRef(
  db: NormativeTx,
  idOrIdrRef: string,
): Promise<Instrument | null> {
  return (
    (await db.instrument.findUnique({ where: { id: idOrIdrRef } })) ??
    (await db.instrument.findUnique({ where: { idrRef: idOrIdrRef } }))
  );
}

export function isDerivedHead(
  record: Pick<InstrumentVersion, "contentSourceKind"> | null | undefined,
): boolean {
  return record?.contentSourceKind === "derived";
}
