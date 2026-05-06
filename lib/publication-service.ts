import { prisma } from "@/lib/prisma";
import { redactInstrumentContent } from "@/lib/audit/export-redaction";

/** Hub statuses that appear in the public catalog (DocHUB §3.8-style inclusion policy). */
export const PUBLICABLE_STATUSES = ["in-force", "foundational-provisional"] as const;

export type PublicableStatus = (typeof PUBLICABLE_STATUSES)[number];

export function isInstrumentPublicable(status: string): status is PublicableStatus {
  return (PUBLICABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Citizen-facing label for public UI / JSON (EN). See ADR 0006.
 */
export function getPublicDisplayLabel(status: string): string {
  if (status === "foundational-provisional") {
    return "Provisional — subject to ratification by the General Assembly";
  }
  if (status === "in-force") {
    return "Ratified";
  }
  return status;
}

export type PublicVersionIndexEntry = {
  version: number;
  createdAt: Date;
  contentHash: string;
  isCurrent: boolean;
  /** Relative path for stable linking (includes ?version= when not current). */
  publicUrlPath: string;
};

export type PublicCatalogItem = {
  idrRef: string;
  title: string;
  layer: number;
  status: string;
  publicDisplayLabel: string;
  currentVersion: number;
  updatedAt: Date;
};

export async function listPublicCatalog(limit = 50): Promise<PublicCatalogItem[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.instrument.findMany({
    where: { status: { in: [...PUBLICABLE_STATUSES] } },
    orderBy: [{ updatedAt: "desc" }],
    take,
    select: {
      idrRef: true,
      title: true,
      layer: true,
      status: true,
      currentVersion: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    publicDisplayLabel: getPublicDisplayLabel(row.status),
  }));
}

export type PublicInstrumentView = {
  idrRef: string;
  title: string;
  layer: number;
  status: string;
  publicDisplayLabel: string;
  currentVersion: number;
  viewedVersion: number;
  isCurrentVersion: boolean;
  updatedAt: Date;
  content: string;
  versions: {
    id: string;
    version: number;
    createdAt: Date;
    contentHash: string;
    previousContentHash: string | null;
    revisionNote: string | null;
  }[];
  publicVersionIndex: PublicVersionIndexEntry[];
  events: {
    id: string;
    at: Date;
    fromStatus: string | null;
    toStatus: string;
    actorKind: string;
    actorLabel: string | null;
    note: string | null;
  }[];
};

export type GetPublicInstrumentOptions = {
  /** When set, load this version snapshot (must exist). Omit = current head. */
  version?: number;
};

/** Exported for tests — stable public URL paths per version (ADR 0006). */
export function buildPublicVersionIndex(
  idrRef: string,
  versions: { version: number; createdAt: Date; contentHash: string }[],
  currentVersion: number,
): PublicVersionIndexEntry[] {
  const encoded = encodeURIComponent(idrRef);
  return [...versions]
    .sort((a, b) => b.version - a.version)
    .map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      contentHash: v.contentHash,
      isCurrent: v.version === currentVersion,
      publicUrlPath:
        v.version === currentVersion
          ? `/public/${encoded}`
          : `/public/${encoded}?version=${v.version}`,
    }));
}

export async function getPublicInstrumentByIdrRef(
  idrRef: string,
  options?: GetPublicInstrumentOptions,
): Promise<PublicInstrumentView | null> {
  const instrument = await prisma.instrument.findUnique({
    where: { idrRef },
    include: {
      currentVersionRecord: true,
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          createdAt: true,
          contentHash: true,
          previousContentHash: true,
          revisionNote: true,
          content: true,
        },
      },
      events: {
        orderBy: [{ at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          at: true,
          fromStatus: true,
          toStatus: true,
          actorKind: true,
          actorLabel: true,
          note: true,
        },
      },
    },
  });
  if (!instrument) return null;
  if (!isInstrumentPublicable(instrument.status)) {
    return null;
  }

  const requested = options?.version;
  const versionRow =
    requested === undefined
      ? instrument.currentVersionRecord
      : (instrument.versions.find((v) => v.version === requested) ?? null);

  if (!versionRow) {
    return null;
  }

  const content = versionRow.content ?? "";
  const redactedContent = redactInstrumentContent("public", instrument.layer, content);

  const versionsPayload = instrument.versions.map(
    ({ id, version, createdAt, contentHash, previousContentHash, revisionNote }) => ({
      id,
      version,
      createdAt,
      contentHash,
      previousContentHash,
      revisionNote,
    }),
  );

  const indexSource = instrument.versions.map((v) => ({
    version: v.version,
    createdAt: v.createdAt,
    contentHash: v.contentHash,
  }));

  return {
    idrRef: instrument.idrRef,
    title: instrument.title,
    layer: instrument.layer,
    status: instrument.status,
    publicDisplayLabel: getPublicDisplayLabel(instrument.status),
    currentVersion: instrument.currentVersion,
    viewedVersion: versionRow.version,
    isCurrentVersion: versionRow.version === instrument.currentVersion,
    updatedAt: instrument.updatedAt,
    content: redactedContent,
    versions: versionsPayload,
    publicVersionIndex: buildPublicVersionIndex(
      instrument.idrRef,
      indexSource,
      instrument.currentVersion,
    ),
    events: instrument.events,
  };
}
