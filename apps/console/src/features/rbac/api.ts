import { apiClient } from "../../services";
import type {
  IdentityRoleAssignment,
  IdentityRoleAuditResult,
  RoleDefinition,
  UpsertIdentityRoleAssignmentRequest
} from "./types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function parseRole(value: unknown): "Viewer" | "Operator" | "Admin" | undefined {
  if (value === "Viewer" || value === "Operator" || value === "Admin") {
    return value;
  }
  return undefined;
}

function parseSubjectType(value: unknown): "identity" | "service-token" {
  return value === "service-token" ? "service-token" : "identity";
}

function parseAssignment(value: unknown): IdentityRoleAssignment | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const role = parseRole(value.role);
  if (!role || typeof value.subject !== "string" || value.subject.trim().length === 0) {
    return undefined;
  }
  return {
    subject: value.subject.trim(),
    role,
    subjectType: parseSubjectType(value.subjectType),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.updatedBy === "string" && value.updatedBy.trim().length > 0 ? { updatedBy: value.updatedBy.trim() } : {})
  };
}

export async function fetchRbacRoles(): Promise<RoleDefinition[]> {
  const payload = await apiClient.get<unknown>("/rbac/roles");
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  return items
    .filter(isRecord)
    .map((item) => {
      const role = parseRole(item.name);
      if (!role) {
        return undefined;
      }
      return {
        name: role,
        permissions: Array.isArray(item.permissions)
          ? item.permissions.filter((value): value is string => typeof value === "string")
          : []
      };
    })
    .filter((item): item is RoleDefinition => item !== undefined);
}

export async function fetchIdentityRoleAssignments(): Promise<IdentityRoleAssignment[]> {
  const payload = await apiClient.get<unknown>("/rbac/assignments");
  const items = isRecord(payload) && Array.isArray(payload.items) ? payload.items : [];
  return items
    .map(parseAssignment)
    .filter((item): item is IdentityRoleAssignment => item !== undefined);
}

export async function upsertIdentityRoleAssignment(
  request: UpsertIdentityRoleAssignmentRequest
): Promise<IdentityRoleAssignment> {
  const payload = await apiClient.put<unknown>(`/rbac/assignments/${encodeURIComponent(request.subject)}`, {
    role: request.role,
    subjectType: request.subjectType
  });
  const parsed = parseAssignment(payload);
  if (!parsed) {
    throw new Error("RBAC assignment response payload is invalid.");
  }
  return parsed;
}

export async function removeIdentityRoleAssignment(subject: string): Promise<{ subject: string; removed: boolean }> {
  return apiClient.delete<{ subject: string; removed: boolean }>(`/rbac/assignments/${encodeURIComponent(subject)}`);
}

export async function fetchIdentityPermissionAudit(subject: string): Promise<IdentityRoleAuditResult> {
  const payload = await apiClient.get<unknown>(`/rbac/audit/${encodeURIComponent(subject)}`);
  if (!isRecord(payload)) {
    throw new Error("RBAC audit payload is invalid.");
  }
  const role = parseRole(payload.role);
  if (!role || typeof payload.subject !== "string" || typeof payload.source !== "string") {
    throw new Error("RBAC audit payload is invalid.");
  }
  const scopeRecord = isRecord(payload.scope) ? payload.scope : {};
  return {
    subject: payload.subject,
    role,
    source: payload.source === "persisted" || payload.source === "configured" ? payload.source : "default",
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.filter((value): value is string => typeof value === "string")
      : [],
    scope: {
      global: scopeRecord.global === true,
      agents: Array.isArray(scopeRecord.agents)
        ? scopeRecord.agents.filter((value): value is string => typeof value === "string")
        : [],
      sessionIds: Array.isArray(scopeRecord.sessionIds)
        ? scopeRecord.sessionIds.filter((value): value is string => typeof value === "string")
        : [],
      runIds: Array.isArray(scopeRecord.runIds)
        ? scopeRecord.runIds.filter((value): value is string => typeof value === "string")
        : []
    },
    ...(parseAssignment(payload.assignment) ? { assignment: parseAssignment(payload.assignment)! } : {})
  };
}
