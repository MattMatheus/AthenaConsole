import type { TaskWorkbenchTask, TaskWorkbenchTaskStatus } from "../task-workbench";
import type { ModelProviderRequirement, ProviderReadiness } from "../agent-catalog";

export type WorkflowTemplateValidationIssue = {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
  resourceType: "workflow-template" | "plugin" | "unknown";
};

export type WorkflowTemplatePluginRef = {
  id: string;
  version: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  status: string;
};

export type WorkflowTemplateInputType =
  | "string"
  | "markdown"
  | "integer"
  | "number"
  | "boolean"
  | "file"
  | "json"
  | "object"
  | "array";

export type WorkflowTemplateInputDefinition = {
  type?: WorkflowTemplateInputType;
  label?: string;
  required?: boolean;
  default?: unknown;
};

export type WorkflowTemplateSummary = {
  id: string;
  version: string;
  name: string;
  description: string;
  plugin: WorkflowTemplatePluginRef;
  status: string;
  available: boolean;
  providerReadiness: ProviderReadiness;
  taskCount: number;
  metadata: {
    goal?: string;
    context?: unknown;
    inputs?: Record<string, WorkflowTemplateInputDefinition>;
    providerRequirements?: ModelProviderRequirement[];
    tasks?: unknown[];
    ui?: Record<string, unknown>;
  };
  validationErrors: WorkflowTemplateValidationIssue[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowTemplateListQuery = {
  pluginId?: string;
  includeUnavailable?: boolean;
};

export type WorkflowTemplateListResult = {
  templates: WorkflowTemplateSummary[];
  total: number;
  filters: WorkflowTemplateListQuery;
};

export type WorkflowTemplateInstantiateRequest = {
  version?: string;
  pluginId?: string;
  pluginVersion?: string;
  missionId?: string;
  taskIdPrefix?: string;
  inputs?: Record<string, unknown>;
  createdBy?: string;
};

export type WorkflowTemplateMission = {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: "draft" | "ready" | "running" | "blocked" | "completed" | "failed" | "cancelled" | "archived";
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type WorkflowTemplateInstantiationResult = {
  template: {
    id: string;
    version: string;
    pluginId: string;
    pluginVersion: string;
    name: string;
  };
  workflowDagRun?: {
    id: string;
  };
  mission: WorkflowTemplateMission;
  tasks: Array<TaskWorkbenchTask & { status: TaskWorkbenchTaskStatus }>;
  inputValues: Record<string, unknown>;
};
