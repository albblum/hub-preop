"use client";

import { useState } from "react";

type LandingLoginResponse = {
  ok?: boolean;
  hubContinuePath?: string;
  error?: string;
};

type IDRLoginSectionProps = {
  /** Called after session is established; parent shows recognition modal instead of redirecting. */
  onSuccess?: () => void;
  next?: string;
};

export function IDRLoginSection({ onSuccess, next = "/ops" }: IDRLoginSectionProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("Invalid email or password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/landing-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password, next }),
      });
      const data = (await res.json().catch(() => ({}))) as LandingLoginResponse;
      if (!res.ok) {
        setError(data.error ?? "Invalid email or password.");
        return;
      }
      if (data.ok) {
        onSuccess?.();
        return;
      }
      setError("Unexpected response from server.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full bg-white py-10">
      <div className="mx-auto w-full max-w-[400px] px-4">
        <p
          className="mb-5 text-center font-mono uppercase"
          style={{
            fontSize: "10px",
            letterSpacing: "2px",
            color: "var(--color-text-secondary)",
          }}
        >
          Institutional Access
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="email"
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-text-primary)",
              }}
            >
              Institutional email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="h-[40px] w-full rounded-md border px-3 font-sans text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => {
                e.target.style.setProperty("--tw-ring-color", "var(--color-green-700)");
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-mono"
              style={{
                fontSize: "11px",
                color: "var(--color-text-primary)",
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="h-[40px] w-full rounded-md border px-3 font-sans text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
              onFocus={(e) => {
                e.target.style.setProperty("--tw-ring-color", "var(--color-green-700)");
              }}
            />
          </div>

          {error ? (
            <p className="font-mono text-sm" style={{ color: "var(--color-orange-900)" }} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="group mt-1.5 flex h-[40px] w-full items-center justify-center gap-1 rounded-md font-sans text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{
              backgroundColor: "var(--color-green-700)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = "var(--color-green-900)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-green-700)";
            }}
          >
            <span>{loading ? "Signing in…" : "Enter DocHUB"}</span>
            {!loading ? (
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            ) : null}
          </button>
        </form>

        <p
          className="mt-3 text-center font-mono"
          style={{
            fontSize: "10px",
            color: "var(--color-text-secondary)",
          }}
        >
          Restricted access · IDR members only
        </p>
      </div>
    </section>
  );
}
