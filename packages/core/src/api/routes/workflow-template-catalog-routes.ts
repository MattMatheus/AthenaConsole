import { parseWorkflowTemplateCatalogListQuery, parseWorkflowTemplateInstantiateRequest } from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const WORKFLOW_TEMPLATE_CATALOG_ROUTES = defineApiRoutes("workflow-templates", [
  { method: "GET", path: "/api/v1/workflow-templates", handler: handleListWorkflowTemplatesRoute },
  { method: "POST", path: "/api/v1/workflow-templates/:id/instantiate", handler: handleInstantiateWorkflowTemplateRoute }
]);

async function handleListWorkflowTemplatesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listWorkflowTemplates",
    200,
    await context.services.workflowTemplateCatalogService.list(parseWorkflowTemplateCatalogListQuery(context.requestUrl))
  );
}

async function handleInstantiateWorkflowTemplateRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  writeSuccess(
    context.res,
    "instantiateWorkflowTemplate",
    200,
    await context.services.workflowTemplateCatalogService.instantiate(decodeRouteParam(params, "id"), parseWorkflowTemplateInstantiateRequest(body))
  );
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
