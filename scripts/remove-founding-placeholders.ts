/**
 * Remove retired founding placeholder instruments from the lab DB.
 * Run: `npm run db:remove-founding-placeholders`
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const FOUNDING_PLACEHOLDER_IDR_REFS = [
  "idr:HUB-INSTR-00009001",
  "idr:HUB-INSTR-00009002",
  "idr:HUB-INSTR-00009003",
] as const;

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
  const found = await prisma.instrument.findMany({
    where: { idrRef: { in: [...FOUNDING_PLACEHOLDER_IDR_REFS] } },
    select: { id: true, idrRef: true, title: true },
    orderBy: { idrRef: "asc" },
  });

  console.log(dryRun ? "DRY-RUN — remove founding placeholders" : "DELETE — founding placeholders");
  console.log(`Targets: ${FOUNDING_PLACEHOLDER_IDR_REFS.join(", ")}`);
  console.log(`Found: ${found.length}`);
  for (const row of found) {
    console.log(`  - ${row.idrRef}  ${row.title}`);
  }

  if (!dryRun && found.length > 0) {
    const result = await prisma.instrument.deleteMany({
      where: { idrRef: { in: [...FOUNDING_PLACEHOLDER_IDR_REFS] } },
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

  const leftover = FOUNDING_PLACEHOLDER_IDR_REFS.filter((ref) =>
    remaining.some((r) => r.idrRef === ref),
  );
  if (leftover.length > 0) {
    console.error("\nERROR: placeholders still present:", leftover.join(", "));
    process.exit(1);
  }

  const missingSemantic = PRESERVED_SEMANTIC.filter(
    (ref) => !remaining.some((r) => r.idrRef === ref),
  );
  if (missingSemantic.length > 0) {
    console.error("\nERROR: expected semantic instruments missing:", missingSemantic.join(", "));
    process.exit(1);
  }

  console.log("\nOK — only institutional documents remain (plus any test-title rows; run db:cleanup-test-instruments).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
