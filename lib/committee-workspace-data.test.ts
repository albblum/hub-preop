import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCommitteeWorkspaceGroups } from "./committee-workspace-data";
import * as instrumentService from "./instrument-service";

describe("getCommitteeWorkspaceGroups", () => {
  beforeEach(() => {
    vi.spyOn(instrumentService, "listInstruments").mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      take: 200,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty groups when user has no secretariat role and no committee claims", async () => {
    const r = await getCommitteeWorkspaceGroups({
      user: { roles: [], committeeMemberships: [] },
    });
    expect(r.total).toBe(0);
    expect(r.groups.elaboration).toEqual([]);
    expect(instrumentService.listInstruments).not.toHaveBeenCalled();
  });

  it("loads instruments for committee participants", async () => {
    vi.mocked(instrumentService.listInstruments).mockResolvedValue({
      items: [
        {
          id: "i1",
          idrRef: "idr:X",
          title: "T",
          layer: 2,
          status: "draft",
          draftingAuthority: null,
          currentVersion: 1,
          parentInstrumentId: null,
          committeeId: "c1",
          consultationClosesAt: null,
          consultationOpeningNote: null,
          parent: null,
          committee: { id: "c1", code: "C#01" },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 1,
      skip: 0,
      take: 200,
    });

    const r = await getCommitteeWorkspaceGroups({
      user: {
        roles: [],
        committeeMemberships: [
          {
            committeeId: "c1",
            code: "C#01",
            startedAt: new Date().toISOString(),
          },
        ],
      },
    });

    expect(instrumentService.listInstruments).toHaveBeenCalledWith({
      take: 200,
      committeeIds: ["c1"],
    });
    expect(r.total).toBe(1);
    expect(r.groups.elaboration).toHaveLength(1);
  });
});
