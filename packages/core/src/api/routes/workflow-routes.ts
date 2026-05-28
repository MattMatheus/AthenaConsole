import { parseCreateWorkflowRequest, parseCursorPageQuery } from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const WORKFLOW_ROUTES = defineApiRoutes("workflows", [
  { method: "GET", path: "/api/v1/workflows", handler: handleListWorkflowsRoute },
  { method: "POST", path: "/api/v1/workflows", handler: handleCreateWorkflowRoute },
  { method: "GET", path: "/api/v1/workflows/run/:id", handler: handleGetWorkflowStatusRoute },
  { method: "POST", path: "/api/v1/workflows/run/:id/resume", handler: handleResumeWorkflowRoute },
  { method: "GET", path: "/api/v1/workflow-runs/:runId/status", handler: handleGetWorkflowRunGraphStatusRoute }
]);

async function handleListWorkflowsRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  writeSuccess(context.res, "listWorkflows", 200, await context.services.workflowService.list(query));
}

async function handleCreateWorkflowRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const createRequest = parseCreateWorkflowRequest(body);
  const workflow = await context.services.workflowService.create(createRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "workflow.created",
    payload: {
      workflowId: workflow.id,
      stepCount: workflow.definition.steps.length,
      dependencyCount: workflow.definition.dependencies.length
    }
  });
  writeSuccess(context.res, "createWorkflow", 200, workflow);
}

async function handleResumeWorkflowRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  await readJson(context.req);
  const workflowRun = await context.services.workflowService.resume(decodeRouteParam(params, "id"));
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "workflow.resumed",
    payload: {
      workflowId: workflowRun.workflowId,
      workflowRunId: workflowRun.id,
      status: workflowRun.status
    }
  });
  writeSuccess(context.res, "resumeWorkflow", 200, workflowRun);
}

async function handleGetWorkflowStatusRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  writeSuccess(context.res, "getWorkflowRun", 200, await context.services.workflowService.status(decodeRouteParam(params, "id")));
}

async function handleGetWorkflowRunGraphStatusRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  writeSuccess(
    context.res,
    "getWorkflowRunStatus",
    200,
    await context.services.workflowStatusService.getStatus(decodeRouteParam(params, "runId"))
  );
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
