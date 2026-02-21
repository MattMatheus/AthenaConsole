import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchIdentityPermissionAudit,
  fetchIdentityRoleAssignments,
  fetchRbacRoles,
  removeIdentityRoleAssignment,
  upsertIdentityRoleAssignment
} from "./api";
import type { UpsertIdentityRoleAssignmentRequest } from "./types";

export function useRbacRolesQuery() {
  return useQuery({
    queryKey: ["rbac", "roles"],
    queryFn: fetchRbacRoles
  });
}

export function useIdentityRoleAssignmentsQuery() {
  return useQuery({
    queryKey: ["rbac", "assignments"],
    queryFn: fetchIdentityRoleAssignments
  });
}

export function useUpsertIdentityRoleAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpsertIdentityRoleAssignmentRequest) => upsertIdentityRoleAssignment(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rbac", "assignments"] });
    }
  });
}

export function useRemoveIdentityRoleAssignmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subject: string) => removeIdentityRoleAssignment(subject),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rbac", "assignments"] });
    }
  });
}

export function useIdentityPermissionAuditMutation() {
  return useMutation({
    mutationFn: (subject: string) => fetchIdentityPermissionAudit(subject)
  });
}
