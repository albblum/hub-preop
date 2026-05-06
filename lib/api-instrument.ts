import { NextResponse } from "next/server";
import { IntegrityViolationError } from "@/lib/domain/integrity";
import { DomainError } from "@/lib/domain/transitions";

export function handleDomainError(e: unknown): NextResponse | null {
  if (e instanceof DomainError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
  }
  return null;
}

export function handleIntegrityError(e: unknown): NextResponse | null {
  if (e instanceof IntegrityViolationError) {
    return NextResponse.json(
      { error: e.message, code: "INTEGRITY_VIOLATION" },
      { status: 500 },
    );
  }
  return null;
}
