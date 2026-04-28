"use client";

import { useCallback, useEffect, useState } from "react";

type Stub = {
  id: string;
  title: string;
  layer: number;
  status: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Home() {
  const [stubs, setStubs] = useState<Stub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; db?: boolean } | null>(null);

  const [title, setTitle] = useState("Pilot smoke stub");
  const [layer, setLayer] = useState(0);
  const [status, setStatus] = useState("draft");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, listRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/instrument-stubs"),
      ]);
      setHealth(await h.json());
      if (!listRes.ok) throw new Error(`List failed: ${listRes.status}`);
      setStubs(await listRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/instrument-stubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        layer,
        status,
        content: content.trim() === "" ? undefined : content,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Create failed (${res.status})`);
      return;
    }
    setTitle("Pilot smoke stub");
    setLayer(0);
    setStatus("draft");
    setContent("");
    await load();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hub pre-operational — Phase 2 prototype
          </h1>
          <p className="text-sm text-zinc-400">
            Instrument stubs only. No Core Registry, idr:ref, or full state machine (Phase 3+).
          </p>
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
          <h2 className="mb-4 text-lg font-medium">Create instrument stub</h2>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
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
              <span className="text-zinc-400">Status</span>
              <input
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-400">Content (optional)</span>
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
              Create stub
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-4 text-lg font-medium">Instrument stubs</h2>
          {loading && <p className="text-sm text-zinc-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && stubs.length === 0 && !error && (
            <p className="text-sm text-zinc-400">
              No stubs yet. Create one above — data persists in PostgreSQL.
            </p>
          )}
          <ul className="space-y-3">
            {stubs.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-sm"
              >
                <div className="font-medium text-zinc-100">{s.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  layer {s.layer} · {s.status} · id {s.id}
                </div>
                {s.content && <p className="mt-2 text-zinc-400">{s.content}</p>}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
