import type {
  Directive,
  DirectiveCreateRequest,
  HarnessProfile,
  HarnessProfileCreateRequest,
  RunTemplate,
  RunTemplateCreateRequest,
  Workflow,
  WorkflowCreateRequest,
  WorkflowRun,
  WorkflowRunStepState,
  SessionRecord,
  TranscriptEntry,
  WorkQueueState
} from "../../shared/contracts.js";

export type RunEvidenceType = "text" | "json" | "binary";

export interface RunEvidenceRecord {
  schemaVersion: number;
  id: string;
  sessionId: string;
  runId: string;
  traceId: string;
  label: string;
  type: RunEvidenceType;
  content:
    | { kind: "text"; text: string }
    | { kind: "json"; value: unknown }
    | { kind: "binary"; base64: string };
  createdAt: string;
  artifactRef: string;
  sizeBytes: number;
}

export interface StateStore {
  kind: "file" | "remote";
  listSessions(): Promise<SessionRecord[]>;
  getSession(sessionId: string): Promise<SessionRecord | undefined>;
  getTranscript(sessionId: string, options?: { limit?: number; after?: string }): Promise<TranscriptEntry[]>;
  listDirectives(): Promise<Directive[]>;
  createDirective(request: DirectiveCreateRequest): Promise<Directive>;
  listHarnessProfiles(): Promise<HarnessProfile[]>;
  createHarnessProfile(request: HarnessProfileCreateRequest): Promise<HarnessProfile>;
  listRunTemplates(): Promise<RunTemplate[]>;
  createRunTemplate(request: RunTemplateCreateRequest): Promise<RunTemplate>;
  listWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(request: WorkflowCreateRequest): Promise<Workflow>;
  listWorkflowRuns(workflowId: string): Promise<WorkflowRun[]>;
  createWorkflowRun(request: {
    workflowId: string;
    stepOrder: string[];
    stepStates: Record<string, WorkflowRunStepState>;
    resumedFromRunId?: string;
  }): Promise<WorkflowRun>;
  createRunEvidence(request: {
    sessionId: string;
    runId: string;
    traceId: string;
    label: string;
    type: RunEvidenceType;
    content: string | unknown;
  }): Promise<RunEvidenceRecord>;
  listRunEvidence(runId: string): Promise<RunEvidenceRecord[]>;
  listSessionRunEvidence(sessionId: string): Promise<RunEvidenceRecord[]>;
  getRunEvidence(runId: string, evidenceId: string): Promise<RunEvidenceRecord | undefined>;
  transitionWorkflowRun(
    workflowId: string,
    runId: string,
    transition: (run: WorkflowRun) => WorkflowRun
  ): Promise<WorkflowRun>;
  getWorkQueue(sessionId: string): Promise<WorkQueueState>;
}
