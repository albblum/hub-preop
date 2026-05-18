/**
 * Build derived InstrumentVersion from v2 normative tree (Phase 4).
 *
 * Usage:
 *   npx tsx scripts/aggregate-v2-instruments.ts --all
 *   npx tsx scripts/aggregate-v2-instruments.ts --instrument idr:c:foundation
 *   npx tsx scripts/aggregate-v2-instruments.ts --instrument idr:c:preop-regime --force
 */
import { prisma } from "../lib/prisma";
import {
  aggregateAndPersistInstrument,
  findInstrumentByIdOrIdrRef,
} from "../lib/normative/aggregate-instrument";

const PILOT_INSTRUMENTS = ["idr:c:foundation", "idr:c:preop-regime"] as const;

function parseArgs(): { targets: string[]; force: boolean } {
  const force = process.argv.includes("--force");
  if (process.argv.includes("--all")) {
    return { targets: [...PILOT_INSTRUMENTS], force };
  }
  const idx = process.argv.indexOf("--instrument");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error(
      "Usage: --all | --instrument idr:c:foundation|idr:c:preop-regime [--force]",
    );
    process.exit(1);
  }
  return { targets: [process.argv[idx + 1]], force };
}

async function runOne(idrRef: string, force: boolean): Promise<void> {
  const inst = await findInstrumentByIdOrIdrRef(prisma, idrRef);
  if (!inst) {
    throw new Error(`Instrument not found: ${idrRef}`);
  }
  if (inst.structuralProfile !== "v2") {
    throw new Error(`${idrRef} is not structuralProfile=v2`);
  }

  const result = await aggregateAndPersistInstrument(inst.id, { force });
  if (result.skipped) {
    console.log(`${idrRef}: skipped (derived hash unchanged, use --force)`);
    console.log(`  contentHash=${result.contentHash}`);
    return;
  }

  console.log(`${idrRef}: revision ${result.revisionNumber} → version ${result.versionNum}`);
  console.log(`  contentHash=${result.contentHash}`);
  console.log(`  clauseVersions=${result.clauseVersionIds.length}`);
  console.log(`  contentLength=${result.content.length}`);
}

async function main() {
  const { targets, force } = parseArgs();
  for (const idrRef of targets) {
    await runOne(idrRef, force);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
