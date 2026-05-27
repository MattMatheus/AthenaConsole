import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkflowTemplates, instantiateWorkflowTemplate } from "./api";
import type { WorkflowTemplateInstantiateRequest, WorkflowTemplateListQuery } from "./types";

export function useWorkflowTemplatesQuery(query: WorkflowTemplateListQuery = {}) {
  return useQuery({
    queryKey: ["workflow-templates", query],
    queryFn: () => fetchWorkflowTemplates(query),
    staleTime: 10_000,
  });
}

export function useInstantiateWorkflowTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, request }: { templateId: string; request: WorkflowTemplateInstantiateRequest }) =>
      instantiateWorkflowTemplate(templateId, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["task-workbench", "tasks"] });
    },
  });
}
