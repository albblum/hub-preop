"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canAppendContent } from "@/lib/rbac";

type MultipartSegment = {
  position: number;
  partId: string;
  partKind: string;
  markdownBody: string;
};

type InstrumentDetail = {
  id: string;
  idrRef: string;
  committeeId?: string | null;
  title: string;
  status: string;
  layer: number;
  currentVersion: number;
  currentVersionRecord: { content: string } | null;
  compositionProfile: "monolith" | "multipart";
  multipartSegments?: MultipartSegment[];
  /** Composition order from API — use to detect real monolith vs mis-tagged multipart. */
  parts?: Array<{ id: string; partKind: string; partStatus: string }>;
};

/** True only when the multi-part editor (per-segment) is active — matches POST …/versions/multipart. */
function isMultipartEditorActive(d: InstrumentDetail): boolean {
  const segmentCount = d.multipartSegments?.length ?? 0;
  if (segmentCount === 0) return false;

  const singleMonolithBody =
    d.parts?.length === 1 && d.parts[0]?.partKind === "MONOLITH_BODY";
  if (singleMonolithBody) {
    /** DB/API mismatch: editorial segments exist but Part Store is single MONOLITH_BODY — edit as monolith. */
    return false;
  }

  return d.compositionProfile === "multipart";
}

// Paridade com ADR 0008 e assembleInstrumentMarkdown no servidor; nao importar part-composition no cliente.
const MULTIPART_MARKDOWN_SEPARATOR = "\n\n";

function segmentAnchorId(seg: MultipartSegment): string {
  return `segmento-${seg.position}-${seg.partId}`;
}

function assembleMultipartPreview(
  orderedSegments: MultipartSegment[],
  bodiesByPartId: Record<string, string>,
): string {
  return orderedSegments.map((seg) => bodiesByPartId[seg.partId] ?? "").join(MULTIPART_MARKDOWN_SEPARATOR);
}

export default function InstrumentEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [detail, setDetail] = useState<InstrumentDetail | null>(null);
  const [content, setContent] = useState("");
  /** Multi-part profile: map partId → markdown (POST …/versions/multipart). */
  const [partBodies, setPartBodies] = useState<Record<string, string>>({});
  const [revisionNote, setRevisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mayAppend = canAppendContent(
    session?.user?.roles,
    session?.user?.committeeMemberships,
    detail?.committeeId ?? null,
  );
  const isEditingMultipart = detail ? isMultipartEditorActive(detail) : false;
  const multipartSegments = detail?.multipartSegments ?? [];
  const multipartPreview = isEditingMultipart
    ? assembleMultipartPreview(multipartSegments, partBodies)
    : "";
  const multipartBodiesLoaded =
    multipartSegments.length > 0 && multipartSegments.every((s) => s.partId in partBodies);
  const canSubmit =
    !!detail &&
    mayAppend &&
    !saving &&
    (isEditingMultipart ? multipartBodiesLoaded : content.length > 0);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/instruments/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (res.status === 404) {
        setDetail(null);
        setError("Instrumento não encontrado.");
        return;
      }
      if (!res.ok) throw new Error(`Falha ao carregar: ${res.status}`);
      const data = (await res.json()) as InstrumentDetail;
      setDetail(data);
      if (isMultipartEditorActive(data)) {
        const next: Record<string, string> = {};
        for (const s of data.multipartSegments ?? []) {
          next[s.partId] = s.markdownBody;
        }
        setPartBodies(next);
        setContent("");
      } else {
        setPartBodies({});
        setContent(data.currentVersionRecord?.content ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o instrumento.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!mayAppend || !id || !detail) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const isMultipart = isMultipartEditorActive(detail);
      const url = isMultipart
        ? `/api/instruments/${encodeURIComponent(id)}/versions/multipart`
        : `/api/instruments/${encodeURIComponent(id)}/content`;
      const body = isMultipart
        ? {
            bodiesByPartId: partBodies,
            revisionNote: revisionNote.trim() === "" ? null : revisionNote.trim(),
          }
        : {
            content,
            revisionNote: revisionNote.trim() === "" ? null : revisionNote.trim(),
          };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ? `Não foi possível salvar: ${body.error}` : `Não foi possível salvar (${res.status}).`);
        return;
      }
      setSuccess("Nova versão registrada pela API do Hub.");
      setRevisionNote("");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p className="text-sm text-zinc-400">Carregando…</p>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p className="mb-4 text-sm text-zinc-400">Entre para editar instrumentos.</p>
        <Link className="text-amber-200/90 underline" href="/login">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main aria-labelledby="edit-page-title" className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 id="edit-page-title" className="text-xl font-semibold tracking-tight">
              Editar Markdown
            </h1>
            {detail && (
              <p className="mt-1 text-sm text-zinc-400">
                {detail.title} · {detail.idrRef} · v{detail.currentVersion} · {detail.status}
              </p>
            )}
          </div>
          <Link className="text-sm text-amber-200/90 underline" href="/">
            ← Início do Hub
          </Link>
        </header>

        {!mayAppend && (
          <p className="rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
            Seu perfil não pode acrescentar conteúdo. Apenas <code className="text-xs">admin</code> ou{" "}
            <code className="text-xs">registrar</code> podem enviar uma nova versão pela API.
          </p>
        )}

        {error && (
          <p className="rounded-md border border-red-900/70 bg-red-950/30 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-emerald-900/70 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200" aria-live="polite">
            {success}
          </p>
        )}

        {detail && (
          <form onSubmit={onSubmit} className="space-y-4">
            {isEditingMultipart ? (
              <div className="space-y-6">
                <p className="text-sm text-zinc-400">
                  Este instrumento usa o perfil <strong className="text-zinc-300">multiparte</strong> (ADR
                  0008). Edite cada segmento abaixo; o Hub agrega os segmentos com a junção estável{" "}
                  <code className="text-xs text-amber-200/90">\n\n</code> antes de registrar a versão.
                </p>

                {multipartSegments.length >= 2 && (
                  <nav
                    aria-label="Navegação entre segmentos"
                    className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4"
                  >
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Ir para segmento
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {multipartSegments.map((seg) => (
                        <a
                          key={seg.partId}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-sm text-amber-100 hover:border-amber-200/80"
                          href={`#${segmentAnchorId(seg)}`}
                        >
                          {seg.partKind} · posição {seg.position}
                        </a>
                      ))}
                    </div>
                  </nav>
                )}

                {multipartSegments.map((seg) => {
                  const anchorId = segmentAnchorId(seg);
                  const titleId = `${anchorId}-titulo`;
                  const body = partBodies[seg.partId] ?? "";
                  return (
                    <section
                      key={seg.partId}
                      id={anchorId}
                      aria-labelledby={titleId}
                      className="scroll-mt-6 rounded-xl border border-zinc-800 bg-zinc-900/20 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 id={titleId} className="text-sm font-semibold text-zinc-200">
                          {seg.partKind} · posição {seg.position}
                        </h2>
                        <p className="text-xs text-zinc-500">{body.length} caracteres</p>
                      </div>
                      <textarea
                        aria-labelledby={titleId}
                        className="min-h-[200px] w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 disabled:opacity-50 lg:min-h-[280px]"
                        value={body}
                        onChange={(e) =>
                          setPartBodies((prev) => ({ ...prev, [seg.partId]: e.target.value }))
                        }
                        disabled={!mayAppend || saving}
                        spellCheck
                      />
                    </section>
                  );
                })}

                <section
                  aria-labelledby="preview-agregado-titulo"
                  className="rounded-xl border border-amber-900/60 bg-amber-950/10 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="preview-agregado-titulo" className="text-sm font-semibold text-amber-100">
                      Pré-visualização agregada
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Ordem da composição · separador <code className="text-amber-200/90">\n\n</code>
                    </p>
                  </div>
                  <div className="max-h-[420px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-relaxed text-zinc-200">
                    <pre className="whitespace-pre-wrap font-sans">{multipartPreview}</pre>
                  </div>
                </section>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Editor (Markdown)
                  </span>
                  <textarea
                    className="min-h-[min(70vh,520px)] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 disabled:opacity-50"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={!mayAppend || saving}
                    spellCheck
                  />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Pré-visualização (simples — quebras de linha preservadas)
                  </span>
                  <div className="min-h-[min(70vh,520px)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm leading-relaxed text-zinc-200">
                    <pre className="whitespace-pre-wrap font-sans">{content}</pre>
                  </div>
                </div>
              </div>
            )}

            <label className="flex max-w-xl flex-col gap-1 text-sm">
              <span className="text-zinc-400">Nota de revisão (opcional)</span>
              <input
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 disabled:opacity-50"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                disabled={!mayAppend || saving}
                maxLength={2000}
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Enviando nova versão…"
                : isEditingMultipart
                  ? "Enviar nova versão multiparte"
                  : "Enviar nova versão monólito"}
            </button>

            {mayAppend && !saving && detail && (
              <p className="text-xs text-zinc-500">
                {!isEditingMultipart && content.length === 0
                  ? "O editor está vazio — adicione Markdown antes de enviar."
                  : isEditingMultipart && !multipartBodiesLoaded
                    ? "Os corpos multiparte não carregaram corretamente — atualize a página. Se persistir, rode npm run backfill:parts em hub-preop com o banco ativo."
                    : null}
              </p>
            )}
          </form>
        )}

        <p className="text-xs text-zinc-600">
          O texto oficial só é registrado após um append bem-sucedido pela API do Hub; esta página não
          contorna o ledger.
        </p>
      </main>
    </div>
  );
}
