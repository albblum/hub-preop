"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function LoginForm() {
  const search = useSearchParams();
  const requestedNext = search.get("callbackUrl") ?? "/ops";
  const callbackUrl = `/recognition?next=${encodeURIComponent(requestedNext)}`;
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
      <main className="mx-auto max-w-3xl space-y-6 pt-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">DocHub IDR — entrada</h1>
          <p className="text-sm text-zinc-400">
            O login e o acesso público são caminhos distintos e legítimos na instituição.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 md:col-span-2">
            <h2 className="text-lg font-medium">Acesse sua conta de membro</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Entrada principal para membros com e-mail e senha.
            </p>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-zinc-400">E-mail</span>
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
                <span className="text-zinc-400">Senha</span>
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
                {pending ? "Entrando…" : "Entrar"}
              </button>
            </form>
          </article>

          <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-base font-medium">Explorar o DocHub</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Acesso público irrestrito, sem registro e sem fricção.
            </p>
            <Link
              href="/public"
              className="mt-4 inline-block rounded-md border border-amber-200/50 px-3 py-2 text-sm text-amber-200 hover:bg-amber-50/10"
            >
              Explorar o DocHub
            </Link>
          </article>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-base font-medium">Registre-se e acompanhe o DocHub do IDR</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Convite opcional para não-membros que querem vínculo institucional voluntário.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Ir para registro
          </Link>
        </section>

        <p className="text-sm text-zinc-500">
          O DocHub é a face pública viva do sistema normativo: consulta, transição e promulgação de instrumentos.
        </p>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/" className="text-zinc-300 underline hover:text-white">
            Voltar para início
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
