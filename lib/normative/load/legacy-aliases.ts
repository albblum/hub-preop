import { prisma } from "@/lib/prisma";
import { registerAlias } from "../resolve-idr-ref";
import type { NormativeTx } from "../types";
import { composeDocumentIdrRef } from "./compose-clause-ref";

/** Matches `ingest-constitutional-foundation.ts` FILE_ORDER. */
export const FOUNDATION_FILE_ORDER: string[] = [
  "PREAMBLE.md",
  "INTRODUCTION.md",
  "ARTICLE I · RIGHTS IN PRODUCED DATA.md",
  "ARTICLE II · DATA SOVEREIGNTY.md",
  "ARTICLE III · THE ASYMMETRY PROBLEM.md",
  "ARTICLE IV · THE CONSTITUTIONAL BASIS OF THE RESERVE.md",
  "ARTICLE V · SCOPE AND APPLICATION.md",
  "ARTICLE VI · RELATION TO NATIONAL AND SUPRANATIONAL LEGAL ORDERS.md",
  "ARTICLE VII · NON-DISCRIMINATION AND UNIVERSALITY.md",
];

const FILE_TO_SECTION: Record<string, string> = {
  "PREAMBLE.md": "s0",
  "INTRODUCTION.md": "s1",
  "ARTICLE I · RIGHTS IN PRODUCED DATA.md": "s2",
  "ARTICLE II · DATA SOVEREIGNTY.md": "s3",
  "ARTICLE III · THE ASYMMETRY PROBLEM.md": "s4",
  "ARTICLE IV · THE CONSTITUTIONAL BASIS OF THE RESERVE.md": "s5",
  "ARTICLE V · SCOPE AND APPLICATION.md": "s6",
  "ARTICLE VI · RELATION TO NATIONAL AND SUPRANATIONAL LEGAL ORDERS.md": "s7",
  "ARTICLE VII · NON-DISCRIMINATION AND UNIVERSALITY.md": "s8",
};

function titleFromFileName(file: string): string {
  return file.replace(/\.md$/i, "").replace(/·/g, "—");
}

export type LegacyAliasRow = {
  legacyRef: string;
  canonicalRef: string;
  note: string;
};

export async function registerFoundationLegacyAliases(
  tx: NormativeTx,
  foundationInstrumentId: string,
): Promise<LegacyAliasRow[]> {
  const canonicalRef = composeDocumentIdrRef("foundation");

  const monoliths = await prisma.instrument.findMany({
    where: {
      idrRef: { startsWith: "idr:HUB-INSTR-" },
      structuralProfile: "v1",
    },
    orderBy: { createdAt: "asc" },
  });

  const rows: LegacyAliasRow[] = [];

  for (const file of FOUNDATION_FILE_ORDER) {
    const title = titleFromFileName(file);
    const legacy = monoliths.find((m) => m.title === title || m.title.replace(/·/g, "—") === title);
    if (!legacy) continue;

    const section = FILE_TO_SECTION[file] ?? "s0";
    const note = `foundation monolith ${file} → v2 section ${section}`;
    await registerAlias(tx, {
      legacyRef: legacy.idrRef,
      canonicalRef,
      ownerKind: "instrument",
      ownerId: foundationInstrumentId,
      note,
    });
    rows.push({ legacyRef: legacy.idrRef, canonicalRef, note });
  }

  return rows;
}
