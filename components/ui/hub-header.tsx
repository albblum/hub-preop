"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { recognitionRoleBadgeStyle } from "@/lib/ui/recognition-role-style";

type InstrumentHeaderDetail = {
  idrRef: string;
  title: string;
  status: string;
};

function pathnameShowsHubHeader(pathname: string): boolean {
  return (
    pathname.startsWith("/ops") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/normalization") ||
    /^\/instruments\/[^/]+\/edit$/.test(pathname)
  );
}

function breadcrumbSegments(pathname: string, instrument: InstrumentHeaderDetail | null): string[] {
  if (instrument) {
    const shortTitle =
      instrument.title.length > 32 ? `${instrument.title.slice(0, 32)}…` : instrument.title;
    return [instrument.idrRef, shortTitle];
  }
  if (pathname.startsWith("/review")) return ["review"];
  if (pathname.startsWith("/normalization")) return ["normalization"];
  return [];
}

export function HubHeader() {
  const pathname = usePathname() ?? "";
  const params = useParams();
  const { data: session } = useSession();
  const [instrument, setInstrument] = useState<InstrumentHeaderDetail | null>(null);

  const instrumentId = typeof params?.id === "string" ? params.id : null;
  const onInstrumentEdit = Boolean(instrumentId && /^\/instruments\/[^/]+\/edit$/.test(pathname));

  useEffect(() => {
    if (!onInstrumentEdit || !instrumentId) {
      setInstrument(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/instruments/${encodeURIComponent(instrumentId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (!cancelled) setInstrument(null);
        return;
      }
      const data = (await res.json()) as InstrumentHeaderDetail;
      if (!cancelled) setInstrument(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [onInstrumentEdit, instrumentId]);

  const roles = session?.user?.roles ?? [];
  const committees = session?.user?.committeeMemberships ?? [];
  const badge = recognitionRoleBadgeStyle(roles, committees);
  const displayName = session?.user?.name ?? session?.user?.email ?? "Member";
  const crumbs = useMemo(
    () => breadcrumbSegments(pathname, instrument),
    [pathname, instrument],
  );
  const showBreadcrumb = instrument !== null || crumbs.length > 0;

  if (!pathnameShowsHubHeader(pathname)) {
    return null;
  }

  async function handleSignOut() {
    const landing = process.env.NEXT_PUBLIC_LANDING_ORIGIN?.trim().replace(/\/$/, "");
    if (landing) {
      await signOut({ redirect: false });
      window.location.assign(landing);
      return;
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header
      className="flex h-[56px] w-full items-center justify-between border-b bg-white px-6"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-[2px]"
          style={{ backgroundColor: "var(--color-green-700)" }}
        />
        <Link href="/ops" className="flex flex-col leading-tight">
          <span
            className="font-sans font-medium"
            style={{
              fontSize: "15px",
              color: "var(--color-text-primary)",
            }}
          >
            DocHUB
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: "9px",
              color: "var(--color-text-secondary)",
            }}
          >
            International Data Reserve
          </span>
        </Link>
      </div>

      <div className="flex min-h-[24px] items-center gap-2">
        {showBreadcrumb && crumbs.length > 0 ? (
          <div className="flex items-center font-mono" style={{ fontSize: "11px" }}>
            {crumbs.map((segment, index) => (
              <span key={`${segment}-${index}`} className="flex items-center">
                {index > 0 ? (
                  <span className="mx-1" style={{ color: "var(--color-text-secondary)" }}>
                    ›
                  </span>
                ) : null}
                <span
                  style={{
                    color:
                      index === crumbs.length - 1
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                  }}
                >
                  {segment}
                </span>
              </span>
            ))}
          </div>
        ) : null}
        {instrument ? (
          <span
            className="rounded-[20px] border font-mono"
            style={{
              fontSize: "10px",
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              padding: "2px 8px",
            }}
          >
            {instrument.status}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded-[20px] font-mono font-bold"
          style={{
            fontSize: "10px",
            color: badge.color,
            backgroundColor: badge.backgroundColor,
            padding: "3px 8px",
          }}
        >
          {badge.initials}
        </span>
        <span
          className="font-sans"
          style={{
            fontSize: "13px",
            color: "var(--color-text-primary)",
          }}
        >
          {displayName}
        </span>
        <div className="h-4 w-px" style={{ backgroundColor: "var(--color-border)" }} />
        <button
          type="button"
          className="font-sans transition-colors"
          style={{
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
          onClick={() => void handleSignOut()}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--color-text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
