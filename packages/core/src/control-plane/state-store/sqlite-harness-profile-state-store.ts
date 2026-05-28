import type { AthenaConfig } from "../../shared/config.js";
import type {
  DirectiveCreateRequest,
  HarnessProfile,
  HarnessProfileCreateRequest,
  RunTemplateCreateRequest,
  WorkflowCreateRequest
} from "../../shared/contracts.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { StateStore } from "./types.js";

export class SqliteHarnessProfileStateStore implements StateStore {
  readonly kind: StateStore["kind"];

  constructor(
    private readonly delegate: StateStore,
    private readonly config: AthenaConfig
  ) {
    this.kind = delegate.kind;
  }

  listSessions(): ReturnType<StateStore["listSessions"]> {
    return this.delegate.listSessions();
  }

  getSession(sessionId: string): ReturnType<StateStore["getSession"]> {
    return this.delegate.getSession(sessionId);
  }

  getTranscript(sessionId: string, options?: { limit?: number; after?: string }): ReturnType<StateStore["getTranscript"]> {
    return this.delegate.getTranscript(sessionId, options);
  }

  listDirectives(): ReturnType<StateStore["listDirectives"]> {
    return this.delegate.listDirectives();
  }

  createDirective(request: DirectiveCreateRequest): ReturnType<StateStore["createDirective"]> {
    return this.delegate.createDirective(request);
  }

  listRunTemplates(): ReturnType<StateStore["listRunTemplates"]> {
    return this.delegate.listRunTemplates();
  }

  createRunTemplate(request: RunTemplateCreateRequest): ReturnType<StateStore["createRunTemplate"]> {
    return this.delegate.createRunTemplate(request);
  }

  listWorkflows(): ReturnType<StateStore["listWorkflows"]> {
    return this.delegate.listWorkflows();
  }

  getWorkflow(id: string): ReturnType<StateStore["getWorkflow"]> {
    return this.delegate.getWorkflow(id);
  }

  createWorkflow(request: WorkflowCreateRequest): ReturnType<StateStore["createWorkflow"]> {
    return this.delegate.createWorkflow(request);
  }

  listWorkflowRuns(workflowId: string): ReturnType<StateStore["listWorkflowRuns"]> {
    return this.delegate.listWorkflowRuns(workflowId);
  }

  createWorkflowRun(request: Parameters<StateStore["createWorkflowRun"]>[0]): ReturnType<StateStore["createWorkflowRun"]> {
    return this.delegate.createWorkflowRun(request);
  }

  createRunEvidence(request: Parameters<StateStore["createRunEvidence"]>[0]): ReturnType<StateStore["createRunEvidence"]> {
    return this.delegate.createRunEvidence(request);
  }

  listRunEvidence(runId: string): ReturnType<StateStore["listRunEvidence"]> {
    return this.delegate.listRunEvidence(runId);
  }

  listSessionRunEvidence(sessionId: string): ReturnType<StateStore["listSessionRunEvidence"]> {
    return this.delegate.listSessionRunEvidence(sessionId);
  }

  getRunEvidence(runId: string, evidenceId: string): ReturnType<StateStore["getRunEvidence"]> {
    return this.delegate.getRunEvidence(runId, evidenceId);
  }

  transitionWorkflowRun(
    workflowId: string,
    runId: string,
    transition: Parameters<StateStore["transitionWorkflowRun"]>[2]
  ): ReturnType<StateStore["transitionWorkflowRun"]> {
    return this.delegate.transitionWorkflowRun(workflowId, runId, transition);
  }

  getWorkQueue(sessionId: string): ReturnType<StateStore["getWorkQueue"]> {
    return this.delegate.getWorkQueue(sessionId);
  }

  listSchedules(): ReturnType<StateStore["listSchedules"]> {
    return this.delegate.listSchedules();
  }

  getScheduleLogs(scheduleId: string, options?: { limit?: number }): ReturnType<StateStore["getScheduleLogs"]> {
    return this.delegate.getScheduleLogs(scheduleId, options);
  }

  async listHarnessProfiles(): Promise<HarnessProfile[]> {
    const appState = openAppStateDatabase(this.config);
    try {
      return appState.harnessProfiles.list();
    } finally {
      appState.close();
    }
  }

  async createHarnessProfile(request: HarnessProfileCreateRequest): Promise<HarnessProfile> {
    const appState = openAppStateDatabase(this.config);
    try {
      return appState.harnessProfiles.create(request);
    } finally {
      appState.close();
    }
  }
}
