"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  instrumentId: string;
};

export function NormalizationActions({ instrumentId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(label: string, toStatus: string) {
    setError(null);
    setBusy(label);
    try {
      const res = await fetch(`/api/instruments/${instrumentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void act("normalize", "in-force")}
        className="rounded-md bg-emerald-900/80 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy === "normalize" ? "…" : "Normalize → in-force"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void act("ga", "under-review")}
        className="rounded-md bg-amber-900/80 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-800 disabled:opacity-50"
      >
        {busy === "ga" ? "…" : "Forward to GA → under-review"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void act("reject", "revoked")}
        className="rounded-md bg-red-950/80 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900 disabled:opacity-50"
      >
        {busy === "reject" ? "…" : "Reject → revoked"}
      </button>
      {error && <span className="w-full text-xs text-red-400">{error}</span>}
    </div>
  );
}
