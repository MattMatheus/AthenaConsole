export interface WorkflowTemplateCatalogPluginRef {
  id: string;
  version: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  status: string;
}

export interface WorkflowTemplateCatalogValidationIssue {
  file?: string;
  path: string;
  message: string;
  keyword?: string;
  resourceType: "workflow-template" | "plugin" | "unknown";
}

export interface WorkflowTemplateCatalogTemplateSummary {
  id: string;
  version: string;
  name: string;
  description: string;
  plugin: WorkflowTemplateCatalogPluginRef;
  status: string;
  available: boolean;
  taskCount: number;
  metadata: {
    goal?: string;
    context?: unknown;
    tasks?: unknown[];
    ui?: Record<string, unknown>;
  };
  validationErrors: WorkflowTemplateCatalogValidationIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplateCatalogListQuery {
  pluginId?: string;
  includeUnavailable?: boolean;
}

export interface WorkflowTemplateCatalogListResult {
  templates: WorkflowTemplateCatalogTemplateSummary[];
  total: number;
  filters: WorkflowTemplateCatalogListQuery;
}
