import { AthenaError } from "../runtime/errors.js";

export interface WorkflowTemplateDagTask {
  id?: unknown;
  dependsOn?: unknown;
}

export interface WorkflowTemplateDagIssue {
  path: string;
  message: string;
  keyword?: string;
}

export interface WorkflowTemplateDagDefinition {
  taskOrder: string[];
  dependenciesByTaskId: Record<string, string[]>;
}

interface NormalizedDagTask {
  id: string;
  index: number;
  dependencies: string[];
}

export function parseWorkflowTemplateDag(
  tasks: WorkflowTemplateDagTask[] | undefined,
  options: { path?: string } = {}
): WorkflowTemplateDagDefinition {
  const issues = validateWorkflowTemplateDag(tasks, options);
  if (issues.length > 0) {
    throw new AthenaError("CONFIG_ERROR", issues.map((issue) => issue.message).join("; "));
  }
  return buildWorkflowTemplateDag(tasks ?? [], options.path ?? "$.workflow.tasks");
}

export function validateWorkflowTemplateDag(
  tasks: WorkflowTemplateDagTask[] | undefined,
  options: { path?: string } = {}
): WorkflowTemplateDagIssue[] {
  const path = options.path ?? "$.workflow.tasks";
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [
      {
        path,
        message: "Workflow template must include at least one task.",
        keyword: "minItems"
      }
    ];
  }

  const { normalized, issues } = normalizeDagTasks(tasks, path);
  if (issues.length > 0) {
    return issues;
  }

  return validateNormalizedDagTasks(normalized, path);
}

function buildWorkflowTemplateDag(tasks: WorkflowTemplateDagTask[], path: string): WorkflowTemplateDagDefinition {
  const { normalized } = normalizeDagTasks(tasks, path);
  const issues = validateNormalizedDagTasks(normalized, path);
  if (issues.length > 0) {
    throw new AthenaError("CONFIG_ERROR", issues.map((issue) => issue.message).join("; "));
  }

  const dependenciesByTaskId = Object.fromEntries(
    normalized.map((task) => [task.id, task.dependencies])
  ) as Record<string, string[]>;
  const indexById = new Map(normalized.map((task) => [task.id, task.index]));
  const indegree = new Map(normalized.map((task) => [task.id, task.dependencies.length]));
  const dependentsByTaskId = new Map<string, string[]>();

  for (const task of normalized) {
    for (const dependencyId of task.dependencies) {
      const dependents = dependentsByTaskId.get(dependencyId) ?? [];
      dependents.push(task.id);
      dependentsByTaskId.set(dependencyId, dependents);
    }
  }

  for (const dependents of dependentsByTaskId.values()) {
    dependents.sort((left, right) => (indexById.get(left) ?? 0) - (indexById.get(right) ?? 0));
  }

  const ready = normalized.filter((task) => task.dependencies.length === 0).map((task) => task.id);
  const taskOrder: string[] = [];
  while (ready.length > 0) {
    const taskId = ready.shift()!;
    taskOrder.push(taskId);
    for (const dependentId of dependentsByTaskId.get(taskId) ?? []) {
      const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(dependentId);
        ready.sort((left, right) => (indexById.get(left) ?? 0) - (indexById.get(right) ?? 0));
      }
    }
  }

  return { taskOrder, dependenciesByTaskId };
}

function normalizeDagTasks(
  tasks: WorkflowTemplateDagTask[],
  path: string
): { normalized: NormalizedDagTask[]; issues: WorkflowTemplateDagIssue[] } {
  const normalized: NormalizedDagTask[] = [];
  const issues: WorkflowTemplateDagIssue[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  tasks.forEach((task, index) => {
    if (!isRecord(task) || typeof task.id !== "string" || task.id.length === 0) {
      issues.push({
        path: `${path}.${index}.id`,
        message: `Workflow task template at index ${index} must include an id.`,
        keyword: "required"
      });
      return;
    }
    if (seen.has(task.id)) {
      duplicates.add(task.id);
    }
    seen.add(task.id);

    const dependencies = normalizeDependencyList(task.dependsOn, `${path}.${index}.dependsOn`, issues);
    normalized.push({
      id: task.id,
      index,
      dependencies
    });
  });

  if (duplicates.size > 0) {
    issues.push({
      path,
      message: `Workflow task ids must be unique: ${[...duplicates].sort().join(", ")}`,
      keyword: "uniqueTaskIds"
    });
  }

  return { normalized, issues };
}

function validateNormalizedDagTasks(normalized: NormalizedDagTask[], path: string): WorkflowTemplateDagIssue[] {
  const issues: WorkflowTemplateDagIssue[] = [];
  const taskIds = new Set(normalized.map((task) => task.id));
  for (const task of normalized) {
    for (const dependencyId of task.dependencies) {
      if (dependencyId === task.id) {
        issues.push({
          path: `${path}.${task.index}.dependsOn`,
          message: `Workflow task '${task.id}' cannot depend on itself.`,
          keyword: "selfDependency"
        });
      } else if (!taskIds.has(dependencyId)) {
        issues.push({
          path: `${path}.${task.index}.dependsOn`,
          message: `Workflow task '${task.id}' depends on missing task '${dependencyId}'.`,
          keyword: "missingDependency"
        });
      }
    }
  }

  if (issues.length > 0) {
    return issues;
  }

  const cycle = findCycle(normalized);
  if (cycle) {
    issues.push({
      path,
      message: `Workflow task dependencies must not contain cycles: ${cycle.join(" -> ")}.`,
      keyword: "cycle"
    });
  }
  return issues;
}

function normalizeDependencyList(
  value: unknown,
  path: string,
  issues: WorkflowTemplateDagIssue[]
): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    issues.push({
      path,
      message: `${path} must be an array of strings.`,
      keyword: "type"
    });
    return [];
  }
  return Array.from(new Set(value));
}

function findCycle(tasks: NormalizedDagTask[]): string[] | undefined {
  const dependenciesByTaskId = new Map(tasks.map((task) => [task.id, task.dependencies]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  for (const task of tasks) {
    const cycle = visit(task.id, dependenciesByTaskId, visited, visiting, stack);
    if (cycle) {
      return cycle;
    }
  }
  return undefined;
}

function visit(
  taskId: string,
  dependenciesByTaskId: Map<string, string[]>,
  visited: Set<string>,
  visiting: Set<string>,
  stack: string[]
): string[] | undefined {
  if (visited.has(taskId)) {
    return undefined;
  }
  if (visiting.has(taskId)) {
    const cycleStart = stack.indexOf(taskId);
    return [...stack.slice(cycleStart), taskId];
  }

  visiting.add(taskId);
  stack.push(taskId);
  for (const dependencyId of dependenciesByTaskId.get(taskId) ?? []) {
    const cycle = visit(dependencyId, dependenciesByTaskId, visited, visiting, stack);
    if (cycle) {
      return cycle;
    }
  }
  stack.pop();
  visiting.delete(taskId);
  visited.add(taskId);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
