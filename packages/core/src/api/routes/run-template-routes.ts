import { parseCreateRunTemplateRequest, parseCursorPageQuery, parseTemplateRunRequest } from "../request-parsers/index.js";
import type { RouteParams } from "../router.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const RUN_TEMPLATE_ROUTES = defineApiRoutes("run-templates", [
  { method: "GET", path: "/api/v1/run-templates", handler: handleListRunTemplatesRoute },
  { method: "POST", path: "/api/v1/run-templates", handler: handleCreateRunTemplateRoute },
  { method: "POST", path: "/api/v1/templates/:id/run", handler: handleRunTemplateRoute }
]);

async function handleListRunTemplatesRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  writeSuccess(context.res, "listRunTemplates", 200, await context.services.runTemplateService.list(query));
}

async function handleCreateRunTemplateRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const createRequest = parseCreateRunTemplateRequest(body);
  const template = await context.services.runTemplateService.create(createRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "run-template.created",
    payload: {
      runTemplateId: template.id,
      harnessProfileId: template.harnessProfileId
    }
  });
  writeSuccess(context.res, "createRunTemplate", 200, template);
}

async function handleRunTemplateRoute(context: ApiRouteContext, params: RouteParams): Promise<void> {
  const body = await readJson(context.req);
  const runRequest = parseTemplateRunRequest(body);
  const result = await context.services.runTemplateService.run(decodeRouteParam(params, "id"), runRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "run-template.run",
    sessionId: result.sessionId,
    payload: {
      runTemplateId: result.template?.id ?? decodeRouteParam(params, "id"),
      ...(result.directiveId ? { directiveId: result.directiveId } : {}),
      ...(result.harnessProfileId ? { harnessProfileId: result.harnessProfileId } : {}),
      provider: result.provider,
      model: result.model,
      ...(result.template ? { effectiveParams: result.template.effectiveParams } : {})
    }
  });
  writeSuccess(context.res, "runTemplate", 200, result);
}

function decodeRouteParam(params: RouteParams, key: string): string {
  return decodeURIComponent(params[key] ?? "");
}
