"use client";

import { useCallback, useEffect, useState } from "react";
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

  const mayAppend = canAppendContent(session?.user?.roles);

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
        setError("Instrument not found");
        return;
      }
      if (!res.ok) throw new Error(`Load failed: ${res.status}`);
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
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
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
        setError(body.error ?? `Save failed (${res.status})`);
        return;
      }
      setSuccess("New version recorded via Hub API.");
      setRevisionNote("");
      await load();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p className="mb-4 text-sm text-zinc-400">Sign in to edit instruments.</p>
        <Link className="text-amber-200/90 underline" href="/login">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Edit Markdown</h1>
            {detail && (
              <p className="mt-1 text-sm text-zinc-400">
                {detail.title} · {detail.idrRef} · v{detail.currentVersion} · {detail.status}
              </p>
            )}
          </div>
          <Link className="text-sm text-amber-200/90 underline" href="/">
            ← Hub home
          </Link>
        </header>

        {!mayAppend && (
          <p className="rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
            Your role cannot append content. Only <code className="text-xs">admin</code> or{" "}
            <code className="text-xs">registrar</code> may submit a new version via the API.
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        {detail && (
          <form onSubmit={onSubmit} className="space-y-4">
            {isMultipartEditorActive(detail) ? (
              <div className="space-y-6">
                <p className="text-sm text-zinc-400">
                  This instrument uses the <strong className="text-zinc-300">multi-part</strong> profile (ADR
                  0008). Edit each part below; the Hub aggregates segments with a stable{" "}
                  <code className="text-xs text-amber-200/90">\n\n</code> join for versioning.
                </p>
                {detail.multipartSegments.map((seg) => (
                  <div key={seg.partId} className="grid gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {seg.partKind} · position {seg.position}
                      </span>
                      <textarea
                        className="min-h-[200px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm leading-relaxed text-zinc-100 disabled:opacity-50 lg:min-h-[280px]"
                        value={partBodies[seg.partId] ?? ""}
                        onChange={(e) =>
                          setPartBodies((prev) => ({ ...prev, [seg.partId]: e.target.value }))
                        }
                        disabled={!mayAppend || saving}
                        spellCheck
                      />
                    </label>
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Preview
                      </span>
                      <div className="min-h-[200px] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm leading-relaxed text-zinc-200 lg:min-h-[280px]">
                        <pre className="whitespace-pre-wrap font-sans">
                          {partBodies[seg.partId] ?? ""}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
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
                    Preview (minimal — line breaks preserved)
                  </span>
                  <div className="min-h-[min(70vh,520px)] overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm leading-relaxed text-zinc-200">
                    <pre className="whitespace-pre-wrap font-sans">{content}</pre>
                  </div>
                </div>
              </div>
            )}

            <label className="flex max-w-xl flex-col gap-1 text-sm">
              <span className="text-zinc-400">Revision note (optional)</span>
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
              disabled={
                !mayAppend ||
                saving ||
                (isMultipartEditorActive(detail)
                  ? Object.keys(partBodies).length === 0 ||
                    !detail.multipartSegments?.every((s) => s.partId in partBodies)
                  : content.length === 0)
              }
              className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Submitting…"
                : isMultipartEditorActive(detail)
                  ? "Submit new version (multi-part)"
                  : "Submit new version (monolith)"}
            </button>

            {mayAppend && !saving && detail && (
              <p className="text-xs text-zinc-500">
                {!isMultipartEditorActive(detail) && content.length === 0
                  ? "The editor is empty — add markdown before submitting."
                  : isMultipartEditorActive(detail) &&
                      (Object.keys(partBodies).length === 0 ||
                        !detail.multipartSegments?.every((s) => s.partId in partBodies))
                    ? "Multi-part bodies did not load correctly — try refreshing. If it persists, run backfill: npm run backfill:parts (from hub-preop, DB running)."
                    : null}
              </p>
            )}
          </form>
        )}

        <p className="text-xs text-zinc-600">
          Official text is recorded only after a successful Hub API append; this page does not bypass the
          ledger.
        </p>
      </main>
    </div>
  );
}
