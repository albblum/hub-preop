import Link from "next/link";
import { auth } from "@/auth";
import {
  instrumentAggregates,
  listRecentTransitionEvents,
} from "@/lib/instrument-service";
import { redirect } from "next/navigation";
import { canViewOperationalQueues } from "@/lib/rbac";

export const metadata = {
  title: "Ops — Hub pre-op",
};

export default async function OpsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/ops");
  }
  if (!canViewOperationalQueues(session.user.roles)) {
    redirect("/");
  }

  const [aggregates, recentEvents] = await Promise.all([
    instrumentAggregates(),
    listRecentTransitionEvents(15),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-4xl space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Operations</h1>
            <p className="text-sm text-zinc-400">
              Signed in as {session.user.email ?? session.user.name ?? session.user.id} · roles:{" "}
              {session.user.roles.join(", ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-amber-200/90 underline hover:text-amber-100" href="/normalization">
              Normalization queue
            </Link>
            <a className="text-zinc-400 underline hover:text-zinc-200" href="/api/health" target="_blank">
              Health
            </a>
            <a
              className="text-zinc-400 underline hover:text-zinc-200"
              href="/api/audit/export?mode=public"
              target="_blank"
            >
              Export (public)
            </a>
            <Link className="text-zinc-400 underline hover:text-zinc-200" href="/">
              Home
            </Link>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Counts by layer</h2>
          <ul className="flex flex-wrap gap-3 text-sm">
            {aggregates.byLayer.map((row) => (
              <li key={row.layer} className="rounded-md bg-zinc-950 px-3 py-2">
                Layer <span className="font-mono">{row.layer}</span>:{" "}
                <span className="text-zinc-300">{row.count}</span>
              </li>
            ))}
          </ul>
          <h2 className="mb-4 mt-8 text-lg font-medium">Counts by status</h2>
          <ul className="flex flex-wrap gap-3 text-sm">
            {aggregates.byStatus.map((row) => (
              <li key={row.status} className="rounded-md bg-zinc-950 px-3 py-2">
                <span className="font-mono text-xs text-zinc-400">{row.status}</span>:{" "}
                <span className="text-zinc-300">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Recent transitions</h2>
          <ul className="space-y-3 text-sm">
            {recentEvents.map((ev) => (
              <li key={ev.id} className="border-b border-zinc-800/80 pb-3 last:border-0">
                <div className="text-zinc-300">
                  {ev.instrument.idrRef}{" "}
                  <span className="text-zinc-500">
                    {ev.fromStatus} → {ev.toStatus}
                  </span>
                </div>
                <div className="text-xs text-zinc-500">
                  {ev.at.toISOString()} · {ev.actorLabel ?? ev.actor ?? "—"} (
                  {ev.actorKind})
                </div>
                {ev.note && <div className="text-xs text-zinc-600">{ev.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
