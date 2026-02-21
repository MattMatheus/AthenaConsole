import { AthenaError } from "../../runtime/errors.js";
import type { WorkflowDefinition } from "../../shared/contracts.js";
import type { StateStore } from "../state-store.js";

export async function assertWorkflowStepReferences(stateStore: StateStore, definition: WorkflowDefinition): Promise<void> {
  const [directives, harnessProfiles] = await Promise.all([stateStore.listDirectives(), stateStore.listHarnessProfiles()]);
  const directiveIds = new Set(directives.map((directive) => directive.id));
  const harnessProfileIds = new Set(harnessProfiles.map((profile) => profile.id));
  for (const step of definition.steps) {
    if (!directiveIds.has(step.directiveId)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.steps.${step.id}.directiveId must reference an existing directive. Received: ${step.directiveId}.`
      );
    }
    if (!harnessProfileIds.has(step.harnessProfileId)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.steps.${step.id}.harnessProfileId must reference an existing harness profile. Received: ${step.harnessProfileId}.`
      );
    }
  }
}

export function validateAndNormalizeWorkflowDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition must be an object.");
  }
  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition.steps must be a non-empty array.");
  }
  if (!Array.isArray(definition.dependencies)) {
    throw new AthenaError("CONFIG_ERROR", "workflows.create.definition.dependencies must be an array.");
  }

  const steps = definition.steps.map((step, index) => normalizeWorkflowStep(step, index));
  const stepIds = new Set<string>();
  for (const step of steps) {
    if (stepIds.has(step.id)) {
      throw new AthenaError("CONFIG_ERROR", `workflows.create.definition.steps contains duplicate id: ${step.id}.`);
    }
    stepIds.add(step.id);
  }

  const dependencies = definition.dependencies.map((dependency, index) => normalizeWorkflowDependency(dependency, index));
  const edgeSet = new Set<string>();
  for (const dependency of dependencies) {
    if (!stepIds.has(dependency.from)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.dependencies references unknown from step: ${dependency.from}.`
      );
    }
    if (!stepIds.has(dependency.to)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.dependencies references unknown to step: ${dependency.to}.`
      );
    }
    if (dependency.from === dependency.to) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.dependencies contains self-edge for step: ${dependency.from}.`
      );
    }
    const edgeKey = `${dependency.from}->${dependency.to}`;
    if (edgeSet.has(edgeKey)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.dependencies contains duplicate edge: ${dependency.from} -> ${dependency.to}.`
      );
    }
    edgeSet.add(edgeKey);
  }

  assertWorkflowDagAcyclic(
    steps.map((step) => step.id),
    dependencies
  );

  return {
    steps,
    dependencies
  };
}

function normalizeWorkflowStep(step: WorkflowDefinition["steps"][number], index: number): WorkflowDefinition["steps"][number] {
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    throw new AthenaError("CONFIG_ERROR", `workflows.create.definition.steps[${index}] must be an object.`);
  }
  const stepId = normalizeNonEmptyString(step.id, `workflows.create.definition.steps[${index}].id`);
  const directiveId = normalizeNonEmptyString(
    step.directiveId,
    `workflows.create.definition.steps[${index}].directiveId`
  );
  const harnessProfileId = normalizeNonEmptyString(
    step.harnessProfileId,
    `workflows.create.definition.steps[${index}].harnessProfileId`
  );
  const outputs = normalizeWorkflowOutputs(step.outputs, index);
  const execution = normalizeWorkflowExecutionMetadata(step.execution, index);
  return {
    id: stepId,
    directiveId,
    harnessProfileId,
    ...(outputs ? { outputs } : {}),
    ...(execution ? { execution } : {})
  };
}

function normalizeWorkflowDependency(
  dependency: WorkflowDefinition["dependencies"][number],
  index: number
): WorkflowDefinition["dependencies"][number] {
  if (!dependency || typeof dependency !== "object" || Array.isArray(dependency)) {
    throw new AthenaError("CONFIG_ERROR", `workflows.create.definition.dependencies[${index}] must be an object.`);
  }
  const from = normalizeNonEmptyString(dependency.from, `workflows.create.definition.dependencies[${index}].from`);
  const to = normalizeNonEmptyString(dependency.to, `workflows.create.definition.dependencies[${index}].to`);
  const mappings = normalizeWorkflowMappings(dependency.mappings, index);
  return {
    from,
    to,
    ...(mappings ? { mappings } : {})
  };
}

function normalizeWorkflowOutputs(outputs: unknown, stepIndex: number): string[] | undefined {
  if (outputs === undefined || outputs === null) {
    return undefined;
  }
  if (!Array.isArray(outputs)) {
    throw new AthenaError("CONFIG_ERROR", `workflows.create.definition.steps[${stepIndex}].outputs must be an array.`);
  }
  const normalized = outputs.map((value, outputIndex) =>
    normalizeNonEmptyString(value, `workflows.create.definition.steps[${stepIndex}].outputs[${outputIndex}]`)
  );
  return [...new Set(normalized)];
}

function normalizeWorkflowExecutionMetadata(
  value: unknown,
  stepIndex: number
): WorkflowDefinition["steps"][number]["execution"] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `workflows.create.definition.steps[${stepIndex}].execution must be an object.`);
  }
  const row = value as Record<string, unknown>;
  const maxAttempts = readOptionalPositiveInt(
    row.maxAttempts,
    `workflows.create.definition.steps[${stepIndex}].execution.maxAttempts`
  );
  const timeoutMs = readOptionalPositiveInt(
    row.timeoutMs,
    `workflows.create.definition.steps[${stepIndex}].execution.timeoutMs`
  );
  const metadata = normalizeWorkflowMetadata(row.metadata, `workflows.create.definition.steps[${stepIndex}].execution`);
  const normalized = {
    ...(maxAttempts !== undefined ? { maxAttempts } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(metadata ? { metadata } : {})
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function readOptionalPositiveInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new AthenaError("CONFIG_ERROR", `${label} must be a positive integer.`);
  }
  return value;
}

function normalizeWorkflowMappings(value: unknown, dependencyIndex: number): Array<{ fromOutput: string; toInput: string }> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new AthenaError(
      "CONFIG_ERROR",
      `workflows.create.definition.dependencies[${dependencyIndex}].mappings must be an array.`
    );
  }
  return value.map((mapping, mappingIndex) => {
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
      throw new AthenaError(
        "CONFIG_ERROR",
        `workflows.create.definition.dependencies[${dependencyIndex}].mappings[${mappingIndex}] must be an object.`
      );
    }
    const row = mapping as Record<string, unknown>;
    return {
      fromOutput: normalizeNonEmptyString(
        row.fromOutput,
        `workflows.create.definition.dependencies[${dependencyIndex}].mappings[${mappingIndex}].fromOutput`
      ),
      toInput: normalizeNonEmptyString(
        row.toInput,
        `workflows.create.definition.dependencies[${dependencyIndex}].mappings[${mappingIndex}].toInput`
      )
    };
  });
}

function normalizeWorkflowMetadata(value: unknown, context: string): Record<string, string> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AthenaError("CONFIG_ERROR", `${context}.metadata must be an object.`);
  }
  const row = value as Record<string, unknown>;
  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(row)) {
    const normalizedKey = key.trim();
    if (normalizedKey.length === 0) {
      throw new AthenaError("CONFIG_ERROR", `${context}.metadata keys must be non-empty strings.`);
    }
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new AthenaError("CONFIG_ERROR", `${context}.metadata.${normalizedKey} must be a non-empty string.`);
    }
    metadata[normalizedKey] = entry.trim();
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function normalizeNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AthenaError("CONFIG_ERROR", `${context} must be a non-empty string.`);
  }
  return value.trim();
}

function assertWorkflowDagAcyclic(stepIds: string[], dependencies: Array<{ from: string; to: string }>): void {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const stepId of stepIds) {
    indegree.set(stepId, 0);
    adjacency.set(stepId, []);
  }
  for (const dependency of dependencies) {
    indegree.set(dependency.to, (indegree.get(dependency.to) ?? 0) + 1);
    adjacency.get(dependency.from)?.push(dependency.to);
  }
  for (const [from, edges] of adjacency.entries()) {
    adjacency.set(from, [...edges].sort((left, right) => left.localeCompare(right)));
  }

  const ready: string[] = stepIds
    .filter((stepId) => (indegree.get(stepId) ?? 0) === 0)
    .sort((left, right) => left.localeCompare(right));
  let visited = 0;
  while (ready.length > 0) {
    const next = ready.shift()!;
    visited += 1;
    for (const target of adjacency.get(next) ?? []) {
      const current = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, current);
      if (current === 0) {
        ready.push(target);
      }
    }
    ready.sort((left, right) => left.localeCompare(right));
  }

  if (visited === stepIds.length) {
    return;
  }
  const cycleNodes = [...indegree.entries()]
    .filter(([, count]) => count > 0)
    .map(([node]) => node)
    .sort((left, right) => left.localeCompare(right));
  throw new AthenaError(
    "CONFIG_ERROR",
    `workflows.create.definition.dependencies must form a DAG; cycle detected involving: ${cycleNodes.join(", ")}.`
  );
}
