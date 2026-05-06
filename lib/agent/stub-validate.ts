/** Max length aligned with `updateContentBodySchema` to limit abuse. */
export const AGENT_VALIDATE_MAX_CONTENT_CHARS = 100_000;

/** Below this length we do not require an ATX `#` heading. */
const LONG_CONTENT_MIN_CHARS = 800;

export type AgentCheckSeverity = "info" | "warn" | "error";

export type AgentCheck = {
  id: string;
  severity: AgentCheckSeverity;
  message: string;
  passed: boolean;
};

export type StubValidateResult = {
  ok: boolean;
  summary: string;
  checks: AgentCheck[];
};

function lineHasMergeConflictMarker(line: string): boolean {
  return (
    line.startsWith("<<<<<<<") ||
    line.startsWith("=======") ||
    line.startsWith(">>>>>>>")
  );
}

function contentHasNullByte(content: string): boolean {
  return content.includes("\u0000");
}

function hasAtLeastOneAtxHeading(content: string): boolean {
  const lines = content.split(/\r?\n/);
  return lines.some((line) => /^\s*#\s+\S/.test(line));
}

export function runStubAgentValidate(content: string): StubValidateResult {
  const checks: AgentCheck[] = [];

  checks.push({
    id: "content.non_empty",
    severity: "info",
    message: "O texto do rascunho não está vazio.",
    passed: content.length > 0,
  });

  checks.push({
    id: "content.no_null_bytes",
    severity: "error",
    message: "O conteúdo não contém bytes nulos.",
    passed: !contentHasNullByte(content),
  });

  const lines = content.split(/\r?\n/);
  let conflictLine: number | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    if (lineHasMergeConflictMarker(lines[i]!)) {
      conflictLine = i + 1;
      break;
    }
  }

  checks.push({
    id: "content.no_merge_conflict_markers",
    severity: "error",
    message: conflictLine
      ? `Marcadores de conflito de merge não resolvido (ex.: linha ${conflictLine}).`
      : "Nenhum marcador de conflito de merge (<<<<<<<, =======, >>>>>>>) encontrado.",
    passed: conflictLine === undefined,
  });

  const withinLimit = content.length <= AGENT_VALIDATE_MAX_CONTENT_CHARS;
  checks.push({
    id: "content.size_within_limit",
    severity: "error",
    message: withinLimit
      ? `Tamanho dentro do limite (${AGENT_VALIDATE_MAX_CONTENT_CHARS} caracteres).`
      : `Conteúdo excede o limite de ${AGENT_VALIDATE_MAX_CONTENT_CHARS} caracteres.`,
    passed: withinLimit,
  });

  const longEnoughToWantHeading = content.length > LONG_CONTENT_MIN_CHARS;
  const headingOk = !longEnoughToWantHeading || hasAtLeastOneAtxHeading(content);
  checks.push({
    id: "content.heading_when_long",
    severity: "warn",
    message: longEnoughToWantHeading
      ? headingOk
        ? "Texto longo inclui pelo menos um título ATX nível 1 (`#`)."
        : "Texto longo sem título ATX nível 1 (`# ...`); considere adicionar estrutura."
      : "Texto curto — verificação de título não aplicada.",
    passed: headingOk,
  });

  const ok = checks.every((c) => c.passed);
  const failed = checks.filter((c) => !c.passed);
  const errors = failed.filter((c) => c.severity === "error").length;
  const warns = failed.filter((c) => c.severity === "warn").length;

  let summary: string;
  if (ok) {
    summary = "Checklist automático: todas as verificações passaram.";
  } else if (errors > 0) {
    summary = `Checklist automático: ${errors} falha(s) grave(s)${warns ? ` e ${warns} aviso(s)` : ""}.`;
  } else {
    summary = `Checklist automático: ${warns} aviso(s) — sem falhas graves.`;
  }

  return { ok, summary, checks };
}
