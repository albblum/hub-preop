import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/transitions";
import {
  appendInstrumentVersion,
  appendMultipartInstrumentVersion,
  createInstrument,
  createMultipartInstrument,
  getInstrumentById,
  transitionMonolithToMultipartProfile,
} from "@/lib/instrument-service";
import { PART_KIND_MONOLITH_BODY, PART_KIND_SECTION } from "@/lib/part-composition";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("transitionMonolithToMultipartProfile (ADR 0009)", () => {
  it.skipIf(!!process.env.SKIP_DB)(
    "succeeds for eligible monolith; head content and hash unchanged; composition becomes SECTION",
    async () => {
      const suffix = uniqueSuffix();
      const inst = await createInstrument({
        title: `transition-mono-${suffix}`,
        layer: 0,
        content: `body-${suffix}`,
      });

      const beforeHead = await prisma.instrumentVersion.findUnique({
        where: { instrumentId_version: { instrumentId: inst.id, version: 1 } },
      });
      expect(beforeHead).not.toBeNull();

      const out = await transitionMonolithToMultipartProfile({
        instrumentId: inst.id,
        dryRun: false,
      });
      if ("dryRun" in out && out.dryRun) {
        throw new Error("expected instrument detail");
      }

      expect(out.compositionProfile).toBe("multipart");
      expect(out.multipartSegments?.length).toBe(1);
      expect(out.multipartSegments?.[0].partKind).toBe(PART_KIND_SECTION);
      expect(out.multipartSegments?.[0].markdownBody).toBe(`body-${suffix}`);

      const afterHead = await prisma.instrumentVersion.findUnique({
        where: { id: beforeHead!.id },
      });
      expect(afterHead?.content).toBe(beforeHead!.content);
      expect(afterHead?.contentHash).toBe(beforeHead!.contentHash);

      const entries = await prisma.compositionEntry.findMany({
        where: { instrumentId: inst.id },
        include: { part: true },
      });
      expect(entries.length).toBe(1);
      expect(entries[0].part.partKind).toBe(PART_KIND_SECTION);

      const monoPart = await prisma.part.findUnique({
        where: {
          instrumentId_partKind: {
            instrumentId: inst.id,
            partKind: PART_KIND_MONOLITH_BODY,
          },
        },
      });
      expect(monoPart).not.toBeNull();

      const monoPvHead = await prisma.partVersion.findMany({
        where: { partId: monoPart!.id, instrumentVersionId: beforeHead!.id },
      });
      expect(monoPvHead.length).toBe(0);
    },
  );

  it.skipIf(!!process.env.SKIP_DB)("dryRun performs no persistent writes", async () => {
    const suffix = uniqueSuffix();
    const inst = await createInstrument({
      title: `transition-dry-${suffix}`,
      layer: 0,
      content: "x",
    });

    const entriesBefore = await prisma.compositionEntry.count({
      where: { instrumentId: inst.id },
    });
    const partsBefore = await prisma.part.count({ where: { instrumentId: inst.id } });

    const dry = await transitionMonolithToMultipartProfile({
      instrumentId: inst.id,
      dryRun: true,
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.report.instrumentId).toBe(inst.id);
    expect(dry.report.contentLength).toBe(1);

    const entriesAfter = await prisma.compositionEntry.count({
      where: { instrumentId: inst.id },
    });
    const partsAfter = await prisma.part.count({ where: { instrumentId: inst.id } });
    expect(entriesAfter).toBe(entriesBefore);
    expect(partsAfter).toBe(partsBefore);
  });

  it.skipIf(!!process.env.SKIP_DB)("second transition fails with ALREADY_MULTIPART_PROFILE", async () => {
    const suffix = uniqueSuffix();
    const inst = await createInstrument({
      title: `transition-idem-${suffix}`,
      layer: 0,
      content: "c",
    });
    await transitionMonolithToMultipartProfile({ instrumentId: inst.id });

    await expect(
      transitionMonolithToMultipartProfile({ instrumentId: inst.id }),
    ).rejects.toMatchObject({
      domainCode: "ALREADY_MULTIPART_PROFILE",
    });
  });

  it.skipIf(!!process.env.SKIP_DB)(
    "multipart-created instrument fails with ALREADY_MULTIPART_PROFILE",
    async () => {
      const suffix = uniqueSuffix();
      const inst = await createMultipartInstrument({
        title: `transition-born-multi-${suffix}`,
        layer: 0,
        segments: [
          { partKind: PART_KIND_SECTION, position: 1, markdownBody: "s" },
        ],
      });
      await expect(
        transitionMonolithToMultipartProfile({ instrumentId: inst.id }),
      ).rejects.toMatchObject({
        domainCode: "ALREADY_MULTIPART_PROFILE",
      });
    },
  );

  it.skipIf(!!process.env.SKIP_DB)(
    "after transition, monolith append fails and multipart append works",
    async () => {
      const suffix = uniqueSuffix();
      const inst = await createInstrument({
        title: `transition-paths-${suffix}`,
        layer: 0,
        content: "head",
      });
      await transitionMonolithToMultipartProfile({ instrumentId: inst.id });

      await expect(
        appendInstrumentVersion({ instrumentId: inst.id, content: "nope" }),
      ).rejects.toBeInstanceOf(DomainError);

      const detail = await getInstrumentById(inst.id);
      const partId = detail?.multipartSegments?.[0]?.partId;
      expect(partId).toBeDefined();

      await appendMultipartInstrumentVersion({
        instrumentId: inst.id,
        bodiesByPartId: { [partId!]: "head2" },
      });

      const head = await prisma.instrument.findUnique({
        where: { id: inst.id },
        include: { currentVersionRecord: true },
      });
      expect(head?.currentVersion).toBe(2);
      expect(head?.currentVersionRecord?.content).toBe("head2");
    },
  );

  it.skipIf(!!process.env.SKIP_DB)("fails when instrument has no current version pointer", async () => {
    const suffix = uniqueSuffix();
    const inst = await createInstrument({
      title: `transition-nov-${suffix}`,
      layer: 0,
      content: "z",
    });
    await prisma.instrument.update({
      where: { id: inst.id },
      data: { currentVersionRecordId: null },
    });

    await expect(
      transitionMonolithToMultipartProfile({ instrumentId: inst.id }),
    ).rejects.toMatchObject({
      domainCode: "NO_CURRENT_VERSION",
    });
  });
});
