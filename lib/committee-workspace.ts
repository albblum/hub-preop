/** Agrupamento de estados para a lista do espaço de trabalho do comité. */
export const COMMITTEE_LIST_GROUPS = {
  elaboration: ["draft"],
  process: ["under-review", "foundational-provisional", "derivation-pending", "normalization-pending"],
  concluded: ["in-force", "amended", "suspended", "revoked"],
} as const;

export type WorkspaceMode = "elaboration" | "process";

export function instrumentWorkspaceMode(status: string): WorkspaceMode {
  return status === "draft" ? "elaboration" : "process";
}

export function committeeListGroupKey(
  status: string,
): "elaboration" | "process" | "concluded" | "other" {
  if ((COMMITTEE_LIST_GROUPS.elaboration as readonly string[]).includes(status)) {
    return "elaboration";
  }
  if ((COMMITTEE_LIST_GROUPS.process as readonly string[]).includes(status)) {
    return "process";
  }
  if ((COMMITTEE_LIST_GROUPS.concluded as readonly string[]).includes(status)) {
    return "concluded";
  }
  return "other";
}
