import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createConnectedRepository, fetchConnectedRepositories, inspectConnectedRepository } from "./api";
import type { ConnectedRepositoryCreateRequest } from "./types";

export function useConnectedRepositoriesQuery() {
  return useQuery({
    queryKey: ["connected-repositories"],
    queryFn: fetchConnectedRepositories,
    staleTime: 10_000,
  });
}

export function useCreateConnectedRepositoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ConnectedRepositoryCreateRequest) => createConnectedRepository(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connected-repositories"] });
    },
  });
}

export function useInspectConnectedRepositoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inspectConnectedRepository(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connected-repositories"] });
    },
  });
}
