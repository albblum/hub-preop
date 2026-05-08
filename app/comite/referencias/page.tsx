"use client";

import { useCallback, useEffect, useState } from "react";

type RefRow = {
  id: string;
  kind: string;
  title: string;
  origin: string;
  stableId: string;
  accessedAt: string;
  status: string | null;
  instruments: Array<{
    instrument: { id: string; idrRef: string; title: string };
  }>;
};

export default function ComiteReferenciasPage() {
  const [items, setItems] = useState<RefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState("normative");
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState("");
  const [stableId, setStableId] = useState("");
  const [accessedAt, setAccessedAt] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/committee/references", { credentials: "include" });
      if (!res.ok) {
        setError(`Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as { items: RefRow[] };
      setItems(data.items);
    } catch {
      setError("Falha ao carregar referências.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/committee/references", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          origin: origin.trim(),
          stableId: stableId.trim(),
          accessedAt: new Date(accessedAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Erro ${res.status}`);
        return;
      }
      setTitle("");
      setOrigin("");
      setStableId("");
      await load();
    } catch {
      setError("Falha ao registar.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "active" | "outdated" | "revoked") {
    setBusy(true);
    try {
      const res = await fetch(`/api/committee/references/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-8">
      <p className="text-sm text-zinc-400">
        Repositório centralizado de referências externas (partilhado por todos os comités). Cada
        referência existe uma vez e pode vincular-se a vários instrumentos.
      </p>

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
      >
        <h2 className="text-lg font-medium text-zinc-100">Registar referência</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-zinc-500">
            Tipo
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="normative">Normativa</option>
              <option value="technical">Técnica</option>
              <option value="legal">Jurídica</option>
              <option value="economic">Económica</option>
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            Data de acesso
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={accessedAt}
              onChange={(e) => setAccessedAt(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-xs text-zinc-500">
          Título
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Origem (autor, instituição, órgão)
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Identificador estável (DOI, lei, URL…)
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            value={stableId}
            onChange={(e) => setStableId(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
        >
          Registar referência
        </button>
      </form>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-medium text-zinc-100">Referências registadas</h2>
        {loading ? (
          <p className="text-sm text-zinc-500">A carregar…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma referência ainda.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-300"
              >
                <div className="font-medium text-zinc-100">{r.title}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {r.kind} · {r.origin} · {r.stableId}
                </div>
                <div className="mt-1 text-xs text-zinc-600">
                  Acesso: {new Date(r.accessedAt).toLocaleString("pt-PT")}
                  {r.status ? (
                    <span className="ml-2 text-amber-200/80">Estado: {r.status}</span>
                  ) : null}
                </div>
                {r.instruments.length > 0 ? (
                  <div className="mt-2 text-xs text-zinc-500">
                    Instrumentos:{" "}
                    {r.instruments.map((l) => l.instrument.idrRef).join(", ")}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs text-zinc-500">Actualizar estado:</span>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                    onClick={() => void setStatus(r.id, "active")}
                  >
                    Activa
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                    onClick={() => void setStatus(r.id, "outdated")}
                  >
                    Desactualizada
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                    onClick={() => void setStatus(r.id, "revoked")}
                  >
                    Revogada
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
