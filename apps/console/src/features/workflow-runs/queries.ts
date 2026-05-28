import { useQuery } from "@tanstack/react-query";
import { fetchWorkflowRunStatus } from "./api";
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
