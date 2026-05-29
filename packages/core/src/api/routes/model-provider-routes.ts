import {
  parseModelProviderConfigCreateRequest,
  parseModelProviderConfigUpdateRequest
} from "../request-parsers/index.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const MODEL_PROVIDER_ROUTES = defineApiRoutes("model-providers", [
  { method: "GET", path: "/api/v1/model-providers", handler: handleListModelProvidersRoute },
  { method: "POST", path: "/api/v1/model-providers", handler: handleCreateModelProviderRoute },
  { method: "GET", path: "/api/v1/model-providers/:id", handler: handleGetModelProviderRoute },
  { method: "PUT", path: "/api/v1/model-providers/:id", handler: handleUpdateModelProviderRoute },
  { method: "DELETE", path: "/api/v1/model-providers/:id", handler: handleDeleteModelProviderRoute },
  { method: "POST", path: "/api/v1/model-providers/:id/test", handler: handleTestModelProviderRoute }
]);

async function handleListModelProvidersRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "listModelProviders", 200, await context.services.modelProviderConfigService.list());
}

async function handleCreateModelProviderRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "createModelProvider",
    200,
    await context.services.modelProviderConfigService.create(parseModelProviderConfigCreateRequest(await readJson(context.req)))
  );
}

async function handleGetModelProviderRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "getModelProvider",
    200,
    await context.services.modelProviderConfigService.get(requireRouteParam(context, "id"))
  );
}

async function handleUpdateModelProviderRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "updateModelProvider",
    200,
    await context.services.modelProviderConfigService.update(
      requireRouteParam(context, "id"),
      parseModelProviderConfigUpdateRequest(await readJson(context.req))
    )
  );
}

async function handleDeleteModelProviderRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "deleteModelProvider",
    200,
    await context.services.modelProviderConfigService.delete(requireRouteParam(context, "id"))
  );
}

async function handleTestModelProviderRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "testModelProvider",
    200,
    await context.services.modelProviderConfigService.test(requireRouteParam(context, "id"))
  );
}

function requireRouteParam(context: ApiRouteContext, key: string): string {
  return decodeURIComponent(context.routeParams?.[key] ?? "");
}
