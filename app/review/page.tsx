import Link from "next/link";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";
import { auth } from "@/auth";
import { getPublicMarketingHomeUrl } from "@/lib/public-marketing-home";
import { redirect } from "next/navigation";
import { listInstruments } from "@/lib/instrument-service";
import { canViewOperationalQueues } from "@/lib/rbac";

export default async function ReviewIndexPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/review")}`);
  }
  if (!canViewOperationalQueues(session.user.roles, session.user.committeeMemberships)) {
    redirect(getPublicMarketingHomeUrl() ?? "/");
  }

  const { items } = await listInstruments({ take: 100 });
  const homeLabel = getPublicMarketingHomeUrl() ? "Site público IDR" : "Início do Hub (técnico)";

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Review reader</h1>
          <p className="text-sm text-zinc-400">
            Escolha um documento para abrir a vista de leitura humana (conteúdo actual, histórico mínimo,
            eventos).
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <PublicMarketingHomeLink className="text-amber-200/90 underline">{homeLabel}</PublicMarketingHomeLink>
            <Link className="text-amber-200/90 underline" href="/ops">
              Ops
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Documentos ({items.length})</h2>
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Nenhum instrumento na base. Crie na home ou execute o seed (
              <code className="text-xs text-amber-200/80">npm run seed:founding</code>).
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm"
                >
                  <div className="font-medium text-zinc-100">{s.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {s.idrRef} · camada {s.layer} · {s.status} · v{s.currentVersion}
                  </div>
                  <div className="mt-2">
                    <Link
                      className="text-xs text-amber-200/90 underline"
                      href={`/review/${encodeURIComponent(s.idrRef)}`}
                    >
                      Abrir leitura de revisão
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
