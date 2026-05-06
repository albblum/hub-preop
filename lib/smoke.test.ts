import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createInstrumentBodySchema } from "@/lib/validation/instrument";

describe("validation", () => {
  it("accepts a minimal create instrument payload", () => {
    const result = createInstrumentBodySchema.safeParse({
      title: "Smoke",
      layer: 2,
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
