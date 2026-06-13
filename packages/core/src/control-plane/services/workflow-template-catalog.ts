import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  MissionWorkbenchMission,
  ProviderReadiness,
  TaskWorkbenchTask,
  WorkflowTemplateCatalogListQuery,
  WorkflowTemplateCatalogListResult,
  WorkflowTemplateCatalogTemplateSummary,
  WorkflowTemplateCatalogValidationIssue,
  WorkflowTemplateInstantiateRequest,
  WorkflowTemplateInstantiationResult
} from "../../shared/contracts.js";
import type { TaskWorkbenchRunMode } from "../../shared/contracts.js";
import { DEFAULT_TASK_WORKBENCH_RUN_MODE, TASK_WORKBENCH_RUN_MODES } from "../../shared/contracts.js";
import type { AppStateDatabase, PluginIndexRecord, WorkflowTemplateIndexRecord } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import { evaluateConnectorReadiness, type ConnectorMetadata, type ConnectorReadinessReport } from "../connectors.js";
import type { WorkflowTemplateCatalogService } from "../interfaces.js";
import { parseWorkflowTemplateDag } from "../workflow-template-dag.js";
import { LocalTaskWorkbenchService } from "./task-workbench.js";
import { LocalWorkflowStateService } from "./workflow-state.js";
import {
  combineProviderReadiness,
  evaluateProviderReadiness,
  normalizeModelProviderRequirement,
  normalizeModelProviderRequirements
} from "./provider-readiness.js";

interface PluginManifestDocument {
  plugin?: {
    name?: string;
    pack?: import("../../shared/contracts.js").CapabilityPackMetadata;
    connector?: ConnectorMetadata;
  };
}

interface WorkflowTemplateManifestDocument {
  workflow?: {
    id?: string;
    name?: string;
    version?: string;
    description?: string;
    goal?: string;
    context?: unknown;
    inputs?: Record<string, WorkflowInputDefinition>;
    providerRequirements?: unknown;
    tasks?: WorkflowTaskTemplate[];
    ui?: Record<string, unknown>;
  };
}

interface WorkflowInputDefinition {
  required?: boolean;
  default?: unknown;
}

interface WorkflowTaskTemplate {
  id?: string;
  title?: string;
  description?: string;
  capabilityRequirements?: unknown;
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: unknown;
  retryPolicy?: unknown;
}

interface RetryPolicy {
  maxAttempts: number;
  backoff: "none" | "fixed" | "linear" | "exponential";
  retryableFailurePhases: Array<"runtime-start" | "execution" | "provider" | "verification" | "artifact-export" | "connector-rate-limit">;
  idempotency: "read-only" | "idempotent" | "non-idempotent";
  externalWriteRetry: "forbid" | "require-approval" | "allow";
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
        .map((template) => mapTemplateSummary(template, pluginsByKey.get(pluginKey(template.pluginId, template.pluginVersion)), appState))
        .filter((template): template is WorkflowTemplateCatalogTemplateSummary => Boolean(template))
        .filter((template) => (query.includeUnavailable ? true : template.available));

      return {
        templates,
        total: templates.length,
        filters: query
      };
    });
  }

  async instantiate(
    id: string,
    request: WorkflowTemplateInstantiateRequest = {}
  ): Promise<WorkflowTemplateInstantiationResult> {
    return this.withAppStateAsync(async (appState) => {
      const template = resolveTemplate(appState, id, request);
      const plugin = appState.plugins.get(template.pluginId, template.pluginVersion);
      if (!plugin || !plugin.enabled || plugin.status !== "loaded" || template.status !== "loaded") {
        throw new AthenaError("CONFIG_ERROR", `Workflow template is not available: ${id}`);
      }
      const manifest = normalizeWorkflowManifest(template.manifest);
      const workflow = manifest.workflow;
      if (!workflow) {
        throw new AthenaError("CONFIG_ERROR", `Workflow template manifest is missing workflow: ${id}`);
      }
      const inputValues = resolveWorkflowInputs(workflow.inputs ?? {}, request.inputs ?? {});
      assertWorkflowPreflightReady(plugin, workflow, appState, inputValues);
      const missionId = request.missionId ?? `mission-${randomUUID()}`;
      const taskIdPrefix = request.taskIdPrefix ?? missionId;
      const taskTemplates = normalizeTaskTemplates(workflow.tasks);
      const dag = parseWorkflowTemplateDag(taskTemplates, { path: "workflow.tasks" });
      const taskTemplateById = new Map(taskTemplates.map((task) => [task.id, task]));
      const orderedTaskTemplates = dag.taskOrder.map((taskId) => requireTaskTemplate(taskTemplateById, taskId));
      const taskIdByTemplateId = new Map(taskTemplates.map((task) => [task.id, `${taskIdPrefix}-${task.id}`]));
      const taskOrder = dag.taskOrder.map((taskId) => requireMappedTaskId(taskIdByTemplateId, taskId));
      const allTasksReady = taskTemplates.every((task) => Boolean(task.assignedAgentId));
      const workflowDagRun = new LocalWorkflowStateService(appState).createRun({
        runId: `workflow-run-${missionId}`,
        workflowTemplateId: template.id,
        workflowTemplateVersion: template.version,
        pluginId: template.pluginId,
        pluginVersion: template.pluginVersion,
        tasks: taskTemplates
      });

      const mission = appState.missions.create({
        id: missionId,
        title: workflow.name ?? template.name,
        goal: renderTemplateText(workflow.goal ?? "", inputValues, "workflow.goal"),
        context: {
          template: {
            id: template.id,
            version: template.version,
            pluginId: template.pluginId,
            pluginVersion: template.pluginVersion,
            workflowDagRunId: workflowDagRun.run.id
          },
          workflowDagRunId: workflowDagRun.run.id,
          inputs: inputValues,
          value: renderTemplateValue(workflow.context ?? {}, inputValues, "workflow.context")
        },
        status: allTasksReady ? "ready" : "draft",
        taskOrder
      });

      const taskWorkbench = new LocalTaskWorkbenchService(this.config, { appState });
      const tasks: TaskWorkbenchTask[] = [];
      for (const taskTemplate of orderedTaskTemplates) {
        const task = await taskWorkbench.create({
          id: requireMappedTaskId(taskIdByTemplateId, taskTemplate.id),
          title: renderTemplateText(taskTemplate.title, inputValues, `workflow.tasks.${taskTemplate.id}.title`),
          ...(taskTemplate.description !== undefined
            ? {
                description: renderTemplateText(
                  taskTemplate.description,
                  inputValues,
                  `workflow.tasks.${taskTemplate.id}.description`
                )
              }
            : {}),
          status: taskTemplate.assignedAgentId ? "ready" : "draft",
          capabilityRequirements: normalizeStringArray(
            taskTemplate.capabilityRequirements,
            `workflow.tasks.${taskTemplate.id}.capabilityRequirements`
          ),
          ...(taskTemplate.assignedAgentId ? { assignedAgentId: taskTemplate.assignedAgentId } : {}),
          ...(taskTemplate.assignedAgentVersion ? { assignedAgentVersion: taskTemplate.assignedAgentVersion } : {}),
          inputs: applyWorkflowRunModeToTaskInputs(
            renderTemplateValue(taskTemplate.inputs ?? {}, inputValues, `workflow.tasks.${taskTemplate.id}.inputs`),
            inputValues
          ),
          dependsOn: (dag.dependenciesByTaskId[taskTemplate.id] ?? []).map((dependencyId) =>
            requireMappedTaskId(taskIdByTemplateId, dependencyId)
          ),
          missionId: mission.id,
          provenance: {
            source: "workflow-template",
            workflowTemplateId: template.id,
            workflowTemplateVersion: template.version,
            pluginId: template.pluginId,
            pluginVersion: template.pluginVersion,
            templateTaskId: taskTemplate.id,
            workflowDagRunId: workflowDagRun.run.id,
            workflowDagStepId: taskTemplate.id,
            ...(taskTemplate.retryPolicy ? { retryPolicy: taskTemplate.retryPolicy } : {})
          },
          ...(request.createdBy ? { createdBy: request.createdBy } : {})
        });
        tasks.push(task);
      }

      return {
        template: {
          id: template.id,
          version: template.version,
          pluginId: template.pluginId,
          pluginVersion: template.pluginVersion,
          name: template.name
        },
        workflowDagRun: {
          id: workflowDagRun.run.id
        },
        mission: mapMissionRecord(mission),
        tasks,
        inputValues
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

  private async withAppStateAsync<T>(read: (appState: AppStateDatabase) => Promise<T>): Promise<T> {
    if (this.options.appState) {
      return read(this.options.appState);
    }
    const appState = openAppStateDatabase(this.config);
    try {
      return await read(appState);
    } finally {
      appState.close();
    }
  }
}

interface NormalizedTaskTemplate {
  id: string;
  title: string;
  description?: string;
  capabilityRequirements?: unknown;
  assignedAgentId?: string;
  assignedAgentVersion?: string;
  inputs?: unknown;
  dependsOn?: unknown;
  retryPolicy?: RetryPolicy;
}

function resolveTemplate(
  appState: AppStateDatabase,
  id: string,
  request: WorkflowTemplateInstantiateRequest
): WorkflowTemplateIndexRecord {
  const matches = appState.workflowTemplates.list().filter((template) => {
    return (
      template.id === id &&
      (!request.version || template.version === request.version) &&
      (!request.pluginId || template.pluginId === request.pluginId) &&
      (!request.pluginVersion || template.pluginVersion === request.pluginVersion)
    );
  });
  if (matches.length === 0) {
    throw new AthenaError("PROVIDER_NOT_FOUND", `Workflow template not found: ${id}`);
  }
  if (matches.length > 1) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `Workflow template '${id}' is ambiguous; provide version, pluginId, or pluginVersion.`
    );
  }
  return matches[0]!;
}

function normalizeTaskTemplates(tasks: WorkflowTaskTemplate[] | undefined): NormalizedTaskTemplate[] {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new AthenaError("CONFIG_ERROR", "Workflow template must include at least one task.");
  }
  const normalized = tasks.map((task, index) => {
    if (!isRecord(task) || typeof task.id !== "string" || typeof task.title !== "string") {
      throw new AthenaError("CONFIG_ERROR", `Workflow task template at index ${index} is invalid.`);
    }
    return {
      id: task.id,
      title: task.title,
      ...(typeof task.description === "string" ? { description: task.description } : {}),
      ...(task.capabilityRequirements !== undefined ? { capabilityRequirements: task.capabilityRequirements } : {}),
      ...(typeof task.assignedAgentId === "string" ? { assignedAgentId: task.assignedAgentId } : {}),
      ...(typeof task.assignedAgentVersion === "string" ? { assignedAgentVersion: task.assignedAgentVersion } : {}),
      ...(task.inputs !== undefined ? { inputs: task.inputs } : {}),
      ...(task.dependsOn !== undefined ? { dependsOn: task.dependsOn } : {}),
      ...(task.retryPolicy !== undefined ? { retryPolicy: normalizeRetryPolicy(task.retryPolicy, `workflow.tasks.${index}.retryPolicy`) } : {})
    };
  });
  return normalized;
}

function normalizeRetryPolicy(value: unknown, path: string): RetryPolicy {
  if (!isRecord(value)) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be an object.`);
  }
  return {
    maxAttempts: normalizeIntegerInRange(value.maxAttempts, `${path}.maxAttempts`, 1, 10),
    backoff: normalizeEnum(value.backoff, `${path}.backoff`, ["none", "fixed", "linear", "exponential"]),
    retryableFailurePhases: normalizeRetryableFailurePhases(value.retryableFailurePhases, `${path}.retryableFailurePhases`),
    idempotency: normalizeEnum(value.idempotency, `${path}.idempotency`, ["read-only", "idempotent", "non-idempotent"]),
    externalWriteRetry: normalizeEnum(value.externalWriteRetry, `${path}.externalWriteRetry`, [
      "forbid",
      "require-approval",
      "allow"
    ])
  };
}

function normalizeRetryableFailurePhases(value: unknown, path: string): RetryPolicy["retryableFailurePhases"] {
  const phases = normalizeStringArray(value, path);
  if (phases.length === 0) {
    throw new AthenaError("CONFIG_ERROR", `${path} must include at least one phase.`);
  }
  return phases.map((phase) =>
    normalizeEnum(phase, `${path}.${phase}`, [
      "runtime-start",
      "execution",
      "provider",
      "verification",
      "artifact-export",
      "connector-rate-limit"
    ])
  );
}

function normalizeIntegerInRange(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function normalizeEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

function applyWorkflowRunModeToTaskInputs(taskInputs: unknown, inputValues: Record<string, unknown>): unknown {
  if (!isRecord(taskInputs)) {
    return taskInputs;
  }
  if (taskInputs.runMode !== undefined) {
    return taskInputs;
  }
  const runMode = isTaskWorkbenchRunMode(inputValues.runMode) ? inputValues.runMode : DEFAULT_TASK_WORKBENCH_RUN_MODE;
  return {
    ...taskInputs,
    runMode
  };
}

function assertWorkflowPreflightReady(
  plugin: PluginIndexRecord,
  workflow: WorkflowTemplateManifestDocument["workflow"],
  appState: AppStateDatabase,
  inputValues: Record<string, unknown>
): void {
  const checks: Array<{
    id: string;
    category: "provider" | "permissions" | "connector";
    status: "ok" | "blocked";
    label: string;
    message: string;
    nextStep: string;
  }> = [];
  const providerReadiness = evaluateWorkflowProviderReadiness(workflow, appState);
  const providerBlocked = isProviderReadinessBlocking(providerReadiness);
  checks.push({
    id: "model-provider",
    category: "provider",
    status: providerBlocked ? "blocked" : "ok",
    label: "Model Provider",
    message: providerReadiness.message,
    nextStep: providerBlocked ? "Configure a valid model provider before instantiating this workflow." : "No action needed."
  });

  const connectorCheck = evaluateWorkflowConnectorPreflight(plugin, workflow, appState);
  if (connectorCheck) {
    checks.push(connectorCheck);
  }

  const runMode = inputValues.runMode;
  if (runMode !== undefined && !isTaskWorkbenchRunMode(runMode)) {
    checks.push({
      id: "run-mode",
      category: "permissions",
      status: "blocked",
      label: "Run Mode",
      message: `Unsupported run mode: ${String(runMode)}.`,
      nextStep: `Use one of: ${TASK_WORKBENCH_RUN_MODES.join(", ")}.`
    });
  } else if (runMode === "approved-write") {
    checks.push({
      id: "run-mode",
      category: "permissions",
      status: "blocked",
      label: "Run Mode",
      message: "Approved write mode is not available until approval implementation exists.",
      nextStep: "Use read-only or propose-changes mode. Proposed changes must be returned as artifacts."
    });
  } else {
    checks.push({
      id: "run-mode",
      category: "permissions",
      status: "ok",
      label: "Run Mode",
      message: "Workflow run mode is supported.",
      nextStep: "No action needed."
    });
  }

  const blocked = checks.filter((check) => check.status === "blocked");
  if (blocked.length === 0) {
    return;
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    `Workflow preflight blocked: ${blocked.map((check) => check.message).join(" ")}`,
    false,
    undefined,
    {
      kind: "workflow-template-readiness",
      readiness: {
        status: "blocked",
        ready: false,
        summary: `Workflow preflight blocked: ${blocked.map((check) => check.message).join(" ")}`,
        checks
      }
    }
  );
}

function evaluateWorkflowConnectorPreflight(
  plugin: PluginIndexRecord,
  workflow: WorkflowTemplateManifestDocument["workflow"],
  appState: AppStateDatabase
):
  | {
      id: string;
      category: "connector";
      status: "ok" | "blocked";
      label: string;
      message: string;
      nextStep: string;
      details: {
        serviceId?: string;
        status: ConnectorReadinessReport["status"];
        credentialState: ConnectorReadinessReport["credentialState"];
        missingScopes: string[];
        rateLimitedOperations: string[];
        fixtureSafe: boolean;
      };
    }
  | undefined {
  const pluginManifest = normalizePluginManifest(plugin.manifest);
  const connector = pluginManifest.plugin?.connector;
  if (!connector || !workflowUsesConnector(workflow, appState)) {
    return undefined;
  }

  const fixtureSafe = isFixtureSafeConnectorWorkflow(workflow, appState);
  const binding = appState.connectorCredentialBindings.get(plugin.id, plugin.version, connector.service.id);
  const readiness = evaluateConnectorReadiness({
    pluginId: plugin.id,
    pluginVersion: plugin.version,
    connector,
    binding,
    grantedScopes: connector.readiness?.grantedScopes,
    rateLimitedOperationIds: connector.readiness?.rateLimitedOperationIds,
    degraded: connector.readiness?.degraded,
    blockedReasons: connector.readiness?.blockedReasons
  });
  const blocked = !fixtureSafe && readiness.status !== "configured";
  return {
    id: "connector-readiness",
    category: "connector",
    status: blocked ? "blocked" : "ok",
    label: "Connector Readiness",
    message: blocked
      ? `Connector ${readiness.serviceName ?? readiness.serviceId ?? connector.service.id} is not ready: ${readiness.status}.`
      : fixtureSafe
        ? "Connector workflow is fixture-safe and does not perform live service calls."
        : "Connector is ready for live workflow instantiation.",
    nextStep: blocked ? readiness.nextStep : "No action needed.",
    details: {
      serviceId: connector.service.id,
      status: readiness.status,
      credentialState: readiness.credentialState,
      missingScopes: readiness.missingScopes,
      rateLimitedOperations: readiness.rateLimitedOperations,
      fixtureSafe
    }
  };
}

function workflowUsesConnector(
  workflow: WorkflowTemplateManifestDocument["workflow"],
  appState: AppStateDatabase
): boolean {
  const agents = appState.agents.list();
  return (
    workflow?.tasks?.some((task) => {
      const agent = findAssignedAgent(agents, task);
      if (!agent) {
        return false;
      }
      const manifest = normalizeAgentManifest(agent.manifest);
      return normalizeOptionalStringArray(manifest.agent?.runtime?.connectorOperations).length > 0;
    }) ?? false
  );
}

function isFixtureSafeConnectorWorkflow(
  workflow: WorkflowTemplateManifestDocument["workflow"],
  appState: AppStateDatabase
): boolean {
  const agents = appState.agents.list();
  const connectorAgents =
    workflow?.tasks
      ?.map((task) => findAssignedAgent(agents, task))
      .filter((agent): agent is NonNullable<ReturnType<typeof findAssignedAgent>> => agent !== undefined)
      .filter((agent) => normalizeOptionalStringArray(normalizeAgentManifest(agent.manifest).agent?.runtime?.connectorOperations).length > 0) ??
    [];
  return connectorAgents.length > 0 && connectorAgents.every((agent) => normalizeAgentManifest(agent.manifest).agent?.permissions?.network === "deny");
}

function isProviderReadinessBlocking(readiness: ProviderReadiness): boolean {
  return readiness.required && (readiness.status === "missing" || readiness.status === "invalid");
}

function isTaskWorkbenchRunMode(value: unknown): value is TaskWorkbenchRunMode {
  return typeof value === "string" && TASK_WORKBENCH_RUN_MODES.includes(value as TaskWorkbenchRunMode);
}

function resolveWorkflowInputs(
  definitions: Record<string, WorkflowInputDefinition>,
  supplied: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(definitions)) {
    if (Object.prototype.hasOwnProperty.call(supplied, key)) {
      resolved[key] = supplied[key];
    } else if (Object.prototype.hasOwnProperty.call(definition, "default")) {
      resolved[key] = definition.default;
    } else if (definition.required) {
      throw new AthenaError("CONFIG_ERROR", `workflowTemplates.instantiate.inputs.${key} is required.`);
    }
  }
  for (const [key, value] of Object.entries(supplied)) {
    if (!Object.prototype.hasOwnProperty.call(resolved, key)) {
      resolved[key] = value;
    }
  }
  return resolved;
}

function renderTemplateValue<T>(value: T, inputs: Record<string, unknown>, path: string): T {
  if (typeof value === "string") {
    return renderTemplateString(value, inputs, path) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => renderTemplateValue(item, inputs, `${path}.${index}`)) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, renderTemplateValue(entry, inputs, `${path}.${key}`)])
    ) as T;
  }
  return value;
}

function renderTemplateText(value: string, inputs: Record<string, unknown>, path: string): string {
  return String(renderTemplateString(value, inputs, path));
}

function renderTemplateString(value: string, inputs: Record<string, unknown>, path: string): unknown {
  const exact = /^\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}$/.exec(value);
  if (exact) {
    return resolveInputValue(inputs, exact[1]!, path);
  }
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => String(resolveInputValue(inputs, key, path)));
}

function resolveInputValue(inputs: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(inputs, key)) {
    throw new AthenaError("CONFIG_ERROR", `${path} references missing workflow input '${key}'.`);
  }
  return inputs[key];
}

function normalizeStringArray(value: unknown, path: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new AthenaError("CONFIG_ERROR", `${path} must be an array of strings.`);
  }
  return Array.from(new Set(value));
}

function requireMappedTaskId(taskIdByTemplateId: Map<string, string>, templateTaskId: string): string {
  const taskId = taskIdByTemplateId.get(templateTaskId);
  if (!taskId) {
    throw new AthenaError("CONFIG_ERROR", `Workflow task dependency not found: ${templateTaskId}`);
  }
  return taskId;
}

function requireTaskTemplate(
  taskTemplateById: Map<string, NormalizedTaskTemplate>,
  templateTaskId: string
): NormalizedTaskTemplate {
  const taskTemplate = taskTemplateById.get(templateTaskId);
  if (!taskTemplate) {
    throw new AthenaError("CONFIG_ERROR", `Workflow task not found: ${templateTaskId}`);
  }
  return taskTemplate;
}

function mapMissionRecord(record: {
  id: string;
  title: string;
  goal: string;
  context: unknown;
  status: string;
  taskOrder: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}): MissionWorkbenchMission {
  return {
    id: record.id,
    title: record.title,
    goal: record.goal,
    context: record.context,
    status: record.status as MissionWorkbenchMission["status"],
    taskOrder: record.taskOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt ? { archivedAt: record.archivedAt } : {})
  };
}

function mapTemplateSummary(
  template: WorkflowTemplateIndexRecord,
  plugin: PluginIndexRecord | undefined,
  appState: AppStateDatabase
): WorkflowTemplateCatalogTemplateSummary | undefined {
  if (!plugin) {
    return undefined;
  }
  const pluginManifest = normalizePluginManifest(plugin.manifest);
  const workflowManifest = normalizeWorkflowManifest(template.manifest);
  const providerReadiness = evaluateWorkflowProviderReadiness(workflowManifest.workflow, appState);
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
      status: plugin.status,
      ...(pluginManifest.plugin?.pack ? { pack: pluginManifest.plugin.pack } : {})
    },
    status: template.status,
    available: plugin.enabled && plugin.status === "loaded" && template.status === "loaded",
    providerReadiness,
    taskCount: template.taskCount,
    metadata: {
      ...(workflowManifest.workflow?.goal ? { goal: workflowManifest.workflow.goal } : {}),
      ...(workflowManifest.workflow?.context !== undefined ? { context: workflowManifest.workflow.context } : {}),
      ...(workflowManifest.workflow?.inputs ? { inputs: workflowManifest.workflow.inputs } : {}),
      ...(workflowManifest.workflow?.providerRequirements !== undefined
        ? { providerRequirements: workflowManifest.workflow.providerRequirements }
        : {}),
      ...(workflowManifest.workflow?.tasks ? { tasks: workflowManifest.workflow.tasks } : {}),
      ...(workflowManifest.workflow?.ui ? { ui: workflowManifest.workflow.ui } : {})
    },
    validationErrors: normalizeValidationIssues(template.validationErrors),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  };
}

function evaluateWorkflowProviderReadiness(
  workflow: WorkflowTemplateManifestDocument["workflow"] | undefined,
  appState: AppStateDatabase
) {
  const providers = appState.modelProviderConfigs.list();
  const explicit = normalizeModelProviderRequirements(workflow?.providerRequirements);
  if (explicit.length > 0) {
    return evaluateProviderReadiness(explicit, providers);
  }

  const agents = appState.agents.list();
  const agentChecks =
    workflow?.tasks
      ?.map((task) => findAssignedAgent(agents, task))
      .filter((agent): agent is NonNullable<ReturnType<typeof findAssignedAgent>> => agent !== undefined)
      .map((agent) => {
        const agentManifest = normalizeAgentManifest(agent.manifest);
        const requirement = normalizeModelProviderRequirement(agentManifest.agent?.runtime?.modelProvider);
        return evaluateProviderReadiness(requirement ? [requirement] : [], providers);
      }) ?? [];

  return combineProviderReadiness(agentChecks);
}

function findAssignedAgent(
  agents: ReturnType<AppStateDatabase["agents"]["list"]>,
  task: WorkflowTaskTemplate
) {
  if (!task.assignedAgentId) {
    return undefined;
  }
  return agents.find(
    (agent) => agent.id === task.assignedAgentId && (!task.assignedAgentVersion || agent.version === task.assignedAgentVersion)
  );
}

function normalizeAgentManifest(manifest: unknown): { agent?: { runtime?: Record<string, unknown>; permissions?: Record<string, unknown> } } {
  return isRecord(manifest) ? (manifest as { agent?: { runtime?: Record<string, unknown>; permissions?: Record<string, unknown> } }) : {};
}

function normalizeOptionalStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
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
