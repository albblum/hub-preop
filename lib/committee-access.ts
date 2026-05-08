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

/** Admin/registrar podem supervisionar; participantes com filiação activa acedem ao espaço. */
export function mayAccessComiteWorkspace(session: SessionLike): boolean {
  const roles = session.user.roles;
  if (roles.includes("admin") || roles.includes("registrar")) return true;
  return userCommitteeIds(session).length > 0;
}

export function mayAccessCommitteeInstrument(
  session: SessionLike,
  instrumentCommitteeId: string | null,
): boolean {
  if (!instrumentCommitteeId) return false;
  const roles = session.user.roles;
  if (roles.includes("admin") || roles.includes("registrar")) return true;
  return userCommitteeIds(session).includes(instrumentCommitteeId);
}
