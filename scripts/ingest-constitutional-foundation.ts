/**
 * Ingest markdown files from "I. CONSTITUTIONAL FOUNDATION" as separate monolithic instruments.
 *
 * Why monolith per file: ADR 0008 / schema allow at most one SECTION and one ANNEX per instrument
 * (@@unique([instrumentId, partKind])). Nine editorial blocks require nine instruments unless partKind vocabulary expands.
 *
 * Usage:
 *   npx tsx scripts/ingest-constitutional-foundation.ts [absolute-or-relative-folder]
 *
 * Default folder (when arg omitted): sibling of hub-preop:
 *   ../AlblumZ deeds/IDR/02_Documentos/I. CONSTITUTIONAL FOUNDATION
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createInstrument } from "../lib/instrument-service";

const DEFAULT_RELATIVE =
  "AlblumZ deeds/IDR/02_Documentos/I. CONSTITUTIONAL FOUNDATION";

/** Editorial order (not alphabetical: INTRODUCTION before PREAMBLE lexicographically). */
const FILE_ORDER: string[] = [
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

function sortFiles(names: string[]): string[] {
  const set = new Set(names);
  const ordered: string[] = [];
  for (const n of FILE_ORDER) {
    if (set.has(n)) ordered.push(n);
  }
  for (const n of names.sort()) {
    if (!ordered.includes(n)) ordered.push(n);
  }
  return ordered;
}

function titleFromFileName(file: string): string {
  return file.replace(/\.md$/i, "").replace(/·/g, "—");
}

async function main() {
  const workspaceRoot = path.resolve(process.cwd(), "..");
  const argDir = process.argv[2];
  const dir = argDir
    ? path.resolve(process.cwd(), argDir)
    : path.join(workspaceRoot, DEFAULT_RELATIVE);

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (e) {
    console.error(`Cannot read directory: ${dir}`);
    console.error(e);
    process.exit(1);
  }

  const mdFiles = entries.filter((f) => f.toLowerCase().endsWith(".md"));
  if (mdFiles.length === 0) {
    console.error(`No .md files in ${dir}`);
    process.exit(1);
  }

  const ordered = sortFiles(mdFiles);
  const results: { title: string; idrRef?: string; error?: string }[] = [];

  for (const file of ordered) {
    const full = path.join(dir, file);
    const content = await fs.readFile(full, "utf8");
    const title = titleFromFileName(file);
    try {
      const inst = await createInstrument({
        title,
        layer: 1,
        draftingAuthority: "constitutional-foundation-ingest",
        content,
        parentInstrumentId: null,
      });
      results.push({ title, idrRef: inst.idrRef });
      console.log(`OK ${inst.idrRef} — ${title}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ title, error: msg });
      console.error(`FAIL ${title}: ${msg}`);
    }
  }

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error(`${failed.length} failed`);
    process.exit(1);
  }
}

main();
