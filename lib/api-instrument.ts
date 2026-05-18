import { NextResponse } from "next/server";
import { IntegrityViolationError } from "@/lib/domain/integrity";
import { DomainError } from "@/lib/domain/transitions";

const DOMAIN_ERROR_STATUS_400 = new Set([
  "V2_WRITE_PATH_BLOCKED",
  "NOT_V2_INSTRUMENT",
  "INVALID_V2_IDR_REF",
  "CLAUSE_NOT_IN_INSTRUMENT",
]);

export function handleDomainError(e: unknown): NextResponse | null {
  if (e instanceof DomainError) {
    const status = DOMAIN_ERROR_STATUS_400.has(e.domainCode ?? "")
      ? 400
      : e.domainCode === "ALREADY_MULTIPART_PROFILE"
        ? 409
        : e.domainCode === "INSTRUMENT_NOT_FOUND" || e.domainCode === "CLAUSE_NOT_FOUND"
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
