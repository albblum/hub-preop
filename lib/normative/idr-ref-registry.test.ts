import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerIdrRef, assertIdrRefAvailable, lookupOwner, IdrRefCollisionError } from "./idr-ref-registry";
import {
  createMinimalV2ClauseFixture,
  deleteInstrumentCascade,
  describeIfDb,
} from "./test-helpers";

describeIfDb("idr-ref-registry (DB)", () => {
  const prefix = "idr:c:test-registry-";

  it("rolls back the transaction when a second registerIdrRef collides", async () => {
    const idrRef = `${prefix}collision-${Date.now()}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await registerIdrRef(tx, {
          idrRef,
          ownerKind: "instrument",
          ownerId: "owner-a",
        });
        await registerIdrRef(tx, {
          idrRef,
          ownerKind: "clause",
          ownerId: "owner-b",
        });
      }),
    ).rejects.toThrow(IdrRefCollisionError);

    const row = await prisma.idrRefRegistry.findUnique({ where: { idrRef } });
    expect(row).toBeNull();
  });

  it("registers idrRef and rejects duplicates via assertIdrRefAvailable", async () => {
    const idrRef = `${prefix}avail-${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await registerIdrRef(tx, {
        idrRef,
        ownerKind: "section",
        ownerId: "sec-1",
      });
      await expect(assertIdrRefAvailable(tx, idrRef)).rejects.toThrow(IdrRefCollisionError);
    });

    const owner = await lookupOwner(idrRef);
    expect(owner).toEqual({ ownerKind: "section", ownerId: "sec-1" });

    await prisma.idrRefRegistry.delete({ where: { idrRef } });
  });

  it("registers idrRef in same TX as a normative node id (integration shape)", async () => {
    const suffix = `reg-${Date.now()}`;
    const fx = await createMinimalV2ClauseFixture(suffix);
    const idrRef = `${prefix}node-${suffix}`;
    try {
      await prisma.$transaction(async (tx) => {
        await registerIdrRef(tx, {
          idrRef,
          ownerKind: "clause",
          ownerId: fx.clauseId,
        });
      });
      expect(await lookupOwner(idrRef)).toEqual({ ownerKind: "clause", ownerId: fx.clauseId });
    } finally {
      await prisma.idrRefRegistry.deleteMany({ where: { idrRef: { startsWith: prefix } } });
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
