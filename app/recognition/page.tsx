"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

function roleLabels(roles: string[], committees: CommitteeMembershipClaim[]): string[] {
  const labels = ["Membro"];
  for (const c of committees) {
    labels.push(`Participante — ${c.code}`);
  }
  if (committees.length === 0 && roles.includes("reviewer")) {
    labels.push("Participante — (legado: reviewer)");
  }
  if (roles.includes("registrar") || roles.includes("admin")) labels.push("Secretário Geral");
  return labels;
}

function formatJoinedDate(iso?: string): string {
  if (!iso) return "Não disponível";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Não disponível";
  return d.toLocaleDateString("pt-BR");
}

function RecognitionContent() {
  const { data: session, status } = useSession();
  const search = useSearchParams();
  const next = search.get("next") ?? "/ops";

  if (status === "loading") {
    return <div className="p-8 text-zinc-300">Carregando sessão…</div>;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <main className="mx-auto max-w-xl space-y-4 pt-16">
          <h1 className="text-2xl font-semibold">Sessão não reconhecida</h1>
          <p className="text-sm text-zinc-400">
            Faça login para continuar para o painel institucional.
          </p>
          <Link className="text-amber-200 underline" href="/login">
            Ir para login
          </Link>
        </main>
      </div>
    );
  }

  const labels = roleLabels(session.user.roles ?? [], session.user.committeeMemberships ?? []);

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-2xl space-y-6 pt-10">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Reconhecimento institucional</h1>
          <p className="text-sm text-zinc-400">
            Antes da navegação, o sistema explicita quem está em sessão neste ciclo.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-zinc-400">Nome</dt>
              <dd className="text-zinc-100">{session.user.name ?? session.user.email ?? "Não disponível"}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">idrRef de membro</dt>
              <dd className="font-mono text-zinc-100">
                {session.user.memberIdrRef ?? `idr:MEMBER-${session.user.id.slice(-8).toUpperCase()}`}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Data de adesão</dt>
              <dd className="text-zinc-100">{formatJoinedDate(session.user.joinedAt)}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Papéis ativos na sessão</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {labels.map((label) => (
                  <span key={label} className="rounded-full bg-zinc-800 px-3 py-1 text-xs">
                    {label}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href={next}
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white"
          >
            Continuar para o painel
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Encerrar sessão
          </button>
        </div>
      </main>
    </div>
  );
}

export default function RecognitionPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-zinc-950 p-8 text-zinc-300">Carregando…</div>}
    >
      <RecognitionContent />
    </Suspense>
  );
}

