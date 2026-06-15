import { describe, expect, it } from "vitest";
import { AGENT_CATALOG_ROUTES } from "../src/api/routes/agent-catalog-routes.js";
import { MISSION_ROUTES } from "../src/api/routes/mission-routes.js";
import { TASK_ROUTES } from "../src/api/routes/task-routes.js";
import { WORKFLOW_TEMPLATE_CATALOG_ROUTES } from "../src/api/routes/workflow-template-catalog-routes.js";
import { MODEL_PROVIDER_ROUTES } from "../src/api/routes/model-provider-routes.js";
import { POLICY_ROUTES, SCHEDULE_ROUTES } from "../src/api/routes/policy-schedule-routes.js";
import { RUN_ROUTES, SESSION_ROUTES } from "../src/api/routes/run-routes.js";
import { DIRECTIVE_ROUTES } from "../src/api/routes/directive-routes.js";
import { DURABLE_MEMORY_ROUTES } from "../src/api/routes/durable-memory-routes.js";
import { HARNESS_PROFILE_ROUTES } from "../src/api/routes/harness-profile-routes.js";
import { RUN_TEMPLATE_ROUTES } from "../src/api/routes/run-template-routes.js";
import { WORKFLOW_ROUTES } from "../src/api/routes/workflow-routes.js";
import { FAILED_WORK_ROUTES } from "../src/api/routes/failed-work-routes.js";
import { OPERATIONS_EVENTS_ROUTES } from "../src/api/routes/operations-events-routes.js";
import { WORKSPACE_ROUTES } from "../src/api/routes/workspace-routes.js";
import {
  composeApiRouteTable,
  defineApiRoutes,
  validateApiRouteTable,
  type ApiRouteTable
} from "../src/api/routes/route-registration.js";
import { MEMORY_ROUTES, WORK_ROUTES } from "../src/api/routes/work-memory-routes.js";

describe("api route registration", () => {
  it("exports module route collections with shared family metadata", () => {
    expect(RUN_ROUTES.every((route) => route.meta.family === "runs")).toBe(true);
    expect(SESSION_ROUTES.every((route) => route.meta.family === "sessions")).toBe(true);
    expect(DIRECTIVE_ROUTES.every((route) => route.meta.family === "directives")).toBe(true);
    expect(HARNESS_PROFILE_ROUTES.every((route) => route.meta.family === "harness-profiles")).toBe(true);
    expect(RUN_TEMPLATE_ROUTES.every((route) => route.meta.family === "run-templates")).toBe(true);
    expect(WORKFLOW_ROUTES.every((route) => route.meta.family === "workflows")).toBe(true);
    expect(WORKFLOW_ROUTES.map((route) => route.path)).toEqual([
      "/api/v1/workflow-queue/status",
      "/api/v1/workflow-runs/:runId/status",
      "/api/v1/workflow-runs/:runId/execute"
    ]);
    expect(MEMORY_ROUTES.every((route) => route.meta.family === "memory")).toBe(true);
    expect(WORK_ROUTES.every((route) => route.meta.family === "work")).toBe(true);
    expect(MEMORY_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /api/v1/memory/search",
      "POST /api/v1/memory/get"
    ]);
    expect(DURABLE_MEMORY_ROUTES.every((route) => route.meta.family === "durable-memory")).toBe(true);
    expect(DURABLE_MEMORY_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /api/v1/durable-memory/health",
      "POST /api/v1/durable-memory/records",
      "POST /api/v1/durable-memory/records/get",
      "POST /api/v1/durable-memory/records/list",
      "POST /api/v1/durable-memory/records/search",
      "POST /api/v1/durable-memory/records/:id/archive",
      "POST /api/v1/durable-memory/records/:id/delete",
      "POST /api/v1/durable-memory/proposals",
      "POST /api/v1/durable-memory/proposals/list",
      "POST /api/v1/durable-memory/proposals/:id/approve",
      "POST /api/v1/durable-memory/proposals/:id/reject",
      "POST /api/v1/durable-memory/proposals/:id/archive",
      "POST /api/v1/durable-memory/snapshots",
      "POST /api/v1/durable-memory/snapshots/list",
      "POST /api/v1/durable-memory/snapshots/:id/restore"
    ]);
    expect(WORK_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      "POST /api/v1/work/enqueue",
      "POST /api/v1/work/:sessionId/drain",
      "GET /api/v1/work/observability",
      "GET /api/v1/work/observability/alerts",
      "GET /api/v1/work/observability/alerts/export.csv",
      "GET /api/v1/work/flows/:traceId"
    ]);
    expect(FAILED_WORK_ROUTES.every((route) => route.meta.family === "failed-work")).toBe(true);
    expect(FAILED_WORK_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /api/v1/failed-work",
      "POST /api/v1/failed-work/:id/retry",
      "POST /api/v1/failed-work/:id/discard"
    ]);
    expect(SCHEDULE_ROUTES.every((route) => route.meta.family === "schedules")).toBe(true);
    expect(SCHEDULE_ROUTES.some((route) => route.path === "/api/v1/schedules/:id")).toBe(true);
    expect(POLICY_ROUTES.every((route) => route.meta.family === "operations-events-policy")).toBe(true);
    expect(OPERATIONS_EVENTS_ROUTES.every((route) => route.meta.family === "operations-events-policy")).toBe(true);
    expect(OPERATIONS_EVENTS_ROUTES.some((route) => route.path === "/api/v1/operations/summary")).toBe(true);
    expect(AGENT_CATALOG_ROUTES.every((route) => route.meta.family === "agent-catalog")).toBe(true);
    expect(MODEL_PROVIDER_ROUTES.every((route) => route.meta.family === "model-providers")).toBe(true);
    expect(MODEL_PROVIDER_ROUTES.some((route) => route.path === "/api/v1/model-providers/:id/test")).toBe(true);
    expect(WORKFLOW_TEMPLATE_CATALOG_ROUTES.every((route) => route.meta.family === "workflow-templates")).toBe(true);
    expect(WORKFLOW_TEMPLATE_CATALOG_ROUTES.some((route) => route.path === "/api/v1/workflow-templates/:id/instantiate")).toBe(true);
    expect(MISSION_ROUTES.every((route) => route.meta.family === "missions")).toBe(true);
    expect(MISSION_ROUTES.some((route) => route.path === "/api/v1/missions/:id/run")).toBe(true);
    expect(MISSION_ROUTES.some((route) => route.path === "/api/v1/missions/:id/runs")).toBe(true);
    expect(MISSION_ROUTES.some((route) => route.path === "/api/v1/mission-runs/:runId")).toBe(true);
    expect(TASK_ROUTES.every((route) => route.meta.family === "tasks")).toBe(true);
    expect(WORKSPACE_ROUTES.every((route) => route.meta.family === "workspaces")).toBe(true);
    expect(WORKSPACE_ROUTES.map((route) => `${route.method} ${route.path}`)).toEqual([
      "GET /api/v1/workspaces",
      "POST /api/v1/workspaces",
      "GET /api/v1/workspaces/:id",
      "PUT /api/v1/workspaces/:id",
      "DELETE /api/v1/workspaces/:id"
    ]);
  });

  it("composes a unified route table from route collection exports", () => {
    const coreRoutes = defineApiRoutes("core", [
      { method: "GET", path: "/api/v1/capabilities", handler() {} }
    ]);
    const table = composeApiRouteTable(
      coreRoutes,
      AGENT_CATALOG_ROUTES,
      MODEL_PROVIDER_ROUTES,
      WORKFLOW_TEMPLATE_CATALOG_ROUTES,
      MISSION_ROUTES,
      TASK_ROUTES,
      RUN_ROUTES,
      SESSION_ROUTES,
      DIRECTIVE_ROUTES,
      HARNESS_PROFILE_ROUTES,
      RUN_TEMPLATE_ROUTES,
      WORKFLOW_ROUTES,
      MEMORY_ROUTES,
      DURABLE_MEMORY_ROUTES,
      WORK_ROUTES,
      FAILED_WORK_ROUTES,
      SCHEDULE_ROUTES,
      OPERATIONS_EVENTS_ROUTES,
      POLICY_ROUTES,
      WORKSPACE_ROUTES
    );

    validateApiRouteTable(table);
    expect(table.length).toBeGreaterThan(0);
    expect(table.some((route) => route.path === "/api/v1/runs" && route.meta.family === "runs")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/model-providers" && route.meta.family === "model-providers")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/workflow-templates" && route.meta.family === "workflow-templates")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/workflow-templates/:id/instantiate" && route.meta.family === "workflow-templates")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/missions" && route.meta.family === "missions")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/missions/:id/run" && route.meta.family === "missions")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/missions/:id/runs" && route.meta.family === "missions")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/tasks" && route.meta.family === "tasks")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/workspaces" && route.meta.family === "workspaces")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/memory/search" && route.meta.family === "memory")).toBe(
      true
    );
    expect(
      table.some((route) => route.path === "/api/v1/durable-memory/records" && route.meta.family === "durable-memory")
    ).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/failed-work" && route.meta.family === "failed-work")).toBe(
      true
    );
  });

  it("fails fast on duplicate method+path registrations", () => {
    expect(() =>
      composeApiRouteTable(
        defineApiRoutes("core", [{ method: "GET", path: "/api/v1/capabilities", handler() {} }]),
        defineApiRoutes("runs", [{ method: "GET", path: "/api/v1/capabilities", handler() {} }])
      )
    ).toThrow("Duplicate API route registration: GET /api/v1/capabilities");
  });

  it("rejects malformed route metadata in validation", () => {
    const invalid = [
      { method: "GET", path: "/api/v1/example", handler() {} }
    ] as unknown as ApiRouteTable;
    expect(() => validateApiRouteTable(invalid)).toThrow("Missing API route family metadata");
  });

  it("rejects invalid route method and path in validation", () => {
    const invalidMethod = [
      {
        method: "PATCH",
        path: "/api/v1/example",
        handler() {},
        meta: { family: "core" }
      }
    ] as unknown as ApiRouteTable;
    expect(() => validateApiRouteTable(invalidMethod)).toThrow("Invalid API route method: PATCH");

    const invalidPath = [
      {
        method: "GET",
        path: "api/v1/example",
        handler() {},
        meta: { family: "core" }
      }
    ] as unknown as ApiRouteTable;
    expect(() => validateApiRouteTable(invalidPath)).toThrow("Invalid API route path: api/v1/example");
  });
});
