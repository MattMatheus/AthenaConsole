import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, fetchTaskRunDetail, fetchTaskWorkbenchMetadata, fetchTasks } from "./api";
import type { TaskWorkbenchTaskCreateRequest, TaskWorkbenchTaskListQuery } from "./types";

export function useTaskWorkbenchMetadataQuery() {
  return useQuery({
    queryKey: ["task-workbench", "metadata"],
    queryFn: fetchTaskWorkbenchMetadata,
    staleTime: 30_000,
  });
}

export function useTaskRunDetailQuery(runId: string | undefined) {
  return useQuery({
    queryKey: ["task-workbench", "task-run", runId],
    queryFn: () => fetchTaskRunDetail(runId ?? ""),
    enabled: Boolean(runId),
    staleTime: 5_000,
  });
}

export function useTasksQuery(query: TaskWorkbenchTaskListQuery = {}) {
  return useQuery({
    queryKey: ["task-workbench", "tasks", query],
    queryFn: () => fetchTasks(query),
    staleTime: 10_000,
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TaskWorkbenchTaskCreateRequest) => createTask(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "tasks"] });
    },
  });
}
