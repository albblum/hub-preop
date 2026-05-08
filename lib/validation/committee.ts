import { z } from "zod";

export const openConsultationBodySchema = z.object({
  closesAt: z.coerce.date(),
  openingNote: z.string().min(1).max(8000),
});

export const deliberationBodySchema = z.object({
  synthesis: z.string().min(1).max(12000),
  decision: z.enum(["advance", "reformulate", "archive"]),
  justification: z.string().min(1).max(12000),
  contributionRefs: z.string().min(1).max(8000),
});

export const formalApprovalBodySchema = z.object({
  foundationNote: z.string().min(1).max(12000),
});

export const externalReferenceBodySchema = z.object({
  kind: z.enum(["normative", "technical", "legal", "economic"]),
  title: z.string().min(1).max(500),
  origin: z.string().min(1).max(500),
  stableId: z.string().min(1).max(500),
  accessedAt: z.coerce.date(),
  status: z.enum(["active", "outdated", "revoked"]).optional(),
});

export const linkReferenceBodySchema = z.object({
  externalReferenceId: z.string().min(1).max(40),
});

export const referenceStatusBodySchema = z.object({
  status: z.enum(["active", "outdated", "revoked"]),
});
