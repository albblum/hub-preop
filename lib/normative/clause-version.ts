import type { ClauseVersion } from "@prisma/client";
import { computeContentHash } from "@/lib/integrity/content-hash";
import { prisma } from "@/lib/prisma";
import type { NormativeTx } from "./types";

export type AppendClauseVersionInput = {
  clauseId: string;
  body: string;
  revisionNote?: string | null;
  createdBy?: string | null;
};

export async function appendClauseVersion(
  tx: NormativeTx,
  input: AppendClauseVersionInput,
): Promise<ClauseVersion> {
  const latest = await tx.clauseVersion.findFirst({
    where: { clauseId: input.clauseId },
    orderBy: { version: "desc" },
  });

  const nextVersion = latest ? latest.version + 1 : 1;
  const previousContentHash = latest?.contentHash ?? null;
  const contentHash = computeContentHash(nextVersion, input.body);

  await tx.clauseVersion.updateMany({
    where: { clauseId: input.clauseId, isCurrent: true },
    data: { isCurrent: false },
  });

  const row = await tx.clauseVersion.create({
    data: {
      clauseId: input.clauseId,
      version: nextVersion,
      body: input.body,
      contentHash,
      previousContentHash,
      revisionNote: input.revisionNote ?? null,
      createdBy: input.createdBy ?? null,
      isCurrent: true,
    },
  });

  await tx.normativeClause.update({
    where: { id: input.clauseId },
    data: { currentVersionId: row.id },
  });

  return row;
}

export async function getCurrentClauseVersion(clauseId: string): Promise<ClauseVersion | null> {
  return prisma.clauseVersion.findFirst({
    where: { clauseId, isCurrent: true },
  });
}
