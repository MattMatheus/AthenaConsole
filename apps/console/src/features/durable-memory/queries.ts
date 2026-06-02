import { useQuery } from "@tanstack/react-query";
import { fetchDurableMemoryInspector } from "./api";
import type { DurableMemoryNamespaceRef } from "./types";

export function useDurableMemoryInspectorQuery(namespace: DurableMemoryNamespaceRef, query: string) {
  return useQuery({
    queryKey: ["durable-memory", "inspector", namespace, query],
    queryFn: () => fetchDurableMemoryInspector(namespace, query),
    staleTime: 10_000,
  });
}
