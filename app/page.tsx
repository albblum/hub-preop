"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PublicMarketingHomeLink } from "@/components/public-marketing-home-link";

type InstrumentListItem = {
  id: string;
  idrRef: string;
  title: string;
  layer: number;
  status: string;
  currentVersion: number;
  parentInstrumentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [items, setItems] = useState<InstrumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; db?: boolean } | null>(null);

  const [title, setTitle] = useState("Pilot Core Registry");
  const [layer, setLayer] = useState(0);
  const [content, setContent] = useState("");
  const [parentInstrumentId, setParentInstrumentId] = useState("");

  const [transitionId, setTransitionId] = useState("");
  const [transitionTo, setTransitionTo] = useState("under-review");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, listRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/instruments?pageSize=50", { credentials: "include" }),
      ]);
      setHealth(await h.json());
      if (!listRes.ok) throw new Error(`List failed: ${listRes.status}`);
      const data = (await listRes.json()) as { items: InstrumentListItem[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/instruments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title,
        layer,
        content: content.trim() === "" ? undefined : content,
        parentInstrumentId:
          parentInstrumentId.trim() === "" ? undefined : parentInstrumentId.trim(),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Create failed (${res.status})`);
      return;
    }
    setTitle("Pilot Core Registry");
    setLayer(0);
    setContent("");
    setParentInstrumentId("");
    await load();
  }

  async function onTransition(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!transitionId.trim()) {
      setError("Enter instrument id for transition");
      return;
    }
    const res = await fetch(`/api/instruments/${transitionId.trim()}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ toStatus: transitionTo }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Transition failed (${res.status})`);
      return;
    }
    await load();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hub pre-operational — Core Registry (Phase 5 access)
          </h1>
          <p className="text-sm text-zinc-400">
            idr:ref, versioned content, transition log. Mutations require sign-in (RBAC).
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <PublicMarketingHomeLink className="text-amber-200/90 underline">
              {process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim()
                ? "Site público IDR"
                : "Início do Hub (técnico)"}
            </PublicMarketingHomeLink>
            {sessionStatus === "authenticated" ? (
              <>
                <span className="text-emerald-400">
                  {session?.user?.email ?? session?.user?.name}
                </span>
                <Link className="text-amber-200/90 underline" href="/ops">
                  Ops
                </Link>
                <Link className="text-amber-200/90 underline" href="/normalization">
                  Normalization
                </Link>
                <Link className="text-amber-200/90 underline" href="/review">
                  Review reader
                </Link>
              </>
            ) : (
              <Link className="text-amber-200/90 underline" href="/login">
                Sign in
              </Link>
            )}
            <Link className="text-amber-200/90 underline" href="/public">
              Public catalog
            </Link>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span
              className={`rounded-full px-2 py-1 ${health?.ok ? "bg-emerald-950 text-emerald-300" : "bg-red-950 text-red-300"}`}
            >
              API health: {health === null ? "…" : health.ok ? "ok" : "fail"}
            </span>
            <span
              className={`rounded-full px-2 py-1 ${health?.db ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-200"}`}
            >
              DB: {health === null ? "…" : health.db ? "connected" : "unavailable"}
            </span>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Create instrument</h2>
          <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">Title</span>
              <input
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Layer (0–5)</span>
              <input
                type="number"
                min={0}
                max={5}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={layer}
                onChange={(e) => setLayer(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Parent instrument id (optional)</span>
              <input
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
                value={parentInstrumentId}
                onChange={(e) => setParentInstrumentId(e.target.value)}
                placeholder="cuid of parent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">Content v1 (optional, Markdown)</span>
              <textarea
                className="min-h-[80px] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white sm:col-span-2 sm:w-fit"
            >
              Create (draft, idr:ref issued)
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Transition status</h2>
          <form onSubmit={onTransition} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">Instrument id</span>
              <input
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs"
                value={transitionId}
                onChange={(e) => setTransitionId(e.target.value)}
                placeholder="paste id from list"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">To status</span>
              <select
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={transitionTo}
                onChange={(e) => setTransitionTo(e.target.value)}
              >
                <option value="under-review">under-review</option>
                <option value="in-force">in-force</option>
                <option value="foundational-provisional">foundational-provisional</option>
                <option value="derivation-pending">derivation-pending</option>
                <option value="revoked">revoked</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600 sm:col-span-2 sm:w-fit"
            >
              Apply transition
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Instruments</h2>
          {loading && <p className="text-sm text-zinc-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && items.length === 0 && !error && (
            <p className="text-sm text-zinc-400">
              No instruments yet. Create one above — data persists in PostgreSQL.
            </p>
          )}
          <ul className="space-y-3">
            {items.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm"
              >
                <div className="font-medium text-zinc-100">{s.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.idrRef} · layer {s.layer} · {s.status} · v{s.currentVersion}
                </div>
                <div className="mt-1 font-mono text-[10px] text-zinc-600">id {s.id}</div>
                {sessionStatus === "authenticated" && (
                  <div className="mt-2">
                    <Link
                      className="text-xs text-amber-200/90 underline"
                      href={`/instruments/${s.id}/edit`}
                    >
                      Edit Markdown
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
