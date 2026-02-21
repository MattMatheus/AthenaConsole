import { AthenaError } from "../../runtime/errors.js";
import type {
  Directive,
  HarnessProfile,
  HarnessVerificationPolicy,
  RunTemplate,
  Workflow,
  WorkflowRun,
  WorkflowStepArtifact,
  WorkflowRunStepState
} from "../../shared/contracts.js";
import type { RunEvidenceRecord, RunEvidenceType } from "./types.js";

export function normalizeDirective(value: unknown, path: string): Directive {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Directive file is not a JSON object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const input = typeof row.input === "string" && row.input.length > 0 ? row.input : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  if (!id || !input || !createdAt) {
    throw new AthenaError("SESSION_IO_ERROR", `Directive file is missing required fields: ${path}`);
  }

  const contextRefs = normalizeContextRefs(row.contextRefs, path);
  const metadata = normalizeMetadata(row.metadata, path);
  return {
    id,
    input,
    ...(contextRefs ? { contextRefs } : {}),
    ...(metadata ? { metadata } : {}),
    createdAt
  };
}

function normalizeContextRefs(value: unknown, path: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Directive contextRefs must be an array: ${path}`);
  }
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeMetadata(value: unknown, path: string): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Directive metadata must be an object: ${path}`);
  }
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      const trimmedValue = entry.trim();
      if (trimmedValue.length > 0) {
        metadata[key] = trimmedValue;
      }
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function normalizeHarnessProfile(value: unknown, path: string): HarnessProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile file is not a JSON object: ${path}`);
  }

  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const displayName = typeof row.displayName === "string" && row.displayName.length > 0 ? row.displayName : undefined;
  const version = row.version === "v1" || row.version === "v2" ? row.version : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  if (!id || !displayName || !version || !createdAt) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile file is missing required fields: ${path}`);
  }

  const config = normalizeHarnessProfileConfig(row.config, path);
  const policies = normalizeHarnessProfilePolicies(row.policies, path);
  const allowedEgress = row.allowedEgress !== undefined ? normalizeHarnessAllowedEgress(row.allowedEgress, path) : undefined;
  return {
    id,
    displayName,
    version,
    config,
    policies,
    ...(allowedEgress && allowedEgress.length > 0 ? { allowedEgress } : {}),
    ...(row.verificationPolicies !== undefined
      ? { verificationPolicies: normalizeHarnessVerificationPolicies(row.verificationPolicies, path) }
      : {}),
    createdAt
  };
}

function normalizeHarnessProfileConfig(value: unknown, path: string): HarnessProfile["config"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile config must be an object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const provider = typeof row.provider === "string" && row.provider.length > 0 ? row.provider : undefined;
  const model = typeof row.model === "string" && row.model.length > 0 ? row.model : undefined;
  if (!provider || !model) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile config is missing provider/model: ${path}`);
  }
  if (!Array.isArray(row.tools)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile config tools must be an array: ${path}`);
  }
  const tools = row.tools
    .filter((tool): tool is string => typeof tool === "string")
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);
  if (tools.length === 0) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile config tools must contain at least one tool: ${path}`);
  }
  return {
    provider,
    model,
    tools: [...new Set(tools)]
  };
}

function normalizeHarnessProfilePolicies(value: unknown, path: string): HarnessProfile["policies"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile policies must be an object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const timeoutMs = typeof row.timeoutMs === "number" && Number.isFinite(row.timeoutMs) ? Math.floor(row.timeoutMs) : undefined;
  const retryLimit =
    typeof row.retryLimit === "number" && Number.isFinite(row.retryLimit) ? Math.floor(row.retryLimit) : undefined;
  const budgetUsd = typeof row.budgetUsd === "number" && Number.isFinite(row.budgetUsd) ? row.budgetUsd : undefined;
  if (timeoutMs === undefined || retryLimit === undefined || budgetUsd === undefined) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile policies are missing required limits: ${path}`);
  }
  return {
    timeoutMs,
    retryLimit,
    budgetUsd
  };
}

function normalizeHarnessVerificationPolicies(value: unknown, path: string): HarnessVerificationPolicy[] {
  if (!Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile verificationPolicies must be an array: ${path}`);
  }
  const policies: HarnessVerificationPolicy[] = [];
  const seenIds = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policy[${index}] must be an object: ${path}`
      );
    }
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : undefined;
    if (!id) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policy[${index}] is missing id: ${path}`
      );
    }
    if (seenIds.has(id)) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policies must not contain duplicate ids '${id}': ${path}`
      );
    }
    seenIds.add(id);
    const kind = typeof row.kind === "string" ? row.kind : undefined;
    if (kind !== "require-evidence") {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policy[${index}] has unsupported kind '${String(row.kind)}': ${path}`
      );
    }
    const label = typeof row.label === "string" && row.label.trim().length > 0 ? row.label.trim() : undefined;
    if (!label) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policy[${index}] is missing label: ${path}`
      );
    }
    const evidenceType = typeof row.evidenceType === "string" ? row.evidenceType : undefined;
    if (evidenceType !== undefined && evidenceType !== "text" && evidenceType !== "json" && evidenceType !== "binary") {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile verification policy[${index}] has invalid evidenceType '${evidenceType}': ${path}`
      );
    }
    policies.push({
      id,
      kind: "require-evidence",
      label,
      ...(evidenceType ? { evidenceType } : {})
    });
  }
  return policies;
}

function normalizeHarnessAllowedEgress(value: unknown, path: string): NonNullable<HarnessProfile["allowedEgress"]> {
  if (!Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Harness profile allowedEgress must be an array: ${path}`);
  }
  const rules: NonNullable<HarnessProfile["allowedEgress"]> = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AthenaError("SESSION_IO_ERROR", `Harness profile allowedEgress[${index}] must be an object: ${path}`);
    }
    const row = item as Record<string, unknown>;
    const host = typeof row.host === "string" ? row.host.trim().toLowerCase() : "";
    if (!host || !isValidEgressHost(host)) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile allowedEgress[${index}].host must be a valid domain, wildcard domain, or IPv4 address: ${path}`
      );
    }
    const port =
      typeof row.port === "number" && Number.isInteger(row.port) && row.port >= 1 && row.port <= 65535
        ? row.port
        : undefined;
    if (row.port !== undefined && port === undefined) {
      throw new AthenaError(
        "SESSION_IO_ERROR",
        `Harness profile allowedEgress[${index}].port must be an integer between 1 and 65535: ${path}`
      );
    }
    const dedupe = `${host}:${port ?? "*"}`;
    if (seen.has(dedupe)) {
      throw new AthenaError("SESSION_IO_ERROR", `Harness profile allowedEgress duplicate '${dedupe}': ${path}`);
    }
    seen.add(dedupe);
    rules.push({
      host,
      ...(port !== undefined ? { port } : {})
    });
  }
  return rules;
}

function isValidEgressHost(value: string): boolean {
  if (isIpv4Host(value)) {
    return true;
  }
  if (isHostname(value)) {
    return true;
  }
  if (value.startsWith("*.")) {
    return isHostname(value.slice(2));
  }
  return false;
}

function isIpv4Host(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const parsed = Number.parseInt(part, 10);
    return parsed >= 0 && parsed <= 255;
  });
}

function isHostname(value: string): boolean {
  if (value.length === 0 || value.length > 253) {
    return false;
  }
  if (!/^[a-z0-9.-]+$/.test(value)) {
    return false;
  }
  const labels = value.split(".");
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return false;
  }
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

export function normalizeRunEvidenceRecord(value: unknown, path: string): RunEvidenceRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Run evidence file is not a JSON object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const schemaVersion = typeof row.schemaVersion === "number" ? Math.floor(row.schemaVersion) : undefined;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const sessionId = typeof row.sessionId === "string" && row.sessionId.length > 0 ? row.sessionId : undefined;
  const runId = typeof row.runId === "string" && row.runId.length > 0 ? row.runId : undefined;
  const traceId = typeof row.traceId === "string" && row.traceId.length > 0 ? row.traceId : undefined;
  const label = typeof row.label === "string" && row.label.length > 0 ? row.label : undefined;
  const type = row.type === "text" || row.type === "json" || row.type === "binary" ? row.type : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  const artifactRef = typeof row.artifactRef === "string" && row.artifactRef.length > 0 ? row.artifactRef : undefined;
  const sizeBytes = typeof row.sizeBytes === "number" && Number.isFinite(row.sizeBytes) ? row.sizeBytes : undefined;
  if (
    schemaVersion === undefined ||
    !id ||
    !sessionId ||
    !runId ||
    !traceId ||
    !label ||
    !type ||
    !createdAt ||
    !artifactRef ||
    sizeBytes === undefined
  ) {
    throw new AthenaError("SESSION_IO_ERROR", `Run evidence file is missing required fields: ${path}`);
  }
  return {
    schemaVersion,
    id,
    sessionId,
    runId,
    traceId,
    label,
    type,
    content: normalizePersistedRunEvidenceContent(type, row.content, path),
    createdAt,
    artifactRef,
    sizeBytes
  };
}

export function normalizeRunTemplate(value: unknown, path: string): RunTemplate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Run template file is not a JSON object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const harnessProfileId =
    typeof row.harnessProfileId === "string" && row.harnessProfileId.length > 0 ? row.harnessProfileId : undefined;
  const directiveTemplate =
    typeof row.directiveTemplate === "string" && row.directiveTemplate.length > 0 ? row.directiveTemplate : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  if (!id || !harnessProfileId || !directiveTemplate || !createdAt) {
    throw new AthenaError("SESSION_IO_ERROR", `Run template file is missing required fields: ${path}`);
  }
  return {
    id,
    harnessProfileId,
    directiveTemplate,
    defaultParams: normalizeRunTemplateDefaultParams(row.defaultParams, path),
    createdAt
  };
}

function normalizeRunTemplateDefaultParams(value: unknown, path: string): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Run template defaultParams must be an object: ${path}`);
  }
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new AthenaError("SESSION_IO_ERROR", `Run template defaultParams values must be strings: ${path}`);
    }
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new AthenaError("SESSION_IO_ERROR", `Run template defaultParams keys must be non-empty: ${path}`);
    }
    params[normalizedKey] = entry.trim();
  }
  return params;
}

export function normalizeWorkflow(value: unknown, path: string): Workflow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow file is not a JSON object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  const definition = normalizeWorkflowDefinition(row.definition, path);
  if (!id || !createdAt) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow file is missing required fields: ${path}`);
  }
  return {
    id,
    definition,
    createdAt
  };
}

function normalizeWorkflowDefinition(value: unknown, path: string): Workflow["definition"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow definition must be an object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.steps) || !Array.isArray(row.dependencies)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow definition must include steps and dependencies arrays: ${path}`);
  }
  return {
    steps: row.steps as Workflow["definition"]["steps"],
    dependencies: row.dependencies as Workflow["definition"]["dependencies"]
  };
}

export function normalizeWorkflowRun(value: unknown, path: string, workflowId: string): WorkflowRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run file is not a JSON object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const schemaVersion = typeof row.schemaVersion === "number" ? Math.floor(row.schemaVersion) : 1;
  const id = typeof row.id === "string" && row.id.length > 0 ? row.id : undefined;
  const persistedWorkflowId =
    typeof row.workflowId === "string" && row.workflowId.length > 0 ? row.workflowId : undefined;
  const status =
    row.status === "pending" || row.status === "running" || row.status === "ok" || row.status === "failed"
      ? row.status
      : undefined;
  const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
  const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : undefined;
  if (!id || !persistedWorkflowId || !status || !createdAt || !updatedAt) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run file is missing required fields: ${path}`);
  }
  if (persistedWorkflowId !== workflowId) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run file has mismatched workflowId: ${path}`);
  }
  if (!Array.isArray(row.stepOrder)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run stepOrder must be an array: ${path}`);
  }
  const stepOrder = row.stepOrder
    .filter((stepId): stepId is string => typeof stepId === "string")
    .map((stepId) => stepId.trim())
    .filter((stepId) => stepId.length > 0);
  const stepStates = normalizeWorkflowRunStepStates(row.stepStates, path);
  const executionLog = normalizeWorkflowExecutionLog(row.executionLog, path);
  return {
    schemaVersion,
    id,
    workflowId: persistedWorkflowId,
    status,
    stepOrder,
    stepStates,
    executionLog,
    ...(typeof row.resumedFromRunId === "string" ? { resumedFromRunId: row.resumedFromRunId } : {}),
    createdAt,
    updatedAt,
    ...(typeof row.startedAt === "string" ? { startedAt: row.startedAt } : {}),
    ...(typeof row.finishedAt === "string" ? { finishedAt: row.finishedAt } : {})
  };
}

function normalizeWorkflowRunStepStates(value: unknown, path: string): Record<string, WorkflowRunStepState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run stepStates must be an object: ${path}`);
  }
  const states: Record<string, WorkflowRunStepState> = {};
  for (const [stepId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AthenaError("SESSION_IO_ERROR", `Workflow run step state must be an object: ${path}`);
    }
    const row = entry as Record<string, unknown>;
    const status =
      row.status === "pending" || row.status === "running" || row.status === "ok" || row.status === "failed"
        ? row.status
        : undefined;
    const attempt = typeof row.attempt === "number" && Number.isFinite(row.attempt) ? Math.floor(row.attempt) : undefined;
    const ready = typeof row.ready === "boolean" ? row.ready : undefined;
    const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : undefined;
    const dependencyReadiness = row.dependencyReadiness as WorkflowRunStepState["dependencyReadiness"] | undefined;
    if (
      !status ||
      attempt === undefined ||
      ready === undefined ||
      !updatedAt ||
      !dependencyReadiness ||
      typeof dependencyReadiness.totalDependencies !== "number" ||
      typeof dependencyReadiness.readyDependencies !== "number" ||
      !Array.isArray(dependencyReadiness.blockingStepIds)
    ) {
      throw new AthenaError("SESSION_IO_ERROR", `Workflow run step state missing required fields: ${path}`);
    }
    const checkpoint = normalizeWorkflowStepCheckpoint(row.checkpoint, path);
    states[stepId] = {
      stepId: typeof row.stepId === "string" && row.stepId.length > 0 ? row.stepId : stepId,
      status,
      attempt,
      ready,
      dependencyReadiness: {
        totalDependencies: Math.max(0, Math.floor(dependencyReadiness.totalDependencies)),
        readyDependencies: Math.max(0, Math.floor(dependencyReadiness.readyDependencies)),
        blockingStepIds: dependencyReadiness.blockingStepIds.filter(
          (item): item is string => typeof item === "string" && item.length > 0
        )
      },
      ...(checkpoint ? { checkpoint } : {}),
      updatedAt
    };
  }
  return states;
}

function normalizeWorkflowStepCheckpoint(value: unknown, path: string): WorkflowRunStepState["checkpoint"] {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run checkpoint must be an object: ${path}`);
  }
  const row = value as Record<string, unknown>;
  const attempt = typeof row.attempt === "number" && Number.isFinite(row.attempt) ? Math.floor(row.attempt) : undefined;
  if (attempt === undefined) {
    throw new AthenaError("SESSION_IO_ERROR", `Workflow run checkpoint requires numeric attempt: ${path}`);
  }
  let artifact: WorkflowStepArtifact | undefined;
  if (isWorkflowStepArtifact(row.artifact)) {
    const parsedArtifact = row.artifact as WorkflowStepArtifact;
    artifact = {
      kind: parsedArtifact.kind,
      output: parsedArtifact.output,
      provider: parsedArtifact.provider,
      model: parsedArtifact.model,
      createdAt: parsedArtifact.createdAt
    };
  }
  return {
    attempt,
    ...(typeof row.startedAt === "string" ? { startedAt: row.startedAt } : {}),
    ...(typeof row.finishedAt === "string" ? { finishedAt: row.finishedAt } : {}),
    ...(typeof row.error === "string" ? { error: row.error } : {}),
    ...(artifact ? { artifact } : {})
  };
}

function normalizeWorkflowExecutionLog(value: unknown, path: string): WorkflowRun["executionLog"] {
  if (!Array.isArray(value)) {
    return [];
  }
  const log: WorkflowRun["executionLog"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AthenaError("SESSION_IO_ERROR", `Workflow run log entry must be an object: ${path}`);
    }
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : undefined;
    const level = row.level === "info" || row.level === "error" ? row.level : undefined;
    const message = typeof row.message === "string" ? row.message : undefined;
    const createdAt = typeof row.createdAt === "string" ? row.createdAt : undefined;
    if (!id || !level || !message || !createdAt) {
      throw new AthenaError("SESSION_IO_ERROR", `Workflow run log entry missing required fields: ${path}`);
    }
    log.push({
      id,
      level,
      message,
      createdAt,
      ...(typeof row.stepId === "string" ? { stepId: row.stepId } : {})
    });
  }
  return log;
}

export function cloneWorkflowStepStates(states: Record<string, WorkflowRunStepState>): Record<string, WorkflowRunStepState> {
  const cloned: Record<string, WorkflowRunStepState> = {};
  for (const [stepId, state] of Object.entries(states)) {
    cloned[stepId] = {
      ...state,
      dependencyReadiness: {
        ...state.dependencyReadiness,
        blockingStepIds: [...state.dependencyReadiness.blockingStepIds]
      },
      ...(state.checkpoint
        ? {
            checkpoint: {
              ...state.checkpoint,
              ...(state.checkpoint.artifact
                ? {
                    artifact: {
                      ...state.checkpoint.artifact
                    }
                  }
                : {})
            }
          }
        : {})
    };
  }
  return cloned;
}

export function normalizeRunEvidenceContent(
  type: RunEvidenceType,
  content: string | unknown
): RunEvidenceRecord["content"] {
  if (type === "text") {
    if (typeof content !== "string") {
      throw new AthenaError("CONFIG_ERROR", "runEvidence.create.content must be a string when type='text'.");
    }
    return {
      kind: "text",
      text: content
    };
  }
  if (type === "json") {
    try {
      JSON.stringify(content);
    } catch {
      throw new AthenaError("CONFIG_ERROR", "runEvidence.create.content must be JSON-serializable when type='json'.");
    }
    return {
      kind: "json",
      value: content
    };
  }
  if (typeof content !== "string") {
    throw new AthenaError("CONFIG_ERROR", "runEvidence.create.content must be base64 when type='binary'.");
  }
  return {
    kind: "binary",
    base64: content
  };
}

function normalizePersistedRunEvidenceContent(
  type: RunEvidenceType,
  content: unknown,
  path: string
): RunEvidenceRecord["content"] {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new AthenaError("SESSION_IO_ERROR", `Run evidence content must be an object: ${path}`);
  }
  const row = content as Record<string, unknown>;
  if (type === "text") {
    if (row.kind !== "text" || typeof row.text !== "string") {
      throw new AthenaError("SESSION_IO_ERROR", `Run evidence text content shape is invalid: ${path}`);
    }
    return {
      kind: "text",
      text: row.text
    };
  }
  if (type === "json") {
    if (row.kind !== "json") {
      throw new AthenaError("SESSION_IO_ERROR", `Run evidence json content shape is invalid: ${path}`);
    }
    return {
      kind: "json",
      value: row.value
    };
  }
  if (row.kind !== "binary" || typeof row.base64 !== "string") {
    throw new AthenaError("SESSION_IO_ERROR", `Run evidence binary content shape is invalid: ${path}`);
  }
  return {
    kind: "binary",
    base64: row.base64
  };
}

function isWorkflowStepArtifact(value: unknown): value is NonNullable<WorkflowRunStepState["checkpoint"]>["artifact"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    row.kind === "run-result" &&
    typeof row.output === "string" &&
    typeof row.provider === "string" &&
    typeof row.model === "string" &&
    typeof row.createdAt === "string"
  );
}
