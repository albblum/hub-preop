import { z } from "zod";

export const createInstrumentBodySchema = z.object({
  title: z.string().min(1).max(500),
  layer: z.number().int().min(0).max(5),
  draftingAuthority: z.string().max(200).optional().nullable(),
  content: z.string().max(100_000).optional().nullable(),
  parentInstrumentId: z.string().min(1).max(40).optional().nullable(),
});

export const transitionBodySchema = z.object({
  toStatus: z.string().min(1).max(120),
  actor: z.string().max(200).optional().nullable(),
  actorKind: z.enum(["human", "system", "api_key"]).optional(),
  actorLabel: z.string().max(200).optional().nullable(),
  actorExternalId: z.string().max(200).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const auditExportBodySchema = z.object({
  mode: z.enum(["public", "registered", "restricted"]).optional(),
  idrRefs: z.array(z.string().min(1).max(120)).max(500).optional(),
  instrumentIds: z.array(z.string().min(1).max(40)).max(500).optional(),
  requestedBy: z.string().max(200).optional().nullable(),
});

export const updateContentBodySchema = z.object({
  content: z.string().min(1).max(100_000),
  revisionNote: z.string().max(2000).optional().nullable(),
});
