import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

type ValidationIssue = {
  line?: number;
  message: string;
};

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function failWithUsage(message: string): never {
  console.error(`Error: ${message}`);
  console.error("Usage: npm run validate:markdown -- --file <path/to/file.md> [--min-chars 30]");
  process.exit(1);
}

function validateMarkdown(filePath: string, minChars: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const raw = readFileSync(filePath, "utf-8");
  const trimmed = raw.trim();

  if (trimmed.length < minChars) {
    issues.push({
      message: `File has ${trimmed.length} non-whitespace chars; minimum required is ${minChars}.`,
    });
  }

  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes("\u0000")) {
      issues.push({ line: i + 1, message: "Contains null byte character." });
    }
    if (line.length > 500) {
      issues.push({ line: i + 1, message: "Line exceeds 500 characters." });
    }
    if (
      line.startsWith("<<<<<<<") ||
      line.startsWith("=======") ||
      line.startsWith(">>>>>>>")
    ) {
      issues.push({ line: i + 1, message: "Contains unresolved merge conflict marker." });
    }
  }

  return issues;
}

function main() {
  const fileArg = readArg("--file");
  const minCharsArg = readArg("--min-chars");
  const minChars = minCharsArg ? Number(minCharsArg) : 30;

  if (!fileArg) failWithUsage("Missing required --file argument.");
  if (!Number.isFinite(minChars) || minChars < 1) {
    failWithUsage("--min-chars must be a positive number.");
  }

  const filePath = resolve(fileArg);
  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    failWithUsage(`File does not exist: ${filePath}`);
  }

  if (!stats.isFile()) {
    failWithUsage(`Path is not a file: ${filePath}`);
  }
  if (stats.size === 0) {
    failWithUsage("File is empty.");
  }

  const issues = validateMarkdown(filePath, minChars);
  if (issues.length > 0) {
    console.error(`Markdown validation failed for: ${filePath}`);
    for (const issue of issues) {
      if (issue.line) {
        console.error(`- line ${issue.line}: ${issue.message}`);
      } else {
        console.error(`- ${issue.message}`);
      }
    }
    process.exit(1);
  }

  console.log(`Markdown validation passed: ${filePath}`);
}

main();
