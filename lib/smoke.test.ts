import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInstrumentStubSchema } from "@/lib/validation/instrument-stub";

describe("validation", () => {
  it("accepts a minimal instrument stub payload", () => {
    const result = createInstrumentStubSchema.safeParse({
      title: "Smoke",
      layer: 2,
      status: "draft",
    });
    expect(result.success).toBe(true);
  });
});

describe("database connectivity", () => {
  it.skipIf(!!process.env.SKIP_DB)(
    "runs SELECT 1 against DATABASE_URL (requires PostgreSQL)",
    async () => {
      const rows = await prisma.$queryRaw<Array<{ x: number }>>`SELECT 1::int AS x`;
      expect(rows[0]?.x).toBe(1);
    },
  );
});
