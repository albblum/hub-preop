/**
 * Remove lab DB noise from Vitest reliability/transition suites (Option A).
 * Keeps founding placeholders 00009001–00009003 and all semantic idrRefs.
 *
 * Run: `npm run db:cleanup-test-instruments`
 * Dry-run: `npm run db:cleanup-test-instruments -- --dry-run`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** First idrRef allocated by automated DB tests (after founding seed). */
export const TEST_ARTIFACT_IDR_REF_MIN = "idr:HUB-INSTR-00009004";
/** Upper bound observed from reliability + transition-monolith test runs. */
export const TEST_ARTIFACT_IDR_REF_MAX = "idr:HUB-INSTR-00009119";

const PRESERVED_SEMANTIC = [
  "idr:c:foundation",
  "idr:c:preop-regime",
  "idr:i:sg:nomination:provisional-members:v1",
] as const;

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
    where: {
      idrRef: { gte: TEST_ARTIFACT_IDR_REF_MIN, lte: TEST_ARTIFACT_IDR_REF_MAX },
    },
    select: { id: true, idrRef: true, title: true },
    orderBy: { idrRef: "asc" },
  });

  console.log(
    dryRun ? "DRY-RUN — test instrument cleanup (Option A)" : "DELETE — test instrument cleanup (Option A)",
  );
  console.log(`Range: ${TEST_ARTIFACT_IDR_REF_MIN} … ${TEST_ARTIFACT_IDR_REF_MAX}`);
  console.log(`Candidates: ${toDelete.length}`);

  if (toDelete.length > 0 && toDelete.length <= 10) {
    for (const row of toDelete) {
      console.log(`  - ${row.idrRef}  ${row.title}`);
    }
  } else if (toDelete.length > 10) {
    console.log(`  first: ${toDelete[0]?.idrRef}`);
    console.log(`  last:  ${toDelete[toDelete.length - 1]?.idrRef}`);
  }

  if (!dryRun && toDelete.length > 0) {
    const result = await prisma.instrument.deleteMany({
      where: {
        idrRef: { gte: TEST_ARTIFACT_IDR_REF_MIN, lte: TEST_ARTIFACT_IDR_REF_MAX },
      },
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
