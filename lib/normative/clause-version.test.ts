import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeContentHash } from "@/lib/integrity/content-hash";
import { appendClauseVersion, getCurrentClauseVersion } from "./clause-version";
import { createMinimalV2ClauseFixture, deleteInstrumentCascade, describeIfDb } from "./test-helpers";

describeIfDb("clause-version (DB)", () => {
  it("appends three versions with chained previousContentHash and single isCurrent", async () => {
    const fx = await createMinimalV2ClauseFixture(`cv-${Date.now()}`);
    try {
      const v1 = await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "alpha" }),
      );
      const v2 = await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "beta" }),
      );
      const v3 = await prisma.$transaction((tx) =>
        appendClauseVersion(tx, { clauseId: fx.clauseId, body: "gamma" }),
      );

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);
      expect(v3.version).toBe(3);

      expect(v1.previousContentHash).toBeNull();
      expect(v1.contentHash).toBe(computeContentHash(1, "alpha"));
      expect(v2.previousContentHash).toBe(v1.contentHash);
      expect(v3.previousContentHash).toBe(v2.contentHash);

      const currents = await prisma.clauseVersion.findMany({
        where: { clauseId: fx.clauseId, isCurrent: true },
      });
      expect(currents).toHaveLength(1);
      expect(currents[0]?.id).toBe(v3.id);

      const head = await getCurrentClauseVersion(fx.clauseId);
      expect(head?.id).toBe(v3.id);

      const clause = await prisma.normativeClause.findUniqueOrThrow({ where: { id: fx.clauseId } });
      expect(clause.currentVersionId).toBe(v3.id);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
