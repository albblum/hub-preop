import Link from "next/link";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";
import { getPublicMarketingHomeUrl } from "@/lib/public-marketing-home";
import { listPublicCatalog } from "@/lib/publication-service";

export const dynamic = "force-dynamic";

export default async function PublicCatalogPage() {
  const items = await listPublicCatalog(100);
  const homeLabel = getPublicMarketingHomeUrl() ? "Site público IDR" : "Início do Hub (técnico)";

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Public consultation catalog</h1>
          <p className="text-sm text-zinc-400">
            Canonical list of instruments currently publicable in the pre-operational Hub (see ADR
            0006).
          </p>
          <PublicMarketingHomeLink className="text-sm text-amber-200/90 underline">
            {homeLabel}
          </PublicMarketingHomeLink>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">No publicable instruments at this time.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.idrRef}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{item.title}</div>
                    <Link
                      className="text-amber-200/90 underline"
                      href={`/public/${encodeURIComponent(item.idrRef)}`}
                    >
                      Open public page
                    </Link>
                  </div>
                  <div className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/30 px-2 py-1 text-xs text-amber-100/90">
                    {item.publicDisplayLabel}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {item.idrRef} · layer {item.layer} · v{item.currentVersion}
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
