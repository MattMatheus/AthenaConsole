import { parseWorkspaceCreateRequest, parseWorkspaceUpdateRequest } from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const WORKSPACE_ROUTES = defineApiRoutes("workspaces", [
  { method: "GET", path: "/api/v1/workspaces", handler: handleListWorkspacesRoute },
  { method: "POST", path: "/api/v1/workspaces", handler: handleCreateWorkspaceRoute },
  { method: "GET", path: "/api/v1/workspaces/:id", handler: handleGetWorkspaceRoute },
  { method: "PUT", path: "/api/v1/workspaces/:id", handler: handleUpdateWorkspaceRoute },
  { method: "DELETE", path: "/api/v1/workspaces/:id", handler: handleDeleteWorkspaceRoute }
]);

async function handleListWorkspacesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "listWorkspaces", 200, await context.services.workspaceService.list());
}

async function handleCreateWorkspaceRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "createWorkspace",
    200,
    await context.services.workspaceService.create(parseWorkspaceCreateRequest(await readJson(context.req)))
  );
}

async function handleGetWorkspaceRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getWorkspace", 200, await context.services.workspaceService.get(requireRouteParam(context, "id")));
}

async function handleUpdateWorkspaceRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "updateWorkspace",
    200,
    await context.services.workspaceService.update(
      requireRouteParam(context, "id"),
      parseWorkspaceUpdateRequest(await readJson(context.req))
    )
  );
}

async function handleDeleteWorkspaceRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "deleteWorkspace", 200, await context.services.workspaceService.delete(requireRouteParam(context, "id")));
}

function requireRouteParam(context: ApiRouteContext, key: string): string {
  return decodeURIComponent(context.routeParams?.[key] ?? "");
}
