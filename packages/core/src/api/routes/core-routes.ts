import { writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const CORE_ROUTES = defineApiRoutes("core", [
  { method: "GET", path: "/api/v1/capabilities", handler: handleGetCapabilitiesRoute },
  { method: "GET", path: "/api/v1/health", handler: handleGetHealthRoute },
  { method: "GET", path: "/api/v1/readiness", handler: handleGetReadinessRoute },
  { method: "GET", path: "/api/v1/admin/health", handler: handleGetAdminHealthRoute }
]);

async function handleGetCapabilitiesRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getCapabilities", 200, await context.services.capabilityService.getCapabilities());
}

async function handleGetAdminHealthRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getAdminHealth", 200, {
    ...buildHealthResponse(),
    stateStores: context.services.stateDiagnosticsService.getDiagnostics()
  });
}

async function handleGetHealthRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getHealth", 200, buildHealthResponse());
}

async function handleGetReadinessRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(context.res, "getReadiness", 200, await context.services.readinessService.getReadiness());
}

function buildHealthResponse() {
  return {
    status: "ok",
    now: new Date().toISOString()
  };
}
