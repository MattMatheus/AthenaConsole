export interface WorkflowDataMapping {
  fromOutput: string;
  toInput: string;
}

export interface WorkflowStepExecutionMetadata {
  maxAttempts?: number;
  timeoutMs?: number;
  metadata?: Record<string, string>;
}

export interface WorkflowStepDefinition {
  id: string;
  directiveId: string;
  harnessProfileId: string;
  outputs?: string[];
  execution?: WorkflowStepExecutionMetadata;
}

export interface WorkflowDependencyDefinition {
  from: string;
  to: string;
  mappings?: WorkflowDataMapping[];
}

export interface WorkflowDefinition {
  steps: WorkflowStepDefinition[];
  dependencies: WorkflowDependencyDefinition[];
}

export interface Workflow {
  id: string;
  definition: WorkflowDefinition;
  createdAt: string;
}

export type WorkflowRunStatus = "pending" | "running" | "ok" | "failed";
export type WorkflowStepRunStatus = "pending" | "running" | "ok" | "failed";
export type WorkflowRunLogLevel = "info" | "error";

export interface WorkflowStepDependencyReadiness {
  totalDependencies: number;
  readyDependencies: number;
  blockingStepIds: string[];
}

export interface WorkflowStepArtifact {
  kind: "run-result";
  output: string;
  provider: string;
  model: string;
  createdAt: string;
}

export interface WorkflowStepCheckpoint {
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
  artifact?: WorkflowStepArtifact;
  error?: string;
}

export interface WorkflowRunStepState {
  stepId: string;
  status: WorkflowStepRunStatus;
  attempt: number;
  ready: boolean;
  dependencyReadiness: WorkflowStepDependencyReadiness;
  checkpoint?: WorkflowStepCheckpoint;
  updatedAt: string;
}

export interface WorkflowRunLogEntry {
  id: string;
  level: WorkflowRunLogLevel;
  message: string;
  createdAt: string;
  stepId?: string;
}

export interface WorkflowRun {
  schemaVersion: number;
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  stepOrder: string[];
  stepStates: Record<string, WorkflowRunStepState>;
  executionLog: WorkflowRunLogEntry[];
  resumedFromRunId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowRunProgressMetadata {
  totalSteps: number;
  completedSteps: number;
  runningSteps: number;
  failedSteps: number;
  pendingSteps: number;
  percentComplete: number;
}

export interface WorkflowRunEta {
  computedAt: string;
  source: "historical-average" | "insufficient-history" | "completed";
  historicalSampleSize: number;
  estimatedRemainingMs?: number;
  estimatedCompletionAt?: string;
}

export interface WorkflowRunCompatibilityMetadata {
  surface: "legacy-file-backed-workflow";
  lifecycle: "deprecated";
  canonicalWorkflowDagStatusPath: "/api/v1/workflow-runs/{runId}/status";
  note: string;
}

export interface WorkflowRunArtifactReference {
  stepId: string;
  artifactRef: string;
  kind: WorkflowStepArtifact["kind"];
  provider: string;
  model: string;
  createdAt: string;
  outputChars: number;
}

export interface WorkflowRunObservability {
  workflow: Workflow;
  run: WorkflowRun;
  nodes: WorkflowRunStepState[];
  progress: WorkflowRunProgressMetadata;
  artifactRefs: WorkflowRunArtifactReference[];
  eta: WorkflowRunEta;
  compatibility: WorkflowRunCompatibilityMetadata;
}

export interface WorkflowCreateRequest {
  definition: WorkflowDefinition;
}

export interface WorkflowListQuery {
  cursor?: string;
  limit?: number;
}

export interface WorkflowListResult {
  items: Workflow[];
  nextCursor?: string;
}
