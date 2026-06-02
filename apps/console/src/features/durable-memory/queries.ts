import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDurableMemoryProposal,
  fetchDurableMemoryInspector,
  reviewDurableMemoryProposal,
  writeDurableMemoryRecord,
  type DurableMemoryProposalCreateRequest,
  type DurableMemoryProposalReviewAction,
  type DurableMemoryProposalReviewRequest,
  type DurableMemoryWriteRequest,
} from "./api";
import type { DurableMemoryNamespaceRef } from "./types";

export function useDurableMemoryInspectorQuery(namespace: DurableMemoryNamespaceRef, query: string) {
  return useQuery({
    queryKey: ["durable-memory", "inspector", namespace, query],
    queryFn: () => fetchDurableMemoryInspector(namespace, query),
    staleTime: 10_000,
  });
}

export function useDurableMemoryProposalReviewMutation(namespace: DurableMemoryNamespaceRef, query: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { proposalId: string; action: DurableMemoryProposalReviewAction; request: DurableMemoryProposalReviewRequest }) =>
      reviewDurableMemoryProposal(input.proposalId, input.action, input.request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["durable-memory", "inspector", namespace, query] });
    },
  });
}

export function useDurableMemoryPromotionMutation(namespace: DurableMemoryNamespaceRef) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { mode: "record"; request: DurableMemoryWriteRequest } | { mode: "proposal"; request: DurableMemoryProposalCreateRequest },
    ): Promise<unknown> => (input.mode === "record" ? writeDurableMemoryRecord(input.request) : createDurableMemoryProposal(input.request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["durable-memory"] });
      await queryClient.invalidateQueries({ queryKey: ["durable-memory", "inspector", namespace] });
    },
  });
}
