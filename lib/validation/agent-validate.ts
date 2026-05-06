import { z } from "zod";

export const agentValidateBodySchema = z.object({
  content: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "content must be a non-empty string after trim")),
  idrRef: z.string().min(1).max(120).optional(),
  instrumentId: z.string().min(1).max(40).optional(),
});

export type AgentValidateBody = z.infer<typeof agentValidateBodySchema>;
