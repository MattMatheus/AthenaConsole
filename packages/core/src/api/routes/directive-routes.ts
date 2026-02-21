import { parseCreateDirectiveRequest, parseCursorPageQuery } from "../request-parsers/index.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const DIRECTIVE_ROUTES = defineApiRoutes("directives", [
  { method: "GET", path: "/api/v1/directives", handler: handleListDirectivesRoute },
  { method: "POST", path: "/api/v1/directives", handler: handleCreateDirectiveRoute }
]);

async function handleListDirectivesRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  writeSuccess(context.res, "listDirectives", 200, await context.services.directiveService.list(query));
}

async function handleCreateDirectiveRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const createRequest = parseCreateDirectiveRequest(body);
  const directive = await context.services.directiveService.create(createRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "directive.created",
    payload: {
      directiveId: directive.id,
      hasContextRefs: Array.isArray(directive.contextRefs) && directive.contextRefs.length > 0,
      hasMetadata: directive.metadata !== undefined
    }
  });
  writeSuccess(context.res, "createDirective", 200, directive);
}
