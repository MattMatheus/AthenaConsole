import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createModelProvider,
  deleteModelProvider,
  fetchModelProviders,
  testModelProvider,
  updateModelProvider,
} from "./api";
import type { ModelProviderConfigCreateRequest, ModelProviderConfigUpdateRequest } from "./types";

const MODEL_PROVIDERS_QUERY_KEY = ["model-providers"];

export function useModelProvidersQuery() {
  return useQuery({
    queryKey: MODEL_PROVIDERS_QUERY_KEY,
    queryFn: fetchModelProviders,
    staleTime: 10_000,
  });
}

export function useCreateModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ModelProviderConfigCreateRequest) => createModelProvider(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MODEL_PROVIDERS_QUERY_KEY });
    },
  });
}

export function useUpdateModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ModelProviderConfigUpdateRequest }) =>
      updateModelProvider(id, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MODEL_PROVIDERS_QUERY_KEY });
    },
  });
}

export function useDeleteModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModelProvider(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MODEL_PROVIDERS_QUERY_KEY });
    },
  });
}

export function useTestModelProviderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testModelProvider(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MODEL_PROVIDERS_QUERY_KEY });
    },
  });
}
