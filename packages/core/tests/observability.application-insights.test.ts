import { describe, expect, it } from "vitest";
import { resolveAgentId, resolveRunId, resolveTenantId } from "../src/observability/application-insights.js";

describe("application insights observability helpers", () => {
  it("resolves tenant id from athena tenant header", () => {
    const tenantId = resolveTenantId({
      headers: {
        "x-athena-tenant-id": "tenant-a"
      }
    } as never);
    expect(tenantId).toBe("tenant-a");
  });

  it("prefers path params for runId and agentId dimensions", () => {
    const requestUrl = new URL("http://localhost/api/v1/runs/active?runId=query-run&agentId=query-agent");
    expect(resolveRunId({ runId: "path-run" }, requestUrl)).toBe("path-run");
    expect(resolveAgentId({ agentId: "path-agent" }, requestUrl)).toBe("path-agent");
  });

  it("falls back to query string when params are absent", () => {
    const requestUrl = new URL("http://localhost/api/v1/runs/active?runId=query-run&agentId=query-agent");
    expect(resolveRunId({}, requestUrl)).toBe("query-run");
    expect(resolveAgentId({}, requestUrl)).toBe("query-agent");
  });
});
