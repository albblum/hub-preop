"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";
import { safeInternalPath } from "@/lib/safe-internal-path";

const LANDING_RETURN_PARAM = "public-site";

function LoginForm() {
  const search = useSearchParams();
  const requestedNext = safeInternalPath(search.get("callbackUrl"), "/ops");
  const fromLanding = search.get("from") === LANDING_RETURN_PARAM;
  const publicSiteUrl = process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim().replace(/\/$/, "");
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
    <div className="min-h-screen bg-[#0F6E56] p-8 text-white">
      <main className="mx-auto max-w-3xl space-y-6 pt-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">DocHub IDR — entrada</h1>
          <p className="text-sm text-[#C8E6D8]">
            O login e o acesso público são caminhos distintos e legítimos na instituição.
          </p>
          {fromLanding && publicSiteUrl ? (
            <p className="text-sm">
              <a
                href={publicSiteUrl}
                className="text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
              >
                Voltar ao site público do IDR
              </a>
            </p>
          ) : null}
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-white/20 bg-black/10 p-5 md:col-span-2">
            <h2 className="text-lg font-medium">Acesse sua conta de membro</h2>
            <p className="mt-1 text-sm text-[#C8E6D8]">
              Entrada principal para membros com e-mail e senha.
            </p>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="text-[#C8E6D8]">E-mail</span>
                <input
                  type="email"
                  autoComplete="username"
                  className="mt-1 w-full rounded-md border border-white/30 bg-black/20 px-3 py-2 text-white placeholder-white/40"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-[#C8E6D8]">Senha</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-md border border-white/30 bg-black/20 px-3 py-2 text-white placeholder-white/40"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#0F6E56] hover:bg-[#C8E6D8] disabled:opacity-50"
              >
                {pending ? "Entrando…" : "Entrar"}
              </button>
            </form>
            {process.env.NODE_ENV === "development" ? (
              <aside className="mt-4 rounded-lg border border-white/15 bg-black/25 p-4 text-xs leading-relaxed text-[#C8E6D8]">
                <p className="font-medium text-white/90">Laboratório — contas criadas pelo seed</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>
                    <code className="text-white/90">admin@hub-preop.local</code> — senha = valor de{" "}
                    <code className="text-white/90">SEED_ADMIN_PASSWORD</code> no <code>.env</code> do Hub (por defeito
                    no <code>.env.example</code>: <code className="text-white/90">ChangeMeAdmin!</code>).
                  </li>
                  <li>
                    Se mudaste as senhas no <code>.env</code> depois de já teres corrido o seed, as palavras-passe na
                    base ficam antigas. Corre:{" "}
                    <code className="whitespace-pre-wrap text-white/90">
                      SEED_UPDATE_EXISTING_PASSWORDS=1 npm run seed:users-only
                    </code>
                  </li>
                </ul>
              </aside>
            ) : null}
          </article>

          <article className="rounded-xl border border-white/20 bg-black/10 p-5">
            <h2 className="text-base font-medium">Explorar o DocHub</h2>
            <p className="mt-1 text-sm text-[#C8E6D8]">
              Acesso público irrestrito, sem registro e sem fricção.
            </p>
            <Link
              href="/public"
              className="mt-4 inline-block rounded-md border border-white/30 px-3 py-2 text-sm text-white hover:bg-white/10"
            >
              Explorar o DocHub
            </Link>
          </article>
        </section>

        <section className="rounded-xl border border-white/20 bg-black/10 p-5">
          <h2 className="text-base font-medium">Registre-se e acompanhe o DocHub do IDR</h2>
          <p className="mt-1 text-sm text-[#C8E6D8]">
            Convite opcional para não-membros que querem vínculo institucional voluntário.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-md border border-white/30 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Ir para registro
          </Link>
        </section>

        <p className="text-sm text-[#C8E6D8]">
          O DocHub é a face pública viva do sistema normativo: consulta, transição e promulgação de instrumentos.
        </p>
        <p className="text-center text-sm text-[#C8E6D8]">
          <PublicMarketingHomeLink className="text-white underline hover:bg-white/10">
            {publicSiteUrl ? "Voltar ao site público (IDR)" : "Voltar para início do Hub"}
          </PublicMarketingHomeLink>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#C8E6D8]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
