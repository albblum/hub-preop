import { z } from "zod";

export const createInstrumentStubSchema = z.object({
  title: z.string().min(1).max(500),
  layer: z.number().int().min(0).max(5),
  status: z.string().min(1).max(120),
  content: z.string().max(50_000).optional().nullable(),
});

export type CreateInstrumentStubInput = z.infer<typeof createInstrumentStubSchema>;
