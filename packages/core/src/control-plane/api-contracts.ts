import { AthenaError, asAthenaError } from "../runtime/errors.js";
import type { AthenaErrorCode } from "../shared/contracts.js";
export type {
  FleetSummary,
  ProviderCostSettings,
  PolicyDecisionEventMetadata,
  PolicyOriginDetails,
  PolicyWorkloadMetadata,
  RuntimeIsolationProfile,
  RuntimeIsolationStartMode,
  RunRejectionEvent
} from "../shared/contracts.js";

export const API_V1_PREFIX = "/api/v1";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRouteDefinition {
  method: ApiMethod;
  path: string;
  operationId: string;
  stream?: "sse";
  queryMode?: "cursor-page" | "tail";
  lifecycle?: "stable" | "deprecated";
  surface?: "canonical";
  canonicalPath?: string;
}

export interface CursorPageQuery {
  cursor?: string;
  limit?: number;
}

export interface TailQuery {
  after?: string;
  limit?: number;
}

export interface ApiErrorBody {
  error: {
    code: AthenaErrorCode | "UNKNOWN_ERROR";
    message: string;
    retryable: boolean;
    traceId?: string;
  };
}

export interface ApiErrorResponse {
  status: number;
  body: ApiErrorBody;
}

export const API_V1_ROUTES: ApiRouteDefinition[] = [
  { method: "GET", path: `${API_V1_PREFIX}/capabilities`, operationId: "getCapabilities" },
  { method: "GET", path: `${API_V1_PREFIX}/health`, operationId: "getHealth" },
  { method: "GET", path: `${API_V1_PREFIX}/readiness`, operationId: "getReadiness" },
  { method: "GET", path: `${API_V1_PREFIX}/admin/health`, operationId: "getAdminHealth" },
  { method: "GET", path: `${API_V1_PREFIX}/agent-catalog/plugins`, operationId: "listAgentCatalogPlugins" },
  { method: "GET", path: `${API_V1_PREFIX}/agent-catalog/agents`, operationId: "listAgentCatalogAgents" },
  { method: "GET", path: `${API_V1_PREFIX}/repositories`, operationId: "listRepositories" },
  { method: "POST", path: `${API_V1_PREFIX}/repositories`, operationId: "createRepository" },
  { method: "POST", path: `${API_V1_PREFIX}/repositories/inspect`, operationId: "inspectRepositoryPath" },
  { method: "GET", path: `${API_V1_PREFIX}/repositories/:id`, operationId: "getRepository" },
  { method: "DELETE", path: `${API_V1_PREFIX}/repositories/:id`, operationId: "deleteRepository" },
  { method: "POST", path: `${API_V1_PREFIX}/repositories/:id/inspect`, operationId: "inspectRepository" },
  { method: "GET", path: `${API_V1_PREFIX}/missions`, operationId: "listMissions" },
  { method: "POST", path: `${API_V1_PREFIX}/missions`, operationId: "createMission" },
  { method: "GET", path: `${API_V1_PREFIX}/missions/:id`, operationId: "getMission" },
  { method: "PUT", path: `${API_V1_PREFIX}/missions/:id`, operationId: "updateMission" },
  { method: "POST", path: `${API_V1_PREFIX}/missions/:id/run`, operationId: "runMission" },
  { method: "GET", path: `${API_V1_PREFIX}/missions/:id/runs`, operationId: "listMissionRuns" },
  { method: "GET", path: `${API_V1_PREFIX}/missions/:id/tasks`, operationId: "listMissionTasks" },
  { method: "POST", path: `${API_V1_PREFIX}/missions/:id/tasks`, operationId: "createMissionTask" },
  { method: "POST", path: `${API_V1_PREFIX}/missions/:id/tasks/attach`, operationId: "attachMissionTask" },
  { method: "GET", path: `${API_V1_PREFIX}/mission-runs/:runId`, operationId: "getMissionRun" },
  { method: "GET", path: `${API_V1_PREFIX}/tasks/metadata`, operationId: "getTaskMetadata" },
  { method: "GET", path: `${API_V1_PREFIX}/tasks`, operationId: "listTasks" },
  { method: "POST", path: `${API_V1_PREFIX}/tasks`, operationId: "createTask" },
  { method: "GET", path: `${API_V1_PREFIX}/tasks/:id`, operationId: "getTask" },
  { method: "PUT", path: `${API_V1_PREFIX}/tasks/:id`, operationId: "updateTask" },
  { method: "GET", path: `${API_V1_PREFIX}/tasks/:id/run-readiness`, operationId: "getTaskRunReadiness" },
  { method: "POST", path: `${API_V1_PREFIX}/tasks/:id/run`, operationId: "runTask" },
  { method: "GET", path: `${API_V1_PREFIX}/task-runs/:runId`, operationId: "getTaskRun" },
  { method: "GET", path: `${API_V1_PREFIX}/task-runs/:runId/artifacts/:artifactId`, operationId: "getTaskRunArtifact" },
  { method: "POST", path: `${API_V1_PREFIX}/task-runs/:runId/cancel`, operationId: "cancelTaskRun" },
  { method: "POST", path: `${API_V1_PREFIX}/runs`, operationId: "createRun" },
  { method: "GET", path: `${API_V1_PREFIX}/runs/active`, operationId: "listActiveRuns", queryMode: "cursor-page" },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/runs/cancel-requests`,
    operationId: "listCancellationRequests",
    queryMode: "cursor-page"
  },
  { method: "POST", path: `${API_V1_PREFIX}/runs/:sessionId/cancel`, operationId: "cancelRun" },
  { method: "POST", path: `${API_V1_PREFIX}/run-control/by-run/:runId/cancel`, operationId: "cancelRunByRunId" },
  { method: "GET", path: `${API_V1_PREFIX}/sessions`, operationId: "listSessions", queryMode: "cursor-page" },
  { method: "GET", path: `${API_V1_PREFIX}/sessions/search`, operationId: "searchSessions" },
  { method: "GET", path: `${API_V1_PREFIX}/sessions/:id/transcript`, operationId: "getSessionTranscript", queryMode: "tail" },
  { method: "GET", path: `${API_V1_PREFIX}/sessions/:id/artifacts`, operationId: "listSessionArtifacts" },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/sessions/:id/artifacts/:runId/:artifactId`,
    operationId: "getSessionArtifact"
  },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/sessions/:id/transcript/stream`,
    operationId: "streamSessionTranscript",
    stream: "sse",
    queryMode: "tail"
  },
  { method: "GET", path: `${API_V1_PREFIX}/sessions/:id/work-queue`, operationId: "getSessionWorkQueue" },
  { method: "GET", path: `${API_V1_PREFIX}/directives`, operationId: "listDirectives", queryMode: "cursor-page" },
  { method: "POST", path: `${API_V1_PREFIX}/directives`, operationId: "createDirective" },
  { method: "GET", path: `${API_V1_PREFIX}/harness-profiles`, operationId: "listHarnessProfiles", queryMode: "cursor-page" },
  { method: "POST", path: `${API_V1_PREFIX}/harness-profiles`, operationId: "createHarnessProfile" },
  { method: "GET", path: `${API_V1_PREFIX}/run-templates`, operationId: "listRunTemplates", queryMode: "cursor-page" },
  { method: "POST", path: `${API_V1_PREFIX}/run-templates`, operationId: "createRunTemplate" },
  { method: "POST", path: `${API_V1_PREFIX}/templates/:id/run`, operationId: "runTemplate" },
  { method: "GET", path: `${API_V1_PREFIX}/workflow-templates`, operationId: "listWorkflowTemplates" },
  { method: "POST", path: `${API_V1_PREFIX}/workflow-templates/:id/instantiate`, operationId: "instantiateWorkflowTemplate" },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/workflow-runs/:runId/status`,
    operationId: "getWorkflowRunStatus",
    lifecycle: "stable",
    surface: "canonical"
  },
  {
    method: "POST",
    path: `${API_V1_PREFIX}/workflow-runs/:runId/execute`,
    operationId: "executeWorkflowRun",
    lifecycle: "stable",
    surface: "canonical"
  },
  { method: "GET", path: `${API_V1_PREFIX}/memory/search`, operationId: "searchMemory" },
  { method: "POST", path: `${API_V1_PREFIX}/memory/get`, operationId: "getMemory" },
  { method: "POST", path: `${API_V1_PREFIX}/work/enqueue`, operationId: "enqueueWork" },
  { method: "POST", path: `${API_V1_PREFIX}/work/:sessionId/drain`, operationId: "drainWork" },
  { method: "GET", path: `${API_V1_PREFIX}/work/observability`, operationId: "getA2aObservability" },
  { method: "GET", path: `${API_V1_PREFIX}/work/observability/alerts`, operationId: "listA2aObservabilityAlerts", queryMode: "cursor-page" },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/work/observability/alerts/export.csv`,
    operationId: "exportA2aObservabilityAlertsCsv"
  },
  { method: "GET", path: `${API_V1_PREFIX}/work/flows/:traceId`, operationId: "getA2aFlowGraph" },
  { method: "GET", path: `${API_V1_PREFIX}/schedules`, operationId: "listSchedules", queryMode: "cursor-page" },
  { method: "POST", path: `${API_V1_PREFIX}/schedules`, operationId: "createSchedule" },
  { method: "PUT", path: `${API_V1_PREFIX}/schedules/:id`, operationId: "updateSchedule" },
  { method: "DELETE", path: `${API_V1_PREFIX}/schedules/:id`, operationId: "deleteSchedule" },
  { method: "POST", path: `${API_V1_PREFIX}/schedules/:id/run`, operationId: "runSchedule" },
  { method: "POST", path: `${API_V1_PREFIX}/schedules/tick`, operationId: "tickSchedules" },
  { method: "POST", path: `${API_V1_PREFIX}/schedules/:id/enable`, operationId: "enableSchedule" },
  { method: "POST", path: `${API_V1_PREFIX}/schedules/:id/disable`, operationId: "disableSchedule" },
  { method: "GET", path: `${API_V1_PREFIX}/schedules/:id`, operationId: "getSchedule" },
  { method: "GET", path: `${API_V1_PREFIX}/schedules/:id/logs`, operationId: "getScheduleLogs", queryMode: "tail" },
  { method: "GET", path: `${API_V1_PREFIX}/fleet/summary`, operationId: "getFleetSummary" },
  { method: "GET", path: `${API_V1_PREFIX}/fleet/cost/settings`, operationId: "getProviderCostSettings" },
  { method: "PUT", path: `${API_V1_PREFIX}/fleet/cost/settings`, operationId: "putProviderCostSettings" },
  { method: "GET", path: `${API_V1_PREFIX}/fleet/cost/report.csv`, operationId: "getFleetCostReportCsv" },
  { method: "GET", path: `${API_V1_PREFIX}/rbac/roles`, operationId: "listRbacRoles" },
  { method: "GET", path: `${API_V1_PREFIX}/rbac/assignments`, operationId: "listIdentityRoleAssignments" },
  { method: "PUT", path: `${API_V1_PREFIX}/rbac/assignments/:subject`, operationId: "upsertIdentityRoleAssignment" },
  { method: "DELETE", path: `${API_V1_PREFIX}/rbac/assignments/:subject`, operationId: "deleteIdentityRoleAssignment" },
  { method: "GET", path: `${API_V1_PREFIX}/rbac/audit/:subject`, operationId: "auditIdentityPermissions" },
  { method: "GET", path: `${API_V1_PREFIX}/governance/audit-trail`, operationId: "listGovernanceAuditTrail", queryMode: "cursor-page" },
  { method: "GET", path: `${API_V1_PREFIX}/events`, operationId: "listEvents", queryMode: "cursor-page" },
  { method: "GET", path: `${API_V1_PREFIX}/events/stream`, operationId: "streamEvents", stream: "sse", queryMode: "tail" },
  { method: "GET", path: `${API_V1_PREFIX}/rejections`, operationId: "listRejections", queryMode: "cursor-page" },
  { method: "GET", path: `${API_V1_PREFIX}/policy`, operationId: "getPolicy" },
  {
    method: "GET",
    path: `${API_V1_PREFIX}/policy/rejections`,
    operationId: "listPolicyConcurrencyRejections",
    queryMode: "cursor-page"
  },
  { method: "PUT", path: `${API_V1_PREFIX}/policy`, operationId: "putPolicy" },
  { method: "POST", path: `${API_V1_PREFIX}/specialists/run`, operationId: "runSpecialist" },
  { method: "POST", path: `${API_V1_PREFIX}/personas/run`, operationId: "runPersona" },
  { method: "GET", path: `${API_V1_PREFIX}/a2a/dlq`, operationId: "listA2aDlq", queryMode: "cursor-page" },
  { method: "POST", path: `${API_V1_PREFIX}/a2a/dlq/:id/requeue`, operationId: "requeueA2aDlqItem" },
  { method: "POST", path: `${API_V1_PREFIX}/a2a/dlq/:id/discard`, operationId: "discardA2aDlqItem" }
];

const DEFAULT_PAGE_LIMIT = 50;
const DEFAULT_TAIL_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;
const MAX_TAIL_LIMIT = 500;

export function normalizeCursorPageQuery(query: CursorPageQuery): { cursor?: string; limit: number } {
  const limit = Number.isFinite(query.limit) ? Math.floor(query.limit ?? DEFAULT_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT;
  return {
    ...(query.cursor ? { cursor: query.cursor } : {}),
    limit: clamp(limit, 1, MAX_PAGE_LIMIT)
  };
}

export function normalizeTailQuery(query: TailQuery): { after?: string; limit: number } {
  const limit = Number.isFinite(query.limit) ? Math.floor(query.limit ?? DEFAULT_TAIL_LIMIT) : DEFAULT_TAIL_LIMIT;
  return {
    ...(query.after ? { after: query.after } : {}),
    limit: clamp(limit, 1, MAX_TAIL_LIMIT)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mapErrorToHttp(error: unknown, traceId?: string): ApiErrorResponse {
  const athenaError = error instanceof AthenaError ? error : asAthenaError(error);

  return {
    status: toHttpStatus(athenaError.code),
    body: {
      error: {
        code: athenaError.code,
        message: athenaError.message,
        retryable: athenaError.retryable,
        ...(traceId ? { traceId } : {})
      }
    }
  };
}

function toHttpStatus(code: AthenaErrorCode): number {
  switch (code) {
    case "CONFIG_ERROR":
      return 400;
    case "AUTH_IDENTITY_MISSING":
    case "AUTH_TOKEN_MISSING":
    case "AUTH_TOKEN_INVALID":
      return 401;
    case "AUTHZ_DENIED":
      return 403;
    case "POLICY_CONCURRENCY_LIMIT_EXCEEDED":
      return 429;
    case "PAYLOAD_TOO_LARGE":
      return 413;
    case "PROVIDER_NOT_FOUND":
      return 404;
    case "SESSION_LOCK_TIMEOUT":
      return 409;
    case "RUN_CANCELLED":
      return 409;
    case "RUN_TIMEOUT":
      return 408;
    case "SCHEDULE_TIMEOUT":
      return 408;
    case "CONTEXT_OVERFLOW":
      return 413;
    case "SESSION_IO_ERROR":
      return 500;
    case "PROVIDER_ERROR":
      return 502;
    default:
      return 500;
  }
}
