import { apiClient } from "../../services";
import type {
  WorkflowTemplateInputDefinition,
  WorkflowTemplateInstantiateRequest,
  WorkflowTemplateInstantiationResult,
  WorkflowTemplateListQuery,
  WorkflowTemplateListResult,
  WorkflowTemplateMission,
  WorkflowTemplatePluginRef,
  WorkflowTemplateSummary,
  WorkflowTemplateValidationIssue,
} from "./types";
import type { ProviderReadiness } from "../agent-catalog";
import type { CapabilityPackMetadata } from "../agent-catalog";
import type { CapabilityPackOutcome } from "../agent-catalog";
import { parseRunReadiness } from "../task-workbench/api";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function parsePackMetadata(value: unknown): CapabilityPackMetadata | undefined {
  if (!isRecord(value) || typeof value.category !== "string" || typeof value.maturity !== "string" || !isRecord(value.safety)) {
    return undefined;
  }
  return {
    category: value.category,
    maturity: value.maturity,
    credentialRequirements: toStringArray(value.credentialRequirements),
    memoryRequirements: toStringArray(value.memoryRequirements),
    safety: {
      posture: typeof value.safety.posture === "string" ? value.safety.posture : "unspecified",
      externalWrites: Boolean(value.safety.externalWrites),
      ...(Array.isArray(value.safety.approvalRequiredFor)
        ? { approvalRequiredFor: toStringArray(value.safety.approvalRequiredFor) }
        : {}),
      ...(typeof value.safety.notes === "string" ? { notes: value.safety.notes } : {}),
    },
    ...(Array.isArray(value.exampleWorkflows)
      ? { exampleWorkflows: value.exampleWorkflows.filter(isRecord) as Array<Record<string, unknown>> }
      : {}),
    ...(Array.isArray(value.outcomes)
      ? { outcomes: value.outcomes.map(parsePackOutcome).filter((item): item is CapabilityPackOutcome => item !== undefined) }
      : {}),
  };
}

function parsePackOutcome(value: unknown): CapabilityPackOutcome | undefined {
  if (!isRecord(value) || !isRecord(value.target) || typeof value.id !== "string" || typeof value.title !== "string") {
    return undefined;
  }
  const kind =
    value.target.kind === "agent" || value.target.kind === "workflow" || value.target.kind === "link"
      ? value.target.kind
      : undefined;
  if (!kind || typeof value.target.id !== "string" || typeof value.description !== "string") {
    return undefined;
  }
  const ui = toRecord(value.ui);
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    target: {
      kind,
      id: value.target.id,
      ...(typeof value.target.version === "string" ? { version: value.target.version } : {}),
      ...(typeof value.target.href === "string" ? { href: value.target.href } : {}),
    },
    contextRequirements: toStringArray(value.contextRequirements),
    expectedArtifacts: Array.isArray(value.expectedArtifacts)
      ? value.expectedArtifacts.filter(isRecord).map((artifact) => ({
          label: typeof artifact.label === "string" ? artifact.label : "Artifact",
          format: typeof artifact.format === "string" ? artifact.format : "markdown",
        }))
      : [],
    executionMode: typeof value.executionMode === "string" ? value.executionMode : "deterministic",
    ...(ui
      ? {
          ui: {
            ...(typeof ui.icon === "string" ? { icon: ui.icon } : {}),
            ...(typeof ui.badge === "string" ? { badge: ui.badge } : {}),
            ...(typeof ui.order === "number" ? { order: ui.order } : {}),
          },
        }
      : {}),
  };
}

function parseProviderReadiness(value: unknown): ProviderReadiness {
  const record = isRecord(value) ? value : {};
  const requirements = Array.isArray(record.requirements)
    ? record.requirements.filter(isRecord).map((requirement) => ({
        required: requirement.required !== false,
        ...(requirement.providerKind === "openai-compatible" ? { providerKind: "openai-compatible" as const } : {}),
        ...(typeof requirement.providerId === "string" ? { providerId: requirement.providerId } : {}),
        ...(typeof requirement.model === "string" ? { model: requirement.model } : {}),
        ...(typeof requirement.label === "string" ? { label: requirement.label } : {}),
      }))
    : [];
  const status =
    record.status === "configured" || record.status === "missing" || record.status === "invalid" || record.status === "untested"
      ? record.status
      : "untested";
  return {
    status,
    required: Boolean(record.required),
    requirements,
    ...(typeof record.providerId === "string" ? { providerId: record.providerId } : {}),
    ...(typeof record.providerName === "string" ? { providerName: record.providerName } : {}),
    ...(record.providerKind === "openai-compatible" ? { providerKind: "openai-compatible" } : {}),
    ...(typeof record.model === "string" ? { model: record.model } : {}),
    message: typeof record.message === "string" ? record.message : "No model provider requirement declared.",
  };
}

function parseValidationIssue(value: unknown): WorkflowTemplateValidationIssue | undefined {
  if (!isRecord(value) || typeof value.path !== "string" || typeof value.message !== "string") {
    return undefined;
  }
  const resourceType =
    value.resourceType === "workflow-template" || value.resourceType === "plugin" || value.resourceType === "unknown"
      ? value.resourceType
      : "unknown";
  return {
    ...(typeof value.file === "string" ? { file: value.file } : {}),
    path: value.path,
    message: value.message,
    ...(typeof value.keyword === "string" ? { keyword: value.keyword } : {}),
    resourceType,
  };
}

function parsePlugin(value: unknown): WorkflowTemplatePluginRef {
  if (!isRecord(value)) {
    return {
      id: "",
      version: "",
      name: "Unknown plugin",
      sourceType: "local",
      enabled: false,
      status: "unknown",
    };
  }
  const pack = parsePackMetadata(value.pack);
  return {
    id: typeof value.id === "string" ? value.id : "",
    version: typeof value.version === "string" ? value.version : "",
    name: typeof value.name === "string" ? value.name : "Unknown plugin",
    sourceType: typeof value.sourceType === "string" ? value.sourceType : "local",
    enabled: Boolean(value.enabled),
    status: typeof value.status === "string" ? value.status : "unknown",
    ...(pack ? { pack } : {}),
  };
}

function parseInputDefinitions(value: unknown): Record<string, WorkflowTemplateInputDefinition> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, definition]) => [key, isRecord(definition) ? definition : {}]),
  ) as Record<string, WorkflowTemplateInputDefinition>;
}

function parseTemplate(value: unknown): WorkflowTemplateSummary | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.version !== "string") {
    return undefined;
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  const inputs = parseInputDefinitions(metadata.inputs);
  const context = metadata.context;
  const ui = toRecord(metadata.ui);
  const providerRequirements = Array.isArray(metadata.providerRequirements)
    ? metadata.providerRequirements.filter(isRecord).map((requirement) => ({
        required: requirement.required !== false,
        ...(requirement.providerKind === "openai-compatible" ? { providerKind: "openai-compatible" as const } : {}),
        ...(typeof requirement.providerId === "string" ? { providerId: requirement.providerId } : {}),
        ...(typeof requirement.model === "string" ? { model: requirement.model } : {}),
        ...(typeof requirement.label === "string" ? { label: requirement.label } : {}),
      }))
    : undefined;
  return {
    id: value.id,
    version: value.version,
    name: typeof value.name === "string" ? value.name : value.id,
    description: typeof value.description === "string" ? value.description : "",
    plugin: parsePlugin(value.plugin),
    status: typeof value.status === "string" ? value.status : "unknown",
    available: Boolean(value.available),
    providerReadiness: parseProviderReadiness(value.providerReadiness),
    taskCount: typeof value.taskCount === "number" ? value.taskCount : 0,
    metadata: {
      ...(typeof metadata.goal === "string" ? { goal: metadata.goal } : {}),
      ...(context !== undefined ? { context } : {}),
      ...(inputs ? { inputs } : {}),
      ...(providerRequirements ? { providerRequirements } : {}),
      ...(Array.isArray(metadata.tasks) ? { tasks: metadata.tasks } : {}),
      ...(ui ? { ui } : {}),
    },
    validationErrors: Array.isArray(value.validationErrors)
      ? value.validationErrors.map(parseValidationIssue).filter((issue): issue is WorkflowTemplateValidationIssue => issue !== undefined)
      : [],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  };
}

function parseMission(value: unknown): WorkflowTemplateMission {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("Workflow template mission payload is invalid.");
  }
  return {
    id: value.id,
    title: value.title,
    goal: typeof value.goal === "string" ? value.goal : "",
    context: value.context ?? {},
    status: typeof value.status === "string" ? (value.status as WorkflowTemplateMission["status"]) : "draft",
    taskOrder: toStringArray(value.taskOrder),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.archivedAt === "string" ? { archivedAt: value.archivedAt } : {}),
    ...(isRecord(value.runReadiness) ? { runReadiness: parseRunReadiness(value.runReadiness) } : {}),
  };
}

function parseTask(value: unknown): WorkflowTemplateInstantiationResult["tasks"][number] {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
    throw new Error("Workflow template task payload is invalid.");
  }
  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === "string" ? value.description : "",
    status: typeof value.status === "string" ? (value.status as WorkflowTemplateInstantiationResult["tasks"][number]["status"]) : "draft",
    capabilityRequirements: toStringArray(value.capabilityRequirements),
    ...(typeof value.assignedAgentId === "string" ? { assignedAgentId: value.assignedAgentId } : {}),
    ...(typeof value.assignedAgentVersion === "string" ? { assignedAgentVersion: value.assignedAgentVersion } : {}),
    inputs: value.inputs ?? {},
    dependsOn: toStringArray(value.dependsOn),
    ...(typeof value.missionId === "string" ? { missionId: value.missionId } : {}),
    ...(typeof value.sourceRunId === "string" ? { sourceRunId: value.sourceRunId } : {}),
    ...(value.provenance !== undefined ? { provenance: value.provenance } : {}),
    ...(typeof value.createdBy === "string" ? { createdBy: value.createdBy } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
    ...(typeof value.archivedAt === "string" ? { archivedAt: value.archivedAt } : {}),
  };
}

function toQueryString(query: WorkflowTemplateListQuery = {}): string {
  const params = new URLSearchParams();
  if (query.pluginId) {
    params.set("pluginId", query.pluginId);
  }
  if (query.includeUnavailable !== undefined) {
    params.set("includeUnavailable", String(query.includeUnavailable));
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export async function fetchWorkflowTemplates(query: WorkflowTemplateListQuery = {}): Promise<WorkflowTemplateListResult> {
  const payload = await apiClient.get<unknown>(`/v1/workflow-templates${toQueryString(query)}`);
  if (!isRecord(payload) || !Array.isArray(payload.templates)) {
    throw new Error("Workflow template catalog payload is invalid.");
  }
  const templates = payload.templates.map(parseTemplate).filter((template): template is WorkflowTemplateSummary => template !== undefined);
  return {
    templates,
    total: typeof payload.total === "number" ? payload.total : templates.length,
    filters: isRecord(payload.filters) ? (payload.filters as WorkflowTemplateListQuery) : {},
  };
}

export async function instantiateWorkflowTemplate(
  templateId: string,
  request: WorkflowTemplateInstantiateRequest,
): Promise<WorkflowTemplateInstantiationResult> {
  const payload = await apiClient.post<unknown>(`/v1/workflow-templates/${encodeURIComponent(templateId)}/instantiate`, request);
  if (!isRecord(payload) || !isRecord(payload.template) || !Array.isArray(payload.tasks)) {
    throw new Error("Workflow template instantiation payload is invalid.");
  }
  return {
    template: {
      id: typeof payload.template.id === "string" ? payload.template.id : templateId,
      version: typeof payload.template.version === "string" ? payload.template.version : request.version ?? "",
      pluginId: typeof payload.template.pluginId === "string" ? payload.template.pluginId : request.pluginId ?? "",
      pluginVersion: typeof payload.template.pluginVersion === "string" ? payload.template.pluginVersion : request.pluginVersion ?? "",
      name: typeof payload.template.name === "string" ? payload.template.name : templateId,
    },
    ...(isRecord(payload.workflowDagRun) && typeof payload.workflowDagRun.id === "string"
      ? { workflowDagRun: { id: payload.workflowDagRun.id } }
      : {}),
    mission: parseMission(payload.mission),
    tasks: payload.tasks.map(parseTask),
    inputValues: isRecord(payload.inputValues) ? payload.inputValues : {},
  };
}
