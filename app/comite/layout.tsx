import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { mayAccessComiteWorkspace, type SessionLike } from "@/lib/committee-access";

export const metadata = {
  title: "Espaço de trabalho do comité — Hub pre-op",
};

export default async function ComiteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/comite");
  }
  const sessionLike: SessionLike = {
    user: {
      roles: session.user.roles ?? [],
      committeeMemberships: session.user.committeeMemberships ?? [],
    },
  };
  if (!mayAccessComiteWorkspace(sessionLike)) {
    redirect("/ops");
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-8">
      <header className="mx-auto mb-8 flex max-w-5xl flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
            Espaço de trabalho do comité
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">Ateliê normativo</h1>
        </div>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="text-amber-200/90 underline hover:text-amber-100" href="/comite">
            Instrumentos
          </Link>
          <Link className="text-amber-200/90 underline hover:text-amber-100" href="/comite/referencias">
            Referências externas
          </Link>
          <Link className="text-zinc-500 underline hover:text-zinc-300" href="/ops">
            Painel
          </Link>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
