import { NextResponse } from "next/server";
import { requireComiteWorkspace } from "@/lib/committee-api-session";
import { getCommitteeWorkspaceGroups } from "@/lib/committee-workspace-data";

/** Lista de instrumentos do comité, agrupados por fase (elaboração / processo / concluídos). */
export async function GET() {
  const gate = await requireComiteWorkspace();
  if (!gate.ok) return gate.response;

  const payload = await getCommitteeWorkspaceGroups(gate.sessionLike);
  return NextResponse.json(payload);
}
