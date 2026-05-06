import { describe, expect, it } from "vitest";
import { redactInstrumentContent } from "./export-redaction";

describe("export tier redaction", () => {
  it("public mode redacts body for layer >= 3", () => {
    expect(redactInstrumentContent("public", 2, "open")).toBe("open");
    expect(redactInstrumentContent("public", 3, "secret")).toBe("[REDACTED]");
    expect(redactInstrumentContent("public", 5, "x")).toBe("[REDACTED]");
  });

  it("registered mode allows deeper layers than public", () => {
    expect(redactInstrumentContent("registered", 4, "ok")).toBe("ok");
    expect(redactInstrumentContent("registered", 5, "no")).toBe("[REDACTED]");
  });

  it("restricted mode never redacts by layer (MVP)", () => {
    expect(redactInstrumentContent("restricted", 5, "full")).toBe("full");
  });
});
