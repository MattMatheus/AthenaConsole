import { writeSuccess } from "../route-helpers.js";
import { defineApiRoutes, type ApiRouteContext } from "./route-registration.js";

export const AGENT_CATALOG_ROUTES = defineApiRoutes("agent-catalog", [
  { method: "GET", path: "/api/v1/agent-catalog/plugins", handler: handleListAgentCatalogPluginsRoute },
  { method: "GET", path: "/api/v1/agent-catalog/agents", handler: handleListAgentCatalogAgentsRoute },
  { method: "GET", path: "/api/v1/agent-catalog/connectors/readiness", handler: handleListConnectorReadinessRoute }
]);

async function handleListAgentCatalogPluginsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listAgentCatalogPlugins",
    200,
    await context.services.agentCatalogService.listPlugins()
  );
}

async function handleListAgentCatalogAgentsRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listAgentCatalogAgents",
    200,
    await context.services.agentCatalogService.listAgents({
      capabilities: [
        ...context.requestUrl.searchParams.getAll("capability"),
        ...(context.requestUrl.searchParams.get("capabilities")?.split(",") ?? [])
      ]
    })
  );
}

async function handleListConnectorReadinessRoute(context: ApiRouteContext): Promise<void> {
  writeSuccess(
    context.res,
    "listAgentCatalogConnectorReadiness",
    200,
    await context.services.agentCatalogService.listConnectorReadiness()
  );
}
