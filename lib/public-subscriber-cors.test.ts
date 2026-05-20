import { afterEach, describe, expect, it } from "vitest";
import { parseSubscriberAllowedOrigins, subscriberCorsHeaders } from "./public-subscriber-cors";

const ORIGINAL_ALLOWED_ORIGINS = process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS;

function headersFor(origin: string) {
  const request = new Request("https://hub.example.test/api/auth/landing-login", {
    headers: { Origin: origin },
  });
  return subscriberCorsHeaders(request) as Record<string, string>;
}

afterEach(() => {
  process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = ORIGINAL_ALLOWED_ORIGINS;
});

describe("public subscriber CORS", () => {
  it("normalizes configured origins", () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS =
      "https://landing.example.test/, http://localhost:3001";

    expect(parseSubscriberAllowedOrigins()).toEqual([
      "https://landing.example.test",
      "http://localhost:3001",
    ]);
  });

  it("allows credentialed requests from configured landing origins", () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "https://landing.example.test/";

    expect(headersFor("https://landing.example.test")).toMatchObject({
      "Access-Control-Allow-Origin": "https://landing.example.test",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    });
  });

  it("does not emit CORS headers for unconfigured origins", () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "https://landing.example.test";

    expect(headersFor("https://evil.example.test")).toEqual({});
  });
});
