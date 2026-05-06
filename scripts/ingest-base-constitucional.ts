import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeContentHash } from "../lib/integrity/content-hash";
import { getInstrumentByIdrRef, transitionInstrument } from "../lib/instrument-service";
import { syncMonolithicPartForInstrumentVersion } from "../lib/part-composition";

type PartCode = "P0" | "P1" | "P2" | "P3";

type BasePart = {
  idrRef: string;
  docCode: string;
  partCode: PartCode;
  title: string;
  layer: number;
  status: "under-review";
  parentIdrRef?: string;
  content: string;
};

const prisma = new PrismaClient();
const WORKSPACE_ROOT = path.resolve(process.cwd(), "..");
const SOURCE_FILE = path.resolve(
  WORKSPACE_ROOT,
  "AlblumZ deeds/IDR/02_Documentos/HUB_PREOP/C3_Framework_Particionado.md",
);

function between(raw: string, from: string, to?: string): string {
  const start = raw.indexOf(from);
  if (start < 0) {
    throw new Error(`Missing section marker: ${from}`);
  }
  const bodyStart = start + from.length;
  const end = to ? raw.indexOf(to, bodyStart) : raw.length;
  if (to && end < 0) {
    throw new Error(`Missing section marker: ${to}`);
  }
  return raw.slice(bodyStart, end).trim();
}

function extractContent(source: string, marker: string, nextMarker?: string): string {
  const section = between(source, marker, nextMarker);
  const contentHeader = "### Content";
  const idx = section.indexOf(contentHeader);
  if (idx < 0) {
    throw new Error(`Missing "${contentHeader}" in section ${marker}`);
  }
  return section.slice(idx + contentHeader.length).trim();
}

async function createOrUpdatePart(part: BasePart) {
  const existing = await getInstrumentByIdrRef(part.idrRef);
  const canonicalContent =
    `doc_code: ${part.docCode}\npart_code: ${part.partCode}\n\n` + part.content;

  if (!existing) {
    const parentId = part.parentIdrRef
      ? (await prisma.instrument.findUnique({ where: { idrRef: part.parentIdrRef } }))?.id ?? null
      : null;
    if (part.parentIdrRef && !parentId) {
      throw new Error(`Parent not found for ${part.idrRef}: ${part.parentIdrRef}`);
    }

    const hash = computeContentHash(1, canonicalContent);
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.instrument.create({
        data: {
          idrRef: part.idrRef,
          title: part.title,
          layer: part.layer,
          status: "draft",
          draftingAuthority: "regional-placeholder",
          currentVersion: 1,
          parentInstrumentId: parentId,
        },
      });
      const v1 = await tx.instrumentVersion.create({
        data: {
          instrumentId: row.id,
          version: 1,
          content: canonicalContent,
          contentHash: hash,
          previousContentHash: null,
          supersedesVersion: null,
          revisionNote: "C3.1 reupload base constitucional",
        },
      });
      await syncMonolithicPartForInstrumentVersion(tx, {
        instrumentId: row.id,
        instrumentVersion: v1,
        instrumentStatus: "draft",
      });
      return tx.instrument.update({
        where: { id: row.id },
        data: { currentVersionRecordId: v1.id },
      });
    });

    await transitionInstrument({
      instrumentId: created.id,
      toStatus: part.status,
      actorLabel: "pilot-c3.1",
      note: `C3.1 initial status ${part.status}`,
    });
    return { idrRef: part.idrRef, action: "created", status: part.status };
  }

  await prisma.$transaction(async (tx) => {
    const nextVersion = existing.currentVersion + 1;
    const prev = existing.currentVersionRecord?.contentHash ?? null;
    const hash = computeContentHash(nextVersion, canonicalContent);
    const ver = await tx.instrumentVersion.create({
      data: {
        instrumentId: existing.id,
        version: nextVersion,
        content: canonicalContent,
        contentHash: hash,
        previousContentHash: prev,
        supersedesVersion: existing.currentVersion,
        revisionNote: "C3.1 reupload base constitucional",
      },
    });
    await syncMonolithicPartForInstrumentVersion(tx, {
      instrumentId: existing.id,
      instrumentVersion: ver,
      instrumentStatus: existing.status,
    });
    await tx.instrument.update({
      where: { id: existing.id },
      data: {
        title: part.title,
        layer: part.layer,
        currentVersion: nextVersion,
        currentVersionRecordId: ver.id,
      },
    });
  });

  const refreshed = await getInstrumentByIdrRef(part.idrRef);
  if (refreshed && refreshed.status !== part.status) {
    await transitionInstrument({
      instrumentId: refreshed.id,
      toStatus: part.status,
      actorLabel: "pilot-c3.1",
      note: `C3.1 target status ${part.status}`,
    });
  }
  return { idrRef: part.idrRef, action: "updated", status: part.status };
}

async function main() {
  const source = await fs.readFile(SOURCE_FILE, "utf8");

  const p0 = extractContent(source, "## FRW / P0 - Placeholder pre-op", "## FRW / P1 - Preamble");
  const p1 = extractContent(
    source,
    "## FRW / P1 - Preamble",
    "## FRW / P2 - Core constitutional and governance body",
  );
  const p2 = extractContent(
    source,
    "## FRW / P2 - Core constitutional and governance body",
    "## FRW / P3 - Transition, participation and annexes",
  );
  const p3 = extractContent(source, "## FRW / P3 - Transition, participation and annexes");

  const parts: BasePart[] = [
    {
      idrRef: "idr:HUB-INSTR-00009001",
      docCode: "FRW",
      partCode: "P0",
      title: "The Framework — P0 Placeholder pre-op",
      layer: 1,
      status: "under-review",
      content: p0,
    },
    {
      idrRef: "idr:HUB-INSTR-00009002",
      docCode: "FRW",
      partCode: "P1",
      title: "The Framework — Preamble (P1)",
      layer: 1,
      status: "under-review",
      parentIdrRef: "idr:HUB-INSTR-00009001",
      content: p1,
    },
    {
      idrRef: "idr:HUB-INSTR-00009003",
      docCode: "FRW",
      partCode: "P2",
      title: "The Framework — Core body (P2)",
      layer: 1,
      status: "under-review",
      parentIdrRef: "idr:HUB-INSTR-00009002",
      content: p2,
    },
    {
      idrRef: "idr:HUB-INSTR-00009004",
      docCode: "FRW",
      partCode: "P3",
      title: "The Framework — Transition and annexes (P3)",
      layer: 1,
      status: "under-review",
      parentIdrRef: "idr:HUB-INSTR-00009003",
      content: p3,
    },
  ];

  const results: Array<{ idrRef: string; action: string; status: string }> = [];
  for (const part of parts) {
    results.push(await createOrUpdatePart(part));
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
