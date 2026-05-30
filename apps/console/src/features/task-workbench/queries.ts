import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, fetchTaskRunArtifact, fetchTaskRunDetail, fetchTaskWorkbenchMetadata, fetchTasks, runTask } from "./api";
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

export function useTaskRunArtifactQuery(runId: string | undefined, artifactId: string | undefined) {
  return useQuery({
    queryKey: ["task-workbench", "task-run-artifact", runId, artifactId],
    queryFn: () => fetchTaskRunArtifact(runId ?? "", artifactId ?? ""),
    enabled: Boolean(runId && artifactId),
    staleTime: 30_000,
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

export function useRunTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => runTask(taskId),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "task-run", run.id] });
    },
  });
}
