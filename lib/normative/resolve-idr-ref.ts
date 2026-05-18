import type { IdrRefOwnerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NormativeTx } from "./types";

export type ResolvedRef = {
  canonical: string;
  legacy?: string;
  ownerKind: IdrRefOwnerKind;
  ownerId: string;
};

const LEGACY_HUB_INSTR = /^idr:HUB-INSTR-\d+$/;

export function isLegacyHubInstrRef(ref: string): boolean {
  return LEGACY_HUB_INSTR.test(ref);
}

export type RegisterAliasInput = {
  legacyRef: string;
  canonicalRef: string;
  ownerKind?: IdrRefOwnerKind;
  ownerId?: string;
  note?: string;
};

export async function registerAlias(tx: NormativeTx, input: RegisterAliasInput) {
  return tx.idrRefAlias.create({
    data: {
      legacyRef: input.legacyRef,
      canonicalRef: input.canonicalRef,
      ownerKind: input.ownerKind ?? null,
      ownerId: input.ownerId ?? null,
      note: input.note ?? null,
    },
  });
}

/**
 * Lists alias rows sharing the same canonical ref (useful when multiple legacy rows are not possible — see schema PK on legacyRef).
 */
export async function listAliasesByCanonical(canonicalRef: string) {
  return prisma.idrRefAlias.findMany({ where: { canonicalRef } });
}

export type ResolveIdrRefOptions = {
  /** Reserved for future multi-target legacy resolution (schema: one `IdrRefAlias` row per `legacyRef`). */
  includeAllAliasTargets?: boolean;
};

/**
 * Resolves semantic idrRef or legacy `idr:HUB-INSTR-*`: registry → alias → null.
 */
export async function resolveIdrRef(input: string, options?: ResolveIdrRefOptions): Promise<ResolvedRef | null> {
  void options;
  const direct = await prisma.idrRefRegistry.findUnique({ where: { idrRef: input } });
  if (direct) {
    return {
      canonical: input,
      ownerKind: direct.ownerKind,
      ownerId: direct.ownerId,
    };
  }

  if (isLegacyHubInstrRef(input)) {
    const alias = await prisma.idrRefAlias.findUnique({ where: { legacyRef: input } });
    if (!alias) return null;

    const canonical = alias.canonicalRef;
    const reg = await prisma.idrRefRegistry.findUnique({ where: { idrRef: canonical } });
    if (!reg) return null;

    return {
      canonical,
      legacy: input,
      ownerKind: reg.ownerKind,
      ownerId: reg.ownerId,
    };
  }

  return null;
}
