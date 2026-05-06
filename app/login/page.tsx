"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function LoginForm() {
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/ops";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-md space-y-6 pt-20">
        <h1 className="text-2xl font-semibold">Hub pre-op — sign in</h1>
        <p className="text-sm text-zinc-400">
          Use credentials from <code className="text-amber-200/90">.env</code> / seed (see{" "}
          <code className="text-amber-200/90">Fase5_Operations_and_Access_MVP.md</code>).
        </p>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <label className="block text-sm">
            <span className="text-zinc-400">Email</span>
            <input
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/" className="text-zinc-300 underline hover:text-white">
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
