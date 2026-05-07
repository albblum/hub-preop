import { NextResponse } from "next/server";
import { IntegrityViolationError } from "@/lib/domain/integrity";
import { DomainError } from "@/lib/domain/transitions";

export function handleDomainError(e: unknown): NextResponse | null {
  if (e instanceof DomainError) {
    const status =
      e.domainCode === "ALREADY_MULTIPART_PROFILE"
        ? 409
        : e.domainCode === "INSTRUMENT_NOT_FOUND"
          ? 404
          : 422;
    return NextResponse.json(
      { error: e.message, code: e.domainCode ?? e.code },
      { status },
    );
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
