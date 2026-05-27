import { parseWorkflowTemplateCatalogListQuery } from "../request-parsers/index.js";
import { writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const WORKFLOW_TEMPLATE_CATALOG_ROUTES = defineApiRoutes("workflow-templates", [
  { method: "GET", path: "/api/v1/workflow-templates", handler: handleListWorkflowTemplatesRoute }
]);

async function handleListWorkflowTemplatesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listWorkflowTemplates",
    200,
    await context.services.workflowTemplateCatalogService.list(parseWorkflowTemplateCatalogListQuery(context.requestUrl))
  );
}
