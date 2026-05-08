import type { ExternalReferenceKind, ExternalReferenceLifecycleStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain/transitions";

export async function createExternalReference(input: {
  kind: ExternalReferenceKind;
  title: string;
  origin: string;
  stableId: string;
  accessedAt: Date;
  status?: ExternalReferenceLifecycleStatus | null;
}) {
  return prisma.externalReference.create({
    data: {
      kind: input.kind,
      title: input.title,
      origin: input.origin,
      stableId: input.stableId,
      accessedAt: input.accessedAt,
      status: input.status ?? undefined,
    },
  });
}

export async function listExternalReferences(take = 100) {
  const n = Math.min(Math.max(take, 1), 200);
  return prisma.externalReference.findMany({
    orderBy: { updatedAt: "desc" },
    take: n,
    include: {
      instruments: {
        include: {
          instrument: { select: { id: true, idrRef: true, title: true } },
        },
      },
    },
  });
}

export async function listExternalReferencesForInstrument(instrumentId: string) {
  const links = await prisma.instrumentExternalReference.findMany({
    where: { instrumentId },
    include: { externalReference: true },
    orderBy: { linkedAt: "desc" },
  });
  return links.map((l) => l.externalReference);
}

export async function linkExternalReferenceToInstrument(input: {
  instrumentId: string;
  externalReferenceId: string;
}) {
  try {
    return await prisma.instrumentExternalReference.create({
      data: {
        instrumentId: input.instrumentId,
        externalReferenceId: input.externalReferenceId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("Referência já vinculada a este instrumento.");
    }
    throw e;
  }
}

export async function updateExternalReferenceStatus(
  id: string,
  status: ExternalReferenceLifecycleStatus,
) {
  return prisma.externalReference.update({
    where: { id },
    data: { status },
  });
}
