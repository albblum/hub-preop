/**
 * Pilot load: idr:c:preop-regime (s0–s2, sunset metadata, s2 non-normative).
 *
 * Run after load-v2-constitutional-foundation.ts.
 * Usage: npx tsx scripts/load-v2-preop-regime.ts [--dry-run]
 */
import fs from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { registerIdrRef } from "../lib/normative/idr-ref-registry";
import { PREOP_CORPUS_REL, resolveCorpusPath } from "../lib/normative/load/corpus-paths";
import { composeClauseIdrRef, composeDocumentIdrRef } from "../lib/normative/load/compose-clause-ref";
import { countParsedArticles, mergeStats } from "../lib/normative/load/count-stats";
import {
  parseChangeLogSection,
  parseNormativeMarkdown,
  splitPreopCorpus,
} from "../lib/normative/load/parse-normative-markdown";
import {
  assertInstrumentAbsent,
  findInstrumentByDocumentIdr,
  persistPilotSection,
  type LoadStats,
} from "../lib/normative/load/persist-v2-tree";

const DOCUMENT_CODE = "preop-regime";
const DOCUMENT_IDR = composeDocumentIdrRef(DOCUMENT_CODE);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const fullMd = await fs.readFile(resolveCorpusPath(PREOP_CORPUS_REL), "utf8");
  const { enNormative, ptNormative, changeLog } = splitPreopCorpus(fullMd);

  const s0Articles = parseNormativeMarkdown(enNormative, { defaultArticleCode: "en" });
  const s1Articles = parseNormativeMarkdown(ptNormative, { defaultArticleCode: "pt" });
  const s2Articles = parseChangeLogSection(changeLog);

  const stats = mergeStats(
    countParsedArticles(s0Articles),
    countParsedArticles(s1Articles),
    countParsedArticles(s2Articles),
    { sections: 3 },
  );

  console.log(dryRun ? "DRY-RUN — idr:c:preop-regime" : "LOAD — idr:c:preop-regime");
  console.log(`  sections: ${stats.sections}`);
  console.log(`  articles: ${stats.articles}`);
  console.log(`  paragraphs: ${stats.paragraphs}`);
  console.log(`  clauses: ${stats.clauses}`);

  const sample = composeClauseIdrRef({
    documentCode: DOCUMENT_CODE,
    section: "s0",
    article: "en",
    paragraph: "5",
    clause: "3",
  });
  console.log(`  sample idrRef: ${sample}`);

  if (dryRun) {
    console.log("\nDry-run complete (no database writes).");
    return;
  }

  const parent = await findInstrumentByDocumentIdr("foundation");
  if (!parent) {
    throw new Error("idr:c:foundation not found — run load-v2-constitutional-foundation.ts first");
  }

  await assertInstrumentAbsent(DOCUMENT_CODE);

  const loadStats: LoadStats = {
    sections: 0,
    articles: 0,
    paragraphs: 0,
    clauses: 0,
    registryEntries: 0,
    sampleIdrRefs: [],
  };

  const instrument = await prisma.$transaction(async (tx) => {
    const inst = await tx.instrument.create({
      data: {
        idrRef: DOCUMENT_IDR,
        title: "Foundational Norm — Pre-Operational Stage",
        documentType: "constitutional",
        layer: 1,
        status: "foundational-provisional",
        currentVersion: 1,
        structuralProfile: "v2",
        semanticDocumentCode: DOCUMENT_CODE,
        parentInstrumentId: parent.id,
        terminationDate: new Date("2026-12-31"),
        terminationRequiresExplicitAct: true,
        terminationAuthorizedBy: "secretary_general",
        terminationConditions: [
          "committees_constituted",
          "committee_members_active",
          "formal_act_by_secretary_general",
        ],
        draftingAuthority: "load-v2-preop-regime",
      },
    });

    await registerIdrRef(tx, {
      idrRef: DOCUMENT_IDR,
      ownerKind: "instrument",
      ownerId: inst.id,
    });
    loadStats.registryEntries += 1;

    await persistPilotSection(
      tx,
      {
        instrumentId: inst.id,
        documentCode: DOCUMENT_CODE,
        sectionCode: "s0",
        position: 0,
        title: "Normative body (English)",
        migrationPhase: "pilot",
        articles: s0Articles,
      },
      loadStats,
    );

    await persistPilotSection(
      tx,
      {
        instrumentId: inst.id,
        documentCode: DOCUMENT_CODE,
        sectionCode: "s1",
        position: 1,
        title: "Normative body (Portuguese)",
        migrationPhase: "pilot",
        articles: s1Articles,
      },
      loadStats,
    );

    await persistPilotSection(
      tx,
      {
        instrumentId: inst.id,
        documentCode: DOCUMENT_CODE,
        sectionCode: "s2",
        position: 2,
        title: "Change Log and ratification",
        migrationPhase: "pilot",
        nonNormative: true,
        articles: s2Articles,
      },
      loadStats,
    );

    return inst;
  });

  console.log(`\nLoaded ${DOCUMENT_IDR} (id=${instrument.id}, parent=${parent.idrRef})`);
  console.log(
    `  sections=${loadStats.sections} clauses=${loadStats.clauses} registry=${loadStats.registryEntries + 1}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
