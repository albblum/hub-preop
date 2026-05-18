import { z } from "zod";

export const appendClauseVersionBodySchema = z.object({
  body: z.string().min(1).max(100_000),
  revisionNote: z.string().max(2000).optional().nullable(),
});
