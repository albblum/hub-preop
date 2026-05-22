import type { HubRole } from "@prisma/client";
import { sessionRoleLabels } from "@/lib/session-role-labels";
import type { CommitteeMembershipClaim } from "@/lib/rbac";

export type RecognitionRoleBadgeStyle = {
  backgroundColor: string;
  color: string;
  label: string;
  initials: string;
};

function roleInitials(roles: readonly string[]): string {
  if (roles.includes("secretary_general") || roles.includes("registrar")) return "SG";
  if (roles.includes("admin")) return "AD";
  if (roles.includes("provisional_member")) return "PM";
  return "MB";
}

/**
 * Primary role badge for recognition modal and Hub header (v0 visual rules).
 */
export function recognitionRoleBadgeStyle(
  roles: readonly HubRole[] | readonly string[],
  committees: CommitteeMembershipClaim[] = [],
): RecognitionRoleBadgeStyle {
  const labels = sessionRoleLabels(roles, committees);
  const label = labels.join(" · ");

  if (roles.includes("secretary_general") || roles.includes("registrar")) {
    return {
      backgroundColor: "var(--color-burgundy-100)",
      color: "var(--color-burgundy-900)",
      label,
      initials: roleInitials(roles),
    };
  }

  if (roles.includes("provisional_member")) {
    return {
      backgroundColor: "var(--color-green-100)",
      color: "var(--color-green-900)",
      label,
      initials: roleInitials(roles),
    };
  }

  if (roles.includes("admin")) {
    return {
      backgroundColor: "var(--color-surface-secondary)",
      color: "var(--color-text-secondary)",
      label,
      initials: roleInitials(roles),
    };
  }

  return {
    backgroundColor: "var(--color-surface-secondary)",
    color: "var(--color-text-primary)",
    label,
    initials: roleInitials(roles),
  };
}
