import type { AdminRole } from "../types";

/**
 * Role-based permissions for the institute admin console.
 *
 *   dean            — everything, including managing admin accounts
 *   estate_officer  — full ticket handling, content, analytics, exports
 *   contractor      — only their own agency's NON-anonymous tickets; can mark
 *                     "In Progress" and add notes, cannot resolve, never sees
 *                     worker identity.
 */
export const PERMISSIONS = {
  "tickets.view": ["dean", "estate_officer", "contractor"],
  "tickets.update": ["dean", "estate_officer", "contractor"],
  "tickets.resolve": ["dean", "estate_officer"],
  "tickets.merge": ["dean", "estate_officer"],
  "tickets.viewIdentity": ["dean", "estate_officer"],
  "analytics.view": ["dean", "estate_officer"],
  "heatmap.view": ["dean", "estate_officer"],
  "content.manage": ["dean", "estate_officer"],
  "reports.export": ["dean", "estate_officer"],
  "users.manage": ["dean"],
  "workers.resetPin": ["dean", "estate_officer"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}

export function permissionsFor(role: AdminRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  dean: "Dean of Infrastructure",
  estate_officer: "Estate Officer",
  contractor: "Contractor",
};

/** Statuses a role may move a ticket into. */
export function allowedTargetStatuses(role: AdminRole): string[] {
  if (role === "contractor") return ["In Progress"];
  return ["New", "Under Review", "In Progress", "Resolved"];
}
