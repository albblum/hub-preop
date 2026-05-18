import path from "node:path";

export const FOUNDATION_CORPUS_REL =
  "AlblumZ deeds/IDR/02_Documentos/I. CONSTITUTIONAL FOUNDATION";

export const PREOP_CORPUS_REL =
  "AlblumZ deeds/IDR/02_Documentos/Foudational Norm - Pre-Operational Stage.md";

export function workspaceRootFromHub(): string {
  return path.resolve(process.cwd(), "..");
}

export function resolveCorpusPath(relative: string): string {
  return path.join(workspaceRootFromHub(), relative);
}
