import { useQuery } from "@tanstack/react-query";
import { fetchA2aObservability, fetchA2aStallAlertHistory } from "./api";
import type { A2aObservabilityQuery, A2aStallAlertHistoryQuery } from "./types";

export function useA2aObservabilityQuery(query: A2aObservabilityQuery) {
  return useQuery({
    queryKey: ["a2a", "observability", query],
    queryFn: () => fetchA2aObservability(query),
    refetchInterval: 10_000
  });
}

export function useA2aStallAlertHistoryQuery(query: A2aStallAlertHistoryQuery) {
  return useQuery({
    queryKey: ["a2a", "observability", "alerts", query],
    queryFn: () => fetchA2aStallAlertHistory(query),
    refetchInterval: 30_000
  });
}
