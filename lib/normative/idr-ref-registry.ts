import type { IdrRefOwnerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormativeTx } from "./types";

export class IdrRefCollisionError extends Error {
  readonly idrRef: string;

  constructor(idrRef: string) {
    super(`idrRef already registered: ${idrRef}`);
    this.name = "IdrRefCollisionError";
    this.idrRef = idrRef;
  }
}

export type RegisterIdrRefInput = {
  idrRef: string;
  ownerKind: IdrRefOwnerKind;
  ownerId: string;
  grammarVersion?: string;
};

export async function registerIdrRef(tx: NormativeTx, input: RegisterIdrRefInput) {
  const { idrRef, ownerKind, ownerId, grammarVersion } = input;
  try {
    return await tx.idrRefRegistry.create({
      data: {
        idrRef,
        ownerKind,
        ownerId,
        grammarVersion: grammarVersion ?? "1",
      },
    });
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      throw new IdrRefCollisionError(idrRef);
    }
    throw e;
  }
}

export async function assertIdrRefAvailable(tx: NormativeTx, idrRef: string): Promise<void> {
  const row = await tx.idrRefRegistry.findUnique({ where: { idrRef } });
  if (row) {
    throw new IdrRefCollisionError(idrRef);
  }
}

export async function lookupOwner(
  idrRef: string,
): Promise<{ ownerKind: IdrRefOwnerKind; ownerId: string } | null> {
  const row = await prisma.idrRefRegistry.findUnique({ where: { idrRef } });
  if (!row) return null;
  return { ownerKind: row.ownerKind, ownerId: row.ownerId };
}
