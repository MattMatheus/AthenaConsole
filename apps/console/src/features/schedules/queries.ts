import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSchedule,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  fetchScheduleLogs,
  fetchSchedules,
  runSchedule,
  tickSchedules,
} from "./api";
import type { CreateScheduleRequest } from "./types";

const SCHEDULES_QUERY_KEY = ["schedules"] as const;

export function useSchedulesQuery() {
  return useQuery({
    queryKey: SCHEDULES_QUERY_KEY,
    queryFn: fetchSchedules,
    staleTime: 5_000,
  });
}

export function useScheduleLogsQuery(id: string | undefined) {
  return useQuery({
    queryKey: [...SCHEDULES_QUERY_KEY, "logs", id],
    queryFn: () => fetchScheduleLogs(id ?? ""),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useCreateScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateScheduleRequest) => createSchedule(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useEnableScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enableSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useDisableScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disableSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useDeleteScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useRunScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => runSchedule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}

export function useTickSchedulesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tickSchedules(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SCHEDULES_QUERY_KEY });
    },
  });
}
