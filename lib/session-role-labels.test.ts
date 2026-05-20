import { describe, expect, it } from "vitest";
import {
  SESSION_ROLE_LABEL,
  hasSecretaryGeneralInstitutionalScope,
  sessionRoleLabels,
} from "./session-role-labels";

describe("sessionRoleLabels", () => {
  it("labels secretary_general as Secretário Geral", () => {
    expect(sessionRoleLabels(["secretary_general"], [])).toEqual([
      SESSION_ROLE_LABEL.member,
      SESSION_ROLE_LABEL.secretaryGeneral,
    ]);
  });

  it("labels provisional_member as Membro provisório", () => {
    expect(sessionRoleLabels(["provisional_member"], [])).toEqual([
      SESSION_ROLE_LABEL.member,
      SESSION_ROLE_LABEL.provisionalMember,
    ]);
  });

  it("includes committee participation and SG for idr-sg-0001 shape", () => {
    expect(
      sessionRoleLabels(["secretary_general"], [
        { committeeId: "c1", code: "IDR-PROVISIONAL", startedAt: "2026-01-01T00:00:00.000Z" },
      ]),
    ).toEqual([
      SESSION_ROLE_LABEL.member,
      "Participante — IDR-PROVISIONAL",
      SESSION_ROLE_LABEL.secretaryGeneral,
    ]);
  });

  it("preserves legacy registrar/admin Secretário Geral label", () => {
    expect(sessionRoleLabels(["admin", "registrar"], [])).toEqual([
      SESSION_ROLE_LABEL.member,
      SESSION_ROLE_LABEL.secretaryGeneral,
    ]);
  });

  it("provisional member with committee gets both labels", () => {
    expect(
      sessionRoleLabels(["provisional_member"], [
        { committeeId: "c1", code: "IDR-PROVISIONAL", startedAt: "2026-01-01T00:00:00.000Z" },
      ]),
    ).toEqual([
      SESSION_ROLE_LABEL.member,
      "Participante — IDR-PROVISIONAL",
      SESSION_ROLE_LABEL.provisionalMember,
    ]);
  });
});

describe("hasSecretaryGeneralInstitutionalScope", () => {
  it("is true for secretary_general", () => {
    expect(hasSecretaryGeneralInstitutionalScope(["secretary_general"])).toBe(true);
  });

  it("is false for provisional_member only", () => {
    expect(hasSecretaryGeneralInstitutionalScope(["provisional_member"])).toBe(false);
  });
});
