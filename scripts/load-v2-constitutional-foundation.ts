/**
 * Pilot load: idr:c:foundation (s0+s2 pilot, s1/s3–s8 deferred) + HUB-INSTR aliases.
 *
 * Usage: npx tsx scripts/load-v2-constitutional-foundation.ts [--dry-run]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { registerIdrRef } from "../lib/normative/idr-ref-registry";
import {
  FOUNDATION_CORPUS_REL,
  resolveCorpusPath,
} from "../lib/normative/load/corpus-paths";
import { composeClauseIdrRef, composeDocumentIdrRef } from "../lib/normative/load/compose-clause-ref";
import { countParsedArticles, mergeStats } from "../lib/normative/load/count-stats";
import { registerFoundationLegacyAliases } from "../lib/normative/load/legacy-aliases";
import {
  assertPreamblePtSection6Valid,
  parseNormativeMarkdown,
} from "../lib/normative/load/parse-normative-markdown";
import {
  assertInstrumentAbsent,
  persistPilotSection,
  type LoadStats,
} from "../lib/normative/load/persist-v2-tree";

const DOCUMENT_CODE = "foundation";
const DOCUMENT_IDR = composeDocumentIdrRef(DOCUMENT_CODE);

const DEFERRED_SECTIONS: { code: string; position: number; title: string }[] = [
  { code: "s1", position: 1, title: "Introduction" },
  { code: "s3", position: 3, title: "Article II — Data Sovereignty" },
  { code: "s4", position: 4, title: "Article III — The Asymmetry Problem" },
  { code: "s5", position: 5, title: "Article IV — Constitutional Basis" },
  { code: "s6", position: 6, title: "Article V — Scope and Application" },
  { code: "s7", position: 7, title: "Article VI — National and Supranational" },
  { code: "s8", position: 8, title: "Article VII — Non-discrimination" },
];

function printStats(label: string, stats: LoadStats, sampleFrom?: ParsedArticle[][]): void {
  console.log(`\n${label}`);
  console.log(`  sections: ${stats.sections}`);
  console.log(`  articles: ${stats.articles}`);
  console.log(`  paragraphs: ${stats.paragraphs}`);
  console.log(`  clauses: ${stats.clauses}`);
  if (sampleFrom) {
    const samples: string[] = [];
    for (const articles of sampleFrom) {
      for (const a of articles) {
        for (const p of a.paragraphs) {
          for (const c of p.clauses) {
            if (samples.length >= 6) break;
            samples.push(
              composeClauseIdrRef({
                documentCode: DOCUMENT_CODE,
                section: label.includes("s2") ? "s2" : "s0",
                article: a.articleCode,
                paragraph: p.paragraphCode,
                clause: c.clauseCode,
              }),
            );
          }
        }
      }
    }
    if (samples.length) {
      console.log("  sample idrRef:");
      for (const s of samples) console.log(`    ${s}`);
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const corpusDir = resolveCorpusPath(FOUNDATION_CORPUS_REL);

  const preamblePath = path.join(corpusDir, "PREAMBLE.md");
  const articleIPath = path.join(corpusDir, "ARTICLE I · RIGHTS IN PRODUCED DATA.md");

  const [preambleMd, articleIMd] = await Promise.all([
    fs.readFile(preamblePath, "utf8"),
    fs.readFile(articleIPath, "utf8"),
  ]);

  assertPreamblePtSection6Valid(preambleMd);

  const s0Articles = parseNormativeMarkdown(preambleMd);
  const s2Articles = parseNormativeMarkdown(articleIMd);

  const pilotCounts = mergeStats(
    countParsedArticles(s0Articles),
    countParsedArticles(s2Articles),
    { sections: 2 + DEFERRED_SECTIONS.length },
  );

  console.log(dryRun ? "DRY-RUN — idr:c:foundation" : "LOAD — idr:c:foundation");
  printStats("Pilot s0 (Preamble)", { ...pilotCounts, sections: 1 }, [s0Articles]);
  printStats("Pilot s2 (Article I)", { ...pilotCounts, sections: 1 }, [s2Articles]);
  console.log(`\nDeferred sections (structure only): ${DEFERRED_SECTIONS.map((s) => s.code).join(", ")}`);

  if (dryRun) {
    console.log("\nDry-run complete (no database writes).");
    return;
  }

  await assertInstrumentAbsent(DOCUMENT_CODE);

  const stats: LoadStats = {
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
        title: "I. Constitutional Foundation",
        documentType: "constitutional",
        layer: 0,
        status: "in-force",
        currentVersion: 1,
        structuralProfile: "v2",
        semanticDocumentCode: DOCUMENT_CODE,
        draftingAuthority: "load-v2-constitutional-foundation",
      },
    });

    await registerIdrRef(tx, {
      idrRef: DOCUMENT_IDR,
      ownerKind: "instrument",
      ownerId: inst.id,
    });
    stats.registryEntries += 1;

    await persistPilotSection(
      tx,
      {
        instrumentId: inst.id,
        documentCode: DOCUMENT_CODE,
        sectionCode: "s0",
        position: 0,
        title: "Preamble",
        migrationPhase: "pilot",
        articles: s0Articles,
      },
      stats,
    );

    await persistPilotSection(
      tx,
      {
        instrumentId: inst.id,
        documentCode: DOCUMENT_CODE,
        sectionCode: "s2",
        position: 2,
        title: "Article I — Rights in Produced Data",
        migrationPhase: "pilot",
        articles: s2Articles,
      },
      stats,
    );

    for (const def of DEFERRED_SECTIONS) {
      await persistPilotSection(
        tx,
        {
          instrumentId: inst.id,
          documentCode: DOCUMENT_CODE,
          sectionCode: def.code,
          position: def.position,
          title: def.title,
          migrationPhase: "deferred",
        },
        stats,
      );
    }

    const aliasRows = await registerFoundationLegacyAliases(tx, inst.id);
    console.log(`\nLegacy aliases registered: ${aliasRows.length}`);
    for (const row of aliasRows) {
      console.log(`  ${row.legacyRef} → ${row.canonicalRef} (${row.note})`);
    }

    return inst;
  });

  console.log(`\nLoaded ${DOCUMENT_IDR} (id=${instrument.id})`);
  console.log(
    `  sections=${stats.sections} clauses=${stats.clauses} registry=${stats.registryEntries + 1}`,
  );
  if (stats.sampleIdrRefs.length) {
    console.log("  sample idrRef:");
    for (const s of stats.sampleIdrRefs) console.log(`    ${s}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
