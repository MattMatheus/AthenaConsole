import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { withRequestAuthContext } from "../control-plane/auth.js";
import { AthenaError } from "../runtime/errors.js";
import type { AthenaConfig } from "../shared/config.js";
import { createLocalControlPlaneServices, type ControlPlaneServices } from "../control-plane/services.js";
import { mapErrorToHttp } from "../control-plane/api-contracts.js";
import {
  flushApplicationInsights,
  initializeApplicationInsights,
  resolvePersonaId,
  resolveRunId,
  resolveTenantId,
  trackOperationEvent
} from "../observability/application-insights.js";
import { APIRouter } from "./router.js";
import { createIdentityExtractionMiddleware } from "./middleware/auth.js";
import { writeError } from "./route-helpers.js";
import { A2A_ROUTES } from "./routes/a2a-routes.js";
import { AGENT_CATALOG_ROUTES } from "./routes/agent-catalog-routes.js";
import { MISSION_ROUTES } from "./routes/mission-routes.js";
import { TASK_ROUTES } from "./routes/task-routes.js";
import { CORE_ROUTES } from "./routes/core-routes.js";
import { FLEET_EVENTS_ROUTES } from "./routes/fleet-events-routes.js";
import { PERSONA_ROUTES } from "./routes/persona-routes.js";
import { POLICY_ROUTES, SCHEDULE_ROUTES } from "./routes/policy-schedule-routes.js";
import { RUN_ROUTES, SESSION_ROUTES } from "./routes/run-routes.js";
import { RBAC_ROUTES } from "./routes/identity-rbac-routes.js";
import { DIRECTIVE_ROUTES } from "./routes/directive-routes.js";
import { HARNESS_PROFILE_ROUTES } from "./routes/harness-profile-routes.js";
import { RUN_TEMPLATE_ROUTES } from "./routes/run-template-routes.js";
import { WORKFLOW_TEMPLATE_CATALOG_ROUTES } from "./routes/workflow-template-catalog-routes.js";
import { WORKFLOW_ROUTES } from "./routes/workflow-routes.js";
import { MEMORY_ROUTES, WORK_ROUTES } from "./routes/work-memory-routes.js";
import {
  composeApiRouteTable,
  type ApiRouteContext as RouteContext,
  type ApiRouteFamily,
  validateApiRouteTable
} from "./routes/route-registration.js";
export interface ApiServerOptions {
  config: AthenaConfig;
  services?: ControlPlaneServices;
  host?: string;
  port?: number;
}

export interface ApiServerHandle {
  start(): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}

const API_V1_ROUTE_TABLE = composeApiRouteTable(
  CORE_ROUTES,
  AGENT_CATALOG_ROUTES,
  MISSION_ROUTES,
  TASK_ROUTES,
  RUN_ROUTES,
  SESSION_ROUTES,
  DIRECTIVE_ROUTES,
  HARNESS_PROFILE_ROUTES,
  RUN_TEMPLATE_ROUTES,
  WORKFLOW_TEMPLATE_CATALOG_ROUTES,
  WORKFLOW_ROUTES,
  MEMORY_ROUTES,
  WORK_ROUTES,
  SCHEDULE_ROUTES,
  FLEET_EVENTS_ROUTES,
  POLICY_ROUTES,
  RBAC_ROUTES,
  PERSONA_ROUTES,
  A2A_ROUTES
);
validateApiRouteTable(API_V1_ROUTE_TABLE);

const API_V1_ROUTER = new APIRouter(API_V1_ROUTE_TABLE);

export function resolveApiRouteFamily(method: string, path: string): ApiRouteFamily | undefined {
  return API_V1_ROUTER.findMatch(method, path)?.route.meta?.family;
}

export function createApiServer(options: ApiServerOptions): ApiServerHandle {
  initializeApplicationInsights(options.config);
  const services = options.services ?? createLocalControlPlaneServices({ config: options.config });
  const authMiddleware = createIdentityExtractionMiddleware(options.config);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const server = createServer(async (req, res) => {
    const traceId = randomUUID();
    res.setHeader("x-trace-id", traceId);
    const incomingTraceParent = normalizeHeader(req.headers.traceparent);
    const incomingTraceState = normalizeHeader(req.headers.tracestate);
    if (incomingTraceParent) {
      res.setHeader("traceparent", incomingTraceParent);
    }
    if (incomingTraceState) {
      res.setHeader("tracestate", incomingTraceState);
    }

    // CORS Handling
    const origin = req.headers.origin;
    const allowedOrigins = options.config.allowedOrigins ?? ["*"];
    if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, x-athena-identity, x-athena-tenant-id, x-trace-id, traceparent, tracestate"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const startedAt = Date.now();
    const method = req.method ?? "GET";
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const path = requestUrl.pathname;
    let routeFamily: ApiRouteFamily | undefined;
    let routeParams: Record<string, string> = {};
    try {
      const auth = authMiddleware.extract(req);
      const match = API_V1_ROUTER.findMatch(method, path);
      routeFamily = match?.route.meta?.family;
      routeParams = match?.params ?? {};
      const context: RouteContext = {
        req,
        res,
        services,
        ...(auth ? { auth } : {}),
        traceId,
        method,
        requestUrl,
        path,
        routeParams
      };
      const handled = match
        ? auth
          ? await withRequestAuthContext(auth, async () => {
              await match.route.handler(context, match.params);
              return true;
            })
          : await (async () => {
              await match.route.handler(context, match.params);
              return true;
            })()
        : false;

      if (!handled) {
        writeError(res, 404, { code: "UNKNOWN_ERROR", error: "Not found", traceId });
      }
      trackOperationEvent(
        "athena.api.request",
        {
          traceId,
          method,
          path,
          routeFamily,
          statusCode: String(res.statusCode),
          runId: resolveRunId(routeParams, requestUrl),
          personaId: resolvePersonaId(routeParams, requestUrl),
          tenantId: resolveTenantId(req)
        },
        {
          durationMs: Date.now() - startedAt
        }
      );
    } catch (error) {
      const mapped = mapErrorToHttp(error, traceId);
      writeError(res, mapped.status, mapped.body.error);
      trackOperationEvent(
        "athena.api.request",
        {
          traceId,
          method,
          path,
          routeFamily,
          statusCode: String(mapped.status),
          runId: resolveRunId(routeParams, requestUrl),
          personaId: resolvePersonaId(routeParams, requestUrl),
          tenantId: resolveTenantId(req),
          errorCode: mapped.body.error.code
        },
        {
          durationMs: Date.now() - startedAt
        }
      );
    }
  });

  return {
    async start() {
      assertApiBindAuthPosture(host, options.config);
      await listen(server, host, port);
      await emitAuthzModeStartupEvent(services, options.config);
      await emitStateStoreDiagnosticsStartupEvent(services);
      const address = server.address();
      if (!address || typeof address === "string") {
        return { host, port };
      }
      return { host: address.address, port: address.port };
    },
    async stop() {
      await close(server);
      await flushApplicationInsights();
      if (services.shutdown) {
        await services.shutdown();
      }
    }
  };
}

function assertApiBindAuthPosture(host: string, config: AthenaConfig): void {
  if (!isExternallyReachableHost(host)) {
    return;
  }
  if (config.auth?.enabled && config.auth.apiToken) {
    return;
  }
  if (config.auth?.allowExternalUnauthenticated) {
    return;
  }
  throw new AthenaError(
    "CONFIG_ERROR",
    "Refusing to start externally bound API without server-side API token auth. " +
      "Enable ATHENA_AUTH_ENABLED=true with ATHENA_AUTH_API_TOKEN, or set " +
      "ATHENA_ALLOW_EXTERNAL_UNAUTHENTICATED=true for explicit local development only."
  );
}

function isExternallyReachableHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "0.0.0.0" || normalized === "::" || normalized === "" || normalized === "*";
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function emitAuthzModeStartupEvent(services: ControlPlaneServices, config: AthenaConfig): Promise<void> {
  try {
    await services.eventService.emit({
      type: "AUTHZ_MODE_ACTIVE",
      payload: {
        mode: resolveActiveAuthzMode(config)
      }
    });
  } catch {
    // Startup telemetry must not block API availability.
  }
}

async function emitStateStoreDiagnosticsStartupEvent(services: ControlPlaneServices): Promise<void> {
  try {
    await services.eventService.emit({
      type: "STATE_STORES_ACTIVE",
      payload: services.stateDiagnosticsService.getDiagnostics()
    });
  } catch {
    // Startup diagnostics must not block API availability.
  }
}

function resolveActiveAuthzMode(config: AthenaConfig): string {
  if (!config.auth?.enabled) {
    return "off";
  }
  return config.authz?.mode ?? "off";
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => entry.trim().length > 0);
    return first?.trim();
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
