import { listInstruments } from "@/lib/instrument-service";
import { committeeListGroupKey } from "@/lib/committee-workspace";
import type { SessionLike } from "@/lib/committee-access";
import { userCommitteeIds } from "@/lib/committee-access";

export type CommitteeWorkspaceListItem = Awaited<
  ReturnType<typeof listInstruments>
>["items"][number];

export type CommitteeWorkspaceGroups = {
  elaboration: CommitteeWorkspaceListItem[];
  process: CommitteeWorkspaceListItem[];
  concluded: CommitteeWorkspaceListItem[];
  other: CommitteeWorkspaceListItem[];
};

/** Lista agrupada para o espaço de trabalho do comité (MVP). */
export async function getCommitteeWorkspaceGroups(session: SessionLike): Promise<{
  groups: CommitteeWorkspaceGroups;
  total: number;
}> {
  const roles = session.user.roles;
  const isSecretariat = roles.includes("admin") || roles.includes("registrar");
  const memberCommittees = userCommitteeIds(session);

  if (!isSecretariat && memberCommittees.length === 0) {
    return {
      groups: { elaboration: [], process: [], concluded: [], other: [] },
      total: 0,
    };
  }

  const { items } = await listInstruments({
    take: 200,
    ...(isSecretariat
      ? { onlyCommitteeAssigned: true }
      : { committeeIds: memberCommittees }),
  });

  const groups: CommitteeWorkspaceGroups = {
    elaboration: [],
    process: [],
    concluded: [],
    other: [],
  };

  for (const row of items) {
    const k = committeeListGroupKey(row.status);
    groups[k].push(row);
  }

  return { groups, total: items.length };
}
