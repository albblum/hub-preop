import { describe, it, expect } from "vitest";
import {
  canAppendContent,
  canCreateInstrument,
  canTransition,
  canUseExportMode,
  canViewOperationalQueues,
  maxExportModeForRoles,
} from "./rbac";

describe("rbac export tiers", () => {
  it("denies registered mode for anonymous users", () => {
    expect(canUseExportMode(undefined, "public")).toBe(true);
    expect(canUseExportMode(undefined, "registered")).toBe(false);
    expect(canUseExportMode(undefined, "restricted")).toBe(false);
  });

  it("viewer_public is capped at public exports", () => {
    expect(maxExportModeForRoles(["viewer_public"])).toBe("public");
    expect(canUseExportMode(["viewer_public"], "registered")).toBe(false);
  });

  it("viewer_registered may export registered redaction", () => {
    expect(canUseExportMode(["viewer_registered"], "registered")).toBe(true);
    expect(canUseExportMode(["viewer_registered"], "restricted")).toBe(false);
  });

  it("admin may request restricted export", () => {
    expect(canUseExportMode(["admin"], "restricted")).toBe(true);
    expect(canUseExportMode(["registrar"], "restricted")).toBe(true);
    expect(canUseExportMode(["reviewer"], "restricted")).toBe(false);
  });
});

describe("rbac mutations", () => {
  it("403 semantics: viewer cannot create or edit content", () => {
    expect(canCreateInstrument(["viewer_public"])).toBe(false);
    expect(canAppendContent(["viewer_public"])).toBe(false);
    expect(canTransition(["viewer_public"])).toBe(false);
    expect(canViewOperationalQueues(["viewer_public"])).toBe(false);
  });

  it("reviewer may transition but not create instruments", () => {
    expect(canCreateInstrument(["reviewer"])).toBe(false);
    expect(canTransition(["reviewer"])).toBe(true);
    expect(canViewOperationalQueues(["reviewer"])).toBe(true);
  });

  it("active committee membership grants transition and ops queues without HubRole reviewer", () => {
    const claims = [
      {
        committeeId: "c1",
        code: "C#01",
        startedAt: new Date().toISOString(),
      },
    ];
    expect(canTransition([], claims)).toBe(true);
    expect(canViewOperationalQueues([], claims)).toBe(true);
    expect(canUseExportMode([], "registered", claims)).toBe(true);
    expect(canUseExportMode([], "restricted", claims)).toBe(false);
  });

  it("registrar may create and transition", () => {
    expect(canCreateInstrument(["registrar"])).toBe(true);
    expect(canAppendContent(["registrar"])).toBe(true);
    expect(canTransition(["registrar"])).toBe(true);
  });

  it("committee member may append content only for instruments of their committee", () => {
    const claims = [
      {
        committeeId: "c-com-1",
        code: "C#01",
        startedAt: new Date().toISOString(),
      },
    ];
    expect(canAppendContent([], claims, "c-com-1")).toBe(true);
    expect(canAppendContent([], claims, "other-committee")).toBe(false);
    expect(canAppendContent([], claims, null)).toBe(false);
  });
});
