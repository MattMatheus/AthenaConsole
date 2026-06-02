import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestAuthContext } from "../../control-plane/auth.js";
import type { ControlPlaneServices } from "../../control-plane/services.js";
import type { HttpMethod, RouteDefinition } from "../router.js";

export type ApiRouteFamily =
  | "agent-catalog"
  | "repositories"
  | "model-providers"
  | "tasks"
  | "missions"
  | "core"
  | "runs"
  | "sessions"
  | "directives"
  | "harness-profiles"
  | "run-templates"
  | "workflows"
  | "workflow-templates"
  | "memory"
  | "durable-memory"
  | "work"
  | "failed-work"
  | "schedules"
  | "operations-events-policy"
  | "identity-rbac";

export interface ApiRouteMeta {
  family: ApiRouteFamily;
}

export interface ApiRouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  services: ControlPlaneServices;
  auth?: RequestAuthContext;
  traceId: string;
  method: string;
  requestUrl: URL;
  path: string;
  routeParams?: Record<string, string>;
}

export interface ApiRouteDefinition extends RouteDefinition<ApiRouteContext, ApiRouteMeta> {
  meta: ApiRouteMeta;
}
export type ApiRouteTable = ReadonlyArray<ApiRouteDefinition>;

type ApiRouteInput = Omit<RouteDefinition<ApiRouteContext>, "meta">;

export function defineApiRoutes(
  family: ApiRouteFamily,
  routes: ReadonlyArray<ApiRouteInput>
): ReadonlyArray<ApiRouteDefinition> {
  return routes.map((route) => ({
    ...route,
    meta: { family }
  }));
}

export function composeApiRouteTable(
  ...collections: ReadonlyArray<ReadonlyArray<ApiRouteDefinition>>
): ApiRouteTable {
  const table: ApiRouteDefinition[] = [];
  const seen = new Set<string>();
  for (const collection of collections) {
    for (const route of collection) {
      const key = `${route.method} ${route.path}`;
      if (seen.has(key)) {
        throw new Error(`Duplicate API route registration: ${key}`);
      }
      seen.add(key);
      table.push(route);
    }
  }
  return table;
}

export function createApiRoute(
  family: ApiRouteFamily,
  route: ApiRouteInput
): ApiRouteDefinition {
  return {
    ...route,
    meta: { family }
  };
}

export function isHttpMethod(value: string): value is HttpMethod {
  return value === "GET" || value === "POST" || value === "PUT" || value === "DELETE";
}

export function validateApiRouteTable(table: ApiRouteTable): void {
  const seen = new Set<string>();
  for (const route of table) {
    if (!isHttpMethod(route.method)) {
      throw new Error(`Invalid API route method: ${route.method}`);
    }
    if (!route.path.startsWith("/")) {
      throw new Error(`Invalid API route path: ${route.path}`);
    }
    const family = (route as { meta?: { family?: string } }).meta?.family;
    if (typeof family !== "string" || family.length === 0) {
      throw new Error(`Missing API route family metadata for route: ${route.method} ${route.path}`);
    }
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate API route registration: ${key}`);
    }
    seen.add(key);
  }
}
