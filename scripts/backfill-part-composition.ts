/**
 * Idempotent backfill: ensures MONOLITH_BODY Part, PartVersion per InstrumentVersion,
 * and CompositionEntry at position 1 for instruments missing alignment (Passo C).
 * Sets `Part.partStatus` from current `Instrument.status` on each sync (Passo D / ADR 0004).
 *
 * Skips instruments that are not monolith profile (multi-Part editorial — ADR 0008).
 *
 * Usage: `npm run backfill:parts` (requires DATABASE_URL).
 */
import { prisma } from "../lib/prisma";
import {
  isMonolithCompositionProfile,
  syncMonolithicPartForInstrumentVersion,
} from "../lib/part-composition";

async function main() {
  const instruments = await prisma.instrument.findMany({
    select: { id: true, idrRef: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  let instrumentsTouched = 0;
  let versionsSynced = 0;

  for (const inst of instruments) {
    if (!(await isMonolithCompositionProfile(prisma, inst.id))) {
      continue;
    }

    const monolithPart = await prisma.part.findFirst({
      where: { instrumentId: inst.id, partKind: "MONOLITH_BODY" },
    });
    if (!monolithPart) {
      console.warn(`${inst.idrRef}: no MONOLITH_BODY part — skip (unexpected for monolith profile)`);
      continue;
    }

    const versions = await prisma.instrumentVersion.findMany({
      where: { instrumentId: inst.id },
      orderBy: { version: "asc" },
    });

    let touchedThis = false;

    await prisma.$transaction(async (tx) => {
      for (const v of versions) {
        const existingPv = await tx.partVersion.findFirst({
          where: {
            instrumentVersionId: v.id,
            partId: monolithPart.id,
          },
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
