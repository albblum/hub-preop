import { z } from "zod";

const multipartSegmentSchema = z.object({
  partKind: z.enum(["SECTION", "ANNEX"]),
  position: z.number().int().min(1),
  markdownBody: z.string().max(100_000),
});

export const createInstrumentBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    documentType: z
      .enum(["constitutional", "operational", "institutional", "generic"])
      .optional(),
    layer: z.number().int().min(0).max(5),
    draftingAuthority: z.string().max(200).optional().nullable(),
    content: z.string().max(100_000).optional().nullable(),
    parentInstrumentId: z.string().min(1).max(40).optional().nullable(),
    segments: z.array(multipartSegmentSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.segments != null && data.segments.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "segments, if provided, must include at least one entry",
        path: ["segments"],
      });
    }
    const hasSegments = data.segments != null && data.segments.length > 0;
    if (hasSegments && data.content != null && data.content.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Cannot set content when segments are provided (multi-part create)",
        path: ["content"],
      });
    }
    if (hasSegments && data.segments) {
      const kinds = data.segments.map((s) => s.partKind);
      if (new Set(kinds).size !== kinds.length) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate partKind in segments",
          path: ["segments"],
        });
      }
      const sorted = [...data.segments].sort((a, b) => a.position - b.position);
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].position !== i + 1) {
          ctx.addIssue({
            code: "custom",
            message: "segment positions must be contiguous starting at 1",
            path: ["segments"],
          });
          break;
        }
      }
    }
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

export const appendMultipartVersionBodySchema = z.object({
  bodiesByPartId: z.record(z.string().min(1).max(40), z.string().max(100_000)),
  revisionNote: z.string().max(2000).optional().nullable(),
});

export const addInstrumentPartBodySchema = z.object({
  partKind: z.enum(["SECTION", "ANNEX"]),
  initialMarkdown: z.string().max(100_000).optional().nullable(),
});

export const transitionToMultipartBodySchema = z.object({
  dryRun: z.boolean().optional(),
});
