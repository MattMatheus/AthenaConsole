import {
  parseTaskWorkbenchCancelRunRequest,
  parseTaskWorkbenchCreateRequest,
  parseTaskWorkbenchListQuery,
  parseTaskWorkbenchRunRequest,
  parseTaskWorkbenchUpdateRequest
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const TASK_ROUTES = defineApiRoutes("tasks", [
  { method: "GET", path: "/api/v1/tasks/metadata", handler: handleGetTaskMetadataRoute },
  { method: "GET", path: "/api/v1/tasks", handler: handleListTasksRoute },
  { method: "POST", path: "/api/v1/tasks", handler: handleCreateTaskRoute },
  { method: "GET", path: "/api/v1/tasks/:id", handler: handleGetTaskRoute },
  { method: "PUT", path: "/api/v1/tasks/:id", handler: handleUpdateTaskRoute },
  { method: "GET", path: "/api/v1/tasks/:id/run-readiness", handler: handleGetTaskRunReadinessRoute },
  { method: "POST", path: "/api/v1/tasks/:id/run", handler: handleRunTaskRoute },
  { method: "GET", path: "/api/v1/task-runs/:runId", handler: handleGetTaskRunRoute },
  { method: "GET", path: "/api/v1/task-runs/:runId/evidence-bundle", handler: handleGetTaskRunEvidenceBundleRoute },
  { method: "GET", path: "/api/v1/task-runs/:runId/artifacts/:artifactId", handler: handleGetTaskRunArtifactRoute },
  { method: "POST", path: "/api/v1/task-runs/:runId/cancel", handler: handleCancelTaskRunRoute }
]);

async function handleGetTaskMetadataRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getTaskMetadata", 200, await context.services.taskWorkbenchService.metadata());
}

async function handleListTasksRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listTasks",
    200,
    await context.services.taskWorkbenchService.list(parseTaskWorkbenchListQuery(context.requestUrl))
  );
}

async function handleCreateTaskRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createTask",
    200,
    await context.services.taskWorkbenchService.create(parseTaskWorkbenchCreateRequest(body))
  );
}

async function handleGetTaskRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getTask", 200, await context.services.taskWorkbenchService.get(requireRouteParam(context, "id")));
}

async function handleUpdateTaskRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "updateTask",
    200,
    await context.services.taskWorkbenchService.update(requireRouteParam(context, "id"), parseTaskWorkbenchUpdateRequest(body))
  );
}

async function handleGetTaskRunReadinessRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getTaskRunReadiness",
    200,
    await context.services.taskWorkbenchService.getRunReadiness(requireRouteParam(context, "id"))
  );
}

async function handleRunTaskRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "runTask",
    200,
    await context.services.taskWorkbenchService.runTask(requireRouteParam(context, "id"), parseTaskWorkbenchRunRequest(body))
  );
}

async function handleGetTaskRunRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getTaskRun",
    200,
    await context.services.taskWorkbenchService.getRun(requireRouteParam(context, "runId"))
  );
}

async function handleGetTaskRunEvidenceBundleRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getTaskRunEvidenceBundle",
    200,
    await context.services.taskWorkbenchService.exportRunEvidenceBundle(requireRouteParam(context, "runId"), {
      destinationKind: "api-response"
    })
  );
}

async function handleGetTaskRunArtifactRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getTaskRunArtifact",
    200,
    await context.services.taskWorkbenchService.getRunArtifact(
      requireRouteParam(context, "runId"),
      requireRouteParam(context, "artifactId")
    )
  );
}

async function handleCancelTaskRunRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "cancelTaskRun",
    200,
    await context.services.taskWorkbenchService.cancelRun(
      requireRouteParam(context, "runId"),
      parseTaskWorkbenchCancelRunRequest(body)
    )
  );
}

function requireRouteParam(context: ApiRouteContext, key: string): string {
  return decodeURIComponent(context.routeParams?.[key] ?? "");
}
