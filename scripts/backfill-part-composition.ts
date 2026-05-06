/**
 * Idempotent backfill: ensures MONOLITH_BODY Part, PartVersion per InstrumentVersion,
 * and CompositionEntry at position 1 for instruments missing alignment (Passo C).
 * Sets `Part.partStatus` from current `Instrument.status` on each sync (Passo D / ADR 0004).
 *
 * Usage: `npm run backfill:parts` (requires DATABASE_URL).
 */
import { prisma } from "../lib/prisma";
import { syncMonolithicPartForInstrumentVersion } from "../lib/part-composition";

async function main() {
  const instruments = await prisma.instrument.findMany({
    select: { id: true, idrRef: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  let instrumentsTouched = 0;
  let versionsSynced = 0;

  for (const inst of instruments) {
    const versions = await prisma.instrumentVersion.findMany({
      where: { instrumentId: inst.id },
      orderBy: { version: "asc" },
    });

    let touchedThis = false;

    await prisma.$transaction(async (tx) => {
      for (const v of versions) {
        const existingPv = await tx.partVersion.findUnique({
          where: { instrumentVersionId: v.id },
        });
        if (existingPv) {
          continue;
        }
        touchedThis = true;
        await syncMonolithicPartForInstrumentVersion(tx, {
          instrumentId: inst.id,
          instrumentVersion: v,
          instrumentStatus: inst.status,
        });
        versionsSynced += 1;
      }
    });

    if (touchedThis) {
      instrumentsTouched += 1;
      console.log(`${inst.idrRef}: synced Part/Composition for missing versions`);
    }
  }

  console.log(
    `Done. Instruments updated: ${instrumentsTouched}, PartVersion rows created/repaired: ${versionsSynced}`,
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
