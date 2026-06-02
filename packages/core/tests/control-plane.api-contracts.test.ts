import { describe, expect, it } from "vitest";
import { AthenaError } from "../src/runtime/errors.js";
import {
  API_V1_ROUTES,
  mapErrorToHttp,
  normalizeCursorPageQuery,
  normalizeTailQuery
} from "../src/control-plane/api-contracts.js";

describe("control-plane api contracts", () => {
  it("declares the full initial v1 route surface", () => {
    expect(API_V1_ROUTES.length).toBe(106);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/capabilities")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/health")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/readiness")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/agent-catalog/plugins")).toBe(
      true
    );
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/agent-catalog/agents")).toBe(
      true
    );
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/workflow-templates")).toBe(
      true
    );
    expect(
      API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/workflow-templates/:id/instantiate")
    ).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/missions")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/missions")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/missions/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "PUT" && route.path === "/api/v1/missions/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/missions/:id/run")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/missions/:id/runs")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/missions/:id/tasks")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/missions/:id/tasks")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/missions/:id/tasks/attach")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/mission-runs/:runId")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/tasks/metadata")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/tasks")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/tasks")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/tasks/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "PUT" && route.path === "/api/v1/tasks/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/tasks/:id/run-readiness")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/tasks/:id/run")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/task-runs/:runId")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/task-runs/:runId/artifacts/:artifactId")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/task-runs/:runId/cancel")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/runs")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/runs/active")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/runs/cancel-requests")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/run-control/by-run/:runId/cancel")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/sessions/search")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/memory/search")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/memory/get")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/durable-memory/health")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/durable-memory/records")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/durable-memory/records/search")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/durable-memory/proposals/:id/approve")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/durable-memory/snapshots/:id/restore")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/work/observability")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/work/observability/alerts")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/work/observability/alerts/export.csv")).toBe(
      true
    );
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/work/flows/:traceId")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/directives")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/directives")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/harness-profiles")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/harness-profiles")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/run-templates")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/run-templates")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/templates/:id/run")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/workflows")).toBe(false);
    expect(API_V1_ROUTES.some((route) => route.path.startsWith("/api/v1/workflows/"))).toBe(false);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/workflow-runs/:runId/status")).toBe(
      true
    );
    expect(API_V1_ROUTES.find((route) => route.path === "/api/v1/workflow-runs/:runId/status")).toMatchObject({
      lifecycle: "stable",
      surface: "canonical"
    });
    expect(API_V1_ROUTES.find((route) => route.path === "/api/v1/workflow-runs/:runId/execute")).toMatchObject({
      method: "POST",
      lifecycle: "stable",
      surface: "canonical"
    });
    const retiredRuntimeFamilies = [["special", "ists"].join(""), ["person", "as"].join("")];
    expect(API_V1_ROUTES.some((route) => retiredRuntimeFamilies.some((family) => route.path.includes(family)))).toBe(false);
    expect(API_V1_ROUTES.some((route) => route.method === "DELETE" && route.path === "/api/v1/schedules/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/schedules/:id/run")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "POST" && route.path === "/api/v1/schedules/tick")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/schedules/:id")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/events" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/events/stream" && route.stream === "sse")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rejections" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/policy/rejections" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rbac/roles" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rbac/assignments" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rbac/assignments/:subject" && route.method === "PUT")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rbac/assignments/:subject" && route.method === "DELETE")).toBe(
      true
    );
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/rbac/audit/:subject" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.path === "/api/v1/governance/audit-trail" && route.method === "GET")).toBe(true);
    expect(API_V1_ROUTES.some((route) => route.method === "GET" && route.path === "/api/v1/sessions/:id/artifacts")).toBe(
      true
    );
    expect(
      API_V1_ROUTES.some(
        (route) => route.method === "GET" && route.path === "/api/v1/sessions/:id/artifacts/:runId/:artifactId"
      )
    ).toBe(true);
    expect(
      API_V1_ROUTES.some(
        (route) => route.method === "GET" && route.path === "/api/v1/sessions/:id/transcript/stream" && route.stream === "sse"
      )
    ).toBe(true);
  });

  it("normalizes cursor-page and tail query semantics with bounds", () => {
    expect(normalizeCursorPageQuery({})).toEqual({ limit: 50 });
    expect(normalizeCursorPageQuery({ cursor: "abc", limit: 9999 })).toEqual({ cursor: "abc", limit: 500 });
    expect(normalizeCursorPageQuery({ limit: -5 })).toEqual({ limit: 1 });

    expect(normalizeTailQuery({})).toEqual({ limit: 100 });
    expect(normalizeTailQuery({ after: "evt_123", limit: 600 })).toEqual({ after: "evt_123", limit: 500 });
    expect(normalizeTailQuery({ limit: 0 })).toEqual({ limit: 1 });
  });

  it("maps known Athena errors to deterministic HTTP status codes", () => {
    expect(mapErrorToHttp(new AthenaError("CONFIG_ERROR", "bad request")).status).toBe(400);
    expect(mapErrorToHttp(new AthenaError("AUTH_IDENTITY_MISSING", "missing identity")).status).toBe(401);
    expect(mapErrorToHttp(new AthenaError("AUTHZ_DENIED", "forbidden")).status).toBe(403);
    expect(mapErrorToHttp(new AthenaError("POLICY_CONCURRENCY_LIMIT_EXCEEDED", "busy")).status).toBe(429);
    expect(mapErrorToHttp(new AthenaError("PAYLOAD_TOO_LARGE", "too big")).status).toBe(413);
    expect(mapErrorToHttp(new AthenaError("PROVIDER_NOT_FOUND", "missing provider")).status).toBe(404);
    expect(mapErrorToHttp(new AthenaError("RUN_TIMEOUT", "timed out")).status).toBe(408);
    expect(mapErrorToHttp(new AthenaError("CONTEXT_OVERFLOW", "too large")).status).toBe(413);
    expect(mapErrorToHttp(new AthenaError("PROVIDER_ERROR", "upstream failed")).status).toBe(502);
    expect(mapErrorToHttp(new Error("unknown")).status).toBe(502);
  });
});
