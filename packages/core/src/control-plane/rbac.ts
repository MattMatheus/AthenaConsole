import type { AthenaRbacRole, RbacRoleDefinition } from "../shared/contracts.js";

const VIEWER_PERMISSIONS = [
  "capabilities.get",
  "events.list",
  "operations.cost.export",
  "operations.cost.settings.read",
  "operations.summary.read",
  "lsp.definition",
  "lsp.hover",
  "lsp.references",
  "lsp.symbols",
  "memory.get",
  "memory.search",
  "sessions.artifacts.read",
  "sessions.get",
  "sessions.list",
  "sessions.search",
  "sessions.transcript.read"
] as const;

const OPERATOR_ADDITIONAL_PERMISSIONS = [
  "a2a.observability.get",
  "a2a.observability.alertHistory.list",
  "a2a.observability.alertHistory.export",
  "a2a.flow.get",
  "failed-work.discard",
  "failed-work.list",
  "failed-work.retry",
  "directives.create",
  "directives.list",
  "operations.cost.settings.write",
  "runs.cancel",
  "runs.cancelByRunId",
  "runs.create",
  "schedules.remove",
  "schedules.upsert",
  "work.drain",
  "work.enqueue",
  "work.status",
  "workflow.create",
  "workflow.list",
  "workflow.resume",
  "workflow.status"
] as const;

const ADMIN_ADDITIONAL_PERMISSIONS = [
  "policy.put",
  "governance.audit.list",
  "rbac.assignments.delete",
  "rbac.assignments.list",
  "rbac.assignments.upsert",
  "rbac.audit.read",
  "rbac.roles.list"
] as const;

const ROLE_PERMISSIONS: Record<AthenaRbacRole, string[]> = {
  Viewer: [...VIEWER_PERMISSIONS],
  Operator: [...VIEWER_PERMISSIONS, ...OPERATOR_ADDITIONAL_PERMISSIONS],
  Admin: [...VIEWER_PERMISSIONS, ...OPERATOR_ADDITIONAL_PERMISSIONS, ...ADMIN_ADDITIONAL_PERMISSIONS]
};

export function getPermissionsForRole(role: AthenaRbacRole): string[] {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return [...permissions];
}

export function listRbacRoles(): RbacRoleDefinition[] {
  return (["Viewer", "Operator", "Admin"] as const).map((name) => ({
    name,
    permissions: getPermissionsForRole(name)
  }));
}
