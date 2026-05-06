import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getInstrumentByIdrRef } from "@/lib/instrument-service";
import { canViewOperationalQueues } from "@/lib/rbac";

type PageProps = {
  params: Promise<{ idrRef: string }>;
};

export default async function ReviewInstrumentPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/review")}`);
  }
  if (!canViewOperationalQueues(session.user.roles)) {
    redirect("/");
  }

  const { idrRef: encodedIdrRef } = await params;
  const idrRef = decodeURIComponent(encodedIdrRef);
  const item = await getInstrumentByIdrRef(idrRef);
  if (!item) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Human review reader</h1>
          <p className="text-sm text-zinc-400">
            {item.idrRef} · {item.title} · status {item.status} · current version {item.currentVersion}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="text-amber-200/90 underline" href="/ops">
              Ops dashboard
            </Link>
            <Link className="text-amber-200/90 underline" href="/">
              Hub home
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-3 text-lg font-medium">Current content (review view)</h2>
          <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-6 text-zinc-200">
            {item.currentVersionRecord?.content || "[EMPTY]"}
          </pre>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-3 text-lg font-medium">Version history (minimum)</h2>
          <ul className="space-y-2 text-sm">
            {item.versions.map((version) => (
              <li
                key={version.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-zinc-300"
              >
                v{version.version} · {new Date(version.createdAt).toISOString()} · hash{" "}
                {version.contentHash.slice(0, 12)}...
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-3 text-lg font-medium">Transition events (minimum)</h2>
          <ul className="space-y-2 text-sm">
            {item.events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-zinc-300"
              >
                {new Date(event.at).toISOString()} · {event.fromStatus} → {event.toStatus} ·{" "}
                {event.actorLabel ?? event.actorKind}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
