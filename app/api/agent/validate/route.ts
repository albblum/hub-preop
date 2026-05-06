import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAppendContent } from "@/lib/rbac";
import { jsonForbidden, jsonUnauthorized } from "@/lib/api-http";
import { agentValidateBodySchema } from "@/lib/validation/agent-validate";
import { runStubAgentValidate } from "@/lib/agent/stub-validate";

const DISCLAIMER =
  "Este relatório é apoio à conformidade operacional do rascunho; não constitui validação jurídica nem substitui revisão humana.";

/**
 * MVP G.3: deterministic stub only. No external LLM; no writes to ledger or official text.
 * `AGENT_ENABLED` is reserved for future policy; default/off still returns HTTP 200 + stub checklist (ADR 0007).
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return jsonUnauthorized();
  }
  if (!canAppendContent(session.user.roles)) {
    return jsonForbidden("Insufficient role to run agent validation");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = agentValidateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { content } = parsed.data;
  const { ok, summary, checks } = runStubAgentValidate(content);

  return NextResponse.json({
    ok,
    mode: "stub" as const,
    summary,
    checks,
    disclaimer: DISCLAIMER,
  });
}
