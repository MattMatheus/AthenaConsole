import {
  parseMissionWorkbenchAttachTaskRequest,
  parseMissionWorkbenchCreateRequest,
  parseMissionWorkbenchCreateTaskRequest,
  parseMissionWorkbenchListQuery,
  parseMissionWorkbenchRunRequest,
  parseMissionWorkbenchUpdateRequest
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const MISSION_ROUTES = defineApiRoutes("missions", [
  { method: "GET", path: "/api/v1/missions", handler: handleListMissionsRoute },
  { method: "POST", path: "/api/v1/missions", handler: handleCreateMissionRoute },
  { method: "GET", path: "/api/v1/missions/:id", handler: handleGetMissionRoute },
  { method: "PUT", path: "/api/v1/missions/:id", handler: handleUpdateMissionRoute },
  { method: "POST", path: "/api/v1/missions/:id/run", handler: handleRunMissionRoute },
  { method: "GET", path: "/api/v1/missions/:id/runs", handler: handleListMissionRunsRoute },
  { method: "GET", path: "/api/v1/missions/:id/tasks", handler: handleListMissionTasksRoute },
  { method: "POST", path: "/api/v1/missions/:id/tasks", handler: handleCreateMissionTaskRoute },
  { method: "POST", path: "/api/v1/missions/:id/tasks/attach", handler: handleAttachMissionTaskRoute },
  { method: "GET", path: "/api/v1/mission-runs/:runId", handler: handleGetMissionRunRoute }
]);

async function handleListMissionsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listMissions",
    200,
    await context.services.missionWorkbenchService.list(parseMissionWorkbenchListQuery(context.requestUrl))
  );
}

async function handleCreateMissionRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createMission",
    200,
    await context.services.missionWorkbenchService.create(parseMissionWorkbenchCreateRequest(body))
  );
}

async function handleGetMissionRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getMission", 200, await context.services.missionWorkbenchService.get(requireRouteParam(context, "id")));
}

async function handleUpdateMissionRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "updateMission",
    200,
    await context.services.missionWorkbenchService.update(requireRouteParam(context, "id"), parseMissionWorkbenchUpdateRequest(body))
  );
}

async function handleRunMissionRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "runMission",
    200,
    await context.services.missionWorkbenchService.runMission(requireRouteParam(context, "id"), parseMissionWorkbenchRunRequest(body))
  );
}

async function handleListMissionTasksRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listMissionTasks",
    200,
    await context.services.missionWorkbenchService.listTasks(requireRouteParam(context, "id"))
  );
}

async function handleListMissionRunsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listMissionRuns",
    200,
    await context.services.missionWorkbenchService.listMissionRuns(requireRouteParam(context, "id"))
  );
}

async function handleGetMissionRunRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getMissionRun",
    200,
    await context.services.missionWorkbenchService.getMissionRun(requireRouteParam(context, "runId"))
  );
}

async function handleCreateMissionTaskRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createMissionTask",
    200,
    await context.services.missionWorkbenchService.createTask(
      requireRouteParam(context, "id"),
      parseMissionWorkbenchCreateTaskRequest(body)
    )
  );
}

async function handleAttachMissionTaskRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "attachMissionTask",
    200,
    await context.services.missionWorkbenchService.attachTask(
      requireRouteParam(context, "id"),
      parseMissionWorkbenchAttachTaskRequest(body)
    )
  );
}

function requireRouteParam(context: ApiRouteContext, key: string): string {
  return decodeURIComponent(context.routeParams?.[key] ?? "");
}
