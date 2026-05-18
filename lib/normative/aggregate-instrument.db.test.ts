import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeContentHash } from "@/lib/integrity/content-hash";
import { appendClauseVersion } from "./clause-version";
import {
  aggregateAndPersistInstrument,
  aggregateInstrument,
  buildAggregateMarkdown,
} from "./aggregate-instrument";
import { loadV2TreeForAggregate } from "./read-v2-instrument";
import { createMinimalV2ClauseFixture, deleteInstrumentCascade, describeIfDb } from "./test-helpers";

describeIfDb("aggregate-instrument (DB)", () => {
  it("persists InstrumentRevision + derived InstrumentVersion", async () => {
    const fx = await createMinimalV2ClauseFixture(`agg-${Date.now()}`);
    try {
      await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "Normative text." }),
      );

      const result = await aggregateAndPersistInstrument(fx.instrumentId);
      expect(result.skipped).toBe(false);
      expect(result.revisionNumber).toBe(1);
      expect(result.clauseVersionIds).toHaveLength(1);

      const rev = await prisma.instrumentRevision.findFirst({
        where: { instrumentId: fx.instrumentId },
        include: { clauseVersions: true },
      });
      expect(rev?.revisionNumber).toBe(1);
      expect(rev?.aggregateContentHash).toBe(result.contentHash);
      expect(rev?.clauseVersions).toHaveLength(1);

      const ver = await prisma.instrumentVersion.findUnique({
        where: { id: result.instrumentVersionId },
      });
      expect(ver?.contentSourceKind).toBe("derived");
      expect(ver?.content).toBe(result.content);

      const inst = await prisma.instrument.findUniqueOrThrow({
        where: { id: fx.instrumentId },
      });
      expect(inst.currentVersionRecordId).toBe(result.instrumentVersionId);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("skips persist when derived hash unchanged (no --force)", async () => {
    const fx = await createMinimalV2ClauseFixture(`agg-skip-${Date.now()}`);
    try {
      await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "Same." }),
      );
      const first = await aggregateAndPersistInstrument(fx.instrumentId);
      const second = await aggregateAndPersistInstrument(fx.instrumentId);
      expect(second.skipped).toBe(true);
      expect(second.instrumentVersionId).toBe(first.instrumentVersionId);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("matches computeContentHash for aggregate output", async () => {
    const fx = await createMinimalV2ClauseFixture(`agg-hash-${Date.now()}`);
    try {
      const v1 = await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "Hash me." }),
      );
      const tree = await loadV2TreeForAggregate(prisma, fx.instrumentId);
      const { content, clauseVersionIds } = buildAggregateMarkdown(tree);
      expect(clauseVersionIds).toEqual([v1.id]);

      const agg = await aggregateInstrument(prisma, fx.instrumentId);
      expect(agg.content).toBe(content);
      expect(agg.contentHash).toBe(computeContentHash(agg.versionNum, content));
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
