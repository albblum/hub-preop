"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { RECOGNITION_INSTRUMENT_STATUS } from "@/lib/ui/instrument-queue-status";
import { recognitionRoleBadgeStyle } from "@/lib/ui/recognition-role-style";

type InstrumentListResponse = {
  total: number;
};

type IDRRecognitionModalProps = {
  open: boolean;
  continueHref?: string;
};

async function fetchStatusCount(status: string): Promise<number> {
  const res = await fetch(
    `/api/instruments?status=${encodeURIComponent(status)}&pageSize=1`,
    { credentials: "include" },
  );
  if (!res.ok) return 0;
  const data = (await res.json()) as InstrumentListResponse;
  return data.total ?? 0;
}

export function IDRRecognitionModal({ open, continueHref = "/ops" }: IDRRecognitionModalProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [awaitingReview, setAwaitingReview] = useState(0);
  const [inDeliberation, setInDeliberation] = useState(0);
  const [published, setPublished] = useState(0);
  const [countsLoading, setCountsLoading] = useState(false);

  useEffect(() => {
    if (!open || sessionStatus !== "authenticated") return;

    let cancelled = false;
    setCountsLoading(true);
    void (async () => {
      try {
        const [review, deliberation, pub] = await Promise.all([
          fetchStatusCount(RECOGNITION_INSTRUMENT_STATUS.awaitingReview),
          fetchStatusCount(RECOGNITION_INSTRUMENT_STATUS.inDeliberation),
          fetchStatusCount(RECOGNITION_INSTRUMENT_STATUS.published),
        ]);
        if (!cancelled) {
          setAwaitingReview(review);
          setInDeliberation(deliberation);
          setPublished(pub);
        }
      } finally {
        if (!cancelled) setCountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionStatus]);

  if (!open) return null;

  const user = session?.user;
  const displayName = user?.name ?? user?.email ?? "Member";
  const roles = user?.roles ?? [];
  const committees = user?.committeeMemberships ?? [];
  const badge = recognitionRoleBadgeStyle(roles, committees);

  const statValue = (n: number) => (countsLoading ? "…" : String(n));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="idr-recognition-title"
    >
      <div
        className="flex flex-col items-center bg-white"
        style={{
          width: "480px",
          borderRadius: "12px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
          padding: "40px 48px",
        }}
      >
        <div className="flex flex-col items-center">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-white"
            style={{
              backgroundColor: "var(--color-green-700)",
              fontSize: "10px",
            }}
          >
            IDR
          </div>

          <p
            className="mt-6 font-sans"
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
            }}
          >
            Welcome back
          </p>

          <h1
            id="idr-recognition-title"
            className="mt-1 font-sans font-medium"
            style={{
              fontSize: "20px",
              color: "var(--color-text-primary)",
            }}
          >
            {sessionStatus === "loading" ? "…" : displayName}
          </h1>

          <div
            className="mt-2 font-mono"
            style={{
              padding: "4px 12px",
              borderRadius: "20px",
              backgroundColor: badge.backgroundColor,
              color: badge.color,
              fontSize: "11px",
            }}
          >
            {badge.label}
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <div
            className="flex flex-col bg-white"
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "32px",
                color: "var(--color-green-500)",
              }}
            >
              {statValue(awaitingReview)}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-text-secondary)",
              }}
            >
              Awaiting review
            </span>
          </div>

          <div
            className="flex flex-col bg-white"
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "32px",
                color: "var(--color-orange-300)",
              }}
            >
              {statValue(inDeliberation)}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-text-secondary)",
              }}
            >
              In deliberation
            </span>
          </div>

          <div
            className="flex flex-col bg-white"
            style={{
              padding: "16px 20px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: "32px",
                color: "var(--color-burgundy-500)",
              }}
            >
              {statValue(published)}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "var(--color-text-secondary)",
              }}
            >
              Published
            </span>
          </div>
        </div>

        <div className="mt-8 flex w-full flex-col items-center">
          <Link
            href={continueHref}
            className="group flex h-[40px] w-full items-center justify-center gap-1 rounded-md font-sans text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--color-green-700)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-green-900)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-green-700)";
            }}
          >
            Open DocHUB
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>

          <p
            className="mt-3 text-center font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-text-secondary)",
            }}
          >
            idr · hub · /recognition → {continueHref}
          </p>
        </div>
      </div>
    </div>
  );
}
