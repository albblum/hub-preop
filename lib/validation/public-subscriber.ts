import { z } from "zod";

export const publicSubscriberBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
});
