import type {
  ActiveRunQueryResult,
  A2aDlqItem,
  A2aDlqListQuery,
  A2aDlqListResult,
  A2aFlowGraphQuery,
  A2aFlowGraphResult,
  A2aObservabilityQuery,
  A2aObservabilityResult,
  A2aStallAlertCsvExportQuery,
  A2aStallAlertHistoryQuery,
  A2aStallAlertHistoryResult,
  AgentCatalogAgentListQuery,
  AgentCatalogAgentListResult,
  AgentCatalogPluginListResult,
  TaskWorkbenchMetadata,
  TaskWorkbenchTask,
  TaskWorkbenchTaskCreateRequest,
  TaskWorkbenchTaskListQuery,
  TaskWorkbenchTaskListResult,
  TaskWorkbenchTaskRun,
  TaskWorkbenchTaskRunCancelRequest,
  TaskWorkbenchTaskRunCancelResult,
  TaskWorkbenchTaskRunDetail,
  TaskWorkbenchTaskRunRequest,
  TaskWorkbenchTaskUpdateRequest,
  MissionWorkbenchMission,
  MissionWorkbenchMissionCreateRequest,
  MissionWorkbenchMissionListQuery,
  MissionWorkbenchMissionListResult,
  MissionWorkbenchMissionRunDetail,
  MissionWorkbenchMissionRunRequest,
  MissionWorkbenchMissionTaskAttachRequest,
  MissionWorkbenchMissionTaskCreateRequest,
  MissionWorkbenchMissionTaskListResult,
  MissionWorkbenchMissionUpdateRequest,
  CancelRunByRunIdRequest,
  CancelRunByRunIdResult,
  CancelRunRequest,
  CancelRunResult,
  CapabilitySet,
  CancellationRequestQueryResult,
  EventEmitRequest,
  EventQuery,
  EventQueryResult,
  FleetSummary,
  ProviderCostSettings,
  Directive,
  DirectiveCreateRequest,
  DirectiveListResult,
  DirectiveListQuery,
  HarnessProfile,
  HarnessProfileCreateRequest,
  HarnessProfileListResult,
  HarnessProfileListQuery,
  RunTemplate,
  RunTemplateCreateRequest,
  RunTemplateListResult,
  RunTemplateListQuery,
  TemplateRunRequest,
  Workflow,
  WorkflowCreateRequest,
  WorkflowRunObservability,
  WorkflowRun,
  WorkflowListQuery,
  WorkflowListResult,
  WorkflowTemplateCatalogListQuery,
  WorkflowTemplateCatalogListResult,
  PolicyConcurrencyRejectionQuery,
  PolicyConcurrencyRejectionQueryResult,
  PolicyOriginDetails,
  PolicyDocument,
  RunRejectionReason,
  RunControlQuery,
  RunRequest,
  RunResult,
  ScheduleRunLog,
  ScheduledTask,
  SessionArtifactRecord,
  SessionArtifactSummary,
  IdentityRoleAssignment,
  IdentityRoleAuditResult,
  IdentityRoleAssignmentUpsertRequest,
  GovernanceAuditHistoryQuery,
  GovernanceAuditHistoryResult,
  RbacRoleDefinition,
  SessionSearchQuery,
  SessionSearchResult,
  SessionRecord,
  TranscriptEntry,
  MemorySearchResult,
  WorkQueueState
} from "../shared/contracts.js";
import type { RunScheduleResult, UpsertScheduleRequest } from "../schedule/index.js";
import type { DrainResult, EnqueueWorkRequest } from "../work/index.js";
import type { MemoryGetRequest, MemoryGetResult, MemorySearchOptions } from "../memory/index.js";
import type { SpecialistRunRequest } from "../specialists/run.js";
import type { SpecialistRunResult } from "../specialists/types.js";
import type { TranscriptSubscription } from "../runtime/transcript-stream.js";

export interface RunService {
  run(request: RunRequest, options?: { signal?: AbortSignal; timeoutMs?: number }): Promise<RunResult>;
  cancel(request: CancelRunRequest): Promise<CancelRunResult>;
  cancelByRunId(request: CancelRunByRunIdRequest): Promise<CancelRunByRunIdResult>;
  listActiveRuns(query?: RunControlQuery): Promise<ActiveRunQueryResult>;
  listCancellationRequests(query?: RunControlQuery): Promise<CancellationRequestQueryResult>;
}

export interface SessionService {
  listSessions(): Promise<SessionRecord[]>;
  getSession(sessionId: string): Promise<SessionRecord | undefined>;
  getTranscript(sessionId: string, options?: { limit?: number; after?: string }): Promise<TranscriptEntry[]>;
  subscribeTranscript(sessionId: string, listener: (entry: TranscriptEntry) => void): Promise<TranscriptSubscription>;
  searchSessions(query: SessionSearchQuery): Promise<SessionSearchResult>;
  listArtifacts(sessionId: string): Promise<SessionArtifactSummary[]>;
  getArtifact(sessionId: string, runId: string, artifactId: string): Promise<SessionArtifactRecord | undefined>;
}

export interface IdentityService {
  listRoles(): Promise<RbacRoleDefinition[]>;
  listAssignments(): Promise<IdentityRoleAssignment[]>;
  upsertAssignment(request: IdentityRoleAssignmentUpsertRequest): Promise<IdentityRoleAssignment>;
  removeAssignment(subject: string): Promise<{ subject: string; removed: boolean }>;
  auditPermissions(subject: string): Promise<IdentityRoleAuditResult>;
}

export interface DirectiveService {
  list(query?: DirectiveListQuery): Promise<DirectiveListResult>;
  create(request: DirectiveCreateRequest): Promise<Directive>;
}

export interface HarnessProfileService {
  list(query?: HarnessProfileListQuery): Promise<HarnessProfileListResult>;
  create(request: HarnessProfileCreateRequest): Promise<HarnessProfile>;
}

export interface RunTemplateService {
  list(query?: RunTemplateListQuery): Promise<RunTemplateListResult>;
  create(request: RunTemplateCreateRequest): Promise<RunTemplate>;
  run(id: string, request?: TemplateRunRequest): Promise<RunResult>;
}

export interface WorkflowService {
  list(query?: WorkflowListQuery): Promise<WorkflowListResult>;
  create(request: WorkflowCreateRequest): Promise<Workflow>;
  status(id: string): Promise<WorkflowRunObservability>;
  resume(id: string): Promise<WorkflowRun>;
}

export interface WorkflowTemplateCatalogService {
  list(query?: WorkflowTemplateCatalogListQuery): Promise<WorkflowTemplateCatalogListResult>;
}

export interface WorkService {
  enqueue(request: EnqueueWorkRequest): Promise<WorkQueueState>;
  status(sessionId: string): Promise<WorkQueueState>;
  drain(sessionId: string, options?: { provider?: string; model?: string }): Promise<DrainResult>;
}

export interface MemoryService {
  search(query: string, options?: MemorySearchOptions): Promise<MemorySearchResult[]>;
  get(request: MemoryGetRequest): Promise<MemoryGetResult>;
}

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspHoverInfo {
  contents: string;
  range?: LspRange;
}

export interface LspDocumentSymbol {
  name: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  detail?: string;
  children?: LspDocumentSymbol[];
}

export interface LspService {
  getDefinition(file: string, line: number, character: number): Promise<LspLocation[]>;
  getReferences(file: string, line: number, character: number): Promise<LspLocation[]>;
  getHoverInfo(file: string, line: number, character: number): Promise<LspHoverInfo | undefined>;
  getDocumentSymbols(file: string): Promise<LspDocumentSymbol[]>;
}

export interface PersonaService {
  list(): Promise<string[]>;
  run(request: SpecialistRunRequest): Promise<{ result: SpecialistRunResult; stdout: string }>;
}

export interface SpecialistService {
  list(): Promise<string[]>;
  run(request: SpecialistRunRequest): Promise<{ result: SpecialistRunResult; stdout: string }>;
}

export interface ScheduleService {
  list(): Promise<ScheduledTask[]>;
  get(id: string): Promise<ScheduledTask | undefined>;
  upsert(request: UpsertScheduleRequest): Promise<ScheduledTask>;
  remove(id: string): Promise<boolean>;
  run(id: string, options?: { provider?: string; model?: string }): Promise<{
    status: "ok" | "failed" | "already-running";
    id: string;
    sessionId: string;
    startedAt: string;
    finishedAt: string;
    error?: string;
  }>;
  runDue(at: Date, options?: { provider?: string; model?: string }): Promise<{ run: RunScheduleResult[]; skipped: number }>;
  logs(id: string, options?: { limit?: number }): Promise<ScheduleRunLog[]>;
}

export interface PolicyService {
  get(): Promise<PolicyDocument | undefined>;
  put(policy: PolicyDocument): Promise<PolicyDocument>;
  listConcurrencyRejections(query?: PolicyConcurrencyRejectionQuery): Promise<PolicyConcurrencyRejectionQueryResult>;
  recordConcurrencyRejection(record: {
    sessionId: string;
    activeRuns: number;
    maxConcurrentRuns: number;
    reason?: RunRejectionReason;
    policy?: PolicyOriginDetails;
  }): Promise<PolicyConcurrencyRejectionQueryResult["items"][number]>;
}

export interface EventService {
  list(query?: EventQuery): Promise<EventQueryResult>;
  emit(event: EventEmitRequest): Promise<void>;
}

export interface GovernanceAuditService {
  list(query?: GovernanceAuditHistoryQuery): Promise<GovernanceAuditHistoryResult>;
}

export interface FleetService {
  getSummary(): Promise<FleetSummary>;
  getProviderCostSettings(): Promise<ProviderCostSettings>;
  updateProviderCostSettings(request: {
    providers: Array<{
      provider: string;
      inputCostPer1kTokensUsd: number;
      outputCostPer1kTokensUsd: number;
    }>;
  }): Promise<ProviderCostSettings>;
  exportMonthlyCostCsv(request?: { month?: string }): Promise<string>;
}

export interface CapabilityService {
  getCapabilities(): Promise<CapabilitySet>;
}

export interface AgentCatalogService {
  listPlugins(): Promise<AgentCatalogPluginListResult>;
  listAgents(query?: AgentCatalogAgentListQuery): Promise<AgentCatalogAgentListResult>;
}

export interface TaskWorkbenchService {
  metadata(): Promise<TaskWorkbenchMetadata>;
  list(query?: TaskWorkbenchTaskListQuery): Promise<TaskWorkbenchTaskListResult>;
  get(id: string): Promise<TaskWorkbenchTask>;
  create(request: TaskWorkbenchTaskCreateRequest): Promise<TaskWorkbenchTask>;
  update(id: string, request: TaskWorkbenchTaskUpdateRequest): Promise<TaskWorkbenchTask>;
  getRun(runId: string): Promise<TaskWorkbenchTaskRunDetail>;
  runTask(id: string, request?: TaskWorkbenchTaskRunRequest): Promise<TaskWorkbenchTaskRun>;
  cancelRun(runId: string, request?: TaskWorkbenchTaskRunCancelRequest): Promise<TaskWorkbenchTaskRunCancelResult>;
}

export interface MissionWorkbenchService {
  list(query?: MissionWorkbenchMissionListQuery): Promise<MissionWorkbenchMissionListResult>;
  get(id: string): Promise<MissionWorkbenchMission>;
  create(request: MissionWorkbenchMissionCreateRequest): Promise<MissionWorkbenchMission>;
  update(id: string, request: MissionWorkbenchMissionUpdateRequest): Promise<MissionWorkbenchMission>;
  listTasks(id: string): Promise<MissionWorkbenchMissionTaskListResult>;
  attachTask(id: string, request: MissionWorkbenchMissionTaskAttachRequest): Promise<MissionWorkbenchMissionTaskListResult>;
  createTask(id: string, request: MissionWorkbenchMissionTaskCreateRequest): Promise<MissionWorkbenchMissionTaskListResult>;
  runMission(id: string, request?: MissionWorkbenchMissionRunRequest): Promise<MissionWorkbenchMissionRunDetail>;
  getMissionRun(runId: string): Promise<MissionWorkbenchMissionRunDetail>;
}

export interface A2aDlqService {
  list(query?: A2aDlqListQuery): Promise<A2aDlqListResult>;
  requeue(id: string): Promise<{ updated: boolean; item?: A2aDlqItem }>;
  discard(id: string): Promise<{ updated: boolean; item?: A2aDlqItem }>;
}

export interface A2aFlowService {
  getTrace(traceId: string, query?: A2aFlowGraphQuery): Promise<A2aFlowGraphResult>;
}

export interface A2aObservabilityService {
  getSnapshot(query?: A2aObservabilityQuery): Promise<A2aObservabilityResult>;
  listAlertHistory(query?: A2aStallAlertHistoryQuery): Promise<A2aStallAlertHistoryResult>;
  exportAlertHistoryCsv(query: A2aStallAlertCsvExportQuery): Promise<string>;
}
