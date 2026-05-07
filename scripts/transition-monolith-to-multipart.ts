/**
 * ADR 0009 — CLI for monolith → multi-part transition (same domain logic as HTTP).
 * Usage: TRANSITION_MONOLITH_TO_MULTIPART_ENABLED=1 npx tsx scripts/transition-monolith-to-multipart.ts --instrument-id <cuid> [--dry-run]
 */
import {
  isMonolithToMultipartTransitionEnabled,
  transitionMonolithToMultipartProfile,
} from "@/lib/instrument-service";

function parseArgs(argv: string[]): { instrumentId?: string; dryRun: boolean } {
  let instrumentId: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--instrument-id" && argv[i + 1]) {
      instrumentId = argv[++i];
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }
  return { instrumentId, dryRun };
}

async function main(): Promise<void> {
  const { instrumentId, dryRun } = parseArgs(process.argv.slice(2));
  if (!instrumentId) {
    console.error(
      "Usage: tsx scripts/transition-monolith-to-multipart.ts --instrument-id <id> [--dry-run]",
    );
    process.exit(1);
  }
  if (!isMonolithToMultipartTransitionEnabled()) {
    console.error(
      "TRANSITION_MONOLITH_TO_MULTIPART_ENABLED must be 1 or true to run this script.",
    );
    process.exit(1);
  }
  const result = await transitionMonolithToMultipartProfile({ instrumentId, dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
