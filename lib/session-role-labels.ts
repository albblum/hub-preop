import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

export const SESSION_ROLE_LABEL = {
  member: "Membro",
  secretaryGeneral: "Secretário Geral",
  provisionalMember: "Membro provisório",
  legacyReviewer: "Participante — (legado: reviewer)",
} as const;

function committeeParticipantLabel(code: string): string {
  return `Participante — ${code}`;
}

/**
 * Human-readable session role labels for Hub UI (ops header, recognition badges).
 * PT-BR, aligned with institutional copy elsewhere in the app.
 */
export function sessionRoleLabels(
  roles: readonly HubRole[] | readonly string[],
  committees: CommitteeMembershipClaim[] = [],
): string[] {
  const labels: string[] = [SESSION_ROLE_LABEL.member];

  for (const c of committees) {
    labels.push(committeeParticipantLabel(c.code));
  }

  if (committees.length === 0 && roles.includes("reviewer")) {
    labels.push(SESSION_ROLE_LABEL.legacyReviewer);
  }

  if (
    roles.includes("secretary_general") ||
    roles.includes("registrar") ||
    roles.includes("admin")
  ) {
    if (!labels.includes(SESSION_ROLE_LABEL.secretaryGeneral)) {
      labels.push(SESSION_ROLE_LABEL.secretaryGeneral);
    }
  }

  if (roles.includes("provisional_member")) {
    if (!labels.includes(SESSION_ROLE_LABEL.provisionalMember)) {
      labels.push(SESSION_ROLE_LABEL.provisionalMember);
    }
  }

  return labels;
}

/** SG-style institutional action items on /ops (registrar/admin legacy + Movement 2 role). */
export function hasSecretaryGeneralInstitutionalScope(
  roles: readonly HubRole[] | readonly string[],
): boolean {
  return (
    roles.includes("secretary_general") ||
    roles.includes("registrar") ||
    roles.includes("admin")
  );
}
