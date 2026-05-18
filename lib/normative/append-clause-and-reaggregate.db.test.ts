import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/transitions";
import { appendInstrumentVersion } from "@/lib/instrument-service";
import { appendClauseVersionAndReaggregate } from "./append-clause-and-reaggregate";
import { appendClauseVersion } from "./clause-version";
import { createMinimalV2ClauseFixture, deleteInstrumentCascade, describeIfDb } from "./test-helpers";
import { createInstrument } from "@/lib/instrument-service";

describeIfDb("appendClauseVersionAndReaggregate (DB)", () => {
  it("appends clause version and derived aggregate for v2", async () => {
    const fx = await createMinimalV2ClauseFixture(`acr-${Date.now()}`);
    try {
      const result = await appendClauseVersionAndReaggregate({
        instrumentId: fx.instrumentId,
        clauseId: fx.clauseId,
        body: "Pilot clause body",
        revisionNote: "pilot edit",
        createdBy: "test@example.com",
      });

      expect(result.clauseVersion.version).toBe(1);
      expect(result.clauseVersion.body).toBe("Pilot clause body");
      expect(result.instrument.structuralProfile).toBe("v2");
      expect(result.aggregate.contentHash).toMatch(/^[a-f0-9]{64}$/);

      const derived = await prisma.instrumentVersion.findFirst({
        where: { instrumentId: fx.instrumentId, contentSourceKind: "derived" },
        orderBy: { version: "desc" },
      });
      expect(derived?.content).toContain("Pilot clause body");
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("rejects v1 instrument", async () => {
    const inst = await createInstrument({
      title: "v1 not clause route",
      layer: 0,
      content: "# v1",
    });
    try {
      await expect(
        appendClauseVersionAndReaggregate({
          instrumentId: inst.id,
          clauseId: "nonexistent",
          body: "nope",
        }),
      ).rejects.toMatchObject({ domainCode: "NOT_V2_INSTRUMENT" });
    } finally {
      await deleteInstrumentCascade(inst.id);
    }
  });

  it("idempotent aggregate when body unchanged on second append with same content", async () => {
    const fx = await createMinimalV2ClauseFixture(`acr-idem-${Date.now()}`);
    try {
      await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "same" }),
      );
      await appendClauseVersionAndReaggregate({
        instrumentId: fx.instrumentId,
        clauseId: fx.clauseId,
        body: "same",
      });
      const countBefore = await prisma.instrumentVersion.count({
        where: { instrumentId: fx.instrumentId, contentSourceKind: "derived" },
      });

      const second = await appendClauseVersionAndReaggregate({
        instrumentId: fx.instrumentId,
        clauseId: fx.clauseId,
        body: "same",
      });

      const countAfter = await prisma.instrumentVersion.count({
        where: { instrumentId: fx.instrumentId, contentSourceKind: "derived" },
      });
      expect(second.aggregate.skipped).toBe(true);
      expect(countAfter).toBe(countBefore);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});

describeIfDb("v1 content path blocked for v2 (DB)", () => {
  it("appendInstrumentVersion throws V2_WRITE_PATH_BLOCKED", async () => {
    const fx = await createMinimalV2ClauseFixture(`content-block-${Date.now()}`);
    try {
      await expect(
        appendInstrumentVersion({ instrumentId: fx.instrumentId, content: "# x" }),
      ).rejects.toBeInstanceOf(DomainError);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
