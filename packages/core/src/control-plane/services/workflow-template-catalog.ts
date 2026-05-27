import type { AthenaConfig } from "../../shared/config.js";
import type {
  WorkflowTemplateCatalogListQuery,
  WorkflowTemplateCatalogListResult,
  WorkflowTemplateCatalogTemplateSummary,
  WorkflowTemplateCatalogValidationIssue
} from "../../shared/contracts.js";
import type { AppStateDatabase, PluginIndexRecord, WorkflowTemplateIndexRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { WorkflowTemplateCatalogService } from "../interfaces.js";

interface PluginManifestDocument {
  plugin?: {
    name?: string;
  };
}

interface WorkflowTemplateManifestDocument {
  workflow?: {
    goal?: string;
    context?: unknown;
    tasks?: unknown[];
    ui?: Record<string, unknown>;
  };
}

export interface LocalWorkflowTemplateCatalogServiceOptions {
  appState?: AppStateDatabase;
}

export class LocalWorkflowTemplateCatalogService implements WorkflowTemplateCatalogService {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: LocalWorkflowTemplateCatalogServiceOptions = {}
  ) {}

  async list(query: WorkflowTemplateCatalogListQuery = {}): Promise<WorkflowTemplateCatalogListResult> {
    return this.withAppState((appState) => {
      const pluginsByKey = new Map(appState.plugins.list().map((plugin) => [pluginKey(plugin.id, plugin.version), plugin]));
      const templates = appState.workflowTemplates
        .list()
        .filter((template) => (query.pluginId ? template.pluginId === query.pluginId : true))
        .map((template) => mapTemplateSummary(template, pluginsByKey.get(pluginKey(template.pluginId, template.pluginVersion))))
        .filter((template): template is WorkflowTemplateCatalogTemplateSummary => Boolean(template))
        .filter((template) => (query.includeUnavailable ? true : template.available));

      return {
        templates,
        total: templates.length,
        filters: query
      };
    });
  }

  private withAppState<T>(read: (appState: AppStateDatabase) => T): T {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return read(appState);
    } finally {
      appState.close();
    }
  }
}

function mapTemplateSummary(
  template: WorkflowTemplateIndexRecord,
  plugin: PluginIndexRecord | undefined
): WorkflowTemplateCatalogTemplateSummary | undefined {
  if (!plugin) {
    return undefined;
  }
  const pluginManifest = normalizePluginManifest(plugin.manifest);
  const workflowManifest = normalizeWorkflowManifest(template.manifest);
  return {
    id: template.id,
    version: template.version,
    name: template.name,
    description: template.description,
    plugin: {
      id: plugin.id,
      version: plugin.version,
      name: pluginManifest.plugin?.name ?? plugin.id,
      sourceType: plugin.sourceType,
      enabled: plugin.enabled,
      status: plugin.status
    },
    status: template.status,
    available: plugin.enabled && plugin.status === "loaded" && template.status === "loaded",
    taskCount: template.taskCount,
    metadata: {
      ...(workflowManifest.workflow?.goal ? { goal: workflowManifest.workflow.goal } : {}),
      ...(workflowManifest.workflow?.context !== undefined ? { context: workflowManifest.workflow.context } : {}),
      ...(workflowManifest.workflow?.tasks ? { tasks: workflowManifest.workflow.tasks } : {}),
      ...(workflowManifest.workflow?.ui ? { ui: workflowManifest.workflow.ui } : {})
    },
    validationErrors: normalizeValidationIssues(template.validationErrors),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

function pluginKey(id: string, version: string): string {
  return `${id}@${version}`;
}

function normalizePluginManifest(manifest: unknown): PluginManifestDocument {
  return isRecord(manifest) ? (manifest as PluginManifestDocument) : {};
}

function normalizeWorkflowManifest(manifest: unknown): WorkflowTemplateManifestDocument {
  return isRecord(manifest) ? (manifest as WorkflowTemplateManifestDocument) : {};
}

function normalizeValidationIssues(issues: unknown[]): WorkflowTemplateCatalogValidationIssue[] {
  return issues.map((issue) => {
    const record = isRecord(issue) ? issue : {};
    const file = typeof record.file === "string" ? record.file : undefined;
    const path = typeof record.path === "string" ? record.path : "$";
    const message = typeof record.message === "string" ? record.message : "unknown validation error";
    const keyword = typeof record.keyword === "string" ? record.keyword : undefined;
    return {
      ...(file ? { file } : {}),
      path,
      message,
      ...(keyword ? { keyword } : {}),
      resourceType: inferIssueResourceType(file)
    };
  });
}

function inferIssueResourceType(file: string | undefined): WorkflowTemplateCatalogValidationIssue["resourceType"] {
  if (!file) {
    return "unknown";
  }
  if (file.endsWith(".workflow.yaml") || file.endsWith(".workflow.yml")) {
    return "workflow-template";
  }
  if (file.endsWith("plugin.yaml") || file.endsWith("plugin.yml")) {
    return "plugin";
  }
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
