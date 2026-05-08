import { describe, expect, it } from "vitest";
import { GET as apiHealthGet } from "@/app/api/health/route";
import { GET as docHubHealthGet } from "@/app/api/doc-hub/v0/health/route";
import { prisma } from "@/lib/prisma";
import {
  appendInstrumentVersion,
  appendMultipartInstrumentVersion,
  createInstrument,
  createMultipartInstrument,
} from "@/lib/instrument-service";
import { PART_KIND_ANNEX, PART_KIND_SECTION, assembleInstrumentMarkdown } from "@/lib/part-composition";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

describe("reliability — health route handlers", () => {
  it.skipIf(!!process.env.SKIP_DB)("GET /api/health returns ok and db true", async () => {
    const res = await apiHealthGet();
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(body).toEqual(expect.objectContaining({ ok: true, db: true }));
  });

  it.skipIf(!!process.env.SKIP_DB)(
    "GET /api/doc-hub/v0/health returns facade liveness (no DB)",
    async () => {
      const res = await docHubHealthGet();
      expect(res.status).toBe(200);
      const body: unknown = await res.json();
      expect(body).toEqual({
        ok: true,
        facade: "doc-hub",
        version: "v0",
      });
    },
  );
});

describe("reliability — instrument flows (real services + DB)", () => {
  it.skipIf(!!process.env.SKIP_DB)("monolith: create + append version; DB coherent", async () => {
    const suffix = uniqueSuffix();
    const inst = await createInstrument({
      title: `reliability-mono-${suffix}`,
      layer: 0,
      content: "first body",
    });

    const v1 = await prisma.instrumentVersion.findUnique({
      where: { instrumentId_version: { instrumentId: inst.id, version: 1 } },
    });
    expect(v1).not.toBeNull();
    expect(v1?.content).toBe("first body");

    await appendInstrumentVersion({
      instrumentId: inst.id,
      content: "second body",
      revisionNote: "r2",
    });

    const head = await prisma.instrument.findUnique({
      where: { id: inst.id },
      include: { currentVersionRecord: true },
    });
    expect(head?.currentVersion).toBe(2);
    expect(head?.currentVersionRecord?.content).toBe("second body");
    expect(head?.currentVersionRecord?.revisionNote).toBe("r2");
  });

  it.skipIf(!!process.env.SKIP_DB)(
    "multipart: ≥2 parts + append version; aggregate matches assembleInstrumentMarkdown",
    async () => {
      const suffix = uniqueSuffix();
      const md1 = `section-${suffix}`;
      const md2 = `annex-${suffix}`;
      const inst = await createMultipartInstrument({
        title: `reliability-multi-${suffix}`,
        layer: 0,
        segments: [
          { partKind: PART_KIND_SECTION, position: 1, markdownBody: md1 },
          { partKind: PART_KIND_ANNEX, position: 2, markdownBody: md2 },
        ],
      });

      const expectedV1 = assembleInstrumentMarkdown([md1, md2]);
      const v1row = await prisma.instrumentVersion.findUnique({
        where: { instrumentId_version: { instrumentId: inst.id, version: 1 } },
      });
      expect(v1row?.content).toBe(expectedV1);

      const entries = await prisma.compositionEntry.findMany({
        where: { instrumentId: inst.id },
        orderBy: { position: "asc" },
      });
      expect(entries.length).toBe(2);

      const nextA = `${md1}-v2`;
      const nextB = `${md2}-v2`;
      const bodiesByPartId: Record<string, string> = {
        [entries[0]!.partId]: nextA,
        [entries[1]!.partId]: nextB,
      };

      await appendMultipartInstrumentVersion({
        instrumentId: inst.id,
        bodiesByPartId,
        revisionNote: "multipart v2",
      });

      const expectedV2 = assembleInstrumentMarkdown([nextA, nextB]);
      const head = await prisma.instrument.findUnique({
        where: { id: inst.id },
        include: { currentVersionRecord: true },
      });
      expect(head?.currentVersion).toBe(2);
      expect(head?.currentVersionRecord?.content).toBe(expectedV2);

      const pvs = await prisma.partVersion.findMany({
        where: { instrumentVersionId: head!.currentVersionRecordId! },
        orderBy: { ordinal: "asc" },
      });
      expect(pvs.length).toBe(2);
      expect(pvs.map((p) => p.markdownBody)).toEqual([nextA, nextB]);
    },
  );
});
