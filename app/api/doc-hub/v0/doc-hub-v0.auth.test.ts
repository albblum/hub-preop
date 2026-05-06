import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/instrument-service", () => ({
  listInstruments: vi.fn().mockResolvedValue({ items: [], total: 0, take: 50 }),
}));

import { auth } from "@/auth";
import { listInstruments } from "@/lib/instrument-service";
import { GET as getInstruments } from "./instruments/route";
import { GET as getLedgerEntries } from "./ledger/entries/route";

describe("DocHUB v0 facade authorization", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.mocked(listInstruments).mockReset();
    vi.mocked(listInstruments).mockResolvedValue({ items: [], total: 0, take: 50 });
  });

  it("GET instruments returns 401 when filtering by status without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await getInstruments(
      new Request("http://localhost/api/doc-hub/v0/instruments?status=draft"),
    );
    expect(res.status).toBe(401);
    expect(listInstruments).not.toHaveBeenCalled();
  });

  it("GET instruments returns 401 when filtering by layer without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await getInstruments(new Request("http://localhost/api/doc-hub/v0/instruments?layer=1"));
    expect(res.status).toBe(401);
    expect(listInstruments).not.toHaveBeenCalled();
  });

  it("GET ledger entries returns 403 without operational role", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { roles: ["viewer_registered"] } });
    const res = await getLedgerEntries(
      new Request("http://localhost/api/doc-hub/v0/ledger/entries?doc_id=cuid"),
    );
    expect(res.status).toBe(403);
  });
});
