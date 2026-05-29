import {
  parseConnectedRepositoryCreateRequest,
  parseConnectedRepositoryInspectPathRequest
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const REPOSITORY_ROUTES = defineApiRoutes("repositories", [
  { method: "GET", path: "/api/v1/repositories", handler: handleListRepositoriesRoute },
  { method: "POST", path: "/api/v1/repositories", handler: handleCreateRepositoryRoute },
  { method: "POST", path: "/api/v1/repositories/inspect", handler: handleInspectRepositoryPathRoute },
  { method: "GET", path: "/api/v1/repositories/:id", handler: handleGetRepositoryRoute },
  { method: "DELETE", path: "/api/v1/repositories/:id", handler: handleDeleteRepositoryRoute },
  { method: "POST", path: "/api/v1/repositories/:id/inspect", handler: handleInspectRepositoryRoute }
]);

async function handleListRepositoriesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "listRepositories", 200, await context.services.connectedRepositoryService.list());
}

async function handleCreateRepositoryRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "createRepository",
    200,
    await context.services.connectedRepositoryService.create(parseConnectedRepositoryCreateRequest(body))
  );
}

async function handleInspectRepositoryPathRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const request = parseConnectedRepositoryInspectPathRequest(body);
  writeSuccess(
    context.res,
    "inspectRepositoryPath",
    200,
    await context.services.connectedRepositoryService.inspectPath(request.workspacePath)
  );
}

async function handleGetRepositoryRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getRepository",
    200,
    await context.services.connectedRepositoryService.get(requireRouteParam(context, "id"))
  );
}

async function handleDeleteRepositoryRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "deleteRepository",
    200,
    await context.services.connectedRepositoryService.delete(requireRouteParam(context, "id"))
  );
}

async function handleInspectRepositoryRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "inspectRepository",
    200,
    await context.services.connectedRepositoryService.inspect(requireRouteParam(context, "id"))
  );
}

function requireRouteParam(context: ApiRouteContext, key: string): string {
  return decodeURIComponent(context.routeParams?.[key] ?? "");
}
