import Link from "next/link";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";
import { auth } from "@/auth";
import {
  instrumentAggregates,
  listRecentTransitionEvents,
} from "@/lib/instrument-service";
import { redirect } from "next/navigation";
import { canViewOperationalQueues } from "@/lib/rbac";
import { mayAccessComiteWorkspace, type SessionLike } from "@/lib/committee-access";
import { getPublicMarketingHomeUrl } from "@/lib/public-marketing-home";
import {
  hasSecretaryGeneralInstitutionalScope,
  sessionRoleLabels,
} from "@/lib/session-role-labels";

export const metadata = {
  title: "Ops — Hub pre-op",
};

export default async function OpsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/ops");
  }
  const [aggregates, recentEvents] = await Promise.all([
    instrumentAggregates(),
    listRecentTransitionEvents(15),
  ]);

  const roles = session.user.roles ?? [];
  const committees = session.user.committeeMemberships ?? [];
  const isSecretaryGeneral = hasSecretaryGeneralInstitutionalScope(roles);
  const mayViewOperationalQueues = canViewOperationalQueues(roles, committees);
  const sessionLike: SessionLike = {
    user: { roles, committeeMemberships: committees },
  };
  const mayComiteWorkspace = mayAccessComiteWorkspace(sessionLike);

  const memberIdrRef =
    session.user.memberIdrRef ?? `idr:MEMBER-${session.user.id.slice(-8).toUpperCase()}`;
  const identityName = session.user.name ?? session.user.email ?? "Membro";
  const activeRoleLabels = sessionRoleLabels(roles, committees);

  const byStatus = new Map(aggregates.byStatus.map((r) => [r.status, r.count]));
  const pendingConsultation = byStatus.get("under-review") ?? 0;
  const pendingRatification = byStatus.get("foundational-provisional") ?? 0;
  const pendingNormalization = byStatus.get("normalization-pending") ?? 0;
  const inForce = byStatus.get("in-force") ?? 0;
  const recentlyTransitioned = recentEvents.slice(0, 5);

  const actionItems: Array<{ tag: string; text: string; urgency: "alta" | "media" | "baixa" }> = [];
  const committeeTags =
    committees.length > 0
      ? committees.map((c) => c.code)
      : roles.includes("reviewer")
        ? ["(legado)"]
        : [];
  for (const code of committeeTags) {
    actionItems.push({
      tag: code === "(legado)" ? "[COMITÊ]" : `[COMITÊ ${code}]`,
      text: "Instrumento elaborado pelo comitê aguardando aprovação formal.",
      urgency: "alta",
    });
  }
  if (pendingConsultation > 0) {
    actionItems.push({
      tag: "[MEMBRO]",
      text: `${pendingConsultation} instrumento(s) em consulta pública aguardam contribuição.`,
      urgency: "media",
    });
  }
  if (isSecretaryGeneral && pendingRatification > 0) {
    actionItems.push({
      tag: "[SISTEMA]",
      text: `${pendingRatification} instrumento(s) aguardam ratificação institucional.`,
      urgency: "alta",
    });
  }
  actionItems.sort((a, b) => {
    const score = { alta: 0, media: 1, baixa: 2 };
    return score[a.urgency] - score[b.urgency];
  });

  const homeLabel = getPublicMarketingHomeUrl() ? "Site público IDR" : "Início do Hub (técnico)";

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Painel do Membro</h1>
            <p className="text-sm text-zinc-400">
              {identityName} · {activeRoleLabels.join(" · ")} · {memberIdrRef}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {mayViewOperationalQueues && (
              <Link className="text-amber-200/90 underline hover:text-amber-100" href="/normalization">
                Fila de normalização
              </Link>
            )}
            {mayViewOperationalQueues && (
              <Link className="text-amber-200/90 underline hover:text-amber-100" href="/review">
                Leitura de revisão
              </Link>
            )}
            {mayComiteWorkspace && (
              <Link className="text-amber-200/90 underline hover:text-amber-100" href="/comite">
                Espaço do comité
              </Link>
            )}
            <Link className="text-zinc-400 underline hover:text-zinc-200" href="/public">
              DocHub público
            </Link>
            <PublicMarketingHomeLink className="text-zinc-400 underline hover:text-zinc-200">
              {homeLabel}
            </PublicMarketingHomeLink>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Requer ação</h2>
          {actionItems.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Nenhuma convocação pendente neste momento.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {actionItems.map((item) => (
                <li key={`${item.tag}-${item.text}`} className="rounded-md bg-zinc-950 px-4 py-3">
                  <div className="text-xs text-zinc-400">{item.tag}</div>
                  <div className="text-zinc-100">{item.text}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Em andamento</h2>
          <ul className="space-y-3 text-sm">
            {committees.map((c) => (
              <li key={c.committeeId} className="rounded-md bg-zinc-950 px-4 py-3">
                <div className="text-xs text-zinc-400">[COMITÊ {c.code}]</div>
                <div className="text-zinc-100">
                  Rascunho de instrumento em elaboração no comitê.
                </div>
              </li>
            ))}
            {committees.length === 0 && roles.includes("reviewer") && (
              <li className="rounded-md bg-zinc-950 px-4 py-3">
                <div className="text-xs text-zinc-400">[COMITÊ — legado reviewer]</div>
                <div className="text-zinc-100">
                  Rascunho de instrumento em elaboração no comitê.
                </div>
              </li>
            )}
            <li className="rounded-md bg-zinc-950 px-4 py-3">
              <div className="text-xs text-zinc-400">[SISTEMA]</div>
              <div className="text-zinc-100">
                {recentlyTransitioned.length} transição(ões) recentes no ciclo normativo.
              </div>
            </li>
            <li className="rounded-md bg-zinc-950 px-4 py-3">
              <div className="text-xs text-zinc-400">[SISTEMA]</div>
              <div className="text-zinc-100">
                {pendingRatification} instrumento(s) em vigência provisória aguardando AG.
              </div>
            </li>
          </ul>
          {recentlyTransitioned.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-zinc-300">Últimas mudanças de estado</h3>
              <ul className="space-y-2 text-xs text-zinc-400">
                {recentlyTransitioned.map((ev) => (
                  <li key={ev.id}>
                    {ev.instrument.idrRef}: {ev.fromStatus} → {ev.toStatus}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Agenda institucional</h2>
          <ul className="space-y-3 text-sm">
            <li className="rounded-md bg-zinc-950 px-4 py-3">
              <div className="text-zinc-100">Encerramento de períodos de consulta pública</div>
              <div className="text-xs text-zinc-500">
                {pendingConsultation} instrumento(s) atualmente em análise de contribuições.
              </div>
            </li>
            <li className="rounded-md bg-zinc-950 px-4 py-3">
              <div className="text-zinc-100">Disponibilidade de pauta da AG</div>
              <div className="text-xs text-zinc-500">
                {pendingRatification} item(ns) potenciais para deliberação formal.
              </div>
            </li>
            <li className="rounded-md bg-zinc-950 px-4 py-3">
              <div className="text-zinc-100">Assembleia Geral Ordinária</div>
              <div className="text-xs text-zinc-500">
                Indicador de vigência: {inForce} instrumento(s) em-force; {pendingNormalization} em normalização.
              </div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
