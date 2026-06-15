import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWorkspace, deleteWorkspace, fetchWorkspaces, updateWorkspace } from "./api";
import type { WorkspaceCreateRequest, WorkspaceUpdateRequest } from "./types";

const WORKSPACES_QUERY_KEY = ["workspaces"];

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: fetchWorkspaces,
    staleTime: 10_000,
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: WorkspaceCreateRequest) => createWorkspace(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

export function useUpdateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: WorkspaceUpdateRequest }) => updateWorkspace(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
    },
  });
}
