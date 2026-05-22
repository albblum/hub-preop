"use client";

import Link from "next/link";

export type SGExecutiveLastAct = {
  label: string;
  relativeTime: string;
};

export type SGExecutiveActionCard = {
  count: number;
  subtitle: string;
  ctaLabel: string;
  href: string;
};

export type SGExecutiveInProgressRow = {
  idrRef: string;
  status: string;
  lastUpdate: string;
};

export type SGExecutiveRecentDecision = {
  idrRef: string;
  action: string;
  date: string;
};

export type SGExecutiveDashboardProps = {
  roleTitle?: string;
  lastAct?: SGExecutiveLastAct;
  ratification?: SGExecutiveActionCard;
  consultation?: SGExecutiveActionCard;
  inProgress?: SGExecutiveInProgressRow[];
  recentDecisions?: SGExecutiveRecentDecision[];
};

const DEFAULT_LAST_ACT: SGExecutiveLastAct = {
  label: "Nomination",
  relativeTime: "3 days ago",
};

const DEFAULT_RATIFICATION: SGExecutiveActionCard = {
  count: 2,
  subtitle: "Foundational Norm · Pre-Operational Stage",
  ctaLabel: "Review and ratify",
  href: "/ops",
};

const DEFAULT_CONSULTATION: SGExecutiveActionCard = {
  count: 3,
  subtitle: "Transitional Framework · Public consultation window",
  ctaLabel: "Open deliberation",
  href: "/review",
};

const DEFAULT_IN_PROGRESS: SGExecutiveInProgressRow[] = [
  {
    idrRef: "idr:c:foundation",
    status: "foundational-provisional",
    lastUpdate: "22 May 2026",
  },
  {
    idrRef: "idr:o:transitional-framework",
    status: "under-review",
    lastUpdate: "20 May 2026",
  },
  {
    idrRef: "idr:i:preop-regime",
    status: "normalization-pending",
    lastUpdate: "18 May 2026",
  },
];

const DEFAULT_RECENT_DECISIONS: SGExecutiveRecentDecision[] = [
  {
    idrRef: "idr:i:nomination-sg",
    action: "Provisional member nomination recorded",
    date: "19 May 2026",
  },
  {
    idrRef: "idr:c:article-ix",
    action: "Consultation period opened",
    date: "15 May 2026",
  },
  {
    idrRef: "idr:o:registry-mvp",
    action: "Transition under-review → foundational-provisional",
    date: "12 May 2026",
  },
  {
    idrRef: "idr:c:foundation",
    action: "Draft submitted to committee workspace",
    date: "8 May 2026",
  },
  {
    idrRef: "idr:i:iba-2026",
    action: "Institutional act published to ledger",
    date: "3 May 2026",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-3 font-mono uppercase"
      style={{
        fontSize: "10px",
        letterSpacing: "1.5px",
        color: "var(--color-text-secondary)",
      }}
    >
      {children}
    </p>
  );
}

type ActionCardVariant = "ratification" | "consultation";

function ActionCard({
  variant,
  title,
  card,
}: {
  variant: ActionCardVariant;
  title: string;
  card: SGExecutiveActionCard;
}) {
  const isRatification = variant === "ratification";
  const accentColor = isRatification
    ? "var(--color-burgundy-700)"
    : "var(--color-orange-300)";
  const badgeBg = isRatification ? "var(--color-burgundy-100)" : "var(--color-orange-100)";
  const badgeColor = isRatification ? "var(--color-burgundy-900)" : "var(--color-orange-900)";
  const buttonBg = isRatification ? "var(--color-burgundy-700)" : "var(--color-orange-500)";
  const buttonHover = isRatification ? "var(--color-burgundy-900)" : "var(--color-orange-900)";

  return (
    <article
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white"
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
      }}
    >
        <div
          className="flex flex-1 flex-col gap-3"
          style={{ borderLeft: `4px solid ${accentColor}`, padding: "16px 20px" }}
        >
          <div className="flex items-start justify-between gap-3">
            <h3
              className="font-sans font-medium"
              style={{ fontSize: "14px", color: "var(--color-text-primary)" }}
            >
              {title}
            </h3>
            <span
              className="shrink-0 font-mono font-bold"
              style={{
                fontSize: "13px",
                color: badgeColor,
                backgroundColor: badgeBg,
                borderRadius: "20px",
                padding: "2px 8px",
              }}
            >
              {card.count}
            </span>
          </div>

          <p
            className="truncate font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}
            title={card.subtitle}
          >
            {card.subtitle}
          </p>

          <Link
            href={card.href}
            className="inline-flex w-fit items-center gap-1 font-sans text-white transition-colors"
            style={{
              fontSize: "13px",
              backgroundColor: buttonBg,
              padding: "8px 16px",
              borderRadius: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = buttonHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = buttonBg;
            }}
          >
            {card.ctaLabel}
            <span aria-hidden>→</span>
          </Link>
        </div>
    </article>
  );
}

/**
 * Executive dashboard for the Secretary-General (IDR DocHUB).
 * Desktop layout · white institutional surface · IDR design tokens.
 */
export function SGExecutiveDashboard({
  roleTitle = "Secretary-General · Provisional",
  lastAct = DEFAULT_LAST_ACT,
  ratification = DEFAULT_RATIFICATION,
  consultation = DEFAULT_CONSULTATION,
  inProgress = DEFAULT_IN_PROGRESS,
  recentDecisions = DEFAULT_RECENT_DECISIONS,
}: SGExecutiveDashboardProps) {
  const visibleDecisions = recentDecisions.slice(0, 5);

  return (
    <div
      className="mx-auto w-full max-w-[1100px] bg-white px-8 py-10 font-sans"
      style={{ color: "var(--color-text-primary)" }}
    >
      {/* TOP BAR */}
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p
            className="uppercase"
            style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
          >
            Executive Panel
          </p>
          <h1
            className="mt-1 font-medium"
            style={{ fontSize: "18px", color: "var(--color-text-primary)" }}
          >
            {roleTitle}
          </h1>
        </div>

        <div
          className="shrink-0 font-mono"
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "20px",
            padding: "4px 12px",
          }}
        >
          Last act: {lastAct.label} · {lastAct.relativeTime}
        </div>
      </header>

      {/* ZONE 1 — Requires decision */}
      <section className="mb-10" aria-labelledby="sg-zone-requires-action">
        <SectionLabel>REQUIRES YOUR ACTION</SectionLabel>
        <div id="sg-zone-requires-action" className="flex gap-3">
          <ActionCard variant="ratification" title="Awaiting ratification" card={ratification} />
          <ActionCard variant="consultation" title="In public consultation" card={consultation} />
        </div>
      </section>

      {/* ZONE 2 — In progress */}
      <section className="mb-10" aria-labelledby="sg-zone-in-progress">
        <SectionLabel>IN PROGRESS</SectionLabel>
        <div
          id="sg-zone-in-progress"
          className="overflow-hidden bg-white"
          style={{ border: "1px solid var(--color-border)", borderRadius: "8px" }}
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                {["idrRef", "Status", "Last update"].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3 font-sans font-medium"
                    style={{
                      fontSize: "12px",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inProgress.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-6 font-sans"
                    style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
                  >
                    No instruments in progress.
                  </td>
                </tr>
              ) : (
                inProgress.map((row) => (
                  <tr key={row.idrRef} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td
                      className="px-5 py-3 font-mono"
                      style={{ fontSize: "11px", color: "var(--color-text-primary)" }}
                    >
                      {row.idrRef}
                    </td>
                    <td
                      className="px-5 py-3 font-sans"
                      style={{ fontSize: "12px", color: "var(--color-text-primary)" }}
                    >
                      {row.status}
                    </td>
                    <td
                      className="px-5 py-3 font-sans"
                      style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
                    >
                      {row.lastUpdate}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ZONE 3 — Recent decisions */}
      <section aria-labelledby="sg-zone-decisions">
        <SectionLabel>RECENT DECISIONS</SectionLabel>
        <ul id="sg-zone-decisions" className="space-y-0">
          {visibleDecisions.length === 0 ? (
            <li
              className="font-sans"
              style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}
            >
              No recent decisions recorded.
            </li>
          ) : (
            visibleDecisions.map((item) => (
              <li
                key={`${item.idrRef}-${item.date}`}
                className="flex items-start gap-3 py-3"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--color-green-700)" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className="font-mono"
                      style={{ fontSize: "11px", color: "var(--color-text-primary)" }}
                    >
                      {item.idrRef}
                    </span>
                    <span
                      className="font-sans"
                      style={{ fontSize: "12px", color: "var(--color-text-primary)" }}
                    >
                      {item.action}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 font-mono"
                    style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}
                  >
                    {item.date}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
