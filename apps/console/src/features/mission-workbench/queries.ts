import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMissions, fetchMissionTasks, runMission } from "./api";
import type { MissionWorkbenchMissionListQuery } from "./types";

export function useMissionsQuery(query: MissionWorkbenchMissionListQuery = {}) {
  return useQuery({
    queryKey: ["mission-workbench", "missions", query],
    queryFn: () => fetchMissions(query),
    staleTime: 10_000,
  });
}

export function useMissionTasksQuery(id: string | undefined) {
  return useQuery({
    queryKey: ["mission-workbench", "mission-tasks", id],
    queryFn: () => fetchMissionTasks(id ?? ""),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useRunMissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => runMission(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["mission-workbench", "missions"] });
      void queryClient.invalidateQueries({ queryKey: ["mission-workbench", "mission-tasks", id] });
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "tasks"] });
    },
  });
}
