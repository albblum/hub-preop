import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/domain/transitions";
import { committeeFormalApproval } from "@/lib/committee-acts";

const { findUniqueMock, findFirstMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instrument: {
      findUnique: findUniqueMock,
    },
    transitionEvent: {
      findFirst: findFirstMock,
    },
  },
}));

describe("committeeFormalApproval", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findFirstMock.mockReset();
  });

  it("requires a prior PRC deliberation event before SG approval", async () => {
    findUniqueMock.mockResolvedValue({
      id: "inst-1",
      idrRef: "idr:inst-1",
      documentType: "generic",
      status: "under-review",
      layer: 1,
      parentInstrumentId: null,
      parent: null,
      committeeId: "committee-1",
    });
    findFirstMock.mockResolvedValue(null);

    await expect(
      committeeFormalApproval({
        instrumentId: "inst-1",
        foundationNote: "aprovação SG",
        actorKind: "human",
        actorLabel: "SG",
        actorExternalId: "user-1",
      }),
    ).rejects.toMatchObject<Partial<DomainError>>({
      name: "DomainError",
      domainCode: "PRC_ACT_REQUIRED",
    });
  });
});
