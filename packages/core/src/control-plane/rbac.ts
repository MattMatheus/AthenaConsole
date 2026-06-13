import type { AthenaRbacRole, RbacRoleDefinition, RbacRoleSimulationResult } from "../shared/contracts.js";

const VIEWER_PERMISSIONS = [
  "capabilities.get",
  "durableMemory.get",
  "durableMemory.health",
  "durableMemory.list",
  "durableMemory.proposal.list",
  "durableMemory.search",
  "durableMemory.snapshot.list",
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
  "sessions.transcript.read",
  "taskWorkbench.get",
  "taskWorkbench.list",
  "taskWorkbench.metadata",
  "taskWorkbench.runArtifact.read",
  "taskWorkbench.runReadiness",
  "taskWorkbench.run.read"
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
  "durableMemory.archive",
  "durableMemory.delete",
  "durableMemory.proposal.approve",
  "durableMemory.proposal.archive",
  "durableMemory.proposal.create",
  "durableMemory.proposal.reject",
  "durableMemory.snapshot.create",
  "durableMemory.snapshot.restore",
  "durableMemory.write",
  "operations.cost.settings.write",
  "runs.cancel",
  "runs.cancelByRunId",
  "runs.create",
  "schedules.remove",
  "schedules.upsert",
  "taskWorkbench.cancelRun",
  "taskWorkbench.create",
  "taskWorkbench.runTask",
  "taskWorkbench.update",
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
  "modelProviders.create",
  "modelProviders.delete",
  "modelProviders.get",
  "modelProviders.list",
  "modelProviders.test",
  "modelProviders.update",
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

const SIMULATED_OPERATIONS = [
  {
    id: "provider-config",
    label: "Provider configuration",
    requiredPermission: "modelProviders.update"
  },
  {
    id: "task-execution",
    label: "Task execution",
    requiredPermission: "taskWorkbench.runTask"
  },
  {
    id: "memory-approval",
    label: "Memory proposal approval",
    requiredPermission: "durableMemory.proposal.approve"
  },
  {
    id: "policy-change",
    label: "Policy changes",
    requiredPermission: "policy.put"
  },
  {
    id: "audit-export",
    label: "Audit export/search",
    requiredPermission: "governance.audit.list"
  }
] as const;

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

export function simulateRbacRole(role: AthenaRbacRole): RbacRoleSimulationResult {
  const permissions = new Set(getPermissionsForRole(role));
  return {
    role,
    operations: SIMULATED_OPERATIONS.map((operation) => ({
      ...operation,
      allowed: permissions.has(operation.requiredPermission)
    }))
  };
}
