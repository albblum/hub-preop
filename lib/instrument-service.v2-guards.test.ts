import { describe, it, expect } from "vitest";
import { DomainError } from "@/lib/domain/transitions";
import {
  appendInstrumentVersion,
  appendMultipartInstrumentVersion,
  createInstrument,
} from "@/lib/instrument-service";
import {
  createMinimalV2ClauseFixture,
  deleteInstrumentCascade,
  describeIfDb,
} from "@/lib/normative/test-helpers";

describeIfDb("instrument-service v2 write guards (DB)", () => {
  it("appendInstrumentVersion rejects v2 instruments", async () => {
    const fx = await createMinimalV2ClauseFixture(`guard-mono-${Date.now()}`);
    try {
      await expect(
        appendInstrumentVersion({
          instrumentId: fx.instrumentId,
          content: "# blocked",
        }),
      ).rejects.toMatchObject({
        domainCode: "V2_WRITE_PATH_BLOCKED",
      } satisfies Partial<DomainError>);
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("appendMultipartInstrumentVersion rejects v2 instruments", async () => {
    const fx = await createMinimalV2ClauseFixture(`guard-multi-${Date.now()}`);
    try {
      await expect(
        appendMultipartInstrumentVersion({
          instrumentId: fx.instrumentId,
          bodiesByPartId: {},
        }),
      ).rejects.toMatchObject({
        domainCode: "V2_WRITE_PATH_BLOCKED",
      });
    } finally {
      await deleteInstrumentCascade(fx.instrumentId);
    }
  });

  it("appendInstrumentVersion still works for v1", async () => {
    const inst = await createInstrument({
      title: "v1 guard regression",
      layer: 0,
      content: "# v1",
    });
    try {
      const updated = await appendInstrumentVersion({
        instrumentId: inst.id,
        content: "# v1 v2",
        revisionNote: "phase5 regression",
      });
      expect(updated.currentVersion).toBe(2);
    } finally {
      await deleteInstrumentCascade(inst.id);
    }
  });
});
