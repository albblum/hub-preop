"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { instrumentWorkspaceMode } from "@/lib/committee-workspace";
import { LEDGER_ENTRY_TYPES } from "@/lib/ledger/entry-types";

type Tab = "conteudo" | "historico" | "processo";

type TimelineRow =
  | {
      kind: "transition";
      at: string;
      fromStatus: string;
      toStatus: string;
      note: string | null;
      actorLabel: string | null;
    }
  | {
      kind: "committee_ledger";
      at: string;
      entryType: string;
      sequence: number;
      payloadHash: string;
    };

type WorkspacePayload = {
  instrument: {
    id: string;
    idrRef: string;
    title: string;
    status: string;
    currentVersion: number;
    consultationClosesAt: string | null;
    consultationOpeningNote: string | null;
    versions: Array<{
      version: number;
      revisionNote: string | null;
      createdAt: string;
    }>;
    events: Array<{ at: string; fromStatus: string; toStatus: string; note: string | null }>;
  };
  externalReferences: Array<{
    id: string;
    kind: string;
    title: string;
    origin: string;
    stableId: string;
    accessedAt: string;
    status: string | null;
  }>;
  timeline: TimelineRow[];
};

export function InstrumentWorkspaceClient({ instrumentId }: { instrumentId: string }) {
  const [tab, setTab] = useState<Tab>("conteudo");
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [closesAt, setClosesAt] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [synthesis, setSynthesis] = useState("");
  const [decision, setDecision] = useState<"advance" | "reformulate" | "archive">("advance");
  const [justification, setJustification] = useState("");
  const [contributionRefs, setContributionRefs] = useState("");
  const [foundationNote, setFoundationNote] = useState("");
  const [linkRefId, setLinkRefId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/committee/instruments/${encodeURIComponent(instrumentId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Erro ${res.status}`);
        setData(null);
        return;
      }
      const payload = (await res.json()) as WorkspacePayload;
      setData(payload);
    } catch {
      setError("Falha ao carregar o instrumento.");
      setData(null);
    }
  }, [instrumentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mode = data ? instrumentWorkspaceMode(data.instrument.status) : "elaboration";

  async function postJson(url: string, body: unknown, okStatuses: number[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!okStatuses.includes(res.status)) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Erro ${res.status}`);
        return false;
      }
      await load();
      return true;
    } catch {
      setError("Falha de rede ao registar o acto.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <p className="text-sm text-zinc-500">A carregar…</p>;
  }
  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const inst = data.instrument;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/comite" className="text-xs text-zinc-500 underline hover:text-zinc-300">
            ← Instrumentos do comité
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{inst.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {inst.idrRef} · revisão {inst.currentVersion} ·{" "}
            <span className={mode === "elaboration" ? "text-amber-200/90" : "text-sky-200/90"}>
              {mode === "elaboration" ? "Modo elaboração" : "Modo processo"}
            </span>
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-zinc-800 pb-px">
        {(
          [
            ["conteudo", "Conteúdo"],
            ["historico", "Histórico"],
            ["processo", "Processo"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium ${
              tab === k
                ? "bg-zinc-900 text-amber-100 ring-1 ring-zinc-700"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "conteudo" ? (
        <section className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-400">
            Texto e revisões do instrumento. Para alterar o texto, use o registo editorial — cada
            versão fica com autoria e nota de alteração no histórico do sistema.
          </p>
          <Link
            href={`/instruments/${inst.id}/edit`}
            className="inline-flex rounded-md bg-amber-600/90 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Abrir editor do instrumento
          </Link>
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-300">Versões registadas</h3>
            <ul className="space-y-2 text-sm text-zinc-400">
              {[...inst.versions].reverse().map((v) => (
                <li key={v.version} className="rounded-md bg-zinc-950/60 px-3 py-2">
                  <span className="text-zinc-200">v{v.version}</span> ·{" "}
                  {new Date(v.createdAt).toLocaleString("pt-PT")}
                  {v.revisionNote ? (
                    <span className="mt-1 block text-zinc-500">{v.revisionNote}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-300">Referências vinculadas</h3>
            {data.externalReferences.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhuma referência externa vinculada.</p>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-400">
                {data.externalReferences.map((r) => (
                  <li key={r.id} className="rounded-md bg-zinc-950/60 px-3 py-2">
                    <span className="text-zinc-200">{r.title}</span> ({r.kind}) · {r.stableId}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                className="min-w-[12rem] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                placeholder="ID da referência (cuid)"
                value={linkRefId}
                onChange={(e) => setLinkRefId(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !linkRefId.trim()}
                className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
                onClick={async () => {
                  const ok = await postJson(
                    `/api/committee/instruments/${encodeURIComponent(instrumentId)}/references`,
                    { externalReferenceId: linkRefId.trim() },
                    [204],
                  );
                  if (ok) setLinkRefId("");
                }}
              >
                Vincular referência
              </button>
              <Link
                href="/comite/referencias"
                className="self-center text-sm text-amber-200/80 underline"
              >
                Repositório
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "historico" ? (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-400">
            Linha do tempo de eventos e entradas de razão relacionadas com o processo normativo deste
            instrumento.
          </p>
          <ul className="space-y-3 text-sm">
            {data.timeline.map((row, i) => (
              <li
                key={`${row.kind}-${i}-${row.at}`}
                className="relative border-l-2 border-zinc-700 pl-4"
              >
                <div className="text-xs text-zinc-500">
                  {new Date(row.at).toLocaleString("pt-PT")}
                </div>
                {row.kind === "transition" ? (
                  <div className="text-zinc-200">
                    Transição: {row.fromStatus} → {row.toStatus}
                    {row.actorLabel ? (
                      <span className="ml-2 text-zinc-500">· {row.actorLabel}</span>
                    ) : null}
                    {row.note ? (
                      <p className="mt-1 text-zinc-500">{row.note}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-zinc-200">
                    Acto formal no razão ({row.entryType === LEDGER_ENTRY_TYPES.COMMITTEE_PROCESS_RECORD
                      ? "processo do comité"
                      : row.entryType}
                    ) · seq. {row.sequence}
                    <p className="mt-1 break-all font-mono text-xs text-zinc-500">{row.payloadHash}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "processo" ? (
        <section className="space-y-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-sm text-zinc-400">
            Actos formais executados aqui geram entradas no razão e alterações de estado quando
            aplicável. Não confundir com simples gravação editorial.
          </p>

          {inst.status === "draft" ? (
            <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/50 p-4">
              <h3 className="font-medium text-zinc-100">Abertura de consulta pública</h3>
              <label className="block text-xs text-zinc-500">
                Prazo de encerramento (obrigatório)
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </label>
              <label className="block text-xs text-zinc-500">
                Nota de abertura — o que o comité solicita que seja avaliado
                <textarea
                  className="mt-1 min-h-[100px] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                  value={openingNote}
                  onChange={(e) => setOpeningNote(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || !closesAt || !openingNote.trim()}
                className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
                onClick={async () => {
                  const iso = new Date(closesAt).toISOString();
                  await postJson(
                    `/api/committee/instruments/${encodeURIComponent(instrumentId)}/consultation`,
                    { closesAt: iso, openingNote: openingNote.trim() },
                    [204],
                  );
                }}
              >
                Confirmar abertura de consulta
              </button>
            </div>
          ) : null}

          {inst.status === "under-review" ? (
            <>
              <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-950/50 p-4">
                <h3 className="font-medium text-zinc-100">Registo de deliberação</h3>
                <label className="block text-xs text-zinc-500">
                  Síntese das contribuições consideradas
                  <textarea
                    className="mt-1 min-h-[80px] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={synthesis}
                    onChange={(e) => setSynthesis(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Decisão
                  <select
                    className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={decision}
                    onChange={(e) =>
                      setDecision(e.target.value as "advance" | "reformulate" | "archive")
                    }
                  >
                    <option value="advance">Avançar</option>
                    <option value="reformulate">Reformular</option>
                    <option value="archive">Arquivar</option>
                  </select>
                </label>
                <label className="block text-xs text-zinc-500">
                  Justificativa
                  <textarea
                    className="mt-1 min-h-[80px] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Referência às contribuições que influenciaram a decisão
                  <textarea
                    className="mt-1 min-h-[60px] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    value={contributionRefs}
                    onChange={(e) => setContributionRefs(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !synthesis.trim() ||
                    !justification.trim() ||
                    !contributionRefs.trim()
                  }
                  className="rounded-md border border-zinc-500 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
                  onClick={async () => {
                    await postJson(
                      `/api/committee/instruments/${encodeURIComponent(instrumentId)}/deliberation`,
                      {
                        synthesis: synthesis.trim(),
                        decision,
                        justification: justification.trim(),
                        contributionRefs: contributionRefs.trim(),
                      },
                      [204],
                    );
                  }}
                >
                  Registar deliberação
                </button>
              </div>

              <div className="space-y-3 rounded-lg border-2 border-amber-800/60 bg-amber-950/20 p-5 shadow-lg shadow-amber-950/20">
                <h3 className="text-lg font-semibold text-amber-100">Aprovação formal</h3>
                <p className="text-sm text-amber-200/80">
                  Acto solene: confirmação de quórum (MVP: o participante que executa confirma) e
                  fundamento normativo. Gera entrada no razão com autoria e tempo.
                </p>
                <label className="block text-xs text-amber-200/70">
                  Fundamento normativo
                  <textarea
                    className="mt-1 min-h-[100px] w-full rounded border border-amber-900/50 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    value={foundationNote}
                    onChange={(e) => setFoundationNote(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !foundationNote.trim()}
                  className="w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
                  onClick={async () => {
                    if (
                      !globalThis.confirm(
                        "Confirma a aprovação formal deste instrumento? Esta acção tem peso institucional.",
                      )
                    ) {
                      return;
                    }
                    setBusy(true);
                    setError(null);
                    try {
                      const res = await fetch(
                        `/api/committee/instruments/${encodeURIComponent(instrumentId)}/formal-approval`,
                        {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ foundationNote: foundationNote.trim() }),
                        },
                      );
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        setError((j as { error?: string }).error ?? `Erro ${res.status}`);
                        return;
                      }
                      setFoundationNote("");
                      await load();
                    } catch {
                      setError("Falha de rede.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Executar aprovação formal
                </button>
              </div>
            </>
          ) : null}

          {inst.status !== "draft" && inst.status !== "under-review" ? (
            <p className="text-sm text-zinc-500">
              Não há actos formais disponíveis para o estado actual ({inst.status}). Consulte o
              histórico ou o fluxo institucional.
            </p>
          ) : null}

          {inst.status === "under-review" && inst.consultationClosesAt ? (
            <p className="text-xs text-zinc-500">
              Consulta pública: prazo registado até{" "}
              {new Date(inst.consultationClosesAt).toLocaleString("pt-PT")}
              {inst.consultationOpeningNote ? (
                <span className="mt-2 block text-zinc-400">{inst.consultationOpeningNote}</span>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
