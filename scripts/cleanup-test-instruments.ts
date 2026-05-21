/**
 * Remove lab DB noise from Vitest reliability/transition suites.
 * Deletes instruments whose title matches transition-* or reliability-*.
 * Does not use idrRef numeric ranges (avoids deleting institutional legacy rows).
 *
 * Run: `npm run db:cleanup-test-instruments`
 * Dry-run: `npm run db:cleanup-test-instruments -- --dry-run`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Vitest suites: reliability-flows, instrument-service.transition-monolith */
export const TEST_ARTIFACT_TITLE_PREFIXES = ["transition-", "reliability-"] as const;

const PRESERVED_SEMANTIC = [
  "idr:c:foundation",
  "idr:c:preop-regime",
  "idr:i:sg:nomination:provisional-members:v1",
] as const;

function testArtifactTitleWhere() {
  return {
    OR: TEST_ARTIFACT_TITLE_PREFIXES.map((prefix) => ({
      title: { startsWith: prefix },
    })),
  };
}

function seqFromIdrRef(idrRef: string): number {
  const m = idrRef.match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function syncIdrSequenceToMaxInstrument() {
  const rows = await prisma.instrument.findMany({
    where: { idrRef: { startsWith: "idr:HUB-INSTR-" } },
    select: { idrRef: true },
  });
  const maxSeq = rows.reduce((acc, r) => Math.max(acc, seqFromIdrRef(r.idrRef)), 0);
  await prisma.idrSequence.upsert({
    where: { key: "instrument" },
    create: { key: "instrument", next: maxSeq },
    update: { next: maxSeq },
  });
  return maxSeq;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const toDelete = await prisma.instrument.findMany({
    where: testArtifactTitleWhere(),
    select: { id: true, idrRef: true, title: true },
    orderBy: { idrRef: "asc" },
  });

  console.log(
    dryRun
      ? "DRY-RUN — test instrument cleanup (title filter)"
      : "DELETE — test instrument cleanup (title filter)",
  );
  console.log(`Title prefixes: ${TEST_ARTIFACT_TITLE_PREFIXES.join(", ")}`);
  console.log(`Candidates: ${toDelete.length}`);

  if (toDelete.length > 0 && toDelete.length <= 15) {
    for (const row of toDelete) {
      console.log(`  - ${row.idrRef}  ${row.title}`);
    }
  } else if (toDelete.length > 15) {
    console.log(`  first: ${toDelete[0]?.idrRef} (${toDelete[0]?.title})`);
    console.log(`  last:  ${toDelete[toDelete.length - 1]?.idrRef} (${toDelete[toDelete.length - 1]?.title})`);
  }

  if (!dryRun && toDelete.length > 0) {
    const result = await prisma.instrument.deleteMany({
      where: testArtifactTitleWhere(),
    });
    console.log(`Deleted: ${result.count}`);
    const nextSeq = await syncIdrSequenceToMaxInstrument();
    console.log(`IdrSequence instrument.next reset to ${nextSeq}`);
  }

  const remaining = await prisma.instrument.findMany({
    select: { idrRef: true, title: true },
    orderBy: { idrRef: "asc" },
  });
  console.log("\nRemaining instruments:");
  for (const row of remaining) {
    console.log(`  ${row.idrRef} — ${row.title}`);
  }

  const strayTestTitles = remaining.filter((r) =>
    TEST_ARTIFACT_TITLE_PREFIXES.some((p) => r.title.startsWith(p)),
  );
  if (strayTestTitles.length > 0) {
    console.error("\nERROR: test-title instruments still present:", strayTestTitles.length);
    process.exit(1);
  }

  const missingSemantic = PRESERVED_SEMANTIC.filter(
    (ref) => !remaining.some((r) => r.idrRef === ref),
  );
  if (missingSemantic.length > 0) {
    console.error("\nERROR: expected semantic instruments missing:", missingSemantic.join(", "));
    process.exit(1);
  }

  console.log("\nOK — institutional + founding placeholders intact.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
