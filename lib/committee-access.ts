import type { HubRole } from "@prisma/client";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

export type SessionLike = {
  user: {
    roles: HubRole[];
    committeeMemberships: CommitteeMembershipClaim[];
  };
};

export function userCommitteeIds(session: SessionLike): string[] {
  return session.user.committeeMemberships.map((m) => m.committeeId);
}

/** Admin/registrar/SG supervisionam; membros provisórios e filiação activa acedem ao espaço. */
export function mayAccessComiteWorkspace(session: SessionLike): boolean {
  const roles = session.user.roles;
  if (roles.includes("admin") || roles.includes("registrar")) return true;
  if (roles.includes("secretary_general") || roles.includes("provisional_member")) return true;
  return userCommitteeIds(session).length > 0;
}

export function mayAccessCommitteeInstrument(
  session: SessionLike,
  instrumentCommitteeId: string | null,
): boolean {
  if (!instrumentCommitteeId) return false;
  const roles = session.user.roles;
  if (roles.includes("admin") || roles.includes("registrar")) return true;
  if (roles.includes("secretary_general")) return true;
  if (roles.includes("provisional_member")) return true;
  return userCommitteeIds(session).includes(instrumentCommitteeId);
}
