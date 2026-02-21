import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { discardA2aDlqItem, fetchA2aDlqList, requeueA2aDlqItem } from "./api";
import type { A2aDlqDiscardRequest, A2aDlqListQuery } from "./types";

export function useA2aDlqListQuery(query: A2aDlqListQuery) {
  return useQuery({
    queryKey: ["a2a", "dlq", query],
    queryFn: () => fetchA2aDlqList(query),
  });
}

export function useRequeueA2aDlqItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requeueA2aDlqItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["a2a", "dlq"] });
    },
  });
}

export function useDiscardA2aDlqItemMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request?: A2aDlqDiscardRequest }) =>
      discardA2aDlqItem(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["a2a", "dlq"] });
    },
  });
}
