import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFleetSummary, fetchProviderCostSettings, fetchRecentEvents, updateProviderCostSettings } from "./api";

export function useFleetSummaryQuery() {
  return useQuery({
    queryKey: ["fleet", "summary"],
    queryFn: fetchFleetSummary,
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
    queryKey: ["fleet", "cost-settings"],
    queryFn: fetchProviderCostSettings,
  });
}

export function useUpdateProviderCostSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProviderCostSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["fleet", "summary"] });
      void queryClient.invalidateQueries({ queryKey: ["fleet", "cost-settings"] });
    },
  });
}
