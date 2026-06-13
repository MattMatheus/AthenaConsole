import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { executeWorkflowRun, fetchWorkflowQueueStatus, fetchWorkflowRunStatus } from "./api";
import { shouldPollWorkflowRun } from "./runGraphModel";

export function useWorkflowRunStatusQuery(runId: string | undefined) {
  return useQuery({
    queryKey: ["workflow-runs", "status", runId],
    queryFn: () => fetchWorkflowRunStatus(runId ?? ""),
    enabled: Boolean(runId),
    staleTime: 1_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !shouldPollWorkflowRun(data.run.status)) {
        return false;
      }
      return data.polling.recommendedIntervalMs;
    },
  });
}

export function useExecuteWorkflowRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => executeWorkflowRun(runId),
    onSuccess: (_result, runId) => {
      void queryClient.invalidateQueries({ queryKey: ["workflow-runs", "status", runId] });
      void queryClient.invalidateQueries({ queryKey: ["mission-workbench"] });
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "tasks"] });
    },
  });
}

export function useWorkflowQueueStatusQuery() {
  return useQuery({
    queryKey: ["workflow-queue", "status"],
    queryFn: fetchWorkflowQueueStatus,
    staleTime: 1_000,
    refetchInterval: 5_000,
  });
}
