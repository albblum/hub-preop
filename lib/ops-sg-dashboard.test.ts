import { describe, expect, it } from "vitest";
import { buildSgExecutiveDashboardProps } from "@/lib/ops-sg-dashboard";

describe("buildSgExecutiveDashboardProps", () => {
  it("maps aggregates and recent transition events for SG dashboard", () => {
    const at = new Date("2026-05-19T12:00:00Z");
    const props = buildSgExecutiveDashboardProps(
      [
        {
          id: "ev1",
          fromStatus: "draft",
          toStatus: "under-review",
          at,
          note: "Consultation opened",
          instrument: { idrRef: "idr:o:test", title: "Transitional Framework" },
        },
      ],
      new Map([
        ["foundational-provisional", 2],
        ["under-review", 3],
      ]),
    );

    expect(props.roleTitle).toBe("Secretary-General · Provisional");
    expect(props.ratification?.count).toBe(2);
    expect(props.consultation?.count).toBe(3);
    expect(props.lastAct?.label).toBe("Consultation opened");
    expect(props.inProgress).toHaveLength(1);
    expect(props.inProgress?.[0]).toMatchObject({
      idrRef: "idr:o:test",
      status: "under-review",
    });
    expect(props.recentDecisions?.[0]?.action).toBe("draft → under-review");
  });
});
