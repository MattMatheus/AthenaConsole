import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOperationsSummary, fetchProviderCostSettings, fetchRecentEvents, updateProviderCostSettings } from "./api";

export function useOperationsSummaryQuery() {
  return useQuery({
    queryKey: ["operations", "summary"],
    queryFn: fetchOperationsSummary,
  });
}

export function useRecentEventsQuery() {
  return useQuery({
    queryKey: ["events", "recent"],
    queryFn: () => fetchRecentEvents(10),
  });
}

export function useProviderCostSettingsQuery() {
  return useQuery({
    queryKey: ["operations", "cost-settings"],
    queryFn: fetchProviderCostSettings,
  });
}

export function useUpdateProviderCostSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProviderCostSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["operations", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["operations", "cost-settings"] });
    },
  });
}
