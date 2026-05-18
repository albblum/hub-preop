import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { appendClauseVersion } from "./clause-version";
import {
  assertClauseNotPublished,
  assertClauseVersionDirectBodyUpdateForbidden,
  assertClauseVersionNotReferenced,
  assertSectionStructureMutable,
  ClauseImmutableError,
} from "./immutability";
import { createMinimalV2ClauseFixture, deleteInstrumentCascade, describeIfDb } from "./test-helpers";

describeIfDb("immutability (DB)", () => {
  it("blocks assertClauseNotPublished after publication but still allows appendClauseVersion", async () => {
    const fx = await createMinimalV2ClauseFixture(`im-${Date.now()}`);
    try {
      await prisma.$transaction((tx) => appendClauseVersion(tx, { clauseId: fx.clauseId, body: "draft" }));

      await prisma.normativeClause.update({
        where: { id: fx.clauseId },
        data: { publishedAt: new Date() },
      });

      await expect(
        prisma.$transaction((tx) => assertClauseNotPublished(tx, fx.clauseId)),
      ).rejects.toThrow(ClauseImmutableError);

      await expect(
        prisma.$transaction((tx) =>
          appendClauseVersion(tx, { clauseId: fx.clauseId, body: "after publish" }),
        ),
      ).resolves.toBeTruthy();
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("assertClauseVersionNotReferenced fails when version is linked to InstrumentRevision", async () => {
    const fx = await createMinimalV2ClauseFixture(`rev-${Date.now()}`);
    const v1 = await prisma.$transaction((tx) =>
      appendClauseVersion(tx, { clauseId: fx.clauseId, body: "locked" }),
    );
    try {
      const rev = await prisma.instrumentRevision.create({
        data: {
          instrumentId: fx.instrumentId,
          revisionNumber: 1,
          aggregateContentHash: "00".repeat(32),
        },
      });
      await prisma.instrumentRevisionClauseVersion.create({
        data: {
          instrumentRevisionId: rev.id,
          clauseVersionId: v1.id,
        },
      });

      await expect(
        prisma.$transaction((tx) => assertClauseVersionNotReferenced(tx, v1.id)),
      ).rejects.toThrow(ClauseImmutableError);

      await expect(
        prisma.$transaction((tx) => assertClauseVersionDirectBodyUpdateForbidden(tx, v1.id)),
      ).rejects.toThrow(ClauseImmutableError);

      await expect(
        prisma.$transaction(async (tx) => {
          await assertClauseVersionDirectBodyUpdateForbidden(tx, v1.id);
          await tx.clauseVersion.update({ where: { id: v1.id }, data: { body: "nope" } });
        }),
      ).rejects.toThrow(ClauseImmutableError);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("assertClauseVersionDirectBodyUpdateForbidden blocks in-place body update after clause publication", async () => {
    const fx = await createMinimalV2ClauseFixture(`pub-${Date.now()}`);
    const v1 = await prisma.$transaction((tx) =>
      appendClauseVersion(tx, { clauseId: fx.clauseId, body: "text" }),
    );
    try {
      await prisma.normativeClause.update({
        where: { id: fx.clauseId },
        data: { publishedAt: new Date() },
      });

      await expect(
        prisma.$transaction(async (tx) => {
          await assertClauseVersionDirectBodyUpdateForbidden(tx, v1.id);
          await tx.clauseVersion.update({ where: { id: v1.id }, data: { body: "mutated" } });
        }),
      ).rejects.toThrow(ClauseImmutableError);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("assertSectionStructureMutable rejects published sections", async () => {
    const fx = await createMinimalV2ClauseFixture(`sec-${Date.now()}`);
    try {
      const section = await prisma.normativeSection.findFirstOrThrow({
        where: { instrumentId: fx.instrumentId },
      });
      await prisma.normativeSection.update({
        where: { id: section.id },
        data: { publishedAt: new Date() },
      });
      await expect(
        prisma.$transaction((tx) => assertSectionStructureMutable(tx, section.id)),
      ).rejects.toThrow(ClauseImmutableError);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
