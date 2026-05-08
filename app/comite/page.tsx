import Link from "next/link";
import { auth } from "@/auth";
import { getCommitteeWorkspaceGroups } from "@/lib/committee-workspace-data";
import type { SessionLike } from "@/lib/committee-access";

const GROUP_LABEL: Record<string, string> = {
  elaboration: "Em elaboração",
  process: "Em processo",
  concluded: "Concluídos",
  other: "Outros estados",
};

export default async function ComiteWorkspacePage() {
  const session = await auth();
  const sessionLike: SessionLike = {
    user: {
      roles: session?.user?.roles ?? [],
      committeeMemberships: session?.user?.committeeMemberships ?? [],
    },
  };
  const { groups, total } = await getCommitteeWorkspaceGroups(sessionLike);

  return (
    <main className="space-y-10">
      <p className="text-sm text-zinc-400">
        Instrumentos sob responsabilidade do comité, agrupados por fase normativa.{" "}
        <span className="text-zinc-500">Total: {total}</span>
      </p>

      {(["elaboration", "process", "concluded", "other"] as const).map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <section key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="mb-4 text-lg font-medium text-zinc-100">{GROUP_LABEL[key]}</h2>
            <ul className="space-y-3">
              {items.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/comite/instrumento/${row.id}`}
                    className="block rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 transition hover:border-amber-900/50 hover:bg-zinc-900"
                  >
                    <div className="font-medium text-zinc-100">{row.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                      <span>{row.idrRef}</span>
                      {row.committee?.code ? (
                        <span className="text-amber-200/70">{row.committee.code}</span>
                      ) : null}
                      <span>estado: {row.status}</span>
                      {row.consultationClosesAt ? (
                        <span>
                          consulta até{" "}
                          {new Date(row.consultationClosesAt).toLocaleString("pt-PT", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center text-sm text-zinc-500">
          Nenhum instrumento atribuído ao comité neste âmbito. Execute o seed ou atribua um comité a
          um instrumento.
        </p>
      ) : null}
    </main>
  );
}
