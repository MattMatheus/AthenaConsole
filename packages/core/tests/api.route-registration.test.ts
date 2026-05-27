import { describe, expect, it } from "vitest";
import { AGENT_CATALOG_ROUTES } from "../src/api/routes/agent-catalog-routes.js";
import { MISSION_ROUTES } from "../src/api/routes/mission-routes.js";
import { TASK_ROUTES } from "../src/api/routes/task-routes.js";
import { WORKFLOW_TEMPLATE_CATALOG_ROUTES } from "../src/api/routes/workflow-template-catalog-routes.js";
import { SPECIALIST_ROUTES } from "../src/api/routes/persona-routes.js";
import { POLICY_ROUTES, SCHEDULE_ROUTES } from "../src/api/routes/policy-schedule-routes.js";
import { RUN_ROUTES, SESSION_ROUTES } from "../src/api/routes/run-routes.js";
import { DIRECTIVE_ROUTES } from "../src/api/routes/directive-routes.js";
import { HARNESS_PROFILE_ROUTES } from "../src/api/routes/harness-profile-routes.js";
import { RUN_TEMPLATE_ROUTES } from "../src/api/routes/run-template-routes.js";
import { WORKFLOW_ROUTES } from "../src/api/routes/workflow-routes.js";
import {
  composeApiRouteTable,
  createApiRoute,
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
    expect(WORKFLOW_ROUTES.some((route) => route.path === "/api/v1/workflows/run/:id")).toBe(true);
    expect(WORKFLOW_ROUTES.some((route) => route.path === "/api/v1/workflows/run/:id/resume")).toBe(true);
    expect(MEMORY_ROUTES.every((route) => route.meta.family === "memory")).toBe(true);
    expect(WORK_ROUTES.every((route) => route.meta.family === "work")).toBe(true);
    expect(SCHEDULE_ROUTES.every((route) => route.meta.family === "schedules")).toBe(true);
    expect(SCHEDULE_ROUTES.some((route) => route.path === "/api/v1/schedules/:id")).toBe(true);
    expect(POLICY_ROUTES.every((route) => route.meta.family === "fleet-events-policy")).toBe(true);
    expect(SPECIALIST_ROUTES.every((route) => route.meta.family === "specialists")).toBe(true);
    expect(AGENT_CATALOG_ROUTES.every((route) => route.meta.family === "agent-catalog")).toBe(true);
    expect(WORKFLOW_TEMPLATE_CATALOG_ROUTES.every((route) => route.meta.family === "workflow-templates")).toBe(true);
    expect(WORKFLOW_TEMPLATE_CATALOG_ROUTES.some((route) => route.path === "/api/v1/workflow-templates/:id/instantiate")).toBe(true);
    expect(MISSION_ROUTES.every((route) => route.meta.family === "missions")).toBe(true);
    expect(MISSION_ROUTES.some((route) => route.path === "/api/v1/missions/:id/run")).toBe(true);
    expect(MISSION_ROUTES.some((route) => route.path === "/api/v1/mission-runs/:runId")).toBe(true);
    expect(TASK_ROUTES.every((route) => route.meta.family === "tasks")).toBe(true);
  });

  it("composes a unified route table from route collection exports", () => {
    const coreRoutes = defineApiRoutes("core", [
      { method: "GET", path: "/api/v1/capabilities", handler() {} }
    ]);
    const a2aRoutes = [
      createApiRoute("a2a", { method: "GET", path: "/api/v1/a2a/dlq", handler() {} })
    ];

    const table = composeApiRouteTable(
      coreRoutes,
      AGENT_CATALOG_ROUTES,
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
      WORK_ROUTES,
      SCHEDULE_ROUTES,
      POLICY_ROUTES,
      SPECIALIST_ROUTES,
      a2aRoutes
    );

    validateApiRouteTable(table);
    expect(table.length).toBeGreaterThan(0);
    expect(table.some((route) => route.path === "/api/v1/runs" && route.meta.family === "runs")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/workflow-templates" && route.meta.family === "workflow-templates")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/workflow-templates/:id/instantiate" && route.meta.family === "workflow-templates")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/missions" && route.meta.family === "missions")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/missions/:id/run" && route.meta.family === "missions")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/tasks" && route.meta.family === "tasks")).toBe(true);
    expect(table.some((route) => route.path === "/api/v1/memory/search" && route.meta.family === "memory")).toBe(
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
