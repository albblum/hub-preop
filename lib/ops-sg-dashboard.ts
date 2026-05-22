import type {
  SGExecutiveDashboardProps,
  SGExecutiveInProgressRow,
  SGExecutiveRecentDecision,
} from "@/components/ui/sg-executive-dashboard";

export type OpsTransitionEvent = {
  id: string;
  fromStatus: string;
  toStatus: string;
  at: Date;
  note: string | null;
  instrument: { idrRef: string; title: string };
};

function formatOpsDate(at: Date): string {
  return at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDays(at: Date): string {
  const days = Math.floor((Date.now() - at.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function pickSubtitle(events: OpsTransitionEvent[], status: string): string | undefined {
  const hit = events.find((e) => e.toStatus === status || e.fromStatus === status);
  if (!hit?.instrument.title) return undefined;
  const title = hit.instrument.title.trim();
  return title.length > 56 ? `${title.slice(0, 56)}…` : title;
}

function mapRecentEvents(events: OpsTransitionEvent[]): {
  inProgress: SGExecutiveInProgressRow[];
  recentDecisions: SGExecutiveRecentDecision[];
} {
  const recent = events.slice(0, 5);
  return {
    inProgress: recent.map((e) => ({
      idrRef: e.instrument.idrRef,
      status: e.toStatus,
      lastUpdate: formatOpsDate(e.at),
    })),
    recentDecisions: recent.map((e) => ({
      idrRef: e.instrument.idrRef,
      action: `${e.fromStatus} → ${e.toStatus}`,
      date: formatOpsDate(e.at),
    })),
  };
}

export function buildSgExecutiveDashboardProps(
  events: OpsTransitionEvent[],
  byStatus: Map<string, number>,
): SGExecutiveDashboardProps {
  const recent = events.slice(0, 5);
  const first = recent[0];
  const { inProgress, recentDecisions } = mapRecentEvents(events);

  const ratificationCount = byStatus.get("foundational-provisional") ?? 0;
  const consultationCount = byStatus.get("under-review") ?? 0;

  return {
    roleTitle: "Secretary-General · Provisional",
    lastAct: first
      ? {
          label: first.note?.trim() || `${first.fromStatus} → ${first.toStatus}`,
          relativeTime: formatRelativeDays(first.at),
        }
      : { label: "No recorded act", relativeTime: "—" },
    ratification: {
      count: ratificationCount,
      subtitle:
        pickSubtitle(recent, "foundational-provisional") ??
        "Instruments in foundational-provisional status",
      ctaLabel: "Review and ratify",
      href: "/review",
    },
    consultation: {
      count: consultationCount,
      subtitle:
        pickSubtitle(recent, "under-review") ?? "Instruments in public consultation",
      ctaLabel: "Open deliberation",
      href: "/review",
    },
    inProgress,
    recentDecisions,
  };
}
