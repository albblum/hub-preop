import { describe, expect, it } from "vitest";
import { publicSubscriberBodySchema } from "./public-subscriber";

describe("publicSubscriberBodySchema", () => {
  it("accepts valid name and email", () => {
    const r = publicSubscriberBodySchema.safeParse({ name: "Ada", email: "ada@example.com" });
    expect(r.success).toBe(true);
  });

  it("rejects empty name", () => {
    const r = publicSubscriberBodySchema.safeParse({ name: "  ", email: "a@b.co" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const r = publicSubscriberBodySchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(r.success).toBe(false);
  });
});
