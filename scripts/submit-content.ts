import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

type SubmitArgs = {
  baseUrl: string;
  instrumentId: string;
  file: string;
  cookie?: string;
  revisionNote?: string;
};

function readArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function failWithUsage(message: string): never {
  console.error(`Error: ${message}`);
  console.error(
    "Usage: npm run submit:content -- --base-url <http://localhost:3000> --instrument-id <id> --file <file.md> [--cookie \"next-auth.session-token=...\"] [--revision-note \"...\"]",
  );
  process.exit(1);
}

function parseArgs(): SubmitArgs {
  const baseUrl = readArg("--base-url");
  const instrumentId = readArg("--instrument-id");
  const file = readArg("--file");
  const cookie = readArg("--cookie");
  const revisionNote = readArg("--revision-note");

  if (!baseUrl) failWithUsage("Missing required --base-url argument.");
  if (!instrumentId) failWithUsage("Missing required --instrument-id argument.");
  if (!file) failWithUsage("Missing required --file argument.");

  return { baseUrl, instrumentId, file, cookie, revisionNote };
}

async function main() {
  const args = parseArgs();
  const filePath = resolve(args.file);

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

  const content = readFileSync(filePath, "utf-8");
  const endpoint = `${args.baseUrl.replace(/\/$/, "")}/api/instruments/${encodeURIComponent(
    args.instrumentId,
  )}/content`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (args.cookie) {
    headers.Cookie = args.cookie;
  }

  const body = {
    content,
    revisionNote: args.revisionNote ?? null,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Network error while calling ${endpoint}: ${message}`);
    process.exit(1);
  }

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`Submit failed (${response.status} ${response.statusText})`);
    if (responseText) {
      console.error(responseText);
    }
    process.exit(1);
  }

  console.log(`Submit succeeded (${response.status} ${response.statusText})`);
  if (responseText) {
    console.log(responseText);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
