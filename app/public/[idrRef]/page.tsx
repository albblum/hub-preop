import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicInstrumentByIdrRef } from "@/lib/publication-service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ idrRef: string }>;
  searchParams: Promise<{ version?: string }>;
};

export default async function PublicInstrumentPage({ params, searchParams }: PageProps) {
  const { idrRef: encodedIdrRef } = await params;
  const sp = await searchParams;
  const idrRef = decodeURIComponent(encodedIdrRef);

  let versionOpt: { version: number } | undefined;
  if (sp.version !== undefined && sp.version !== "") {
    const n = Number(sp.version);
    if (!Number.isInteger(n) || n < 1) {
      notFound();
    }
    versionOpt = { version: n };
  }

  const item = await getPublicInstrumentByIdrRef(idrRef, versionOpt);
  if (!item) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          <p className="text-sm text-zinc-400">
            {item.idrRef} · layer {item.layer} · version {item.viewedVersion}
            {item.isCurrentVersion ? " (current)" : " (historical)"}
          </p>
          <div
            className="rounded-md border border-amber-900/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-100/90"
            role="status"
          >
            {item.publicDisplayLabel}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="text-amber-200/90 underline" href="/public">
              Back to public catalog
            </Link>
            <Link className="text-amber-200/90 underline" href="/">
              Hub home
            </Link>
            {!item.isCurrentVersion ? (
              <Link
                className="text-amber-200/90 underline"
                href={`/public/${encodeURIComponent(item.idrRef)}`}
              >
                View current version
              </Link>
            ) : null}
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-3 text-lg font-medium">Version history (public audit)</h2>
          <ul className="mb-6 space-y-2 text-sm">
            {item.publicVersionIndex.map((v) => (
              <li key={v.version} className="flex flex-wrap items-baseline gap-2 text-zinc-300">
                <Link
                  className={
                    v.version === item.viewedVersion
                      ? "font-medium text-amber-200"
                      : "text-amber-200/80 underline"
                  }
                  href={v.publicUrlPath}
                >
                  v{v.version}
                  {v.isCurrent ? " · current" : ""}
                </Link>
                <span className="text-xs text-zinc-500">{v.contentHash.slice(0, 12)}…</span>
              </li>
            ))}
          </ul>

          <h2 className="mb-3 text-lg font-medium">Public content</h2>
          <pre className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 text-sm leading-6 text-zinc-200">
            {item.content || "[EMPTY]"}
          </pre>
        </section>
      </main>
    </div>
  );
}
