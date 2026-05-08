import Link from "next/link";
import { auth } from "@/auth";
import { listInstruments } from "@/lib/instrument-service";
import { redirect } from "next/navigation";
import { canViewOperationalQueues } from "@/lib/rbac";
import { NormalizationActions } from "./normalization-actions";

export const metadata = {
  title: "Normalization queue — Hub pre-op",
};

export default async function NormalizationPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/normalization");
  }
  if (!canViewOperationalQueues(session.user.roles, session.user.committeeMemberships)) {
    redirect("/");
  }

  const { items } = await listInstruments({
    take: 100,
    status: "normalization-pending",
  });

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Normalization queue</h1>
            <p className="text-sm text-zinc-400">
              Instruments in <code className="text-amber-200/90">normalization-pending</code>. Transitions
              are recorded with your session identity.
            </p>
          </div>
          <Link
            href="/ops"
            className="text-sm text-zinc-400 underline hover:text-zinc-200"
          >
            ← Ops
          </Link>
        </header>

        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No items. Run <code className="text-amber-200/90">npm run seed:founding</code> or set a test
            instrument to <code className="text-amber-200/90">normalization-pending</code>.
          </p>
        ) : (
          <ul className="space-y-4">
            {items.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm"
              >
                <div className="font-medium text-zinc-100">{row.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  <div>
                    {row.idrRef} · layer {row.layer}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-600">
                    regiao: {row.draftingAuthority ?? "—"} · referencia global:{" "}
                    {row.parent?.idrRef ?? "—"}
                  </div>
                </div>
                <div className="mt-1 font-mono text-[10px] text-zinc-600">{row.id}</div>
                <div className="mt-3">
                  <NormalizationActions instrumentId={row.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
