import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createRunTemplate, fetchHarnessProfiles, fetchRunTemplates, runTemplate } from "./api";
import type { RunTemplateCreateRequest, TemplateRunRequest } from "./types";

export function useRunTemplatesQuery() {
  return useQuery({
    queryKey: ["run-templates"],
    queryFn: fetchRunTemplates,
    staleTime: 10_000,
  });
}

export function useHarnessProfilesQuery() {
  return useQuery({
    queryKey: ["harness-profiles"],
    queryFn: fetchHarnessProfiles,
    staleTime: 10_000,
  });
}

export function useCreateRunTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: RunTemplateCreateRequest) => createRunTemplate(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["run-templates"] });
    },
  });
}

export function useRunTemplateMutation() {
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: TemplateRunRequest }) => runTemplate(id, request),
  });
}
