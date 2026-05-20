import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ALLOWED_ORIGINS = process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS;

const { CredentialsSignin } = vi.hoisted(() => {
  class CredentialsSignin extends Error {}
  return { CredentialsSignin };
});

vi.mock("next-auth", () => ({
  CredentialsSignin,
}));

vi.mock("@/auth", () => ({
  signIn: vi.fn(),
}));

import { signIn } from "@/auth";
import { CredentialsSignin as RouteCredentialsSignin } from "next-auth";
import { OPTIONS, POST } from "./route";

function landingRequest(init: RequestInit = {}) {
  return new Request("http://localhost:3000/api/auth/landing-login", {
    ...init,
    headers: {
      Origin: "http://localhost:3001",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

afterEach(() => {
  process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = ORIGINAL_ALLOWED_ORIGINS;
  vi.mocked(signIn).mockReset();
});

describe("/api/auth/landing-login", () => {
  it("OPTIONS returns 204 with credentialed CORS for allowed origin", async () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "http://localhost:3001";

    const res = await OPTIONS(landingRequest({ method: "OPTIONS" }));

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("OPTIONS returns 403 when origin is not allowed", async () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "http://localhost:3001";

    const res = await OPTIONS(
      new Request("http://localhost:3000/api/auth/landing-login", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example.test" },
      }),
    );

    expect(res.status).toBe(403);
  });

  it("POST returns 401 when credentials are invalid", async () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "http://localhost:3001";
    vi.mocked(signIn).mockRejectedValue(new RouteCredentialsSignin());

    const res = await POST(
      landingRequest({
        method: "POST",
        body: JSON.stringify({
          email: "admin@hub-preop.local",
          password: "wrong",
          next: "/ops",
        }),
      }),
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/invalid/i);
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("POST returns ok and hubContinuePath on successful signIn", async () => {
    process.env.PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS = "http://localhost:3001";
    vi.mocked(signIn).mockResolvedValue("/recognition?next=%2Fops");

    const res = await POST(
      landingRequest({
        method: "POST",
        body: JSON.stringify({
          email: "admin@hub-preop.local",
          password: "secret",
          next: "/ops",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; hubContinuePath?: string };
    expect(body.ok).toBe(true);
    expect(body.hubContinuePath).toBe("/recognition?next=%2Fops");
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "admin@hub-preop.local",
      password: "secret",
      redirect: false,
      redirectTo: "/recognition?next=%2Fops",
    });
  });
});
