import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeContentHash } from "../lib/integrity/content-hash";
import {
  appendInstrumentVersion,
  getInstrumentByIdrRef,
  transitionInstrument,
} from "../lib/instrument-service";
import { syncMonolithicPartForInstrumentVersion } from "../lib/part-composition";

type InitialStatus = "under-review" | "in-force";

type LoteEntry = {
  canonicalTitle: string;
  sourceFile: string;
  idrRef: string;
  layer: number;
  initialStatus?: InitialStatus;
  draftingAuthority?: string;
  parentIdrRef?: string;
};

type LoteMap = {
  actorLabel: string;
  revisionNote: string;
  entries: LoteEntry[];
};

const prisma = new PrismaClient();
const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const MAP_FILE = path.resolve(process.cwd(), "scripts/ingest-lote01-map.json");

async function loadMap(): Promise<LoteMap> {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const parsed = JSON.parse(raw) as LoteMap;
  const missing = parsed.entries.filter((e) => !e.initialStatus);
  if (missing.length > 0) {
    const names = missing.map((m) => m.canonicalTitle).join(", ");
    throw new Error(
      `Pilot decision needed: define initialStatus for entries in scripts/ingest-lote01-map.json -> ${names}`,
    );
  }
  return parsed;
}

async function readSourceMarkdown(relPath: string): Promise<string> {
  const absolute = path.resolve(WORKSPACE_ROOT, relPath);
  return fs.readFile(absolute, "utf8");
}

async function resolveParentId(parentIdrRef?: string): Promise<string | null> {
  if (!parentIdrRef) return null;
  const parent = await prisma.instrument.findUnique({ where: { idrRef: parentIdrRef } });
  if (!parent) {
    throw new Error(`Parent idrRef not found: ${parentIdrRef}`);
  }
  return parent.id;
}

async function createInstrumentAtIdrRef(input: {
  idrRef: string;
  title: string;
  layer: number;
  content: string;
  draftingAuthority?: string;
  parentInstrumentId?: string | null;
}) {
  const v1Hash = computeContentHash(1, input.content);
  const inst = await prisma.$transaction(async (tx) => {
    const created = await tx.instrument.create({
      data: {
        idrRef: input.idrRef,
        title: input.title,
        layer: input.layer,
        status: "draft",
        draftingAuthority: input.draftingAuthority ?? null,
        currentVersion: 1,
        parentInstrumentId: input.parentInstrumentId ?? null,
      },
    });
    const v1 = await tx.instrumentVersion.create({
      data: {
        instrumentId: created.id,
        version: 1,
        content: input.content,
        contentHash: v1Hash,
        previousContentHash: null,
        supersedesVersion: null,
        revisionNote: "C2 founding lote 01 initial ingestion",
      },
    });
    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: created.id,
      instrumentVersion: v1,
      instrumentStatus: "draft",
    });
    return tx.instrument.update({
      where: { id: created.id },
      data: { currentVersionRecordId: v1.id },
    });
  });
  return inst;
}

async function driveToInitialStatus(input: {
  instrumentId: string;
  fromStatus: string;
  targetStatus: InitialStatus;
  actorLabel: string;
  notePrefix: string;
}) {
  if (input.fromStatus === input.targetStatus) return;

  // Transition matrix does not allow draft -> in-force directly.
  if (input.fromStatus === "draft" && input.targetStatus === "in-force") {
    await transitionInstrument({
      instrumentId: input.instrumentId,
      toStatus: "under-review",
      actorLabel: input.actorLabel,
      note: `${input.notePrefix}: staging under-review`,
    });
    await transitionInstrument({
      instrumentId: input.instrumentId,
      toStatus: "in-force",
      actorLabel: input.actorLabel,
      note: `${input.notePrefix}: target in-force`,
    });
    return;
  }

  await transitionInstrument({
    instrumentId: input.instrumentId,
    toStatus: input.targetStatus,
    actorLabel: input.actorLabel,
    note: `${input.notePrefix}: target ${input.targetStatus}`,
  });
}

async function processEntry(entry: LoteEntry, actorLabel: string, revisionNote: string) {
  const content = await readSourceMarkdown(entry.sourceFile);
  const existing = await getInstrumentByIdrRef(entry.idrRef);

  if (!entry.initialStatus) {
    throw new Error(`Missing initialStatus for ${entry.canonicalTitle}`);
  }

  if (!existing) {
    const parentInstrumentId = await resolveParentId(entry.parentIdrRef);
    const created = await createInstrumentAtIdrRef({
      idrRef: entry.idrRef,
      title: entry.canonicalTitle,
      layer: entry.layer,
      content,
      draftingAuthority: entry.draftingAuthority,
      parentInstrumentId,
    });
    await driveToInitialStatus({
      instrumentId: created.id,
      fromStatus: "draft",
      targetStatus: entry.initialStatus,
      actorLabel,
      notePrefix: "C2 founding lote 01 initial status",
    });
    const afterCreate = await getInstrumentByIdrRef(entry.idrRef);
    return {
      idrRef: entry.idrRef,
      action: "created",
      currentVersion: afterCreate?.currentVersion ?? 1,
      status: afterCreate?.status ?? entry.initialStatus,
    };
  }

  const currentContent = existing.currentVersionRecord?.content ?? "";
  if (currentContent !== content) {
    await appendInstrumentVersion({
      instrumentId: existing.id,
      content,
      revisionNote,
    });
  }
  const refreshed = await getInstrumentByIdrRef(entry.idrRef);
  if (!refreshed) {
    throw new Error(`Instrument disappeared after update: ${entry.idrRef}`);
  }
  if (refreshed.status !== entry.initialStatus) {
    await driveToInitialStatus({
      instrumentId: refreshed.id,
      fromStatus: refreshed.status,
      targetStatus: entry.initialStatus,
      actorLabel,
      notePrefix: "C2 founding lote 01 target status",
    });
  }
  const done = await getInstrumentByIdrRef(entry.idrRef);
  return {
    idrRef: entry.idrRef,
    action: currentContent === content ? "status-only-or-noop" : "version-appended",
    currentVersion: done?.currentVersion ?? refreshed.currentVersion,
    status: done?.status ?? refreshed.status,
  };
}

async function main() {
  const map = await loadMap();
  const results: Array<{
    idrRef: string;
    action: string;
    currentVersion: number;
    status: string;
  }> = [];
  for (const entry of map.entries) {
    const result = await processEntry(entry, map.actorLabel, map.revisionNote);
    results.push(result);
  }
  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
