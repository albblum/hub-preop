import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-internal-path";

describe("safeInternalPath", () => {
  it("returns fallback for null and empty", () => {
    expect(safeInternalPath(null, "/ops")).toBe("/ops");
    expect(safeInternalPath("", "/ops")).toBe("/ops");
  });

  it("allows simple internal paths", () => {
    expect(safeInternalPath("/ops", "/x")).toBe("/ops");
    expect(safeInternalPath("/public", "/x")).toBe("/public");
    expect(safeInternalPath("/comite/foo", "/x")).toBe("/comite/foo");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeInternalPath("//evil.com", "/ops")).toBe("/ops");
    expect(safeInternalPath("https://evil.com", "/ops")).toBe("/ops");
    expect(safeInternalPath("/\\evil", "/ops")).toBe("/ops");
  });

  it("decodes once then validates", () => {
    expect(safeInternalPath(encodeURIComponent("/ops"), "/x")).toBe("/ops");
    expect(safeInternalPath("%2F%2Fevil.com", "/ops")).toBe("/ops");
  });
});
