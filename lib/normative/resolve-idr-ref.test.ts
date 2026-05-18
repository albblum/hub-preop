import { expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { registerIdrRef } from "./idr-ref-registry";
import { resolveIdrRef, registerAlias, isLegacyHubInstrRef } from "./resolve-idr-ref";
import { createMinimalV2ClauseFixture, deleteInstrumentCascade, describeIfDb } from "./test-helpers";

describeIfDb("resolve-idr-ref (DB)", () => {
  it("returns null for unknown ref without throwing", async () => {
    expect(await resolveIdrRef("idr:c:nonexistent-doc-zzzz")).toBeNull();
  });

  it("resolves semantic idrRef from registry", async () => {
    const idrRef = `idr:c:test-resolve-${Date.now()}`;
    await prisma.$transaction(async (tx) => {
      await registerIdrRef(tx, {
        idrRef,
        ownerKind: "instrument",
        ownerId: "inst-x",
      });
    });
    try {
      const r = await resolveIdrRef(idrRef);
      expect(r).toEqual({
        canonical: idrRef,
        ownerKind: "instrument",
        ownerId: "inst-x",
      });
    } finally {
      await prisma.idrRefRegistry.delete({ where: { idrRef } });
    }
  });

  it("resolves legacy HUB-INSTR via alias → registry", async () => {
    const suffix = `alias-${Date.now()}`;
    const fx = await createMinimalV2ClauseFixture(suffix);
    const legacyRef = `idr:HUB-INSTR-9${String(Date.now()).slice(-8)}`;
    try {
      expect(isLegacyHubInstrRef(legacyRef)).toBe(true);
      await prisma.$transaction(async (tx) => {
        await registerIdrRef(tx, {
          idrRef: fx.documentIdrRef,
          ownerKind: "instrument",
          ownerId: fx.instrumentId,
        });
        await registerAlias(tx, {
          legacyRef,
          canonicalRef: fx.documentIdrRef,
        });
      });

      const r = await resolveIdrRef(legacyRef);
      expect(r).toMatchObject({
        canonical: fx.documentIdrRef,
        legacy: legacyRef,
        ownerKind: "instrument",
        ownerId: fx.instrumentId,
      });
    } finally {
      await prisma.idrRefAlias.deleteMany({ where: { legacyRef } });
      await prisma.idrRefRegistry.deleteMany({ where: { idrRef: fx.documentIdrRef } });
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });
});
