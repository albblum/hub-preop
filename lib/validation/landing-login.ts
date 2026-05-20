import { z } from "zod";

export const landingLoginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  /** Post-login path on the Hub (internal only; sanitized server-side). */
  next: z.string().optional(),
});
