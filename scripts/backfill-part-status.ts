/**
 * Idempotent repair: sets each Part.partStatus from Instrument.status (ADR 0004 mapping).
 * Use after restores or if legacy rows drifted. Prefer migration SQL for fresh deploys.
 *
 * Usage: `npm run backfill:part-status` (requires DATABASE_URL).
 */
import { prisma } from "../lib/prisma";
import { mapInstrumentStatusToPartStatus } from "../lib/domain/part-status";

async function main() {
  const parts = await prisma.part.findMany({
    select: {
      id: true,
      instrumentId: true,
      partStatus: true,
      instrument: { select: { status: true } },
    },
  });

  let updated = 0;
  for (const p of parts) {
    const next = mapInstrumentStatusToPartStatus(p.instrument.status);
    if (p.partStatus !== next) {
      await prisma.part.update({
        where: { id: p.id },
        data: { partStatus: next },
      });
      updated += 1;
    }
  }

  console.log(`Done. Parts checked: ${parts.length}, rows updated: ${updated}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
