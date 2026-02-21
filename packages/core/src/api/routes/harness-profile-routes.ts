import { parseCreateHarnessProfileRequest, parseCursorPageQuery } from "../request-parsers/index.js";
import { emitEventBestEffort, readJson, writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const HARNESS_PROFILE_ROUTES = defineApiRoutes("harness-profiles", [
  { method: "GET", path: "/api/v1/harness-profiles", handler: handleListHarnessProfilesRoute },
  { method: "POST", path: "/api/v1/harness-profiles", handler: handleCreateHarnessProfileRoute }
]);

async function handleListHarnessProfilesRoute(context: ApiRouteContext): Promise<void> {
  const query = parseCursorPageQuery(context.requestUrl);
  writeSuccess(context.res, "listHarnessProfiles", 200, await context.services.harnessProfileService.list(query));
}

async function handleCreateHarnessProfileRoute(context: ApiRouteContext): Promise<void> {
  const body = await readJson(context.req);
  const createRequest = parseCreateHarnessProfileRequest(body);
  const profile = await context.services.harnessProfileService.create(createRequest);
  await emitEventBestEffort(context.services, {
    traceId: context.traceId,
    type: "harness-profile.created",
    payload: {
      harnessProfileId: profile.id,
      version: profile.version,
      provider: profile.config.provider,
      model: profile.config.model
    }
  });
  writeSuccess(context.res, "createHarnessProfile", 200, profile);
}
