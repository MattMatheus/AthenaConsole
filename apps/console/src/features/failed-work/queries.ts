import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discardFailedWorkItem, fetchFailedWorkList, retryFailedWorkItem } from "./api";
import type { FailedWorkDiscardRequest, FailedWorkListQuery } from "./types";

const failedWorkQueryKey = ["failed-work"] as const;

export function useFailedWorkListQuery(query: FailedWorkListQuery) {
  return useQuery({
    queryKey: [...failedWorkQueryKey, query],
    queryFn: () => fetchFailedWorkList(query),
  });
}

export function useRetryFailedWorkItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryFailedWorkItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: failedWorkQueryKey });
    },
  });
}

export function useDiscardFailedWorkItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request?: FailedWorkDiscardRequest }) =>
      discardFailedWorkItem(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: failedWorkQueryKey });
    },
  });
}
