import { writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const CORE_ROUTES = defineApiRoutes("core", [
  { method: "GET", path: "/api/v1/capabilities", handler: handleGetCapabilitiesRoute },
  { method: "GET", path: "/api/v1/admin/health", handler: handleGetAdminHealthRoute }
]);

async function handleGetCapabilitiesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getCapabilities", 200, await context.services.capabilityService.getCapabilities());
}

async function handleGetAdminHealthRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getAdminHealth", 200, {
    status: "ok",
    now: new Date().toISOString()
  });
}
