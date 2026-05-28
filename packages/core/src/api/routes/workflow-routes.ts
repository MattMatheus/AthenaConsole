import type { RouteParams } from "../router.js";
import { writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const WORKFLOW_ROUTES = defineApiRoutes("workflows", [
  { method: "GET", path: "/api/v1/workflow-runs/:runId/status", handler: handleGetWorkflowRunGraphStatusRoute },
  { method: "POST", path: "/api/v1/workflow-runs/:runId/execute", handler: handleExecuteWorkflowRunRoute }
]);

async function handleGetWorkflowRunGraphStatusRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  writeSuccess(
    context.res,
    "getWorkflowRunStatus",
    200,
    await context.services.workflowStatusService.getStatus(decodeRouteParam(params, "runId"))
  );
}

async function handleExecuteWorkflowRunRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  writeSuccess(
    context.res,
    "executeWorkflowRun",
    200,
    await context.services.workflowDagExecutorService.execute(decodeRouteParam(params, "runId"))
  );
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
