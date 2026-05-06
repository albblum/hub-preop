import type { HubRole } from "@prisma/client";
import type { ExportMode } from "@/lib/audit/export-redaction";

const EXPORT_RANK: Record<ExportMode, number> = {
  public: 0,
  registered: 1,
  restricted: 2,
};

/** Highest export tier implied by role set (union of roles). */
export function maxExportModeForRoles(roles: HubRole[]): ExportMode {
  if (roles.includes("admin") || roles.includes("registrar")) return "restricted";
  if (roles.includes("reviewer") || roles.includes("viewer_registered")) return "registered";
  return "public";
}

/**
 * Whether the caller may use the requested export redaction mode.
 * Unauthenticated callers may only use `public`.
 */
export function canUseExportMode(roles: HubRole[] | undefined, requested: ExportMode): boolean {
  const effectiveRoles = roles ?? [];
  const max = maxExportModeForRoles(effectiveRoles);
  return EXPORT_RANK[requested] <= EXPORT_RANK[max];
}

const CREATE_ROLES: HubRole[] = ["admin", "registrar"];
const TRANSITION_ROLES: HubRole[] = ["admin", "registrar", "reviewer"];
const CONTENT_ROLES: HubRole[] = ["admin", "registrar"];

export function canCreateInstrument(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => CREATE_ROLES.includes(r));
}

export function canTransition(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => TRANSITION_ROLES.includes(r));
}

export function canAppendContent(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => CONTENT_ROLES.includes(r));
}

/** Filtered lists / operational queues (e.g. normalization-pending). */
export function canViewOperationalQueues(roles: HubRole[] | undefined): boolean {
  return (roles ?? []).some((r) => TRANSITION_ROLES.includes(r));
}
