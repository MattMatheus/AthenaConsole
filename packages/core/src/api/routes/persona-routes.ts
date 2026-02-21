import { parseSpecialistRunRequest } from "../request-parsers/index.js";
import { resolveTenantId, trackOperationEvent } from "../../observability/application-insights.js";
import { readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const SPECIALIST_ROUTES = defineApiRoutes("specialists", [
  { method: "GET", path: "/api/v1/specialists", handler: handleListSpecialistsRoute },
  { method: "POST", path: "/api/v1/specialists/run", handler: handleRunSpecialistRoute },
  { method: "GET", path: "/api/v1/personas", handler: handleListSpecialistsRoute },
  { method: "POST", path: "/api/v1/personas/run", handler: handleRunSpecialistRoute }
]);

export const PERSONA_ROUTES = SPECIALIST_ROUTES;

async function handleListSpecialistsRoute(context: ApiRouteContext): Promise<void> {
  const items = await context.services.specialistService.list();
  writeSuccess(context.res, "listSpecialists", 200, { items });
}

async function handleRunSpecialistRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const request = parseSpecialistRunRequest(body);
  const response = await context.services.specialistService.run(request);
  trackOperationEvent("athena.specialist.run.completed", {
    runId: response.result.runId,
    specialistId: request.name,
    personaId: request.name,
    tenantId: resolveTenantId(context.req),
    sessionId: response.result.sessionId
  });
  writeSuccess(context.res, "runSpecialist", 200, response);
}
