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

  it("accepts multi-part create with contiguous segment positions", () => {
    const result = createInstrumentBodySchema.safeParse({
      title: "Multi",
      layer: 1,
      segments: [
        { partKind: "SECTION", position: 1, markdownBody: "A" },
        { partKind: "ANNEX", position: 2, markdownBody: "B" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects content when segments are provided", () => {
    const result = createInstrumentBodySchema.safeParse({
      title: "Multi",
      layer: 1,
      content: "body",
      segments: [{ partKind: "SECTION", position: 1, markdownBody: "A" }],
    });
    expect(result.success).toBe(false);
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
